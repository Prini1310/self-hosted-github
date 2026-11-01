const fs = require('fs');
const path = require('path');

const LOCKS_DIR = path.join(__dirname, '../../storage/.mutex');

/**
 * Acquires a mutex lock for a given key.
 * Retries up to maxRetries times with retryDelayMs between attempts.
 * Returns true if acquired, throws Error if timeout.
 */
function acquireLock(key, maxRetries = 10, retryDelayMs = 50) {
  fs.mkdirSync(LOCKS_DIR, { recursive: true });
  const lockFile = path.join(LOCKS_DIR, key.replace(/[^a-z0-9_-]/gi, '_') + '.lock');
  for (let i = 0; i < maxRetries; i++) {
    try {
      // O_EXCL ensures atomic create — fails if file exists
      fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' });
      return lockFile;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      // Stale lock check — if lock file is older than 5 seconds, remove it
      try {
        const stat = fs.statSync(lockFile);
        if (Date.now() - stat.mtimeMs > 5000) {
          fs.unlinkSync(lockFile);
          continue;
        }
      } catch (_) {}
      // Wait synchronously (blocking — acceptable for short critical sections)
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, retryDelayMs);
    }
  }
  throw new Error(`Could not acquire mutex lock for: ${key}`);
}

/**
 * Releases a mutex lock.
 */
function releaseLock(lockFile) {
  try { fs.unlinkSync(lockFile); } catch (_) {}
}

/**
 * Wraps a function in a mutex lock for the given key.
 * fn must be synchronous.
 */
function withLock(key, fn) {
  const lockFile = acquireLock(key);
  try {
    return fn();
  } finally {
    releaseLock(lockFile);
  }
}

module.exports = { acquireLock, releaseLock, withLock };
