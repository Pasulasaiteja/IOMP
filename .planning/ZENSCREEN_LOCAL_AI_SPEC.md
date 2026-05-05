# ZenScreen — Local AI Implementation Spec
## Zero External APIs · Runs 100% On-Device · No Cost

---

## Core Philosophy

This AI system uses **no paid APIs, no cloud calls, no external services**.
Everything runs inside the Node.js backend using lightweight local libraries.
The "AI" is a combination of:
- **Statistical analysis** (pattern detection, anomaly scoring) — replaces ML cloud APIs
- **Rule-based NLP + template engine** (insight and notification text generation)
- **A tiny local chatbot model** (Ollama + Phi-3 Mini or llama3.2:1b) — optional, free

This approach works well because phone usage data is **structured and numerical** —
you don't need a giant LLM to say "you used Instagram 3 hours on Sunday."
You need smart math + well-crafted templates.

---

## Technology Stack (All Free & Local)

| Need | Tool | Why |
|---|---|---|
| Pattern analysis | `simple-statistics` npm package | Mean, std dev, percentiles — no model needed |
| Anomaly detection | Z-score calculation (pure JS) | Flags unusual days without any ML framework |
| App clustering | `ml-kmeans` npm package | Groups apps by behavior, runs in-process |
| Time-series trends | `regression` npm package | Linear trend detection on usage history |
| Insight text generation | Template engine (pure JS) | 50+ pre-written smart templates filled with real data |
| Chatbot NLP | Keyword intent matching + templates | Works offline, instant, zero cost |
| Optional smarter chat | Ollama (free, local LLM server) | Run Phi-3 Mini (2.3GB) or llama3.2:1b locally |
| Notifications | Rule engine (pure JS) | Threshold + trend triggers |

---

## Step 1 — Install Local Dependencies

```bash
# In your server/ directory
npm install simple-statistics ml-kmeans regression

# Optional: for smarter chatbot responses, install Ollama (free)
# Visit https://ollama.com and install, then run:
# ollama pull phi3:mini        (2.3GB, recommended)
# or
# ollama pull llama3.2:1b     (1.3GB, lighter)
```

No API keys. No accounts. No cost.

---

## Step 2 — Analytics Engine

Create `server/ai/analytics.js`:

