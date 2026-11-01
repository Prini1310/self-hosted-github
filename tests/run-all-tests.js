const repoTest = require('./repo.test');
const branchTest = require('./branch.test');
const lockTest = require('./lock.test');
const buildTest = require('./build.test');
const e2eTest = require('./e2e.test');
const activityPRTest = require('./activity-pr.test');
const environmentTest = require('./environment.test');
const treeTest = require('./tree.test');

async function runAll() {
  let totalPassed = 0;
  let totalFailed = 0;

  const testSuites = [
    { name: 'repo.test.js', run: repoTest.run },
    { name: 'branch.test.js', run: branchTest.run },
    { name: 'lock.test.js', run: lockTest.run },
    { name: 'build.test.js', run: buildTest.run },
    { name: 'e2e.test.js', run: e2eTest.run },
    { name: 'activity-pr.test.js', run: activityPRTest.run },
    { name: 'environment.test.js', run: environmentTest.run },
    { name: 'tree.test.js',        run: treeTest.run },
  ];

  for (const suite of testSuites) {
    console.log(`\n=== Running: ${suite.name} ===`);
    try {
      const result = await suite.run();
      totalPassed += result.passedCount;
      totalFailed += result.failedCount;
    } catch (err) {
      console.error(`Suite ${suite.name} crashed:`, err);
      totalFailed += 1;
    }
  }

  console.log("\n================================");
  console.log("ALL TESTS COMPLETE");
  console.log(`Total Passed: ${totalPassed}`);
  console.log(`Total Failed: ${totalFailed}`);
  console.log("================================");

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
