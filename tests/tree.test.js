/**
 * tree.test.js – Tests for GET /tree, GET /tree/* (path), GET /blob/* endpoints
 *
 * Test coverage:
 *  1. Root tree on empty repo returns empty entries
 *  2. After commit, root tree returns the file with correct metadata
 *  3. Nested paths: folder navigation works correctly
 *  4. Deep nesting: src/utils/helper.js accessible via /tree/src/utils
 *  5. GET /blob/<path> returns raw file content
 *  6. JWT auth required — 401 without token
 *  7. 404 for non-existent path
 *  8. Blame metadata: last commit message propagated to entries
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

let passedCount = 0;
let failedCount = 0;

async function assert(condition, message) {
  if (!condition) {
    failedCount++;
    console.log(`  ❌ FAIL: ${message}`);
    throw new Error('FAIL: ' + message);
  }
  passedCount++;
  console.log(`  ✅ PASS: ${message}`);
}

async function httpRequest(method, urlPath, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: urlPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }),
        ...(token  && { 'Authorization': `Bearer ${token}` }),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getAuthToken() {
  const res = await httpRequest('POST', '/api/auth/login', { username: 'prabhaharan', password: 'admin123' });
  if (res.status !== 200) throw new Error('Auth failed: ' + JSON.stringify(res.data));
  return res.data.token;
}

async function run() {
  passedCount = 0;
  failedCount = 0;

  console.log('\n--- tree.test.js ---');

  let token;
  try {
    token = await getAuthToken();
  } catch (e) {
    console.error('Auth setup failed:', e.message);
    failedCount++;
    return { passedCount, failedCount };
  }

  const REPO = `tree-test-repo-${Date.now()}`;

  // ── Setup: init repo ────────────────────────────────────────────────────────
  await httpRequest('POST', `/api/repos/${REPO}/init`, {}, token);

  // ────────────────────────────────────────────────────────────────────────────
  // Test 1: Root tree on empty repo returns empty entries
  // ────────────────────────────────────────────────────────────────────────────
  try {
    const res = await httpRequest('GET', `/api/repos/${REPO}/tree`, null, token);
    await assert(res.status === 200, 'GET /tree returns 200 for empty repo');
    await assert(Array.isArray(res.data.entries), 'entries is an array');
    await assert(res.data.entries.length === 0, 'entries is empty for repo with no commits');
    await assert(res.data.commitCount === 0, 'commitCount is 0');
  } catch (e) { if (!e.message.startsWith('FAIL')) throw e; }

  // ── Stage + commit a root-level file ───────────────────────────────────────
  await httpRequest('POST', `/api/repos/${REPO}/add`, { filepath: 'README.md', content: '# Hello VRel\nWelcome!' }, token);
  await httpRequest('POST', `/api/repos/${REPO}/add`, { filepath: 'index.js', content: 'console.log("hi");' }, token);
  const commitRes1 = await httpRequest('POST', `/api/repos/${REPO}/commit`, { author: 'alice', message: 'Initial commit' }, token);
  const commit1Hash = commitRes1.data.commitHash;

  // ────────────────────────────────────────────────────────────────────────────
  // Test 2: Root tree after commit shows committed files
  // ────────────────────────────────────────────────────────────────────────────
  try {
    const res = await httpRequest('GET', `/api/repos/${REPO}/tree`, null, token);
    await assert(res.status === 200, 'GET /tree returns 200 after first commit');
    await assert(res.data.commitCount === 1, 'commitCount is 1');
    const names = res.data.entries.map(e => e.name);
    await assert(names.includes('README.md'), 'README.md appears in root listing');
    await assert(names.includes('index.js'), 'index.js appears in root listing');
    await assert(res.data.entries[0].lastCommitMessage === 'Initial commit', 'blame: lastCommitMessage is "Initial commit"');
    await assert(res.data.commitHash === commit1Hash, 'commitHash matches HEAD commit');
  } catch (e) { if (!e.message.startsWith('FAIL')) throw e; }

  // ── Stage + commit nested files ─────────────────────────────────────────────
  await httpRequest('POST', `/api/repos/${REPO}/add`, { filepath: 'src/App.jsx', content: 'export default function App(){}' }, token);
  await httpRequest('POST', `/api/repos/${REPO}/add`, { filepath: 'src/utils/helper.js', content: 'export const noop = () => {};' }, token);
  await httpRequest('POST', `/api/repos/${REPO}/add`, { filepath: 'src/utils/math.js', content: 'export const add = (a,b) => a+b;' }, token);
  await httpRequest('POST', `/api/repos/${REPO}/commit`, { author: 'bob', message: 'Add src files' }, token);

  // ────────────────────────────────────────────────────────────────────────────
  // Test 3: Root tree shows src/ as a folder
  // ────────────────────────────────────────────────────────────────────────────
  try {
    const res = await httpRequest('GET', `/api/repos/${REPO}/tree`, null, token);
    await assert(res.status === 200, 'GET /tree returns 200 after second commit');
    const srcEntry = res.data.entries.find(e => e.name === 'src');
    await assert(srcEntry !== undefined, 'src/ appears as a directory entry');
    await assert(srcEntry.type === 'dir', 'src entry type is "dir"');
    // Dirs should come before files in listing
    await assert(res.data.entries[0].type === 'dir', 'directories are listed before files');
  } catch (e) { if (!e.message.startsWith('FAIL')) throw e; }

  // ────────────────────────────────────────────────────────────────────────────
  // Test 4: Navigate into src/ — shows App.jsx and utils/ subfolder
  // ────────────────────────────────────────────────────────────────────────────
  try {
    const res = await httpRequest('GET', `/api/repos/${REPO}/tree/src`, null, token);
    await assert(res.status === 200, 'GET /tree/src returns 200');
    await assert(res.data.type === 'dir', 'type is "dir" for folder path');
    const names = res.data.entries.map(e => e.name);
    await assert(names.includes('App.jsx'), 'App.jsx found inside src/');
    await assert(names.includes('utils'), 'utils/ subfolder found inside src/');
    const utilsEntry = res.data.entries.find(e => e.name === 'utils');
    await assert(utilsEntry.type === 'dir', 'utils is a dir');
  } catch (e) { if (!e.message.startsWith('FAIL')) throw e; }

  // ────────────────────────────────────────────────────────────────────────────
  // Test 5: Navigate into src/utils/ — shows helper.js and math.js
  // ────────────────────────────────────────────────────────────────────────────
  try {
    const res = await httpRequest('GET', `/api/repos/${REPO}/tree/src/utils`, null, token);
    await assert(res.status === 200, 'GET /tree/src/utils returns 200');
    const names = res.data.entries.map(e => e.name);
    await assert(names.includes('helper.js'), 'helper.js found in src/utils/');
    await assert(names.includes('math.js'), 'math.js found in src/utils/');
    await assert(res.data.entries.every(e => e.type === 'file'), 'all entries in utils/ are files');
  } catch (e) { if (!e.message.startsWith('FAIL')) throw e; }

  // ────────────────────────────────────────────────────────────────────────────
  // Test 6: GET /blob/<path> returns raw file content
  // ────────────────────────────────────────────────────────────────────────────
  try {
    const res = await httpRequest('GET', `/api/repos/${REPO}/blob/src/utils/helper.js`, null, token);
    await assert(res.status === 200, 'GET /blob/src/utils/helper.js returns 200');
    await assert(res.data.content === 'export const noop = () => {};', 'blob content matches what was committed');
    await assert(res.data.name === 'helper.js', 'blob name is correct');
    await assert(res.data.lastCommitMessage === 'Add src files', 'blob blame message is correct');
  } catch (e) { if (!e.message.startsWith('FAIL')) throw e; }

  // ────────────────────────────────────────────────────────────────────────────
  // Test 7: JWT auth required — 401 without token
  // ────────────────────────────────────────────────────────────────────────────
  try {
    const res = await httpRequest('GET', `/api/repos/${REPO}/tree`, null, null);
    await assert(res.status === 401, 'GET /tree returns 401 without JWT token');
    const res2 = await httpRequest('GET', `/api/repos/${REPO}/blob/index.js`, null, null);
    await assert(res2.status === 401, 'GET /blob returns 401 without JWT token');
  } catch (e) { if (!e.message.startsWith('FAIL')) throw e; }

  // ────────────────────────────────────────────────────────────────────────────
  // Test 8: 404 for non-existent path
  // ────────────────────────────────────────────────────────────────────────────
  try {
    const res = await httpRequest('GET', `/api/repos/${REPO}/tree/nonexistent`, null, token);
    await assert(res.status === 404, 'GET /tree/nonexistent returns 404');
  } catch (e) { if (!e.message.startsWith('FAIL')) throw e; }

  // ────────────────────────────────────────────────────────────────────────────
  // Test 9: Blame update — second commit changes file, blame reflects new commit
  // ────────────────────────────────────────────────────────────────────────────
  try {
    await httpRequest('POST', `/api/repos/${REPO}/add`, { filepath: 'index.js', content: 'console.log("updated");' }, token);
    // Also re-add README.md so it stays in the tree (VRel stages only what you add)
    await httpRequest('POST', `/api/repos/${REPO}/add`, { filepath: 'README.md', content: '# Hello VRel\nWelcome!\nUpdated.' }, token);
    await httpRequest('POST', `/api/repos/${REPO}/commit`, { author: 'carol', message: 'Update index.js' }, token);

    const blobRes = await httpRequest('GET', `/api/repos/${REPO}/blob/index.js`, null, token);
    await assert(blobRes.data.lastCommitMessage === 'Update index.js', 'blame updated: index.js blame points to newest commit');

    // README.md changed content → blame should point to the new commit
    const readmeBlob = await httpRequest('GET', `/api/repos/${REPO}/blob/README.md`, null, token);
    await assert(readmeBlob.data.lastCommitMessage === 'Update index.js', 'README.md blame points to commit that changed its content');
  } catch (e) { if (!e.message.startsWith('FAIL')) throw e; }

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  try {
    const storagePath = process.env.STORAGE_PATH ||
      require('path').join(__dirname, '../backend/storage/repos');
    const repoDir = require('path').join(storagePath, REPO);
    if (fs.existsSync(repoDir)) {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }
  } catch { /* cleanup failure is non-fatal */ }

  console.log(`\ntree.test.js: ${passedCount} passed, ${failedCount} failed`);
  return { passedCount, failedCount };
}

module.exports = { run };
