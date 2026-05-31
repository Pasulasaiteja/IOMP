package com.zenscreen.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

/**
 * BlockedScreenActivity
 *
 * Full-screen "App Blocked" screen shown by TrackingService when:
 *  1. A user opens an app that has exceeded its daily time limit
 *  2. A user opens a social/entertainment app during Focus Mode
 *
 * The user can only dismiss this by pressing "Go Home".
 */
public class BlockedScreenActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep screen on + show above lock screen
        getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
        );

        // Build the UI programmatically (no layout XML needed)
        setContentView(buildUI());
    }

    private View buildUI() {
        String blockedApp = getIntent().getStringExtra("app_name");
        String reason     = getIntent().getStringExtra("reason");
        boolean isFocus   = "focus".equals(getIntent().getStringExtra("type"));

        // Root layout
        android.widget.LinearLayout root = new android.widget.LinearLayout(this);
        root.setOrientation(android.widget.LinearLayout.VERTICAL);
        root.setGravity(android.view.Gravity.CENTER);
        root.setBackgroundColor(0xFF0D0F14); // --bg
        root.setPadding(64, 64, 64, 64);

        // Emoji icon
        TextView icon = new TextView(this);
        icon.setText(isFocus ? "🎯" : "⏱");
        icon.setTextSize(72);
        icon.setGravity(android.view.Gravity.CENTER);
        root.addView(icon);

        spacer(root, 32);

        // Title
        TextView title = new TextView(this);
        title.setText(isFocus ? "Focus Mode Active" : "Time Limit Reached");
        title.setTextColor(0xFFF0F2FF); // --text
        title.setTextSize(26);
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        title.setGravity(android.view.Gravity.CENTER);
        root.addView(title);

        spacer(root, 16);

        // App name
        if (blockedApp != null && !blockedApp.isEmpty()) {
            TextView appLabel = new TextView(this);
            appLabel.setText(blockedApp);
            appLabel.setTextColor(0xFF7B68FF); // --accent
            appLabel.setTextSize(18);
            appLabel.setGravity(android.view.Gravity.CENTER);
            root.addView(appLabel);
        }

        spacer(root, 16);

        // Reason / message
        TextView msg = new TextView(this);
        msg.setText(reason != null ? reason :
                isFocus ? "Social & entertainment apps are blocked\nduring your focus session."
                        : "You've reached your daily limit for this app.\nCome back tomorrow!");
        msg.setTextColor(0xFF8B90B0); // --text2
        msg.setTextSize(14);
        msg.setGravity(android.view.Gravity.CENTER);
        msg.setLineSpacing(4, 1);
        root.addView(msg);

        spacer(root, 48);

        // "Go Home" button
        Button goHome = new Button(this);
        goHome.setText("← Go Home");
        goHome.setTextColor(0xFFFFFFFF);
        goHome.setTextSize(15);
        goHome.setBackgroundColor(0xFF7B68FF); // --accent
        goHome.setPadding(64, 32, 64, 32);
        goHome.setOnClickListener(v -> {
            // Send user to the device home screen
            Intent home = new Intent(Intent.ACTION_MAIN);
            home.addCategory(Intent.CATEGORY_HOME);
            home.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(home);
            finish();
        });
        root.addView(goHome);

        spacer(root, 16);

        // "Open ZenScreen" button
        Button openApp = new Button(this);
        openApp.setText("Open ZenScreen");
        openApp.setTextColor(0xFF7B68FF);
        openApp.setTextSize(14);
        openApp.setBackgroundColor(0x22_7B68FF); // semi-transparent accent
        openApp.setPadding(48, 24, 48, 24);
        openApp.setOnClickListener(v -> {
            Intent zen = new Intent(this, MainActivity.class);
            zen.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(zen);
            finish();
        });
        root.addView(openApp);

        return root;
    }

    private void spacer(android.widget.LinearLayout parent, int dp) {
        View space = new View(this);
        android.widget.LinearLayout.LayoutParams lp =
                new android.widget.LinearLayout.LayoutParams(
                        android.widget.LinearLayout.LayoutParams.MATCH_PARENT, dpToPx(dp));
        parent.addView(space, lp);
    }

    private int dpToPx(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onBackPressed() {
        // Block the back button — user must go home
        Intent home = new Intent(Intent.ACTION_MAIN);
        home.addCategory(Intent.CATEGORY_HOME);
        home.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(home);
        finish();
    }
}
