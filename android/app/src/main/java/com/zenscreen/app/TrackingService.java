package com.zenscreen.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.SortedMap;
import java.util.TreeMap;

/**
 * TrackingService
 *
 * Foreground service that:
 *  1. Polls UsageStatsManager every 1 second to detect the current foreground app
 *  2. Checks if that app is over its daily limit → shows system overlay via BlockOverlayManager
 *  3. Checks if Focus Mode is active and the app is social/entertainment → blocks it
 *  4. Dismisses the overlay when the user navigates away from the blocked app
 *
 * The overlay is drawn using WindowManager TYPE_APPLICATION_OVERLAY so it appears
 * on top of any foreground app without requiring an Activity launch.
 */
public class TrackingService extends Service {

    private static final String TAG        = "ZenScreen";
    private static final String CHANNEL_ID = "zenscreen_tracking";
    private static final int    NOTIF_ID   = 9001;

    /**
     * Poll every 1 second — fast enough to catch app launches within ~1 s,
     * while keeping CPU usage negligible (UsageStats query is cheap).
     */
    private static final long POLL_MS = 1000L;

    private Handler              handler;
    private Runnable             pollTask;
    private BlockOverlayManager  overlayManager;

    /** Package name of the app whose overlay is currently displayed (null = none). */
    private String  currentBlockedPkg = null;

    // Packages considered "social / entertainment" (blocked during Focus Mode)
    private static final Set<String> SOCIAL_PACKAGES = new HashSet<>(Arrays.asList(
        "com.instagram.android",
        "com.twitter.android",
        "com.twitter.android.lite",
        "com.zhiliaoapp.musically",   // TikTok
        "com.facebook.katana",
        "com.facebook.lite",
        "com.facebook.orca",          // Messenger
        "com.snapchat.android",
        "com.reddit.frontpage",
        "com.pinterest",
        "com.tumblr",
        "com.discord",
        "com.google.android.youtube",
        "com.vimeo.android.videoapp",
        "tv.twitch.android.app",
        "com.netflix.mediaclient",
        "com.amazon.avod.thirdpartyclient",  // Prime Video
        "in.startv.hotstar",                 // Disney+
        "com.spotify.music",
        "com.whatsapp",
        "com.whatsapp.w4b"
    ));

    // Map friendly names to package names (for limits set by JS via app name)
    private String getFriendlyName(String packageName) {
        switch (packageName) {
            case "com.instagram.android":         return "Instagram";
            case "com.google.android.youtube":    return "YouTube";
            case "com.twitter.android":
            case "com.twitter.android.lite":      return "Twitter / X";
            case "com.zhiliaoapp.musically":      return "TikTok";
            case "com.whatsapp":                  return "WhatsApp";
            case "com.facebook.katana":
            case "com.facebook.lite":             return "Facebook";
            case "com.snapchat.android":          return "Snapchat";
            case "com.reddit.frontpage":          return "Reddit";
            case "com.google.android.apps.chrome":return "Chrome";
            case "com.android.chrome":            return "Chrome";
            case "com.spotify.music":             return "Spotify";
            case "com.netflix.mediaclient":       return "Netflix";
            case "com.discord":                   return "Discord";
            default:
                try {
                    PackageManager pm = getPackageManager();
                    ApplicationInfo ai = pm.getApplicationInfo(packageName, 0);
                    return pm.getApplicationLabel(ai).toString();
                } catch (Exception e) {
                    return packageName;
                }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════════

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        Notification notif = buildNotification("Monitoring screen time…");
        if (Build.VERSION.SDK_INT >= 34) { // Android 14 (UPSIDE_DOWN_CAKE)
            startForeground(NOTIF_ID, notif,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIF_ID, notif);
        }

        overlayManager = new BlockOverlayManager(this);
        startPolling();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // START_STICKY ensures the OS restarts us if we are killed
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (handler != null && pollTask != null) handler.removeCallbacks(pollTask);
        // Clean up the overlay if the service is stopped
        if (overlayManager != null) overlayManager.dismiss();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  POLLING
    // ═══════════════════════════════════════════════════════════════════════════

    private void startPolling() {
        handler  = new Handler(Looper.getMainLooper());
        pollTask = new Runnable() {
            @Override
            public void run() {
                try {
                    checkForegroundApp();
                } catch (Exception e) {
                    Log.e(TAG, "checkForegroundApp error: " + e.getMessage(), e);
                }
                handler.postDelayed(this, POLL_MS);
            }
        };
        handler.post(pollTask);
    }

    private void checkForegroundApp() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP_MR1) return;

        UsageStatsManager usm = (UsageStatsManager)
                getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return;

        long now  = System.currentTimeMillis();
        long from = now - 3_000; // look back 3 seconds to find the most recent app

        List<UsageStats> stats = usm.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY, from, now);
        if (stats == null || stats.isEmpty()) return;

