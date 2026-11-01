'use strict';

const http = require('http');

function httpRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let rawData = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        let parsedData = {};
        if (rawData) {
          try {
            parsedData = JSON.parse(rawData);
          } catch (e) {
            parsedData = { raw: rawData };
          }
        }
        resolve({
          status: res.statusCode,
          data: parsedData
        });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (body) {
      req.write(postData);
    }
    req.end();
  });
}

async function runChecks() {
  let passed = 0;
  let failed = 0;
  let token = null;
  let lockId = null;

  console.log('Starting integration checks...');

  // CHECK 1 — Auth
  try {
    const res = await httpRequest('POST', '/api/auth/login', {
      username: 'prabhaharan',
      password: 'admin123'
    });
    if (res.status === 200 && res.data.token) {
      token = res.data.token;
      passed++;
      console.log('✅ Auth — login OK');
    } else {
      failed++;
      console.log('❌ Auth — login FAILED');
    }
  } catch (err) {
    failed++;
    console.log('❌ Auth — login FAILED:', err.message);
  }

  // CHECK 2 — Init repo
  try {
    const res = await httpRequest('POST', '/api/repos/integration-test/init', {});
    if (res.status === 201 || res.status === 200) {
      passed++;
      console.log('✅ Repo init OK');
    } else {
      // Allow if repo already exists
      if (res.data && res.data.error && res.data.error.includes('already exists')) {
        passed++;
        console.log('✅ Repo init OK');
      } else {
        failed++;
        console.log('❌ Repo init FAILED (may already exist — OK)');
      }
    }
  } catch (err) {
    failed++;
    console.log('❌ Repo init FAILED (may already exist — OK):', err.message);
  }

  // CHECK 3 — Add file
  try {
    const res = await httpRequest('POST', '/api/repos/integration-test/add', {
      filepath: 'src/App.java',
      content: 'public class App {}'
    }, token);
    if (res.status === 200 && res.data.blobHash) {
      passed++;
      console.log(`✅ Add file OK — hash: ${res.data.blobHash.slice(0, 7)}`);
    } else {
      failed++;
      console.log('❌ Add file FAILED');
    }
  } catch (err) {
    failed++;
    console.log('❌ Add file FAILED:', err.message);
  }

  // CHECK 4 — Commit
  try {
    const res = await httpRequest('POST', '/api/repos/integration-test/commit', {
      author: 'prabhaharan',
      message: 'integration test commit'
    }, token);
    if (res.status === 201 && res.data.commitHash) {
      passed++;
      console.log(`✅ Commit OK — hash: ${res.data.commitHash.slice(0, 7)}`);
    } else {
      failed++;
      console.log('❌ Commit FAILED');
    }
  } catch (err) {
    failed++;
    console.log('❌ Commit FAILED:', err.message);
  }

  // CHECK 5 — Log
  try {
    const res = await httpRequest('GET', '/api/repos/integration-test/log', null, token);
    if (res.status === 200 && res.data.log && res.data.log.length >= 1) {
      passed++;
      console.log(`✅ Log OK — ${res.data.log.length} commits found`);
    } else {
      failed++;
      console.log('❌ Log FAILED');
    }
  } catch (err) {
    failed++;
    console.log('❌ Log FAILED:', err.message);
  }

  const branchName = `feature/integration-${Date.now()}`;

  // CHECK 6 — Create branch
  try {
    const res = await httpRequest('POST', '/api/repos/integration-test/branches', {
      branchName
    }, token);
    if (res.status === 201) {
      passed++;
      console.log('✅ Branch create OK');
    } else {
      failed++;
      console.log('❌ Branch create FAILED');
    }
  } catch (err) {
    failed++;
    console.log('❌ Branch create FAILED:', err.message);
  }

  // CHECK 7 — Switch branch
  try {
    const res = await httpRequest('POST', '/api/repos/integration-test/branches/switch', {
      branchName
    }, token);
    if (res.status === 200) {
      passed++;
      console.log('✅ Branch switch OK');
    } else {
      failed++;
      console.log('❌ Branch switch FAILED');
    }
  } catch (err) {
    failed++;
    console.log('❌ Branch switch FAILED:', err.message);
  }

  // CHECK 8 — Lock file
  try {
    const res = await httpRequest('POST', '/api/repos/integration-test/locks', {
      filepath: 'src/App.java',
      lockedBy: 'prabhaharan',
      ttlMinutes: 15
    }, token);
    if (res.status === 201 && res.data.lockId) {
      lockId = res.data.lockId;
      passed++;
      console.log(`✅ Lock OK — lockId: ${lockId.slice(0, 8)}`);
    } else {
      failed++;
      console.log('❌ Lock FAILED');
    }
  } catch (err) {
    failed++;
    console.log('❌ Lock FAILED:', err.message);
  }

  // CHECK 9 — Duplicate lock (conflict)
  try {
    const res = await httpRequest('POST', '/api/repos/integration-test/locks', {
      filepath: 'src/App.java',
      lockedBy: 'friend',
      ttlMinutes: 15
    }, token);
    if (res.status === 409) {
      passed++;
      console.log('✅ Lock conflict correctly rejected (409)');
    } else {
      failed++;
      console.log('❌ Duplicate lock check FAILED');
    }
  } catch (err) {
    failed++;
    console.log('❌ Duplicate lock check FAILED:', err.message);
  }

  // CHECK 10 — Release lock
  try {
    const res = await httpRequest('DELETE', '/api/repos/integration-test/locks', {
      filepath: 'src/App.java',
      lockId,
      requestedBy: 'prabhaharan'
    }, token);
    if (res.status === 200) {
      passed++;
      console.log('✅ Lock release OK');
    } else {
      failed++;
      console.log('❌ Lock release FAILED');
    }
  } catch (err) {
    failed++;
    console.log('❌ Lock release FAILED:', err.message);
  }

  // CHECK 11 — Self-merge (should fail)
  try {
    const res = await httpRequest('POST', '/api/repos/integration-test/branches/merge', {
      sourceBranch: branchName
    }, token);
    if (res.status === 400 && res.data && res.data.error && res.data.error.includes('itself')) {
      passed++;
      console.log('✅ Self-merge check correctly rejected (400)');
    } else {
      failed++;
      console.log('❌ Self-merge check FAILED, status:', res.status, res.data);
    }
  } catch (err) {
    failed++;
    console.log('❌ Self-merge check FAILED:', err.message);
  }

  // CHECK 12 — Missing fields validation (should fail)
  try {
    const res = await httpRequest('POST', '/api/repos/integration-test/add', {}, token);
    if (res.status === 400 && res.data && res.data.error && res.data.error.includes('Missing required fields')) {
      passed++;
      console.log('✅ Missing fields check correctly rejected (400)');
    } else {
      failed++;
      console.log('❌ Missing fields check FAILED, status:', res.status, res.data);
    }
  } catch (err) {
    failed++;
    console.log('❌ Missing fields check FAILED:', err.message);
  }

  console.log('===========================');
  console.log('Integration Check Complete');
  console.log(`Passed: ${passed} / 12`);
  console.log(`Failed: ${failed} / 12`);
  console.log('===========================');
}

if (require.main === module) {
  runChecks();
}
