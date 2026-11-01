'use strict';

const express = require('express');
const router = express.Router();
const prController = require('../controllers/pullRequest.controller');
const auth = require('../middleware/auth.middleware');

const { validate } = require('../middleware/validate.middleware');

// All pull request routes require authentication
router.use(auth);

/**
 * POST /api/repos/:repoName/pulls
 * Body: { title: string, description?: string, fromBranch: string, toBranch: string, author?: string }
 */
router.post('/:repoName/pulls', validate(['title', 'fromBranch', 'toBranch']), prController.create);

/**
 * GET /api/repos/:repoName/pulls
 */
router.get('/:repoName/pulls', prController.list);

/**
 * GET /api/repos/:repoName/pulls/:prId
 */
router.get('/:repoName/pulls/:prId', prController.get);

/**
 * PATCH /api/repos/:repoName/pulls/:prId
 * Body: { status: 'open'|'merged'|'closed' }
 */
router.patch('/:repoName/pulls/:prId', validate(['status']), prController.update);

/**
 * POST /api/repos/:repoName/pulls/:prId/merge
 */
router.post('/:repoName/pulls/:prId/merge', prController.merge);

module.exports = router;
