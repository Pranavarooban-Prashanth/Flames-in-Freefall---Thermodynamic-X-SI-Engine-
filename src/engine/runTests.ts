import { runEngineSelfTests } from './selfTest';

const tests = runEngineSelfTests();
let failed = 0;

for (const t of tests) {
  const icon = t.passed ? 'PASS' : 'FAIL';
  console.log(`[${icon}] (${t.category}) ${t.name}`);
  console.log(`       ${t.details}`);
  if (!t.passed) failed++;
}

if (failed > 0) {
  console.error(`\n${failed} self-test(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${tests.length} SI Engine self-tests passed.`);
