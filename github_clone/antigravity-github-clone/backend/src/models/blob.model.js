'use strict';

const { sha1 } = require('../utils/hash.util');

/**
 * Create a Git-style blob object from raw file content.
 *
 * The hash is computed over the canonical Git blob header:
 *   "blob <byteLength>\0<content>"
 *
 * @param {string|Buffer} content - Raw file content.
 * @returns {{ type: string, size: number, content: string|Buffer, hash: string }}
 */
function createBlob(content) {
  const size = Buffer.byteLength(content);
  const header = `blob ${size}\0`;
  const hashInput = Buffer.concat([
    Buffer.from(header),
    Buffer.isBuffer(content) ? content : Buffer.from(content),
  ]);
  const hash = sha1(hashInput);

  return {
    type: 'blob',
    size,
    content,
    hash,
  };
}

module.exports = { createBlob };
