// ─── CONFIG ────────────────────────────────────────────────────────────────
const API = 'http://localhost:3001/api';

// ─── APP ICON MAP (frontend-only cosmetics) ─────────────────────────────────
const APP_META = {
  'Instagram':   { icon: '📸', color: '#E1306C', bg: '#2D1A2A' },
  'YouTube':     { icon: '▶',  color: '#FF0000', bg: '#2D1A1A' },
  'Twitter / X': { icon: '✕',  color: '#1DA1F2', bg: '#1A2230' },
  'TikTok':      { icon: '♪',  color: '#69C9D0', bg: '#1A2D2E' },
  'WhatsApp':    { icon: '💬', color: '#25D366', bg: '#1A2D25' },
  'Safari':      { icon: '⧊',  color: '#0076FF', bg: '#1A2030' },
  'Chrome':      { icon: '🌐', color: '#4285F4', bg: '#1A1E2D' },
  'Facebook':    { icon: '👤', color: '#1877F2', bg: '#1A1E2D' },
  'Snapchat':    { icon: '👻', color: '#FFFC00', bg: '#2D2D1A' },
  'Reddit':      { icon: '🤖', color: '#FF4500', bg: '#2D1E1A' },
};
function appMeta(name) {
  return APP_META[name] || { icon: '📱', color: '#7B68FF', bg: '#1C2030' };
}

