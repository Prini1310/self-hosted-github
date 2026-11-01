'use strict';

const { getRepoTree, getEntryAtPath, getBlobContent } = require('../services/tree.service');

/**
 * GET /api/repos/:repoName/tree
 * Returns root-level directory listing of the latest commit.
 * Query param: ?branch=<name>
 */
exports.getTree = (req, res, next) => {
  try {
    const { repoName } = req.params;
    const { branch } = req.query;
    const result = getRepoTree(repoName, branch || '');
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/repos/:repoName/tree/*filepath
 * Returns the children of a sub-folder or the metadata+content of a file.
 * Query param: ?branch=<name>
 */
exports.getTreePath = (req, res, next) => {
  try {
    const { repoName } = req.params;
    const filepath = req.params[0] || req.params.filepath || '';
    const { branch } = req.query;
    const result = getEntryAtPath(repoName, filepath, branch || '');
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/repos/:repoName/blob/*filepath
 * Returns the raw content of a file for rendering.
 * Query param: ?branch=<name>
 */
exports.getBlob = (req, res, next) => {
  try {
    const { repoName } = req.params;
    const filepath = req.params[0] || req.params.filepath || '';
    const { branch } = req.query;
    const result = getBlobContent(repoName, filepath, branch || '');
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};
