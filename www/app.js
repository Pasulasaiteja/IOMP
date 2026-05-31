// ─── CONFIG ────────────────────────────────────────────────────────────────
// Capacitor native: The WebView loads from the local device filesystem, so 
// fetch() calls must point to the PC's server IP explicitly.
//
// Browser dev:      Uses localhost:3001 (the dev server running on the PC).
// LAN access:       Uses the current origin (e.g. http://192.168.x.x:3001).

let API = 'http://192.168.1.109:3001/api';  // Default for native app pointing to dev server

if (!window.Capacitor || !window.Capacitor.isNative) {
  // Running in a browser
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    API = 'http://192.168.1.109:3001/api';
  } else {
    // Accessed via LAN IP in browser
    API = window.location.origin + '/api';
  }
}


// ─── APP ICON MAP (frontend-only cosmetics) ─────────────────────────────────
const APP_META = {
  'Instagram': { icon: '📸', color: '#E1306C', bg: '#2D1A2A' },
  'YouTube': { icon: '▶', color: '#FF0000', bg: '#2D1A1A' },
  'YouTube Music': { icon: '🎵', color: '#FF0000', bg: '#2D1A1A' },
  'Twitter / X': { icon: '✕', color: '#1DA1F2', bg: '#1A2230' },
  'TikTok': { icon: '♪', color: '#69C9D0', bg: '#1A2D2E' },
  'WhatsApp': { icon: '💬', color: '#25D366', bg: '#1A2D25' },
  'Safari': { icon: '⧊', color: '#0076FF', bg: '#1A2030' },
  'Chrome': { icon: '🌐', color: '#4285F4', bg: '#1A1E2D' },
  'Facebook': { icon: '👤', color: '#1877F2', bg: '#1A1E2D' },
  'Snapchat': { icon: '👻', color: '#FFFC00', bg: '#2D2D1A' },
  'Reddit': { icon: '🤖', color: '#FF4500', bg: '#2D1E1A' },
  'Spotify': { icon: '🎧', color: '#1DB954', bg: '#1A2D20' },
  'Netflix': { icon: '🎬', color: '#E50914', bg: '#2D1A1A' },
  'Discord': { icon: '🎮', color: '#5865F2', bg: '#1A1E2D' },
  'Messenger': { icon: '💬', color: '#0084FF', bg: '#1A2030' },
  'Gmail': { icon: '✉️', color: '#EA4335', bg: '#2D1A1A' },
  'Google Maps': { icon: '🗺️', color: '#4285F4', bg: '#1A1E2D' },
  'Google Photos': { icon: '🖼️', color: '#4285F4', bg: '#1A1E2D' },
  'Messages': { icon: '💬', color: '#2196F3', bg: '#1A2030' },
  'Google Drive': { icon: '📁', color: '#0F9D58', bg: '#1A2D20' },
  'Google Calendar': { icon: '📅', color: '#4285F4', bg: '#1A1E2D' },
  'Google Keep': { icon: '📝', color: '#FBBC04', bg: '#2D2A1A' },
  'Phone': { icon: '📞', color: '#4285F4', bg: '#1A1E2D' },
  'Contacts': { icon: '👥', color: '#4285F4', bg: '#1A1E2D' },
  'Prime Video': { icon: '🎬', color: '#00A8E1', bg: '#1A2530' },
  'Disney+ Hotstar': { icon: '🎬', color: '#1CE783', bg: '#1A2D20' },
};

// Package name → friendly name fallback (safety net if native label resolution fails)
const PKG_TO_NAME = {
  'com.android.chrome': 'Chrome',
  'com.google.android.youtube': 'YouTube',
  'com.google.android.apps.youtube.music': 'YouTube Music',
  'com.google.android.apps.messaging': 'Messages',
  'com.google.android.apps.maps': 'Google Maps',
  'com.google.android.apps.photos': 'Google Photos',
  'com.google.android.gm': 'Gmail',
  'com.google.android.dialer': 'Phone',
  'com.google.android.contacts': 'Contacts',
  'com.google.android.calendar': 'Google Calendar',
  'com.google.android.apps.docs': 'Google Drive',
  'com.google.android.keep': 'Google Keep',
  'com.instagram.android': 'Instagram',
  'com.whatsapp': 'WhatsApp',
  'com.facebook.katana': 'Facebook',
  'com.facebook.orca': 'Messenger',
  'com.twitter.android': 'Twitter / X',
  'com.snapchat.android': 'Snapchat',
  'com.reddit.frontpage': 'Reddit',
  'com.zhiliaoapp.musically': 'TikTok',
  'com.spotify.music': 'Spotify',
  'com.netflix.mediaclient': 'Netflix',
  'com.discord': 'Discord',
};

function resolveAppName(name, pkg) {
  // If the name looks like a package name (contains dots), try to resolve it
  if (name && name.includes('.') && pkg) {
    return PKG_TO_NAME[pkg] || PKG_TO_NAME[name] || name;
  }
  if (name && name.includes('.')) {
    return PKG_TO_NAME[name] || name;
  }
  return name;
}

function appMeta(name) {
  return APP_META[name] || { icon: '📱', color: '#7B68FF', bg: '#1C2030' };
}

function getAppIconHtml(app) {
  if (app.iconBase64) {
    return `<img src="${app.iconBase64}" style="width: 28px; height: 28px; border-radius: 6px; object-fit: contain;">`;
  } else {
    return app.icon;
  }
}

