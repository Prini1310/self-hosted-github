'use strict';

const fs = require('fs');
const path = require('path');
const { assertRepoExists } = require('./repoMeta.service');

const STORAGE_ROOT = process.env.STORAGE_PATH || path.join(__dirname, "../../../storage/repos");

function _environmentsDir(repoName) {
  return path.join(STORAGE_ROOT, repoName, 'environments');
}

function _envPath(repoName, envName) {
  return path.join(_environmentsDir(repoName), `${envName}.json`);
}

const DEFAULT_ENVIRONMENTS = {
  development: {
    name: 'development',
    description: 'Local development environment',
    nodeEnv: 'development',
    buildCommandOverride: '',
    envVars: {}
  },
  staging: {
    name: 'staging',
    description: 'Staging environment for pre-release testing',
    nodeEnv: 'staging',
    buildCommandOverride: '',
    envVars: {}
  },
  QA: {
    name: 'QA',
    description: 'QA environment for manual and automated testing',
    nodeEnv: 'testing',
    buildCommandOverride: '',
    envVars: {}
  },
  production: {
    name: 'production',
    description: 'Production environment for live usage',
    nodeEnv: 'production',
    buildCommandOverride: '',
    envVars: {}
  }
};

function seedDefaultEnvironments(repoName) {
  const dir = _environmentsDir(repoName);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  for (const envName in DEFAULT_ENVIRONMENTS) {
    const p = _envPath(repoName, envName);
    if (!fs.existsSync(p)) {
      const now = new Date().toISOString();
      const config = {
        ...DEFAULT_ENVIRONMENTS[envName],
        createdBy: 'system',
        createdAt: now,
        lastModified: now
      };
      fs.writeFileSync(p, JSON.stringify(config, null, 2), 'utf8');
    }
  }
}

function listEnvironments(repoName) {
  assertRepoExists(repoName);
  const dir = _environmentsDir(repoName);
  
  // Seed if directory does not exist or has no json files
  let hasFiles = false;
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    hasFiles = files.some(file => file.endsWith('.json'));
  }

  if (!hasFiles) {
    seedDefaultEnvironments(repoName);
  }

  const files = fs.readdirSync(dir);
  const list = [];
  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const config = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        list.push(config);
      } catch (err) {
        // ignore
      }
    }
  }

  return list;
}

function getEnvironment(repoName, envName) {
  assertRepoExists(repoName);
  // Trigger seeding check by running listEnvironments
  listEnvironments(repoName);

  const p = _envPath(repoName, envName);
  if (!fs.existsSync(p)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    return null;
  }
}

function saveEnvironment(repoName, envName, config) {
  assertRepoExists(repoName);
  const dir = _environmentsDir(repoName);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const p = _envPath(repoName, envName);
  const now = new Date().toISOString();
  let existing = getEnvironment(repoName, envName);

  const updatedConfig = {
    name: envName,
    description: config.description || '',
    nodeEnv: config.nodeEnv || 'development',
    buildCommandOverride: config.buildCommandOverride || '',
    envVars: config.envVars || {},
    createdBy: existing ? existing.createdBy : (config.createdBy || 'unknown'),
    createdAt: existing ? existing.createdAt : now,
    lastModified: now
  };

  fs.writeFileSync(p, JSON.stringify(updatedConfig, null, 2), 'utf8');
  return updatedConfig;
}

function deleteEnvironment(repoName, envName) {
  assertRepoExists(repoName);
  const p = _envPath(repoName, envName);
  if (!fs.existsSync(p)) {
    throw Object.assign(new Error(`Environment '${envName}' not found`), { status: 404 });
  }
  fs.unlinkSync(p);
  return { deleted: envName };
}

module.exports = {
  listEnvironments,
  getEnvironment,
  saveEnvironment,
  deleteEnvironment
};