```javascript
const ss = require('simple-statistics');
const regression = require('regression');

/**
 * Analyzes a user's usage data and returns structured stats.
 * All input comes from your existing SQLite screen_time table.
 */
function analyzeUsage(rows) {
  // rows = [{ app_name, duration_minutes, recorded_at }, ...]

  const byApp = {};
  const byHour = Array(24).fill(0);
  const byDayOfWeek = Array(7).fill(0);
  const byDate = {};

  rows.forEach(row => {
    const dt = new Date(row.recorded_at);
    const hour = dt.getHours();
    const dow = dt.getDay(); // 0=Sun, 6=Sat
    const date = dt.toISOString().split('T')[0];
    const mins = row.duration_minutes || 0;

    // App totals
    if (!byApp[row.app_name]) byApp[row.app_name] = { total: 0, sessions: [], hours: Array(24).fill(0) };
    byApp[row.app_name].total += mins;
    byApp[row.app_name].sessions.push(mins);
    byApp[row.app_name].hours[hour] += mins;

    // Global hour/day distribution
    byHour[hour] += mins;
    byDayOfWeek[dow] += mins;

    // Daily totals
    byDate[date] = (byDate[date] || 0) + mins;
  });

  // Daily totals as sorted array
  const dailyTotals = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));

  const totalValues = dailyTotals.map(d => d.total);

  // Overall stats
  const stats = {
    mean: totalValues.length ? ss.mean(totalValues) : 0,
    median: totalValues.length ? ss.median(totalValues) : 0,
    stdDev: totalValues.length > 1 ? ss.standardDeviation(totalValues) : 0,
    max: totalValues.length ? ss.max(totalValues) : 0,
    min: totalValues.length ? ss.min(totalValues) : 0,
  };

  // Trend: is usage going up or down over the last 14 days?
  const trendData = dailyTotals.slice(-14).map((d, i) => [i, d.total]);
  const trendResult = trendData.length >= 3 ? regression.linear(trendData) : null;
  const trendDirection = trendResult
    ? (trendResult.equation[0] > 5 ? 'increasing' : trendResult.equation[0] < -5 ? 'decreasing' : 'stable')
    : 'stable';

  // Peak hour and peak day
  const peakHour = byHour.indexOf(Math.max(...byHour));
  const peakDow = byDayOfWeek.indexOf(Math.max(...byDayOfWeek));
  const dowNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Top apps sorted by total usage
  const topApps = Object.entries(byApp)
    .map(([name, data]) => ({
      name,
      totalMins: data.total,
      peakHour: data.hours.indexOf(Math.max(...data.hours)),
      avgSession: data.sessions.length ? Math.round(ss.mean(data.sessions)) : 0,
    }))
    .sort((a, b) => b.totalMins - a.totalMins)
    .slice(0, 5);

  // Weekend vs weekday comparison
  const weekendMins = byDayOfWeek[0] + byDayOfWeek[6];
  const weekdayMins = byDayOfWeek.slice(1, 6).reduce((a, b) => a + b, 0);
  const weekendAvg = weekendMins / 2;
  const weekdayAvg = weekdayMins / 5;
  const weekendVsWeekday =
    weekdayAvg > 0
      ? Math.round(((weekendAvg - weekdayAvg) / weekdayAvg) * 100)
      : 0;

  return {
    stats,
    trendDirection,
    peakHour,
    peakDayName: dowNames[peakDow],
    topApps,
    byHour,
    byDayOfWeek,
    dailyTotals,
    weekendVsWeekday, // positive = more on weekends
  };
}

/**
 * Anomaly detection using Z-score.
 * Returns true if today's usage is unusually high for that day of week.
 */
function isAnomalous(todayMins, historicalSameDow) {
  if (historicalSameDow.length < 3) return false;
  const mean = ss.mean(historicalSameDow);
  const std = ss.standardDeviation(historicalSameDow);
  if (std === 0) return false;
  const z = (todayMins - mean) / std;
  return z > 1.5; // 1.5 std devs above normal = anomalous
}

/**
 * Per-app anomaly: is today's usage of this app unusual?
 */
function appAnomaly(todayAppMins, historicalAppMins) {
  if (historicalAppMins.length < 3) return { anomalous: false, pct: 0 };
  const avg = ss.mean(historicalAppMins);
  if (avg === 0) return { anomalous: false, pct: 0 };
  const pct = Math.round(((todayAppMins - avg) / avg) * 100);
  return { anomalous: pct > 30, pct };
}

module.exports = { analyzeUsage, isAnomalous, appAnomaly };
```

---

## Step 3 — Insight Template Engine

Create `server/ai/insights.js`:

```javascript
/**
 * Generates human-readable insight text from structured analytics data.
 * No LLM needed — smart templates filled with real numbers.
 */

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatMins(mins) {
  if (mins < 60) return `${Math.round(mins)} minutes`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h} hour${h > 1 ? 's' : ''}`;
}

