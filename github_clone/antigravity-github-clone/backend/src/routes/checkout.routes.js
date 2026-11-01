/**
 * checkout.routes.js
 * Routes for checkout and exclusive file checkout (locking) operations.
 */

const express = require('express');
const router = express.Router();
const checkoutController = require('../controllers/checkout.controller');
const auth = require('../middleware/auth.middleware');

// Apply authentication to all checkout and lock routes
router.use(auth);

const { validate } = require('../middleware/validate.middleware');

/**
 * POST /api/repos/:repoName/checkout
 * Auth: Required (Bearer token)
 * Body: { ref: string }
 * Success: 200 { repoName, ref, message }
 * Errors: 401 (no token / invalid token), 404 (repo not found)
 */
router.post('/:repoName/checkout', validate(['ref']), checkoutController.checkout);

/**
 * GET /api/repos/:repoName/checkout/status
 * Auth: Required (Bearer token)
 * Success: 200 { repoName, head, lockedFiles, message }
 * Errors: 401 (no token / invalid token), 404 (repo not found)
 */
router.get('/:repoName/checkout/status', checkoutController.getStatus);

/**
 * POST /api/repos/:repoName/locks
 * Auth: Required (Bearer token)
 * Body: { filepath: string, lockedBy: string, ttlMinutes?: number }
 * Success: 201 { lock record }
 * Errors: 401 (no token), 409 (file is locked by another user), 400 (invalid fields)
 */
router.post('/:repoName/locks', validate(['filepath', 'lockedBy']), checkoutController.lockFile);

/**
 * DELETE /api/repos/:repoName/locks
 * Auth: Required (Bearer token)
 * Body: { filepath: string, lockId: string, requestedBy: string }
 * Success: 200 { lock record }
 * Errors: 401 (no token), 403 (lock ID mismatch), 404 (lock not found / file doesn't exist)
 */
router.delete('/:repoName/locks', validate(['filepath', 'lockId', 'requestedBy']), checkoutController.unlockFile);

/**
 * GET /api/repos/:repoName/locks
 * Auth: Required (Bearer token)
 * Success: 200 { locks: [...] }
 * Errors: 401 (no token / invalid token)
 */
router.get('/:repoName/locks', checkoutController.listLocks);

/**
 * GET /api/repos/:repoName/locks/file
 * Auth: Required (Bearer token)
 * Query: ?filepath=src/main/App.java
 * Success: 200 { lock: lock record | null }
 * Errors: 401 (no token / invalid token)
 */
router.get('/:repoName/locks/file', checkoutController.getLock);

/**
 * DELETE /api/repos/:repoName/locks/force
 * Auth: Required (Bearer token)
 * Body: { filepath: string }
 * Success: 200 { lock record }
 * Errors: 401 (no token), 404 (lock not found)
 */
router.delete('/:repoName/locks/force', validate(['filepath']), checkoutController.forceRelease);

/**
 * POST /api/repos/:repoName/locks/clean
 * Auth: Required (Bearer token)
 * Success: 200 { cleaned: number }
 * Errors: 401 (no token / invalid token)
 */
router.post('/:repoName/locks/clean', checkoutController.cleanExpiredLocks);

module.exports = router;
