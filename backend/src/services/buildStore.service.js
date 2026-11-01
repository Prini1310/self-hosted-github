/**
 * buildStore.service.js
 * Shared storage service for reading, writing, and listing repository builds.
 */

const fs = require('fs');
const path = require('path');

const STORAGE_ROOT = process.env.STORAGE_PATH || path.join(__dirname, "../../../storage/repos");

function saveBuild(repoName, buildRecord) {
  const buildsDir = path.join(STORAGE_ROOT, repoName, 'builds');
  if (!fs.existsSync(buildsDir)) {
    fs.mkdirSync(buildsDir, { recursive: true });
  }
  const buildPath = path.join(buildsDir, `${buildRecord.buildId}.json`);
  fs.writeFileSync(buildPath, JSON.stringify(buildRecord, null, 2), 'utf8');
}

function getBuild(repoName, buildId) {
  const buildPath = path.join(STORAGE_ROOT, repoName, 'builds', `${buildId}.json`);
  if (!fs.existsSync(buildPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(buildPath, 'utf8'));
  } catch (err) {
    return null;
  }
}

function listBuilds(repoName) {
  const buildsDir = path.join(STORAGE_ROOT, repoName, 'builds');
  if (!fs.existsSync(buildsDir)) {
    return [];
  }
  try {
    const files = fs.readdirSync(buildsDir);
    const builds = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const buildPath = path.join(buildsDir, file);
        try {
          const record = JSON.parse(fs.readFileSync(buildPath, 'utf8'));
          builds.push(record);
        } catch (e) {
          // Ignore parse errors for incomplete files
        }
      }
    }
    builds.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    return builds;
  } catch (err) {
    return [];
  }
}

function recoverStuckBuilds(repoName) {
  const builds = listBuilds(repoName);
  let count = 0;
  for (const build of builds) {
    if (build.status === 'running') {
      build.status = 'failed';
      build.finishedAt = new Date().toISOString();
      if (!Array.isArray(build.logs)) {
        build.logs = [];
      }
      build.logs.push('BUILD INTERRUPTED — server restarted mid-build');
      build.exitCode = -1;
      saveBuild(repoName, build);
      count++;
    }
  }
  return count;
}

function recoverAllStuckBuilds() {
  if (!fs.existsSync(STORAGE_ROOT)) {
    return 0;
  }
  let total = 0;
  try {
    const repos = fs.readdirSync(STORAGE_ROOT);
    for (const repo of repos) {
      const repoPath = path.join(STORAGE_ROOT, repo);
      const stat = fs.statSync(repoPath);
      if (stat.isDirectory()) {
        const buildsDir = path.join(repoPath, 'builds');
        if (fs.existsSync(buildsDir)) {
          total += recoverStuckBuilds(repo);
        }
      }
    }
  } catch (err) {
    // ignore
  }
  return total;
}

module.exports = {
  saveBuild,
  getBuild,
  listBuilds,
  recoverStuckBuilds,
  recoverAllStuckBuilds
};
