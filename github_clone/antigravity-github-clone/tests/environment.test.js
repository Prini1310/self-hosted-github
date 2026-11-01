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

async function run() {
  passedCount = 0;
  failedCount = 0;
  console.log("Starting environment.test.js...");

  let token = null;
  try {
    token = await getAuthToken();
  } catch (err) {
    console.log("❌ Auth failed during setup:", err.message);
    return { passedCount: 0, failedCount: 1 };
  }

  const repoName = `test-repo-env-${Date.now()}`;

  // SETUP: Init repo
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/init`, {}, token);
    await assert(res.status === 201, `Setup - Init repo: Expected 201, got ${res.status}`);
  } catch (e) {
    console.log("❌ Setup failed:", e.message);
    return { passedCount: 0, failedCount: 1 };
  }

  // TEST 1 — List default seeded environments
  try {
    const res = await httpRequest('GET', `/api/repos/${repoName}/environments`, null, token);
    await assert(res.status === 200, `TEST 1 - List environments: Expected 200, got ${res.status}`);
    await assert(res.data && res.data.success === true, "TEST 1 - List environments: Expected success field");
    await assert(Array.isArray(res.data.environments), "TEST 1 - List environments: Expected environments array");
    await assert(res.data.environments.length === 4, `TEST 1 - List environments: Expected 4 seeded environments, got ${res.data.environments.length}`);
    
    const names = res.data.environments.map(e => e.name);
    await assert(names.includes('development'), "TEST 1 - development env seeded");
    await assert(names.includes('staging'), "TEST 1 - staging env seeded");
    await assert(names.includes('QA'), "TEST 1 - QA env seeded");
    await assert(names.includes('production'), "TEST 1 - production env seeded");

    passedCount++;
    console.log("✅ TEST 1 - List default seeded environments passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 2 — Create a new custom environment
  try {
    const payload = {
      name: 'qa-test',
      description: 'Custom QA testing',
      nodeEnv: 'testing',
      buildCommandOverride: 'echo "Custom build"',
      envVars: {
        MY_VAR: 'val123',
        PORT: '8080'
      }
    };
    const res = await httpRequest('POST', `/api/repos/${repoName}/environments`, payload, token);
    await assert(res.status === 201, `TEST 2 - Create environment: Expected 201, got ${res.status}`);
    await assert(res.data.environment, "TEST 2 - Expected environment object");
    await assert(res.data.environment.name === 'qa-test', `TEST 2 - Created env name: Expected 'qa-test', got '${res.data.environment.name}'`);
    await assert(res.data.environment.nodeEnv === 'testing', `TEST 2 - Created env nodeEnv: Expected 'testing', got '${res.data.environment.nodeEnv}'`);
    await assert(res.data.environment.envVars.MY_VAR === 'val123', `TEST 2 - Created envVars: Expected MY_VAR='val123'`);

    passedCount++;
    console.log("✅ TEST 2 - Create new environment passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 3 — Get single environment config
  try {
    const res = await httpRequest('GET', `/api/repos/${repoName}/environments/qa-test`, null, token);
    await assert(res.status === 200, `TEST 3 - Get environment: Expected 200, got ${res.status}`);
    await assert(res.data.environment, "TEST 3 - Expected environment object");
    await assert(res.data.environment.name === 'qa-test', `TEST 3 - Name: Expected 'qa-test'`);
    await assert(res.data.environment.description === 'Custom QA testing', `TEST 3 - Description mismatch`);
    await assert(res.data.environment.buildCommandOverride === 'echo "Custom build"', `TEST 3 - Build command mismatch`);

    passedCount++;
    console.log("✅ TEST 3 - Get environment config passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 4 — Update environment config
  try {
    const payload = {
      description: 'Updated QA testing desc',
      nodeEnv: 'staging',
      buildCommandOverride: 'echo "Updated build"',
      envVars: {
        MY_VAR: 'val456',
        NEW_VAR: 'hello'
      }
    };
    const res = await httpRequest('PATCH', `/api/repos/${repoName}/environments/qa-test`, payload, token);
    await assert(res.status === 200, `TEST 4 - Update environment: Expected 200, got ${res.status}`);
    
    // Fetch and check
    const checkRes = await httpRequest('GET', `/api/repos/${repoName}/environments/qa-test`, null, token);
    await assert(checkRes.status === 200, `TEST 4 - Get updated environment failed`);
    await assert(checkRes.data.environment, "TEST 4 - Expected environment object");
    await assert(checkRes.data.environment.description === 'Updated QA testing desc', `TEST 4 - Updated description mismatch`);
    await assert(checkRes.data.environment.nodeEnv === 'staging', `TEST 4 - Updated nodeEnv mismatch`);
    await assert(checkRes.data.environment.envVars.MY_VAR === 'val456', `TEST 4 - Updated envVars MY_VAR mismatch`);
    await assert(checkRes.data.environment.envVars.NEW_VAR === 'hello', `TEST 4 - Updated envVars NEW_VAR mismatch`);

    passedCount++;
    console.log("✅ TEST 4 - Update environment config passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 5 — Production build guardrail (without confirmation)
  try {
    // Should get 403 Forbidden directly
    const res = await httpRequest('GET', `/api/repos/${repoName}/builds/trigger?branch=main&environment=production`, null, token);
    await assert(res.status === 403, `TEST 5 - Prod guardrail: Expected 403, got ${res.status}`);
    await assert(res.data.error && res.data.error.includes('confirmProduction'), `TEST 5 - Error message mismatch: ${JSON.stringify(res.data)}`);

    passedCount++;
    console.log("✅ TEST 5 - Production build guardrail (without confirmation) passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 6 — Production build trigger (with confirmation)
  try {
    // We expect SSE connection to be established (starts with 200)
    // Note: SSE triggers a build process in the background. Since we just check status 200 on initial connection:
    const url = `/api/repos/${repoName}/builds/trigger?branch=main&environment=production&confirmProduction=true&lang=python&token=${token}`;
    
    const connPromise = new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: url,
        method: 'GET',
        headers: { 'Accept': 'text/event-stream' }
      };
      const req = http.get(options, (res) => {
        resolve({ status: res.statusCode });
        res.destroy(); // quickly close
      });
      req.on('error', reject);
    });

    const res = await connPromise;
    await assert(res.status === 200, `TEST 6 - Prod trigger: Expected 200, got ${res.status}`);

    passedCount++;
    console.log("✅ TEST 6 - Production build trigger (with confirmation) passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 7 — Activity logs contains environment information
  try {
    const res = await httpRequest('GET', `/api/repos/${repoName}/activity`, null, token);
    await assert(res.status === 200, `TEST 7 - Get activity: Expected 200, got ${res.status}`);
    await assert(Array.isArray(res.data.activity), `TEST 7 - Expected activity array`);
    
    // Find the build activity we just ran
    const buildAct = res.data.activity.find(a => a.action === 'build');
    await assert(!!buildAct, `TEST 7 - Build action not found in activity log`);
    await assert(buildAct.environment === 'production', `TEST 7 - Environment mismatch: Expected 'production', got '${buildAct.environment}'`);

    passedCount++;
    console.log("✅ TEST 7 - Environment info in activity logs passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 8 — Delete environment
  try {
    const res = await httpRequest('DELETE', `/api/repos/${repoName}/environments/qa-test`, null, token);
    await assert(res.status === 200, `TEST 8 - Delete environment: Expected 200, got ${res.status}`);

    // Verify it is gone
    const checkRes = await httpRequest('GET', `/api/repos/${repoName}/environments/qa-test`, null, token);
    await assert(checkRes.status === 404, `TEST 8 - Verify delete: Expected 404, got ${checkRes.status}`);

    passedCount++;
    console.log("✅ TEST 8 - Delete environment passed");
  } catch (e) {
    console.log(e.message);
  }

  // CLEANUP: remove repo dir
  try {
    const p = path.join(__dirname, '../backend/storage/repos', repoName);
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true });
    }
  } catch (err) {}

  console.log(`\nEnvironment test suite complete. Passed: ${passedCount}, Failed: ${failedCount}`);
  return { passedCount, failedCount };
}

module.exports = { run };
