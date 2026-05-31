/**
 * setup-mobile.js — ZenScreen Mobile Build Helper
 *
 * Automatically detects your PC's LAN IP, updates capacitor.config.json,
 * copies app.js → www/app.js, and runs `npx cap sync android`.
 *
 * Usage:
 *   node setup-mobile.js                    # auto-detect LAN IP (for real phone)
 *   node setup-mobile.js --emulator         # use 10.0.2.2 (for Android emulator)
 *   node setup-mobile.js 192.168.1.100      # use a specific IP
 */

const os   = require('os');
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Detect LAN IP ──────────────────────────────────────────────────────────
function getLanIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254')) {
        return iface.address;
      }
    }
  }
  return null;
}

const isEmulator = process.argv.includes('--emulator');
const manualIP = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;

let lanIP;
if (isEmulator) {
  lanIP = '10.0.2.2';
  console.log('\n🤖 Emulator mode: using 10.0.2.2 (host loopback)');
} else {
  lanIP = manualIP || getLanIP();
}

if (!lanIP) {
  console.error('❌ Could not detect a LAN IP. Make sure you are connected to Wi-Fi.');
  console.error('   Or pass it manually: node setup-mobile.js 192.168.1.100');
  console.error('   For emulator testing: node setup-mobile.js --emulator');
  process.exit(1);
}

const serverUrl = `http://${lanIP}:3001`;
console.log(`🔍 Using IP: ${lanIP}`);
console.log(`🌐 Server URL: ${serverUrl}\n`);

// ─── 1. Update capacitor.config.json ─────────────────────────────────────────
const configPath = path.join(__dirname, 'capacitor.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

config.server = config.server || {};
config.server.url = serverUrl;
config.server.cleartext = true;
config.server.androidScheme = 'http';

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('✅ Updated capacitor.config.json → server.url =', serverUrl);

// ─── 2. Copy app.js → www/app.js ────────────────────────────────────────────
const srcJs  = path.join(__dirname, 'app.js');
const dstJs  = path.join(__dirname, 'www', 'app.js');
fs.copyFileSync(srcJs, dstJs);
console.log('✅ Copied app.js → www/app.js');

// ─── 3. Copy app.html → www/app.html ────────────────────────────────────────
const srcHtml = path.join(__dirname, 'app.html');
const dstHtml = path.join(__dirname, 'www', 'app.html');
if (fs.existsSync(srcHtml)) {
  fs.copyFileSync(srcHtml, dstHtml);
  console.log('✅ Copied app.html → www/app.html');
}

// ─── 4. Run npx cap sync android ─────────────────────────────────────────────
console.log('\n📦 Running: npx cap sync android ...');
try {
  execSync('npx cap sync android', { cwd: __dirname, stdio: 'inherit' });
  console.log('\n✅ Capacitor sync complete!');
} catch (err) {
  console.error('\n⚠️  cap sync failed. You can run it manually: npx cap sync android');
}

console.log(`
╔═══════════════════════════════════════════════════════╗
║  ✅ Mobile setup complete!                            ║
║                                                       ║
║  Next steps:                                          ║
║  1. Start the server:  cd server && node server.js    ║
║  2. Open Android Studio and build/run the app         ║
║  3. Make sure your phone is on the SAME Wi-Fi         ║
║     as this PC (${lanIP})
║                                                       ║
║  If you change networks, run this script again.       ║
╚═══════════════════════════════════════════════════════╝
`);
