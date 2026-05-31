// routes/data.js — Screen time, app limits, preferences, goals
const express = require('express');
const { getDb, all, get, run } = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/data/summary
router.get('/summary', async (req, res) => {
  try {
    const db = await getDb();
    const today = new Date().toISOString().slice(0, 10);

    const todayRows = all(db, 'SELECT app_name, minutes FROM screen_time WHERE user_id = ? AND date = ?', [req.userId, today]);

    const weekRows = all(db, `
      SELECT date, SUM(minutes) as total FROM screen_time
      WHERE user_id = ? AND date >= date('now', '-6 days')
      GROUP BY date ORDER BY date ASC
    `, [req.userId]);

    const prevWeekRows = all(db, `
      SELECT date, SUM(minutes) as total FROM screen_time
      WHERE user_id = ? AND date >= date('now', '-13 days') AND date < date('now', '-6 days')
      GROUP BY date ORDER BY date ASC
    `, [req.userId]);

    const limits = all(db, 'SELECT app_name, limit_mins FROM app_limits WHERE user_id = ?', [req.userId]);
    const user = get(db, 'SELECT name, email, daily_goal, streak FROM users WHERE id = ?', [req.userId]);
    const prefs = get(db, 'SELECT * FROM preferences WHERE user_id = ?', [req.userId]) || { notifications: 1, bedtime_mode: 1, weekly_report: 0 };

    res.json({ todayRows, weekRows, prevWeekRows, limits, user, preferences: prefs });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: 'Failed to load summary.' });
  }
});

// PUT /api/data/screentime
router.put('/screentime', async (req, res) => {
  try {
    const { appName, minutes, date } = req.body;
    const d = date || new Date().toISOString().slice(0, 10);
    if (!appName || minutes == null) return res.status(400).json({ error: 'appName and minutes required.' });
    const db = await getDb();
    run(db, `
      INSERT INTO screen_time (user_id, date, app_name, minutes) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, date, app_name) DO UPDATE SET minutes = excluded.minutes
    `, [req.userId, d, appName, Math.max(0, minutes)]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save screen time.' });
  }
});

// POST /api/data/screentime/bulk
router.post('/screentime/bulk', async (req, res) => {
  try {
    const { entries, replace } = req.body;
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries array required.' });
    const db = await getDb();
    const today = new Date().toISOString().slice(0, 10);

    // When replace=true (native app), delete ALL existing screen_time for
    // this user+date first.  This wipes stale mock data from browser testing.
    if (replace) {
      const date = entries[0]?.date || today;
      run(db, 'DELETE FROM screen_time WHERE user_id = ? AND date = ?', [req.userId, date]);
      console.log('[Bulk] Cleared old screen_time for user', req.userId, 'on', date);
    }

    let inserted = 0;
    for (const row of entries) {
      if (row.appName && row.minutes != null && row.minutes > 0) {
        run(db, `
          INSERT INTO screen_time (user_id, date, app_name, minutes) VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, date, app_name) DO UPDATE SET minutes = excluded.minutes
        `, [req.userId, row.date || today, row.appName, row.minutes]);
        inserted++;
      }
    }
    console.log('[Bulk] Inserted', inserted, 'screen_time records for user', req.userId);
    res.json({ success: true, count: inserted });
  } catch (err) {
    console.error('[Bulk] Error:', err);
    res.status(500).json({ error: 'Bulk insert failed.' });
  }
});

// PUT /api/data/limits
router.put('/limits', async (req, res) => {
  try {
    const { appName, limitMins } = req.body;
    if (!appName) return res.status(400).json({ error: 'appName required.' });
    const db = await getDb();
    if (!limitMins || limitMins === 0) {
      run(db, 'DELETE FROM app_limits WHERE user_id = ? AND app_name = ?', [req.userId, appName]);
    } else {
      run(db, `
        INSERT INTO app_limits (user_id, app_name, limit_mins) VALUES (?, ?, ?)
        ON CONFLICT(user_id, app_name) DO UPDATE SET limit_mins = excluded.limit_mins
      `, [req.userId, appName, limitMins]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save limit.' });
  }
});

// PUT /api/data/goal
router.put('/goal', async (req, res) => {
  try {
    const { goalMins } = req.body;
    if (!goalMins || goalMins < 30) return res.status(400).json({ error: 'goalMins must be at least 30.' });
    const db = await getDb();
    run(db, 'UPDATE users SET daily_goal = ? WHERE id = ?', [goalMins, req.userId]);
    res.json({ success: true, goalMins });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update goal.' });
  }
});

// PUT /api/data/preferences
router.put('/preferences', async (req, res) => {
  try {
    const { notifications, bedtimeMode, weeklyReport } = req.body;
    const db = await getDb();
    run(db, `
      INSERT INTO preferences (user_id, notifications, bedtime_mode, weekly_report) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        notifications = excluded.notifications,
        bedtime_mode  = excluded.bedtime_mode,
        weekly_report = excluded.weekly_report
    `, [req.userId, notifications ? 1 : 0, bedtimeMode ? 1 : 0, weeklyReport ? 1 : 0]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update preferences.' });
  }
});

// GET /api/data/export
router.get('/export', async (req, res) => {
  try {
    const db = await getDb();
    const user   = get(db, 'SELECT id, name, email, daily_goal, streak, created_at FROM users WHERE id = ?', [req.userId]);
    const limits = all(db, 'SELECT app_name, limit_mins FROM app_limits WHERE user_id = ?', [req.userId]);
    const time   = all(db, 'SELECT date, app_name, minutes FROM screen_time WHERE user_id = ? ORDER BY date DESC', [req.userId]);
    const prefs  = get(db, 'SELECT * FROM preferences WHERE user_id = ?', [req.userId]);
    res.json({ exportDate: new Date().toISOString(), user, limits, screenTime: time, preferences: prefs });
  } catch (err) {
    res.status(500).json({ error: 'Export failed.' });
  }
});

module.exports = router;
