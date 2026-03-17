/* FileForge — Shared Utilities */
'use strict';

/* ── Auth ──────────────────────────────────────────────────── */
const Auth = {
  getToken:     () => localStorage.getItem('ff_token'),
  getUser:      () => { try { return JSON.parse(localStorage.getItem('ff_user')); } catch { return null; } },
  setSession:   (token, user) => { localStorage.setItem('ff_token', token); localStorage.setItem('ff_user', JSON.stringify(user)); },
  clearSession: () => { localStorage.removeItem('ff_token'); localStorage.removeItem('ff_user'); },
  isLoggedIn:   () => !!localStorage.getItem('ff_token'),
};

/* ── apiFetch ──────────────────────────────────────────────── */
async function apiFetch(path, opts = {}) {
  const token = Auth.getToken();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  // Let browser set Content-Type for FormData
  if (opts.body instanceof FormData) delete headers['Content-Type'];
  const res  = await fetch(path, { ...opts, headers });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw Object.assign(new Error(data.error || 'HTTP ' + res.status), { status: res.status, data });
  return data;
}

/* ── Toast ─────────────────────────────────────────────────── */
const Toast = {
  _el() {
    let c = document.getElementById('toast-container');
    if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
    return c;
  },
  show(msg, type, dur) {
    dur = dur || 4000;
    type = type || 'info';
    const icon = { success: '✓', error: '✕', info: 'i' }[type] || 'i';
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = '<span style="font-size:15px;flex-shrink:0">' + icon + '</span><span>' + msg + '</span>';
    this._el().appendChild(el);
    setTimeout(() => { el.style.transition = '.3s'; el.style.opacity = '0'; el.style.transform = 'translateX(60px)'; setTimeout(() => el.remove(), 350); }, dur);
  },
  success: function(m,d) { this.show(m,'success',d); },
  error:   function(m,d) { this.show(m,'error',d); },
  info:    function(m,d) { this.show(m,'info',d); },
};

/* ── renderNav ─────────────────────────────────────────────── */
function renderNav(active) {
  active = active || '';
  const nav = document.getElementById('nav');
  if (!nav) return;
  const user = Auth.getUser();
  const loggedIn = Auth.isLoggedIn();
  const initials = user ? ((user.firstName||'')[0] + (user.lastName||'')[0]).toUpperCase() : '';

  nav.innerHTML =
    '<a href="/" class="nav-logo">FILEFORGE</a>' +
    '<div class="nav-links">' +
      '<a href="/tools"     class="nav-link' + (active==='tools'     ?' active':'') + '">Tools</a>' +
      (loggedIn ?
        '<a href="/dashboard" class="nav-link' + (active==='dashboard' ?' active':'') + '">Dashboard</a>' +
        '<a href="/profile"   class="nav-link' + (active==='profile'   ?' active':'') + '">Profile</a>' +
        '<div class="nav-avatar" id="nav-av" title="' + (user?user.firstName:'') + '">' + initials + '</div>' +
        '<button class="btn btn-secondary btn-sm" id="nav-logout" style="letter-spacing:.5px;font-size:11px;text-transform:uppercase">Log out</button>'
      :
        '<a href="/login"  class="nav-link' + (active==='login' ?' active':'') + '">Log in</a>' +
        '<a href="/signup" class="nav-cta">Get started</a>'
      ) +
    '</div>';

  const logoutBtn = document.getElementById('nav-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function() {
      try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch(e) {}
      Auth.clearSession();
      window.location.href = '/';
    });
  }
}

/* ── requireAuth ───────────────────────────────────────────── */
function requireAuth() {
  if (!Auth.isLoggedIn()) {
    window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
    return false;
  }
  return true;
}

/* ── Helpers ───────────────────────────────────────────────── */
function formatBytes(b) {
  if (!b) return '0 B';
  const k = 1024, sz = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return (b / Math.pow(k,i)).toFixed(1) + ' ' + sz[i];
}

function timeAgo(d) {
  if (!d) return '';
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60)    return 'just now';
  if (s < 3600)  return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}

function setLoading(btn, loading, label) {
  if (!btn) return;
  if (loading) {
    btn._orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>' + (label ? '<span>' + label + '</span>' : '');
  } else {
    btn.disabled = false;
    btn.innerHTML = btn._orig || (label || '');
  }
}

function pollConversion(id, onUpdate, ms) {
  ms = ms || 1500;
  return new Promise(function(resolve) {
    function poll() {
      apiFetch('/api/convert/status/' + id).then(function(d) {
        if (onUpdate) onUpdate(d);
        if (d.status === 'done' || d.status === 'error') resolve(d);
        else setTimeout(poll, ms);
      }).catch(function(e) {
        resolve({ status: 'error', errorMessage: e.message });
      });
    }
    poll();
  });
}


/* expose globals */
window.Auth             = Auth;
window.apiFetch         = apiFetch;
window.Toast            = Toast;
window.renderNav        = renderNav;
window.requireAuth      = requireAuth;
window.formatBytes      = formatBytes;
window.timeAgo          = timeAgo;
window.setLoading       = setLoading;
window.pollConversion   = pollConversion;


/* ── Google OAuth ─────────────────────────────────────────── */
function googleSignIn() {
  // Redirect to backend Google OAuth route
  window.location.href = '/api/auth/google';
}

/* expose globally */
window.googleSignIn = googleSignIn;