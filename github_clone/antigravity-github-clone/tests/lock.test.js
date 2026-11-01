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
  console.log("Starting lock.test.js...");

  let token = null;
  try {
    token = await getAuthToken();
  } catch (err) {
    console.log("❌ Auth failed during setup:", err.message);
    return { passedCount: 0, failedCount: 1 };
  }

  const repoName = `lock-test-${Date.now()}`;
  await httpRequest('POST', `/api/repos/${repoName}/init`, {});

  let lockId = null;

  // TEST 1 — Lock a file
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/locks`, {
      filepath: 'src/main.js',
      lockedBy: 'alice',
      ttlMinutes: 30
    }, token);
    await assert(res.status === 201, `TEST 1 - Lock file: Expected 201, got ${res.status}`);
    await assert(res.data.lockId !== undefined, `TEST 1 - lockId missing`);
    await assert(new Date(res.data.expiresAt) > new Date(), `TEST 1 - expiresAt not in the future`);
    lockId = res.data.lockId;
    passedCount++;
    console.log("✅ TEST 1 - Lock file passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 2 — Lock same file (conflict)
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/locks`, {
      filepath: 'src/main.js',
      lockedBy: 'bob',
      ttlMinutes: 30
    }, token);
    await assert(res.status === 409, `TEST 2 - Lock conflict: Expected 409, got ${res.status}`);
    await assert(res.data.lock && res.data.lock.lockedBy === 'alice', `TEST 2 - Lock owner mismatch, expected alice`);
    passedCount++;
    console.log("✅ TEST 2 - Lock conflict passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 3 — Check file status (locked)
  try {
    const res = await httpRequest('GET', `/api/repos/${repoName}/locks/file?filepath=src/main.js`, null, token);
    await assert(res.status === 200, `TEST 3 - Check lock: Expected 200, got ${res.status}`);
    await assert(res.data.lock !== null, `TEST 3 - Lock should not be null`);
    await assert(res.data.lock.lockedBy === 'alice', `TEST 3 - Lock owner mismatch, expected alice`);
    passedCount++;
    console.log("✅ TEST 3 - Check file status (locked) passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 4 — List active locks
  try {
    const res = await httpRequest('GET', `/api/repos/${repoName}/locks`, null, token);
    await assert(res.status === 200, `TEST 4 - List locks: Expected 200, got ${res.status}`);
    await assert(res.data.locks && res.data.locks.length >= 1, `TEST 4 - Locks list empty`);
    await assert(res.data.locks.some(l => l.filepath === 'src/main.js'), `TEST 4 - Our lock missing from list`);
    passedCount++;
    console.log("✅ TEST 4 - List active locks passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 5 — Release with wrong lockId
  try {
    const res = await httpRequest('DELETE', `/api/repos/${repoName}/locks`, {
      filepath: 'src/main.js',
      lockId: 'wrong-id',
      requestedBy: 'alice'
    }, token);
    await assert(res.status === 403, `TEST 5 - Release wrong lockId: Expected 403, got ${res.status}`);
    passedCount++;
    console.log("✅ TEST 5 - Release with wrong lockId passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 6 — Release with correct lockId
  try {
    const res = await httpRequest('DELETE', `/api/repos/${repoName}/locks`, {
      filepath: 'src/main.js',
      lockId,
      requestedBy: 'alice'
    }, token);
    await assert(res.status === 200, `TEST 6 - Release lock: Expected 200, got ${res.status}`);
    await assert(res.data.released === true, `TEST 6 - lock released status is false`);
    passedCount++;
    console.log("✅ TEST 6 - Release with correct lockId passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 7 — Check file status after release (available)
  try {
    const res = await httpRequest('GET', `/api/repos/${repoName}/locks/file?filepath=src/main.js`, null, token);
    await assert(res.status === 200, `TEST 7 - Check lock: Expected 200, got ${res.status}`);
    await assert(res.data.lock === null, `TEST 7 - Lock should be null`);
    passedCount++;
    console.log("✅ TEST 7 - Check file status (available) passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 8 — Lock same file again after release
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/locks`, {
      filepath: 'src/main.js',
      lockedBy: 'bob',
      ttlMinutes: 30
    }, token);
    await assert(res.status === 201, `TEST 8 - Relock: Expected 201, got ${res.status}`);
    passedCount++;
    console.log("✅ TEST 8 - Lock same file again passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 9 — Force release
  try {
    await httpRequest('POST', `/api/repos/${repoName}/locks`, {
      filepath: 'src/config.js',
      lockedBy: 'bob',
      ttlMinutes: 30
    }, token);
    const res = await httpRequest('DELETE', `/api/repos/${repoName}/locks/force`, {
      filepath: 'src/config.js'
    }, token);
    await assert(res.status === 200, `TEST 9 - Force release: Expected 200, got ${res.status}`);
    await assert(res.data.released === true, `TEST 9 - force released status is false`);
    passedCount++;
    console.log("✅ TEST 9 - Force release passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 10 — Force release non-existent lock
  try {
    const res = await httpRequest('DELETE', `/api/repos/${repoName}/locks/force`, {
      filepath: 'src/nonexistent.js'
    }, token);
    await assert(res.status === 404, `TEST 10 - Force release non-existent: Expected 404, got ${res.status}`);
    passedCount++;
    console.log("✅ TEST 10 - Force release non-existent passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 11 — Lock with invalid ttlMinutes (too high)
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/locks`, {
      filepath: 'x.js',
      lockedBy: 'dev',
      ttlMinutes: 9999
    }, token);
    await assert(res.status === 400, `TEST 11 - Invalid TTL: Expected 400, got ${res.status}`);
    passedCount++;
    console.log("✅ TEST 11 - Invalid TTL rejected passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 12 — Lock with path traversal attempt
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/locks`, {
      filepath: '../../../etc/passwd',
      lockedBy: 'hacker',
      ttlMinutes: 30
    }, token);
    await assert(res.status === 400, `TEST 12 - Path traversal: Expected 400, got ${res.status}`);
    passedCount++;
    console.log("✅ TEST 12 - Path traversal rejected passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 13 — Concurrent lock attempts (stress)
  try {
    const stressRepo = `lock-stress-${Date.now()}`;
    await httpRequest('POST', `/api/repos/${stressRepo}/init`, {});

    const users = ['user1', 'user2', 'user3', 'user4', 'user5'];
    const requests = users.map(user => 
      httpRequest('POST', `/api/repos/${stressRepo}/locks`, {
        filepath: 'src/shared.js',
        lockedBy: user,
        ttlMinutes: 30
      }, token)
    );

    const responses = await Promise.all(requests);
    let successCount = 0;
    let conflictCount = 0;

    for (const r of responses) {
      if (r.status === 201) successCount++;
      else if (r.status === 409) conflictCount++;
    }

    await assert(successCount === 1, `TEST 13 - Stress: Expected 1 success lock, got ${successCount}`);
    await assert(conflictCount === 4, `TEST 13 - Stress: Expected 4 conflicts, got ${conflictCount}`);
    passedCount++;
    console.log("✅ TEST 13 - Concurrent lock stress passed");
  } catch (e) {
    console.log(e.message);
  }

  console.log(`lock.test.js results: Passed: ${passedCount}, Failed: ${failedCount}\n`);
  return { passedCount, failedCount };
}

if (require.main === module) {
  run().then((res) => {
    process.exit(res.failedCount > 0 ? 1 : 0);
  });
}

module.exports = { run };
