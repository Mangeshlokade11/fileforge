'use strict';
'use strict';
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
console.log("ENV PATH:", envPath);

require('dotenv').config({ path: envPath });

console.log("ENV FILE CHECK:", process.env.MONGO_URI);
const express    = require('express');

const fs         = require('fs');
const mongoose   = require('mongoose');
const session    = require('express-session');
const MongoStore = require('connect-mongo');
const cors       = require('cors');
const helmet     = require('helmet');
const comp       = require('compression');
const morgan     = require('morgan');
const cron       = require('node-cron');
const rateLimit  = require('express-rate-limit');

const { router: authRoutes, passport } = require('./routes/auth');
const convertRoutes = require('./routes/convert');
const { verifyMailConnection } = require('./services/mailer');

const app      = express();
const PORT     = parseInt(process.env.PORT) || 3000;
const FRONTEND = path.join(__dirname, '../frontend');
const MONGO_URI = process.env.MONGO_URI;
console.log("Using Mongo URI:", MONGO_URI);
app.set('trust proxy', 1);

// ── Security ──────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
      fontSrc:     ["'self'", 'fonts.gstatic.com'],
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", 'data:', 'blob:', 'https://lh3.googleusercontent.com'],
      connectSrc:  ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean) || true,
  credentials: true
}));

app.use(comp());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Session (for Passport OAuth) ──────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'ff-session-dev',
  resave: false, saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI, ttl: 86400, autoRemove: 'native' }),
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, sameSite: 'lax', maxAge: 86400000 }
}));
app.use(passport.initialize());
app.use(passport.session());

// ── Rate limits ───────────────────────────────────────────────
app.use('/api/',            rateLimit({ windowMs: 900000, max: 500 }));
app.use('/api/auth/login',  rateLimit({ windowMs: 900000, max: 20  }));
app.use('/api/auth/signup', rateLimit({ windowMs: 900000, max: 20  }));

// ── Static ────────────────────────────────────────────────────
app.use(express.static(FRONTEND, { maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0, etag: true }));

// ── Health ────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── API routes ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api',      convertRoutes);

// ── Page routes ───────────────────────────────────────────────
const PAGES = {
  '/':              'index.html',
  '/login':         'pages/login.html',
  '/signup':        'pages/signup.html',
  '/dashboard':     'pages/dashboard.html',
  '/profile':       'pages/profile.html',
  '/tools':         'pages/tools.html',
  '/auth-callback': 'pages/auth-callback.html',
};
Object.entries(PAGES).forEach(([route, file]) =>
  app.get(route, (_req, res) => res.sendFile(path.join(FRONTEND, file)))
);

// ── 404 / Error ───────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(FRONTEND, 'index.html'));
});
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── MongoDB ───────────────────────────────────────────────────
mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000, socketTimeoutMS: 45000 })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => { console.error('❌ MongoDB:', err.message); process.exit(1); });

// ── Cron cleanup ──────────────────────────────────────────────
cron.schedule('*/20 * * * *', async () => {
  try {
    const Conversion = require('./models/Conversion');
    const expired = await Conversion.find({ status: 'done', expiresAt: { $lt: new Date() } });
    for (const r of expired) {
      try { if (r.outputPath && fs.existsSync(r.outputPath)) fs.unlinkSync(r.outputPath); } catch {}
    }
    if (expired.length) console.log('[cron] Cleaned', expired.length, 'expired file(s)');
  } catch(e) { console.error('[cron]', e.message); }
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', async () => {
  console.log('\n🔥 FileForge →', 'http://0.0.0.0:' + PORT);
  console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');
  console.log('   APP_URL: ', process.env.APP_URL  || 'http://localhost:' + PORT);
  console.log('   Google:  ', process.env.GOOGLE_CLIENT_ID ? 'enabled' : 'disabled\n');
  verifyMailConnection().catch(() => {});
});

module.exports = app;
