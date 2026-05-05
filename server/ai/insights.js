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
