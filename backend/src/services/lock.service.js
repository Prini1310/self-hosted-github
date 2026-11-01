/**
 * lock.service.js
 * Service for managing exclusive file checkouts (locks).
 */

const fs = require('fs');
const path = require('path');
const { createLockRecord } = require('../models/lock.model');
const { withLock } = require('../utils/mutex.util');

const LOCKS_ROOT = process.env.LOCKS_PATH || path.join(__dirname, "../../../storage/locks");

function encodePath(repoName, filepath) {
  const sanitizedPath = filepath.replace(/[/\\]/g, '__');
  return `${repoName}--${sanitizedPath}.json`;
}

function getLockFilePath(repoName, filepath) {
  return path.join(LOCKS_ROOT, encodePath(repoName, filepath));
}

function checkoutFile({ repoName, filepath, lockedBy, ttlMinutes = 30 }) {
  return withLock(`lock-${repoName}-${filepath}`, () => {
    // Validate filepath
    if (!filepath || typeof filepath !== 'string' || filepath.trim() === '' || filepath.includes('..')) {
      const err = new Error('Invalid filepath');
      err.status = 400;
      throw err;
    }

    // Validate ttlMinutes
    const ttl = Number(ttlMinutes);
    if (isNaN(ttl) || ttl <= 0 || ttl > 480) {
      const err = new Error('Invalid ttlMinutes');
      err.status = 400;
      throw err;
    }

    // Ensure locks directory exists
    if (!fs.existsSync(LOCKS_ROOT)) {
      fs.mkdirSync(LOCKS_ROOT, { recursive: true });
    }

    const lockFilePath = getLockFilePath(repoName, filepath);

    if (fs.existsSync(lockFilePath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
        if (!existing.released && new Date() < new Date(existing.expiresAt)) {
          const err = new Error(`File is locked by ${existing.lockedBy}`);
          err.code = 'LOCKED';
          err.lock = existing;
          throw err;
        }
      } catch (e) {
        if (e.code === 'LOCKED') throw e;
        // If parsing fails, allow overwrite
      }
    }

    const record = createLockRecord({ repoName, filepath, lockedBy, ttlMinutes: ttl });
    fs.writeFileSync(lockFilePath, JSON.stringify(record, null, 2), 'utf8');
    return record;
  });
}

function releaseFile({ repoName, filepath, lockId, requestedBy }) {
  if (!filepath || typeof filepath !== 'string' || filepath.includes('..')) {
    const err = new Error('Invalid filepath');
    err.status = 400;
    throw err;
  }

  const lockFilePath = getLockFilePath(repoName, filepath);
  if (!fs.existsSync(lockFilePath)) {
    throw new Error('No lock found for this file');
  }

  const lock = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
  if (lock.lockId !== lockId) {
    throw new Error('Lock ID mismatch — you do not own this lock');
  }
  if (lock.released) {
    throw new Error('Lock already released');
  }

  lock.released = true;
  fs.writeFileSync(lockFilePath, JSON.stringify(lock, null, 2), 'utf8');
  return lock;
}

function getLock(repoName, filepath) {
  if (!filepath || typeof filepath !== 'string' || filepath.includes('..')) {
    return null;
  }

  const lockFilePath = getLockFilePath(repoName, filepath);
  if (!fs.existsSync(lockFilePath)) {
    return null;
  }

  try {
    const lock = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
    if (lock.released || new Date() > new Date(lock.expiresAt)) {
      return null;
    }
    return lock;
  } catch (e) {
    return null;
  }
}

function listLocks(repoName) {
  if (!fs.existsSync(LOCKS_ROOT)) {
    return [];
  }

  try {
    const files = fs.readdirSync(LOCKS_ROOT);
    const prefix = `${repoName}--`;
    const locks = [];

    for (const file of files) {
      if (file.startsWith(prefix) && file.endsWith('.json')) {
        try {
          const lock = JSON.parse(fs.readFileSync(path.join(LOCKS_ROOT, file), 'utf8'));
          const isExpired = new Date() > new Date(lock.expiresAt);
          if (!lock.released && !isExpired) {
            locks.push(lock);
          }
        } catch (e) {
          // ignore corrupted json files
        }
      }
    }

    locks.sort((a, b) => new Date(b.lockedAt) - new Date(a.lockedAt));
    return locks;
  } catch (err) {
    return [];
  }
}

function forceRelease(repoName, filepath) {
  if (!filepath || typeof filepath !== 'string' || filepath.includes('..')) {
    const err = new Error('Invalid filepath');
    err.status = 400;
    throw err;
  }

  const lockFilePath = getLockFilePath(repoName, filepath);
  if (!fs.existsSync(lockFilePath)) {
    throw new Error('No lock found');
  }

  const lock = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
  lock.released = true;
  fs.writeFileSync(lockFilePath, JSON.stringify(lock, null, 2), 'utf8');
  return lock;
}

function cleanExpiredLocks(repoName) {
  if (!fs.existsSync(LOCKS_ROOT)) {
    return 0;
  }

  try {
    const files = fs.readdirSync(LOCKS_ROOT);
    const prefix = `${repoName}--`;
    let count = 0;

    for (const file of files) {
      if (file.startsWith(prefix) && file.endsWith('.json')) {
        try {
          const filePathFull = path.join(LOCKS_ROOT, file);
          const lock = JSON.parse(fs.readFileSync(filePathFull, 'utf8'));
          const isExpired = new Date() > new Date(lock.expiresAt);
          if (!lock.released && isExpired) {
            lock.released = true;
            fs.writeFileSync(filePathFull, JSON.stringify(lock, null, 2), 'utf8');
            count++;
          }
        } catch (e) {
          // ignore
        }
      }
    }

    return count;
  } catch (err) {
    return 0;
  }
}

module.exports = {
  checkoutFile,
  releaseFile,
  getLock,
  listLocks,
  forceRelease,
  cleanExpiredLocks
};
