'use strict';

const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branch.controller');
const auth = require('../middleware/auth.middleware');

// Apply authentication to all branch routes
router.use(auth);

const { validate } = require('../middleware/validate.middleware');

/**
 * GET /api/repos/:repoName/branches
 * Auth: Required (Bearer token)
 * Success: 200 { branches: string[], activeBranch: string }
 * Errors: 401 (no token), 404 (repo not found)
 */
router.get('/:repoName/branches', branchController.listBranches);

/**
 * POST /api/repos/:repoName/branches
 * Auth: Required (Bearer token)
 * Body: { branchName: string }
 * Success: 201 { branchName, message }
 * Errors: 401 (no token), 404 (repo not found), 400 (missing fields / already exists)
 */
router.post('/:repoName/branches', validate(['branchName|name']), branchController.createBranch);

/**
 * POST /api/repos/:repoName/branches/switch
 * Auth: Required (Bearer token)
 * Body: { branchName: string }
 * Success: 200 { branchName, message }
 * Errors: 401 (no token), 404 (repo/branch not found)
 */
router.post('/:repoName/branches/switch', validate(['branchName|name']), branchController.switchBranch);

/**
 * POST /api/repos/:repoName/branches/merge
 * Auth: Required (Bearer token)
 * Body: { sourceBranch: string }
 * Success: 200 { message, mergedCommits: number }
 * Errors: 401 (no token), 404 (branch not found), 409 (merge conflicts)
 */
router.post('/:repoName/branches/merge', validate(['sourceBranch']), branchController.mergeBranch);

/**
 * GET /api/repos/:repoName/branches/merge-status
 * Auth: Required (Bearer token)
 * Query: ?source=sourceBranch&target=targetBranch
 * Success: 200 { ableToMerge, conflicts, commitsAhead, recommendedStrategy }
 */
router.get('/:repoName/branches/merge-status', branchController.mergeStatus);

/**
 * GET /api/repos/:repoName/branches/:branchName(*)
 * Auth: Required (Bearer token)
 * Success: 200 { branchName, commitHash }
 * Errors: 401 (no token), 404 (branch not found)
 */
router.get('/:repoName/branches/:branchName(*)', branchController.getBranch);

/**
 * DELETE /api/repos/:repoName/branches
 * Auth: Required (Bearer token)
 * Body: { branchName: string }
 * Success: 200 { deleted }
 */
router.delete('/:repoName/branches', validate(['branchName']), branchController.deleteBranch);

/**
 * DELETE /api/repos/:repoName/branches/:branchName(*)
 * Auth: Required (Bearer token)
 * Success: 200 { message }
 * Errors: 401 (no token), 404 (branch not found), 400 (cannot delete active branch)
 */
router.delete('/:repoName/branches/:branchName(*)', branchController.deleteBranch);

module.exports = router;
