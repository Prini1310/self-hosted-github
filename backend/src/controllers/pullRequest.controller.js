'use strict';

const prService = require('../services/pullRequest.service');

function create(req, res, next) {
  try {
    const { repoName } = req.params;
    const { title, description, fromBranch, toBranch, author } = req.body;
    const prAuthor = author || req.user?.username || 'unknown';

    if (!title || !fromBranch || !toBranch) {
      return res.status(400).json({ error: 'Missing title, fromBranch, or toBranch in request body' });
    }

    const pr = prService.createPR(repoName, {
      title,
      description,
      fromBranch,
      toBranch,
      author: prAuthor
    });

    res.status(201).json({ success: true, pr });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
}

function list(req, res, next) {
  try {
    const { repoName } = req.params;
    const pulls = prService.listPRs(repoName);
    res.json({ success: true, pulls });
  } catch (err) {
    next(err);
  }
}

function get(req, res, next) {
  try {
    const { repoName, prId } = req.params;
    const pr = prService.getPR(repoName, parseInt(prId, 10));
    if (!pr) {
      return res.status(404).json({ error: `Pull request #${prId} not found` });
    }
    res.json({ success: true, pr });
  } catch (err) {
    next(err);
  }
}

function update(req, res, next) {
  try {
    const { repoName, prId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Missing status in request body' });
    }

    const pr = prService.updatePRStatus(repoName, parseInt(prId, 10), status);
    res.json({ success: true, pr });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
}

function merge(req, res, next) {
  try {
    const { repoName, prId } = req.params;
    const username = req.user?.username || 'unknown';

    const result = prService.mergePR(repoName, parseInt(prId, 10), username);
    if (!result.success) {
      return res.status(409).json({
        error: 'Merge conflict detected. Cannot merge pull request automatically.',
        conflicts: result.conflicts
      });
    }

    res.json({ success: true, message: 'Pull request successfully merged', pr: result.pr });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
}

module.exports = {
  create,
  list,
  get,
  update,
  merge
};
