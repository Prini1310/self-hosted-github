/**
 * pythonBuild.service.js
 * Service for running, listing, and saving build records for Python projects.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { initSSE, sendSSEEvent, closeSSE } = require('../utils/sse.util');
const { saveBuild, getBuild, listBuilds } = require('./buildStore.service');

const STORAGE_ROOT = process.env.STORAGE_PATH || path.join(__dirname, "../../../storage/repos");

function detectPythonProject(repoName) {
  const workspacePath = path.join(STORAGE_ROOT, repoName, 'workspace');
  if (fs.existsSync(path.join(workspacePath, 'tox.ini'))) {
    return 'tox';
  }
  if (
    fs.existsSync(path.join(workspacePath, 'requirements.txt')) ||
    fs.existsSync(path.join(workspacePath, 'setup.py')) ||
    fs.existsSync(path.join(workspacePath, 'pyproject.toml'))
  ) {
    return 'pytest';
  }
  return 'unknown';
}

function getPythonBuildSteps(tool, workspacePath) {
  const isWin = process.platform === 'win32';
  const binDir = isWin ? 'Scripts' : 'bin';

  if (tool === 'pytest') {
    return [
      {
        label: 'Creating virtualenv',
        cmd: 'python',
        args: ['-m', 'venv', '.venv']
      },
      {
        label: 'Installing dependencies',
        cmd: path.join(workspacePath, '.venv', binDir, isWin ? 'pip.exe' : 'pip'),
        args: ['install', '-r', 'requirements.txt']
      },
      {
        label: 'Running pytest',
        cmd: path.join(workspacePath, '.venv', binDir, isWin ? 'pytest.exe' : 'pytest'),
        args: ['--tb=short', '-v']
      }
    ];
  }

  if (tool === 'tox') {
    return [
      {
        label: 'Running tox',
        cmd: 'tox',
        args: []
      }
    ];
  }

  throw new Error('No supported build tool found');
}

function runStep(cmd, args, cwd, env, onLineCallback) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: true, env });
    let stdoutBuffer = '';
    let stderrBuffer = '';

    child.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop();
      for (const line of lines) {
        if (line.trim() !== '') {
          onLineCallback(line);
        }
      }
    });

    child.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
      const lines = stderrBuffer.split(/\r?\n/);
      stderrBuffer = lines.pop();
      for (const line of lines) {
        if (line.trim() !== '') {
          onLineCallback(line);
        }
      }
    });

    child.on('error', (err) => {
      if (stdoutBuffer.trim() !== '') onLineCallback(stdoutBuffer);
      if (stderrBuffer.trim() !== '') onLineCallback(stderrBuffer);
      reject(err);
    });

    child.on('close', (code) => {
      if (stdoutBuffer.trim() !== '') onLineCallback(stdoutBuffer);
      if (stderrBuffer.trim() !== '') onLineCallback(stderrBuffer);
      resolve(code === null ? 1 : code);
    });
  });
}

async function runPythonBuild(repoName, branch, res, envConfig) {
  const buildId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
  const tool = detectPythonProject(repoName);
  const workspacePath = path.join(STORAGE_ROOT, repoName, 'workspace');

  const buildRecord = {
    buildId,
    repoName,
    branch,
    trigger: 'push',
    tool: 'python-' + tool,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    logs: [],
    exitCode: null,
    environment: envConfig ? envConfig.name : 'none'
  };

  // 1. Save initial record
  saveBuild(repoName, buildRecord);

  // 2. Initialize SSE stream
  initSSE(res);
  sendSSEEvent(res, 'start', { buildId, tool: 'python-' + tool, branch, environment: buildRecord.environment });

  // 3. Handle unknown project structure
  if (tool === 'unknown') {
    const errorMsg = 'ERROR: No requirements.txt, setup.py, pyproject.toml, or tox.ini found in workspace';
    buildRecord.status = 'failed';
    buildRecord.finishedAt = new Date().toISOString();
    buildRecord.exitCode = 1;
    buildRecord.logs.push(errorMsg);
    saveBuild(repoName, buildRecord);

    sendSSEEvent(res, 'log', { line: errorMsg });
    sendSSEEvent(res, 'done', { buildId, status: 'failed', exitCode: 1 });
    closeSSE(res);
    return;
  }

  try {
    const childEnv = envConfig ? { ...process.env, NODE_ENV: envConfig.nodeEnv, ...envConfig.envVars } : process.env;

    if (envConfig && envConfig.buildCommandOverride) {
      const overrideCmd = envConfig.buildCommandOverride;
      const stepStartMsg = `▶ Running build override: ${overrideCmd}...`;
      buildRecord.logs.push(stepStartMsg);
      saveBuild(repoName, buildRecord);
      sendSSEEvent(res, 'log', { line: stepStartMsg });

      try {
        const exitCode = await runStep(overrideCmd, [], workspacePath, childEnv, (line) => {
          buildRecord.logs.push(line);
          saveBuild(repoName, buildRecord);
          sendSSEEvent(res, 'log', { line });
        });

        if (exitCode !== 0) {
          const stepFailMsg = `❌ Build override failed (exit ${exitCode})`;
          buildRecord.logs.push(stepFailMsg);
          buildRecord.status = 'failed';
          buildRecord.exitCode = exitCode;
          buildRecord.finishedAt = new Date().toISOString();
          saveBuild(repoName, buildRecord);

          sendSSEEvent(res, 'log', { line: stepFailMsg });
          sendSSEEvent(res, 'done', { buildId, status: 'failed', exitCode });
          closeSSE(res);
          return;
        }
      } catch (err) {
        const errLine = `SPAWN ERROR: ${err.message}`;
        const stepFailMsg = `❌ Build override failed (exit 1)`;
        
        buildRecord.logs.push(errLine);
        buildRecord.logs.push(stepFailMsg);
        buildRecord.status = 'failed';
        buildRecord.exitCode = 1;
        buildRecord.finishedAt = new Date().toISOString();
        saveBuild(repoName, buildRecord);

        sendSSEEvent(res, 'log', { line: errLine });
        sendSSEEvent(res, 'log', { line: stepFailMsg });
        sendSSEEvent(res, 'done', { buildId, status: 'failed', exitCode: 1 });
        closeSSE(res);
        return;
      }
    } else {
      const steps = getPythonBuildSteps(tool, workspacePath);
      let success = true;

      for (const step of steps) {
        const stepStartMsg = `▶ ${step.label}...`;
        buildRecord.logs.push(stepStartMsg);
        saveBuild(repoName, buildRecord);
        sendSSEEvent(res, 'log', { line: stepStartMsg });

        try {
          const exitCode = await runStep(step.cmd, step.args, workspacePath, childEnv, (line) => {
            buildRecord.logs.push(line);
            saveBuild(repoName, buildRecord);
            sendSSEEvent(res, 'log', { line });
          });

          if (exitCode !== 0) {
            success = false;
            const stepFailMsg = `❌ Step failed: ${step.label} (exit ${exitCode})`;
            buildRecord.logs.push(stepFailMsg);
            buildRecord.status = 'failed';
            buildRecord.exitCode = exitCode;
            buildRecord.finishedAt = new Date().toISOString();
            saveBuild(repoName, buildRecord);

            sendSSEEvent(res, 'log', { line: stepFailMsg });
            sendSSEEvent(res, 'done', { buildId, status: 'failed', exitCode });
            closeSSE(res);
            return;
          }

          const stepDoneMsg = `✅ ${step.label} done`;
          buildRecord.logs.push(stepDoneMsg);
          saveBuild(repoName, buildRecord);
          sendSSEEvent(res, 'log', { line: stepDoneMsg });

        } catch (err) {
          success = false;
          const errLine = `SPAWN ERROR: ${err.message}`;
          const stepFailMsg = `❌ Step failed: ${step.label} (exit 1)`;
          
          buildRecord.logs.push(errLine);
          buildRecord.logs.push(stepFailMsg);
          buildRecord.status = 'failed';
          buildRecord.exitCode = 1;
          buildRecord.finishedAt = new Date().toISOString();
          saveBuild(repoName, buildRecord);

          sendSSEEvent(res, 'log', { line: errLine });
          sendSSEEvent(res, 'log', { line: stepFailMsg });
          sendSSEEvent(res, 'done', { buildId, status: 'failed', exitCode: 1 });
          closeSSE(res);
          return;
        }
      }
    }

    if (success) {
      buildRecord.status = 'success';
      buildRecord.exitCode = 0;
      buildRecord.finishedAt = new Date().toISOString();
      saveBuild(repoName, buildRecord);

      sendSSEEvent(res, 'done', { buildId, status: 'success', exitCode: 0 });
      closeSSE(res);
    }

  } catch (err) {
    const mainErrLine = `ERROR: ${err.message}`;
    buildRecord.logs.push(mainErrLine);
    buildRecord.status = 'failed';
    buildRecord.exitCode = 1;
    buildRecord.finishedAt = new Date().toISOString();
    saveBuild(repoName, buildRecord);

    sendSSEEvent(res, 'log', { line: mainErrLine });
    sendSSEEvent(res, 'done', { buildId, status: 'failed', exitCode: 1 });
    closeSSE(res);
  }
}

module.exports = {
  detectPythonProject,
  getPythonBuildSteps,
  saveBuild,
  getBuild,
  listBuilds,
  runPythonBuild
};
