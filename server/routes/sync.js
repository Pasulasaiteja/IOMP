// routes/sync.js — Background data synchronization
const express = require('express');
const requireAuth = require('../middleware/auth');
const { getDb, all, run } = require('../db');
const path = require('path');

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
    let errors = [];

    for (const record of records) {
      const { app_name, minutes, date, timestamp } = record;

      // Validate required fields
      if (!app_name || minutes == null || !date) {
        console.warn('[Sync] Skipping invalid record:', record);
        errors.push(`Invalid record: ${JSON.stringify(record)}`);
        continue;
      }

      // Use provided timestamp or current time as fallback
      const finalTimestamp = timestamp || Date.now();

      // Check for duplicate (same app, same date, recent timestamp)
      const existing = all(
        db,
        `SELECT id FROM screen_time 
         WHERE user_id = ? AND app_name = ? AND date = ? 
         AND timestamp >= ?`,
        [req.userId, app_name, date, finalTimestamp - 60000] // 1 minute window
      );

      if (existing.length > 0) {
        duplicates++;
        console.log('[Sync] Duplicate detected:', app_name, date);
        continue;
      }

      // Insert new record or update with max minutes
      try {
        run(
          db,
          `INSERT INTO screen_time (user_id, app_name, minutes, date, timestamp)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(user_id, date, app_name) DO UPDATE SET 
             minutes = MAX(screen_time.minutes, excluded.minutes),
             timestamp = excluded.timestamp`,
          [req.userId, app_name, minutes, date, finalTimestamp]
        );
        synced++;
        console.log('[Sync] Inserted:', app_name, minutes, 'mins on', date);
      } catch (insertErr) {
        console.error('[Sync] Insert error for record:', record, insertErr);
        errors.push(`Insert failed for ${app_name}: ${insertErr.message}`);
      }
    }

    console.log(`[Sync] Synced ${synced} records, skipped ${duplicates} duplicates for user ${req.userId}`);
    if (errors.length > 0) {
      console.warn('[Sync] Errors:', errors);
    }

    res.json({
      success: true,
      synced,
      duplicates,
      errors: errors.length > 0 ? errors : undefined,
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

/**
 * GET /api/data/debug/all-screentime
 * Debug endpoint: Returns ALL screen time data for current user
 */
router.get('/debug/all-screentime', async (req, res) => {
  try {
    const db = await getDb();
    const allRecords = all(
      db,
      `SELECT app_name, minutes, date, timestamp FROM screen_time 
       WHERE user_id = ? 
       ORDER BY date DESC, timestamp DESC`,
      [req.userId]
    );
    
    const today = new Date().toISOString().slice(0, 10);
    const todayRecords = all(
      db,
      `SELECT app_name, minutes, date, timestamp FROM screen_time 
       WHERE user_id = ? AND date = ?
       ORDER BY timestamp DESC`,
      [req.userId, today]
    );

    res.json({
      total_records: allRecords.length,
      today: today,
      today_records: todayRecords,
      all_records: allRecords.slice(0, 50) // Last 50 records
    });
  } catch (err) {
    console.error('[Debug] Error:', err);
    res.status(500).json({ error: 'Debug query failed: ' + err.message });
  }
});

module.exports = router;