// ─── AUTH TOKEN ─────────────────────────────────────────────────────────────
function getToken()        { return localStorage.getItem('zs_token'); }
function setToken(t)       { localStorage.setItem('zs_token', t); }
function clearToken()      { localStorage.removeItem('zs_token'); }
function authHeader()      { return { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' }; }

// ─── API HELPERS ─────────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: authHeader(),
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
async function apiPost(path, body) { return apiFetch(path, { method: 'POST', body }); }
async function apiPut(path, body)  { return apiFetch(path, { method: 'PUT',  body }); }
async function apiGet(path)        { return apiFetch(path, { method: 'GET' }); }

// ─── STATE ───────────────────────────────────────────────────────────────────
let currentUser  = null;   // { id, name, email, dailyGoal, streak }
let summaryData  = null;   // from /api/data/summary
let appData      = [];     // [ { name, icon, color, bg, time, limit } ]
let dailyGoalMins = 360;
let chatHistory  = [];
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
  const isMain = ['page-home','page-limits','page-chat','page-profile','page-analytics'].includes(id);
  document.getElementById('bottom-nav').style.display = isMain ? 'flex' : 'none';
}
function goProfile() { switchTab('profile'); }
function switchTab(tab) {
  showPage('page-' + tab);
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const ni = document.getElementById('nav-' + tab);
  if (ni) ni.classList.add('active');
}

// ─── UPDATE UI FROM USER OBJECT ──────────────────────────────────────────────
function updateUserUI() {
  if (!currentUser) return;
  const init = getInitials(currentUser.name);
  document.querySelectorAll('.avatar').forEach(el => el.textContent = init);
  const pa = document.querySelector('.profile-avatar'); if (pa) pa.textContent = init;
  const pn = document.querySelector('.profile-name');   if (pn) pn.textContent = currentUser.name;
  const pe = document.querySelector('.profile-email');  if (pe) pe.textContent = currentUser.email;
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
  try {
    const btn = document.querySelector('#page-login .btn-primary');
    btn.textContent = 'Signing in…'; btn.disabled = true;
    const data = await apiPost('/auth/login', { email: e, password: p });
    setToken(data.token);
    currentUser = data.user;
    updateUserUI();
    await loadSummary();
    showToast('Welcome back! 👋', 2000);
    setTimeout(() => switchTab('home'), 400);
  } catch (err) {
    showToast(err.message || 'Login failed');
  } finally {
    const btn = document.querySelector('#page-login .btn-primary');
    if (btn) { btn.textContent = 'Sign in'; btn.disabled = false; }
  }
}

async function doSignup() {
  const n  = document.getElementById('signup-name').value.trim();
  const e  = document.getElementById('signup-email').value.trim();
  const p  = document.getElementById('signup-pw').value;
  const p2 = document.getElementById('signup-pw2').value;
  if (!n || !e || !p || !p2) { showToast('Please fill in all fields'); return; }
  if (p.length < 8) { showToast('Password must be at least 8 characters'); return; }
  if (p !== p2) { showToast('Passwords do not match'); return; }
  try {
    const btn = document.querySelector('#page-signup .btn-primary');
    btn.textContent = 'Creating…'; btn.disabled = true;
    const data = await apiPost('/auth/register', { name: n, email: e, password: p });
    setToken(data.token);
    currentUser = data.user;
    updateUserUI();
    await loadSummary();
    showToast('Account created! Welcome! 🎉', 2000);
    setTimeout(() => switchTab('home'), 400);
  } catch (err) {
    showToast(err.message || 'Registration failed');
  } finally {
    const btn = document.querySelector('#page-signup .btn-primary');
    if (btn) { btn.textContent = 'Create account'; btn.disabled = false; }
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
    summaryData = await apiGet('/data/summary');
    const { todayRows, weekRows, prevWeekRows, limits, user, preferences } = summaryData;

    // Update currentUser from fresh summary data
    if (user) {
      currentUser.name     = user.name;
      currentUser.email    = user.email;
      currentUser.dailyGoal = user.daily_goal;
      currentUser.streak   = user.streak;
      dailyGoalMins = user.daily_goal;
    }
    updateUserUI();

    // Build appData from todayRows + limits
    const limitMap = {};
    (limits || []).forEach(l => limitMap[l.app_name] = l.limit_mins);

    appData = (todayRows || []).map(row => ({
      name:  row.app_name,
      time:  row.minutes,
      limit: limitMap[row.app_name] || null,
      ...appMeta(row.app_name),
    }));

    // Sort by time desc
    appData.sort((a, b) => b.time - a.time);

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

// ─── HOME: TODAY'S TIME CARD ─────────────────────────────────────────────────
function buildHomeTimeCard() {
  const totalMins = appData.reduce((s, a) => s + a.time, 0);
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
}

// ─── HOME: WEEKLY CHART ──────────────────────────────────────────────────────
function buildWeekChart(weekRows, prevWeekRows) {
  const days = ['Mo','Tu','We','Th','Fr','Sa','Su'];
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
  if (!appData.length) { el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:8px 0">No screen time recorded today yet.</div>'; return; }
  const max = Math.max(...appData.map(d => d.time), 1);
  appData.forEach(d => {
    const pct = (d.time / max * 100).toFixed(0);
    const over = d.limit && d.time > d.limit;
    const h = document.createElement('div'); h.className = 'app-row';
    h.innerHTML = `<div class="app-icon" style="background:${d.bg};color:${d.color};font-size:16px">${d.icon}</div>
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
    h.innerHTML = `<div class="app-icon" style="background:${d.bg};color:${d.color};font-size:16px">${d.icon}</div>
<div class="app-info"><div class="app-name">${d.name}</div>
<div class="app-time">${fmt(d.time)} used${d.limit ? ' · limit: ' + fmt(d.limit) : ' · no limit'}</div>
${d.limit ? `<div class="app-bar-wrap"><div class="app-bar-fill" style="width:${Math.min(100,(d.time/d.limit*100)).toFixed(0)}%;background:${over?'#FF6B6B':'#7B68FF'}"></div></div>` : ''}
</div>
${over ? '<div class="blocked-badge">Over</div>' : ''}
<div style="font-size:11px;color:#7B68FF;cursor:pointer;padding:4px 8px;background:rgba(123,104,255,0.1);border-radius:6px;flex-shrink:0" onclick="openModal('${d.name}')">Edit</div>`;
    el.appendChild(h);
  });
}

// ─── AI INSIGHTS ─────────────────────────────────────────────────────────────
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
}

// ─── LIMIT MODAL ─────────────────────────────────────────────────────────────
function openModal(appName) {
  const d = appData.find(a => a.name === appName); if (!d) return;
  selectedModal = d;
  selectedModalMins = d.limit || 60;
  document.getElementById('modal-app-name').textContent = 'Set limit for ' + appName;
  document.getElementById('modal-current').textContent = fmt(d.time);
  document.querySelectorAll('.time-chip').forEach(c => c.classList.remove('active'));
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
    showToast('Limit saved ✓');
    document.getElementById('limit-modal').classList.remove('open');
    buildLimitsList(); buildAppList();
  } catch (err) { showToast(err.message || 'Failed to save limit'); }
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
  focusTimer = setInterval(() => { focusRemaining--; updateFocusDisplay(); if (focusRemaining <= 0) endFocus(true); }, 1000);
}
function updateFocusDisplay() {
  const h = Math.floor(focusRemaining/3600), m = Math.floor((focusRemaining%3600)/60), s = focusRemaining%60;
  document.getElementById('focus-timer-display').textContent = `${h>0?h+':':''}${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  document.getElementById('focus-progress-bar').style.width = (focusRemaining/focusDuration*100).toFixed(1)+'%';
}
function endFocus(completed = false) {
  if (focusTimer) clearInterval(focusTimer);
  document.getElementById('focus-select-area').style.display = 'block';
  document.getElementById('focus-active-area').style.display = 'none';
  document.getElementById('focus-status').textContent = 'Off';
  document.getElementById('focus-status').style.color = '';
  document.querySelectorAll('.focus-chip').forEach(c => c.classList.remove('active'));
  document.getElementById('custom-focus-input').style.display = 'none';
  showToast(completed ? 'Focus session complete! Great work! 🎉' : 'Focus mode ended early');
}

// --- COMPARE SECTION ---------------------------------------------------------
let currentCompare = 'day';
function setCompare(period, el) {
  document.querySelectorAll('.cmp-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active'); currentCompare = period; renderCompareCard();
}
function renderCompareCard() {
  if (!summaryData) { document.getElementById('compare-card').innerHTML=''; return; }
  const { weekRows, prevWeekRows, todayRows } = summaryData;
  const todayTotal = (todayRows||[]).reduce((s,r)=>s+r.minutes,0);
  const thisWeekTotal = (weekRows||[]).reduce((s,r)=>s+Number(r.total||0),0);
  const lastWeekTotal = (prevWeekRows||[]).reduce((s,r)=>s+Number(r.total||0),0);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  const yk = yesterday.toISOString().slice(0,10);
  const yesterdayTotal = Number((weekRows||[]).find(r=>r.date===yk)?.total||0);
  const dataMap = {
    day:  { label:'Today vs Yesterday',     cur:todayTotal,     prev:yesterdayTotal },
    week: { label:'This week vs Last week', cur:thisWeekTotal,  prev:lastWeekTotal  },
    month:{ label:'This month vs Last',     cur:thisWeekTotal*4,prev:lastWeekTotal*4},
  };
  const d = dataMap[currentCompare];
  const diff = d.prev ? Math.round(((d.cur-d.prev)/d.prev)*100) : 0;
  const isDown = diff <= 0;
  document.getElementById('compare-card').innerHTML = `<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:12px"><div style="font-size:11px;color:var(--text2);margin-bottom:8px">${d.label}</div><div style="display:flex;gap:12px;align-items:center"><div style="flex:1;text-align:center"><div style="font-size:10px;color:var(--text3);margin-bottom:2px">Current</div><div style="font-size:22px;font-weight:600;color:var(--text)">${fmt(d.cur)}</div></div><div style="display:flex;flex-direction:column;align-items:center;gap:2px"><div style="font-size:18px;color:${isDown?'#4ECCA3':'#FF6B6B'}">${isDown?'&#8595;':'&#8593;'}</div><div style="font-size:14px;font-weight:600;color:${isDown?'#4ECCA3':'#FF6B6B'}">${Math.abs(diff)}%</div><div style="font-size:9px;color:var(--text3)">${isDown?'improving':'increasing'}</div></div><div style="flex:1;text-align:center"><div style="font-size:10px;color:var(--text3);margin-bottom:2px">Previous</div><div style="font-size:22px;font-weight:600;color:var(--text2)">${fmt(d.prev)}</div></div></div></div>`;
}

// --- PROFILE STATS ------------------------------------------------------------
function buildProfileStats() {
  if (!summaryData) return;
  const totalMins = appData.reduce((s,a)=>s+a.time,0);
  const weekTotal = (summaryData.weekRows||[]).reduce((s,r)=>s+Number(r.total||0),0);
  const prevWeek  = (summaryData.prevWeekRows||[]).reduce((s,r)=>s+Number(r.total||0),0);
  const pctDiff   = prevWeek ? Math.round(((weekTotal-prevWeek)/prevWeek)*100) : 0;
  const g  = document.getElementById('stat-today');  if (g)  g.textContent  = fmt(totalMins);
  const gv = document.getElementById('stat-vs');     if (gv) gv.textContent = (pctDiff<=0?'&#8595;':'&#8593;')+Math.abs(pctDiff)+'%';
  const gw = document.getElementById('stat-week');   if (gw) gw.textContent = fmt(weekTotal);
  const gs = document.getElementById('stat-streak'); if (gs) gs.textContent = currentUser?.streak||0;
}

// --- AI CHAT -----------------------------------------------------------------
async function sendChat() {
  if (isLoadingChat) return;
  const input = document.getElementById('chat-input');
  const msg = input.value.trim(); if (!msg) return;
  input.value=''; input.style.height='auto';
  addMsg('user',msg); chatHistory.push({role:'user',content:msg}); isLoadingChat=true;
  const typing = addTyping();
  try {
    const data = await apiPost('/ai/chat', {messages:chatHistory.slice(-10)});
    typing.remove(); chatHistory.push({role:'assistant',content:data.reply}); addMsg('bot',data.reply);
  } catch(err) {
    typing.remove(); addMsg('bot',"I'm having trouble connecting. Make sure the server is running and the Gemini API key is set in server/.env ??");
  }
  isLoadingChat=false;
}
function addMsg(role,text) {
  const wrap=document.getElementById('chat-messages');
  const now=new Date(); const time=now.getHours()+':'+String(now.getMinutes()).padStart(2,'0');
  const el=document.createElement('div'); el.className=`msg ${role} fade-in`;
  el.innerHTML=`<div class="bubble">${text}</div><div class="msg-time">${time}</div>`;
  wrap.appendChild(el); wrap.scrollTop=wrap.scrollHeight; return el;
}
function addTyping() {
  const wrap=document.getElementById('chat-messages');
  const el=document.createElement('div'); el.className='msg bot';
  el.innerHTML='<div class="bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
  wrap.appendChild(el); wrap.scrollTop=wrap.scrollHeight; return el;
}
function chatKeydown(e) { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat();} }
function initChat() {
  const wrap=document.getElementById('chat-messages'); if(!wrap) return; wrap.innerHTML=''; chatHistory=[];
  setTimeout(()=>addMsg('bot',"Hey! I'm your ZenScreen AI Coach ?? I can see your screen time data and help you build better digital habits. What's on your mind?"),200);
  setTimeout(()=>addMsg('bot',"Try asking: \"How am I doing today?\" or \"Give me tips to cut down on social media.\""),900);
}

// --- DAILY GOAL ---------------------------------------------------------------
function openDailyGoalModal() {
  selectedGoalMins=dailyGoalMins;
  document.querySelectorAll('.goal-chip').forEach(c=>{ const h=parseInt(c.textContent); c.classList.toggle('active',h*60===dailyGoalMins); });
  document.getElementById('goal-modal').classList.add('open');
}
function closeGoalModal() { document.getElementById('goal-modal').classList.remove('open'); }
function selectGoal(hrs,el) { document.querySelectorAll('.goal-chip').forEach(c=>c.classList.remove('active')); el.classList.add('active'); selectedGoalMins=hrs*60; }
async function saveGoal() {
  try {
    await apiPut('/data/goal',{goalMins:selectedGoalMins});
    dailyGoalMins=selectedGoalMins; if(currentUser) currentUser.dailyGoal=selectedGoalMins;
    document.getElementById('daily-goal-display').textContent=fmt(dailyGoalMins);
    document.getElementById('goal-modal').classList.remove('open');
    showToast('Daily goal updated to '+fmt(dailyGoalMins)+' ?'); buildHomeTimeCard();
  } catch(err){showToast(err.message||'Failed to update goal');}
}

// --- EDIT PROFILE ------------------------------------------------------------
function openEditProfile() {
  document.getElementById('edit-name').value=currentUser?.name||'';
  document.getElementById('edit-email').value=currentUser?.email||'';
  document.getElementById('edit-profile-modal').classList.add('open');
}
async function saveProfile() {
  const n=document.getElementById('edit-name').value.trim(); const e=document.getElementById('edit-email').value.trim();
  if(!n){showToast('Name cannot be empty');return;} if(!e||!e.includes('@')){showToast('Please enter a valid email');return;}
  try { await apiPut('/auth/profile',{name:n,email:e}); currentUser.name=n; currentUser.email=e; updateUserUI(); document.getElementById('edit-profile-modal').classList.remove('open'); showToast('Profile updated ?'); }
  catch(err){showToast(err.message||'Failed to update profile');}
}

// --- CHANGE PASSWORD ----------------------------------------------------------
function openChangePassword() {
  ['pw-current','pw-new','pw-confirm'].forEach(id=>{document.getElementById(id).value='';});
  document.getElementById('password-modal').classList.add('open');
}
async function savePassword() {
  const cur=document.getElementById('pw-current').value; const pw=document.getElementById('pw-new').value; const pw2=document.getElementById('pw-confirm').value;
  if(!cur){showToast('Enter your current password');return;} if(pw.length<8){showToast('Min 8 characters');return;} if(pw!==pw2){showToast('Passwords do not match');return;}
  try { await apiPut('/auth/password',{currentPassword:cur,newPassword:pw}); document.getElementById('password-modal').classList.remove('open'); showToast('Password updated ?'); }
  catch(err){showToast(err.message||'Failed to update password');}
}

// --- PREFERENCES -------------------------------------------------------------
function applyPreferences(prefs) {
  const n=document.getElementById('pref-notifications'); const b=document.getElementById('pref-bedtime'); const w=document.getElementById('pref-weekly');
  if(n) n.checked=!!prefs.notifications; if(b) b.checked=!!prefs.bedtime_mode; if(w) w.checked=!!prefs.weekly_report;
}
async function savePreferences() {
  try { await apiPut('/data/preferences',{notifications:document.getElementById('pref-notifications')?.checked??true,bedtimeMode:document.getElementById('pref-bedtime')?.checked??true,weeklyReport:document.getElementById('pref-weekly')?.checked??false}); }
  catch(err){console.warn('Pref save:',err.message);}
}

// --- EXPORT -------------------------------------------------------------------
async function exportData() {
  try {
    const data=await apiGet('/data/export');
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='zenscreen-export.json'; a.click(); URL.revokeObjectURL(url);
    showToast('Data exported ?');
  } catch(err){showToast(err.message||'Export failed');}
}

// --- SERVICE WORKER & BACKGROUND TASKS ----------------------------------------
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[App] Service Workers not supported');
    return;
  }
  
  try {
    const reg = await navigator.serviceWorker.register('/service-worker.js');
    console.log('[App] Service Worker registered:', reg);
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const perm = await Notification.requestPermission();
        console.log('[App] Notification permission:', perm);
      } catch (err) {
        console.log('[App] Notification permission request failed:', err);
      }
    }
    
    // Register periodic sync (if supported)
    if ('sync' in reg && 'serviceWorker' in navigator) {
      try {
        await reg.sync.register('sync-tracking');
        console.log('[App] Periodic sync registered');
        // Start hourly summary notifications
        scheduleHourlySummaryNotification();
      } catch (err) {
        console.log('[App] Periodic sync not supported or failed:', err);
        // Fallback: manual periodic sync
        setInterval(manualPeriodicSync, 5 * 60 * 1000); // Every 5 minutes
        setInterval(showHourlySummary, 60 * 60 * 1000); // Every hour
      }
    }
  } catch (err) {
    console.error('[App] Service Worker registration failed:', err);
  }
}

async function manualPeriodicSync() {
  try {
    console.log('[App] Manual periodic sync...');
    const mockApps = ['YouTube', 'Instagram', 'Twitter / X', 'TikTok'];
    const randomApp = mockApps[Math.floor(Math.random() * mockApps.length)];
    const randomMins = Math.floor(Math.random() * 15) + 5;
    const db = await openTrackingDB();
    await addTrackingRecord(db, {
      app_name: randomApp, minutes: randomMins,
      date: new Date().toISOString().slice(0, 10),
      timestamp: Date.now(), synced: false
    });
    console.log('[App] Background tracking:', randomApp, randomMins, 'min');
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
                label: function(context) { return ' ' + context.label + ': ' + context.raw + ' mins'; }
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
      const days = ['Mo','Tu','We','Th','Fr','Sa','Su'];
      const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0
      const now = new Date();
      const rowMap = {};
      weekRows.forEach(r => { rowMap[r.date] = r.total; });
      
      const labels = [];
      const data = [];
      
      for(let i=0; i<7; i++) {
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
                label: function(context) { return ' ' + context.raw + ' mins'; }
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
  registerServiceWorker(); // Register Service Worker on app load
  initChat(); renderCompareCard();
  const token=getToken();
  if(token){
    try {
      const me=await apiGet('/auth/me');
      currentUser={id:me.id,name:me.name,email:me.email,dailyGoal:me.daily_goal,streak:me.streak};
      updateUserUI(); await loadSummary(); buildProfileStats(); switchTab('home');
    } catch(e){ clearToken(); showPage('page-login'); }
  } else { showPage('page-login'); }
}

document.addEventListener('DOMContentLoaded',()=>{
  ['pref-notifications','pref-bedtime','pref-weekly'].forEach(id=>{ const el=document.getElementById(id); if(el) el.addEventListener('change',savePreferences); });
  init();
});
