package com.zenscreen.app;

import android.app.AppOpsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * AppBlockerPlugin
 *
 * Capacitor bridge so the JavaScript layer (app.js) can communicate
 * blocked apps and focus mode state to the native TrackingService.
 *
 * JS usage:
 *   const { AppBlocker } = window.Capacitor.Plugins;
 *   AppBlocker.setAppLimit({ appName: 'Instagram', limitMins: 30 });
 *   AppBlocker.setFocusMode({ active: true });
 *   AppBlocker.removeAppLimit({ appName: 'Instagram' });
 *   AppBlocker.checkOverlayPermission();          // → { granted: true/false }
 *   AppBlocker.requestOverlayPermission();         // opens system settings
 */
@CapacitorPlugin(name = "AppBlocker")
public class AppBlockerPlugin extends Plugin {

    static final String PREFS_NAME = "ZenScreenBlocker";

    private String getAppIconBase64(android.content.pm.PackageManager pm, String pkg) {
        try {
            android.graphics.drawable.Drawable icon = pm.getApplicationIcon(pkg);
            android.graphics.Bitmap bitmap = null;
            if (icon instanceof android.graphics.drawable.BitmapDrawable) {
                bitmap = ((android.graphics.drawable.BitmapDrawable) icon).getBitmap();
            } else {
                bitmap = android.graphics.Bitmap.createBitmap(
                        Math.max(icon.getIntrinsicWidth(), 1),
                        Math.max(icon.getIntrinsicHeight(), 1),
                        android.graphics.Bitmap.Config.ARGB_8888);
                android.graphics.Canvas canvas = new android.graphics.Canvas(bitmap);
                icon.setBounds(0, 0, canvas.getWidth(), canvas.getHeight());
                icon.draw(canvas);
            }
            if (bitmap != null) {
                // scale down to max 96x96
                int maxD = 96;
                int w = bitmap.getWidth();
                int h = bitmap.getHeight();
                if (w > maxD || h > maxD) {
                    float ratio = Math.min((float)maxD/w, (float)maxD/h);
                    bitmap = android.graphics.Bitmap.createScaledBitmap(bitmap, Math.round(w*ratio), Math.round(h*ratio), true);
                }
                java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
                bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, bos);
                byte[] bytes = bos.toByteArray();
                return android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP);
            }
        } catch (Exception e) {
            // Ignore
        }
        return null;
    }

    // ── setAppLimit ────────────────────────────────────────────────────────────
    @PluginMethod
    public void setAppLimit(PluginCall call) {
        String appName  = call.getString("appName");
        Integer limitMins = call.getInt("limitMins");

        if (appName == null || limitMins == null) {
            call.reject("appName and limitMins are required");
            return;
        }

        SharedPreferences prefs = getContext()
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        // Load existing limits JSON
        String limitsJson = prefs.getString("app_limits", "{}");
        try {
            JSONObject limits = new JSONObject(limitsJson);
            limits.put(appName, limitMins);
            prefs.edit().putString("app_limits", limits.toString()).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to save limit: " + e.getMessage());
        }
    }

    // ── removeAppLimit ─────────────────────────────────────────────────────────
    @PluginMethod
    public void removeAppLimit(PluginCall call) {
        String appName = call.getString("appName");
        if (appName == null) { call.reject("appName is required"); return; }

        SharedPreferences prefs = getContext()
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        String limitsJson = prefs.getString("app_limits", "{}");
        try {
            JSONObject limits = new JSONObject(limitsJson);
            limits.remove(appName);
            prefs.edit().putString("app_limits", limits.toString()).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to remove limit: " + e.getMessage());
        }
    }

    // ── setFocusMode ───────────────────────────────────────────────────────────
    @PluginMethod
    public void setFocusMode(PluginCall call) {
        Boolean active = call.getBoolean("active");
        if (active == null) { call.reject("active is required"); return; }

        SharedPreferences prefs = getContext()
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean("focus_mode_active", active).apply();

        call.resolve();
    }

    // ── getLimits — returns all stored limits (for debugging) ──────────────────
    @PluginMethod
    public void getLimits(PluginCall call) {
        SharedPreferences prefs = getContext()
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String limitsJson  = prefs.getString("app_limits", "{}");
        boolean focusMode  = prefs.getBoolean("focus_mode_active", false);

        JSObject result = new JSObject();
        result.put("limits", limitsJson);
        result.put("focusModeActive", focusMode);
        call.resolve(result);
    }

    // ── hasUsagePermission ─────────────────────────────────────────────────────
    @PluginMethod
    public void hasUsagePermission(PluginCall call) {
        AppOpsManager appOps = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
        boolean granted = false;
        if (appOps != null) {
            int mode = appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    android.os.Process.myUid(),
                    getContext().getPackageName()
            );
            granted = (mode == AppOpsManager.MODE_ALLOWED);
        }
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    // ── checkOverlayPermission — has SYSTEM_ALERT_WINDOW been granted? ─────────
    /**
     * JS: const { granted } = await AppBlocker.checkOverlayPermission();
     * Returns { granted: boolean }
     *
     * The block overlay cannot be shown unless this returns true.
     * Direct the user to requestOverlayPermission() if false.
     */
    @PluginMethod
    public void checkOverlayPermission(PluginCall call) {
        boolean granted;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            granted = Settings.canDrawOverlays(getContext());
        } else {
            granted = true; // implicitly granted on API < 23
        }
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    // ── requestOverlayPermission — open system overlay settings ────────────────
    /**
     * JS: await AppBlocker.requestOverlayPermission();
     * Opens the system "Draw over other apps" settings screen for ZenScreen.
     * Call this when checkOverlayPermission() returns { granted: false }.
     */
    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                && !Settings.canDrawOverlays(getContext())) {
            try {
                Intent intent = new Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                call.reject("Could not open overlay settings: " + e.getMessage());
            }
        } else {
            // Already granted or API < 23
            call.resolve();
        }
    }

    // ── getUsageStats ──────────────────────────────────────────────────────────
    @PluginMethod
    public void getUsageStats(PluginCall call) {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.LOLLIPOP_MR1) {
            call.reject("UsageStats not supported on this device.");
            return;
        }

        // Check permission first — return clear error if not granted
        AppOpsManager appOps = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
        if (appOps != null) {
            int mode = appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    android.os.Process.myUid(),
                    getContext().getPackageName()
            );
            if (mode != AppOpsManager.MODE_ALLOWED) {
                call.reject("PERMISSION_DENIED: Usage Access not granted. Go to Settings > Apps > Special Access > Usage Access and enable ZenScreen.");
                return;
            }
        }

        android.app.usage.UsageStatsManager usm = (android.app.usage.UsageStatsManager)
                getContext().getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) {
            call.reject("UsageStatsManager unavailable on this device.");
            return;
        }

        // Query from start of today
        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.set(java.util.Calendar.HOUR_OF_DAY, 0);
        cal.set(java.util.Calendar.MINUTE, 0);
        cal.set(java.util.Calendar.SECOND, 0);
        cal.set(java.util.Calendar.MILLISECOND, 0);
        long todayStart = cal.getTimeInMillis();
        long now = System.currentTimeMillis();

        android.util.Log.d("ZenScreen", "Querying usage stats from " + todayStart + " to " + now
                + " (" + ((now - todayStart) / 60000) + " min window)");

        // ══════════════════════════════════════════════════════════════════════
        //  Collect per-package foreground times using exact event parsing.
        //  queryAndAggregateUsageStats uses buckets aligned to UTC, which 
        //  can pull in usage from yesterday evening. queryEvents is exact.
        //
        //  Event types we care about:
        //    1 = ACTIVITY_RESUMED  (app came to foreground)
        //    2 = ACTIVITY_PAUSED   (app left foreground)
        //   23 = ACTIVITY_STOPPED  (some OEMs send this instead of PAUSED)
        //   15 = SCREEN_INTERACTIVE     (screen turned ON)
        //   16 = SCREEN_NON_INTERACTIVE (screen turned OFF)
        //   18 = KEYGUARD_SHOWN   (lock screen appeared)
        //   26 = DEVICE_SHUTDOWN
        //
        //  Sanity cap: no single session > MAX_SESSION_MS (2 hours).
        //  If a gap in events produces a longer duration we clamp it.
        // ══════════════════════════════════════════════════════════════════════
        java.util.Map<String, Long> pkgTimeMs = new java.util.LinkedHashMap<>();

        // Maximum credible single foreground session: 2 hours
        final long MAX_SESSION_MS = 2L * 60 * 60 * 1000;

        try {
            android.app.usage.UsageEvents events = usm.queryEvents(todayStart, now);
            if (events != null) {
                android.app.usage.UsageEvents.Event event = new android.app.usage.UsageEvents.Event();

                // State machine:  currentPkg != null  ⇒  that package is in foreground
                //                 screenOn = true     ⇒  screen is interactive
                String currentPkg = null;
                long   lastResumeTime = 0;
                boolean screenOn = true;          // assume screen is on at start of day

                while (events.hasNextEvent()) {
                    events.getNextEvent(event);
                    String pkg  = event.getPackageName();
                    int    type = event.getEventType();
                    long   ts   = event.getTimeStamp();

                    // ── ACTIVITY_RESUMED (1) ────────────────────────────────
                    if (type == 1) {
                        // Close previous session (if a different package)
                        if (currentPkg != null && !currentPkg.equals(pkg)) {
                            long duration = Math.min(ts - lastResumeTime, MAX_SESSION_MS);
                            if (duration > 0) {
                                Long existing = pkgTimeMs.get(currentPkg);
                                pkgTimeMs.put(currentPkg, (existing == null ? 0L : existing) + duration);
                            }
                        }
                        // Same package re-RESUME (activity transition within app):
                        // do NOT add duration again — just update the resume timestamp
                        // so we keep timing from the original start.
                        if (currentPkg != null && currentPkg.equals(pkg)) {
                            // keep lastResumeTime unchanged — session continues
                        } else {
                            currentPkg = pkg;
                            lastResumeTime = ts;
                        }
                        screenOn = true;
                    }
                    // ── ACTIVITY_PAUSED (2) or ACTIVITY_STOPPED (23) ────────
                    else if (type == 2 || type == 23) {
                        if (currentPkg != null && currentPkg.equals(pkg)) {
                            long duration = Math.min(ts - lastResumeTime, MAX_SESSION_MS);
                            if (duration > 0) {
                                Long existing = pkgTimeMs.get(currentPkg);
                                pkgTimeMs.put(currentPkg, (existing == null ? 0L : existing) + duration);
                            }
                            currentPkg = null;
                        }
                    }
                    // ── SCREEN OFF (16), KEYGUARD (18), SHUTDOWN (26) ───────
                    else if (type == 16 || type == 18 || type == 26) {
                        if (currentPkg != null) {
                            long duration = Math.min(ts - lastResumeTime, MAX_SESSION_MS);
                            if (duration > 0) {
                                Long existing = pkgTimeMs.get(currentPkg);
                                pkgTimeMs.put(currentPkg, (existing == null ? 0L : existing) + duration);
                            }
                            currentPkg = null;
                        }
                        screenOn = false;
                    }
                    // ── SCREEN ON (15) ──────────────────────────────────────
                    else if (type == 15) {
                        screenOn = true;
                        // Don't resume anything — wait for the next ACTIVITY_RESUMED
                    }
                }

                // Add time for the app currently active right now (only if screen is on)
                if (currentPkg != null && screenOn) {
                    long duration = Math.min(now - lastResumeTime, MAX_SESSION_MS);
                    if (duration > 0) {
                        Long existing = pkgTimeMs.get(currentPkg);
                        pkgTimeMs.put(currentPkg, (existing == null ? 0L : existing) + duration);
                    }
                }
                
                android.util.Log.d("ZenScreen", "queryEvents tracked " + pkgTimeMs.size() + " apps exactly.");
                for (java.util.Map.Entry<String, Long> dbg : pkgTimeMs.entrySet()) {
                    android.util.Log.d("ZenScreen", "  RAW: " + dbg.getKey() + " = " + (dbg.getValue()/1000) + "s");
                }
            }
        } catch (Exception e) {
            android.util.Log.w("ZenScreen", "queryEvents failed: " + e.getMessage());
        }

        // ══════════════════════════════════════════════════════════════════════
        //  Filter & build the per-app list for display
        // ══════════════════════════════════════════════════════════════════════

        JSONArray arr = new JSONArray();
        String today = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(new java.util.Date());
        android.content.pm.PackageManager pm = getContext().getPackageManager();

        // Packages to exclude from the visible app list
        java.util.Set<String> EXCLUDED = new java.util.HashSet<>(java.util.Arrays.asList(
            "android",
            "com.android.systemui",
            "com.android.providers.calendar",
            "com.android.providers.contacts",
            "com.android.providers.media",
            "com.android.providers.downloads",
            "com.android.providers.telephony",
            "com.android.providers.settings",
            "com.android.inputmethod.latin",
            "com.android.keychain",
            "com.android.permissioncontroller",
            "com.android.nfc",
            "com.android.bluetooth",
            "com.android.documentsui",
            "com.android.shell",
            "com.android.wallpaper",
            "com.android.wallpapercropper",
            "com.android.stk",
            "com.google.android.gms",
            "com.google.android.gsf",
            "com.google.android.ext.services",
            "com.google.android.providers.media.module",
            "com.google.android.permissioncontroller",
            "com.google.android.settings.intelligence",
            "com.google.android.inputmethod.latin",
            "com.google.android.tts",
            "com.google.android.webview",
            "com.google.android.captiveportallogin",
            "com.google.android.printservice.recommendation",
            "com.google.android.apps.wellbeing",        // Digital Wellbeing itself
            "com.google.android.setupwizard",
            "com.google.android.apps.nexuslauncher",
            // Samsung system packages
            "com.samsung.android.lool",                 // Samsung Device Care
            "com.samsung.android.incallui",
            "com.samsung.android.app.routines",
            "com.samsung.android.themestore",
            "com.samsung.android.mobileservice",
            "com.sec.android.app.samsungapps",
            // Xiaomi / MIUI system packages
            "com.miui.securitycenter",
            "com.miui.cleanmaster",
            "com.xiaomi.finddevice",
            // Realme / OPPO system packages
            "com.coloros.safecenter",
            "com.heytap.browser",
            // Nothing Phone
            "com.nothing.launcher"
        ));

        // Substrings that indicate launcher / system UI
        java.util.List<String> LAUNCHER_HINTS = java.util.Arrays.asList(
            "launcher", "systemui", "nexuslauncher", "homescreen",
            "com.sec.android.app.launcher",
            "com.miui.home",
            "com.huawei.android.launcher",
            "com.oppo.launcher",
            "com.oneplus.launcher",
            "com.google.android.apps.nexuslauncher",
            "com.realme.launcher",
            "com.vivo.launcher",
            "com.nothing.launcher",
            "com.motorola.launcher3",
            "com.teslacoilsw.launcher",       // Nova Launcher
            "com.microsoft.launcher",
            "com.actionlauncher.playstore",
            "bitpit.launcher"
        );

        // Hardcoded friendly names for common packages
        java.util.Map<String, String> FRIENDLY_NAMES = new java.util.HashMap<>();
        FRIENDLY_NAMES.put("com.android.chrome", "Chrome");
        FRIENDLY_NAMES.put("com.chrome.beta", "Chrome Beta");
        FRIENDLY_NAMES.put("com.google.android.youtube", "YouTube");
        FRIENDLY_NAMES.put("com.google.android.apps.youtube.music", "YouTube Music");
        FRIENDLY_NAMES.put("com.google.android.apps.messaging", "Messages");
        FRIENDLY_NAMES.put("com.google.android.apps.maps", "Google Maps");
        FRIENDLY_NAMES.put("com.google.android.apps.photos", "Google Photos");
        FRIENDLY_NAMES.put("com.google.android.gm", "Gmail");
        FRIENDLY_NAMES.put("com.google.android.dialer", "Phone");
        FRIENDLY_NAMES.put("com.google.android.contacts", "Contacts");
        FRIENDLY_NAMES.put("com.google.android.calendar", "Google Calendar");
        FRIENDLY_NAMES.put("com.google.android.apps.docs", "Google Drive");
        FRIENDLY_NAMES.put("com.google.android.keep", "Google Keep");
        FRIENDLY_NAMES.put("com.instagram.android", "Instagram");
        FRIENDLY_NAMES.put("com.whatsapp", "WhatsApp");
        FRIENDLY_NAMES.put("com.facebook.katana", "Facebook");
        FRIENDLY_NAMES.put("com.facebook.lite", "Facebook");
        FRIENDLY_NAMES.put("com.facebook.orca", "Messenger");
        FRIENDLY_NAMES.put("com.twitter.android", "Twitter / X");
        FRIENDLY_NAMES.put("com.snapchat.android", "Snapchat");
        FRIENDLY_NAMES.put("com.reddit.frontpage", "Reddit");
        FRIENDLY_NAMES.put("com.zhiliaoapp.musically", "TikTok");
        FRIENDLY_NAMES.put("com.spotify.music", "Spotify");
        FRIENDLY_NAMES.put("com.netflix.mediaclient", "Netflix");
        FRIENDLY_NAMES.put("com.discord", "Discord");
        FRIENDLY_NAMES.put("com.amazon.avod.thirdpartyclient", "Prime Video");
        FRIENDLY_NAMES.put("in.startv.hotstar", "Disney+ Hotstar");
        FRIENDLY_NAMES.put("com.samsung.android.dialer", "Phone");
        FRIENDLY_NAMES.put("com.samsung.android.messaging", "Messages");

        long totalListMs = 0;

        for (java.util.Map.Entry<String, Long> entry : pkgTimeMs.entrySet()) {
            String pkg = entry.getKey();
            long ms = entry.getValue();

            // Skip very short usage (< 5 seconds is truly noise)
            if (ms < 5000) continue;

            // Skip excluded system packages
            if (EXCLUDED.contains(pkg)) continue;
            if (pkg.startsWith("android.")) continue;

            // Skip launchers & system UI
            boolean isLauncher = false;
            String pkgLower = pkg.toLowerCase(java.util.Locale.US);
            for (String hint : LAUNCHER_HINTS) {
                if (pkgLower.contains(hint)) { isLauncher = true; break; }
            }
            if (isLauncher) continue;

            // Resolve friendly name
            String appName = FRIENDLY_NAMES.get(pkg);
            if (appName == null) {
                try {
                    android.content.pm.ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
                    appName = pm.getApplicationLabel(ai).toString();
                } catch (Exception e) {
                    appName = pkg;
                }
            }

            int minutes = (int) Math.round(ms / 60000.0);
            if (minutes <= 0) minutes = 1;

            totalListMs += ms;

            try {
                JSONObject obj = new JSONObject();
                obj.put("app_name", appName);
                obj.put("package", pkg);
                obj.put("minutes", minutes);
                obj.put("date", today);
                obj.put("timestamp", now);
                String iconBase64 = getAppIconBase64(pm, pkg);
                if (iconBase64 != null) {
                    obj.put("icon_base64", "data:image/png;base64," + iconBase64);
                }
                arr.put(obj);
                android.util.Log.d("ZenScreen", "App: " + appName + " (" + pkg + ") = " + minutes + " min (" + (ms/1000) + "s)");
            } catch(Exception e) {}
        }

        int totalListMinutes = (int) Math.round(totalListMs / 60000.0);
        android.util.Log.d("ZenScreen", "=== SUMMARY: " + totalListMinutes + " min across " + arr.length() + " apps ===");

        JSObject result = new JSObject();
        result.put("stats", arr);
        result.put("total_screen_time_minutes", totalListMinutes);
        result.put("hasPermission", true);
        call.resolve(result);
    }
}

