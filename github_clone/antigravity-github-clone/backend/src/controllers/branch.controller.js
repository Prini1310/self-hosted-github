'use strict';

const branchService = require('../services/branch.service');
const { getBranchTip, assertRepoExists } = require('../services/repoMeta.service');
const { readObject } = require('../services/objectStore.service');

exports.listBranches = (req, res, next) => {
  try {
    const { repoName } = req.params;
    assertRepoExists(repoName);
    const result = branchService.listBranches(repoName);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

exports.createBranch = (req, res, next) => {
  try {
    const { repoName } = req.params;
    const branchName = req.body.branchName || req.body.name;
    const from = req.body.from; // optional backward-compatibility

    assertRepoExists(repoName);
    if (!branchName) {
      return res.status(400).json({ error: 'branchName is required' });
    }

    try {
      const result = branchService.createBranch(repoName, branchName, from);
      res.status(201).json({
        branch: result.branchName,
        branchName: result.branchName,
        from: from || 'main',
        head: result.tipHash,
        tipHash: result.tipHash
      });
    } catch (err) {
      if (err.message === 'branch already exists') {
        res.status(409).json({ error: err.message });
      } else if (err.message === 'source branch not found') {
        res.status(404).json({ error: err.message });
      } else if (err.message === 'cannot branch from empty repo') {
        res.status(400).json({ error: err.message });
      } else {
        res.status(400).json({ error: err.message });
      }
    }
  } catch (err) {
    next(err);
  }
};

exports.switchBranch = (req, res, next) => {
  try {
    const { repoName } = req.params;
    const branchName = req.body.branchName || req.body.name;

    assertRepoExists(repoName);
    if (!branchName) {
      return res.status(400).json({ error: 'branchName is required' });
    }

    try {
      const result = branchService.switchBranch(repoName, branchName);
      res.status(200).json({
        branch: result.branchName,
        branchName: result.branchName,
        head: result.head
      });
    } catch (err) {
      if (err.message === 'branch not found') {
        res.status(404).json({ error: err.message });
      } else {
        res.status(400).json({ error: err.message });
      }
    }
  } catch (err) {
    next(err);
  }
};

exports.mergeBranch = (req, res, next) => {
  try {
    const { repoName } = req.params;
    const { sourceBranch, strategy } = req.body;
    // Pass the authenticated user as author (set by auth middleware)
    const author = req.user?.username || req.user?.sub || 'system';

    assertRepoExists(repoName);
    if (!sourceBranch) {
      return res.status(400).json({ error: 'sourceBranch is required' });
    }

    let result;
    try {
      result = branchService.mergeBranch(repoName, sourceBranch, author, strategy || 'merge');
    } catch (err) {
      const status = err.status || 400;
      return res.status(status).json({ error: err.message });
    }

    // Map merge result type to appropriate HTTP response
    if (result.type === 'conflict') {
      return res.status(409).json({
        error: 'Merge conflict: the following files conflict and must be resolved manually',
        type: 'conflict',
        conflicts: result.conflicts,
      });
    }

    // already-merged, fast-forward, merged — all 200
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

exports.mergeStatus = (req, res, next) => {
  try {
    const { repoName } = req.params;
    const { source, target } = req.query;

    assertRepoExists(repoName);
    if (!source || !target) {
      return res.status(400).json({ error: 'source and target query parameters are required' });
    }

    try {
      const status = branchService.getMergeStatus(repoName, source, target);
      return res.status(200).json(status);
    } catch (err) {
      const statusCode = err.status || 400;
      return res.status(statusCode).json({ error: err.message });
    }
  } catch (err) {
    next(err);
  }
};


exports.deleteBranch = (req, res, next) => {
  try {
    const { repoName } = req.params;
    const branchName = req.params.branchName || req.body.branchName;
    assertRepoExists(repoName);
    if (!branchName) {
      return res.status(400).json({ error: 'branchName is required' });
    }
    try {
      const result = branchService.deleteBranch(repoName, branchName);
      res.status(200).json({ deleted: result.deleted });
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message });
    }
  } catch (err) {
    next(err);
  }
};

exports.getBranch = (req, res, next) => {
  try {
    const { repoName, branchName } = req.params;
    assertRepoExists(repoName);
    const head = getBranchTip(repoName, branchName);
    if (!head) {
      return res.status(404).json({ error: 'branch not found' });
    }
    const commit = head !== 'none' ? readObject(repoName, head) : null;
    res.status(200).json({ branch: branchName, head, commit });
  } catch (err) {
    next(err);
  }
};