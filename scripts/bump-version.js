const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SKIP =
	process.env.VIBECOLORS_SKIP_VERSION_BUMP === '1' ||
	process.env.SKIP_VERSION_BUMP === '1';

const isCI = process.env.CI === 'true' || process.env.CI === '1';

if (SKIP || isCI) {
	if (process.env.VERBOSE_VERSION_BUMP === '1') {
		console.log(
			SKIP
				? '[version-bump] Skipping (explicitly disabled).'
				: '[version-bump] Skipping in CI environment.'
		);
	}
	process.exit(0);
}

const repoRoot = path.resolve(__dirname, '..');

function run(cmd) {
	execSync(cmd, { cwd: repoRoot, stdio: 'inherit' });
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

console.log('[version-bump] Incrementing patch version via npm...');
run(`${npmCmd} version patch --no-git-tag-version`);

const pkgPath = path.join(repoRoot, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
console.log(`[version-bump] Package is now at v${pkg.version}.`);
