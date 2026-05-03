---
phase: 7
plan: 07-real-time-tracking
type: auto
milestone: 2
title: Real-time Tracking Simulation (PWA Background Tasks)
description: Implement background task simulation for real-time screen time tracking, enabling periodic data sync and notifications even when the app is minimized.
tags:
  - PWA
  - Background Tasks
  - Service Workers
  - Real-time Tracking
depends_on:
  - Phase 6
provides:
  - Background tracking capability
  - Periodic sync infrastructure
  - Notification system foundation
requirements:
  - PWA-01: Background periodic sync
  - PWA-02: Notification permissions
  - PWA-03: Service Worker registration
autonomous: true
wave: 1
---

## Objective

Enable real-time, passive screen time tracking in the background using PWA background tasks and periodic sync. Users will have their screen time logged periodically without active app interaction, with notifications for limit warnings.

## Context

**Current State:**
- Phase 1-6 complete: Full-featured web app with UI, auth, data tracking, and AI coaching
- App requires active tab focus to track screen time
- No background data collection or notifications

**What's needed:**
- Service Worker for background task execution
- Periodic Sync API for regular background data collection
- Notification system for limit alerts and summaries
- Simulated background tracking (since actual OS-level tracking requires native code)
- Data sync when user returns to app or on schedule

## Success Criteria

- [ ] Service Worker registered and active on first app load
- [ ] Background periodic sync configured (every 5-10 minutes)
- [ ] Mock background tracking data collection implemented
- [ ] Notification system working (permissions + display)
- [ ] Daily summary notification sent
- [ ] App persists tracking data even after close
- [ ] Service Worker handles offline scenarios gracefully
- [ ] No console errors related to service workers or notifications

## Implementation Plan

### Task 1: Service Worker Foundation
**Type:** auto  
**Description:** Create and register a Service Worker for the app.

**What to build:**
- New file: `public/service-worker.js` (or in root, served as `/service-worker.js`)
- Service Worker lifecycle: install, activate, fetch events
- Caching strategy: cache app shell on install
- App registration code in `app.js`

**Acceptance:**
- Service Worker installs and activates without errors
- Browser DevTools shows active Service Worker
- Offline navigation returns cached app shell

---

### Task 2: Periodic Sync Registration
**Type:** auto  
**Description:** Implement background periodic sync for data collection.

**What to build:**
- Service Worker handler: `sync` event listener for 'update-tracking' tag
- Registration code in app (requires HTTPS or localhost)
- Sync interval configuration (suggest 5-10 minutes)
- Mock data collection: generate random app usage for background apps

**Acceptance:**
- Periodic sync fires every 5-10 minutes
- Mock data added to LocalStorage/IndexedDB
- Browser DevTools shows registered sync events
- No errors in browser console

---

### Task 3: Notification System
**Type:** auto  
**Description:** Implement notifications for tracking summaries and limit alerts.

**What to build:**
- Notification permission request on app first load
- Notification display logic in service worker
- Two types of notifications:
  1. Hourly summary (e.g., "You've used 2h 15m today")
  2. Limit warnings (when app usage exceeds limit)
- Notification click handlers (return to app, open limits page, etc.)

**Acceptance:**
- Notifications display without errors
- User can grant/deny permissions
- Notifications persist across app close
- Clicking notification brings focus to app or opens specific page

---

### Task 4: Data Persistence & Sync
**Type:** auto  
**Description:** Persist background tracking data and sync on app return.

**What to build:**
- IndexedDB schema for background tracking records
- Background sync data upload to server when online
- App state reconciliation on page focus
- Duplicate detection (avoid double-counting)

**Acceptance:**
- Background data persists after app close
- Data syncs to backend when app opens
- No duplicate records in database
- Server confirms sync with success response

---

### Task 5: Offline Handling & Polish
**Type:** auto  
**Description:** Handle offline scenarios and refine UX.

**What to build:**
- Service Worker network fallback (offline fallback UI if needed)
- Retry logic for failed sync attempts
- Graceful error handling
- Browser console clean (no unhandled errors)

**Acceptance:**
- App loads offline (from cache)
- Failed syncs retry on reconnection
- No console errors
- UX remains responsive during background tasks

---

## Output Spec

### Files to Create
- `.planning/phases/07-real-time-tracking/07-PLAN.md` ← this file
- `.planning/phases/07-real-time-tracking/07-SUMMARY.md` ← after execution
- `public/service-worker.js` — Service Worker implementation
- `server/routes/sync.js` — Backend endpoint for background sync data

### Files to Modify
- `app.js` — Service Worker registration, periodic sync trigger, notification handlers
- `app.html` — Add permission request prompt
- `server/server.js` — Mount new sync endpoint

### Key Technologies
- Service Worker API (MDN Web Docs)
- Periodic Background Sync API (experimental, check browser support)
- Notifications API
- IndexedDB for offline data
- Fetch API for sync requests

## Testing Checklist

- [ ] Service Worker registers on first load (check DevTools Application tab)
- [ ] Periodic sync fires in DevTools (simulate via "Periodic Background Sync" trigger)
- [ ] Notifications request permission and display
- [ ] Background data persists after app close
- [ ] Data syncs when app reopens
- [ ] Offline mode works (DevTools > Network > Offline)
- [ ] No console errors or warnings
- [ ] Mobile browser (if available) shows notifications

## Known Blockers / Considerations

1. **Periodic Sync Browser Support:** Not all browsers support Periodic Background Sync API. Fallback strategy needed for Safari, older browsers.
2. **Notification Permissions:** Requires user opt-in; handle denial gracefully.
3. **Data Accuracy:** Background tracking is simulated (mock data). Real OS-level tracking requires native app (Kotlin/Swift).
4. **HTTPS Requirement:** Service Workers require HTTPS in production (localhost works for dev).

## Related Issues
- Phase 5 AI Integration (used for summary insights)
- Phase 6 Frontend Integration (data sources)
- Phase 8 Data Visualization (will consume background data)

## Metrics to Track
- Service Worker registration success rate
- Notification permission grant rate
- Background sync attempt frequency
- Data sync success rate
- App responsiveness with background tasks
