const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.env.CI === 'true' || process.env.CI === '1') {
  process.exit(0);
}

const repoRoot = process.cwd();
const gitDir = path.join(repoRoot, '.git');
const hooksPath = path.join(repoRoot, '.githooks');

if (!fs.existsSync(gitDir) || !fs.existsSync(hooksPath)) {
  process.exit(0);
}

let currentHooksPath = '';
try {
  currentHooksPath = execSync('git config core.hooksPath', { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();
} catch {
  currentHooksPath = '';
}

if (currentHooksPath && currentHooksPath !== '.githooks') {
  process.exit(0);
}

try {
  execSync('git config core.hooksPath .githooks', { stdio: 'ignore' });
} catch {
  process.exit(0);
}
