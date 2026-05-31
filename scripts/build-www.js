/**
 * build-www.js
 * Copies the ZenScreen frontend files into the www/ directory
 * that Capacitor uses as its web root for the Android APK.
 *
 * Also patches the API base URL so the Capacitor app can
 * reach the backend server via the network (not localhost).
 *
 * Usage: node scripts/build-www.js [--api-url=https://your-server.com]
 */

const fs = require('fs');
const path = require('path');

// ── Parse CLI args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const apiArg = args.find(a => a.startsWith('--api-url='));
// Default: use local network IP (user can override with --api-url=...)
const API_URL = apiArg
  ? apiArg.split('=')[1]
  : 'http://10.0.2.2:3001/api'; // 10.0.2.2 = Android emulator's localhost

const ROOT = path.join(__dirname, '..');
const WWW  = path.join(ROOT, 'www');

// ── Files & folders to copy ───────────────────────────────────────────────────
const COPY_FILES = [
  'app.html',
  'app.js',
  'manifest.json',
  'service-worker.js',
  'icon-512.png',
];

const COPY_DIRS = [
  'public', // any static assets
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠  Skipping (not found): ${path.basename(src)}`);
    return;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  console.log(`  ✓  Copied: ${path.relative(ROOT, src)}`);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else { fs.copyFileSync(s, d); }
  }
  console.log(`  ✓  Copied dir: ${path.relative(ROOT, src)}/`);
}

function patchApiUrl(filePath, oldUrl, newUrl) {
  let src = fs.readFileSync(filePath, 'utf8');
  if (src.includes(oldUrl)) {
    src = src.replace(oldUrl, newUrl);
    fs.writeFileSync(filePath, src, 'utf8');
    console.log(`  🔧  Patched API URL: ${oldUrl}  →  ${newUrl}`);
  } else {
    console.warn(`  ⚠  Could not find API URL to patch in ${path.basename(filePath)}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('\n🏗  Building ZenScreen www/ for Capacitor...\n');

// 1. Clean and recreate www/
if (fs.existsSync(WWW)) {
  fs.rmSync(WWW, { recursive: true, force: true });
  console.log('  🗑  Cleaned old www/');
}
ensureDir(WWW);

// 2. Copy frontend files
console.log('\n📦  Copying frontend files:');
for (const f of COPY_FILES) {
  copyFile(path.join(ROOT, f), path.join(WWW, f));
}

// 3. Copy static dirs
for (const d of COPY_DIRS) {
  copyDir(path.join(ROOT, d), path.join(WWW, d));
}

// 4. Patch API base URL in the copied app.js
console.log('\n🔧  Patching API URL:');
patchApiUrl(
  path.join(WWW, 'app.js'),
  "http://localhost:3001/api",   // original value in source
  API_URL                         // target value for the Android build
);

// 5. Inject Capacitor bridge script into app.html
console.log('\n💉  Injecting Capacitor bridge into app.html:');
let html = fs.readFileSync(path.join(WWW, 'app.html'), 'utf8');
if (!html.includes('capacitor.js')) {
  // Inject before the first <script> or at end of <head>
  const bridgeTag = '<script src="capacitor.js"></script>\n    ';
  html = html.replace('<link rel="manifest"', bridgeTag + '<link rel="manifest"');
  fs.writeFileSync(path.join(WWW, 'app.html'), html, 'utf8');
  console.log('  ✓  capacitor.js bridge injected');
} else {
  console.log('  ℹ  capacitor.js already present');
}

// 6. Write a build-info file
fs.writeFileSync(
  path.join(WWW, 'build-info.json'),
  JSON.stringify({ builtAt: new Date().toISOString(), apiUrl: API_URL }, null, 2)
);

// 7. Create index.html that redirects to app.html (Capacitor requires index.html)
console.log('\n📄  Creating index.html entry point:');
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=app.html">
  <title>ZenScreen</title>
  <script>window.location.replace('app.html');</script>
</head>
<body></body>
</html>`;
fs.writeFileSync(path.join(WWW, 'index.html'), indexHtml, 'utf8');
console.log('  ✓  index.html created (redirects to app.html)');

console.log('\n✅  www/ build complete!');
console.log(`   API URL: ${API_URL}`);
console.log(`   Output:  ${WWW}`);
console.log('\nNext steps:');
console.log('   npx cap sync android    ← sync www/ into Android project');
console.log('   npx cap open android    ← open Android Studio to build APK\n');
