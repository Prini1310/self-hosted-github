const http = require('http');

let passedCount = 0;
let failedCount = 0;

async function assert(condition, message) {
  if (!condition) {
    failedCount++;
    console.log(`❌ ${message}`);
    throw new Error("FAIL: " + message);
  }
}

async function httpRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }),
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', (err) => {
      console.error('Request error:', err.message);
      reject(err);
    });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getAuthToken() {
  const res = await httpRequest(
    'POST',
    '/api/auth/login',
    { username: 'prabhaharan', password: 'admin123' }
  );
  if (res.status !== 200) {
    console.error('Auth response:', res.status, res.data);
    throw new Error('Auth failed during setup: ' + JSON.stringify(res.data));
  }
  return res.data.token;
}

async function run() {
  passedCount = 0;
  failedCount = 0;
  console.log("Starting repo.test.js...");

  let token = null;
  try {
    token = await getAuthToken();
  } catch (err) {
    console.log("❌ Auth failed during setup:", err.message);
    return { passedCount: 0, failedCount: 1 };
  }

  const repoName = `test-repo-${Date.now()}`;

  // TEST 1 — Init repo
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/init`, {});
    await assert(res.status === 201, `TEST 1 - Init repo: Expected 201, got ${res.status}`);
    passedCount++;
    console.log("✅ TEST 1 - Init repo passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 2 — Init same repo again (duplicate)
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/init`, {});
    await assert(res.status === 409, `TEST 2 - Duplicate init: Expected 409, got ${res.status}`);
    passedCount++;
    console.log("✅ TEST 2 - Duplicate init passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 3 — Add file with empty filepath
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: '', content: 'hello' }, token);
    await assert(res.status === 400, `TEST 3 - Empty filepath: Expected 400, got ${res.status}`);
    passedCount++;
    console.log("✅ TEST 3 - Empty filepath passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 4 — Add file with empty content
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'src/a.js', content: '' }, token);
    await assert(res.status === 400, `TEST 4 - Empty content: Expected 400, got ${res.status}`);
    passedCount++;
    console.log("✅ TEST 4 - Empty content passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 5 — Commit with nothing staged
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/commit`, { author: 'dev', message: 'empty' }, token);
    await assert(res.status === 400, `TEST 5 - Commit empty: Expected 400, got ${res.status}`);
    await assert(res.data.error === 'Nothing staged to commit', `TEST 5 - Commit empty message: Expected 'Nothing staged to commit', got '${res.data.error}'`);
    passedCount++;
    console.log("✅ TEST 5 - Commit empty passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 6 — Valid add + commit
  let commitHash = null;
  try {
    await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'src/a.js', content: 'content a' }, token);
    await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'src/b.js', content: 'content b' }, token);
    await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'src/c.js', content: 'content c' }, token);
    const res = await httpRequest('POST', `/api/repos/${repoName}/commit`, { author: 'dev', message: 'first commit' }, token);
    await assert(res.status === 201, `TEST 6 - Valid commit: Expected 201, got ${res.status}`);
    await assert(res.data.commitHash !== undefined, `TEST 6 - Commit hash not present`);
    commitHash = res.data.commitHash;
    passedCount++;
    console.log("✅ TEST 6 - Valid add + commit passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 7 — Log has 1 commit
  try {
    const res = await httpRequest('GET', `/api/repos/${repoName}/log`, null, token);
    await assert(res.status === 200, `TEST 7 - Get log: Expected 200, got ${res.status}`);
    await assert(res.data.log && res.data.log.length === 1, `TEST 7 - Log length: Expected 1, got ${res.data.log ? res.data.log.length : 'null'}`);
    passedCount++;
    console.log("✅ TEST 7 - Log has 1 commit passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 8 — Status after commit (nothing staged)
  try {
    const res = await httpRequest('GET', `/api/repos/${repoName}/status`, null, token);
    await assert(res.status === 200, `TEST 8 - Get status: Expected 200, got ${res.status}`);
    await assert(Object.keys(res.data.staged).length === 0, `TEST 8 - Status staged: Expected empty, got ${JSON.stringify(res.data.staged)}`);
    passedCount++;
    console.log("✅ TEST 8 - Status after commit passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 9 — Add file after commit (new staging)
  try {
    await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'src/d.js', content: 'content d' }, token);
    const res = await httpRequest('GET', `/api/repos/${repoName}/status`, null, token);
    await assert(res.status === 200, `TEST 9 - Get status: Expected 200, got ${res.status}`);
    await assert(Object.keys(res.data.staged).length === 1, `TEST 9 - Status staged: Expected 1 entry, got ${Object.keys(res.data.staged).length}`);
    passedCount++;
    console.log("✅ TEST 9 - Add file after commit passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 10 — Second commit (parent chain)
  try {
    const resCommit = await httpRequest('POST', `/api/repos/${repoName}/commit`, { author: 'dev', message: 'second commit' }, token);
    const res = await httpRequest('GET', `/api/repos/${repoName}/log`, null, token);
    await assert(res.status === 200, `TEST 10 - Get log: Expected 200, got ${res.status}`);
    await assert(res.data.log.length === 2, `TEST 10 - Log length: Expected 2, got ${res.data.log.length}`);
    await assert(res.data.log[0].parentHash === res.data.log[1].hash, `TEST 10 - Parent hash chain mismatch`);
    passedCount++;
    console.log("✅ TEST 10 - Second commit chain passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 11 — Object retrieval
  try {
    const res = await httpRequest('GET', `/api/repos/${repoName}/objects/${commitHash}`, null, token);
    await assert(res.status === 200, `TEST 11 - Get object: Expected 200, got ${res.status}`);
    await assert(res.data.type === 'commit', `TEST 11 - Object type: Expected 'commit', got '${res.data.type}'`);
    passedCount++;
    console.log("✅ TEST 11 - Object retrieval passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 12 — Object not found
  try {
    const res = await httpRequest('GET', `/api/repos/${repoName}/objects/deadbeef1234567`, null, token);
    await assert(res.status === 404, `TEST 12 - Get invalid object: Expected 404, got ${res.status}`);
    passedCount++;
    console.log("✅ TEST 12 - Object not found passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 13 — Large file handling
  try {
    const largeContent = 'a'.repeat(500000);
    const resAdd = await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'large.txt', content: largeContent }, token);
    await assert(resAdd.status === 200, `TEST 13 - Add large: Expected 200, got ${resAdd.status}`);
    const blobHash = resAdd.data.blobHash;
    await assert(blobHash !== undefined, `TEST 13 - Blob hash not returned`);

    const resGet = await httpRequest('GET', `/api/repos/${repoName}/objects/${blobHash}`, null, token);
    await assert(resGet.status === 200, `TEST 13 - Get large: Expected 200, got ${resGet.status}`);
    await assert(resGet.data.content.length === 500000, `TEST 13 - Large length: Expected 500000, got ${resGet.data.content.length}`);
    passedCount++;
    console.log("✅ TEST 13 - Large file handling passed");
  } catch (e) {
    console.log(e.message);
  }

  console.log(`repo.test.js results: Passed: ${passedCount}, Failed: ${failedCount}\n`);
  return { passedCount, failedCount };
}

if (require.main === module) {
  run().then((res) => {
    process.exit(res.failedCount > 0 ? 1 : 0);
  });
}

module.exports = { run };