// ─── AUTH TOKEN ─────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('zs_token'); }
function setToken(t) {
  localStorage.setItem('zs_token', t);
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SET_TOKEN', token: t });
  }
}
function clearToken() {
  localStorage.removeItem('zs_token');
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SET_TOKEN', token: null });
  }
}
function authHeader() { return { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' }; }

// ─── API HELPERS ─────────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };

  // Only add Authorization header if token exists (skip for login/signup)
  const token = getToken();
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  const fullUrl = API + path;
  console.log(`[App] Fetching: ${fullUrl.replace(token ? token.substring(0, 10) : '', '***')}`);

  // Add a 10-second timeout so fetch fails fast on unreachable servers
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(fullUrl, {
      headers,
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.error(`[App] Request timed out: ${fullUrl}`);
      throw new Error('Server not reachable. Make sure the server is running and your phone is on the same Wi-Fi as your PC.');
    }
    console.error(`[App] API Error on ${fullUrl}:`, err.message);
    throw err;
  }
}

async function apiPost(path, body) { return apiFetch(path, { method: 'POST', body }); }

async function apiPut(path, body) { return apiFetch(path, { method: 'PUT', body }); }
async function apiGet(path) { return apiFetch(path, { method: 'GET' }); }

// ─── STATE ───────────────────────────────────────────────────────────────────
let currentUser = null;   // { id, name, email, dailyGoal, streak }
let summaryData = null;   // from /api/data/summary
let appData = [];     // [ { name, icon, color, bg, time, limit } ]
let dailyGoalMins = 360;
let nativeTotalScreenMinutes = null;  // Total from ALL apps (incl. system) to match Digital Wellbeing
let chatHistory = [];
let isLoadingChat = false;
let focusTimer = null, focusDuration = 0, focusRemaining = 0;
let selectedFocusMins = 30, selectedModal = null, selectedModalMins = 90;
let selectedGoalMins = 360;

// ─── UTILS ───────────────────────────────────────────────────────────────────
function fmt(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`;
}
function getInitials(name) {
  return (name || '?').split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
function showToast(msg, dur = 2200) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}
function showPage(id) {
  document.querySelectorAll('.auth-page,.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  const isMain = ['page-home', 'page-limits', 'page-chat', 'page-profile', 'page-analytics'].includes(id);
  document.getElementById('bottom-nav').style.display = isMain ? 'flex' : 'none';
}
function goProfile() { switchTab('profile'); }
function switchTab(tab) {
  showPage('page-' + tab);
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const ni = document.getElementById('nav-' + tab);
  if (ni) ni.classList.add('active');

  // Auto-sync when switching to home/analytics to get fresh real-time data
  if ((tab === 'home' || tab === 'analytics') && window.Capacitor && window.Capacitor.isNative) {
    manualPeriodicSync().catch(e => console.warn('[App] Tab switch sync failed:', e));
  }
}

// ─── UPDATE UI FROM USER OBJECT ──────────────────────────────────────────────
function updateUserUI() {
  if (!currentUser) return;
  const init = getInitials(currentUser.name);
  document.querySelectorAll('.avatar').forEach(el => el.textContent = init);
  const pa = document.querySelector('.profile-avatar'); if (pa) pa.textContent = init;
  const pn = document.querySelector('.profile-name'); if (pn) pn.textContent = currentUser.name;
  const pe = document.querySelector('.profile-email'); if (pe) pe.textContent = currentUser.email;
  // streak badge
  const sb = document.querySelector('.streak-badge');
  if (sb) sb.textContent = (currentUser.streak || 0) + '-day streak 🔥';
  // daily goal display
  dailyGoalMins = currentUser.dailyGoal || 360;
  const gd = document.getElementById('daily-goal-display');
  if (gd) gd.textContent = fmt(dailyGoalMins);
}

// ─── AUTH ────────────────────────────────────────────────────────────────────
async function doLogin() {
  const e = document.getElementById('login-email').value.trim();
  const p = document.getElementById('login-pw').value;
  if (!e || !p) { showToast('Please fill in all fields'); return; }
  const btn = document.querySelector('#page-login .btn-primary');
  try {
    btn.textContent = 'Signing in…'; btn.disabled = true;
    console.log('[App] Login attempt:', e);
    console.log('[App] Using API:', API);
    console.log('[App] Running on native:', window.Capacitor && window.Capacitor.isNative);

    const data = await apiPost('/auth/login', { email: e, password: p });

    console.log('[App] Login successful! User:', data.user.email);
    setToken(data.token);
    currentUser = data.user;
    updateUserUI();
    showToast('Welcome back! 👋', 2000);
    switchTab('home');
    btn.textContent = 'Sign in'; btn.disabled = false;
    // Load data in background — don't block navigation
    loadSummary().catch(err => console.warn('[App] loadSummary failed:', err));
    if (window.Capacitor && window.Capacitor.isNative) {
      setTimeout(() => manualPeriodicSync().catch(e => console.warn('[App] sync:', e)), 2000);
    }
  } catch (err) {
    console.error('[App] Login error:', err.message);
    showToast(err.message || 'Login failed');
    btn.textContent = 'Sign in'; btn.disabled = false;
  }
}

async function doSignup() {
  const n = document.getElementById('signup-name').value.trim();
  const e = document.getElementById('signup-email').value.trim();
  const p = document.getElementById('signup-pw').value;
  const p2 = document.getElementById('signup-pw2').value;
  if (!n || !e || !p || !p2) { showToast('Please fill in all fields'); return; }
  if (p.length < 8) { showToast('Password must be at least 8 characters'); return; }
  if (p !== p2) { showToast('Passwords do not match'); return; }
  const btn = document.querySelector('#page-signup .btn-primary');
  try {
    btn.textContent = 'Creating…'; btn.disabled = true;
    const data = await apiPost('/auth/register', { name: n, email: e, password: p });
    setToken(data.token);
    currentUser = data.user;
    updateUserUI();
    showToast('Account created! Welcome! 🎉', 2000);
    switchTab('home');
    btn.textContent = 'Create account'; btn.disabled = false;
    // Load data in background — don't block navigation
    loadSummary().catch(err => console.warn('[App] loadSummary failed:', err));
    if (window.Capacitor && window.Capacitor.isNative) {
      setTimeout(() => manualPeriodicSync().catch(e => console.warn('[App] sync:', e)), 2000);
    }
  } catch (err) {
    showToast(err.message || 'Registration failed');
    btn.textContent = 'Create account'; btn.disabled = false;
  }
}


function doForgot() {
  const e = document.getElementById('forgot-email').value;
  if (!e || !e.includes('@')) { showToast('Please enter a valid email'); return; }
  showToast('Reset link sent! Check your inbox 📧', 2500);
  setTimeout(() => showPage('page-login'), 1000);
}

function doLogout() {
  clearToken(); currentUser = null; summaryData = null; appData = [];
  chatHistory = []; initChat();
  showPage('page-login');
}

// ─── LOAD SUMMARY FROM BACKEND ───────────────────────────────────────────────
async function loadSummary() {
  try {
    // NOTE: Do NOT call manualPeriodicSync() here — it creates a circular
    // dependency and blocks the UI. Sync is triggered separately from
    // doLogin/doSignup/switchTab and it calls loadSummary when done.

    summaryData = await apiGet('/data/summary');
    const { todayRows, weekRows, prevWeekRows, limits, user, preferences } = summaryData;

    console.log('[App] Summary loaded:', {
      todayRowsCount: todayRows?.length || 0,
      todayRows: todayRows,
      limitsCount: limits?.length || 0,
      user: user
    });

    // Update currentUser from fresh summary data
    if (user) {
      currentUser.name = user.name;
      currentUser.email = user.email;
      currentUser.dailyGoal = user.daily_goal;
      currentUser.streak = user.streak;
      dailyGoalMins = user.daily_goal;
    }
    updateUserUI();

    // Build appData from todayRows + limits
    const limitMap = {};
    (limits || []).forEach(l => limitMap[l.app_name] = l.limit_mins);

    // Sync limits to native app blocker
    if (window.Capacitor && window.Capacitor.Plugins.AppBlocker) {
      (limits || []).forEach(l => {
        window.Capacitor.Plugins.AppBlocker.setAppLimit({
          appName: l.app_name,
          limitMins: l.limit_mins
        });
      });
    }

    appData = (todayRows || []).map(row => ({
      name: row.app_name,
      time: row.minutes,
      limit: limitMap[row.app_name] || null,
      iconBase64: row.icon_base64,
      ...appMeta(row.app_name),
    }));

    // Sort by time desc
    appData.sort((a, b) => b.time - a.time);

    console.log('[App] appData built:', appData);

    // Build home UI
    buildHomeTimeCard();
    buildWeekChart(weekRows, prevWeekRows);
    buildAppList();
    buildLimitsList();
    buildInsights();

    // Apply preferences
    if (preferences) {
      applyPreferences(preferences);
    }

    // Render analytics charts
    renderAnalytics(todayRows, weekRows);
  } catch (err) {
    console.error('loadSummary error:', err);
    showToast('Could not load data. Check server connection.');
  }
}

// ─── MANUAL REFRESH HOME DATA ────────────────────────────────────────────────
async function refreshHomeData() {
  const btn = document.getElementById('btn-refresh-home');
  if (!btn) return;

  btn.disabled = true;
  btn.style.opacity = '0.5';
  btn.textContent = '⏳';

  try {
    showToast('Syncing screen time data...', 1500);
    if (window.Capacitor && window.Capacitor.isNative) {
      await manualPeriodicSync();
    }
    await loadSummary();
    showToast('✓ Data refreshed!', 1500);
  } catch (err) {
    console.error('Refresh failed:', err);
    showToast('Refresh failed. Check connection.');
  } finally {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = '🔄';
  }
}

// ─── HOME: TODAY'S TIME CARD ─────────────────────────────────────────────────
function buildHomeTimeCard() {
  // Use the native total (all apps incl. system) if available, otherwise sum filtered apps
  const totalMins = nativeTotalScreenMinutes != null
    ? nativeTotalScreenMinutes
    : appData.reduce((s, a) => s + a.time, 0);
  console.log('[App] buildHomeTimeCard - totalMins:', totalMins, '(native total:', nativeTotalScreenMinutes, ') appData.length:', appData.length);
  const pct = Math.min(100, Math.round((totalMins / dailyGoalMins) * 100));
  const h = Math.floor(totalMins / 60), m = totalMins % 60;

  // Big time value
  const tv = document.getElementById('today-time-val');
  if (tv) tv.innerHTML = `${h}<span style="font-size:20px;font-family:'DM Sans',sans-serif;color:var(--text2);font-weight:300">h</span>${m}<span style="font-size:20px;font-family:'DM Sans',sans-serif;color:var(--text2);font-weight:300">m</span>`;

  // Pct ring
  const ringPct = document.getElementById('ring-pct');
  if (ringPct) {
    const circ = 175.9;
    const offset = circ - (pct / 100) * circ;
    ringPct.setAttribute('stroke-dashoffset', offset.toFixed(1));
    const ringTxt = document.getElementById('ring-txt');
    if (ringTxt) ringTxt.textContent = pct + '%';
  }

  // Progress bar
  const bar = document.getElementById('today-bar'); if (bar) bar.style.width = pct + '%';
  const barLabel = document.getElementById('today-bar-label');
  if (barLabel) barLabel.textContent = `${fmt(totalMins)} / ${fmt(dailyGoalMins)}`;

  // Ring label
  const rl = document.getElementById('ring-label');
  if (rl) rl.textContent = fmt(dailyGoalMins) + ' daily limit';

  // Today trend
  const trendEl = document.getElementById('today-trend');
  if (trendEl) {
    if (summaryData && summaryData.prevWeekRows) {
      const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const yRow = summaryData.prevWeekRows.find(r => r.date.startsWith(yesterdayStr));
      const yesterdayTotal = yRow ? Number(yRow.total) : 0;
      if (yesterdayTotal > 0) {
        if (totalMins > yesterdayTotal) {
          trendEl.innerHTML = `↑ ${totalMins - yesterdayTotal}m more than yesterday`;
          trendEl.style.color = 'var(--amber)';
        } else {
          trendEl.innerHTML = `↓ ${yesterdayTotal - totalMins}m less than yesterday`;
          trendEl.style.color = 'var(--green)';
        }
      } else {
        trendEl.textContent = "On track today";
        trendEl.style.color = 'var(--green)';
      }
    } else {
      trendEl.textContent = "On track today";
      trendEl.style.color = 'var(--green)';
    }
  }
}

// ─── HOME: WEEKLY CHART ──────────────────────────────────────────────────────
function buildWeekChart(weekRows, prevWeekRows) {
  const days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0

  // Map date -> total mins
  const curMap = {}, prevMap = {};
  (weekRows || []).forEach(r => { curMap[r.date] = r.total; });
  (prevWeekRows || []).forEach(r => { prevMap[r.date] = r.total; });

  // Build 7-day arrays
  const now = new Date();
  const chartData = days.map((day, i) => {
    const d = new Date(now); d.setDate(now.getDate() - todayIdx + i);
    const key = d.toISOString().slice(0, 10);
    return { day, cur: (curMap[key] || 0) / 60, last: (prevMap[Object.keys(prevMap).find((_, j) => j === i)] || 0) / 60, isToday: i === todayIdx };
  });

  const max = Math.max(...chartData.map(d => Math.max(d.cur, d.last || 0)), 1);
  const c = document.getElementById('week-chart'); if (!c) return;
  c.innerHTML = '';
  chartData.forEach(d => {
    const col = document.createElement('div');
    col.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;height:100%';
    const bars = document.createElement('div');
    bars.style.cssText = 'flex:1;width:100%;display:flex;gap:2px;align-items:flex-end';
    const b1 = document.createElement('div');
    b1.style.cssText = `flex:1;border-radius:3px 3px 0 0;height:${(d.cur / max * 100).toFixed(0)}%;background:${d.isToday ? '#7B68FF' : '#2A2F45'}`;
    const b2 = document.createElement('div');
    b2.style.cssText = `flex:1;border-radius:3px 3px 0 0;height:${d.last ? (d.last / max * 100).toFixed(0) : 0}%;background:#3A4060`;
    bars.appendChild(b1); bars.appendChild(b2);
    const lbl = document.createElement('div');
    lbl.style.cssText = `font-size:10px;color:${d.isToday ? '#7B68FF' : '#5A5F7A'};font-weight:${d.isToday ? '600' : '400'}`;
    lbl.textContent = d.day;
    col.appendChild(bars); col.appendChild(lbl); c.appendChild(col);
  });
}

