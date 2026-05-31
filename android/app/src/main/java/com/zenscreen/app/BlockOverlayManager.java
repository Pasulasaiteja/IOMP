package com.zenscreen.app;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * BlockOverlayManager
 *
 * Draws a full-screen system overlay using WindowManager + TYPE_APPLICATION_OVERLAY
 * (requires the SYSTEM_ALERT_WINDOW / "Draw over other apps" permission).
 *
 * Unlike BlockedScreenActivity, this overlay can be shown while ANY app is
 * in the foreground, because it is not bound to an Activity lifecycle.
 *
 * Usage:
 *   BlockOverlayManager mgr = new BlockOverlayManager(context);
 *   mgr.show("Instagram", "focus", "Focus Mode is active…");
 *   mgr.dismiss();
 *   mgr.isShowing();
 */
public class BlockOverlayManager {

    private static final String TAG = "ZenScreen";

    private final Context        context;
    private final WindowManager  windowManager;
    private       View           overlayView;
    private       boolean        showing = false;

    public BlockOverlayManager(Context context) {
        this.context      = context.getApplicationContext();
        this.windowManager = (WindowManager) this.context.getSystemService(Context.WINDOW_SERVICE);
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /** Returns true if the overlay is currently visible. */
    public boolean isShowing() {
        return showing;
    }

    /**
     * Shows the block overlay. Safe to call even if the overlay is already showing
     * (it will update the content if the blocked app has changed).
     *
     * @param appName     Human-readable name of the blocked app (e.g. "Instagram")
     * @param type        "focus" or "limit"
     * @param reason      Detail message shown on the overlay
     */
    public void show(String appName, String type, String reason) {
        if (!canDrawOverlays()) {
            Log.w(TAG, "SYSTEM_ALERT_WINDOW not granted — cannot show overlay");
            return;
        }

        // Remove existing overlay first so we always show fresh content
        dismissInternal();

        overlayView = buildOverlayView(appName, type, reason);

        WindowManager.LayoutParams params = buildLayoutParams();

        try {
            windowManager.addView(overlayView, params);
            showing = true;
            Log.d(TAG, "Block overlay shown for: " + appName);
        } catch (Exception e) {
            Log.e(TAG, "Failed to add overlay view: " + e.getMessage(), e);
            overlayView = null;
        }
    }

    /**
     * Dismisses the overlay if it is currently visible.
     */
    public void dismiss() {
        dismissInternal();
        Log.d(TAG, "Block overlay dismissed");
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private void dismissInternal() {
        if (overlayView != null) {
            try {
                windowManager.removeView(overlayView);
            } catch (Exception ignored) {
                // View may already have been removed (e.g. config change)
            }
            overlayView = null;
        }
        showing = false;
    }

    /**
     * Checks whether the SYSTEM_ALERT_WINDOW permission has been granted.
     * On API < 23 it is implicitly granted.
     */
    public boolean canDrawOverlays() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return Settings.canDrawOverlays(context);
        }
        return true;
    }

    /** Build the WindowManager layout parameters for a full-screen overlay. */
    @SuppressWarnings("deprecation")
    private WindowManager.LayoutParams buildLayoutParams() {
        int type;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // API 26+ — TYPE_APPLICATION_OVERLAY is the correct replacement for
            // the deprecated TYPE_SYSTEM_OVERLAY / TYPE_PHONE
            type = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        } else {
            type = WindowManager.LayoutParams.TYPE_PHONE;
        }

        return new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                type,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
                android.graphics.PixelFormat.TRANSLUCENT
        );
    }

    // ── UI construction ───────────────────────────────────────────────────────

    private View buildOverlayView(String appName, String type, String reason) {
        boolean isFocus = "focus".equals(type);

        // Root
        LinearLayout root = new LinearLayout(context);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(0xFF0D0F14); // dark background
        root.setPadding(dp(64), dp(64), dp(64), dp(64));

        // ── Icon ────────────────────────────────────────────────────────────
        TextView icon = new TextView(context);
        icon.setText(isFocus ? "🎯" : "⏱");
        icon.setTextSize(72);
        icon.setGravity(Gravity.CENTER);
        root.addView(icon);

        addSpacer(root, 32);

        // ── Title ───────────────────────────────────────────────────────────
        TextView title = new TextView(context);
        title.setText(isFocus ? "Focus Mode Active" : "Time Limit Reached");
        title.setTextColor(0xFFF0F2FF);
        title.setTextSize(26);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        root.addView(title);

        addSpacer(root, 16);

        // ── App name ─────────────────────────────────────────────────────────
        if (appName != null && !appName.isEmpty()) {
            TextView appLabel = new TextView(context);
            appLabel.setText(appName);
            appLabel.setTextColor(0xFF7B68FF); // accent
            appLabel.setTextSize(18);
            appLabel.setGravity(Gravity.CENTER);
            root.addView(appLabel);
        }

        addSpacer(root, 16);

        // ── Reason message ───────────────────────────────────────────────────
        TextView msg = new TextView(context);
        msg.setText(reason != null ? reason :
                isFocus ? "Social & entertainment apps are blocked\nduring your focus session."
                        : "You've reached your daily limit.\nCome back tomorrow!");
        msg.setTextColor(0xFF8B90B0);
        msg.setTextSize(14);
        msg.setGravity(Gravity.CENTER);
        msg.setLineSpacing(4, 1);
        root.addView(msg);

        addSpacer(root, 48);

        // ── "Go Home" button ─────────────────────────────────────────────────
        Button goHome = new Button(context);
        goHome.setText("← Go Home");
        goHome.setTextColor(Color.WHITE);
        goHome.setTextSize(15);
        goHome.setBackgroundColor(0xFF7B68FF);
        goHome.setPadding(dp(64), dp(32), dp(64), dp(32));
        goHome.setOnClickListener(v -> {
            Intent home = new Intent(Intent.ACTION_MAIN);
            home.addCategory(Intent.CATEGORY_HOME);
            home.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(home);
            dismissInternal();
        });
        root.addView(goHome);

        addSpacer(root, 16);

        // ── "Open ZenScreen" button ──────────────────────────────────────────
        Button openApp = new Button(context);
        openApp.setText("Open ZenScreen");
        openApp.setTextColor(0xFF7B68FF);
        openApp.setTextSize(14);
        openApp.setBackgroundColor(0x227B68FF); // semi-transparent accent
        openApp.setPadding(dp(48), dp(24), dp(48), dp(24));
        openApp.setOnClickListener(v -> {
            Intent zen = new Intent(context, MainActivity.class);
            zen.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            context.startActivity(zen);
            dismissInternal();
        });
        root.addView(openApp);

        return root;
    }

    private void addSpacer(LinearLayout parent, int heightDp) {
        View space = new View(context);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(heightDp));
        parent.addView(space, lp);
    }

    private int dp(int value) {
        float density = context.getResources().getDisplayMetrics().density;
        return Math.round(value * density);
    }
}
