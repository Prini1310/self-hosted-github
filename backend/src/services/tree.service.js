'use strict';

const { readObject } = require('./objectStore.service');
const { assertRepoExists, getBranchTip, getCurrentBranch, getHead } = require('./repoMeta.service');

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Walk the full commit chain (HEAD → root) and build a blame index:
 *   path → { message, author, timestamp, commitHash }
 * Records the LAST commit that changed each file's hash (oldest→newest walk).
 *
 * @param {string} repoName
 * @param {string} headHash
 * @returns {Object} blame map
 */
function buildCommitBlameIndex(repoName, headHash) {
  // Collect full chain, then reverse to process oldest → newest
  const chain = [];
  let current = headHash;
  while (current && current !== 'none') {
    const commit = readObject(repoName, current);
    if (!commit) break;
    chain.push(commit);
    current = commit.parentHash;
  }
  chain.reverse(); // oldest first

  const blame = {};
  const prevHashes = {}; // path → hash in the previous commit

  for (const commit of chain) {
    const tree = readObject(repoName, commit.treeHash);
    if (!tree || !Array.isArray(tree.entries)) continue;

    for (const entry of tree.entries) {
      const p = entry.name;
      if (prevHashes[p] !== entry.hash) {
        // Hash changed (or file is new) → this is the commit that last touched it
        blame[p] = {
          message: commit.message,
          author: commit.author,
          timestamp: commit.timestamp,
          commitHash: commit.hash,
        };
        prevHashes[p] = entry.hash;
      }
    }
  }

  return blame;
}

/**
 * Build a virtual directory hierarchy from a flat list of tree entries.
 * Entries have names like "src/utils/helper.js" (full relative path).
 *
 * Returns a nested object: { name, type:'dir', children:{} }
 *
 * @param {Array<{mode,name,hash}>} entries
 * @param {Object} blame
 * @returns {Object} root virtual dir node
 */
function buildVirtualTree(entries, blame) {
  const root = { type: 'dir', name: '', children: {} };

  for (const entry of entries) {
    const parts = entry.name.split('/');
    let node = root;
    // Create intermediate dir nodes
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!node.children[part]) {
        node.children[part] = { type: 'dir', name: part, children: {} };
      }
      node = node.children[part];
    }
    // File leaf
    const fileName = parts[parts.length - 1];
    const b = blame[entry.name] || {};
    node.children[fileName] = {
      type: 'file',
      name: fileName,
      hash: entry.hash,
      path: entry.name,
      lastCommitMessage: b.message || '',
      lastCommitAuthor: b.author || '',
      lastCommitTimestamp: b.timestamp || null,
      lastCommitHash: b.commitHash || '',
    };
  }

  return root;
}

/**
 * Convert a virtual-dir's children map into a sorted array (dirs first, then files).
 * Adds 'path' field for sub-folders so the client can navigate.
 *
 * @param {Object} childrenMap  { name → node }
 * @param {string} parentPath   e.g. '' for root, 'src' for src/
 * @returns {Array}
 */
function childrenToArray(childrenMap, parentPath) {
  const items = Object.values(childrenMap).map(node => {
    if (node.type === 'dir') {
      // Find the "best" blame for a dir: the most recent commit among all files inside
      const blame = getDirBlame(node);
      return {
        type: 'dir',
        name: node.name,
        path: parentPath ? `${parentPath}/${node.name}` : node.name,
        lastCommitMessage: blame.message || '',
        lastCommitAuthor: blame.author || '',
        lastCommitTimestamp: blame.timestamp || null,
        lastCommitHash: blame.commitHash || '',
      };
    }
    return {
      type: 'file',
      name: node.name,
      path: node.path,
      hash: node.hash,
      lastCommitMessage: node.lastCommitMessage,
      lastCommitAuthor: node.lastCommitAuthor,
      lastCommitTimestamp: node.lastCommitTimestamp,
      lastCommitHash: node.lastCommitHash,
    };
  });

  // Directories first, then files, each group sorted alphabetically
  const dirs  = items.filter(i => i.type === 'dir').sort((a, b) => a.name.localeCompare(b.name));
  const files = items.filter(i => i.type === 'file').sort((a, b) => a.name.localeCompare(b.name));
  return [...dirs, ...files];
}

/** Find the most-recent commit among all files in a dir (recursive). */
function getDirBlame(dirNode) {
  let best = null;
  for (const child of Object.values(dirNode.children)) {
    let ts = null;
    let candidate = null;
    if (child.type === 'file') {
      ts = child.lastCommitTimestamp;
      candidate = {
        message: child.lastCommitMessage,
        author: child.lastCommitAuthor,
        timestamp: child.lastCommitTimestamp,
        commitHash: child.lastCommitHash,
      };
    } else {
      candidate = getDirBlame(child);
      ts = candidate?.timestamp || null;
    }
    if (candidate && (!best || ts > best.timestamp)) {
      best = candidate;
    }
  }
  return best || {};
}

