# Phase 7 Verification Guide

## Pre-Test Setup

**Server Status:**
```bash
cd server && npm start
# Expected output:
# 🚀 ZenScreen Server Running
# 🔗 http://localhost:3001
# 📁 Database: server/zenscreen.db
```

**Client Access:**
```
Open browser: http://localhost:3001/app.html
Create account or login
```

---

## Test Sequence (Copy-Paste Compatible)

### ✅ Test 1: Service Worker Registration

**Steps:**
1. Open DevTools: `F12` or `Cmd+Option+I`
2. Go to **Application** tab (Chrome/Edge) or **Storage** (Firefox)
3. Click **Service Workers** in left sidebar
4. Verify: Shows "http://localhost:3001/service-worker.js" with status **"activated and running"**

**Expected:**
```
Scope: http://localhost:3001/
Status: activated and running
```

**Console should show:**
```
[App] Service Worker registered: {registration object}
```

---

### ✅ Test 2: Offline Loading

**Steps:**
1. Keep DevTools open
2. Go to **Network** tab
3. Check **Offline** checkbox (simulates airplane mode)
4. Refresh page (`Cmd+R` or `Ctrl+Shift+R`)

**Expected:**
- Page loads fully (even though network is offline)
- Network tab shows cached assets
- App is fully functional (can read data)

**Console should show:**
```
[ServiceWorker] Fetch from cache for: /app.html
[ServiceWorker] Serving offline fallback
```

---

### ✅ Test 3: Notification Permission

