# ZenScreen - Digital Well-Being App

## Architecture & Dependencies

**Frontend:**
- **Stack:** Pure HTML, JavaScript, and CSS (`app.html` & `app.js`).
- **Framework:** Vanilla JS acting as a Single Page Application (SPA).
- **Communication:** Uses standard `fetch` API to communicate with the Node.js backend.

**Backend:**
- **Stack:** Node.js and Express.js (`server/server.js`).
- **Database:** SQLite (`server/zenscreen.db`) using `sql.js`. Includes tables for Users, Screen Time, App Limits, and Preferences.
- **Authentication:** JWT (JSON Web Tokens) and bcrypt for password hashing.
- **AI Integration:** Google Gemini 1.5 Flash API for AI coaching (`server/routes/ai.js`).

**Mobile App Wrapper:**
- **Framework:** [Capacitor](https://capacitorjs.com/) (`@capacitor/core`, `@capacitor/android`). Capacitor wraps the web application and provides access to native Android features.

## Routing & Working
- **Server Routing:** The Express server exposes a RESTful API:
  - `/api/auth/*`: Handles user registration and login.
  - `/api/data/*`: Retrieves user summaries, limits, and logs screen time.
  - `/api/ai/*`: Handles chat messages sent to the Gemini AI coach.
- **Static File Serving:** The server serves the frontend files (HTML/JS) statically. When you hit the root `/`, it redirects to `/app.html`.
- **Syncing:** The Android app continuously talks to the Express server to sync screen time, receive configuration (limits/focus mode), and pull user data.

## How Screen Time is Calculated
The Android native code continuously monitors screen time in the background using a **Foreground Service** (`TrackingService.java`).
1. **Polling:** The service polls every 1 second (`POLL_MS = 1000`) using `UsageStatsManager`.
2. **Accurate Tracking:** Instead of relying on daily usage buckets (which can be inaccurate due to UTC timezones), it uses `UsageStatsManager.queryEvents()` to precisely track `ACTIVITY_RESUMED` and `PAUSED`/`STOPPED` events for specific apps, calculating exact milliseconds spent in the foreground.

## How Apps are Blocked
When an app limit is reached or "Focus Mode" is turned on:
1. `TrackingService.java` detects the target app is in the foreground.
2. It triggers `BlockOverlayManager.java`.
3. **The Overlay:** It uses Android's `WindowManager` with `TYPE_APPLICATION_OVERLAY` to draw a full-screen, system-level visual block directly on top of the phone's screen. 
4. This mechanism prevents the user from using the app without forcing the main ZenScreen app to open. When the user navigates away, the overlay automatically dismisses.
5. **Fallback:** If overlay permissions aren't granted, it falls back to launching `BlockedScreenActivity`.

## About the AI
The AI component is powered by **Google Gemini 1.5 Flash**.
- **Role:** Acts as a personalized "AI Coach" to help users manage their digital well-being.
- **Integration:** Handled in the backend via `/api/ai/chat`. The server attaches the user's screen time context to the prompt, allowing the AI to offer tailored advice (e.g., "You've spent 2 hours on Instagram today, try taking a break!").

## How it becomes an Android App
We use **Capacitor** to bridge the web code to native Android code.
1. The web code (`app.html`, `app.js`) is built into a static `www` folder.
2. Running `npx cap sync android` copies this web bundle into the native Android project folder (`android/app/src/main/assets/public`).
3. The native Android layer (`MainActivity`) loads this local web bundle in a WebView.
4. Custom native Java code (`TrackingService.java`) runs alongside the WebView to handle deep OS integrations (like Usage Stats and Overlays) that a standard website cannot access.

## Android Permissions Required
To achieve this deep system integration, the app requests specific permissions in `AndroidManifest.xml`:
- **Usage Access (`PACKAGE_USAGE_STATS`, `QUERY_ALL_PACKAGES`):** Crucial for reading which apps are in the foreground and tracking screen time.
- **System Overlay (`SYSTEM_ALERT_WINDOW`):** Required to draw the block screen *over* other apps.
- **Background Execution (`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`):** Keeps the screen time tracker running continuously in the background, even after device reboots.
- **Network (`INTERNET`, `ACCESS_NETWORK_STATE`):** To communicate with the local/remote backend server.
- **Notifications (`POST_NOTIFICATIONS`):** To show the ongoing tracking notification (required for foreground services) and alerts.
- **Alarms (`SCHEDULE_EXACT_ALARM`):** Used for Bedtime Mode and scheduled limits.
- **Media/Camera (`CAMERA`, `READ_MEDIA_IMAGES`):** For scanning QR codes or taking profile photos.