// ─── APP LIST (HOME) ─────────────────────────────────────────────────────────
function buildAppList() {
  const el = document.getElementById('app-list-home'); if (!el) return; el.innerHTML = '';
  console.log('[App] buildAppList - appData.length:', appData.length);
  if (!appData.length) { el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:8px 0">No screen time recorded today yet.</div>'; return; }
  const max = Math.max(...appData.map(d => d.time), 1);
  appData.forEach(d => {
    const pct = (d.time / max * 100).toFixed(0);
    const over = d.limit && d.time > d.limit;
    const h = document.createElement('div'); h.className = 'app-row';
    h.innerHTML = `<div class="app-icon" style="background:${d.bg};color:${d.color};font-size:16px;display:flex;align-items:center;justify-content:center;padding:0;overflow:hidden;">${getAppIconHtml(d)}</div>
<div class="app-info"><div class="app-name">${d.name}</div><div class="app-time">${fmt(d.time)} today</div>
<div class="app-bar-wrap"><div class="app-bar-fill" style="width:${pct}%;background:${over ? '#FF6B6B' : d.color}"></div></div></div>
${d.limit ? `<div class="app-limit-badge ${over ? 'over' : ''}" onclick="openModal('${d.name}')">${over ? 'Over' : 'Limit: ' + fmt(d.limit)}</div>` : `<div style="font-size:10px;color:#5A5F7A;cursor:pointer" onclick="openModal('${d.name}')">+limit</div>`}`;
    el.appendChild(h);
  });
}

// ─── LIMITS LIST ─────────────────────────────────────────────────────────────
function buildLimitsList() {
  const el = document.getElementById('app-limits-list'); if (!el) return; el.innerHTML = '';
  if (!appData.length) { el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:8px 0">No apps tracked today.</div>'; return; }
  appData.forEach(d => {
    const over = d.limit && d.time > d.limit;
    const h = document.createElement('div'); h.className = 'app-row';
    h.innerHTML = `<div class="app-icon" style="background:${d.bg};color:${d.color};font-size:16px;display:flex;align-items:center;justify-content:center;padding:0;overflow:hidden;">${getAppIconHtml(d)}</div>
<div class="app-info"><div class="app-name">${d.name}</div>
<div class="app-time">${fmt(d.time)} used${d.limit ? ' · limit: ' + fmt(d.limit) : ' · no limit'}</div>
${d.limit ? `<div class="app-bar-wrap"><div class="app-bar-fill" style="width:${Math.min(100, (d.time / d.limit * 100)).toFixed(0)}%;background:${over ? '#FF6B6B' : '#7B68FF'}"></div></div>` : ''}
</div>
${over ? '<div class="blocked-badge">Over</div>' : ''}
<div style="font-size:11px;color:#7B68FF;cursor:pointer;padding:4px 8px;background:rgba(123,104,255,0.1);border-radius:6px;flex-shrink:0" onclick="openModal('${d.name}')">Edit</div>`;
    el.appendChild(h);
  });
}

// ─── AI INSIGHTS (from local analytics) ──────────────────────────────────────
async function loadAIInsights() {
  try {
    const data = await apiGet('/ai/insights');
    const { summary, insights } = data;

    // Update AI summary card
    const aiSummary = document.getElementById('ai-summary');
    if (aiSummary) aiSummary.textContent = summary;

    // Update insights list
    const insightsList = document.getElementById('ai-insights-list');
    if (insightsList) {
      insightsList.innerHTML = '';
      insights.forEach(text => {
        const li = document.createElement('li');
        li.innerHTML = text;
        insightsList.appendChild(li);
      });
    }
  } catch (err) {
    console.error('Load AI insights failed:', err);
  }
}

// ─── AI NOTIFICATIONS ────────────────────────────────────────────────────────
async function checkAINotifications() {
  try {
    const data = await apiPost('/ai/check-notifications', {});
    const { notifications } = data;

    notifications.forEach(n => {
      sendNotification(n.title, { body: n.body, tag: n.type });
    });
  } catch (err) {
    console.error('Check AI notifications failed:', err);
  }
}

// ─── AI INSIGHTS (static fallback) ──────────────────────────────────────────
function buildInsights() {
  const totalMins = appData.reduce((s, a) => s + a.time, 0);
  const overLimit = appData.filter(a => a.limit && a.time > a.limit);
  const chips = document.querySelectorAll('.insight-chip');
  if (!chips.length) return;
  // Chip 0: progress
  const pct = Math.round((totalMins / dailyGoalMins) * 100);
  chips[0].querySelector('.insight-text').innerHTML = pct < 100
    ? `<strong>On track!</strong> You've used ${fmt(totalMins)} of your ${fmt(dailyGoalMins)} daily goal (${pct}%).`
    : `<strong>Goal reached!</strong> You've hit your ${fmt(dailyGoalMins)} daily screen time goal.`;
  chips[0].querySelector('.insight-icon').className = 'insight-icon ' + (pct < 80 ? 'green' : pct < 100 ? 'amber' : 'red');
  // Chip 1: over-limit apps
  if (chips[1]) {
    if (overLimit.length) {
      chips[1].querySelector('.insight-text').innerHTML = `<strong>Limit exceeded:</strong> ${overLimit.map(a => a.name).join(', ')} ${overLimit.length === 1 ? 'is' : 'are'} over daily limit today.`;
      chips[1].querySelector('.insight-icon').className = 'insight-icon amber';
    } else {
      chips[1].querySelector('.insight-text').innerHTML = `<strong>All clear!</strong> No app limits exceeded today — great discipline!`;
      chips[1].querySelector('.insight-icon').className = 'insight-icon green';
    }
  }
  // Chip 2: streak
  if (chips[2]) {
    const s = currentUser && currentUser.streak;
    chips[2].querySelector('.insight-text').innerHTML = s > 0
      ? `<strong>🔥 ${s}-day streak!</strong> You've met your daily goal ${s} day${s > 1 ? 's' : ''} in a row. Keep it going!`
      : `<strong>Start a streak!</strong> Meet your daily goal today to begin building your streak.`;
  }

  // Load AI insights in parallel (non-blocking)
  loadAIInsights().catch(err => console.warn('AI insights unavailable:', err));
}

// ─── LIMIT MODAL ─────────────────────────────────────────────────────────────
function openModal(appName) {
  const d = appData.find(a => a.name === appName); if (!d) return;
  selectedModal = d;
  selectedModalMins = d.limit || 60;
  document.getElementById('modal-app-name').textContent = 'Set limit for ' + appName;
  document.getElementById('modal-current').textContent = fmt(d.time);
  document.querySelectorAll('.time-chip').forEach(c => c.classList.remove('active'));
  
  const removeBtn = document.getElementById('btn-remove-limit');
  if (removeBtn) {
    removeBtn.style.display = d.limit ? 'block' : 'none';
  }
  
  document.getElementById('limit-modal').classList.add('open');
}
function closeModal() { document.getElementById('limit-modal').classList.remove('open'); }
function selectTime(mins, el) {
  document.querySelectorAll('.time-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active'); selectedModalMins = mins;
}
async function saveLimit() {
  if (!selectedModal) return;
  try {
    await apiPut('/data/limits', { appName: selectedModal.name, limitMins: selectedModalMins });
    selectedModal.limit = selectedModalMins;

    // Wire up native app blocker if running in Capacitor
    if (window.Capacitor && window.Capacitor.Plugins.AppBlocker) {
      window.Capacitor.Plugins.AppBlocker.setAppLimit({
        appName: selectedModal.name,
        limitMins: selectedModalMins
      });
    }

    showToast('Limit saved ✓');
    document.getElementById('limit-modal').classList.remove('open');
    buildLimitsList(); buildAppList();
  } catch (err) { showToast(err.message || 'Failed to save limit'); }
}

async function removeLimit() {
  if (!selectedModal) return;
  try {
    await apiPut('/data/limits', { appName: selectedModal.name, limitMins: 0 });
    selectedModal.limit = null;

    if (window.Capacitor && window.Capacitor.Plugins.AppBlocker) {
      window.Capacitor.Plugins.AppBlocker.setAppLimit({
        appName: selectedModal.name,
        limitMins: 0
      });
    }

    showToast('Limit removed');
    document.getElementById('limit-modal').classList.remove('open');
    buildLimitsList(); buildAppList();
  } catch (err) { showToast(err.message || 'Failed to remove limit'); }
}

// ─── FOCUS MODE ──────────────────────────────────────────────────────────────
function selectFocus(mins, el) {
  document.querySelectorAll('.focus-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const ci = document.getElementById('custom-focus-input');
  if (mins === 'custom') {
    ci.style.display = 'block';
    selectedFocusMins = parseInt(document.getElementById('custom-mins').value) || 45;
  } else { ci.style.display = 'none'; selectedFocusMins = mins; }
}
function startFocus() {
  if (!document.querySelector('.focus-chip.active')) { showToast('Select a duration first'); return; }
  const activeChip = document.querySelector('.focus-chip.active');
  if (activeChip && activeChip.textContent === 'Custom') {
    selectedFocusMins = parseInt(document.getElementById('custom-mins').value) || 45;
    if (selectedFocusMins < 5) { showToast('Minimum 5 minutes'); return; }
  }
  focusDuration = selectedFocusMins * 60; focusRemaining = focusDuration;
  document.getElementById('focus-select-area').style.display = 'none';
  document.getElementById('focus-active-area').style.display = 'block';
  document.getElementById('focus-status').textContent = 'Active';
  document.getElementById('focus-status').style.color = '#4ECCA3';
  updateFocusDisplay();

  // Wire up native app blocker if running in Capacitor
  if (window.Capacitor && window.Capacitor.Plugins.AppBlocker) {
    window.Capacitor.Plugins.AppBlocker.setFocusMode({ active: true });
  }

  // Persist to localStorage to survive reloads
  localStorage.setItem('zs_focus_end_time', Date.now() + (focusDuration * 1000));
  localStorage.setItem('zs_focus_duration', focusDuration);

  focusTimer = setInterval(() => { focusRemaining--; updateFocusDisplay(); if (focusRemaining <= 0) endFocus(true); }, 1000);
}

function updateFocusDisplay() {
  const h = Math.floor(focusRemaining / 3600), m = Math.floor((focusRemaining % 3600) / 60), s = focusRemaining % 60;
  document.getElementById('focus-timer-display').textContent = `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  document.getElementById('focus-progress-bar').style.width = (focusRemaining / focusDuration * 100).toFixed(1) + '%';
}
function endFocus(completed = false) {
  if (focusTimer) clearInterval(focusTimer);
  document.getElementById('focus-select-area').style.display = 'block';
  document.getElementById('focus-active-area').style.display = 'none';
  document.getElementById('focus-status').textContent = 'Off';
  document.getElementById('focus-status').style.color = '';
  document.querySelectorAll('.focus-chip').forEach(c => c.classList.remove('active'));
  document.getElementById('custom-focus-input').style.display = 'none';

  // Disable native app blocker if running in Capacitor
  if (window.Capacitor && window.Capacitor.Plugins.AppBlocker) {
    window.Capacitor.Plugins.AppBlocker.setFocusMode({ active: false });
  }

  localStorage.removeItem('zs_focus_end_time');
  localStorage.removeItem('zs_focus_duration');


  showToast(completed ? 'Focus session complete! Great work! 🎉' : 'Focus mode ended early');
}

// Restore focus mode from localStorage if active
function restoreFocusMode() {
  const endTime = parseInt(localStorage.getItem('zs_focus_end_time'));
  const duration = parseInt(localStorage.getItem('zs_focus_duration'));
  if (!endTime || !duration) return;

  const now = Date.now();
  if (endTime > now) {
    focusDuration = duration;
    focusRemaining = Math.floor((endTime - now) / 1000);
    document.getElementById('focus-select-area').style.display = 'none';
    document.getElementById('focus-active-area').style.display = 'block';
    document.getElementById('focus-status').textContent = 'Active';
    document.getElementById('focus-status').style.color = '#4ECCA3';
    updateFocusDisplay();
    if (focusTimer) clearInterval(focusTimer);
    focusTimer = setInterval(() => { focusRemaining--; updateFocusDisplay(); if (focusRemaining <= 0) endFocus(true); }, 1000);
  } else {
    endFocus(true);
  }
}
// Run on load
document.addEventListener('DOMContentLoaded', restoreFocusMode);


// --- COMPARE SECTION ---------------------------------------------------------
let currentCompare = 'day';
function setCompare(period, el) {
  document.querySelectorAll('.cmp-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active'); currentCompare = period; renderCompareCard();
}
function renderCompareCard() {
  if (!summaryData) { document.getElementById('compare-card').innerHTML = ''; return; }
  const { weekRows, prevWeekRows, todayRows } = summaryData;
  const todayTotal = (todayRows || []).reduce((s, r) => s + r.minutes, 0);
  const thisWeekTotal = (weekRows || []).reduce((s, r) => s + Number(r.total || 0), 0);
  const lastWeekTotal = (prevWeekRows || []).reduce((s, r) => s + Number(r.total || 0), 0);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yk = yesterday.toISOString().slice(0, 10);
  const yesterdayTotal = Number((weekRows || []).find(r => r.date === yk)?.total || 0);
  const dataMap = {
    day: { label: 'Today vs Yesterday', cur: todayTotal, prev: yesterdayTotal },
    week: { label: 'This week vs Last week', cur: thisWeekTotal, prev: lastWeekTotal },
    month: { label: 'This month vs Last', cur: thisWeekTotal * 4, prev: lastWeekTotal * 4 },
  };
  const d = dataMap[currentCompare];
  const diff = d.prev ? Math.round(((d.cur - d.prev) / d.prev) * 100) : 0;
  const isDown = diff <= 0;
  document.getElementById('compare-card').innerHTML = `<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:12px"><div style="font-size:11px;color:var(--text2);margin-bottom:8px">${d.label}</div><div style="display:flex;gap:12px;align-items:center"><div style="flex:1;text-align:center"><div style="font-size:10px;color:var(--text3);margin-bottom:2px">Current</div><div style="font-size:22px;font-weight:600;color:var(--text)">${fmt(d.cur)}</div></div><div style="display:flex;flex-direction:column;align-items:center;gap:2px"><div style="font-size:18px;color:${isDown ? '#4ECCA3' : '#FF6B6B'}">${isDown ? '&#8595;' : '&#8593;'}</div><div style="font-size:14px;font-weight:600;color:${isDown ? '#4ECCA3' : '#FF6B6B'}">${Math.abs(diff)}%</div><div style="font-size:9px;color:var(--text3)">${isDown ? 'improving' : 'increasing'}</div></div><div style="flex:1;text-align:center"><div style="font-size:10px;color:var(--text3);margin-bottom:2px">Previous</div><div style="font-size:22px;font-weight:600;color:var(--text2)">${fmt(d.prev)}</div></div></div></div>`;
}

// --- PROFILE STATS ------------------------------------------------------------
function buildProfileStats() {
  if (!summaryData) return;
  const totalMins = appData.reduce((s, a) => s + a.time, 0);
  const weekTotal = (summaryData.weekRows || []).reduce((s, r) => s + Number(r.total || 0), 0);
  const prevWeek = (summaryData.prevWeekRows || []).reduce((s, r) => s + Number(r.total || 0), 0);
  const pctDiff = prevWeek ? Math.round(((weekTotal - prevWeek) / prevWeek) * 100) : 0;
  const g = document.getElementById('stat-today'); if (g) g.textContent = fmt(totalMins);
  const gv = document.getElementById('stat-vs'); if (gv) gv.textContent = (pctDiff <= 0 ? '&#8595;' : '&#8593;') + Math.abs(pctDiff) + '%';
  const gw = document.getElementById('stat-week'); if (gw) gw.textContent = fmt(weekTotal);
  const gs = document.getElementById('stat-streak'); if (gs) gs.textContent = currentUser?.streak || 0;
}

// --- AI CHAT -----------------------------------------------------------------
async function sendChat() {
  if (isLoadingChat) return;
  const input = document.getElementById('chat-input');
  const msg = input.value.trim(); if (!msg) return;
  input.value = ''; input.style.height = 'auto';
  addMsg('user', msg); chatHistory.push({ role: 'user', content: msg }); isLoadingChat = true;
  const typing = addTyping();
  try {
    const data = await apiPost('/ai/chat', { message: msg });
    typing.remove(); chatHistory.push({ role: 'assistant', content: data.reply }); addMsg('bot', data.reply);
  } catch (err) {
    typing.remove(); addMsg('bot', "I'm having trouble right now. Make sure the server is running and try again! 🤖");
  }
  isLoadingChat = false;
}
function addMsg(role, text) {
  const wrap = document.getElementById('chat-messages');
  const now = new Date(); const time = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
  const el = document.createElement('div'); el.className = `msg ${role} fade-in`;
  el.innerHTML = `<div class="bubble">${text}</div><div class="msg-time">${time}</div>`;
  wrap.appendChild(el); wrap.scrollTop = wrap.scrollHeight; return el;
}
function addTyping() {
  const wrap = document.getElementById('chat-messages');
  const el = document.createElement('div'); el.className = 'msg bot';
  el.innerHTML = '<div class="bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
  wrap.appendChild(el); wrap.scrollTop = wrap.scrollHeight; return el;
}
function chatKeydown(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }
function initChat() {
  const wrap = document.getElementById('chat-messages'); if (!wrap) return; wrap.innerHTML = ''; chatHistory = [];
  setTimeout(() => addMsg('bot', "Hey! I'm your ZenScreen AI Coach 🤖 I can see your screen time data and help you build better digital habits. What's on your mind?"), 200);
  setTimeout(() => addMsg('bot', "Try asking: \"How am I doing today?\" or \"Give me tips to cut down on social media.\""), 900);
}

// --- DAILY GOAL ---------------------------------------------------------------
function openDailyGoalModal() {
  selectedGoalMins = dailyGoalMins;
  document.querySelectorAll('.goal-chip').forEach(c => { const h = parseInt(c.textContent); c.classList.toggle('active', h * 60 === dailyGoalMins); });
  document.getElementById('goal-modal').classList.add('open');
}
function closeGoalModal() { document.getElementById('goal-modal').classList.remove('open'); }
function selectGoal(hrs, el) { document.querySelectorAll('.goal-chip').forEach(c => c.classList.remove('active')); el.classList.add('active'); selectedGoalMins = hrs * 60; }
async function saveGoal() {
  try {
    await apiPut('/data/goal', { goalMins: selectedGoalMins });
    dailyGoalMins = selectedGoalMins; if (currentUser) currentUser.dailyGoal = selectedGoalMins;
    document.getElementById('daily-goal-display').textContent = fmt(dailyGoalMins);
    document.getElementById('goal-modal').classList.remove('open');
    showToast('Daily goal updated to ' + fmt(dailyGoalMins) + ' ?'); buildHomeTimeCard();
  } catch (err) { showToast(err.message || 'Failed to update goal'); }
}

// --- EDIT PROFILE ------------------------------------------------------------
function openEditProfile() {
  document.getElementById('edit-name').value = currentUser?.name || '';
  document.getElementById('edit-email').value = currentUser?.email || '';
  document.getElementById('edit-profile-modal').classList.add('open');
}
async function saveProfile() {
  const n = document.getElementById('edit-name').value.trim(); const e = document.getElementById('edit-email').value.trim();
  if (!n) { showToast('Name cannot be empty'); return; } if (!e || !e.includes('@')) { showToast('Please enter a valid email'); return; }
  try { await apiPut('/auth/profile', { name: n, email: e }); currentUser.name = n; currentUser.email = e; updateUserUI(); document.getElementById('edit-profile-modal').classList.remove('open'); showToast('Profile updated ?'); }
  catch (err) { showToast(err.message || 'Failed to update profile'); }
}

// --- CHANGE PASSWORD ----------------------------------------------------------
function openChangePassword() {
  ['pw-current', 'pw-new', 'pw-confirm'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('password-modal').classList.add('open');
}
async function savePassword() {
  const cur = document.getElementById('pw-current').value; const pw = document.getElementById('pw-new').value; const pw2 = document.getElementById('pw-confirm').value;
  if (!cur) { showToast('Enter your current password'); return; } if (pw.length < 8) { showToast('Min 8 characters'); return; } if (pw !== pw2) { showToast('Passwords do not match'); return; }
  try { await apiPut('/auth/password', { currentPassword: cur, newPassword: pw }); document.getElementById('password-modal').classList.remove('open'); showToast('Password updated ?'); }
  catch (err) { showToast(err.message || 'Failed to update password'); }
}

// --- PREFERENCES -------------------------------------------------------------
function applyPreferences(prefs) {
  const n = document.getElementById('pref-notifications'); const b = document.getElementById('pref-bedtime'); const w = document.getElementById('pref-weekly');
  if (n) n.checked = !!prefs.notifications; if (b) b.checked = !!prefs.bedtime_mode; if (w) w.checked = !!prefs.weekly_report;
}
async function savePreferences() {
  try { await apiPut('/data/preferences', { notifications: document.getElementById('pref-notifications')?.checked ?? true, bedtimeMode: document.getElementById('pref-bedtime')?.checked ?? true, weeklyReport: document.getElementById('pref-weekly')?.checked ?? false }); }
  catch (err) { console.warn('Pref save:', err.message); }
}

// --- EXPORT -------------------------------------------------------------------
async function exportData() {
  try {
    const data = await apiGet('/data/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'zenscreen-export.json'; a.click(); URL.revokeObjectURL(url);
    showToast('Data exported ?');
  } catch (err) { showToast(err.message || 'Export failed'); }
}

// --- SERVICE WORKER & PWA ────────────────────────────────────────────────────
let deferredInstallPrompt = null;
let swRegistration = null;

async function registerServiceWorker() {
  if (window.Capacitor && window.Capacitor.isNative) {
    console.log('[SW] Service workers disabled in native app');
    return;
  }

  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service Worker not supported');
    return;
  }

  try {
    swRegistration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });
    console.log('[SW] Registered successfully');

    // Send token to SW if we already have one
    if (getToken()) {
      if (swRegistration.active) {
        swRegistration.active.postMessage({ type: 'SET_TOKEN', token: getToken() });
      } else {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SET_TOKEN', token: getToken() });
          }
        });
      }
    }

    // Handle SW updates
    swRegistration.addEventListener('updatefound', () => {
      const newWorker = swRegistration.installing;
      console.log('[PWA] New service worker installing...');

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New SW ready — show update bar
          console.log('[PWA] Update available');
          const updateBar = document.getElementById('update-bar');
          if (updateBar) updateBar.classList.add('show');
        }
      });
    });

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      // Delay the permission request to after user interaction
      setTimeout(async () => {
        try {
          const perm = await Notification.requestPermission();
          console.log('[PWA] Notification permission:', perm);
        } catch (err) {
          console.log('[PWA] Notification permission request failed:', err);
        }
      }, 5000); // Ask 5s after load so it's not jarring
    }

    // Register Background Sync
    if ('sync' in swRegistration) {
      try {
        await swRegistration.sync.register('sync-tracking');
        console.log('[PWA] Background sync registered');
      } catch (err) {
        console.log('[PWA] Background sync failed:', err);
      }
    }

    // Register Periodic Background Sync (Android Chrome 80+)
    if ('periodicSync' in swRegistration) {
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (status.state === 'granted') {
        try {
          await swRegistration.periodicSync.register('zenscreen-usage-sync', {
            minInterval: 15 * 60 * 1000 // Every 15 minutes minimum
          });
          console.log('[PWA] Periodic background sync registered');
        } catch (err) {
          console.log('[PWA] Periodic sync not available:', err);
        }
      }
    }

    // Fallback periodic tasks for browsers without periodicSync
    scheduleHourlySummaryNotification();
    setInterval(manualPeriodicSync, 30 * 1000); // Every 30 seconds for real-time data
    setInterval(showHourlySummary, 60 * 60 * 1000); // Every hour

  } catch (err) {
    console.error('[PWA] Service Worker registration failed:', err);
  }
}