**Steps:**
1. Go back online (uncheck Offline)
2. Refresh page
3. Browser shows notification permission prompt
4. Click **Allow** (or note if it doesn't appear again)

**Expected:**
- Browser notification permission dialog appears
- After clicking "Allow", `Notification.permission === "granted"`

**Console should show:**
```
[App] Service Worker registered: {registration object}
[App] Notification permission: granted
```

---

### ✅ Test 4: Periodic Sync (Simulate)

**Steps:**
1. Keep DevTools open, go to **Application** tab
2. In left sidebar, click **Service Workers**
3. Under your service worker, look for **Periodic Background Sync** section (or expand)
4. Click button to simulate sync event

**Expected:**
- Console shows sync start message
- IndexedDB receives new mock data
- If multiple simulations, check for duplicate prevention

**Console should show:**
```
[ServiceWorker] Sync event: sync-tracking
[ServiceWorker] Starting background sync...
[ServiceWorker] Sync attempt 1/3
[ServiceWorker] Sync successful
[App] Added background tracking: YouTube 12 minutes
```

---

### ✅ Test 5: IndexedDB Inspection

**Steps:**
1. In DevTools, go to **Application** → **IndexedDB** (left sidebar)
2. Expand **http://localhost:3001**
3. Click **ZenScreenTracking**
4. Click **tracking** object store
5. View records

**Expected:**
```
Object Store: tracking
Key | app_name | minutes | date | timestamp | synced
1   | YouTube  | 15      | 2026-05-01 | 17... | false (pending) or true (synced)
```

---

### ✅ Test 6: Manual Periodic Sync (5-minute test)

**Steps:**
1. Keep console open and app running
2. Wait 5 minutes (or simulate with DevTools)
3. Check IndexedDB for new record
4. Check server logs for sync attempt

**Expected:**
- Every 5 minutes, `[App] Added background tracking: [app name] X minutes`
- IndexedDB receives new record
- Server logs show `/api/data/sync-tracking` POST request

---

### ✅ Test 7: Hourly Summary Notification

**Setup (one-time):**
1. Note current time
2. Calculate seconds until top of next hour
3. E.g., if it's 14:37, next hour is 15:00 = 1,380 seconds away

**Steps:**
1. Keep app open
2. Wait until top of next hour (or manually adjust system clock)
3. Notification should appear: "📊 Your Screen Time: X minutes"

**Expected:**
```
Title: 📊 Your Screen Time: 2h 15m
Body: Keep it up! 105 minutes remaining.
   OR
Body: ⚠️ You've reached your daily goal!
```

**Console should show:**
```
[App] Summary notification failed: [error] (if API fails)
   OR
[App] Notification sent: 📊 Your Screen Time: ...
```

---

### ✅ Test 8: App Limit Warning Notification

**Setup:**
1. Go to **Limits** page in app
2. Set a very low limit (e.g., 5 minutes) for an app

**Steps:**
1. Simulate tracking data for that app exceeding limit
2. Trigger `checkLimitAndNotify()` or wait for periodic sync

**Expected:**
```
Title: ⏰ App Limit Reached
Body: YouTube limit of 5m exceeded!
(Click → navigates to Limits page)
```

---

### ✅ Test 9: Offline Sync with Retry

**Setup:**
1. Open DevTools Network tab
2. Set network throttling to **Offline**

**Steps:**
1. App running offline
2. Trigger periodic sync (or wait 5 minutes)
3. Console shows retry attempts: 2s wait → 4s wait → 8s wait
4. Go back **Online**
5. Next sync attempt should succeed

**Expected Console:**
```
[ServiceWorker] Sync attempt 1/3
[ServiceWorker] Network error: fetch failed
[ServiceWorker] Sync attempt 2/3 (after 2s backoff)
[ServiceWorker] Network error: fetch failed
[ServiceWorker] Sync attempt 3/3 (after 4s backoff)
[ServiceWorker] Sync successful
```

---

### ✅ Test 10: Backend Sync Endpoint

**Via Terminal/PowerShell:**

```bash
# Generate a mock tracking record
curl -X POST http://localhost:3001/api/data/sync-tracking \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"records": [
    {"app_name": "YouTube", "minutes": 30, "date": "2026-05-01", "timestamp": 1714585200000, "synced": false}
  ]}'
```

**Expected Response:**
```json
{
  "success": true,
  "synced": 1,
  "duplicates": 0,
  "message": "Synced 1 tracking records"
}
```

**Check sync status:**
```bash
curl http://localhost:3001/api/data/sync-status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "last_sync": "2026-05-01T15:30:00.000Z",
  "total_records": 42,
  "sync_enabled": true
}
```

---

## Checklist for Phase 7 Approval

- [ ] Service Worker shows "activated and running" in DevTools
- [ ] App loads from cache when offline
- [ ] Notification permission requested and granted
- [ ] Periodic sync creates new IndexedDB records
- [ ] IndexedDB stores data correctly with correct schema
- [ ] Manual sync (every 5 min) works when Periodic Sync unavailable
- [ ] Hourly summary notification displays (or triggered manually)
- [ ] App limit warning notifications show correctly
- [ ] Offline sync retries with exponential backoff (2s, 4s, 8s)
- [ ] Sync endpoint returns success with correct counts
- [ ] Duplicate records are detected and skipped
- [ ] No console errors (only expected logs)
- [ ] Backend /api/data/sync-tracking endpoint exists and authenticates
- [ ] Backend /api/data/sync-status endpoint exists and returns correct data

---

## Troubleshooting

### Service Worker not showing in DevTools
- Check browser console for registration errors
- Ensure `/service-worker.js` is in root of `/public` folder
- Clear cache: DevTools → Application → Storage → Clear site data

### Notifications not appearing
- Check Notification.permission in console: `Notification.permission`
- If "denied", reset browser notification permission
- Chrome: Settings → Privacy → Site Settings → Notifications → find localhost → Allow

### Sync not firing
- Check if Periodic Sync API supported: `'sync' in ServiceWorkerRegistration.prototype`
- If not supported, manual fallback should run every 5 minutes
- Watch console for `[App] Added background tracking:` messages

### Can't find JWT token for curl test
1. Open app, login
2. DevTools → Application → Cookies → find "zs_token" or check localStorage
3. Or check Network tab → find any API request → copy Authorization header

---

## Performance Metrics to Monitor

After running through all tests, check:

| Metric | Expected | How to Check |
|--------|----------|--------------|
| Service Worker cache size | <100KB | DevTools → Application → Cache Storage |
| IndexedDB size | <10MB per month | DevTools → Application → IndexedDB |
| Sync time (online) | <5 seconds | Network tab → filter for /api/data/sync-tracking |
| Offline load time | <500ms | Network tab → Offline mode → refresh |
| Notification latency | <1 second | Console timestamp + notification appear time |

---

## Success Criteria (All Required)

✅ = All 10 tests pass  
✅ = All checklist items checked  
✅ = No blocking console errors  
✅ = Server logs show sync requests  
✅ = Database updated with synced records  

**Phase 7 is VERIFIED and READY TO CLOSE** when all above complete.
