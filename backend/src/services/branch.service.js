'use strict';

const { createTree } = require('../models/tree.model');
const { createCommit } = require('../models/commit.model');
const { writeObject, readObject } = require('./objectStore.service');
const {
  getHead,
  setHead,
  getIndex,
  getCurrentBranch,
  setCurrentBranch,
  getBranches,
  setBranches,
  getBranchTip,
  setBranchTip,
} = require('./repoMeta.service');
const { findMergeBase, threeWayMerge } = require('./merge.service');

/**
 * Helper: Walk the commit chain from startHash and return all hashes in a list.
 */
function getCommitChain(repoName, startHash) {
  const chain = [];
  let current = startHash;
  while (current && current !== 'none') {
    chain.push(current);
    const commit = readObject(repoName, current);
    if (!commit) break;
    current = commit.parentHash;
  }
  return chain;
}

/**
 * Create a new branch. Supports optional fromBranch for backward compatibility.
 */
function createBranch(repoName, branchName, fromBranch) {
  const branches = getBranches(repoName);
  if (branchName in branches) {
    throw new Error('branch already exists');
  }

  let targetHash;
  if (fromBranch) {
    if (!(fromBranch in branches)) {
      throw new Error('source branch not found');
    }
    targetHash = branches[fromBranch];
  } else {
    targetHash = getHead(repoName);
  }

  if (targetHash === 'none') {
    throw new Error('cannot branch from empty repo');
  }

  setBranchTip(repoName, branchName, targetHash);
  return { branchName, tipHash: targetHash };
}

/**
 * Switch the active branch.
 */
function switchBranch(repoName, branchName) {
  const branches = getBranches(repoName);
  if (!(branchName in branches)) {
    throw new Error('branch not found');
  }

  const index = getIndex(repoName);
  if (Object.keys(index).length > 0) {
    throw new Error('staged changes present — commit or clear before switching');
  }

  const tipHash = branches[branchName];
  setHead(repoName, tipHash);
  setCurrentBranch(repoName, branchName);

  return { branchName, head: tipHash };
}

/**
 * List all branches in the repo.
 */
function listBranches(repoName) {
  const branches = getBranches(repoName);
  return {
    branches: Object.keys(branches), // array for old tests
    branchesMap: branches, // map for new UI
    current: getCurrentBranch(repoName),
  };
}

/**
 * Delete a branch.
 */
function deleteBranch(repoName, branchName) {
  if (branchName === 'main') {
    throw Object.assign(new Error("Cannot delete the default branch 'main'"), { status: 400 });
  }
  const currentBranch = getCurrentBranch(repoName);
  if (branchName === currentBranch) {
    throw Object.assign(new Error(`Cannot delete the currently active branch: '${branchName}'`), { status: 400 });
  }
  const branches = getBranches(repoName);
  if (!(branchName in branches)) {
    throw Object.assign(new Error(`Branch '${branchName}' does not exist`), { status: 404 });
  }
  delete branches[branchName];
  setBranches(repoName, branches);
  return { deleted: branchName };
}/**
 * Helper to get commits from sourceTip down to lca (not including lca).
 */
function getCommitsToLCA(repoName, sourceTip, lca) {
  const commits = [];
  let cur = sourceTip;
  while (cur && cur !== 'none' && cur !== lca) {
    const commit = readObject(repoName, cur);
    if (!commit) break;
    commits.push({ hash: cur, ...commit });
    cur = commit.parentHash;
  }
  return commits;
}

/**
 * Merge sourceBranch into the current active branch.
 *
 * @param {string} repoName
 * @param {string} sourceBranch   - Name of the branch to merge in
 * @param {string} [author]       - Authenticated user; defaults to 'system'
 * @param {string} [strategy]     - Merge strategy: 'merge', 'squash', 'rebase'
 * @returns {object} Result descriptor — caller maps to HTTP response
 */
