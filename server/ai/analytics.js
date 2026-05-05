const ss = require('simple-statistics');
const regression = require('regression');

/**
 * Analyzes a user's usage data and returns structured stats.
 * All input comes from SQLite screen_time table.
 */
function analyzeUsage(rows) {
  // rows = [{ app_name, minutes, date }, ...]

  const byApp = {};
  const byHour = Array(24).fill(0);
  const byDayOfWeek = Array(7).fill(0);
  const byDate = {};

  rows.forEach(row => {
    const date = new Date(row.date);
    const hour = date.getHours();
    const dow = date.getDay(); // 0=Sun, 6=Sat
    const dateStr = row.date.split('T')[0];
    const mins = row.minutes || 0;

    // App totals
    if (!byApp[row.app_name]) {
      byApp[row.app_name] = { total: 0, sessions: [], hours: Array(24).fill(0) };
    }
    byApp[row.app_name].total += mins;
    byApp[row.app_name].sessions.push(mins);
    byApp[row.app_name].hours[hour] += mins;

    // Global hour/day distribution
    byHour[hour] += mins;
    byDayOfWeek[dow] += mins;

    // Daily totals
    byDate[dateStr] = (byDate[dateStr] || 0) + mins;
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
    ? trendResult.equation[0] > 5 ? 'increasing' : trendResult.equation[0] < -5 ? 'decreasing' : 'stable'
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