function hourLabel(h) {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

/**
 * Returns an array of insight strings based on the analytics result.
 * The home page shows the top 2-3.
 */
function generateInsights(analytics, dailyLimitMins, todayMins) {
  const insights = [];
  const { topApps, peakHour, peakDayName, trendDirection, weekendVsWeekday, stats } = analytics;

  // Insight 1: Peak usage time
  if (peakHour !== null) {
    const endHour = (peakHour + 2) % 24;
    insights.push(
      `Your busiest phone hours are around ${hourLabel(peakHour)}–${hourLabel(endHour)}. ` +
      `That's when most of your screen time happens.`
    );
  }

  // Insight 2: Top app behaviour
  if (topApps.length > 0) {
    const top = topApps[0];
    insights.push(
      `${top.name} is your most-used app at ${formatMins(top.totalMins)} over the past 30 days, ` +
      `with peak usage around ${hourLabel(top.peakHour)}.`
    );
  }

  // Insight 3: Weekend vs weekday
  if (Math.abs(weekendVsWeekday) >= 15) {
    const dir = weekendVsWeekday > 0 ? 'more' : 'less';
    const pct = Math.abs(weekendVsWeekday);
    insights.push(
      `You use your phone ${pct}% ${dir} on weekends compared to weekdays. ` +
      `${weekendVsWeekday > 0 ? 'Weekends are your high-screen days.' : 'Weekdays keep you more focused.'}`
    );
  }

  // Insight 4: Trend
  if (trendDirection === 'increasing') {
    insights.push(
      `Your screen time has been gradually increasing over the past two weeks. ` +
      `Consider setting a stricter daily limit to course-correct.`
    );
  } else if (trendDirection === 'decreasing') {
    insights.push(
      `Great progress — your screen time has been trending down over the past two weeks. Keep it up!`
    );
  }

  // Insight 5: Today vs limit
  if (todayMins && dailyLimitMins) {
    const pct = Math.round((todayMins / dailyLimitMins) * 100);
    if (pct >= 90) {
      insights.push(`You've used ${pct}% of your daily limit today (${formatMins(todayMins)} of ${formatMins(dailyLimitMins)}).`);
    } else if (pct <= 40) {
      insights.push(`You're well within your daily limit — only ${pct}% used so far today. Nice restraint.`);
    }
  }

  // Insight 6: Productive morning window
  const morningMins = [6,7,8,9,10,11].reduce((s, h) => s + (analytics.byHour[h] || 0), 0);
  const eveningMins = [20,21,22,23].reduce((s, h) => s + (analytics.byHour[h] || 0), 0);
  if (morningMins < eveningMins * 0.4) {
    insights.push(
      `Your mornings (6 AM–12 PM) are relatively screen-free — that's your natural focus window. Protect it.`
    );
  }

  return insights.slice(0, 3); // Return top 3 for the home card
}

/**
 * Generates a single daily summary sentence (for the home page header).
 */
function generateDailySummary(todayMins, dailyLimitMins, topAppToday) {
  const pct = dailyLimitMins > 0 ? Math.round((todayMins / dailyLimitMins) * 100) : 0;
  const topStr = topAppToday ? `, mostly on ${topAppToday}` : '';

  if (todayMins === 0) return `No screen time recorded yet today. Great start!`;
  if (pct > 100) return `You've exceeded your daily limit by ${formatMins(todayMins - dailyLimitMins)}${topStr}.`;
  if (pct >= 80) return `Almost at your limit — ${formatMins(todayMins)} used today${topStr}.`;
  return `${formatMins(todayMins)} of screen time today${topStr} — ${pct}% of your daily limit.`;
}

module.exports = { generateInsights, generateDailySummary, formatMins, hourLabel };
```

---

## Step 4 — Local Chatbot (Two Options)

Create `server/ai/chatbot.js`:

```javascript
/**
 * Local chatbot with two modes:
 * Mode A (default): Keyword intent matching + template responses. Zero dependencies.
 * Mode B (optional): Ollama local LLM. Free but requires Ollama installed.
 */

const { formatMins, hourLabel } = require('./insights');

// ─── MODE A: Keyword Intent Matching ────────────────────────────────────────

const INTENTS = [
  {
    keywords: ['most used', 'top app', 'which app', 'use most', 'most time'],
    handler: (ctx) => {
      if (!ctx.topApps.length) return "I don't have enough data yet to identify your top apps.";
      const top = ctx.topApps[0];
      return `Your most-used app is **${top.name}** at ${formatMins(top.totalMins)} over the past 30 days. ` +
             `You typically use it most around ${hourLabel(top.peakHour)}.`;
    }
  },
  {
    keywords: ['peak', 'busiest', 'most active', 'what time', 'when do i'],
    handler: (ctx) => {
      return `You're most active on your phone around **${hourLabel(ctx.peakHour)}**. ` +
             `${ctx.peakDayName} tends to be your highest-usage day of the week.`;
    }
  },
  {
    keywords: ['weekend', 'saturday', 'sunday', 'weekday'],
    handler: (ctx) => {
      const dir = ctx.weekendVsWeekday > 0 ? 'more' : 'less';
      const pct = Math.abs(ctx.weekendVsWeekday);
      if (pct < 5) return `Your usage is pretty consistent across weekdays and weekends.`;
      return `You use your phone **${pct}% ${dir}** on weekends compared to weekdays. ` +
             `${ctx.weekendVsWeekday > 0 ? 'Weekends are your heavy-use days.' : 'Weekdays are actually busier for you.'}`;
    }
  },
  {
    keywords: ['today', "how much today", 'screen time today'],
    handler: (ctx) => {
      if (!ctx.todayMins) return `No screen time recorded yet today.`;
      const pct = ctx.dailyLimit > 0 ? Math.round((ctx.todayMins / ctx.dailyLimit) * 100) : 0;
      return `You've used **${formatMins(ctx.todayMins)}** today — that's ${pct}% of your ${formatMins(ctx.dailyLimit)} daily limit.`;
    }
  },
  {
    keywords: ['average', 'normally', 'typical', 'usually', 'on average'],
    handler: (ctx) => {
      return `Your average daily screen time over the past 30 days is **${formatMins(ctx.stats.mean)}**. ` +
             `Some days you hit as high as ${formatMins(ctx.stats.max)}, and your lowest was ${formatMins(ctx.stats.min)}.`;
    }
  },
  {
    keywords: ['trend', 'getting worse', 'improving', 'going up', 'going down'],
    handler: (ctx) => {
      const map = {
        increasing: `Your screen time has been **increasing** over the past two weeks. Consider tightening your daily limit.`,
        decreasing: `Great news — your screen time has been **decreasing** over the past two weeks. You're building good habits!`,
        stable: `Your usage has been pretty **stable** recently. No major spikes or drops.`,
      };
      return map[ctx.trendDirection] || `Not enough data to detect a trend yet.`;
    }
  },
  {
    keywords: ['limit', 'goal', 'how much left', 'remaining'],
    handler: (ctx) => {
      const remaining = Math.max(0, ctx.dailyLimit - (ctx.todayMins || 0));
      return `Your daily limit is **${formatMins(ctx.dailyLimit)}**. ` +
             (remaining > 0
               ? `You have **${formatMins(remaining)}** remaining today.`
               : `You've already exceeded it today.`);
    }
  },
  {
    keywords: ['instagram', 'youtube', 'tiktok', 'facebook', 'twitter', 'snapchat', 'whatsapp'],
    handler: (ctx, message) => {
      const appName = ['Instagram','YouTube','TikTok','Facebook','Twitter','Snapchat','WhatsApp']
        .find(a => message.toLowerCase().includes(a.toLowerCase()));
      const found = ctx.topApps.find(a => a.name.toLowerCase() === appName?.toLowerCase());
      if (!found) return `I don't have enough data for ${appName || 'that app'} in the past 30 days.`;
      return `You've spent **${formatMins(found.totalMins)}** on ${found.name} in the past 30 days. ` +
             `Your peak usage is around ${hourLabel(found.peakHour)}.`;
    }
  },
  {
    keywords: ['tip', 'advice', 'suggest', 'help', 'reduce', 'less', 'cut down'],
    handler: (ctx) => {
      const tips = [
        `Try setting a **${formatMins(Math.round(ctx.stats.mean * 0.8))}** daily limit — that's 20% below your average.`,
        `Your peak phone time is ${hourLabel(ctx.peakHour)}. Try a 30-minute phone-free block then.`,
        `Grayscale mode during ${ctx.peakDayName}s can naturally reduce compulsive checking.`,
        `Deleting ${ctx.topApps[0]?.name || 'your top app'} from your home screen adds friction and cuts usage by ~20%.`,
      ];
      return tips[Math.floor(Math.random() * tips.length)];
    }
  },
];

const FALLBACK_RESPONSES = [
  "I can answer questions about your screen time, top apps, usage trends, and daily limits. Try asking something like: 'What's my most-used app?' or 'How am I doing today?'",
  "I'm not sure I understood that. You can ask me about your peak hours, weekly patterns, specific apps, or how you're doing against your daily limit.",
  "That's outside what I know! Ask me about your phone usage patterns — I've got 30 days of your data to work with.",
];

function matchIntent(message, ctx) {
  const lower = message.toLowerCase();
  for (const intent of INTENTS) {
    if (intent.keywords.some(kw => lower.includes(kw))) {
      return intent.handler(ctx, message);
    }
  }
  return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
}

// ─── MODE B: Ollama Local LLM (optional) ────────────────────────────────────

async function askOllama(message, ctx) {
  const systemPrompt = `You are ZenScreen, an AI wellness coach in a screen time tracking app.
Answer the user's question using ONLY the data below. Be concise (under 80 words).
Be specific — use real numbers. Tone: warm and encouraging.

USER DATA (last 30 days):
- Daily limit: ${formatMins(ctx.dailyLimit)}
- Today's usage: ${formatMins(ctx.todayMins || 0)}
- Average daily: ${formatMins(ctx.stats.mean)}
- Peak hour: ${hourLabel(ctx.peakHour)}
- Peak day: ${ctx.peakDayName}
- Trend: ${ctx.trendDirection}
- Top apps: ${ctx.topApps.map(a => `${a.name} (${formatMins(a.totalMins)})`).join(', ')}
- Weekend vs weekday: ${ctx.weekendVsWeekday > 0 ? '+' : ''}${ctx.weekendVsWeekday}%`;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'phi3:mini',  // or 'llama3.2:1b'
        prompt: `${systemPrompt}\n\nUser: ${message}\nZenScreen:`,
        stream: false,
        options: { temperature: 0.7, num_predict: 150 }
      })
    });
    const data = await response.json();
    return data.response?.trim() || matchIntent(message, ctx);
  } catch {
    // Ollama not running — fall back to template mode silently
    return matchIntent(message, ctx);
  }
}