        // Find the most-recently-used app
        SortedMap<Long, UsageStats> sorted = new TreeMap<>();
        for (UsageStats s : stats) {
            sorted.put(s.getLastTimeUsed(), s);
        }
        if (sorted.isEmpty()) return;

        UsageStats current = sorted.get(sorted.lastKey());
        String pkg = current.getPackageName();

        // ── Dismiss overlay if user navigated away from the blocked app ─────
        if (currentBlockedPkg != null && !pkg.equals(currentBlockedPkg)) {
            Log.d(TAG, "User left blocked app (" + currentBlockedPkg + "), dismissing overlay");
            overlayManager.dismiss();
            currentBlockedPkg = null;
        }

        // Ignore our own app and system packages — never block them
        if (pkg.equals(getPackageName())) return;
        if (pkg.contains("launcher") || pkg.contains("systemui")) return;
        // Also ignore when overlay itself is the "foreground" context
        if (overlayManager.isShowing() && pkg.equals(currentBlockedPkg)) return;

        String friendlyName = getFriendlyName(pkg);

        // ── Read preferences ─────────────────────────────────────────────────
        SharedPreferences prefs = getSharedPreferences(
                AppBlockerPlugin.PREFS_NAME, Context.MODE_PRIVATE);
        boolean focusActive = prefs.getBoolean("focus_mode_active", false);
        String  limitsJson  = prefs.getString("app_limits", "{}");

        // ── CHECK 1: Focus Mode → block social/entertainment ─────────────────
        if (focusActive && SOCIAL_PACKAGES.contains(pkg)) {
            if (!pkg.equals(currentBlockedPkg)) {
                Log.d(TAG, "BLOCKED (Focus Mode): " + friendlyName);
                showBlockOverlay(pkg, friendlyName, "focus",
                        "Social & entertainment apps are blocked\nduring your focus session.\n\nStay focused! 🎯");
            }
            return;
        }

