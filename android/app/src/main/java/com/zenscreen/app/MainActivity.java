package com.zenscreen.app;

import android.Manifest;
import android.app.AppOpsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int PERMISSION_REQUEST_CODE = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // ⚠️ IMPORTANT: registerPlugin MUST be called BEFORE super.onCreate()
        // The Capacitor bridge initializes inside super.onCreate(), so plugins
        // registered after that are invisible to the JavaScript layer.
        registerPlugin(AppBlockerPlugin.class);

        super.onCreate(savedInstanceState);
        
        // Start the background tracking service immediately
        Intent serviceIntent = new Intent(this, TrackingService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
        
        requestAllPermissions();
    }

    private void requestAllPermissions() {
        // ── 1. Runtime permissions (POST_NOTIFICATIONS, CAMERA, etc.) ──────────
        java.util.List<String> permsToRequest = new java.util.ArrayList<>();

        // Notifications (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this,
                    Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                permsToRequest.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }

        // Camera
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            permsToRequest.add(Manifest.permission.CAMERA);
        }

        // Media / Storage
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this,
                    Manifest.permission.READ_MEDIA_IMAGES)
                    != PackageManager.PERMISSION_GRANTED) {
                permsToRequest.add(Manifest.permission.READ_MEDIA_IMAGES);
            }
        } else {
            if (ContextCompat.checkSelfPermission(this,
                    Manifest.permission.READ_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {
                permsToRequest.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            }
        }

        // Request all runtime permissions at once
        if (!permsToRequest.isEmpty()) {
            ActivityCompat.requestPermissions(
                    this,
                    permsToRequest.toArray(new String[0]),
                    PERMISSION_REQUEST_CODE
            );
        }

        // ── 2. PACKAGE_USAGE_STATS — must be granted via System Settings ───────
        if (!hasUsageStatsPermission()) {
            // Delay slightly so it doesn't interrupt app cold start
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                try {
                    Intent usageIntent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
                    usageIntent.setData(Uri.parse("package:" + getPackageName()));
                    usageIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(usageIntent);
                } catch (Exception e) {
                    // Some devices don't support the per-app deeplink — open the general screen
                    try {
                        startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                    } catch (Exception ex) {
                        android.util.Log.e("ZenScreen", "Could not open Usage Access settings", ex);
                    }
                }
            }, 2000); // 2 second delay
        }

        // ── 3. SYSTEM_ALERT_WINDOW — "Draw over other apps" ────────────────────
        //    Required for the block screen overlay to appear over blocked apps
        //    without needing ZenScreen's Activity to be in the foreground.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                    try {
                        Intent overlayIntent = new Intent(
                                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                Uri.parse("package:" + getPackageName()));
                        overlayIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(overlayIntent);
                    } catch (Exception e) {
                        android.util.Log.e("ZenScreen",
                                "Could not open overlay permission settings", e);
                    }
                }, 4000); // Staggered after Usage Access prompt to avoid stacking dialogs
            }
        }

        // ── 4. Battery optimisation exemption (keeps app alive in background) ──
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                Intent intent = new Intent(
                        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                        Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            }
        }

        // ── 5. Exact Alarms (Android 12+, needed for precise reminders) ────────
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            android.app.AlarmManager alarmManager =
                    (android.app.AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null && !alarmManager.canScheduleExactAlarms()) {
                Intent intent = new Intent(
                        Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                        Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            }
        }
    }

    /**
     * Checks if the app has PACKAGE_USAGE_STATS permission and SYSTEM_ALERT_WINDOW.
     */
    private boolean hasUsageStatsPermission() {
        AppOpsManager appOps = (AppOpsManager) getSystemService(Context.APP_OPS_SERVICE);
        if (appOps == null) return false;
        int mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                getPackageName()
        );
        return mode == AppOpsManager.MODE_ALLOWED;
    }
}
