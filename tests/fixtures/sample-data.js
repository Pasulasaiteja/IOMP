/**
 * Test Fixtures & Sample Data for Phase 7 Testing
 * Provides realistic screen time data for testing notifications and app blocking
 */

/**
 * Sample screen time data for multiple testing scenarios
 * Includes various app usage patterns to test blocking and notifications
 */
export const sampleScreenTimeData = {
  /**
   * Scenario 1: User below daily goal
   * Total: 2h 45m / 6h goal (45% complete)
   */
  belowGoal: {
    totalToday: 165, // minutes
    dailyGoal: 360,
    appBreakdown: [
      { name: 'YouTube', minutes: 60, limit: null },
      { name: 'Instagram', minutes: 45, limit: 60 },
      { name: 'Twitter / X', minutes: 30, limit: null },
      { name: 'Safari', minutes: 30, limit: null }
    ],
    expectedStatus: 'On track - keep it up!',
    shouldNotify: false,
    progressPercent: 45
  },

  /**
   * Scenario 2: User approaching goal
   * Total: 5h 15m / 6h goal (87.5% complete)
   */
  approachingGoal: {
    totalToday: 315,
    dailyGoal: 360,
    appBreakdown: [
      { name: 'YouTube', minutes: 120, limit: 120 },
      { name: 'Instagram', minutes: 90, limit: 60 },
      { name: 'TikTok', minutes: 75, limit: 45 },
      { name: 'Twitter / X', minutes: 30, limit: null }
    ],
    expectedStatus: 'Almost at goal',
    shouldNotify: true, // Instagram and TikTok over limit
    progressPercent: 87.5,
    appsOverLimit: ['Instagram', 'TikTok']
  },

  /**
   * Scenario 3: User exceeded goal
   * Total: 7h 30m / 6h goal (125% complete)
   */
  exceededGoal: {
    totalToday: 450,
    dailyGoal: 360,
    appBreakdown: [
      { name: 'YouTube', minutes: 180, limit: 120 },
      { name: 'Instagram', minutes: 120, limit: 60 },
      { name: 'TikTok', minutes: 90, limit: 45 },
      { name: 'WhatsApp', minutes: 60, limit: 45 }
    ],
    expectedStatus: 'Goal exceeded - time to refocus',
    shouldNotify: true, // All apps over limit
    progressPercent: 125,
    appsOverLimit: ['YouTube', 'Instagram', 'TikTok', 'WhatsApp']
  },

  /**
   * Scenario 4: Severe overusage
   * Total: 10h 30m / 6h goal (175% complete)
   */
  severeOveruse: {
    totalToday: 630,
    dailyGoal: 360,
    appBreakdown: [
      { name: 'YouTube', minutes: 300, limit: 120 },
      { name: 'TikTok', minutes: 180, limit: 45 },
      { name: 'Instagram', minutes: 90, limit: 60 },
      { name: 'Twitter / X', minutes: 60, limit: null }
    ],
    expectedStatus: 'CRITICAL - Significantly over goal',
    shouldNotify: true,
    requireHighPriority: true,
    progressPercent: 175,
    appsOverLimit: ['YouTube', 'TikTok', 'Instagram']
  }
};

/**
 * Sample app limit configurations
 * Used for testing app blocking functionality
 */
export const sampleAppLimits = {
  conservative: [
    { appName: 'YouTube', limitMins: 30 },
    { appName: 'Instagram', limitMins: 20 },
    { appName: 'TikTok', limitMins: 15 },
    { appName: 'Twitter / X', limitMins: 25 },
    { appName: 'WhatsApp', limitMins: 45 }
  ],

  moderate: [
    { appName: 'YouTube', limitMins: 60 },
    { appName: 'Instagram', limitMins: 45 },
    { appName: 'TikTok', limitMins: 45 },
    { appName: 'Twitter / X', limitMins: 60 },
    { appName: 'WhatsApp', limitMins: 120 }
  ],

  generous: [
    { appName: 'YouTube', limitMins: 120 },
    { appName: 'Instagram', limitMins: 90 },
    { appName: 'TikTok', limitMins: 90 },
    { appName: 'Twitter / X', limitMins: 120 },
    { appName: 'WhatsApp', limitMins: 180 }
  ]
};