// Apply pending SW update
function applyUpdate() {
  if (swRegistration && swRegistration.waiting) {
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
  window.location.reload();
}

// --- PWA INSTALL PROMPT ──────────────────────────────────────────────────────
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  console.log('[PWA] Install prompt captured');

  // Don't show banner if user already dismissed or installed
  const dismissed = localStorage.getItem('zs_pwa_dismissed');
  if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
    return; // Dismissed within last 7 days
  }

  // Show install banner after a delay (after user is engaged)
  setTimeout(() => {
    const banner = document.getElementById('pwa-install-banner');
    if (banner && deferredInstallPrompt) {
      banner.classList.add('show');
    }
  }, 15000); // Show after 15 seconds
});

async function installPWA() {
  if (!deferredInstallPrompt) {
    showToast('Open in Chrome browser to install');
    return;
  }

  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.classList.remove('show');

  try {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log('[PWA] Install outcome:', outcome);

    if (outcome === 'accepted') {
      showToast('ZenScreen installed! 🎉');
    }
  } catch (err) {
    console.error('[PWA] Install failed:', err);
    showToast('Installation failed. Try again from browser menu.');
  }

  deferredInstallPrompt = null;
}

function dismissInstallBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.classList.remove('show');
  localStorage.setItem('zs_pwa_dismissed', Date.now().toString());
}

