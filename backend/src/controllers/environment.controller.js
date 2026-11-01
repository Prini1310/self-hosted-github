'use strict';

const envService = require('../services/environment.service');

function list(req, res, next) {
  try {
    const { repoName } = req.params;
    const list = envService.listEnvironments(repoName);
    res.json({ success: true, environments: list });
  } catch (err) {
    next(err);
  }
}

function get(req, res, next) {
  try {
    const { repoName, envName } = req.params;
    const config = envService.getEnvironment(repoName, envName);
    if (!config) {
      return res.status(404).json({ error: `Environment '${envName}' not found` });
    }
    res.json({ success: true, environment: config });
  } catch (err) {
    next(err);
  }
}

function create(req, res, next) {
  try {
    const { repoName } = req.params;
    const { name, description, nodeEnv, buildCommandOverride, envVars } = req.body;
    const username = req.user?.username || 'unknown';

    if (!name) {
      return res.status(400).json({ error: 'Environment name is required' });
    }

    const nameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!nameRegex.test(name)) {
      return res.status(400).json({ error: 'Environment name must contain only alphanumeric characters, underscores, and hyphens' });
    }

    const config = envService.saveEnvironment(repoName, name, {
      description,
      nodeEnv,
      buildCommandOverride,
      envVars,
      createdBy: username
    });

    res.status(201).json({ success: true, environment: config });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
}

function update(req, res, next) {
  try {
    const { repoName, envName } = req.params;
    const { description, nodeEnv, buildCommandOverride, envVars } = req.body;
    const username = req.user?.username || 'unknown';

    const existing = envService.getEnvironment(repoName, envName);
    if (!existing) {
      return res.status(404).json({ error: `Environment '${envName}' not found` });
    }

    const config = envService.saveEnvironment(repoName, envName, {
      description: description !== undefined ? description : existing.description,
      nodeEnv: nodeEnv !== undefined ? nodeEnv : existing.nodeEnv,
      buildCommandOverride: buildCommandOverride !== undefined ? buildCommandOverride : existing.buildCommandOverride,
      envVars: envVars !== undefined ? envVars : existing.envVars,
      createdBy: username
    });

    res.json({ success: true, environment: config });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
}

function deleteEnv(req, res, next) {
  try {
    const { repoName, envName } = req.params;
    const result = envService.deleteEnvironment(repoName, envName);
    res.json({ success: true, message: `Successfully deleted environment '${envName}'`, result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
}

module.exports = {
  list,
  get,
  create,
  update,
  deleteEnv
};
