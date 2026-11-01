# API Documentation

**Base URL**: `http://localhost:3000`  
**Auth**: All endpoints except `/api/repos/:repoName/init` and `/api/auth/login` require:  
- Header: `Authorization: Bearer <token>`  
*Get token from `POST /api/auth/login`.*

---

## AUTH

### POST /api/auth/login
**Auth**: Not required
**Description**: Authenticates user credentials and returns a signed JWT.
**Body**:
```json
{
  "username": "prabhaharan",
  "password": "admin123"
}
```
**Success**: `200 { token, username, expiresIn }`
**Errors**: `401` Invalid credentials, `400` Missing fields

### POST /api/auth/verify
**Auth**: Required
**Description**: Verifies authentication status.
**Body**: None
**Success**: `200 { valid: true, user: { username } }`
**Errors**: `401` Invalid token

---

## REPOSITORIES

### POST /api/repos/:repoName/init
**Auth**: Not required
**Description**: Initialises a new repository structure.
**Body**: None
**Success**: `201 { message: "Repo initialised", repoName }`
**Errors**: `409` Repo already exists

### POST /api/repos/:repoName/add
**Auth**: Required
**Description**: Stages a file. Equivalent to `git add`.
**Body**:
```json
{
  "filepath": "src/App.java",
  "content": "public class App {}"
}
```
**Success**: `200 { filepath, blobHash }`
**Errors**: `400` Missing/empty fields, `404` Repo not found

### POST /api/repos/:repoName/commit
**Auth**: Required
**Description**: Commits all staged files. Equivalent to `git commit`.
**Body**:
```json
{
  "author": "dev",
  "message": "my commit"
}
```
**Success**: `201 { commitHash, treeHash, parentHash }`
**Errors**: `400` Nothing staged to commit or missing fields, `404` Repo not found

### GET /api/repos/:repoName/log
**Auth**: Required
**Description**: Walks the commit chain from HEAD and returns commits newest-first.
**Body**: None
**Success**: `200 { log: [ { hash, treeHash, parentHash, author, message, timestamp } ] }`
**Errors**: `404` Repo not found

### GET /api/repos/:repoName/status
**Auth**: Required
**Description**: Returns working copy status showing HEAD, index staged files, and active branch.
**Body**: None
**Success**: `200 { head, staged: { filepath: hash }, branch }`
**Errors**: `404` Repo not found

### POST /api/repos/:repoName/blobs
**Auth**: Required
**Description**: Creates a Git-style blob object directly.
**Body**:
```json
{
  "content": "my raw file content"
}
```
**Success**: `201 { hash }`
**Errors**: `400` Missing content, `404` Repo not found

### POST /api/repos/:repoName/trees
**Auth**: Required
**Description**: Creates a Git-style tree object directly.
**Body**:
```json
{
  "entries": [
    { "name": "README.md", "hash": "abc12345...", "mode": "100644" }
  ]
}
```
**Success**: `201 { hash }`
**Errors**: `400` Invalid/missing entries, `404` Repo not found

### POST /api/repos/:repoName/commits
**Auth**: Required
**Description**: Creates a Git-style commit object directly.
**Body**:
```json
{
  "treeHash": "abc12345...",
  "parentHash": "def6789...",
  "author": "dev",
  "message": "commit description"
}
```
**Success**: `201 { hash }`
**Errors**: `400` Missing fields, `404` Repo not found

### GET /api/repos/:repoName/objects/:hash
**Auth**: Required
**Description**: Retrieves content-addressed object details.
**Body**: None
**Success**: `200 { type, size, content, hash }` for blobs, or raw model objects.
**Errors**: `404` Object not found / repo not found

---

## BRANCHES

### GET /api/repos/:repoName/branches
**Auth**: Required
**Description**: Lists all repository branches.
**Body**: None
**Success**: `200 { branches: [], branchesMap: { branchName: tipHash }, current }`
**Errors**: `404` Repo not found

### POST /api/repos/:repoName/branches
**Auth**: Required
**Description**: Creates a new branch from current HEAD.
**Body**:
```json
{
  "branchName": "feature/my-branch"
}
```
**Success**: `201 { branch, branchName, from, head, tipHash }`
**Errors**: `409` Branch already exists, `400` Cannot branch from empty repo / missing fields, `404` Repo not found

