/**
 * lock.model.js
 * Model for lock records representing checked out files.
 */

const crypto = require('crypto');

function createLockRecord({ repoName, filepath, lockedBy, ttlMinutes = 30 }) {
  const lockId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
  const lockedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  return {
    lockId,
    repoName,
    filepath,
    lockedBy,
    lockedAt,
    expiresAt,
    released: false
  };
}

module.exports = {
  createLockRecord
};
