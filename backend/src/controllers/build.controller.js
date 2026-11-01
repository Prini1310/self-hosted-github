/**
 * build.controller.js
 * Handles HTTP requests for the build pipeline.
 */

const { runBuild } = require('../services/javaBuild.service');
const { runPythonBuild } = require('../services/pythonBuild.service');
const { getBuild, listBuilds, recoverStuckBuilds } = require('../services/buildStore.service');
const { seedMavenWorkspace, seedPytestWorkspace } = require('../utils/seedWorkspace');
const { assertRepoExists, getBranchTip } = require('../services/repoMeta.service');
const envService = require('../services/environment.service');
const activityService = require('../services/activity.service');

/**
 * POST or GET /api/repos/:repoName/builds/trigger
 * Triggers a new build. SSE endpoint.
 */
exports.triggerBuild = (req, res, next) => {
  try {
    const { repoName } = req.params;
    assertRepoExists(repoName);
    const branch = req.body.branch || req.query.branch || 'main';
    const lang = req.query.lang || req.body.lang || 'java';
    const environment = req.body.environment || req.query.environment || '';
    const confirmProduction = req.body.confirmProduction || req.query.confirmProduction === 'true' || req.query.confirmProduction === true;

    let envConfig = null;
    if (environment) {
      envConfig = envService.getEnvironment(repoName, environment);
      if (!envConfig) {
        return res.status(404).json({ error: `Environment '${environment}' not found` });
      }
    }

    // Production guardrail check
    if (environment === 'production' && !confirmProduction) {
      return res.status(403).json({ error: 'Production builds require the confirmProduction flag set to true.' });
    }

    // Record Build Activity in repository logs
    const currentTip = getBranchTip(repoName, branch) || 'none';
    activityService.recordActivity(repoName, {
      username: req.user?.username || 'unknown',
      action: 'build',
      branch,
      commit: currentTip,
      environment: environment || 'none'
    });

    if (lang === 'python') {
      runPythonBuild(repoName, branch, res, envConfig);
    } else {
      runBuild(repoName, branch, res, envConfig);
    }
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/repos/:repoName/builds
 * Lists all builds for a repo.
 */
exports.listBuilds = (req, res, next) => {
  try {
    const { repoName } = req.params;
    assertRepoExists(repoName);
    const builds = listBuilds(repoName);
    res.status(200).json({ builds });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/repos/:repoName/builds/:buildId
 * Retrieves details for a specific build.
 */
exports.getBuild = (req, res, next) => {
  try {
    const { repoName, buildId } = req.params;
    assertRepoExists(repoName);
    const build = getBuild(repoName, buildId);
    if (!build) {
      return res.status(404).json({ message: 'Build not found' });
    }
    res.status(200).json(build);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/repos/:repoName/builds/seed
 * Seeds a Maven workspace for development testing.
 */
exports.seedWorkspace = (req, res, next) => {
  try {
    const { repoName } = req.params;
    assertRepoExists(repoName);
    seedMavenWorkspace(repoName);
    res.status(200).json({ message: 'Maven workspace seeded' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/repos/:repoName/builds/seed-python
 * Seeds a pytest Python workspace for development testing.
 */
exports.seedPythonWorkspace = (req, res, next) => {
  try {
    const { repoName } = req.params;
    assertRepoExists(repoName);
    seedPytestWorkspace(repoName);
    res.status(200).json({ message: 'Python pytest workspace seeded' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/repos/:repoName/builds/recover
 * Recovers stuck builds in the repository.
 */
exports.recoverBuilds = (req, res, next) => {
  try {
    const { repoName } = req.params;
    assertRepoExists(repoName);
    const recovered = recoverStuckBuilds(repoName);
    res.status(200).json({ recovered });
  } catch (err) {
    next(err);
  }
};