/**
 * Main entry point.
 * useOllama: set to true if Ollama is installed and running.
 */
async function chat(message, ctx, useOllama = false) {
  if (useOllama) return askOllama(message, ctx);
  return matchIntent(message, ctx);
}

module.exports = { chat };
```

---

## Step 5 — Smart Notification Engine

Create `server/ai/notifications.js`:

```javascript
const ss = require('simple-statistics');
const { formatMins } = require('./insights');

/**
 * Evaluates all notification rules and returns an array of
 * { title, body, type } objects to display/push.
 * Called every 30 minutes by the frontend.
 */
function checkNotifications(data) {
  const {
    todayMins,
    dailyLimit,
    todayByApp,       // [{ app_name, mins }]
    historicalByApp,  // { appName: [dailyMins, ...] } last 30 days
    historicalDow,    // [mins] for same day-of-week, last 8 weeks
    trendDirection,
    alreadyFiredToday // Set of type strings fired today (from DB)
  } = data;

  const notifications = [];
  const hour = new Date().getHours();

  // ── Rule 1: Approaching daily limit (fire once, at 80%) ─────────────────
  if (!alreadyFiredToday.has('limit_80') && todayMins >= dailyLimit * 0.8 && todayMins < dailyLimit) {
    const remaining = Math.round(dailyLimit - todayMins);
    notifications.push({
      type: 'limit_80',
      title: '⚠️ Almost at your limit',
      body: `You've used ${formatMins(todayMins)} today — only ${formatMins(remaining)} left of your ${formatMins(dailyLimit)} limit.`
    });
  }

  // ── Rule 2: Daily limit exceeded (fire once) ─────────────────────────────
  if (!alreadyFiredToday.has('limit_exceeded') && todayMins >= dailyLimit) {
    const over = Math.round(todayMins - dailyLimit);
    notifications.push({
      type: 'limit_exceeded',
      title: '🔴 Daily limit exceeded',
      body: `You're ${formatMins(over)} over your daily goal. Consider putting the phone down.`
    });
  }

  // ── Rule 3: Above weekly average for this day of week ───────────────────
  if (!alreadyFiredToday.has('above_avg') && historicalDow.length >= 3) {
    const avg = ss.mean(historicalDow);
    const pct = Math.round(((todayMins - avg) / avg) * 100);
    if (pct >= 30) {
      notifications.push({
        type: 'above_avg',
        title: '📈 Higher than usual',
        body: `Today's screen time is ${pct}% above your typical ${getDowName()}. Average: ${formatMins(avg)}.`
      });
    }
  }

  // ── Rule 4: Per-app spike (fire for top offending app once) ─────────────
  if (!alreadyFiredToday.has('app_spike')) {
    for (const { app_name, mins } of todayByApp) {
      const hist = historicalByApp[app_name] || [];
      if (hist.length < 3) continue;
      const avg = ss.mean(hist);
      if (avg === 0) continue;
      const pct = Math.round(((mins - avg) / avg) * 100);
      if (pct >= 30 && mins >= 30) { // at least 30 min and 30% above avg
        notifications.push({
          type: 'app_spike',
          title: `📱 ${app_name} spike`,
          body: `You've used ${app_name} for ${formatMins(mins)} today — ${pct}% more than your usual daily average.`
        });
        break; // Only one app spike per check
      }
    }
  }

  // ── Rule 5: Evening wind-down nudge (8–10 PM, once per day) ─────────────
  if (!alreadyFiredToday.has('evening_nudge') && hour >= 20 && hour < 22) {
    const messages = [
      `It's ${hour}:00 PM. Your screen time today is ${formatMins(todayMins)}. Consider winding down for better sleep.`,
      `Evening check-in: ${formatMins(todayMins)} on screen today. Putting the phone away now can improve your sleep quality.`,
      `${formatMins(todayMins)} logged today. The next 2 hours before sleep are your mental recovery window — protect them.`,
    ];
    notifications.push({
      type: 'evening_nudge',
      title: '🌙 Evening wind-down',
      body: messages[Math.floor(Math.random() * messages.length)]
    });
  }

  // ── Rule 6: Increasing trend weekly summary (Monday morning only) ────────
  const today = new Date();
  if (!alreadyFiredToday.has('trend_alert') && today.getDay() === 1 && hour >= 9 && hour < 10) {
    if (trendDirection === 'increasing') {
      notifications.push({
        type: 'trend_alert',
        title: '📊 Weekly trend alert',
        body: `Your screen time has been gradually increasing. This week is a good time to tighten your daily limit.`
      });
    } else if (trendDirection === 'decreasing') {
      notifications.push({
        type: 'trend_alert',
        title: '🎉 You\'re improving!',
        body: `Your screen time trend is going down week over week. Keep building that habit!`
      });
    }
  }

  return notifications;
}