// Track if app was installed
window.addEventListener('appinstalled', () => {
  console.log('[PWA] App installed!');
  deferredInstallPrompt = null;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.classList.remove('show');
  showToast('ZenScreen added to home screen! 🧘');
});

// --- ONLINE / OFFLINE DETECTION ──────────────────────────────────────────────
function setupOfflineDetection() {
  const offlineBar = document.getElementById('offline-bar');
  if (!offlineBar) return;

  function updateOnlineStatus() {
    if (navigator.onLine) {
      offlineBar.classList.remove('show');
      // Try to sync pending data when coming back online
      if (swRegistration && 'sync' in swRegistration) {
        swRegistration.sync.register('sync-pending-data').catch(() => { });
      }
    } else {
      offlineBar.classList.add('show');
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // Check initial state
  if (!navigator.onLine) {
    offlineBar.classList.add('show');
  }
}

// Listen for SW controller change (after update)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[PWA] Controller changed, reloading...');
    // Auto-reload on update (only once)
    if (!window.__swReloading) {
      window.__swReloading = true;
      window.location.reload();
    }
  });
}

async function syncPendingToServer(db) {
  try {
    const tx = db.transaction('tracking', 'readonly');
    const store = tx.objectStore('tracking');
    const records = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const pending = records.filter(r => !r.synced);
    console.log('[App] syncPendingToServer - total records:', records.length, 'pending:', pending.length);
    console.log('[App] Pending records to sync:', pending);
    if (pending.length === 0) {
      console.log('[App] No pending records to sync');
      return;
    }

    const res = await apiFetch('/data/sync-tracking', {
      method: 'POST',
      body: { records: pending }
    });

    console.log('[App] Server response:', res);
    if (res.success) {
      const tx2 = db.transaction('tracking', 'readwrite');
      const store2 = tx2.objectStore('tracking');
      pending.forEach(r => {
        r.synced = true;
        store2.put(r);
      });
      console.log(`[App] Successfully synced ${pending.length} records to server`);
    }
  } catch (e) {
    console.error('[App] Direct sync failed:', e);
  }
}

