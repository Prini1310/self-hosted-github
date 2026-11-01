'use strict';

// ─── Day 3–4 imports ──────────────────────────────────────────────────────────
const { createBlob }   = require('../models/blob.model');
const { createTree }   = require('../models/tree.model');
const { createCommit } = require('../models/commit.model');
const { writeObject, readObject } = require('../services/objectStore.service');

// ─── Day 5–6 imports ──────────────────────────────────────────────────────────
const {
  initRepo,
  getHead,
  setHead,
  getIndex,
  setIndex,
  stageFile,
  listRepos,
  getCurrentBranch,
  setBranchTip,
  assertRepoExists,
} = require('../services/repoMeta.service');

const { withLock } = require('../utils/mutex.util');

// ═══════════════════════════════════════════════════════════════════════════════
// DAY 3–4 HANDLERS (unchanged)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/repos/:repoName/blobs
 * Body: { content: string } → { hash: string }
 *
 * @type {import('express').RequestHandler}
 */
exports.createBlobHandler = (req, res, next) => {
  try {
    const { repoName } = req.params;
    const { content }  = req.body;

    assertRepoExists(repoName);

    if (content === undefined || content === null) {
      return res.status(400).json({ error: '`content` is required' });
    }

    const blob = createBlob(content);
    writeObject(repoName, blob);

    res.status(201).json({ hash: blob.hash });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/repos/:repoName/trees
 * Body: { entries: Array<{ name, hash, mode? }> } → { hash: string }
 *
 * @type {import('express').RequestHandler}
 */
exports.createTreeHandler = (req, res, next) => {
  try {
    const { repoName } = req.params;
    const { entries }  = req.body;

    assertRepoExists(repoName);

    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: '`entries` must be an array' });
    }

    const tree = createTree(entries);
    writeObject(repoName, tree);

    res.status(201).json({ hash: tree.hash });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/repos/:repoName/commits
 * Body: { treeHash, parentHash?, author, message } → { hash: string }
 *
 * @type {import('express').RequestHandler}
 */
exports.createCommitHandler = (req, res, next) => {
  try {
    const { repoName } = req.params;
    const { treeHash, parentHash, author, message } = req.body;

    assertRepoExists(repoName);

    if (!treeHash || !author || !message) {
      return res.status(400).json({ error: '`treeHash`, `author`, and `message` are required' });
    }

    const commit = createCommit({ treeHash, parentHash, author, message });
    writeObject(repoName, commit);

    res.status(201).json({ hash: commit.hash });
  } catch (err) {
    next(err);
  }
};

/**
 * Returns the full stored object or 404.
 *
 * @type {import('express').RequestHandler}
 */
exports.getObjectHandler = (req, res, next) => {
  try {
    const { repoName, hash } = req.params;
    assertRepoExists(repoName);
    
    const object = readObject(repoName, hash);

    if (!object) {
      return res.status(404).json({ error: `Object ${hash} not found in repo '${repoName}'` });
    }

    res.json(object);
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// DAY 5–6 HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/repos/:repoName/init
 * Initialise a new repository.
 * Returns 201 on success, 409 if repo already exists.
 *
 * @type {import('express').RequestHandler}
 */
exports.initRepoHandler = (req, res, next) => {
  try {
    const { repoName } = req.params;
    initRepo(repoName);
    res.status(201).json({ message: 'Repo initialised', repoName });
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ error: 'Repo already exists' });
    }
    next(err);
  }
};

/**
 * POST /api/repos/:repoName/add
 * Stage a file. Equivalent to `git add`.
 * Body: { filepath: string, content: string }
 * Returns 200: { filepath, blobHash }
 *
 * @type {import('express').RequestHandler}
 */
exports.addFileHandler = (req, res, next) => {
  try {
    const { repoName }       = req.params;
    const { filepath, content } = req.body;

    assertRepoExists(repoName);

    if (!filepath || content === undefined || content === null) {
      return res.status(400).json({ error: '`filepath` and `content` are required' });
    }

    const blob = createBlob(content);
    writeObject(repoName, blob);
    stageFile(repoName, filepath, blob.hash);

    res.status(200).json({ filepath, blobHash: blob.hash });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/repos/:repoName/commit
 * Commit all staged files. Equivalent to `git commit -m "..."`.
 * Body: { author: string, message: string }
 * Returns 201: { commitHash, treeHash, parentHash }
 *
 * @type {import('express').RequestHandler}
 */
exports.commitHandler = (req, res, next) => {
  try {
    const { repoName }     = req.params;
    const { author, message } = req.body;

    assertRepoExists(repoName);

    if (!author || !message) {
      return res.status(400).json({ error: '`author` and `message` are required' });
    }

    const result = withLock(`commit-${repoName}`, () => {
      const index = getIndex(repoName);
      if (Object.keys(index).length === 0) {
        throw new Error('Nothing staged to commit');
      }

      // Build tree entries from the current index
      const entries = Object.entries(index).map(([name, hash]) => ({
        name,
        hash,
        mode: '100644',
      }));
      const tree = createTree(entries);
      writeObject(repoName, tree);

      // Resolve parent: "none" → null
      const headValue  = getHead(repoName);
      const parentHash = headValue === 'none' ? null : headValue;

      const commit = createCommit({ treeHash: tree.hash, parentHash, author, message });
      writeObject(repoName, commit);

      // Advance HEAD and clear staging area
      setHead(repoName, commit.hash);
      setBranchTip(repoName, getCurrentBranch(repoName), commit.hash);
      setIndex(repoName, {});

      return {
        commitHash: commit.hash,
        treeHash:   tree.hash,
        parentHash,
      };
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.message === 'Nothing staged to commit') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
};

/**
 * GET /api/repos/:repoName/log
 * Walk the commit chain from HEAD and return all commits newest-first.
 * Equivalent to `git log`.
 * Returns 200: { log: [ ...commit objects ] }
 *
 * @type {import('express').RequestHandler}
 */
exports.logHandler = (req, res, next) => {
  try {
    const { repoName } = req.params;

    assertRepoExists(repoName);

    const log  = [];
    let   hash = getHead(repoName);

    while (hash && hash !== 'none') {
      const commit = readObject(repoName, hash);
      if (!commit) break;          // corrupt / missing object — stop gracefully
      log.push(commit);
      hash = commit.parentHash;    // null terminates the chain
    }

    res.json({ log });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/repos/:repoName/status
 * Return HEAD, staged files, and current branch.
 * Equivalent to a simplified `git status`.
 * Returns 200: { head, staged, branch }
 *
 * @type {import('express').RequestHandler}
 */
exports.statusHandler = (req, res, next) => {
  try {
    const { repoName } = req.params;

    assertRepoExists(repoName);

    res.json({
      head:   getHead(repoName),
      staged: getIndex(repoName),
      branch: getCurrentBranch(repoName),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/repos
 * List all repositories.
 *
 * @type {import('express').RequestHandler}
 */
exports.listReposHandler = (req, res, next) => {
  try {
    const repos = listRepos();
    res.json({ repos });
  } catch (err) {
    next(err);
  }
};
