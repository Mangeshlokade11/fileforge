'use strict';
/**
 * FileForge Email Service
 * Sender: noreply.fileforge@gmail.com  (configurable via MAIL_FROM)
 * Triggers: signup → welcome | login → greeting | conversion → download
 */
const nodemailer = require('nodemailer');

let _transport = null;

function getTransport() {
  if (_transport) return _transport;
  _transport = nodemailer.createTransport({
    host:   process.env.MAIL_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.MAIL_PORT) || 587,
    secure: parseInt(process.env.MAIL_PORT) === 465,
    auth:   { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    tls:    { rejectUnauthorized: false },
    pool:   true, maxConnections: 3, rateLimit: 5
  });
  return _transport;
}

function isConfigured() {
  const u = process.env.MAIL_USER || '';
  const p = process.env.MAIL_PASS || '';
  return u.length > 0 && p.length > 0 &&
    u !== 'your-email@gmail.com' && p !== 'your-app-password';
}

function fromAddr() {
  return process.env.MAIL_FROM ||
    `FileForge <${process.env.MAIL_USER || 'noreply.fileforge@gmail.com'}>`;
}

/* ── Core send ──────────────────────────────────────────────── */
async function sendMail({ to, subject, html }) {
  if (!isConfigured()) {
    console.log('[Mail] Skipped (not configured):', subject);
    return false;
  }
  try {
    await getTransport().sendMail({ from: fromAddr(), to, subject, html });
    console.log('[Mail] Sent:', subject, '→', to);
    return true;
  } catch (err) {
    console.error('[Mail] Failed:', err.message);
    _transport = null; // reset for next attempt
    return false;
  }
}

