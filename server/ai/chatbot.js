/**
 * Local chatbot with keyword intent matching + template responses.
 * Zero external dependencies, runs entirely offline.
 */

const { formatMins, hourLabel } = require('./insights');

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
    keywords: ['today', 'how much today', 'screen time today'],
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
        increasing: `Your screen time has been climbing over the past two weeks. Consider a stricter daily limit.`,
        decreasing: `Great! Your screen time is trending down. That's progress worth celebrating.`,
        stable: `Your usage has been pretty consistent. Steady state is good.`
      };
      return map[ctx.trendDirection] || `Not enough data to detect a trend yet.`;
    }
  },
  {
    keywords: ['limit', 'goal', 'how much left', 'remaining'],
    handler: (ctx) => {
      const remaining = Math.max(0, ctx.dailyLimit - (ctx.todayMins || 0));
      return `Your daily limit is ${formatMins(ctx.dailyLimit)}. You have ${formatMins(remaining)} remaining today.`;
    }
  },
  {
    keywords: ['instagram', 'youtube', 'tiktok', 'facebook', 'twitter', 'snapchat', 'whatsapp'],
    handler: (ctx, message) => {
      const lower = message.toLowerCase();
      const appNameMap = {
        instagram: 'Instagram',
        youtube: 'YouTube',
        tiktok: 'TikTok',
        facebook: 'Facebook',
        twitter: 'Twitter / X',
        snapchat: 'Snapchat',
        whatsapp: 'WhatsApp'
      };
      
      for (const [key, appName] of Object.entries(appNameMap)) {
        if (lower.includes(key)) {
          const app = ctx.topApps.find(a => a.name === appName);
          if (app) {
            return `${appName}: ${formatMins(app.totalMins)} over the past 30 days, peak usage around ${hourLabel(app.peakHour)}.`;
          }
        }
      }
      return `I don't have data on that app yet.`;
    }
  },
  {
    keywords: ['tip', 'advice', 'suggest', 'help', 'reduce', 'less', 'cut down'],
    handler: (ctx) => {
      const tips = [
        `Try turning off notifications for non-essential apps during work hours. It breaks the habit loop.`,
        `Schedule phone-free time blocks right after work — before your peak hour (${hourLabel(ctx.peakHour)}) hits.`,
        `Use grayscale mode on ${ctx.topApps[0]?.name || 'your most-used app'} to reduce dopamine triggers.`,
        `Set specific app limits in your device settings. Friction works.`,
        `Replace one hour of screen time with a walk or book. Small wins compound.`
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

/**
 * Main entry point — local keyword matching chatbot.
 */
async function chat(message, ctx) {
  return matchIntent(message, ctx);
}

module.exports = { chat };
