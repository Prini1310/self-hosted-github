'use strict';

const activityService = require('../services/activity.service');
const { getBranchTip, setBranchTip, getCurrentBranch, setHead, assertRepoExists } = require('../services/repoMeta.service');

function push(req, res, next) {
  try {
    const { repoName } = req.params;
    const { branch, commit } = req.body;
    const username = req.user?.username || 'unknown';

    assertRepoExists(repoName);

    if (!branch || !commit) {
      return res.status(400).json({ error: 'Missing branch or commit in request body' });
    }

    // Update branch tip and HEAD if current
    setBranchTip(repoName, branch, commit);
    if (getCurrentBranch(repoName) === branch) {
      setHead(repoName, commit);
    }

    activityService.recordActivity(repoName, {
      username,
      action: 'push',
      branch,
      commit
    });

    res.status(200).json({ success: true, message: `Successfully pushed commit ${commit} to branch ${branch}` });
  } catch (err) {
    next(err);
  }
}

function pull(req, res, next) {
  try {
    const { repoName } = req.params;
    const { branch, targetBranch } = req.body;
    const username = req.user?.username || 'unknown';

    assertRepoExists(repoName);

    if (!targetBranch) {
      return res.status(400).json({ error: 'Missing targetBranch in request body' });
    }

    const localBranch = branch || getCurrentBranch(repoName);
    const targetTip = getBranchTip(repoName, targetBranch);
    if (!targetTip) {
      return res.status(404).json({ error: `Target branch '${targetBranch}' tip not found` });
    }

    // Sync local branch to target branch tip
    setBranchTip(repoName, localBranch, targetTip);
    if (getCurrentBranch(repoName) === localBranch) {
      setHead(repoName, targetTip);
    }

    activityService.recordActivity(repoName, {
      username,
      action: 'pull',
      branch: localBranch,
      targetBranch,
      commit: targetTip
    });

    res.status(200).json({ success: true, commit: targetTip, message: `Successfully pulled latest changes from ${targetBranch}` });
  } catch (err) {
    next(err);
  }
}

function listActivity(req, res, next) {
  try {
    const { repoName } = req.params;
    assertRepoExists(repoName);

    const log = activityService.getActivityLog(repoName);
    res.json({ activity: log });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  push,
  pull,
  listActivity
};
