'use strict';

const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activity.controller');
const auth = require('../middleware/auth.middleware');

const { validate } = require('../middleware/validate.middleware');

// All activity routes require authentication
router.use(auth);

/**
 * POST /api/repos/:repoName/push
 * Body: { branch: string, commit: string }
 */
router.post('/:repoName/push', validate(['branch', 'commit']), activityController.push);

/**
 * POST /api/repos/:repoName/pull
 * Body: { targetBranch: string, branch?: string }
 */
router.post('/:repoName/pull', validate(['targetBranch']), activityController.pull);

/**
 * GET /api/repos/:repoName/activity
 */
router.get('/:repoName/activity', activityController.listActivity);

module.exports = router;