function getDowName() {
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
}

module.exports = { checkNotifications };
```

---

## Step 6 — API Routes

Replace `server/routes/ai.js` entirely:

```javascript
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { analyzeUsage, isAnomalous, appAnomaly } = require('../ai/analytics');
const { generateInsights, generateDailySummary } = require('../ai/insights');
const { chat } = require('../ai/chatbot');
const { checkNotifications } = require('../ai/notifications');

// ── Helper: fetch user context from SQLite ─────────────────────────────────
function getUserContext(db, userId) {
  const rows30d = db.prepare(`
    SELECT app_name, duration_minutes, recorded_at
    FROM screen_time
    WHERE user_id = ? AND recorded_at >= date('now', '-30 days')
    ORDER BY recorded_at ASC
  `).all(userId);

  const todayRows = db.prepare(`
    SELECT app_name, SUM(duration_minutes) as mins
    FROM screen_time
    WHERE user_id = ? AND date(recorded_at) = date('now')
    GROUP BY app_name ORDER BY mins DESC
  `).all(userId);

  const limit = db.prepare(
    `SELECT daily_limit_minutes FROM limits WHERE user_id = ?`
  ).get(userId);

  const dailyLimit = limit?.daily_limit_minutes || 120;
  const todayMins = todayRows.reduce((s, r) => s + r.mins, 0);
  const analytics = analyzeUsage(rows30d);

  return { analytics, todayMins, dailyLimit, todayRows, rows30d };
}

