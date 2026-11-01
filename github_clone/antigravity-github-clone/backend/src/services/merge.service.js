'use strict';

/**
 * merge.service.js
 * Proper three-way merge logic for combining diverged branch histories.
 *
 * Algorithm:
 *  1. Walk both commit chains to find the lowest common ancestor (LCA / merge base).
 *  2. Build flat file maps for base, ours, and theirs trees.
 *  3. For each path seen in ANY of the three trees:
 *       - If both branches changed the file differently from base → CONFLICT
 *       - If only one branch changed it → take that version
 *       - If neither changed it → take base version
 *  4. Return merged entry list, or a list of conflicting paths.
 */

const { createTree } = require('../models/tree.model');
const { writeObject, readObject } = require('./objectStore.service');

/**
 * Walk a commit chain and return all commit hashes as an ordered array,
 * starting from startHash and following parentHash links.
 *
 * @param {string} repoName
 * @param {string} startHash
 * @returns {string[]}
 */
function walkChain(repoName, startHash) {
  const chain = [];
  const queue = [startHash];
  const visited = new Set();

  while (queue.length > 0) {
    const hash = queue.shift();
    if (!hash || hash === 'none' || visited.has(hash)) continue;
    visited.add(hash);
    chain.push(hash);

    const commit = readObject(repoName, hash);
    if (commit) {
      if (commit.parentHash && commit.parentHash !== 'none') {
        queue.push(commit.parentHash);
      }
      if (commit.secondaryParentHash && commit.secondaryParentHash !== 'none') {
        queue.push(commit.secondaryParentHash);
      }
    }
  }
  return chain;
}

/**
 * Find the Lowest Common Ancestor of two commits using a BFS paint algorithm.
 * Handles both linear and merge commits by following both parent pointers.
 *
 * @param {string} repoName
 * @param {string} shaA
 * @param {string} shaB
 * @returns {string|null} LCA commit SHA, or null if no common ancestor found.
 */
function findMergeBase(repoName, shaA, shaB) {
  // Collect full ancestor set of A
  const ancestorsA = new Set(walkChain(repoName, shaA));

  // Walk B's chain until we hit a commit that's also in A's ancestry
  const chainB = walkChain(repoName, shaB);
  for (const hash of chainB) {
    if (ancestorsA.has(hash)) return hash;
  }
  return null;
}

/**
 * Build a flat map of { filePath → blobHash } from a tree object's entries.
 * Tree entries use the flat-path convention (name is the full relative path).
 *
 * @param {object|null} treeObject  – a tree object as stored in the object store
 * @returns {Object}                – { name: hash }
 */
function treeToMap(treeObject) {
  if (!treeObject || !Array.isArray(treeObject.entries)) return {};
  const map = {};
  for (const entry of treeObject.entries) {
    map[entry.name] = entry.hash;
  }
  return map;
}

/**
 * Perform a three-way merge between three commit SHAs.
 *
 * Returns either:
 *   { success: true,  mergedEntries: Array<{mode,name,hash}> }
 *   { success: false, conflicts: string[] }
 *
 * @param {string} repoName
 * @param {string} baseSha   – common ancestor commit SHA (or null for initial diverge)
 * @param {string} oursSha   – target branch HEAD commit SHA
 * @param {string} theirsSha – source branch HEAD commit SHA
 */
function threeWayMerge(repoName, baseSha, oursSha, theirsSha) {
  // Resolve trees for all three commits
  const oursCommit   = readObject(repoName, oursSha);
  const theirsCommit = readObject(repoName, theirsSha);

  const oursTree   = oursCommit   ? readObject(repoName, oursCommit.treeHash)   : null;
  const theirsTree = theirsCommit ? readObject(repoName, theirsCommit.treeHash) : null;

  let baseTree = null;
  if (baseSha) {
    const baseCommit = readObject(repoName, baseSha);
    baseTree = baseCommit ? readObject(repoName, baseCommit.treeHash) : null;
  }

  const baseMap   = treeToMap(baseTree);
  const oursMap   = treeToMap(oursTree);
  const theirsMap = treeToMap(theirsTree);

  // Union of all paths seen in any tree
  const allPaths = new Set([
    ...Object.keys(baseMap),
    ...Object.keys(oursMap),
    ...Object.keys(theirsMap),
  ]);

  const conflicts = [];
  const mergedEntries = [];

  for (const path of allPaths) {
    const baseHash   = baseMap[path]   || null;
    const oursHash   = oursMap[path]   || null;
    const theirsHash = theirsMap[path] || null;

    const oursChanged   = oursHash   !== baseHash;
    const theirsChanged = theirsHash !== baseHash;

    if (oursChanged && theirsChanged) {
      if (oursHash === theirsHash) {
        // Both branches made the same change — no conflict, take either
        mergedEntries.push({ mode: '100644', name: path, hash: oursHash });
      } else {
        // Both changed differently → CONFLICT
        conflicts.push(path);
      }
    } else if (oursChanged) {
      // Only our branch changed this file
      if (oursHash !== null) {
        // File was modified or added in ours
        mergedEntries.push({ mode: '100644', name: path, hash: oursHash });
      }
      // If oursHash is null, file was deleted in ours — omit it
    } else if (theirsChanged) {
      // Only their branch changed this file
      if (theirsHash !== null) {
        // File was modified or added in theirs
        mergedEntries.push({ mode: '100644', name: path, hash: theirsHash });
      }
      // If theirsHash is null, file was deleted in theirs — omit it
    } else {
      // Neither branch changed this file — keep base version
      if (baseHash !== null) {
        mergedEntries.push({ mode: '100644', name: path, hash: baseHash });
      }
    }
  }

  if (conflicts.length > 0) {
    return { success: false, conflicts };
  }

  return { success: true, mergedEntries };
}

module.exports = { findMergeBase, threeWayMerge };