/* ── Shared HTML shell ──────────────────────────────────────── */
function shell(body, preview) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${preview || 'FileForge'}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#07070d;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{background:#07070d;padding:40px 16px}
.card{background:#0d0d18;border-radius:18px;overflow:hidden;max-width:560px;margin:0 auto;border:1px solid #1a1a2e}
.hdr{background:linear-gradient(135deg,#00f5ff 0%,#b44eff 100%);padding:30px 36px 26px}
.hdr-logo{color:#000;font-size:24px;font-weight:900;letter-spacing:2px;margin:0}
.hdr-tagline{color:rgba(0,0,0,.6);font-size:13px;margin:5px 0 0}
.body{padding:32px 36px}
.greeting{color:#e8e8ff;font-size:17px;font-weight:700;margin:0 0 14px}
.txt{color:#8888b8;font-size:15px;line-height:1.75;margin:0 0 22px}
.file-box{background:#141428;border:1px solid #222240;border-radius:12px;padding:16px 18px;margin:0 0 24px}
.file-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#3a3a6a;margin:0 0 5px}
.file-name{font-size:15px;font-weight:700;color:#e8e8ff;margin:0 0 3px;word-break:break-all}
.file-meta{font-size:13px;color:#3a3a6a;margin:0}
.file-badge{display:inline-block;background:rgba(0,245,255,.1);color:#00f5ff;border:1px solid rgba(0,245,255,.2);border-radius:20px;padding:3px 11px;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-top:8px}
.cta{display:inline-block;background:linear-gradient(135deg,#00f5ff,#b44eff);color:#000!important;text-decoration:none;padding:13px 30px;border-radius:10px;font-size:14px;font-weight:800;letter-spacing:.3px;margin:0 0 18px}
.note{color:#3a3a6a;font-size:12px;line-height:1.65;margin:0}
.divider{height:1px;background:#1a1a2e;margin:22px 0}
.stats{display:flex;gap:16px;margin:0 0 22px}
.stat{flex:1;background:#141428;border:1px solid #222240;border-radius:10px;padding:12px;text-align:center}
.stat-n{font-size:20px;font-weight:900;color:#00f5ff;display:block}
.stat-l{font-size:10px;color:#3a3a6a;text-transform:uppercase;letter-spacing:.8px;display:block;margin-top:2px}
.footer{padding:18px 36px;border-top:1px solid #1a1a2e}
.footer-txt{color:#252540;font-size:11px;text-align:center;line-height:1.6;margin:0}
@media(max-width:600px){.hdr,.body,.footer{padding:20px}.stats{flex-direction:column}}
</style></head><body>
<div class="wrap"><div class="card">
<div class="hdr"><h1 class="hdr-logo">FILEFORGE</h1><p class="hdr-tagline">Professional File Conversion Platform</p></div>
<div class="body">${body}</div>
<div class="footer"><p class="footer-txt">© ${year} FileForge. All rights reserved.<br>You're receiving this because of activity on your FileForge account.</p></div>
</div></div></body></html>`;
}

function fmtBytes(b) {
  if (!b) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(2) + ' MB';
}

/* ══════════════════════════════════════════════════════════
   1. WELCOME EMAIL — triggered on signup (local + Google)
   ══════════════════════════════════════════════════════════ */
async function sendWelcomeEmail({ to, firstName, lastName }) {
  const name    = firstName;
  const full    = `${firstName}${lastName ? ' ' + lastName : ''}`;
  const appUrl  = process.env.APP_URL || 'https://fileforge.app';

  const body = `
    <p class="greeting">Welcome to FileForge, ${name}! 🎉</p>
    <p class="txt">Hi <strong style="color:#e8e8ff">${full}</strong>, your account is ready.<br>
    Start converting files instantly with our 26 professional tools.</p>
    <div class="stats">
      <div class="stat"><span class="stat-n">26</span><span class="stat-l">Tools</span></div>
      <div class="stat"><span class="stat-n">10</span><span class="stat-l">Free/month</span></div>
      <div class="stat"><span class="stat-n">500MB</span><span class="stat-l">Max size</span></div>
    </div>
    <a href="${appUrl}/tools" class="cta">Start Converting →</a>
    <div class="divider"></div>
    <p class="note">
      <strong style="color:#8888b8">Your free plan includes:</strong><br>
      ✓ 10 conversions/month &nbsp;·&nbsp; ✓ All 26 tools<br>
      ✓ PDF, Documents, Images, Video, Audio<br>
      ✓ Email delivery after every conversion
    </p>`;

  return sendMail({
    to, subject: `Hi ${name}, welcome to FileForge! 🚀`,
    html: shell(body, `Welcome to FileForge, ${name}!`)
  });
}

/* ══════════════════════════════════════════════════════════
   2. LOGIN GREETING — triggered on every login
   ══════════════════════════════════════════════════════════ */
async function sendLoginEmail({ to, firstName, loginTime, ipAddress }) {
  const name    = firstName;
  const appUrl  = process.env.APP_URL || 'https://fileforge.app';
  const timeStr = new Date(loginTime || Date.now()).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });

  const body = `
    <p class="greeting">Hey ${name}, welcome back! 👋</p>
    <p class="txt">You just signed in to your FileForge account.</p>
    <div class="file-box">
      <div class="file-label">Login Details</div>
      <div class="file-name">${timeStr}</div>
      ${ipAddress ? `<div class="file-meta">IP: ${ipAddress}</div>` : ''}
      <div class="file-meta" style="margin-top:6px">Not you? Reset your password immediately.</div>
    </div>
    <a href="${appUrl}/tools" class="cta">Go to Tools →</a>
    <div class="divider"></div>
    <p class="note">
      If this wasn't you, <a href="${appUrl}/profile" style="color:#00f5ff;text-decoration:none">
      change your password</a> to secure your account.
    </p>`;

  return sendMail({
    to, subject: `Hi ${name}, you just signed in to FileForge`,
    html: shell(body, `FileForge sign-in — ${name}`)
  });
}

/* ══════════════════════════════════════════════════════════
   3. CONVERSION COMPLETE — file ready for download
   ══════════════════════════════════════════════════════════ */
async function sendConversionEmail({ to, firstName, lastName, conversion, downloadUrl }) {
  const name    = firstName;
  const full    = `${firstName}${lastName ? ' ' + lastName : ''}`;
  const appUrl  = process.env.APP_URL || 'https://fileforge.app';
  const ttl     = parseInt(process.env.TEMP_FILE_TTL) || 2;
  const expires = ttl + ' hour' + (ttl !== 1 ? 's' : '');

  const inSz  = fmtBytes(conversion.originalSize);
  const outSz = fmtBytes(conversion.outputSize);

  let badge = '';
  if (conversion.originalSize && conversion.outputSize && conversion.outputSize < conversion.originalSize) {
    const saved = Math.round((1 - conversion.outputSize / conversion.originalSize) * 100);
    badge = `<div class="file-badge">↓ ${saved}% smaller</div>`;
  }

  const body = `
    <p class="greeting">Hi ${name}, your file is ready! ✅</p>
    <p class="txt">Great news, <strong style="color:#e8e8ff">${full}</strong>!<br>
    Your <strong style="color:#e8e8ff">${conversion.toolName}</strong> conversion completed successfully.</p>
    <div class="file-box">
      <div class="file-label">Converted File</div>
      <div class="file-name">${conversion.outputName}</div>
      <div class="file-meta">Size: ${outSz}${conversion.originalSize ? '  ·  Original: ' + inSz : ''}</div>
      ${badge}
    </div>
    <a href="${downloadUrl}" class="cta">⬇ Download File</a>
    <p class="note">
      This link expires in <strong style="color:#e8e8ff">${expires}</strong>.<br>
      View all your conversions on your <a href="${appUrl}/dashboard" style="color:#00f5ff;text-decoration:none">dashboard</a>.
    </p>
    <div class="divider"></div>
    <p class="note">
      Tool: ${conversion.toolName} &nbsp;·&nbsp;
      Category: ${(conversion.category || '').toUpperCase()}
      ${conversion.duration ? ' &nbsp;·&nbsp; Duration: ' + conversion.duration + 'ms' : ''}
    </p>`;

  return sendMail({
    to,
    subject: `Hi ${name}, your ${conversion.toolName} file is ready — FileForge`,
    html: shell(body, `Your ${conversion.toolName} conversion is ready`)
  });
}

/* ── Verify SMTP on startup ─────────────────────────────────── */
async function verifyMailConnection() {
  if (!isConfigured()) {
    console.log('[Mail] Not configured — emails disabled. Set MAIL_USER + MAIL_PASS in .env');
    return false;
  }
  try {
    await getTransport().verify();
    console.log('[Mail] ✅ SMTP verified — emails enabled from', process.env.MAIL_USER);
    return true;
  } catch (err) {
    console.warn('[Mail] ⚠ SMTP verify failed:', err.message);
    return false;
  }
}

module.exports = {
  sendWelcomeEmail,
  sendLoginEmail,
  sendConversionEmail,
  verifyMailConnection
};
