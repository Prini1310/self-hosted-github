const http = require('http');
const fs = require('fs');
const path = require('path');

let passedCount = 0;
let failedCount = 0;

function cleanRepo(repoName) {
  const p = path.join(__dirname, '../backend/storage/repos', repoName);
  if (fs.existsSync(p)) {
    try {
      fs.rmSync(p, { recursive: true });
    } catch (e) {}
  }
}

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
  console.log("Starting activity-pr.test.js...");

  let token = null;
  try {
    token = await getAuthToken();
  } catch (err) {
    console.log("❌ Auth failed during setup:", err.message);
    return { passedCount: 0, failedCount: 1 };
  }

  const repoName = `act-pr-test-${Date.now()}`;
  let initialCommitHash = null;
  let secondCommitHash = null;

  // Setup repo with commits
  try {
    await httpRequest('POST', `/api/repos/${repoName}/init`, {});
    await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'README.md', content: 'initial content' }, token);
    const resCommit1 = await httpRequest('POST', `/api/repos/${repoName}/commit`, { author: 'Alice', message: 'initial commit' }, token);
    initialCommitHash = resCommit1.data.commitHash;

    await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'src/main.js', content: 'console.log("hello");' }, token);
    const resCommit2 = await httpRequest('POST', `/api/repos/${repoName}/commit`, { author: 'Alice', message: 'second commit' }, token);
    secondCommitHash = resCommit2.data.commitHash;
  } catch (err) {
    console.log("❌ Repo setup failed:", err.message);
    return { passedCount: 0, failedCount: 1 };
  }

  // -------------------------------------------------------------
  // TEST 1 — Auth protection
  // -------------------------------------------------------------
  try {
    const resPush = await httpRequest('POST', `/api/repos/${repoName}/push`, { branch: 'main', commit: secondCommitHash }, null);
    await assert(resPush.status === 401, `TEST 1 - Auth check push: Expected 401, got ${resPush.status}`);

    const resPulls = await httpRequest('GET', `/api/repos/${repoName}/pulls`, null, null);
    await assert(resPulls.status === 401, `TEST 1 - Auth check pulls: Expected 401, got ${resPulls.status}`);

    passedCount++;
    console.log("✅ TEST 1 - Auth protection passed");
  } catch (e) {
    console.log(e.message);
  }

  // -------------------------------------------------------------
  // TEST 2 — Push operation
  // -------------------------------------------------------------
  try {
    // Let's create a new branch 'dev'
    await httpRequest('POST', `/api/repos/${repoName}/branches`, { branchName: 'dev' }, token);

    // Push secondCommitHash to dev
    const resPush = await httpRequest('POST', `/api/repos/${repoName}/push`, { branch: 'dev', commit: secondCommitHash }, token);
    await assert(resPush.status === 200, `TEST 2 - Push to dev: Expected 200, got ${resPush.status}`);
    await assert(resPush.data.success === true, `TEST 2 - Success flag mismatch`);

    // Verify dev tip is updated
    const resBranch = await httpRequest('GET', `/api/repos/${repoName}/branches/dev`, null, token);
    await assert(resBranch.data.head === secondCommitHash, `TEST 2 - Branch tip dev mismatch: expected ${secondCommitHash}, got ${resBranch.data.head}`);

    passedCount++;
    console.log("✅ TEST 2 - Push operation passed");
  } catch (e) {
    console.log(e.message);
  }

  // -------------------------------------------------------------
  // TEST 3 — Pull operation
  // -------------------------------------------------------------
  try {
    // Create new branch 'dev-tracking' pointing to initialCommitHash
    await httpRequest('POST', `/api/repos/${repoName}/branches`, { branchName: 'dev-tracking' }, token);
    
    // Switch to dev-tracking (so HEAD updates when pulling)
    await httpRequest('POST', `/api/repos/${repoName}/branches/switch`, { branchName: 'dev-tracking' }, token);

    // Pull from dev (which points to secondCommitHash) into dev-tracking
    const resPull = await httpRequest('POST', `/api/repos/${repoName}/pull`, { branch: 'dev-tracking', targetBranch: 'dev' }, token);
    await assert(resPull.status === 200, `TEST 3 - Pull: Expected 200, got ${resPull.status}`);
    await assert(resPull.data.commit === secondCommitHash, `TEST 3 - Target tip mismatch: expected ${secondCommitHash}, got ${resPull.data.commit}`);

    // Verify branch tip is synced
    const resBranch = await httpRequest('GET', `/api/repos/${repoName}/branches/dev-tracking`, null, token);
    await assert(resBranch.data.head === secondCommitHash, `TEST 3 - Tip sync check failed`);

    passedCount++;
    console.log("✅ TEST 3 - Pull operation passed");
  } catch (e) {
    console.log(e.message);
  }

  // -------------------------------------------------------------
  // TEST 4 — Activity log viewer
  // -------------------------------------------------------------
  try {
    const resAct = await httpRequest('GET', `/api/repos/${repoName}/activity`, null, token);
    await assert(resAct.status === 200, `TEST 4 - Get activity: Expected 200, got ${resAct.status}`);
    await assert(Array.isArray(resAct.data.activity), `TEST 4 - Activity log is not an array`);
    
    // Should have 1 push and 1 pull activity recorded
    const pushLog = resAct.data.activity.find(a => a.action === 'push');
    const pullLog = resAct.data.activity.find(a => a.action === 'pull');

    await assert(pushLog !== undefined, `TEST 4 - Push log entry not found`);
    await assert(pushLog.branch === 'dev' && pushLog.commit === secondCommitHash, `TEST 4 - Push log details incorrect`);
    await assert(pullLog !== undefined, `TEST 4 - Pull log entry not found`);
    await assert(pullLog.branch === 'dev-tracking' && pullLog.targetBranch === 'dev', `TEST 4 - Pull log details incorrect`);

    passedCount++;
    console.log("✅ TEST 4 - Activity log viewer passed");
  } catch (e) {
    console.log(e.message);
  }

  // -------------------------------------------------------------
  // TEST 5 — PR Creation and Retrieval
  // -------------------------------------------------------------
  let prId = null;
  try {
    // Switch back to main branch
    await httpRequest('POST', `/api/repos/${repoName}/branches/switch`, { branchName: 'main' }, token);

    // Create a new branch 'feature-pr' and commit changes on it
    await httpRequest('POST', `/api/repos/${repoName}/branches`, { branchName: 'feature-pr' }, token);
    await httpRequest('POST', `/api/repos/${repoName}/branches/switch`, { branchName: 'feature-pr' }, token);
    await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'src/feat.js', content: 'const x = 1;' }, token);
    await httpRequest('POST', `/api/repos/${repoName}/commit`, { author: 'Bob', message: 'add feature files' }, token);

    // Switch back to main
    await httpRequest('POST', `/api/repos/${repoName}/branches/switch`, { branchName: 'main' }, token);

    // Create PR: feature-pr ➔ main
    const resCreate = await httpRequest('POST', `/api/repos/${repoName}/pulls`, {
      title: 'Merge feature-pr into main',
      description: 'Clean feature commits',
      fromBranch: 'feature-pr',
      toBranch: 'main'
    }, token);

    await assert(resCreate.status === 201, `TEST 5 - Create PR: Expected 201, got ${resCreate.status}`);
    await assert(resCreate.data.pr.title === 'Merge feature-pr into main', `TEST 5 - Title mismatch`);
    await assert(resCreate.data.pr.status === 'open', `TEST 5 - Status mismatch`);
    prId = resCreate.data.pr.prId;

    // Retrieve single PR
    const resGet = await httpRequest('GET', `/api/repos/${repoName}/pulls/${prId}`, null, token);
    await assert(resGet.status === 200, `TEST 5 - Retrieve PR: Expected 200, got ${resGet.status}`);
    await assert(resGet.data.pr.prId === prId, `TEST 5 - Retreived ID mismatch`);

    // List PRs
    const resList = await httpRequest('GET', `/api/repos/${repoName}/pulls`, null, token);
    await assert(resList.status === 200, `TEST 5 - List PRs: Expected 200, got ${resList.status}`);
    await assert(resList.data.pulls.length > 0, `TEST 5 - List PRs empty`);

    passedCount++;
    console.log("✅ TEST 5 - PR Creation and Retrieval passed");
  } catch (e) {
    console.log(e.message);
  }

  // -------------------------------------------------------------
  // TEST 6 — PR Update status
  // -------------------------------------------------------------
  try {
    // Close PR
    const resClose = await httpRequest('PATCH', `/api/repos/${repoName}/pulls/${prId}`, { status: 'closed' }, token);
    await assert(resClose.status === 200 && resClose.data.pr.status === 'closed', `TEST 6 - Close PR failed`);

    // Reopen PR
    const resOpen = await httpRequest('PATCH', `/api/repos/${repoName}/pulls/${prId}`, { status: 'open' }, token);
    await assert(resOpen.status === 200 && resOpen.data.pr.status === 'open', `TEST 6 - Reopen PR failed`);

    passedCount++;
    console.log("✅ TEST 6 - PR Update status passed");
  } catch (e) {
    console.log(e.message);
  }

  // -------------------------------------------------------------
  // TEST 7 — PR Merge and conflict detection
  // -------------------------------------------------------------
  try {
    // 7.1 Successful merge
    const resMerge = await httpRequest('POST', `/api/repos/${repoName}/pulls/${prId}/merge`, null, token);
    await assert(resMerge.status === 200, `TEST 7.1 - PR Merge: Expected 200, got ${resMerge.status}`);
    await assert(resMerge.data.pr.status === 'merged', `TEST 7.1 - Status is not 'merged'`);

    // Verify main branch updated to feature-pr tip or parent commit
    const resMainBranch = await httpRequest('GET', `/api/repos/${repoName}/branches/main`, null, token);
    const resFeatBranch = await httpRequest('GET', `/api/repos/${repoName}/branches/feature-pr`, null, token);
    await assert(resMainBranch.data.head === resFeatBranch.data.head, `TEST 7.1 - Tip branch mismatch after fast-forward merge`);

    // 7.2 Conflict detection
    // Make main write 'content A' in file.txt, commit
    await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'file.txt', content: 'content A' }, token);
    await httpRequest('POST', `/api/repos/${repoName}/commit`, { author: 'Alice', message: 'write content A' }, token);

    // Create branch conflict-branch from main
    await httpRequest('POST', `/api/repos/${repoName}/branches`, { branchName: 'conflict-branch' }, token);
    
    // Switch to conflict-branch, write 'content B', commit
    await httpRequest('POST', `/api/repos/${repoName}/branches/switch`, { branchName: 'conflict-branch' }, token);
    await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'file.txt', content: 'content B' }, token);
    await httpRequest('POST', `/api/repos/${repoName}/commit`, { author: 'Charlie', message: 'write content B' }, token);

    // Switch back to main, write 'content C' to file.txt, commit (diverge main)
    await httpRequest('POST', `/api/repos/${repoName}/branches/switch`, { branchName: 'main' }, token);
    await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'file.txt', content: 'content C' }, token);
    await httpRequest('POST', `/api/repos/${repoName}/commit`, { author: 'Alice', message: 'write content C' }, token);

    // Create conflict PR: conflict-branch ➔ main
    const resPRConflict = await httpRequest('POST', `/api/repos/${repoName}/pulls`, {
      title: 'Conflict PR',
      fromBranch: 'conflict-branch',
      toBranch: 'main'
    }, token);
    const prConflictId = resPRConflict.data.pr.prId;

    // Merge conflict PR -> should fail with 409
    const resMergeConflict = await httpRequest('POST', `/api/repos/${repoName}/pulls/${prConflictId}/merge`, null, token);
    await assert(resMergeConflict.status === 409, `TEST 7.2 - Merge conflict: Expected 409, got ${resMergeConflict.status}`);
    await assert(resMergeConflict.data.conflicts.includes('file.txt'), `TEST 7.2 - Conflict lists file.txt`);

    passedCount++;
    console.log("✅ TEST 7 - PR Merge and conflict detection passed");
  } catch (e) {
    console.log(e.message);
  }

  // Clean up
  cleanRepo(repoName);

  console.log(`activity-pr.test.js results: Passed: ${passedCount}, Failed: ${failedCount}\n`);
  return { passedCount, failedCount };
}

if (require.main === module) {
  run().then((res) => {
    process.exit(res.failedCount > 0 ? 1 : 0);
  });
}

module.exports = { run };