// Track if we've already warned the user about permissions this session
let _permissionWarnedThisSession = false;

// Wait for Capacitor plugins to be ready (retries up to 3s)
async function waitForCapacitorPlugin(name, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name];
    if (plugin) return plugin;
    await new Promise(r => setTimeout(r, 300));
  }
  return null;
}

async function manualPeriodicSync() {
  try {
    console.log('[App] Manual periodic sync...');

    if (window.Capacitor && window.Capacitor.isNative) {
      console.log('[App] Running on native device (Capacitor)');

      // Wait up to 3s for Capacitor to finish loading the AppBlocker plugin
      const AppBlocker = await waitForCapacitorPlugin('AppBlocker', 3000);

      if (!AppBlocker || !AppBlocker.getUsageStats) {
        console.error('[App] AppBlocker plugin not ready after 3s. Available plugins:', Object.keys(window.Capacitor?.Plugins || {}));
        if (!_permissionWarnedThisSession) {
          _permissionWarnedThisSession = true;
          showToast('⚠️ Grant Usage Access in Settings for screen time tracking', 4000);
          setTimeout(() => {
            try {
              if (window.Capacitor.Plugins.App) {
                window.Capacitor.Plugins.App.openUrl({ url: 'android.settings.USAGE_ACCESS_SETTINGS' });
              }
            } catch (e) { }
          }, 2000);
        }
        return;
      }

      try {
        const result = await AppBlocker.getUsageStats();
        const nativeStats = result.stats || [];
        console.log('[App] Got usage stats from phone:', nativeStats.length, 'apps');

        if (nativeStats.length === 0) {
          console.warn('[App] No usage stats returned. Permission may not be granted.');
          if (!_permissionWarnedThisSession) {
            _permissionWarnedThisSession = true;
            showToast('📱 Go to Settings > Apps > Special Access > Usage Access → enable ZenScreen', 5000);
          }
          // Still load server data as fallback
          await loadSummary();
          return;
        }

        // Check if native thinks focus is on but we don't
        if (result.focusModeActive && focusRemaining <= 0) {
           AppBlocker.setFocusMode({ active: false });
        }


        // Permission is working — reset warning
        _permissionWarnedThisSession = false;
        const today = new Date().toISOString().slice(0, 10);

        // ── STEP 1: Show native data in the UI IMMEDIATELY ──────────────
        // Preserve existing limits from appData (set by server/user)
        const limitMap = {};
        appData.forEach(a => { if (a.limit) limitMap[a.name] = a.limit; });

        // Build appData directly from phone's real usage stats
        appData = nativeStats
          .filter(s => s.minutes > 0)
          .map(s => {
            const resolvedName = resolveAppName(s.app_name, s.package);
            return {
              name: resolvedName,
              time: s.minutes,
              limit: limitMap[resolvedName] || limitMap[s.app_name] || null,
              iconBase64: s.icon_base64,
              ...appMeta(resolvedName),
            };
          })
          .sort((a, b) => b.time - a.time);

        console.log('[App] Built appData from native stats:', appData.length, 'apps');
        appData.forEach(a => console.log(`  ${a.name}: ${a.time} min`));

        // Store the TOTAL screen time from ALL apps (including system) to match Digital Wellbeing
        if (result.total_screen_time_minutes != null) {
          nativeTotalScreenMinutes = result.total_screen_time_minutes;
          console.log('[App] Native total screen time (all apps):', nativeTotalScreenMinutes, 'min');
        }

        // Render UI immediately with the phone's real data
        buildHomeTimeCard();
        buildAppList();
        buildLimitsList();
        buildInsights();

        // ── STEP 2: Sync to server in background (non-blocking) ─────────
        // Use the /screentime/bulk endpoint with replace:true to wipe any
        // old mock data and replace it with real phone data.
        const entries = nativeStats
          .filter(s => s.minutes > 0)
          .map(s => ({
            appName: resolveAppName(s.app_name, s.package),
            minutes: s.minutes,
            date: s.date || today,
          }));

        if (entries.length > 0) {
          apiPost('/data/screentime/bulk', { entries, replace: true })
            .then(res => console.log('[App] Server sync OK:', res.count, 'records saved'))
            .catch(err => console.warn('[App] Server sync failed (phone data still shown):', err.message));
        }

      } catch (pluginErr) {
        console.error('[App] getUsageStats failed:', pluginErr.message);
        if (!_permissionWarnedThisSession) {
          _permissionWarnedThisSession = true;
          showToast('⚠️ Screen time error: ' + (pluginErr.message || 'Grant Usage Access in Settings'));
        }
        // Fall back to server data
        await loadSummary();
      }
    } else {
      // ── Browser/PWA mode — mock data for development ──────────────────
      console.log('[App] Running in browser/PWA mode - using mock data');
      const db = await openTrackingDB();
      const mockApps = ['YouTube', 'Instagram', 'Twitter / X', 'TikTok'];
      const randomApp = mockApps[Math.floor(Math.random() * mockApps.length)];
      const randomMins = Math.floor(Math.random() * 15) + 5;
      await addTrackingRecord(db, {
        app_name: randomApp, minutes: randomMins,
        date: new Date().toISOString().slice(0, 10),
        timestamp: Date.now(), synced: false
      });
      console.log('[App] Background tracking (mock):', randomApp, randomMins, 'min');

      // Push to server and refresh UI
      await syncPendingToServer(db);
      await loadSummary();
    }
  } catch (err) {
    console.error('[App] Manual sync failed:', err);
  }
}

function openTrackingDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ZenScreenTracking', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('tracking')) {
        const store = db.createObjectStore('tracking', { keyPath: 'id', autoIncrement: true });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };
  });
}

function addTrackingRecord(db, record) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tracking'], 'readwrite');
    const store = transaction.objectStore('tracking');
    const request = store.add(record);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// --- NOTIFICATION FUNCTIONS -------------------------------------------------
async function sendNotification(title, options = {}) {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    console.log('[App] Notifications not supported');
    return;
  }

  try {
    if (Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          icon: '📱',
          badge: '🎯',
          ...options
        });
      } else {
        new Notification(title, options);
      }
      console.log('[App] Notification sent:', title);
    } else {
      console.log('[App] Notification permission not granted');
    }
  } catch (err) {
    console.error('[App] Notification error:', err);
  }
}

function scheduleHourlySummaryNotification() {
  const now = new Date();
  const nextHour = new Date(now.getTime() + (60 - now.getMinutes()) * 60 * 1000);
  nextHour.setMinutes(0);
  nextHour.setSeconds(0);
  const delay = nextHour.getTime() - now.getTime();

  console.log('[App] Scheduling hourly summary in', Math.round(delay / 1000), 'seconds');

  setTimeout(() => {
    showHourlySummary();
    setInterval(showHourlySummary, 60 * 60 * 1000);
  }, delay);
}

