/**
 * javaBuild.service.js
 * Service for running and saving build records for Java projects.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { initSSE, sendSSEEvent, closeSSE } = require('../utils/sse.util');
const { saveBuild, getBuild, listBuilds } = require('./buildStore.service');

const STORAGE_ROOT = process.env.STORAGE_PATH || path.join(__dirname, "../../../storage/repos");

function detectBuildTool(repoName) {
  const workspacePath = path.join(STORAGE_ROOT, repoName, 'workspace');
  if (fs.existsSync(path.join(workspacePath, 'pom.xml'))) {
    return 'maven';
  }
  if (fs.existsSync(path.join(workspacePath, 'build.gradle'))) {
    return 'gradle';
  }
  return 'unknown';
}

function getBuildCommand(tool) {
  if (tool === 'maven') {
    return { cmd: 'mvn', args: ['clean', 'test', '-B'] };
  }
  if (tool === 'gradle') {
    return { cmd: 'gradle', args: ['clean', 'test'] };
  }
  throw new Error('No supported build tool found');
}

function runBuild(repoName, branch, res, envConfig) {
  const buildId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
  const tool = detectBuildTool(repoName);

  const buildRecord = {
    buildId,
    repoName,
    branch,
    trigger: 'push',
    tool,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    logs: [],
    exitCode: null,
    environment: envConfig ? envConfig.name : 'none'
  };

  // 1. Initial save
  saveBuild(repoName, buildRecord);

  // 2. Initialize SSE stream
  initSSE(res);
  sendSSEEvent(res, 'start', { buildId, tool, branch, environment: buildRecord.environment });

  // 3. Handle unknown build tool
  if (tool === 'unknown') {
    const errorMsg = 'ERROR: No pom.xml or build.gradle found in workspace';
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

  // 4. Setup buffers and execution
  const workspacePath = path.join(STORAGE_ROOT, repoName, 'workspace');
  let stdoutBuffer = '';
  let stderrBuffer = '';
  let completed = false;

  function finish(status, exitCode, errMessage = null) {
    if (completed) return;
    completed = true;

    if (stdoutBuffer.trim() !== '') {
      buildRecord.logs.push(stdoutBuffer);
      sendSSEEvent(res, 'log', { line: stdoutBuffer });
      stdoutBuffer = '';
    }
    if (stderrBuffer.trim() !== '') {
      buildRecord.logs.push(stderrBuffer);
      sendSSEEvent(res, 'log', { line: stderrBuffer });
      stderrBuffer = '';
    }

    if (errMessage) {
      buildRecord.logs.push(errMessage);
      sendSSEEvent(res, 'log', { line: errMessage });
    }

    buildRecord.status = status;
    buildRecord.exitCode = exitCode;
    buildRecord.finishedAt = new Date().toISOString();
    saveBuild(repoName, buildRecord);

    sendSSEEvent(res, 'done', { buildId, status, exitCode });
    closeSSE(res);
  }

  try {
    let child;
    const childEnv = envConfig ? { ...process.env, NODE_ENV: envConfig.nodeEnv, ...envConfig.envVars } : process.env;

    if (envConfig && envConfig.buildCommandOverride) {
      const overrideCmd = envConfig.buildCommandOverride;
      buildRecord.logs.push(`▶ Running build override: ${overrideCmd}`);
      sendSSEEvent(res, 'log', { line: `▶ Running build override: ${overrideCmd}` });
      child = spawn(overrideCmd, [], { cwd: workspacePath, shell: true, env: childEnv });
    } else {
      const { cmd, args } = getBuildCommand(tool);
      child = spawn(cmd, args, { cwd: workspacePath, shell: true, env: childEnv });
    }

    child.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop(); // Keep potential incomplete line
      let updated = false;
      for (const line of lines) {
        if (line.trim() !== '') {
          buildRecord.logs.push(line);
          sendSSEEvent(res, 'log', { line });
          updated = true;
        }
      }
      if (updated) {
        saveBuild(repoName, buildRecord);
      }
    });

    child.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
      const lines = stderrBuffer.split(/\r?\n/);
      stderrBuffer = lines.pop(); // Keep potential incomplete line
      let updated = false;
      for (const line of lines) {
        if (line.trim() !== '') {
          buildRecord.logs.push(line);
          sendSSEEvent(res, 'log', { line });
          updated = true;
        }
      }
      if (updated) {
        saveBuild(repoName, buildRecord);
      }
    });

    child.on('error', (err) => {
      finish('failed', 1, `SPAWN ERROR: ${err.message}`);
    });

    child.on('close', (code) => {
      const exitCode = code === null ? 1 : code;
      const status = exitCode === 0 ? 'success' : 'failed';
      finish(status, exitCode);
    });

  } catch (err) {
    finish('failed', 1, `SPAWN ERROR: ${err.message}`);
  }
}

module.exports = {
  detectBuildTool,
  getBuildCommand,
  saveBuild,
  getBuild,
  listBuilds,
  runBuild
};
