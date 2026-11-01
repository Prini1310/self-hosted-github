/**
 * build.routes.js
 * Routes for the build pipeline (triggering builds, listing builds, status, and seeding).
 */

const express = require('express');
const router = express.Router();
const buildController = require('../controllers/build.controller');
const auth = require('../middleware/auth.middleware');

// Apply authentication to all build routes (SSE fallback to query param is handled in auth middleware)
router.use(auth);

/**
 * POST /api/repos/:repoName/builds/trigger
 * Auth: Required (Bearer token)
 * Body: { branch: string, lang?: string }
 * Success: 201 { buildId, status }
 * Errors: 401 (no token), 404 (repo not found)
 */
router.post('/:repoName/builds/trigger', buildController.triggerBuild);

/**
 * GET /api/repos/:repoName/builds/trigger
 * Auth: Required (Bearer token or ?token=xxx query param)
 * Query: ?branch=branchName&token=xxx
 * Success: 200 Server-Sent Events stream
 * Errors: 401 (no token), 404 (repo not found)
 */
router.get('/:repoName/builds/trigger', buildController.triggerBuild);

/**
 * GET /api/repos/:repoName/builds
 * Auth: Required (Bearer token)
 * Success: 200 { builds: Array }
 * Errors: 401 (no token), 404 (repo not found)
 */
router.get('/:repoName/builds', buildController.listBuilds);

/**
 * GET /api/repos/:repoName/builds/:buildId
 * Auth: Required (Bearer token)
 * Success: 200 { buildId, status, logs, ... }
 * Errors: 401 (no token), 404 (build/repo not found)
 */
router.get('/:repoName/builds/:buildId', buildController.getBuild);

/**
 * POST /api/repos/:repoName/builds/seed
 * Auth: Required (Bearer token)
 * Success: 200 { message }
 * Errors: 401 (no token), 404 (repo not found)
 */
router.post('/:repoName/builds/seed', buildController.seedWorkspace);

/**
 * POST /api/repos/:repoName/builds/seed-python
 * Auth: Required (Bearer token)
 * Success: 200 { message }
 * Errors: 401 (no token), 404 (repo not found)
 */
router.post('/:repoName/builds/seed-python', buildController.seedPythonWorkspace);

/**
 * POST /api/repos/:repoName/builds/recover
 * Auth: Required (Bearer token)
 * Success: 200 { recovered: number }
 * Errors: 401 (no token), 404 (repo not found)
 */
router.post('/:repoName/builds/recover', buildController.recoverBuilds);

module.exports = router;