/**
 * Resolve the head commit hash for a branch (defaults to current branch).
 */
function resolveHead(repoName, branch) {
  if (branch) {
    const tip = getBranchTip(repoName, branch);
    if (!tip || tip === 'none') return null;
    return tip;
  }
  const h = getHead(repoName);
  return h && h !== 'none' ? h : null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return the root-level directory listing with per-entry blame metadata.
 *
 * @param {string} repoName
 * @param {string} [branch]  Optional branch name; defaults to HEAD.
 * @returns {{ branch, commitHash, commitCount, entries: Array }}
 */
function getRepoTree(repoName, branch) {
  assertRepoExists(repoName);

  const currentBranch = branch || getCurrentBranch(repoName);
  const headHash = resolveHead(repoName, branch);

  if (!headHash) {
    return { branch: currentBranch, commitHash: null, commitCount: 0, entries: [] };
  }

  const headCommit = readObject(repoName, headHash);
  if (!headCommit) return { branch: currentBranch, commitHash: headHash, commitCount: 0, entries: [] };

  const rootTree = readObject(repoName, headCommit.treeHash);
  if (!rootTree || !Array.isArray(rootTree.entries)) {
    return { branch: currentBranch, commitHash: headHash, commitCount: 0, entries: [] };
  }

  const blame = buildCommitBlameIndex(repoName, headHash);
  const virtualRoot = buildVirtualTree(rootTree.entries, blame);

  // Count commits
  let commitCount = 0;
  let cur = headHash;
  while (cur && cur !== 'none') {
    commitCount++;
    const c = readObject(repoName, cur);
    if (!c) break;
    cur = c.parentHash;
  }

  return {
    branch: currentBranch,
    commitHash: headHash,
    commitMessage: headCommit.message,
    commitAuthor: headCommit.author,
    commitTimestamp: headCommit.timestamp,
    commitCount,
    entries: childrenToArray(virtualRoot.children, ''),
  };
}

/**
 * Navigate to a specific path and return either a folder's children or a file's metadata.
 *
 * @param {string} repoName
 * @param {string} filepath   e.g. 'src' or 'src/utils'
 * @param {string} [branch]
 * @returns {{ type:'dir'|'file', entries?, content?, ... }}
 */
function getEntryAtPath(repoName, filepath, branch) {
  assertRepoExists(repoName);

  const currentBranch = branch || getCurrentBranch(repoName);
  const headHash = resolveHead(repoName, branch);
  if (!headHash) {
    return { type: 'dir', branch: currentBranch, path: filepath, entries: [] };
  }

  const headCommit = readObject(repoName, headHash);
  if (!headCommit) return { type: 'dir', branch: currentBranch, path: filepath, entries: [] };

  const rootTree = readObject(repoName, headCommit.treeHash);
  if (!rootTree || !Array.isArray(rootTree.entries)) {
    return { type: 'dir', branch: currentBranch, path: filepath, entries: [] };
  }

  const blame = buildCommitBlameIndex(repoName, headHash);
  const virtualRoot = buildVirtualTree(rootTree.entries, blame);

  // Navigate the virtual tree to the given path
  const parts = filepath.split('/').filter(Boolean);
  let node = virtualRoot;
  for (const part of parts) {
    if (!node.children || !node.children[part]) {
      const err = new Error(`Path '${filepath}' not found`);
      err.status = 404;
      throw err;
    }
    node = node.children[part];
  }

  if (node.type === 'dir') {
    return {
      type: 'dir',
      branch: currentBranch,
      path: filepath,
      entries: childrenToArray(node.children, filepath),
    };
  }

  // It's a file node
  const blob = readObject(repoName, node.hash);
  return {
    type: 'file',
    branch: currentBranch,
    path: node.path,
    name: node.name,
    hash: node.hash,
    size: blob ? blob.size : 0,
    lastCommitMessage: node.lastCommitMessage,
    lastCommitAuthor: node.lastCommitAuthor,
    lastCommitTimestamp: node.lastCommitTimestamp,
    lastCommitHash: node.lastCommitHash,
    content: blob ? blob.content : '',
  };
}

/**
 * Return just the raw content of a file at the given path.
 *
 * @param {string} repoName
 * @param {string} filepath
 * @param {string} [branch]
 * @returns {{ name, path, content, size }}
 */
function getBlobContent(repoName, filepath, branch) {
  const entry = getEntryAtPath(repoName, filepath, branch);
  if (entry.type !== 'file') {
    const err = new Error(`'${filepath}' is a directory, not a file`);
    err.status = 400;
    throw err;
  }
  return {
    name: entry.name,
    path: entry.path,
    content: entry.content,
    size: entry.size,
    lastCommitMessage: entry.lastCommitMessage,
    lastCommitAuthor: entry.lastCommitAuthor,
    lastCommitTimestamp: entry.lastCommitTimestamp,
  };
}

module.exports = { getRepoTree, getEntryAtPath, getBlobContent };