function mergeBranch(repoName, sourceBranch, author, strategy = 'merge') {
  const currentBranch = getCurrentBranch(repoName);

  // ── Edge case: self-merge ────────────────────────────────────────────────
  if (sourceBranch === currentBranch) {
    const err = new Error('Cannot merge a branch into itself');
    err.status = 400;
    throw err;
  }

  // ── Edge case: uncommitted staged changes ────────────────────────────────
  const index = getIndex(repoName);
  if (Object.keys(index).length > 0) {
    const err = new Error('Cannot merge with staged changes present — commit or clear staged files first');
    err.status = 409;
    err.type = 'staged-changes';
    throw err;
  }

  const branches = getBranches(repoName);

  // ── Edge case: source branch doesn't exist ───────────────────────────────
  if (!(sourceBranch in branches)) {
    const err = new Error(`Source branch '${sourceBranch}' not found`);
    err.status = 404;
    throw err;
  }

  const targetTip = getBranchTip(repoName, currentBranch);
  const sourceTip = getBranchTip(repoName, sourceBranch);

  // ── Edge case: source branch is empty ────────────────────────────────────
  if (!sourceTip || sourceTip === 'none') {
    const err = new Error('Source branch has no commits to merge');
    err.status = 400;
    throw err;
  }

  // ── Edge case: target branch is empty ────────────────────────────────────
  if (!targetTip || targetTip === 'none') {
    const err = new Error('Cannot merge into an empty branch — make a commit first');
    err.status = 400;
    throw err;
  }

  // ── Trivial case: both branches point to the same commit ─────────────────
  if (sourceTip === targetTip) {
    return { type: 'already-merged', message: 'already up to date' };
  }

  // ── Find the common ancestor (merge base) ────────────────────────────────
  const mergeBase = findMergeBase(repoName, targetTip, sourceTip);

  // ── Already up-to-date: target already contains source ───────────────────
  if (mergeBase === sourceTip) {
    return { type: 'already-merged', message: 'already up to date' };
  }

  const uniqueCommits = getCommitsToLCA(repoName, sourceTip, mergeBase);
  const commitsMerged = uniqueCommits.length;

  if (strategy === 'merge') {
    // ── Fast-forward: source is directly ahead of target ─────────────────────
    if (mergeBase === targetTip) {
      setHead(repoName, sourceTip);
      setBranchTip(repoName, currentBranch, sourceTip);
      return {
        type: 'fast-forward',
        commitHash: sourceTip,
        strategy: 'merge',
        commitsMerged,
        message: 'Fast-forward merge complete'
      };
    }

    // ── True 3-way merge ─────────────────────────────────────────────────────
    const mergeResult = threeWayMerge(repoName, mergeBase, targetTip, sourceTip);

    if (!mergeResult.success) {
      return { type: 'conflict', conflicts: mergeResult.conflicts };
    }

    const mergedTree = createTree(mergeResult.mergedEntries);
    writeObject(repoName, mergedTree);

    const mergeCommit = createCommit({
      treeHash: mergedTree.hash,
      parentHash: targetTip,
      secondaryParentHash: sourceTip,
      author: author || 'system',
      message: `Merge branch ${sourceBranch} into ${currentBranch}`,
    });
    writeObject(repoName, mergeCommit);

    setHead(repoName, mergeCommit.hash);
    setBranchTip(repoName, currentBranch, mergeCommit.hash);

    return {
      type: 'merged',
      commitHash: mergeCommit.hash,
      strategy: 'merge',
      commitsMerged,
      message: `Merge branch ${sourceBranch} into ${currentBranch}`,
    };
  }

  if (strategy === 'squash') {
    // Perform 3-way merge of target HEAD and source HEAD against LCA
    const mergeResult = threeWayMerge(repoName, mergeBase, targetTip, sourceTip);

    if (!mergeResult.success) {
      return { type: 'conflict', conflicts: mergeResult.conflicts };
    }

    const mergedTree = createTree(mergeResult.mergedEntries);
    writeObject(repoName, mergedTree);

    // List all original commit messages (from oldest to newest)
    const commitLines = uniqueCommits.map(c => c.message).reverse();
    const squashMessage = `Squashed commits:\n\n${commitLines.join('\n')}`;

    const squashCommit = createCommit({
      treeHash: mergedTree.hash,
      parentHash: targetTip,
      author: author || 'system',
      message: squashMessage,
    });
    writeObject(repoName, squashCommit);

    setHead(repoName, squashCommit.hash);
    setBranchTip(repoName, currentBranch, squashCommit.hash);

    return {
      type: 'merged',
      commitHash: squashCommit.hash,
      strategy: 'squash',
      commitsMerged,
      message: `Squashed and merged branch ${sourceBranch} into ${currentBranch}`,
    };
  }

  if (strategy === 'rebase') {
    // Replay commits from oldest to newest
    const replayedCommits = [...uniqueCommits].reverse();
    let currentParent = targetTip;

    for (const commitToReplay of replayedCommits) {
      const baseSha = commitToReplay.parentHash;
      const oursSha = currentParent;
      const theirsSha = commitToReplay.hash;

      const mergeResult = threeWayMerge(repoName, baseSha, oursSha, theirsSha);
      if (!mergeResult.success) {
        // Return conflicts immediately. No partial rebase is applied to target.
        return { type: 'conflict', conflicts: mergeResult.conflicts };
      }

      const replayedTree = createTree(mergeResult.mergedEntries);
      writeObject(repoName, replayedTree);

      const replayedCommit = createCommit({
        treeHash: replayedTree.hash,
        parentHash: currentParent,
        author: commitToReplay.author,
        message: commitToReplay.message,
        timestamp: commitToReplay.timestamp,
      });
      writeObject(repoName, replayedCommit);

      currentParent = replayedCommit.hash;
    }

    setHead(repoName, currentParent);
    setBranchTip(repoName, currentBranch, currentParent);

    return {
      type: 'merged',
      commitHash: currentParent,
      strategy: 'rebase',
      commitsMerged,
      message: `Rebased and merged branch ${sourceBranch} into ${currentBranch}`,
    };
  }

  throw new Error(`Unsupported merge strategy: ${strategy}`);
}