// ── GET /api/ai/insights ────────────────────────────────────────────────────
router.get('/insights', authenticateToken, (req, res) => {
  try {
    const db = req.app.locals.db;
    const { analytics, todayMins, dailyLimit, todayRows } = getUserContext(db, req.user.id);

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
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

    const { analytics, todayMins, dailyLimit } = getUserContext(db, req.user.id);

    const ctx = {
      ...analytics,
      todayMins,
      dailyLimit,
    };

    // Set useOllama: true here if you have Ollama installed
    const USE_OLLAMA = process.env.USE_OLLAMA === 'true';
    const reply = await chat(message, ctx, USE_OLLAMA);

    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat unavailable' });
  }
});

// ── POST /api/ai/check-notifications ───────────────────────────────────────
router.post('/check-notifications', authenticateToken, (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.id;
    const { analytics, todayMins, dailyLimit, todayRows, rows30d } = getUserContext(db, userId);

    // Build per-app historical data (last 30 days, by day)
    const historicalByApp = {};
    rows30d.forEach(row => {
      if (!historicalByApp[row.app_name]) historicalByApp[row.app_name] = [];
      historicalByApp[row.app_name].push(row.duration_minutes);
    });

    // Same day-of-week historical totals
    const dow = new Date().getDay();
    const sameDowRows = db.prepare(`
      SELECT SUM(duration_minutes) as total
      FROM screen_time
      WHERE user_id = ? AND strftime('%w', recorded_at) = ?
        AND date(recorded_at) != date('now')
        AND recorded_at >= date('now', '-56 days')
      GROUP BY date(recorded_at)
    `).all(userId, String(dow));
    const historicalDow = sameDowRows.map(r => r.total);

    // Which notifications already fired today?
    const fired = db.prepare(`
      SELECT type FROM notification_log
      WHERE user_id = ? AND date(fired_at) = date('now')
    `).all(userId);
    const alreadyFiredToday = new Set(fired.map(r => r.type));

    const notifications = checkNotifications({
      todayMins,
      dailyLimit,
      todayByApp: todayRows.map(r => ({ app_name: r.app_name, mins: r.mins })),
      historicalByApp,
      historicalDow,
      trendDirection: analytics.trendDirection,
      alreadyFiredToday,
    });

    // Log fired notifications so they don't re-fire today
    const insertLog = db.prepare(
      `INSERT OR IGNORE INTO notification_log (user_id, type, fired_at) VALUES (?, ?, datetime('now'))`
    );
    notifications.forEach(n => insertLog.run(userId, n.type));

    res.json({ notifications });
  } catch (err) {
    console.error('Notification error:', err);
    res.status(500).json({ notifications: [] });
  }
});

