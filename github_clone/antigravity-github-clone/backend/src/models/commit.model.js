'use strict';

const { sha1 } = require('../utils/hash.util');

/**
 * Create a commit object pointing to a tree snapshot.
 *
 * The commit hash is derived from a deterministic JSON serialisation of all
 * commit fields (excluding the hash itself).
 *
 * @param {object}  params
 * @param {string}  params.treeHash    - SHA-1 hash of the root tree object.
 * @param {string}  [params.parentHash] - SHA-1 hash of the parent commit (null for root commit).
 * @param {string}  params.author      - Author identifier, e.g. "Alice <alice@example.com>".
 * @param {string}  params.message     - Commit message.
 * @param {string}  [params.timestamp] - ISO-8601 timestamp; defaults to now.
 * @returns {{
 *   type: string,
 *   treeHash: string,
 *   parentHash: string|null,
 *   author: string,
 *   message: string,
 *   timestamp: string,
 *   hash: string
 * }}
 */
function createCommit({ treeHash, parentHash, secondaryParentHash, author, message, timestamp }) {
  const ts = timestamp || new Date().toISOString();

  const payload = {
    type: 'commit',
    treeHash,
    parentHash: parentHash || null,
    secondaryParentHash: secondaryParentHash || null,
    author,
    message,
    timestamp: ts,
  };

  const hash = sha1(JSON.stringify(payload));

  return { ...payload, hash };
}

module.exports = { createCommit };
