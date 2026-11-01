'use strict';

/**
 * shared test helpers — in-process HTTP server using native fetch (Node 18+).
 * No supertest / superagent dependency needed.
 */

const http = require('http');
const path = require('path');
const fs   = require('fs');
const jwt  = require('jsonwebtoken');

// Load environment variables
require('dotenv').config();

process.env.STORAGE_PATH = path.join(__dirname, '../backend/storage/repos');

const app = require('../backend/src/app');

// Generate a valid JWT token for test requests
const testSecret = process.env.JWT_SECRET || 'replace-with-a-long-random-secret';
const testToken = jwt.sign({ username: 'admin' }, testSecret, { expiresIn: '8h' });

let server;
let baseUrl;

/**
 * Start the Express app on a random available port.
 * Call in beforeAll().
 */
async function startServer() {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
}

/** Stop the server. Call in afterAll(). */
async function stopServer() {
  if (server) await new Promise((resolve) => server.close(resolve));
}

/** POST JSON → { status, body } */
async function post(path, body = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method:  'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testToken}`
    },
    body:    JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

/** GET → { status, body } */
async function get(path) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Authorization': `Bearer ${testToken}`
    }
  });
  return { status: res.status, body: await res.json() };
}

/** DELETE → { status, body } */
async function del(path, body = null) {
  const options = {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${testToken}`
    }
  };
  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${path}`, options);
  return { status: res.status, body: await res.json() };
}

/**
 * Clean up a repo's storage directory.
 * @param {string} repoName
 */
function cleanRepo(repoName) {
  const p = path.join(
    process.env.STORAGE_PATH || path.join(__dirname, '../backend/storage/repos'),
    repoName
  );
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true });
}

module.exports = { 
  startServer, 
  stopServer, 
  post, 
  get, 
  del, 
  cleanRepo, 
  getBaseUrl: () => baseUrl,
  testToken 
};