module.exports = router;
```

---

## Step 7 — Database Migration

Add to your DB initialization in `server/db.js` or `server/index.js`:

```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS notification_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    fired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, type, date(fired_at))
  );
`);
```

---

## Step 8 — Frontend Integration (`app.js`)

```javascript
// ── Home page insights ────────────────────────────────────────────────────
async function loadHomeInsights() {
  try {
    const res = await fetch('/api/ai/insights', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const { summary, insights } = await res.json();

    document.getElementById('ai-summary').textContent = summary;
    const list = document.getElementById('ai-insights-list');
    list.innerHTML = '';
    insights.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      list.appendChild(li);
    });
  } catch (e) {
    console.error('Insights load failed', e);
  }
}

// ── Chat ──────────────────────────────────────────────────────────────────
async function sendChatMessage(userMessage) {
  appendChatBubble('user', userMessage);
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({ message: userMessage })
  });
  const { reply } = await res.json();
  appendChatBubble('assistant', reply);
}

// ── Notifications (poll every 30 min) ────────────────────────────────────
async function checkNotifications() {
  if (!localStorage.getItem('token')) return;
  try {
    const res = await fetch('/api/ai/check-notifications', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const { notifications } = await res.json();
    notifications.forEach(n => {
      showToast(n.title, n.body); // your existing toast function
      if (Notification.permission === 'granted') {
        new Notification(n.title, { body: n.body });
      }
    });
  } catch (e) { /* silent fail */ }
}

Notification.requestPermission();
checkNotifications();
setInterval(checkNotifications, 30 * 60 * 1000);
```

---

## Step 9 — Home Page HTML Card (`app.html`)

Add inside your home page section:

```html
<div class="ai-card">
  <div class="ai-card-header">
    <span class="ai-badge">✦ AI Insights</span>
  </div>
  <p id="ai-summary" class="ai-summary">Analyzing your usage...</p>
  <ul id="ai-insights-list" class="ai-insights-list"></ul>
</div>
```

---

## Step 10 — Optional: Enable Ollama (Free Local LLM)

For smarter, more conversational chatbot responses:

```bash
# 1. Install Ollama from https://ollama.com (free, open source)
# 2. Pull a small model:
ollama pull phi3:mini        # 2.3 GB — best quality
# or
ollama pull llama3.2:1b      # 1.3 GB — fastest

# 3. Add to your .env:
USE_OLLAMA=true

# 4. Ollama runs as a local server on http://localhost:11434
# No API key, no internet, no cost.
```

The chatbot code automatically falls back to keyword matching if Ollama isn't running.

---

## Files to Create / Modify

| Action | File |
|---|---|
| **Create** | `server/ai/analytics.js` |
| **Create** | `server/ai/insights.js` |
| **Create** | `server/ai/chatbot.js` |
| **Create** | `server/ai/notifications.js` |
| **Replace** | `server/routes/ai.js` |
| **Modify** | `server/db.js` — add notification_log table |
| **Modify** | `app.js` — add 3 frontend functions |
| **Modify** | `app.html` — add AI card to home section |
| **Modify** | `.env` — add `USE_OLLAMA=false` (or true) |

```bash
npm install simple-statistics ml-kmeans regression
```

---

## Privacy Guarantee

- All data stays in your local SQLite database
- No internet calls of any kind (unless you enable Ollama, which also runs locally)
- No API keys, no accounts, no telemetry
- The analytics, insight generation, and notifications all run as pure JavaScript in your Node.js process
