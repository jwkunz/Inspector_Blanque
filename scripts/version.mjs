#!/usr/bin/env node
// The project's version lives in one file, VERSION, at the repository root.
//   - the web build reads it to name its single-file release (web/scripts/build_release.sh);
//   - the Android build reads it directly (versionName, and versionCode = major*10000 + minor*100 + patch).
//
//   node scripts/version.mjs                 print the version
//   node scripts/version.mjs set 4.5.0       change the version
//   node scripts/version.mjs check [tag]     fail if anything disagrees (and if `tag`, e.g. v4.5.0, is not this version)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const SEMVER = /^\d+\.\d+\.\d+$/;

export const currentVersion = () => read('VERSION').trim();

function mismatches() {
  const bad = [];
  if (!/rootProject\.file\("\.\.\/VERSION"\)/.test(read('Android/app/build.gradle.kts'))) bad.push('Android/app/build.gradle.kts does not read VERSION');
  if (!/VERSION/.test(read('web/scripts/build_release.sh'))) bad.push('web/scripts/build_release.sh does not read VERSION');
  return bad;
}

const [cmd, arg] = process.argv.slice(2);
if (!cmd) {
  console.log(currentVersion());
} else if (cmd === 'set') {
  if (!SEMVER.test(arg || '')) { console.error('Usage: node scripts/version.mjs set MAJOR.MINOR.PATCH'); process.exit(2); }
  writeFileSync(join(root, 'VERSION'), `${arg}\n`);
  console.log(`Version is now ${arg}.`);
} else if (cmd === 'check') {
  const v = currentVersion();
  const problems = SEMVER.test(v) ? mismatches() : [`VERSION is "${v}", expected MAJOR.MINOR.PATCH`];
  if (arg && arg !== `v${v}`) problems.push(`the tag ${arg} does not match VERSION ${v} (expected v${v})`);
  if (problems.length) { console.error(`Version problems:\n  - ${problems.join('\n  - ')}`); process.exit(1); }
  console.log(`All version files agree: ${v}${arg ? ` (tag ${arg})` : ''}`);
} else {
  console.error('Usage: node scripts/version.mjs [set X.Y.Z | check [tag]]'); process.exit(2);
}
