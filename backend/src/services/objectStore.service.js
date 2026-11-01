'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * Root directory for all repository object storage.
 * Override with STORAGE_PATH env var (useful in tests / Docker).
 */
const STORAGE_ROOT =
  process.env.STORAGE_PATH ||
  path.join(__dirname, '../../../storage/repos');

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Resolve the file-system path for a loose object.
 * Layout: <STORAGE_ROOT>/<repoName>/objects/<hash[0..1]>/<hash[2..]>
 *
 * @param {string} repoName
 * @param {string} hash
 * @returns {string} Absolute file path.
 */
function _objectPath(repoName, hash) {
  const dir  = hash.slice(0, 2);
  const file = hash.slice(2);
  return path.join(STORAGE_ROOT, repoName, 'objects', dir, file);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Serialise an object to JSON and write it to the loose-object store.
 * Creates intermediate directories automatically.
 *
 * @param {string} repoName - Repository name (acts as namespace).
 * @param {{ hash: string, [key: string]: any }} object - Any model object with a `hash` field.
 * @returns {void}
 */
function writeObject(repoName, object) {
  const filePath = _objectPath(repoName, object.hash);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(object), 'utf8');
}

/**
 * Read and deserialise a loose object by its hash.
 *
 * @param {string} repoName - Repository name.
 * @param {string} hash     - Full SHA-1 hex digest.
 * @returns {object|null} Parsed object, or null if the object does not exist.
 */
function readObject(repoName, hash) {
  const filePath = _objectPath(repoName, hash);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Check whether a loose object exists in the store without reading it.
 *
 * @param {string} repoName - Repository name.
 * @param {string} hash     - Full SHA-1 hex digest.
 * @returns {boolean} True if the object file exists on disk.
 */
function objectExists(repoName, hash) {
  return fs.existsSync(_objectPath(repoName, hash));
}

module.exports = { writeObject, readObject, objectExists };