### POST /api/repos/:repoName/branches/switch
**Auth**: Required
**Description**: Switches active branch.
**Body**:
```json
{
  "branchName": "feature/my-branch"
}
```
**Success**: `200 { branch, branchName, head }`
**Errors**: `400` Staged changes present, `404` Branch/repo not found

### POST /api/repos/:repoName/branches/merge
**Auth**: Required
**Description**: Merges source branch into the active branch.
**Body**:
```json
{
  "sourceBranch": "feature/my-branch"
}
```
**Success**: `200 { type: "fast-forward"|"merged"|"already-merged", commitHash }`
**Errors**: `400` Self merge / missing fields, `409` Merge conflicts, `404` Repo/branch not found

---

## BUILDS

### GET /api/repos/:repoName/builds/trigger
**Auth**: Required
**Description**: Triggers a Maven or pytest build and returns live streams.
**Query Params**: `?lang=java|python&branch=main` (optional: `&token=<auth_token>` as fallback query param)
**Body**: None
**Success**: `200 Server-Sent Events stream`
**Errors**: `401` Unauthorized, `404` Repo not found

### GET /api/repos/:repoName/builds
**Auth**: Required
**Description**: Lists all builds history.
**Body**: None
**Success**: `200 { builds: [ { buildId, status, startedAt, finishedAt, logs: [] } ] }`
**Errors**: `404` Repo not found

### GET /api/repos/:repoName/builds/:buildId
**Auth**: Required
**Description**: View details for a single build.
**Body**: None
**Success**: `200 { buildId, status, logs, startedAt, finishedAt, ... }`
**Errors**: `404` Build/repo not found

### POST /api/repos/:repoName/builds/seed
**Auth**: Required
**Description**: Seeds a dummy Java Maven workspace structure.
**Body**: None
**Success**: `200 { message: "Maven workspace seeded" }`
**Errors**: `404` Repo not found

### POST /api/repos/:repoName/builds/seed-python
**Auth**: Required
**Description**: Seeds a dummy Python pytest workspace structure.
**Body**: None
**Success**: `200 { message: "Python pytest workspace seeded" }`
**Errors**: `404` Repo not found

### POST /api/repos/:repoName/builds/recover
**Auth**: Required
**Description**: Recovers stuck builds in the repository.
**Body**: None
**Success**: `200 { recovered: 1 }`
**Errors**: `404` Repo not found

---

## LOCKS

### POST /api/repos/:repoName/locks
**Auth**: Required
**Description**: Acquires a checkout lock token for a file.
**Body**:
```json
{
  "filepath": "src/Main.java",
  "lockedBy": "prabhaharan",
  "ttlMinutes": 30
}
```
**Success**: `201 { lockId, filepath, lockedBy, lockedAt, expiresAt }`
**Errors**: `409` File is locked by another user, `400` Invalid TTL/path traversal / missing fields, `404` Repo not found

### DELETE /api/repos/:repoName/locks
**Auth**: Required
**Description**: Releases a file lock.
**Body**:
```json
{
  "filepath": "src/Main.java",
  "lockId": "token-12345",
  "requestedBy": "prabhaharan"
}
```
**Success**: `200 { lockId, filepath, released: true }`
**Errors**: `403` Lock ID mismatch / requestedBy mismatch, `404` Lock not found / repo not found

### GET /api/repos/:repoName/locks
**Auth**: Required
**Description**: Lists all active checkout locks.
**Body**: None
**Success**: `200 { locks: [] }`
**Errors**: `404` Repo not found

### GET /api/repos/:repoName/locks/file
**Auth**: Required
**Description**: Check status for a specific file path.
**Query Params**: `?filepath=src/Main.java`
**Body**: None
**Success**: `200 { lock: lockRecord | null }`
**Errors**: `404` Repo not found

### DELETE /api/repos/:repoName/locks/force
**Auth**: Required
**Description**: Admin force releases a lock.
**Body**:
```json
{
  "filepath": "src/Main.java"
}
```
**Success**: `200 { lockId, filepath, released: true }`
**Errors**: `404` Lock not found / repo not found

### POST /api/repos/:repoName/locks/clean
**Auth**: Required
**Description**: Cleans up and releases expired locks.
**Body**: None
**Success**: `200 { cleaned: number }`
**Errors**: `404` Repo not found
