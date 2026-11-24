const { execFileSync } = require('node:child_process');

const [base] = process.argv.slice(2);
if (!base) {
  console.error('Usage: node scripts/check-test-changes.js <base-ref>');
  process.exit(2);
}

const stats = execFileSync(
  'git',
  [
    'diff',
    '--numstat',
    '-z',
    '--find-renames',
    '--text',
    `${base}...HEAD`,
    '--',
    '*.spec.ts',
    '*.int-spec.ts',
    '*.test.tsx',
    'apps/frontend/e2e/',
  ],
  { encoding: 'utf8' },
);

const records = stats.split('\0').slice(0, -1);
const offenders = [];
for (let index = 0; index < records.length; index++) {
  const [, deleted, path] = records[index].match(/^\d+\t(\d+)\t([\s\S]*)$/);
  // With -z, renames have an empty path field followed by two NUL-terminated paths.
  const paths = path ? [path] : [records[++index], records[++index]];
  if (Number(deleted) > 0) {
    offenders.push(paths.map((name) => JSON.stringify(name)).join(' -> '));
  }
}

if (offenders.length) {
  console.error('Test files with deleted or rewritten lines:');
  for (const path of offenders) console.error(`  ${path}`);
  process.exitCode = 1;
} else {
  console.log('No test lines were deleted or rewritten.');
}
