# Handoff Document: ZenScreen Phase 12 (Final Polish & Testing)

## 🎯 Current Status
The project is currently in **Milestone 3, Phase 12**. We have successfully transitioned the web-based PWA into a fully native Android APK using Capacitor. 

We have written all the native Java code to intercept the Android `UsageStatsManager` to track real screen time, and we have implemented native app blocking functionality (both for per-app daily limits and a Focus Mode that blocks all social/entertainment apps).

**This app is built with a hybrid architecture:**
- **Frontend**: Vanilla JS, HTML, CSS (`app.js`, `app.html`, `index.css`), bundled into `www/` via `scripts/build-www.js`
- **Backend**: Node.js / Express backend (`server/server.js`) connected to SQLite (`sql.js`). The backend provides auth, AI coaching (Gemini), and stores the user's data.
- **Native Wrapper**: Capacitor Android (`android/app/src/main/java/com/zenscreen/app/...`)

---

## 🛑 What Needs To Be Done Next

The next agent needs to assist the user in executing **Phase 12: Build, Testing, and Final Polish**.

### Step 1: User Testing on Physical Device
The user needs to compile the Android app and install it on their physical phone. The backend server is running on the user's PC (`192.168.1.104:3001`). 

**Your task:** Guide the user to open Android Studio, sync the project, build the APK, and run it on their device. Ensure the PC and Phone are on the same Wi-Fi.

### Step 2: Verify Permissions Flow
When the app launches, it triggers a custom `requestAllPermissions()` flow in `MainActivity.java`.
**Your task:** Verify with the user that the following happen:
1. Standard popups for Notifications & Camera.
2. A redirect to the Android "Usage Access" settings screen (crucial for `PACKAGE_USAGE_STATS`). The user MUST toggle ZenScreen "ON".
3. A redirect to the "Battery Optimization" screen. The user MUST allow ZenScreen to run unrestricted in the background.

### Step 3: Test App Blocking & Focus Mode
We wrote a custom Capacitor plugin (`AppBlockerPlugin.java`) and a Foreground Service (`TrackingService.java`) that polls every 3 seconds.
**Your task:** Ask the user to:
1. Log into the app.
2. Go to the "Limits" tab and set a 1-minute limit for an app they have (e.g., YouTube or Instagram).
3. Open that app on their phone and use it for 1 minute.
4. Verify that the `BlockedScreenActivity` (full-screen native Android blocker) successfully pops up and prevents usage.
5. Next, ask the user to start a "Focus Session" in the app, and try opening Instagram or TikTok. It should block them immediately.

### Step 4: Fix Any Native/Bridge Bugs
If the user reports that the block screen isn't showing, or the app isn't connecting to the backend, you need to debug the native Java <-> JS bridge. 
- The JS calls `window.Capacitor.Plugins.AppBlocker.setAppLimit()`.
- The Java plugin saves it to `SharedPreferences`.
- The `TrackingService` reads from `SharedPreferences` every 3 seconds.
**Your task:** Use `adb logcat` via terminal commands to debug the `TrackingService` outputs if it's failing.

### Step 5: Final UI/UX Polish
Once the core native mechanics are verified working, look at the frontend UI (`app.html` / `app.js`). 
**Your task:** Ask the user if any UI elements look broken on the physical mobile screen (e.g., bad padding, broken modals) and fix the CSS accordingly.

---

## 🛠️ Helpful Commands

To rebuild the web assets and push them to Android:
```bash
node scripts/build-www.js --api-url=http://192.168.1.104:3001/api
npx cap sync android
```

To start the backend server (if it crashes):
```bash
node server/server.js
```