async function showHourlySummary() {
  try {
    const summary = await apiGet('/data/summary');
    if (summary && summary.total_time !== undefined) {
      const formatted = fmt(summary.total_time);
      const title = `📊 Your Screen Time: ${formatted}`;
      const body = summary.total_time >= dailyGoalMins
        ? '⚠️ You\'ve reached your daily goal!'
        : `Keep it up! ${dailyGoalMins - summary.total_time} minutes remaining.`;

      await sendNotification(title, {
        body: body,
        tag: 'summary',
        data: { url: '/app.html#home' }
      });
    }
  } catch (err) {
    console.error('[App] Summary notification failed:', err);
  }
}

async function checkLimitAndNotify(appName, appMinutes) {
  try {
    const limits = await apiGet('/data/limits');
    const appLimit = limits.find(l => l.app_name === appName);

    if (appLimit && appMinutes >= appLimit.limit_minutes) {
      await sendNotification('⏰ App Limit Reached', {
        body: `${appName} limit of ${appLimit.limit_minutes}m exceeded!`,
        tag: 'limit-' + appName,
        requireInteraction: true,
        data: { url: '/app.html#limits' }
      });
    }
  } catch (err) {
    console.error('[App] Limit check failed:', err);
  }
}

// --- ANALYTICS CHARTS (CHART.JS) --------------------------------------------
let doughnutChartInstance = null;
let lineChartInstance = null;

function renderAnalytics(todayRows, weekRows) {
  // Wait for DOM
  setTimeout(() => {
    // Doughnut Chart (Today's Apps)
    const dCtx = document.getElementById('usageDoughnutChart');
    if (dCtx && todayRows && todayRows.length > 0) {
      const labels = todayRows.map(r => r.app_name);
      const data = todayRows.map(r => r.minutes);
      const bgColors = todayRows.map(r => appMeta(r.app_name).color);

      if (doughnutChartInstance) doughnutChartInstance.destroy();
      doughnutChartInstance = new Chart(dCtx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: bgColors,
            borderWidth: 2,
            borderColor: '#1E2235' // Match --card
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#F0F2FF', font: { family: "'DM Sans', sans-serif", size: 12 } } },
            tooltip: {
              callbacks: {
                label: function (context) { return ' ' + context.label + ': ' + context.raw + ' mins'; }
              }
            }
          },
          cutout: '70%'
        }
      });
    }

    // Line Chart (Weekly Trend)
    const lCtx = document.getElementById('trendLineChart');
    if (lCtx && weekRows && weekRows.length > 0) {
      // Map weekRows to last 7 days
      const days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
      const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0
      const now = new Date();
      const rowMap = {};
      weekRows.forEach(r => { rowMap[r.date] = r.total; });

      const labels = [];
      const data = [];

      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - todayIdx + i);
        const key = d.toISOString().slice(0, 10);
        labels.push(days[i]);
        data.push(rowMap[key] || 0);
      }

      if (lineChartInstance) lineChartInstance.destroy();
      lineChartInstance = new Chart(lCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Screen Time (mins)',
            data: data,
            borderColor: '#7B68FF',
            backgroundColor: 'rgba(123, 104, 255, 0.2)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#4ECCA3',
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: '#2A2F45' },
              ticks: { color: '#8B90B0', font: { family: "'DM Sans', sans-serif" } }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#8B90B0', font: { family: "'DM Sans', sans-serif" } }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (context) { return ' ' + context.raw + ' mins'; }
              }
            }
          }
        }
      });
    }
  }, 100);
}

// --- BOOTSTRAP ----------------------------------------------------------------
async function init() {
  // ─── STARTUP DIAGNOSTICS ───
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║      ZenScreen App Starting Up            ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('[App] Running on native:', !!(window.Capacitor && window.Capacitor.isNative));
  console.log('[App] API URL:', API);
  console.log('[App] Token exists:', !!getToken());
  console.log('');

  registerServiceWorker(); // Register Service Worker on app load
  initChat(); renderCompareCard();
  const token = getToken();
  if (token) {
    try {
      const me = await apiGet('/auth/me');
      currentUser = { id: me.id, name: me.name, email: me.email, dailyGoal: me.daily_goal, streak: me.streak };
      updateUserUI(); await loadSummary(); buildProfileStats(); switchTab('home');

      // Perform an immediate sync so charts populate as soon as user logs in
      manualPeriodicSync().catch(err => console.warn('Initial sync failed:', err));

      // On native, set up periodic sync (the browser path does this inside
      // registerServiceWorker, but that returns early on native).
      if (window.Capacitor && window.Capacitor.isNative) {
        setInterval(() => manualPeriodicSync().catch(e => console.warn('[App] periodic sync:', e)), 30 * 1000);
        console.log('[App] Native periodic sync started (every 30s)');
      }

      // Start AI notification polling every 30 minutes
      checkAINotifications().catch(err => console.warn('Initial notification check failed:', err));
      setInterval(() => {
        checkAINotifications().catch(err => console.warn('Notification check failed:', err));
      }, 30 * 60 * 1000);
    } catch (e) {
      console.error('[App] Init error:', e.message);
      clearToken(); showPage('page-login');
    }
  } else { showPage('page-login'); }
}

document.addEventListener('DOMContentLoaded', () => {
  ['pref-notifications', 'pref-bedtime', 'pref-weekly'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('change', savePreferences); });
  init();
});
