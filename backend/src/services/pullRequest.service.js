'use strict';

const fs = require('fs');
const path = require('path');
const { getBranches, getCurrentBranch, assertRepoExists } = require('./repoMeta.service');
const branchService = require('./branch.service');
const activityService = require('./activity.service');

const STORAGE_ROOT = process.env.STORAGE_PATH || path.join(__dirname, "../../../storage/repos");

function _pullsDir(repoName) {
  return path.join(STORAGE_ROOT, repoName, 'pulls');
}

function _prPath(repoName, prId) {
  return path.join(_pullsDir(repoName), `${prId}.json`);
}

function createPR(repoName, { title, description, fromBranch, toBranch, author }) {
  assertRepoExists(repoName);
  
  const branches = getBranches(repoName);
  if (!(fromBranch in branches)) {
    throw Object.assign(new Error(`Source branch '${fromBranch}' not found`), { status: 400 });
  }
  if (!(toBranch in branches)) {
    throw Object.assign(new Error(`Target branch '${toBranch}' not found`), { status: 400 });
  }

  const dir = _pullsDir(repoName);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Auto-increment PR ID
  let maxId = 0;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.endsWith('.json')) {
      const id = parseInt(path.basename(file, '.json'), 10);
      if (!isNaN(id) && id > maxId) {
        maxId = id;
      }
    }
  }
  const prId = maxId + 1;

  const prRecord = {
    prId,
    title,
    description: description || '',
    fromBranch,
    toBranch,
    author,
    status: 'open',
    createdAt: new Date().toISOString(),
    mergedAt: null,
    closedAt: null
  };

  fs.writeFileSync(_prPath(repoName, prId), JSON.stringify(prRecord, null, 2), 'utf8');
  return prRecord;
}

function listPRs(repoName) {
  assertRepoExists(repoName);
  const dir = _pullsDir(repoName);
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs.readdirSync(dir);
  const pulls = [];
  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const pr = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        pulls.push(pr);
      } catch (err) {
        // ignore
      }
    }
  }
  // Sort pulls by prId descending
  pulls.sort((a, b) => b.prId - a.prId);
  return pulls;
}

function getPR(repoName, prId) {
  assertRepoExists(repoName);
  const p = _prPath(repoName, prId);
  if (!fs.existsSync(p)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    return null;
  }
}

function updatePRStatus(repoName, prId, status) {
  assertRepoExists(repoName);
  const pr = getPR(repoName, prId);
  if (!pr) {
    throw Object.assign(new Error(`PR #${prId} not found`), { status: 404 });
  }

  if (!['open', 'merged', 'closed'].includes(status)) {
    throw Object.assign(new Error(`Invalid PR status: ${status}`), { status: 400 });
  }

  pr.status = status;
  if (status === 'closed') {
    pr.closedAt = new Date().toISOString();
  } else if (status === 'open') {
    pr.closedAt = null;
    pr.mergedAt = null;
  }

  fs.writeFileSync(_prPath(repoName, prId), JSON.stringify(pr, null, 2), 'utf8');
  return pr;
}

function mergePR(repoName, prId, username) {
  assertRepoExists(repoName);
  const pr = getPR(repoName, prId);
  if (!pr) {
    throw Object.assign(new Error(`PR #${prId} not found`), { status: 404 });
  }

  if (pr.status !== 'open') {
    throw Object.assign(new Error(`PR #${prId} is already ${pr.status}`), { status: 400 });
  }

  const originalBranch = getCurrentBranch(repoName);
  const { fromBranch, toBranch } = pr;

  let mergeResult;
  try {
    // 1. Switch to target branch (toBranch)
    if (originalBranch !== toBranch) {
      branchService.switchBranch(repoName, toBranch);
    }

    // 2. Perform merge of fromBranch into toBranch
    mergeResult = branchService.mergeBranch(repoName, fromBranch, username || pr.author);

    if (mergeResult.type === 'conflict') {
      // Revert branch change on conflict
      if (originalBranch !== toBranch) {
        branchService.switchBranch(repoName, originalBranch);
      }
      return { success: false, conflict: true, conflicts: mergeResult.conflicts };
    }

    // 3. Mark PR as merged
    pr.status = 'merged';
    pr.mergedAt = new Date().toISOString();
    fs.writeFileSync(_prPath(repoName, prId), JSON.stringify(pr, null, 2), 'utf8');

    // 4. Record Activity Log
    activityService.recordActivity(repoName, {
      username: username || pr.author,
      action: 'pull',
      branch: toBranch,
      targetBranch: fromBranch,
      commit: mergeResult.commitHash || 'none'
    });

    // 5. Restore original active branch if it changed
    if (originalBranch !== toBranch) {
      branchService.switchBranch(repoName, originalBranch);
    }

    return { success: true, mergeResult, pr };
  } catch (err) {
    // Make sure we try to restore original branch on catastrophic error
    try {
      if (originalBranch !== getCurrentBranch(repoName)) {
        branchService.switchBranch(repoName, originalBranch);
      }
    } catch (e) {
      // ignore
    }
    throw err;
  }
}

module.exports = {
  createPR,
  listPRs,
  getPR,
  updatePRStatus,
  mergePR
};
