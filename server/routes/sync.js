// routes/sync.js — Background data synchronization
const express = require('express');
const requireAuth = require('../middleware/auth');
const { getDb, all, run } = require('../db');

const router = express.Router();
router.use(requireAuth);

/**
 * POST /api/data/sync-tracking
 * Receives background tracking data from Service Worker and syncs to database
 */
router.post('/sync-tracking', async (req, res) => {
  try {
    const { records } = req.body;
    
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Invalid records format' });
    }

    const db = await getDb();
    const today = new Date().toISOString().slice(0, 10);
    let synced = 0;
    let duplicates = 0;

    for (const record of records) {
      const { app_name, minutes, date, timestamp } = record;

      // Validate required fields
      if (!app_name || !minutes || !date) {
        console.warn('[Sync] Skipping invalid record:', record);
        continue;
      }

      // Check for duplicate (same app, same date, recent timestamp)
      const existing = all(
        db,
        `SELECT id FROM screen_time 
         WHERE user_id = ? AND app_name = ? AND date = ? 
         AND timestamp >= ?`,
        [req.userId, app_name, date, timestamp - 60000] // 1 minute window
      );

      if (existing.length > 0) {
        duplicates++;
        console.log('[Sync] Duplicate detected:', app_name, date);
        continue;
      }

      // Insert new record
      run(
        db,
        `INSERT INTO screen_time (user_id, app_name, minutes, date, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        [req.userId, app_name, minutes, date, timestamp]
      );

      synced++;
    }

    console.log(`[Sync] Synced ${synced} records, skipped ${duplicates} duplicates for user ${req.userId}`);

    res.json({
      success: true,
      synced,
      duplicates,
      message: `Synced ${synced} tracking records`
    });
  } catch (err) {
    console.error('[Sync] Error:', err);
    res.status(500).json({ error: 'Sync failed: ' + err.message });
  }
});

/**
 * GET /api/data/sync-status
 * Returns sync status and last sync time
 */
router.get('/sync-status', async (req, res) => {
  try {
    const db = await getDb();
    const result = all(
      db,
      `SELECT MAX(timestamp) as last_sync, COUNT(*) as total_records
       FROM screen_time
       WHERE user_id = ?`,
      [req.userId]
    );

    const lastSync = result[0]?.last_sync ? new Date(result[0].last_sync).toISOString() : null;
    const totalRecords = result[0]?.total_records || 0;

    res.json({
      last_sync: lastSync,
      total_records: totalRecords,
      sync_enabled: true
    });
  } catch (err) {
    console.error('[Sync] Status error:', err);
    res.status(500).json({ error: 'Status check failed' });
  }
});

module.exports = router;
