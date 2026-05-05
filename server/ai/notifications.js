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
      title: '⚠️ Approaching daily limit',
      body: `You've used ${formatMins(todayMins)} today — only ${formatMins(remaining)} left of your ${formatMins(dailyLimit)} limit.`
    });
  }

  // ── Rule 2: Daily limit exceeded (fire once) ─────────────────────────────
  if (!alreadyFiredToday.has('limit_exceeded') && todayMins >= dailyLimit) {
    const over = Math.round(todayMins - dailyLimit);
    notifications.push({
      type: 'limit_exceeded',
      title: '🛑 Daily limit exceeded',
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
        title: '📈 Higher than usual today',
        body: `You're ${pct}% above your typical usage for ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}.`
      });
    }
  }

  // ── Rule 4: Evening wind-down nudge (8–10 PM, once per day) ─────────────
  if (!alreadyFiredToday.has('evening_nudge') && hour >= 20 && hour < 22) {
    const messages = [
      `It's ${hour}:00 PM. Your screen time today is ${formatMins(todayMins)}. Consider winding down for better sleep.`,
      `Evening wind-down hour! 🌙 You've used ${formatMins(todayMins)} today. Put the phone down for better rest.`,
      `${formatMins(todayMins)} logged today. The next 2 hours before sleep are your mental recovery window — protect them.`,
    ];
    notifications.push({
      type: 'evening_nudge',
      title: '🌙 Time to wind down',
      body: messages[Math.floor(Math.random() * messages.length)]
    });
  }

  // ── Rule 5: Increasing trend weekly summary (Monday morning only) ────────
  const today = new Date();
  if (!alreadyFiredToday.has('trend_alert') && today.getDay() === 1 && hour >= 9 && hour < 10) {
    if (trendDirection === 'increasing') {
      notifications.push({
        type: 'trend_alert',
        title: '📊 Usage trending up',
        body: `Your screen time has been climbing over the past 2 weeks. Time to make a change?`
      });
    } else if (trendDirection === 'decreasing') {
      notifications.push({
        type: 'trend_alert',
        title: '🎉 Usage trending down',
        body: `Great week! Your screen time is decreasing. Keep the momentum going.`
      });
    }
  }

  return notifications;
}

module.exports = { checkNotifications };