/**
 * Sample tracking records for background sync testing
 * Represents 1 hour of mock tracking data
 */
export const sampleTrackingRecords = [
  {
    id: 1,
    app_name: 'YouTube',
    minutes: 30,
    date: '2026-05-01',
    timestamp: 1714556400000,
    synced: false,
    user_id: 'test-user-123'
  },
  {
    id: 2,
    app_name: 'Instagram',
    minutes: 25,
    date: '2026-05-01',
    timestamp: 1714557300000,
    synced: false,
    user_id: 'test-user-123'
  },
  {
    id: 3,
    app_name: 'TikTok',
    minutes: 15,
    date: '2026-05-01',
    timestamp: 1714558200000,
    synced: false,
    user_id: 'test-user-123'
  },
  {
    id: 4,
    app_name: 'Twitter / X',
    minutes: 20,
    date: '2026-05-01',
    timestamp: 1714559100000,
    synced: false,
    user_id: 'test-user-123'
  },
  {
    id: 5,
    app_name: 'WhatsApp',
    minutes: 10,
    date: '2026-05-01',
    timestamp: 1714560000000,
    synced: false,
    user_id: 'test-user-123'
  }
];

/**
 * Sample sync batch payloads
 * Used for testing the POST /api/data/sync-tracking endpoint
 */
export const sampleSyncBatches = {
  /**
   * Normal sync with 5 new records
   */
  normalSync: {
    records: [
      {
        app_name: 'YouTube',
        minutes: 30,
        date: '2026-05-01',
        timestamp: Date.now() - 300000
      },
      {
        app_name: 'Instagram',
        minutes: 25,
        date: '2026-05-01',
        timestamp: Date.now() - 240000
      },
      {
        app_name: 'TikTok',
        minutes: 15,
        date: '2026-05-01',
        timestamp: Date.now() - 180000
      },
      {
        app_name: 'Twitter / X',
        minutes: 20,
        date: '2026-05-01',
        timestamp: Date.now() - 120000
      },
      {
        app_name: 'WhatsApp',
        minutes: 10,
        date: '2026-05-01',
        timestamp: Date.now() - 60000
      }
    ]
  },

  /**
   * Duplicate detection test
   * Includes records within 1-minute window
   */
  duplicatesPresent: {
    records: [
      {
        app_name: 'YouTube',
        minutes: 30,
        date: '2026-05-01',
        timestamp: 1714560000000
      },
      {
        app_name: 'YouTube',
        minutes: 30,
        date: '2026-05-01',
        timestamp: 1714560030000 // 30 seconds later - DUPLICATE
      },
      {
        app_name: 'Instagram',
        minutes: 25,
        date: '2026-05-01',
        timestamp: 1714560120000 // 2 minutes later - OK
      }
    ]
  },

  /**
   * Mixed valid and invalid records
   */
  invalidDataPresent: {
    records: [
      {
        app_name: 'YouTube',
        minutes: 30,
        date: '2026-05-01',
        timestamp: Date.now()
      },
      {
        app_name: 'Instagram',
        // Missing 'minutes' and 'date'
        timestamp: Date.now()
      },
      {
        app_name: 'TikTok',
        minutes: 15,
        date: '2026-05-01',
        timestamp: Date.now()
      }
    ]
  },

  /**
   * Large batch for stress testing
   */
  largeBatch: {
    records: Array.from({ length: 50 }, (_, i) => ({
      app_name: ['YouTube', 'Instagram', 'TikTok', 'Twitter / X', 'WhatsApp'][i % 5],
      minutes: Math.floor(Math.random() * 30) + 5,
      date: '2026-05-01',
      timestamp: Date.now() - (i * 60000)
    }))
  }
};

/**
 * Sample notification expectations
 * Used for asserting notification content
 */