        // ── CHECK 2: Per-app daily limit ─────────────────────────────────────
        try {
            JSONObject limits = new JSONObject(limitsJson);
            if (limits.has(friendlyName)) {
                int limitMins = limits.getInt(friendlyName);

                // Calculate today's usage using queryEvents (accurate)
                // instead of queryUsageStats which can inflate due to UTC bucket alignment
                long todayStart = getStartOfDay();
                long usedMs = getAccurateUsageMs(usm, pkg, todayStart, now);
                long usedMins = usedMs / 60_000;

                if (usedMins >= limitMins) {
                    if (!pkg.equals(currentBlockedPkg)) {
                        Log.d(TAG, "BLOCKED (Limit): " + friendlyName
                                + " used " + usedMins + "m / limit " + limitMins + "m");
                        showBlockOverlay(pkg, friendlyName, "limit",
                                "You've used " + friendlyName + " for " + usedMins
                                        + " min today.\nYour limit is " + limitMins
                                        + " min.\n\nTake a break! 🌿");
                    }
                } else {
                    Log.v(TAG, "Limit check: " + friendlyName + " used " + usedMins + "m / limit " + limitMins + "m");
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking limits: " + e.getMessage());
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  BLOCK OVERLAY
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Shows the system-level WindowManager overlay.
     *
     * If SYSTEM_ALERT_WINDOW permission is not granted, falls back to the
     * original startActivity() approach as a last resort.
     */
    private void showBlockOverlay(String pkg, String appName, String type, String reason) {
        currentBlockedPkg = pkg;

        if (overlayManager.canDrawOverlays()) {
            // Primary path: draw directly via WindowManager — works from background
            overlayManager.show(appName, type, reason);
        } else {
            // Fallback: launch the BlockedScreenActivity (only works if our app
            // can come to foreground — limited on API 29+ but better than nothing)
            Log.w(TAG, "Overlay permission not granted, falling back to Activity");
            Intent block = new Intent(this, BlockedScreenActivity.class);
            block.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            block.putExtra("app_name", appName);
            block.putExtra("type", type);
            block.putExtra("reason", reason);
            startActivity(block);
        }
    }

    private long getStartOfDay() {
        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.set(java.util.Calendar.HOUR_OF_DAY, 0);
        cal.set(java.util.Calendar.MINUTE, 0);
        cal.set(java.util.Calendar.SECOND, 0);
        cal.set(java.util.Calendar.MILLISECOND, 0);
        return cal.getTimeInMillis();
    }

    /**
     * Calculate accurate foreground time for a specific package using queryEvents.
     * This avoids the UTC-bucket inflation issue in queryUsageStats + getTotalTimeInForeground.
     */
    private long getAccurateUsageMs(UsageStatsManager usm, String targetPkg, long from, long to) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP_MR1) return 0;
        final long MAX_SESSION_MS = 2L * 60 * 60 * 1000; // 2-hour sanity cap
        long totalMs = 0;

        try {
            android.app.usage.UsageEvents events = usm.queryEvents(from, to);
            if (events == null) return 0;

            android.app.usage.UsageEvents.Event event = new android.app.usage.UsageEvents.Event();
            boolean inForeground = false;
            long resumeTs = 0;

            while (events.hasNextEvent()) {
                events.getNextEvent(event);
                String pkg = event.getPackageName();
                int type = event.getEventType();
                long ts = event.getTimeStamp();

                if (pkg.equals(targetPkg)) {
                    if (type == 1) { // ACTIVITY_RESUMED
                        if (!inForeground) {
                            inForeground = true;
                            resumeTs = ts;
                        }
                    } else if (type == 2 || type == 23) { // PAUSED or STOPPED
                        if (inForeground) {
                            totalMs += Math.min(ts - resumeTs, MAX_SESSION_MS);
                            inForeground = false;
                        }
                    }
                } else {
                    // Different package resumed — close our session
                    if (type == 1 && inForeground) {
                        totalMs += Math.min(ts - resumeTs, MAX_SESSION_MS);
                        inForeground = false;
                    }
                }

                // Screen off / keyguard / shutdown closes any open session
                if (type == 16 || type == 18 || type == 26) {
                    if (inForeground) {
                        totalMs += Math.min(ts - resumeTs, MAX_SESSION_MS);
                        inForeground = false;
                    }
                }
            }

            // If still in foreground right now
            if (inForeground) {
                totalMs += Math.min(to - resumeTs, MAX_SESSION_MS);
            }
        } catch (Exception e) {
            Log.w(TAG, "getAccurateUsageMs failed for " + targetPkg + ": " + e.getMessage());
        }

        return totalMs;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  NOTIFICATION
    // ═══════════════════════════════════════════════════════════════════════════

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID,
                    "ZenScreen Background Tracking",
                    NotificationManager.IMPORTANCE_MIN
            );
            ch.setDescription("Tracks screen time and enforces app limits");
            ch.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification(String text) {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("ZenScreen")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_recent_history)
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setSilent(true)
                .setOngoing(true)
                .build();
    }
}
