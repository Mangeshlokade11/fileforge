'use strict';
const router   = require('express').Router();
const jwt      = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { sendWelcomeEmail, sendLoginEmail } = require('../services/mailer');

const JWT_SECRET = () => process.env.JWT_SECRET || 'dev-secret-change-me';

function sign(id) {
  return jwt.sign({ id }, JWT_SECRET(), { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

function ip(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
         req.headers['x-real-ip'] || req.socket?.remoteAddress || '';
}

// ── Google OAuth ──────────────────────────────────────────────
const GOOGLE_ID     = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_ON     = !!(GOOGLE_ID && GOOGLE_SECRET);

if (GOOGLE_ON) {
  passport.use(new GoogleStrategy(
    {
      clientID:     GOOGLE_ID,
      clientSecret: GOOGLE_SECRET,
      callbackURL:  (process.env.APP_URL || 'http://localhost:3000') + '/api/auth/google/callback',
      scope:        ['profile', 'email']
    },
    async function(_at, _rt, profile, done) {
      try {
        const email     = (profile.emails?.[0]?.value || '').toLowerCase().trim();
        const firstName = profile.name?.givenName  || profile.displayName?.split(' ')[0] || 'User';
        const lastName  = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '';
        const avatar    = profile.photos?.[0]?.value || '';
        if (!email) return done(new Error('Google profile has no email'), null);

        let user     = await User.findOne({ googleId: profile.id });
        let isNew    = false;

        if (!user) {
          user = await User.findOne({ email });
          if (user) {
            user.googleId = profile.id;
            user.authProvider = 'google';
            if (!user.avatar && avatar) user.avatar = avatar;
            user.isVerified = true;
          } else {
            user = new User({ firstName, lastName, email, googleId: profile.id,
              authProvider: 'google', avatar, isVerified: true });
            isNew = true;
          }
        }

        user.lastLogin = new Date();
        await user.save();

        if (isNew) {
          sendWelcomeEmail({ to: email, firstName, lastName })
            .catch(e => console.error('[google-welcome]', e.message));
        } else {
          sendLoginEmail({ to: email, firstName: user.firstName, loginTime: user.lastLogin })
            .catch(e => console.error('[google-login-mail]', e.message));
        }

        return done(null, user);
      } catch(e) { return done(e, null); }
    }
  ));

  passport.serializeUser((u, done)   => done(null, u._id.toString()));
  passport.deserializeUser(async (id, done) => {
    try { done(null, await User.findById(id)); }
    catch(e) { done(e); }
  });
  console.log('[Auth] Google OAuth enabled');
} else {
  console.log('[Auth] Google OAuth disabled — set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET to enable');
}

// ── GET /api/auth/google/status ───────────────────────────────
router.get('/google/status', (_req, res) => res.json({ enabled: GOOGLE_ON }));

// ── GET /api/auth/google ──────────────────────────────────────
router.get('/google', (req, res, next) => {
  if (!GOOGLE_ON) return res.status(503).json({ error: 'Google OAuth not configured.' });
  passport.authenticate('google', { scope: ['profile','email'], session: false })(req, res, next);
});

// // ── GET /api/auth/google/callback ─────────────────────────────
// router.get('/google/callback', (req, res, next) => {
//   if (!GOOGLE_ON) return res.redirect('/login?error=google_disabled');
//   passport.authenticate('google', { session: false }, (err, user) => {
//     if (err || !user) {
//       return res.redirect('/login?error=' + encodeURIComponent(err?.message || 'Google sign-in failed'));
//     }
//     const token  = sign(user._id);
//     const appUrl = process.env.APP_URL || 'http://localhost:3000';
//     return res.redirect(appUrl + '/pages/auth-callback.html?token=' + token);
//   })(req, res, next);
// });

// ── GET /api/auth/google/callback ─────────────────────────────
router.get('/google/callback', (req, res, next) => {
  if (!GOOGLE_ON) return res.redirect('/login?error=google_disabled');

  passport.authenticate('google', { session: false }, async (err, user) => {
    if (err || !user) {
      console.error('[Google OAuth Error]', err?.message);
      return res.redirect('/login?error=' + encodeURIComponent(err?.message || 'Google sign-in failed'));
    }

    try {
      const token  = sign(user._id);
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      
      // Optional: set token in cookie for frontend access
      res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Redirect to frontend callback page
      return res.redirect(`${appUrl}/pages/auth-callback.html?token=${token}`);
    } catch(e) {
      console.error('[Google Callback Save]', e.message);
      return res.redirect('/login?error=' + encodeURIComponent('Login failed'));
    }
  })(req, res, next);
});
// ── POST /api/auth/signup ─────────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName?.trim() || !lastName?.trim() || !email || !password)
      return res.status(400).json({ error: 'All fields are required.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'Please enter a valid email address.' });

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(409).json({ error: 'That email is already registered.' });

    const user = await User.create({
      firstName: firstName.trim(), lastName: lastName.trim(),
      email: email.toLowerCase().trim(), password, authProvider: 'local'
    });
    user.lastLogin = new Date();
    await user.save();

    sendWelcomeEmail({ to: user.email, firstName: user.firstName, lastName: user.lastName })
      .catch(e => console.error('[signup-mail]', e.message));

    return res.status(201).json({ token: sign(user._id), user: user.toProfile() });
  } catch(err) {
    if (err.code === 11000) return res.status(409).json({ error: 'That email is already registered.' });
    console.error('[/api/auth/signup]', err.message);
    return res.status(500).json({ error: 'Signup failed: ' + err.message });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
    if (!user.isActive) return res.status(403).json({ error: 'Account deactivated.' });
    if (user.authProvider === 'google' && !user.password)
      return res.status(400).json({ error: 'This account uses Google Sign-In. Click "Continue with Google".' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });

    user.lastLogin = new Date();
    await user.save();

    sendLoginEmail({ to: user.email, firstName: user.firstName, loginTime: user.lastLogin, ipAddress: ip(req) })
      .catch(e => console.error('[login-mail]', e.message));

    return res.json({ token: sign(user._id), user: user.toProfile() });
  } catch(err) {
    console.error('[/api/auth/login]', err.message);
    return res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────
router.post('/logout', auth, (_req, res) => res.json({ message: 'Logged out.' }));

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', auth, (req, res) => res.json({ user: req.user.toProfile() }));

// ── PATCH /api/auth/profile ───────────────────────────────────
router.patch('/profile', auth, async (req, res) => {
  try {
    const { firstName, lastName, preferences } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (firstName) user.firstName = firstName.trim().slice(0, 50);
    if (lastName)  user.lastName  = lastName.trim().slice(0, 50);
    if (preferences && typeof preferences === 'object') {
      const cur = user.preferences?.toObject?.() || user.preferences || {};
      user.preferences = { ...cur, ...preferences };
    }
    await user.save();
    return res.json({ user: user.toProfile() });
  } catch(err) {
    return res.status(500).json({ error: 'Profile update failed: ' + err.message });
  }
});

// ── PATCH /api/auth/password ──────────────────────────────────
router.patch('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Both passwords are required.' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (user.authProvider === 'google' && !user.password) {
      user.password = newPassword;
      await user.save();
      return res.json({ message: 'Password set. You can now log in with email/password.' });
    }

    if (!await user.comparePassword(currentPassword))
      return res.status(401).json({ error: 'Current password is incorrect.' });
    if (currentPassword === newPassword)
      return res.status(400).json({ error: 'New password must differ from current.' });

    user.password = newPassword;
    await user.save();
    return res.json({ message: 'Password updated.' });
  } catch(err) {
    return res.status(500).json({ error: 'Password change failed: ' + err.message });
  }
});

module.exports = { router, passport };
