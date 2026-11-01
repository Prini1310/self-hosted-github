const http = require('http');
const fs = require('fs');
const path = require('path');

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
  console.log("Starting build.test.js...");

  let token = null;
  try {
    token = await getAuthToken();
  } catch (err) {
    console.log("❌ Auth failed during setup:", err.message);
    return { passedCount: 0, failedCount: 1 };
  }

  const repoName = `build-test-${Date.now()}`;
  await httpRequest('POST', `/api/repos/${repoName}/init`, {});

  // TEST 1 — List builds on empty repo
  try {
    const res = await httpRequest('GET', `/api/repos/${repoName}/builds`, null, token);
    await assert(res.status === 200, `TEST 1 - List builds empty: Expected 200, got ${res.status}`);
    await assert(res.data.builds && res.data.builds.length === 0, `TEST 1 - Builds count: Expected 0, got ${res.data.builds ? res.data.builds.length : 'null'}`);
    passedCount++;
    console.log("✅ TEST 1 - List builds on empty repo passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 2 — Seed Maven workspace
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/builds/seed`, {}, token);
    await assert(res.status === 200, `TEST 2 - Seed workspace: Expected 200, got ${res.status}`);
    passedCount++;
    console.log("✅ TEST 2 - Seed Maven workspace passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 3 — Get build before triggering (not found)
  try {
    const res = await httpRequest('GET', `/api/repos/${repoName}/builds/nonexistent-build-id`, null, token);
    await assert(res.status === 404, `TEST 3 - Get invalid build: Expected 404, got ${res.status}`);
    passedCount++;
    console.log("✅ TEST 3 - Get invalid build not found passed");
  } catch (e) {
    console.log(e.message);
  }

  // Add dummy commit to main branch so build can be run
  try {
    await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'pom.xml', content: '<project></project>' }, token);
    await httpRequest('POST', `/api/repos/${repoName}/commit`, { author: 'Alice', message: 'add build file' }, token);
  } catch (err) {
    console.log("❌ Setup build commit failed:", err.message);
    process.exit(1);
  }

  let triggeredBuildId = null;
  let doneEventReceived = false;

  // TEST 4 — Trigger Java build and wait for completion
  try {
    await listenSSE(repoName, 'lang=java&branch=main', token, (event, data) => {
      if (event === 'start') {
        triggeredBuildId = data.buildId;
      }
      if (event === 'done') {
        doneEventReceived = true;
        assert(data.status === 'success' || data.status === 'failed', `TEST 4 - Done status: Expected success/failed, got ${data.status}`);
      }
    });

    await assert(doneEventReceived === true, `TEST 4 - Done event was not received`);
    await assert(triggeredBuildId !== null, `TEST 4 - Build ID was not set from start event`);
    passedCount++;
    console.log("✅ TEST 4 - Trigger build and wait passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 5 — Get build record after completion
  try {
    const res = await httpRequest('GET', `/api/repos/${repoName}/builds/${triggeredBuildId}`, null, token);
    await assert(res.status === 200, `TEST 5 - Get build: Expected 200, got ${res.status}`);
    await assert(res.data.status !== 'running', `TEST 5 - Build status should not be running`);
    await assert(res.data.logs && res.data.logs.length > 0, `TEST 5 - Build logs should not be empty`);
    await assert(res.data.finishedAt !== null, `TEST 5 - finishedAt should not be null`);
    passedCount++;
    console.log("✅ TEST 5 - Get build record after completion passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 6 — List builds shows completed build
  try {
    const res = await httpRequest('GET', `/api/repos/${repoName}/builds`, null, token);
    await assert(res.status === 200, `TEST 6 - List builds post-run: Expected 200, got ${res.status}`);
    await assert(res.data.builds && res.data.builds.length >= 1, `TEST 6 - Builds list size: Expected >= 1, got ${res.data.builds ? res.data.builds.length : 'null'}`);
    await assert(res.data.builds[0].status !== 'running', `TEST 6 - First build status should not be running`);
    passedCount++;
    console.log("✅ TEST 6 - List builds shows completed build passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 7 — Stuck build recovery
  try {
    const storageRoot = process.env.STORAGE_PATH || path.join(__dirname, '../storage/repos');
    const stuckBuildId = 'stuck-test-' + Date.now();
    const buildsDir = path.join(storageRoot, repoName, 'builds');

    if (!fs.existsSync(buildsDir)) {
      fs.mkdirSync(buildsDir, { recursive: true });
    }

    const record = {
      buildId: stuckBuildId,
      status: 'running',
      startedAt: new Date(Date.now() - 120000).toISOString(),
      finishedAt: null,
      exitCode: null,
      logs: ['Initial log']
    };
    const buildPath = path.join(buildsDir, `${stuckBuildId}.json`);
    fs.writeFileSync(buildPath, JSON.stringify(record, null, 2), 'utf8');

    const resRecover = await httpRequest('POST', `/api/repos/${repoName}/builds/recover`, {}, token);
    await assert(resRecover.status === 200, `TEST 7 - Call recover: Expected 200, got ${resRecover.status}`);
    await assert(resRecover.data.recovered >= 1, `TEST 7 - Recover count: Expected >= 1, got ${resRecover.data.recovered}`);

    const updatedRecord = JSON.parse(fs.readFileSync(buildPath, 'utf8'));
    await assert(updatedRecord.status === 'failed', `TEST 7 - Recovered status: Expected failed, got ${updatedRecord.status}`);
    await assert(updatedRecord.logs.some(l => l.includes('BUILD INTERRUPTED')), `TEST 7 - Recovered logs did not mention BUILD INTERRUPTED`);
    passedCount++;
    console.log("✅ TEST 7 - Stuck build recovery passed");
  } catch (e) {
    console.log(e.message);
  }

  console.log(`build.test.js results: Passed: ${passedCount}, Failed: ${failedCount}\n`);
  return { passedCount, failedCount };
}

if (require.main === module) {
  run().then((res) => {
    process.exit(res.failedCount > 0 ? 1 : 0);
  });
}

module.exports = { run };
