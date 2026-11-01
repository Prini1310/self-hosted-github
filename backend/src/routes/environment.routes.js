'use strict';

const express = require('express');
const router = express.Router();
const envController = require('../controllers/environment.controller');
const auth = require('../middleware/auth.middleware');

const { validate } = require('../middleware/validate.middleware');

// All environment routes require authentication
router.use(auth);

/**
 * GET /api/repos/:repoName/environments
 */
router.get('/:repoName/environments', envController.list);

/**
 * POST /api/repos/:repoName/environments
 * Body: { name, description, nodeEnv, buildCommandOverride, envVars }
 */
router.post('/:repoName/environments', validate(['name']), envController.create);

/**
 * GET /api/repos/:repoName/environments/:envName
 */
router.get('/:repoName/environments/:envName', envController.get);

/**
 * PATCH /api/repos/:repoName/environments/:envName
 * Body: { description, nodeEnv, buildCommandOverride, envVars }
 */
router.patch('/:repoName/environments/:envName', envController.update);

/**
 * DELETE /api/repos/:repoName/environments/:envName
 */
router.delete('/:repoName/environments/:envName', envController.deleteEnv);

module.exports = router;
