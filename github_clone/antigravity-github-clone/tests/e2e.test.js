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

function listenSSE(repoName, queryParams, token, onEvent, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/repos/${repoName}/builds/trigger?${queryParams}`,
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream'
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for SSE events after ${timeoutMs}ms`));
    }, timeoutMs);

    const req = http.get(options, (res) => {
      if (res.statusCode !== 200) {
        clearTimeout(timer);
        reject(new Error(`SSE trigger returned status ${res.statusCode}`));
        return;
      }

      let currentEvent = null;
      let buffer = '';

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        buffer += chunk;
        let lines = buffer.split('\n');
        buffer = lines.pop(); // keep last partial line

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim();
          } else if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice(5).trim();
            let data = {};
            try {
              data = JSON.parse(dataStr);
            } catch (err) {
              data = { raw: dataStr };
            }
            onEvent(currentEvent, data);
            
            if (currentEvent === 'done') {
              clearTimeout(timer);
              res.destroy();
              resolve();
              return;
            }
          } else if (trimmed === '') {
            currentEvent = null;
          }
        }
      });

      res.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      res.on('end', () => {
        clearTimeout(timer);
        resolve();
      });
    });

    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function run() {
  passedCount = 0;
  failedCount = 0;
  console.log("Starting e2e.test.js...");

  let token = null;
  const repoName = `e2e-test-${Date.now()}`;
  let lockId = null;

  // STEP 1 — Login
  try {
    const res = await httpRequest('POST', '/api/auth/login', {
      username: 'prabhaharan',
      password: 'admin123'
    });
    await assert(res.status === 200, `STEP 1 - Login: Expected 200, got ${res.status}`);
    await assert(res.data.token !== undefined, `STEP 1 - Login: Token not returned`);
    token = res.data.token;
    passedCount++;
    console.log("✅ STEP 1 - Login passed");
  } catch (e) {
    console.log(e.message);
  }

  // STEP 2 — Create repo
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/init`, {});
    await assert(res.status === 201, `STEP 2 - Create repo: Expected 201, got ${res.status}`);
    passedCount++;
    console.log("✅ STEP 2 - Create repo passed");
  } catch (e) {
    console.log(e.message);
  }

  // STEP 3 — Add multiple files
  try {
    const r1 = await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'src/Main.java', content: 'public class Main {}' }, token);
    const r2 = await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'src/Utils.java', content: 'public class Utils {}' }, token);
    const r3 = await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'README.md', content: '# E2E Test Repo' }, token);
    await assert(r1.status === 200 && r2.status === 200 && r3.status === 200, `STEP 3 - Add files: Expected all 200, got ${r1.status}, ${r2.status}, ${r3.status}`);
    passedCount++;
    console.log("✅ STEP 3 - Add multiple files passed");
  } catch (e) {
    console.log(e.message);
  }

  // STEP 4 — Commit
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/commit`, { author: 'prabhaharan', message: 'initial commit' }, token);
    await assert(res.status === 201, `STEP 4 - Commit: Expected 201, got ${res.status}`);
    await assert(res.data.commitHash !== undefined, `STEP 4 - Commit: hash missing`);
    passedCount++;
    console.log("✅ STEP 4 - Commit passed");
  } catch (e) {
    console.log(e.message);
  }

  // STEP 5 — Create and switch branch
  try {
    const r1 = await httpRequest('POST', `/api/repos/${repoName}/branches`, { branchName: 'feature/e2e-test' }, token);
    const r2 = await httpRequest('POST', `/api/repos/${repoName}/branches/switch`, { branchName: 'feature/e2e-test' }, token);
    await assert(r1.status === 201, `STEP 5 - Create branch: Expected 201, got ${r1.status}`);
    await assert(r2.status === 200, `STEP 5 - Switch branch: Expected 200, got ${r2.status}`);
    passedCount++;
    console.log("✅ STEP 5 - Create and switch branch passed");
  } catch (e) {
    console.log(e.message);
  }

  // STEP 6 — Add file on feature branch
  try {
    const r1 = await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'src/Feature.java', content: 'public class Feature {}' }, token);
    const r2 = await httpRequest('POST', `/api/repos/${repoName}/commit`, { author: 'prabhaharan', message: 'add feature' }, token);
    await assert(r1.status === 200, `STEP 6 - Add feature: Expected 200, got ${r1.status}`);
    await assert(r2.status === 201, `STEP 6 - Commit feature: Expected 201, got ${r2.status}`);
    passedCount++;
    console.log("✅ STEP 6 - Add file on feature branch passed");
  } catch (e) {
    console.log(e.message);
  }

  // STEP 7 — Lock a file
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/locks`, {
      filepath: 'src/Main.java',
      lockedBy: 'prabhaharan',
      ttlMinutes: 15
    }, token);
    await assert(res.status === 201, `STEP 7 - Lock Main: Expected 201, got ${res.status}`);
    await assert(res.data.lockId !== undefined, `STEP 7 - lockId missing`);
    lockId = res.data.lockId;
    passedCount++;
    console.log("✅ STEP 7 - Lock a file passed");
  } catch (e) {
    console.log(e.message);
  }

  // STEP 8 — Try to lock same file as another user
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/locks`, {
      filepath: 'src/Main.java',
      lockedBy: 'friend',
      ttlMinutes: 15
    }, token);
    await assert(res.status === 409, `STEP 8 - Duplicate lock: Expected 409, got ${res.status}`);
    passedCount++;
    console.log("✅ STEP 8 - Try to lock same file passed");
  } catch (e) {
    console.log(e.message);
  }

  // STEP 9 — Release lock
  try {
    const res = await httpRequest('DELETE', `/api/repos/${repoName}/locks`, {
      filepath: 'src/Main.java',
      lockId,
      requestedBy: 'prabhaharan'
    }, token);
    await assert(res.status === 200, `STEP 9 - Release lock: Expected 200, got ${res.status}`);
    await assert(res.data.released === true, `STEP 9 - lock not released`);
    passedCount++;
    console.log("✅ STEP 9 - Release lock passed");
  } catch (e) {
    console.log(e.message);
  }

  // STEP 10 — Switch back to main and merge
  try {
    const r1 = await httpRequest('POST', `/api/repos/${repoName}/branches/switch`, { branchName: 'main' }, token);
    const r2 = await httpRequest('POST', `/api/repos/${repoName}/branches/merge`, { sourceBranch: 'feature/e2e-test' }, token);
    await assert(r1.status === 200, `STEP 10 - Switch back: Expected 200, got ${r1.status}`);
    await assert(r2.status === 200, `STEP 10 - Merge: Expected 200, got ${r2.status}`);
    await assert(r2.data.type === 'fast-forward' || r2.data.type === 'merged', `STEP 10 - Merge type unexpected: ${r2.data.type}`);
    passedCount++;
    console.log("✅ STEP 10 - Switch and merge passed");
  } catch (e) {
    console.log(e.message);
  }

  // STEP 11 — Seed and trigger build
  try {
    await httpRequest('POST', `/api/repos/${repoName}/builds/seed`, {}, token);
    let doneReceived = false;

    await listenSSE(repoName, 'lang=java&branch=main', token, (event, data) => {
      if (event === 'done') {
        doneReceived = true;
      }
    });

    await assert(doneReceived === true, `STEP 11 - Done event not received`);
    passedCount++;
    console.log("✅ STEP 11 - Seed and trigger build passed");
  } catch (e) {
    console.log(e.message);
  }

  // STEP 12 — Final log check
  try {
    const res = await httpRequest('GET', `/api/repos/${repoName}/log`, null, token);
    await assert(res.status === 200, `STEP 12 - Get log: Expected 200, got ${res.status}`);
    await assert(res.data.log.length >= 2, `STEP 12 - Log length: Expected >= 2, got ${res.data.log.length}`);
    passedCount++;
    console.log("✅ STEP 12 - Final log check passed");
  } catch (e) {
    console.log(e.message);
  }

  console.log(`e2e.test.js results: Passed: ${passedCount}, Failed: ${failedCount}\n`);
  return { passedCount, failedCount };
}

if (require.main === module) {
  run().then((res) => {
    process.exit(res.failedCount > 0 ? 1 : 0);
  });
}

module.exports = { run };