/**
 * Get merge status between source and target branches.
 */
function getMergeStatus(repoName, sourceBranch, targetBranch) {
  const branches = getBranches(repoName);
  if (!(sourceBranch in branches)) {
    throw Object.assign(new Error(`Source branch '${sourceBranch}' not found`), { status: 404 });
  }
  if (!(targetBranch in branches)) {
    throw Object.assign(new Error(`Target branch '${targetBranch}' not found`), { status: 404 });
  }

  const targetTip = branches[targetBranch];
  const sourceTip = branches[sourceBranch];

  if (!sourceTip || sourceTip === 'none') {
    throw Object.assign(new Error('Source branch has no commits'), { status: 400 });
  }
  if (!targetTip || targetTip === 'none') {
    throw Object.assign(new Error('Target branch has no commits'), { status: 400 });
  }

  if (sourceTip === targetTip) {
    return {
      ableToMerge: true,
      conflicts: [],
      commitsAhead: 0,
      recommendedStrategy: 'merge',
    };
  }

  const mergeBase = findMergeBase(repoName, targetTip, sourceTip);

  // If source is already merged into target
  if (mergeBase === sourceTip) {
    return {
      ableToMerge: true,
      conflicts: [],
      commitsAhead: 0,
      recommendedStrategy: 'merge',
    };
  }

  const commitsToMerge = getCommitsToLCA(repoName, sourceTip, mergeBase);
  const commitsAhead = commitsToMerge.length;

  let recommendedStrategy = 'merge';
  if (commitsAhead === 1) {
    recommendedStrategy = 'rebase';
  } else if (commitsAhead > 3) {
    recommendedStrategy = 'squash';
  }

  const mergeResult = threeWayMerge(repoName, mergeBase, targetTip, sourceTip);

  return {
    ableToMerge: mergeResult.success,
    conflicts: mergeResult.success ? [] : mergeResult.conflicts,
    commitsAhead,
    recommendedStrategy,
  };
}

module.exports = {
  createBranch,
  switchBranch,
  listBranches,
  deleteBranch,
  mergeBranch,
  getMergeStatus,
};