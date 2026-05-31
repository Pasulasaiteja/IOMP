// server.js — Main entry point
const path = require('path');
const os   = require('os');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors    = require('cors');

const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const aiRoutes   = require('./routes/ai');
const syncRoutes = require('./routes/sync');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware — allow all origins so phone can reach the server
app.use(cors({ origin: '*' }));
app.use(express.json());

// Request logger — see every incoming request in the terminal
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url} from ${req.ip}`);
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/data', syncRoutes); // Background sync endpoints
app.use('/api/ai',   aiRoutes);

// Serve Static Frontend — no-cache on JS/HTML so phone always gets latest
app.use(express.static(path.join(__dirname, '../'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Root route redirect to prevent "Cannot GET /"
app.get('/', (req, res) => res.redirect('/app.html'));

// Basic health check
app.get('/health', (req, res) => res.json({ status: 'ZenScreen Server Online' }));

// Get all LAN IPs for display
function getLanIPs() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(`  📱 http://${iface.address}:${PORT}  (${name})`);
      }
    }
  }
  return ips.join('\n');
}

// Start Server — bind to 0.0.0.0 so phone can connect over LAN
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 ZenScreen Server Running
  🖥️  http://localhost:${PORT}   (browser on this PC)
  📁 Database: server/zenscreen.db

  ── Phone Access (same Wi-Fi/hotspot) ──
${getLanIPs()}

  ⚠️  Make sure PC firewall allows port ${PORT}
  `);
});
