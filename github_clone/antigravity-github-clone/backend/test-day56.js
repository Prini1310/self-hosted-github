'use strict';

// Day 5-6 smoke test — run with: node test-day56.js
// Starts the app on port 3098, exercises every new endpoint, then cleans up.

const app  = require('./src/app.js');
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3098;
const BASE = `http://localhost:${PORT}`;
const REPO = 'smoke-day56';
const repoDir = path.join(__dirname, 'storage/repos', REPO);

// Clean slate
if (fs.existsSync(repoDir)) fs.rmSync(repoDir, { recursive: true });

const server = http.createServer(app);

async function post(urlPath, body) {
  const r = await fetch(`${BASE}${urlPath}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  return [r.status, await r.json()];
}

async function get(urlPath) {
  const r = await fetch(`${BASE}${urlPath}`);
  return [r.status, await r.json()];
}

function assert(condition, label) {
  if (!condition) throw new Error(`Assertion failed: ${label}`);
}

server.listen(PORT, async () => {
  try {
    let s, d;

    // 1. Init
    [s, d] = await post(`/api/repos/${REPO}/init`, {});
    assert(s === 201, 'init → 201');
    console.log('[ 1 ] init:', s, d.message);

    // 1b. Double-init → 409
    [s] = await post(`/api/repos/${REPO}/init`, {});
    assert(s === 409, 'double-init → 409');
    console.log('[ 1b] double-init:', s, '(expected 409 ✓)');

    // 2. Status — empty repo
    [s, d] = await get(`/api/repos/${REPO}/status`);
    assert(s === 200 && d.head === 'none' && d.branch === 'main', 'status empty');
    console.log('[ 2 ] status (empty):', s, `head=${d.head}  branch=${d.branch}  staged=${JSON.stringify(d.staged)}`);

    // 3. Stage two files
    [s, d] = await post(`/api/repos/${REPO}/add`, { filepath: 'src/hello.js', content: "console.log('hello world');" });
    assert(s === 200, 'add hello.js → 200');
    console.log('[ 3 ] add hello.js:', s, `blobHash=${d.blobHash.slice(0, 8)}…`);

    [s, d] = await post(`/api/repos/${REPO}/add`, { filepath: 'src/index.js', content: "import './hello.js';" });
    assert(s === 200, 'add index.js → 200');
    console.log('[ 4 ] add index.js:', s, `blobHash=${d.blobHash.slice(0, 8)}…`);

    // 4. First commit
    [s, d] = await post(`/api/repos/${REPO}/commit`, { author: 'Prabhaharan', message: 'initial commit' });
    assert(s === 201 && d.parentHash === null, 'commit1 → 201, parentHash null');
    const commit1Hash = d.commitHash;
    console.log('[ 5 ] commit1:', s, `hash=${commit1Hash.slice(0, 8)}…  parent=${d.parentHash}`);

    // 5. Status after commit — index cleared, HEAD advanced
    [s, d] = await get(`/api/repos/${REPO}/status`);
    assert(s === 200 && d.head === commit1Hash && Object.keys(d.staged).length === 0, 'status after commit1');
    console.log('[ 6 ] status (post-commit1):', `head=${d.head.slice(0, 8)}…  staged=${JSON.stringify(d.staged)}`);

    // 6. Commit with empty index → 400
    [s, d] = await post(`/api/repos/${REPO}/commit`, { author: 'Prabhaharan', message: 'empty' });
    assert(s === 400, 'empty commit → 400');
    console.log('[ 7 ] empty commit:', s, d.error, '(expected 400 ✓)');

    // 7. Stage + second commit, check parent chain
    [s] = await post(`/api/repos/${REPO}/add`, { filepath: 'src/utils.js', content: 'export const add = (a, b) => a + b;' });
    assert(s === 200, 'add utils.js → 200');

    [s, d] = await post(`/api/repos/${REPO}/commit`, { author: 'Prabhaharan', message: 'add utils' });
    assert(s === 201 && d.parentHash === commit1Hash, 'commit2 → 201, parent linked');
    const commit2Hash = d.commitHash;
    console.log('[ 8 ] commit2:', s, `hash=${commit2Hash.slice(0, 8)}…  parent=${d.parentHash.slice(0, 8)}…`);

    // 8. Log — 2 entries newest-first
    [s, d] = await get(`/api/repos/${REPO}/log`);
    assert(s === 200 && d.log.length === 2, 'log → 2 entries');
    assert(d.log[0].message === 'add utils',     'log[0] is newest');
    assert(d.log[1].message === 'initial commit', 'log[1] is oldest');
    console.log('[ 9 ] log:', s, d.log.map(c => `"${c.message}"`));

    // 9. Unknown repo → 404
    [s] = await get('/api/repos/nonexistent-xyz/status');
    assert(s === 404, 'missing repo → 404');
    console.log('[10 ] missing repo:', s, '(expected 404 ✓)');

    console.log('\n✅  All Day 5–6 checks passed!');
  } catch (e) {
    console.error('\n❌  FAIL:', e.message);
    process.exitCode = 1;
  } finally {
    server.close();
    if (fs.existsSync(repoDir)) fs.rmSync(repoDir, { recursive: true });
  }
});
