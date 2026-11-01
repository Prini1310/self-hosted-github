'use strict';

const crypto = require('crypto');

/**
 * Compute the SHA-1 hex digest of a string or Buffer.
 *
 * @param {string|Buffer} content - Raw content to hash.
 * @returns {string} 40-character lowercase hex SHA-1 digest.
 */
function sha1(content) {
  return crypto.createHash('sha1').update(content).digest('hex');
}

module.exports = { sha1 };
