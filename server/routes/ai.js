// routes/ai.js — Local AI Coaching (No External APIs)
const express = require('express');
const requireAuth = require('../middleware/auth');
const { getDb, all, get, run } = require('../db');
const { analyzeUsage, isAnomalous, appAnomaly } = require('../ai/analytics');
const { generateInsights, generateDailySummary } = require('../ai/insights');
const { chat } = require('../ai/chatbot');
const { checkNotifications } = require('../ai/notifications');

const router = express.Router();
router.use(requireAuth);

// ── Helper: fetch user context from SQLite ─────────────────────────────────
function getUserContext(db, userId) {
  const rows30d = all(db, `
    SELECT app_name, minutes, date
    FROM screen_time
    WHERE user_id = ? AND date >= date('now', '-30 days')
    ORDER BY date ASC
  `, [userId]);

  const today = new Date().toISOString().slice(0, 10);
  const todayRows = all(db, `
    SELECT app_name, SUM(minutes) as mins
    FROM screen_time
    WHERE user_id = ? AND date = ?
    GROUP BY app_name ORDER BY mins DESC
  `, [userId, today]);

  const userRecord = get(db, 'SELECT daily_goal FROM users WHERE id = ?', [userId]);
  const dailyLimit = userRecord?.daily_goal || 360;
  const todayMins = todayRows.reduce((s, r) => s + r.mins, 0);
  const analytics = analyzeUsage(rows30d);

  return { analytics, todayMins, dailyLimit, todayRows, rows30d };
}

// ── GET /api/ai/insights ────────────────────────────────────────────────────
router.get('/insights', async (req, res) => {
  try {
    const db = await getDb();
    const { analytics, todayMins, dailyLimit, todayRows } = getUserContext(db, req.userId);

    const insights = generateInsights(analytics, dailyLimit, todayMins);
    const topAppToday = todayRows[0]?.app_name || null;
    const summary = generateDailySummary(todayMins, dailyLimit, topAppToday);

    res.json({ summary, insights });
  } catch (err) {
    console.error('Insights error:', err);
    res.status(500).json({ error: 'Could not generate insights' });
  }
});

// ── POST /api/ai/chat ───────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  try {
    const db = await getDb();
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

    const { analytics, todayMins, dailyLimit } = getUserContext(db, req.userId);

    const ctx = {
      ...analytics,
      todayMins,
      dailyLimit,
    };

    const reply = await chat(message, ctx);

    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat unavailable' });
  }
});

// ── POST /api/ai/check-notifications ───────────────────────────────────────
router.post('/check-notifications', async (req, res) => {
  try {
    const db = await getDb();
    const userId = req.userId;
    const { analytics, todayMins, dailyLimit, todayRows, rows30d } = getUserContext(db, userId);

    // Build per-app historical data (last 30 days)
    const historicalByApp = {};
    rows30d.forEach(row => {
      if (!historicalByApp[row.app_name]) historicalByApp[row.app_name] = [];
      historicalByApp[row.app_name].push(row.minutes);
    });

    // Same day-of-week historical totals
    const dow = new Date().getDay();
    const sameDowRows = all(db, `
      SELECT SUM(minutes) as total
      FROM screen_time
      WHERE user_id = ? AND cast(strftime('%w', date) as integer) = ?
      AND date >= date('now', '-60 days')
      GROUP BY date(date)
    `, [userId, dow]);
    const historicalDow = sameDowRows.map(r => r.total || 0).filter(x => x > 0);

    // Which notifications already fired today?
    const today = new Date().toISOString().slice(0, 10);
    const fired = all(db, `
      SELECT type FROM notification_log
      WHERE user_id = ? AND date(fired_at) = ?
    `, [userId, today]);
    const alreadyFiredToday = new Set(fired.map(r => r.type));

    const notifications = checkNotifications({
      todayMins,
      dailyLimit,
      todayByApp: todayRows,
      historicalByApp,
      historicalDow,
      trendDirection: analytics.trendDirection,
      alreadyFiredToday,
    });

    // Log fired notifications so they don't re-fire today
    notifications.forEach(n => {
      run(db, 
        `INSERT OR IGNORE INTO notification_log (user_id, type, fired_at) VALUES (?, ?, datetime('now'))`,
        [userId, n.type]
      );
    });

    res.json({ notifications });
  } catch (err) {
    console.error('Notification error:', err);
    res.status(500).json({ notifications: [] });
  }
});

module.exports = router;
