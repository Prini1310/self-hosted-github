'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * Root directory for all repository storage.
 * Override with STORAGE_PATH env var for tests / Docker.
 */
const STORAGE_ROOT =
  process.env.STORAGE_PATH ||
  path.join(__dirname, '../../../storage/repos');

// ─── Path helpers ────────────────────────────────────────────────────────────

function _repoDir(repoName) {
  return path.join(STORAGE_ROOT, repoName);
}

function _headPath(repoName) {
  return path.join(_repoDir(repoName), 'HEAD');
}

function _indexPath(repoName) {
  return path.join(_repoDir(repoName), 'index.json');
}

function _headBranchPath(repoName) {
  return path.join(_repoDir(repoName), 'HEAD_BRANCH');
}

function _branchesJsonPath(repoName) {
  return path.join(_repoDir(repoName), 'branches.json');
}

// ─── Public API ───────────────────────────────────────────────────────────────

function initRepo(repoName) {
  const dir = _repoDir(repoName);
  if (fs.existsSync(dir)) {
    throw Object.assign(new Error('repo already exists'), { status: 409 });
  }
  fs.mkdirSync(path.join(dir, 'objects'), { recursive: true });
  fs.writeFileSync(_headPath(repoName), 'none', 'utf8');
  fs.writeFileSync(_indexPath(repoName), JSON.stringify({}), 'utf8');
  
  // Write HEAD_BRANCH file with content "main"
  fs.writeFileSync(_headBranchPath(repoName), 'main', 'utf8');
  // Write branches.json as { "main": "none" }
  fs.writeFileSync(_branchesJsonPath(repoName), JSON.stringify({ main: 'none' }, null, 2), 'utf8');
}

function getHead(repoName) {
  return fs.readFileSync(_headPath(repoName), 'utf8').trim();
}

// Check if repoExists - export this helper properly
function repoExists(repoName) {
  return fs.existsSync(_repoDir(repoName));
}

function assertRepoExists(repoName) {
  if (!repoExists(repoName)) {
    const err = new Error(`Repository '${repoName}' not found`);
    err.status = 404;
    throw err;
  }
}

function setHead(repoName, commitHash) {
  fs.writeFileSync(_headPath(repoName), commitHash, 'utf8');
}

function getCurrentBranch(repoName) {
  const p = _headBranchPath(repoName);
  if (!fs.existsSync(p)) {
    if (repoExists(repoName)) {
      fs.writeFileSync(p, 'main', 'utf8');
      return 'main';
    } else {
      throw Object.assign(new Error('Repo not found'), { status: 404 });
    }
  }
  return fs.readFileSync(p, 'utf8').trim();
}

function setCurrentBranch(repoName, branchName) {
  fs.writeFileSync(_headBranchPath(repoName), branchName, 'utf8');
}

function getBranches(repoName) {
  const p = _branchesJsonPath(repoName);
  if (!fs.existsSync(p)) {
    if (repoExists(repoName)) {
      const head = getHead(repoName);
      const branches = { main: head };
      fs.writeFileSync(p, JSON.stringify(branches, null, 2), 'utf8');
      return branches;
    } else {
      throw Object.assign(new Error('Repo not found'), { status: 404 });
    }
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function setBranches(repoName, branches) {
  const p = _branchesJsonPath(repoName);
  fs.writeFileSync(p, JSON.stringify(branches, null, 2), 'utf8');
}

function getBranchTip(repoName, branchName) {
  const branches = getBranches(repoName);
  return branches[branchName] !== undefined ? branches[branchName] : null;
}

function setBranchTip(repoName, branchName, commitHash) {
  const branches = getBranches(repoName);
  branches[branchName] = commitHash;
  setBranches(repoName, branches);
}

function getIndex(repoName) {
  const p = _indexPath(repoName);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (next) {
    return {};
  }
}

function setIndex(repoName, index) {
  fs.writeFileSync(_indexPath(repoName), JSON.stringify(index, null, 2), 'utf8');
}

// Stage a file
function stageFile(repoName, filepath, blobHash) {
  const index = getIndex(repoName);
  index[filepath] = blobHash;
  setIndex(repoName, index);
}

function unstageFile(repoName, filepath) {
  const index = getIndex(repoName);
  delete index[filepath];
  setIndex(repoName, index);
}

function listRepos() {
  if (!fs.existsSync(STORAGE_ROOT)) return [];
  return fs.readdirSync(STORAGE_ROOT).filter(name => {
    try {
      return fs.statSync(path.join(STORAGE_ROOT, name)).isDirectory();
    } catch {
      return false;
    }
  });
}

module.exports = {
  initRepo,
  getHead,
  setHead,
  getIndex,
  setIndex,
  stageFile,
  unstageFile,
  repoExists,
  assertRepoExists,
  listRepos,
  getCurrentBranch,
  setCurrentBranch,
  getBranches,
  setBranches,
  getBranchTip,
  setBranchTip,
};
