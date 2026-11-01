'use strict';

const express = require('express');
const router = express.Router();
const treeController = require('../controllers/tree.controller');
const auth = require('../middleware/auth.middleware');

// All tree/blob routes require JWT auth
router.use(auth);

/**
 * GET /api/repos/:repoName/tree
 * Root-level file listing for a repo.
 */
router.get('/:repoName/tree', treeController.getTree);

/**
 * GET /api/repos/:repoName/tree/<path...>
 * Sub-folder listing or file metadata at <path>.
 * Express wildcard parameter is captured as req.params[0]
 */
router.get('/:repoName/tree/*', treeController.getTreePath);

/**
 * GET /api/repos/:repoName/blob/<path...>
 * Raw file content at <path>.
 */
router.get('/:repoName/blob/*', treeController.getBlob);

module.exports = router;
