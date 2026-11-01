'use strict';

const express = require('express');
const router  = express.Router();
const auth = require('../middleware/auth.middleware');

const {
  // Day 3–4
  createBlobHandler,
  createTreeHandler,
  createCommitHandler,
  getObjectHandler,
  // Day 5–6
  initRepoHandler,
  addFileHandler,
  commitHandler,
  logHandler,
  statusHandler,
  listReposHandler,
} = require('../controllers/repo.controller');

/**
 * GET /api/repos
 * Auth: Required (Bearer token)
 * Success: 200 { repos: string[] }
 * Errors: 401 (no token / invalid token)
 */
router.get('/', auth, listReposHandler);

/**
 * POST /api/repos/:repoName/init
 * Auth: None (Public)
 * Success: 201 { message }
 * Errors: 400 (repo already exists / invalid name)
 */
router.post('/:repoName/init', initRepoHandler);

// Apply auth middleware to all endpoints below this line
router.use(auth);

/**
 * POST /api/repos/:repoName/blobs
 * Auth: Required (Bearer token)
 * Body: { content: string }
 * Success: 200 { hash: string }
 * Errors: 401 (no token), 404 (repo not found), 400 (missing fields)
 */
router.post('/:repoName/blobs', createBlobHandler);

/**
 * POST /api/repos/:repoName/trees
 * Auth: Required (Bearer token)
 * Body: { entries: [{name, hash, mode?}] }
 * Success: 200 { hash: string }
 * Errors: 401 (no token), 404 (repo not found), 400 (missing fields)
 */
router.post('/:repoName/trees', createTreeHandler);

/**
 * POST /api/repos/:repoName/commits
 * Auth: Required (Bearer token)
 * Body: { treeHash: string, parentHash?: string, author: string, message: string }
 * Success: 200 { hash: string }
 * Errors: 401 (no token), 404 (repo not found), 400 (missing fields)
 */
router.post('/:repoName/commits', createCommitHandler);

/**
 * GET /api/repos/:repoName/objects/:hash
 * Auth: Required (Bearer token)
 * Success: 200 Object contents
 * Errors: 401 (no token), 404 (not found)
 */
router.get('/:repoName/objects/:hash', getObjectHandler);

const { validate } = require('../middleware/validate.middleware');

/**
 * POST /api/repos/:repoName/add
 * Auth: Required (Bearer token)
 * Body: { filepath: string, content: string }
 * Success: 200 { filepath, blobHash }
 * Errors: 401 (no token), 404 (repo not found), 400 (missing fields / path traversal)
 */
router.post('/:repoName/add', validate(['filepath', 'content']), addFileHandler);

/**
 * POST /api/repos/:repoName/commit
 * Auth: Required (Bearer token)
 * Body: { author: string, message: string }
 * Success: 201 { commitHash, treeHash }
 * Errors: 401 (no token), 404 (repo not found), 400 (missing fields / empty staging)
 */
router.post('/:repoName/commit', validate(['author', 'message']), commitHandler);

/**
 * GET /api/repos/:repoName/log
 * Auth: Required (Bearer token)
 * Success: 200 { log: Array }
 * Errors: 401 (no token), 404 (repo not found)
 */
router.get('/:repoName/log', logHandler);

/**
 * GET /api/repos/:repoName/status
 * Auth: Required (Bearer token)
 * Success: 200 { head, staged, branch }
 * Errors: 401 (no token), 404 (repo not found)
 */
router.get('/:repoName/status', statusHandler);

module.exports = router;
