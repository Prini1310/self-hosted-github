const lockService = require('../services/lock.service');
const { assertRepoExists } = require('../services/repoMeta.service');

exports.checkout = async (req, res, next) => {
  try {
    const { repoName } = req.params;
    assertRepoExists(repoName);
    const { ref } = req.body;
    res.json({ repoName, ref, message: 'Checkout successful (placeholder)' });
  } catch (err) {
    next(err);
  }
};

exports.getStatus = async (req, res, next) => {
  try {
    const { repoName } = req.params;
    assertRepoExists(repoName);
    res.json({ repoName, head: null, lockedFiles: [], message: 'Status placeholder' });
  } catch (err) {
    next(err);
  }
};

exports.lockFile = async (req, res, next) => {
  try {
    const { repoName } = req.params;
    assertRepoExists(repoName);
    const { filepath, lockedBy, ttlMinutes } = req.body;
    const lock = lockService.checkoutFile({ repoName, filepath, lockedBy, ttlMinutes });
    res.status(201).json(lock);
  } catch (err) {
    if (err.code === 'LOCKED') {
      return res.status(409).json({ error: err.message, lock: err.lock });
    }
    next(err);
  }
};

exports.unlockFile = async (req, res, next) => {
  try {
    const { repoName } = req.params;
    assertRepoExists(repoName);
    const { filepath, lockId, requestedBy } = req.body;
    const lock = lockService.releaseFile({ repoName, filepath, lockId, requestedBy });
    res.json(lock);
  } catch (err) {
    if (err.message.includes('mismatch')) {
      return res.status(403).json({ error: err.message });
    }
    if (err.message.includes('No lock')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
};

exports.listLocks = async (req, res, next) => {
  try {
    const { repoName } = req.params;
    assertRepoExists(repoName);
    const locks = lockService.listLocks(repoName);
    res.json({ locks });
  } catch (err) {
    next(err);
  }
};

exports.getLock = async (req, res, next) => {
  try {
    const { repoName } = req.params;
    assertRepoExists(repoName);
    const { filepath } = req.query;
    const lock = lockService.getLock(repoName, filepath);
    res.json({ lock });
  } catch (err) {
    next(err);
  }
};

exports.forceRelease = async (req, res, next) => {
  try {
    const { repoName } = req.params;
    assertRepoExists(repoName);
    const { filepath } = req.body;
    const lock = lockService.forceRelease(repoName, filepath);
    res.json(lock);
  } catch (err) {
    if (err.message.includes('No lock')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
};

exports.cleanExpiredLocks = async (req, res, next) => {
  try {
    const { repoName } = req.params;
    assertRepoExists(repoName);
    const cleaned = lockService.cleanExpiredLocks(repoName);
    res.json({ cleaned });
  } catch (err) {
    next(err);
  }
};