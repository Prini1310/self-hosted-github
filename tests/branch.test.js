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
  console.log("Starting branch.test.js...");

  let token = null;
  try {
    token = await getAuthToken();
  } catch (err) {
    console.log("❌ Auth failed during setup:", err.message);
    return { passedCount: 0, failedCount: 1 };
  }

  const repoName = `branch-test-${Date.now()}`;
  let mainTipHash = null;

  // Setup repo with commits
  try {
    await httpRequest('POST', `/api/repos/${repoName}/init`, {});
    await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'README.md', content: 'initial content' }, token);
    const resCommit = await httpRequest('POST', `/api/repos/${repoName}/commit`, { author: 'Alice', message: 'initial commit' }, token);
    mainTipHash = resCommit.data.commitHash;
  } catch (err) {
    console.log("❌ Repo setup failed:", err.message);
    process.exit(1);
  }

  let featureTipHash = null;

  // TEST 1 — Create branch from repo with commits
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/branches`, { branchName: 'feature/x' }, token);
    await assert(res.status === 201, `TEST 1 - Create branch: Expected 201, got ${res.status}`);
    await assert(res.data.tipHash === mainTipHash, `TEST 1 - Tip hash mismatch: Expected ${mainTipHash}, got ${res.data.tipHash}`);
    passedCount++;
    console.log("✅ TEST 1 - Create branch from commits passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 2 — Create duplicate branch
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/branches`, { branchName: 'feature/x' }, token);
    await assert(res.status === 409, `TEST 2 - Duplicate branch: Expected 409, got ${res.status}`);
    passedCount++;
    console.log("✅ TEST 2 - Create duplicate branch passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 3 — List branches
  try {
    const res = await httpRequest('GET', `/api/repos/${repoName}/branches`, null, token);
    await assert(res.status === 200, `TEST 3 - List branches: Expected 200, got ${res.status}`);
    await assert(res.data.branchesMap && 'main' in res.data.branchesMap && 'feature/x' in res.data.branchesMap, `TEST 3 - Branch list missing branches`);
    await assert(res.data.current === 'main', `TEST 3 - Current branch: Expected 'main', got '${res.data.current}'`);
    passedCount++;
    console.log("✅ TEST 3 - List branches passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 4 — Switch to feature branch
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/branches/switch`, { branchName: 'feature/x' }, token);
    await assert(res.status === 200, `TEST 4 - Switch branch: Expected 200, got ${res.status}`);
    const resStatus = await httpRequest('GET', `/api/repos/${repoName}/status`, null, token);
    await assert(resStatus.data.branch === 'feature/x', `TEST 4 - Current branch status: Expected 'feature/x', got '${resStatus.data.branch}'`);
    passedCount++;
    console.log("✅ TEST 4 - Switch to feature branch passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 5 — Commit on feature branch
  try {
    await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'feature.js', content: 'feature code' }, token);
    const resCommit = await httpRequest('POST', `/api/repos/${repoName}/commit`, { author: 'Alice', message: 'feature commit' }, token);
    featureTipHash = resCommit.data.commitHash;

    const resLog = await httpRequest('GET', `/api/repos/${repoName}/log`, null, token);
    await assert(resLog.status === 200, `TEST 5 - Get log: Expected 200, got ${resLog.status}`);
    await assert(resLog.data.log.length === 2, `TEST 5 - Log length: Expected 2, got ${resLog.data.log.length}`);
    passedCount++;
    console.log("✅ TEST 5 - Commit on feature branch passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 6 — Switch back to main
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/branches/switch`, { branchName: 'main' }, token);
    await assert(res.status === 200, `TEST 6 - Switch branch: Expected 200, got ${res.status}`);
    const resStatus = await httpRequest('GET', `/api/repos/${repoName}/status`, null, token);
    await assert(resStatus.data.head === mainTipHash, `TEST 6 - Head tip: Expected ${mainTipHash}, got ${resStatus.data.head}`);
    passedCount++;
    console.log("✅ TEST 6 - Switch back to main passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 7 — Fast-forward merge
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/branches/merge`, { sourceBranch: 'feature/x' }, token);
    await assert(res.status === 200, `TEST 7 - Merge: Expected 200, got ${res.status}`);
    await assert(res.data.type === 'fast-forward', `TEST 7 - Merge type: Expected 'fast-forward', got '${res.data.type}'`);
    const resStatus = await httpRequest('GET', `/api/repos/${repoName}/status`, null, token);
    await assert(resStatus.data.head === featureTipHash, `TEST 7 - Head post-merge: Expected ${featureTipHash}, got ${resStatus.data.head}`);
    passedCount++;
    console.log("✅ TEST 7 - Fast-forward merge passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 8 — Already merged detection
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/branches/merge`, { sourceBranch: 'feature/x' }, token);
    await assert(res.status === 200, `TEST 8 - Merge duplicate: Expected 200, got ${res.status}`);
    await assert(res.data.type === 'already-merged', `TEST 8 - Merge type: Expected 'already-merged', got '${res.data.type}'`);
    passedCount++;
    console.log("✅ TEST 8 - Already merged detection passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 9 — Merge into itself
  try {
    const res = await httpRequest('POST', `/api/repos/${repoName}/branches/merge`, { sourceBranch: 'main' }, token);
    await assert(res.status === 400, `TEST 9 - Self merge: Expected 400, got ${res.status}`);
    passedCount++;
    console.log("✅ TEST 9 - Merge into itself passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 10 — Branch from empty repo
  try {
    const emptyRepoName = `empty-repo-${Date.now()}`;
    await httpRequest('POST', `/api/repos/${emptyRepoName}/init`, {});
    const res = await httpRequest('POST', `/api/repos/${emptyRepoName}/branches`, { branchName: 'feature/y' }, token);
    await assert(res.status === 400, `TEST 10 - Empty branch: Expected 400, got ${res.status}`);
    await assert(res.data.error === 'cannot branch from empty repo', `TEST 10 - Error: Expected 'cannot branch from empty repo', got '${res.data.error}'`);
    passedCount++;
    console.log("✅ TEST 10 - Branch from empty repo passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 11 — Switch with staged changes
  try {
    await httpRequest('POST', `/api/repos/${repoName}/add`, { filepath: 'dirty.js', content: 'dirty content' }, token);
    const res = await httpRequest('POST', `/api/repos/${repoName}/branches/switch`, { branchName: 'feature/x' }, token);
    await assert(res.status === 400, `TEST 11 - Switch dirty: Expected 400, got ${res.status}`);
    await assert(res.data.error && res.data.error.includes('staged changes'), `TEST 11 - Error missing staged changes message, got '${res.data.error}'`);
    passedCount++;
    console.log("✅ TEST 11 - Switch with staged changes passed");
  } catch (e) {
    console.log(e.message);
  }

  // Set up second repo for strategy and conflict tests to avoid dirty index from TEST 11
  const repoName2 = `branch-test-2-${Date.now()}`;
  let mainTipHash2 = null;
  try {
    await httpRequest('POST', `/api/repos/${repoName2}/init`, {});
    await httpRequest('POST', `/api/repos/${repoName2}/add`, { filepath: 'README.md', content: 'initial content' }, token);
    const resCommit = await httpRequest('POST', `/api/repos/${repoName2}/commit`, { author: 'Alice', message: 'initial commit' }, token);
    mainTipHash2 = resCommit.data.commitHash;

    // Create feature/x branch and commit to it
    await httpRequest('POST', `/api/repos/${repoName2}/branches`, { branchName: 'feature/x' }, token);
    await httpRequest('POST', `/api/repos/${repoName2}/branches/switch`, { branchName: 'feature/x' }, token);
    await httpRequest('POST', `/api/repos/${repoName2}/add`, { filepath: 'feat.js', content: 'feat code' }, token);
    await httpRequest('POST', `/api/repos/${repoName2}/commit`, { author: 'Alice', message: 'feat commit' }, token);
    await httpRequest('POST', `/api/repos/${repoName2}/branches/switch`, { branchName: 'main' }, token);
  } catch (err) {
    console.log("❌ New repo setup failed:", err.message);
  }

  // TEST 12 — Merge Status Check
  try {
    const res = await httpRequest('GET', `/api/repos/${repoName2}/branches/merge-status?source=feature/x&target=main`, null, token);
    await assert(res.status === 200, `TEST 12 - Merge status: Expected 200, got ${res.status}`);
    await assert(res.data.ableToMerge === true, `TEST 12 - Able to merge: Expected true`);
    await assert(res.data.commitsAhead >= 0, `TEST 12 - Commits ahead count invalid`);
    await assert(res.data.recommendedStrategy !== undefined, `TEST 12 - Recommended strategy missing`);
    passedCount++;
    console.log("✅ TEST 12 - Merge status check passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 13 — Squash and Merge Strategy
  try {
    // Create new branch and commit multiple times
    const squashBranch = `squash-${Date.now()}`;
    await httpRequest('POST', `/api/repos/${repoName2}/branches`, { branchName: squashBranch }, token);
    await httpRequest('POST', `/api/repos/${repoName2}/branches/switch`, { branchName: squashBranch }, token);
    
    await httpRequest('POST', `/api/repos/${repoName2}/add`, { filepath: 'sq1.js', content: 'sq 1' }, token);
    await httpRequest('POST', `/api/repos/${repoName2}/commit`, { author: 'Alice', message: 'sq commit 1' }, token);
    
    await httpRequest('POST', `/api/repos/${repoName2}/add`, { filepath: 'sq2.js', content: 'sq 2' }, token);
    await httpRequest('POST', `/api/repos/${repoName2}/commit`, { author: 'Alice', message: 'sq commit 2' }, token);

    // Switch back to main
    await httpRequest('POST', `/api/repos/${repoName2}/branches/switch`, { branchName: 'main' }, token);

    // Perform Squash and Merge
    const resMerge = await httpRequest('POST', `/api/repos/${repoName2}/branches/merge`, { sourceBranch: squashBranch, strategy: 'squash' }, token);
    await assert(resMerge.status === 200, `TEST 13 - Squash merge request: Expected 200, got ${resMerge.status}`);
    await assert(resMerge.data.strategy === 'squash', `TEST 13 - Strategy mismatch: Expected 'squash', got ${resMerge.data.strategy}`);
    await assert(resMerge.data.commitsMerged === 2, `TEST 13 - Commits merged mismatch: Expected 2, got ${resMerge.data.commitsMerged}`);

    // Retrieve squashed commit object and verify details
    const resGetCommit = await httpRequest('GET', `/api/repos/${repoName2}/branches/main`, null, token);
    const commitObj = resGetCommit.data.commit;
    
    await assert(commitObj.parentHash !== null, `TEST 13 - Squashed commit should have parent`);
    await assert(commitObj.secondaryParentHash === null || commitObj.secondaryParentHash === undefined, `TEST 13 - Squashed commit should NOT have secondary parent`);
    await assert(commitObj.message.includes('sq commit 1'), `TEST 13 - Message missing commit 1`);
    await assert(commitObj.message.includes('sq commit 2'), `TEST 13 - Message missing commit 2`);

    passedCount++;
    console.log("✅ TEST 13 - Squash and merge strategy passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 14 — Rebase and Merge Strategy
  try {
    const rebaseBranch = `rebase-${Date.now()}`;
    // Switch to rebaseBranch created from main
    await httpRequest('POST', `/api/repos/${repoName2}/branches`, { branchName: rebaseBranch }, token);
    await httpRequest('POST', `/api/repos/${repoName2}/branches/switch`, { branchName: rebaseBranch }, token);
    
    await httpRequest('POST', `/api/repos/${repoName2}/add`, { filepath: 'rb1.js', content: 'rb 1' }, token);
    await httpRequest('POST', `/api/repos/${repoName2}/commit`, { author: 'Bob', message: 'rb commit 1' }, token);
    
    await httpRequest('POST', `/api/repos/${repoName2}/add`, { filepath: 'rb2.js', content: 'rb 2' }, token);
    await httpRequest('POST', `/api/repos/${repoName2}/commit`, { author: 'Bob', message: 'rb commit 2' }, token);

    // Get original target HEAD commit hash before rebase
    const resMainBranch = await httpRequest('GET', `/api/repos/${repoName2}/branches/main`, null, token);
    const mainHeadBefore = resMainBranch.data.head;

    // Switch back to main
    await httpRequest('POST', `/api/repos/${repoName2}/branches/switch`, { branchName: 'main' }, token);

    // Perform Rebase and Merge
    const resMerge = await httpRequest('POST', `/api/repos/${repoName2}/branches/merge`, { sourceBranch: rebaseBranch, strategy: 'rebase' }, token);
    await assert(resMerge.status === 200, `TEST 14 - Rebase merge request: Expected 200, got ${resMerge.status}`);
    await assert(resMerge.data.strategy === 'rebase', `TEST 14 - Strategy mismatch: Expected 'rebase', got ${resMerge.data.strategy}`);
    await assert(resMerge.data.commitsMerged === 2, `TEST 14 - Commits merged mismatch: Expected 2, got ${resMerge.data.commitsMerged}`);

    // Verify commit replaying structure
    const resMainBranchAfter = await httpRequest('GET', `/api/repos/${repoName2}/branches/main`, null, token);
    const finalCommit = resMainBranchAfter.data.commit;

    await assert(finalCommit.message === 'rb commit 2', `TEST 14 - Replayed commit message mismatch`);
    await assert(finalCommit.author === 'Bob', `TEST 14 - Replayed author should be Bob`);
    
    // Walk back to target HEAD before rebase via direct HEAD log
    const logRes = await httpRequest('GET', `/api/repos/${repoName2}/log`, null, token);
    const replayed1 = logRes.data.log.find(c => c.message === 'rb commit 1');
    const replayed2 = logRes.data.log.find(c => c.message === 'rb commit 2');

    await assert(replayed1 !== undefined && replayed2 !== undefined, `TEST 14 - Both replayed commits should exist in history`);
    await assert(replayed2.parentHash === replayed1.hash, `TEST 14 - Replayed parent pointers should point to previous replayed commit`);
    await assert(replayed1.parentHash === mainHeadBefore, `TEST 14 - First replayed commit should point to target HEAD before rebase`);

    passedCount++;
    console.log("✅ TEST 14 - Rebase and merge strategy passed");
  } catch (e) {
    console.log(e.message);
  }

  // TEST 15 — Conflict Detection across all strategies
  try {
    // Set up conflicting branches
    const conflictBaseBranch = `conflict-base-${Date.now()}`;
    await httpRequest('POST', `/api/repos/${repoName2}/branches`, { branchName: conflictBaseBranch }, token);
    await httpRequest('POST', `/api/repos/${repoName2}/branches/switch`, { branchName: conflictBaseBranch }, token);
    await httpRequest('POST', `/api/repos/${repoName2}/add`, { filepath: 'conflict.txt', content: 'base content' }, token);
    await httpRequest('POST', `/api/repos/${repoName2}/commit`, { author: 'Alice', message: 'base conflict commit' }, token);

    // Create branch 1 from conflict base
    const conflictB1 = `conflict-b1-${Date.now()}`;
    await httpRequest('POST', `/api/repos/${repoName2}/branches`, { branchName: conflictB1 }, token);
    await httpRequest('POST', `/api/repos/${repoName2}/branches/switch`, { branchName: conflictB1 }, token);
    await httpRequest('POST', `/api/repos/${repoName2}/add`, { filepath: 'conflict.txt', content: 'b1 content' }, token);
    await httpRequest('POST', `/api/repos/${repoName2}/commit`, { author: 'Alice', message: 'b1 commit' }, token);

    // Create branch 2 from conflict base
    await httpRequest('POST', `/api/repos/${repoName2}/branches/switch`, { branchName: conflictBaseBranch }, token);
    const conflictB2 = `conflict-b2-${Date.now()}`;
    await httpRequest('POST', `/api/repos/${repoName2}/branches`, { branchName: conflictB2 }, token);
    await httpRequest('POST', `/api/repos/${repoName2}/branches/switch`, { branchName: conflictB2 }, token);
    await httpRequest('POST', `/api/repos/${repoName2}/add`, { filepath: 'conflict.txt', content: 'b2 content' }, token);
    await httpRequest('POST', `/api/repos/${repoName2}/commit`, { author: 'Bob', message: 'b2 commit' }, token);

    // Switch to b1 (target) and try merging b2 (source)
    await httpRequest('POST', `/api/repos/${repoName2}/branches/switch`, { branchName: conflictB1 }, token);

    // Check merge status
    const statusRes = await httpRequest('GET', `/api/repos/${repoName2}/branches/merge-status?source=${conflictB2}&target=${conflictB1}`, null, token);
    await assert(statusRes.status === 200, `TEST 15 - Get status error: expected 200, got ${statusRes.status}`);
    await assert(statusRes.data.ableToMerge === false, `TEST 15 - ableToMerge should be false on conflicts`);
    await assert(statusRes.data.conflicts.includes('conflict.txt'), `TEST 15 - conflicts should list conflict.txt`);

    // Test Merge strategy
    const resMerge1 = await httpRequest('POST', `/api/repos/${repoName2}/branches/merge`, { sourceBranch: conflictB2, strategy: 'merge' }, token);
    await assert(resMerge1.status === 409, `TEST 15 - Merge strategy conflict: expected 409, got ${resMerge1.status}`);

    // Test Squash strategy
    const resMerge2 = await httpRequest('POST', `/api/repos/${repoName2}/branches/merge`, { sourceBranch: conflictB2, strategy: 'squash' }, token);
    await assert(resMerge2.status === 409, `TEST 15 - Squash strategy conflict: expected 409, got ${resMerge2.status}`);

    // Test Rebase strategy
    const resMerge3 = await httpRequest('POST', `/api/repos/${repoName2}/branches/merge`, { sourceBranch: conflictB2, strategy: 'rebase' }, token);
    await assert(resMerge3.status === 409, `TEST 15 - Rebase strategy conflict: expected 409, got ${resMerge3.status}`);

    passedCount++;
    console.log("✅ TEST 15 - Conflict detection across all strategies passed");
  } catch (e) {
    console.log(e.message);
  }

  console.log(`branch.test.js results: Passed: ${passedCount}, Failed: ${failedCount}\n`);
  return { passedCount, failedCount };
}

if (require.main === module) {
  run().then((res) => {
    process.exit(res.failedCount > 0 ? 1 : 0);
  });
}

module.exports = { run };
