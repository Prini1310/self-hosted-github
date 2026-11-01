import axios from 'axios';

let authToken = null;

const client = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setToken = (token) => { authToken = token; };
export const getToken = () => authToken;

client.interceptors.request.use(config => {
  if (authToken) {
    config.headers['Authorization'] = `Bearer ${authToken}`;
  }
  return config;
});

client.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Log in a user
 * POST /api/auth/login
 */
export async function login(username, password) {
  try {
    const response = await client.post('/api/auth/login', { username, password });
    if (response.data && response.data.token) {
      setToken(response.data.token);
    }
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Log out a user
 */
export function logout() {
  setToken(null);
}

/**
 * List all repository names
 * GET /api/repos
 */
export async function listRepos() {
  try {
    const response = await client.get('/api/repos');
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Initialise a new repo
 * POST /api/repos/:repoName/init
 */
export async function initRepo(repoName) {
  try {
    const response = await client.post(`/api/repos/${repoName}/init`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Stage a file
 * POST /api/repos/:repoName/add
 * Body: { filepath, content }
 */
export async function addFile(repoName, filepath, content) {
  try {
    const response = await client.post(`/api/repos/${repoName}/add`, { filepath, content });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Commit staged files
 * POST /api/repos/:repoName/commit
 * Body: { author, message }
 */
export async function commitFiles(repoName, author, message) {
  try {
    const response = await client.post(`/api/repos/${repoName}/commit`, { author, message });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * View the commit log
 * GET /api/repos/:repoName/log
 */
export async function getLog(repoName) {
  try {
    const response = await client.get(`/api/repos/${repoName}/log`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * View current status
 * GET /api/repos/:repoName/status
 */
export async function getStatus(repoName) {
  try {
    const response = await client.get(`/api/repos/${repoName}/status`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * List all branches
 * GET /api/repos/:repoName/branches
 */
export async function listBranches(repoName) {
  try {
    const response = await client.get(`/api/repos/${repoName}/branches`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Create a new branch
 * POST /api/repos/:repoName/branches
 * Body: { branchName }
 */
export async function createBranch(repoName, branchName) {
  try {
    const response = await client.post(`/api/repos/${repoName}/branches`, { branchName });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Switch branch
 * POST /api/repos/:repoName/branches/switch
 * Body: { branchName }
 */
export async function switchBranch(repoName, branchName) {
  try {
    const response = await client.post(`/api/repos/${repoName}/branches/switch`, { branchName });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Merge branch
 * POST /api/repos/:repoName/branches/merge
 * Body: { sourceBranch, strategy }
 */
export async function mergeBranch(repoName, sourceBranch, strategy = 'merge') {
  try {
    const response = await client.post(`/api/repos/${repoName}/branches/merge`, { sourceBranch, strategy });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get merge status between source and target branches
 * GET /api/repos/:repoName/branches/merge-status
 */
export async function getMergeStatus(repoName, source, target) {
  try {
    const response = await client.get(`/api/repos/${repoName}/branches/merge-status`, {
      params: { source, target }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Delete branch
 * DELETE /api/repos/:repoName/branches
 * Body: { branchName }
 */
export async function deleteBranch(repoName, branchName) {
  try {
    const response = await client.delete(`/api/repos/${repoName}/branches`, {
      data: { branchName }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Trigger a new build via EventSource
 * GET /api/repos/:repoName/builds/trigger?branch=branch
 */
export function triggerBuild(repoName, branch, environment = '', confirmProduction = false) {
  const tokenQuery = authToken ? `&token=${authToken}` : '';
  const envQuery = environment ? `&environment=${encodeURIComponent(environment)}` : '';
  const confirmQuery = confirmProduction ? `&confirmProduction=true` : '';
  return new EventSource(`http://localhost:3000/api/repos/${repoName}/builds/trigger?branch=${branch}${tokenQuery}${envQuery}${confirmQuery}`);
}

/**
 * List all builds for a repository
 * GET /api/repos/:repoName/builds
 */
export async function listBuilds(repoName) {
  try {
    const response = await client.get(`/api/repos/${repoName}/builds`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Seed a Maven workspace
 * POST /api/repos/:repoName/builds/seed
 */
export async function seedWorkspace(repoName) {
  try {
    const response = await client.post(`/api/repos/${repoName}/builds/seed`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Seed a Python pytest workspace
 * POST /api/repos/:repoName/builds/seed-python
 */
export async function seedPythonWorkspace(repoName) {
  try {
    const response = await client.post(`/api/repos/${repoName}/builds/seed-python`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Lock a file (Exclusive checkout)
 * POST /api/repos/:repoName/locks
 * Body: { filepath, lockedBy, ttlMinutes }
 */
export async function checkoutFile(repoName, filepath, lockedBy, ttlMinutes) {
  try {
    const response = await client.post(`/api/repos/${repoName}/locks`, { filepath, lockedBy, ttlMinutes });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Release a file lock
 * DELETE /api/repos/:repoName/locks
 * Body: { filepath, lockId, requestedBy }
 */
export async function releaseFile(repoName, filepath, lockId, requestedBy) {
  try {
    const response = await client.delete(`/api/repos/${repoName}/locks`, {
      data: { filepath, lockId, requestedBy }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * List all active locks
 * GET /api/repos/:repoName/locks
 */
export async function listLocks(repoName) {
  try {
    const response = await client.get(`/api/repos/${repoName}/locks`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Check file lock status
 * GET /api/repos/:repoName/locks/file?filepath={filepath}
 */
export async function checkFileLock(repoName, filepath) {
  try {
    const response = await client.get(`/api/repos/${repoName}/locks/file`, {
      params: { filepath }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Force release a lock
 * DELETE /api/repos/:repoName/locks/force
 * Body: { filepath }
 */
export async function forceReleaseLock(repoName, filepath) {
  try {
    const response = await client.delete(`/api/repos/${repoName}/locks/force`, {
      data: { filepath }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Clean expired locks
 * POST /api/repos/:repoName/locks/clean
 */
export async function cleanLocks(repoName) {
  try {
    const response = await client.post(`/api/repos/${repoName}/locks/clean`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Push a commit to a branch
 * POST /api/repos/:repoName/push
 * Body: { branch, commit }
 */
export async function pushBranch(repoName, branch, commit) {
  try {
    const response = await client.post(`/api/repos/${repoName}/push`, { branch, commit });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Pull latest changes from a target branch to a branch
 * POST /api/repos/:repoName/pull
 * Body: { branch, targetBranch }
 */
export async function pullBranch(repoName, branch, targetBranch) {
  try {
    const response = await client.post(`/api/repos/${repoName}/pull`, { branch, targetBranch });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get repo activity log
 * GET /api/repos/:repoName/activity
 */
export async function getActivityLog(repoName) {
  try {
    const response = await client.get(`/api/repos/${repoName}/activity`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Create a new Pull Request
 * POST /api/repos/:repoName/pulls
 * Body: { title, description, fromBranch, toBranch, author }
 */
export async function createPullRequest(repoName, title, description, fromBranch, toBranch, author) {
  try {
    const response = await client.post(`/api/repos/${repoName}/pulls`, {
      title,
      description,
      fromBranch,
      toBranch,
      author
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * List all Pull Requests in repo
 * GET /api/repos/:repoName/pulls
 */
export async function listPullRequests(repoName) {
  try {
    const response = await client.get(`/api/repos/${repoName}/pulls`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get single PR details
 * GET /api/repos/:repoName/pulls/:prId
 */
export async function getPullRequest(repoName, prId) {
  try {
    const response = await client.get(`/api/repos/${repoName}/pulls/${prId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Update Pull Request status
 * PATCH /api/repos/:repoName/pulls/:prId
 * Body: { status }
 */
export async function updatePullRequestStatus(repoName, prId, status) {
  try {
    const response = await client.patch(`/api/repos/${repoName}/pulls/${prId}`, { status });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Merge Pull Request
 * POST /api/repos/:repoName/pulls/:prId/merge
 */
export async function mergePullRequest(repoName, prId) {
  try {
    const response = await client.post(`/api/repos/${repoName}/pulls/${prId}/merge`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * List environments
 * GET /api/repos/:repoName/environments
 */
export async function listEnvironments(repoName) {
  try {
    const response = await client.get(`/api/repos/${repoName}/environments`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Create environment
 * POST /api/repos/:repoName/environments
 * Body: { name, description, nodeEnv, buildCommandOverride, envVars }
 */
export async function createEnvironment(repoName, config) {
  try {
    const response = await client.post(`/api/repos/${repoName}/environments`, config);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get single environment config
 * GET /api/repos/:repoName/environments/:envName
 */
export async function getEnvironment(repoName, envName) {
  try {
    const response = await client.get(`/api/repos/${repoName}/environments/${envName}`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Update environment config
 * PATCH /api/repos/:repoName/environments/:envName
 * Body: { description, nodeEnv, buildCommandOverride, envVars }
 */
export async function updateEnvironment(repoName, envName, config) {
  try {
    const response = await client.patch(`/api/repos/${repoName}/environments/${envName}`, config);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Delete environment
 * DELETE /api/repos/:repoName/environments/:envName
 */
export async function deleteEnvironment(repoName, envName) {
  try {
    const response = await client.delete(`/api/repos/${repoName}/environments/${envName}`);
    return response.data;
  } catch (error) {
    throw error;
  }
}
/**
 * Get root-level file/folder listing for a repo (file browser)
 * GET /api/repos/:repoName/tree
 */
export async function getRepoTree(repoName, branch = '') {
  try {
    const params = branch ? { branch } : {};
    const response = await client.get(`/api/repos/${repoName}/tree`, { params });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get file listing for a sub-folder or file metadata at a path
 * GET /api/repos/:repoName/tree/<filepath>
 */
export async function getTreePath(repoName, filepath, branch = '') {
  try {
    const params = branch ? { branch } : {};
    const response = await client.get(`/api/repos/${repoName}/tree/${filepath}`, { params });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get raw content of a file
 * GET /api/repos/:repoName/blob/<filepath>
 */
export async function getBlobContent(repoName, filepath, branch = '') {
  try {
    const params = branch ? { branch } : {};
    const response = await client.get(`/api/repos/${repoName}/blob/${filepath}`, { params });
    return response.data;
  } catch (error) {
    throw error;
  }
}

