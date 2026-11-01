'use strict';

const { sha1 } = require('../utils/hash.util');

/**
 * Create a tree object representing a directory snapshot.
 *
 * Each entry describes one file or sub-directory:
 *   { mode: "100644", name: string, hash: string }
 *
 * The tree hash is the SHA-1 of the JSON-serialised, sorted entries array.
 *
 * @param {Array<{ name: string, hash: string, mode?: string }>} entries
 *   List of directory entries. `mode` defaults to "100644" (regular file).
 * @returns {{ type: string, entries: Array<{ mode: string, name: string, hash: string }>, hash: string }}
 */
function createTree(entries) {
  // Normalise: apply default mode and sort by name for deterministic hashing
  const normalisedEntries = entries
    .map(({ name, hash, mode = '100644' }) => ({ mode, name, hash }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const hash = sha1(JSON.stringify(normalisedEntries));

  return {
    type: 'tree',
    entries: normalisedEntries,
    hash,
  };
}

module.exports = { createTree };
