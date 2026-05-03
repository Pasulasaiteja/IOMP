// server.js — Main entry point
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors    = require('cors');

const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const aiRoutes   = require('./routes/ai');
const syncRoutes = require('./routes/sync');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/data', syncRoutes); // Background sync endpoints
app.use('/api/ai',   aiRoutes);

// Serve Static Frontend
app.use(express.static(path.join(__dirname, '../')));

// Basic health check
app.get('/health', (req, res) => res.json({ status: 'ZenScreen Server Online' }));

// Start Server
app.listen(PORT, () => {
  console.log(`
  🚀 ZenScreen Server Running
  🔗 http://localhost:${PORT}
  📁 Database: server/zenscreen.db
  `);
});