export const sampleNotifications = {
  /**
   * Hourly summary - below goal
   */
  hourlySummaryBelowGoal: {
    title: '📊 Your Screen Time: 2h 45m',
    body: 'Keep it up! 195 minutes remaining.',
    tag: 'summary',
    icon: '📱',
    badge: '🎯'
  },

  /**
   * Hourly summary - at or above goal
   */
  hourlySummaryAtGoal: {
    title: '📊 Your Screen Time: 7h 30m',
    body: '⚠️ You\'ve reached your daily goal!',
    tag: 'summary',
    icon: '📱',
    badge: '🎯'
  },

  /**
   * App limit warning - single app
   */
  appLimitWarning: {
    title: '⏰ App Limit Reached',
    body: 'YouTube limit of 120m exceeded!',
    tag: 'limit-YouTube',
    icon: '📱',
    badge: '🎯',
    requireInteraction: true
  },

  /**
   * App limit warning - high priority (severely over limit)
   */
  appLimitWarningHighPriority: {
    title: '⏰ App Limit Reached',
    body: 'TikTok limit of 45m exceeded! (used: 180m)',
    tag: 'limit-TikTok',
    icon: '📱',
    badge: '🎯',
    requireInteraction: true,
    priority: 'high'
  }
};

/**
 * Sample hourly summary calculations
 * Used for testing the showHourlySummary() function
 */
export const sampleHourlySummaries = [
  {
    totalTime: 45,
    dailyGoal: 360,
    formatted: '45m',
    remaining: 315,
    formattedRemaining: '5h 15m',
    percentComplete: 12.5,
    message: 'Keep it up! 315 minutes remaining.'
  },
  {
    totalTime: 180,
    dailyGoal: 360,
    formatted: '3h',
    remaining: 180,
    formattedRemaining: '3h',
    percentComplete: 50,
    message: 'Keep it up! 180 minutes remaining.'
  },
  {
    totalTime: 360,
    dailyGoal: 360,
    formatted: '6h',
    remaining: 0,
    formattedRemaining: 'Goal reached',
    percentComplete: 100,
    message: '⚠️ You\'ve reached your daily goal!'
  },
  {
    totalTime: 450,
    dailyGoal: 360,
    formatted: '7h 30m',
    remaining: -90,
    formattedRemaining: 'Over by 1h 30m',
    percentComplete: 125,
    message: '⚠️ You\'ve exceeded your daily goal!'
  }
];

/**
 * Helper function to generate realistic tracking data
 */
export function generateRealisticTrackingData(durationMinutes = 480) {
  const apps = ['YouTube', 'Instagram', 'TikTok', 'Twitter / X', 'WhatsApp', 'Safari', 'Chrome'];
  const records = [];
  let remainingTime = durationMinutes;
  let currentTime = Date.now() - durationMinutes * 60000; // Start from N minutes ago

  while (remainingTime > 0) {
    const app = apps[Math.floor(Math.random() * apps.length)];
    const sessionDuration = Math.min(Math.floor(Math.random() * 30) + 5, remainingTime);

    records.push({
      app_name: app,
      minutes: sessionDuration,
      date: new Date(currentTime).toISOString().slice(0, 10),
      timestamp: currentTime,
      synced: false
    });

    remainingTime -= sessionDuration;
    currentTime += sessionDuration * 60000;
  }

  return records;
}

/**
 * Helper function to calculate expected notification content
 */
export function getExpectedNotificationContent(totalMinutes, dailyGoal) {
  const isAtGoal = totalMinutes >= dailyGoal;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const formatted = hours > 0 ? `${hours}h${mins > 0 ? mins + 'm' : ''}` : `${mins}m`;

  return {
    title: `📊 Your Screen Time: ${formatted}`,
    body: isAtGoal
      ? '⚠️ You\'ve reached your daily goal!'
      : `Keep it up! ${dailyGoal - totalMinutes} minutes remaining.`
  };
}

/**
 * Helper function to check if app is over limit
 */
export function isAppOverLimit(appUsageMinutes, limitMinutes) {
  return appUsageMinutes >= limitMinutes;
}

/**
 * Sample test user data
 */
export const testUsers = {
  newUser: {
    name: 'E2E Test User',
    email: `e2e-test-${Date.now()}@example.com`,
    password: 'TestPassword123',
    dailyGoal: 360 // 6 hours
  },
  existingUser: {
    email: 'e2e-test@example.com',
    password: 'TestPassword123'
  }
};
