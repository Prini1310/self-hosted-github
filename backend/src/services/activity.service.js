'use strict';

const fs = require('fs');
const path = require('path');

const STORAGE_ROOT = process.env.STORAGE_PATH || path.join(__dirname, "../../../storage/repos");

function _activityPath(repoName) {
  return path.join(STORAGE_ROOT, repoName, 'activity.json');
}

function recordActivity(repoName, record) {
  const p = _activityPath(repoName);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let activity = [];
  if (fs.existsSync(p)) {
    try {
      activity = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
      activity = [];
    }
  }

  activity.push({
    ...record,
    timestamp: new Date().toISOString()
  });

  fs.writeFileSync(p, JSON.stringify(activity, null, 2), 'utf8');
}

function getActivityLog(repoName) {
  const p = _activityPath(repoName);
  if (!fs.existsSync(p)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    return [];
  }
}

module.exports = {
  recordActivity,
  getActivityLog
};
