'use strict';
const router     = require('express').Router();
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const { v4: uuid } = require('uuid');
const { auth }   = require('../middleware/auth');
const Conversion = require('../models/Conversion');
const User       = require('../models/User');
const { convert }           = require('../services/converter');
const { sendConversionEmail } = require('../services/mailer');
const { byId: toolsById, TOOLS } = require('../utils/tools');

// ── Directories ───────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const TEMP_DIR   = path.join(__dirname, '../../temp');
[UPLOAD_DIR, TEMP_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── Multer — upload.any() handles single and multi-file ───────
const MAX_BYTES = parseInt(process.env.MAX_FILE_SIZE_FREE) || 500 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename:    (_req, file, cb) => cb(null, uuid() + path.extname(file.originalname || '').toLowerCase())
  }),
  limits: { fileSize: MAX_BYTES }
});

function safeUpload(req, res, next) {
  upload.any()(req, res, function(err) {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const msg = {
        LIMIT_FILE_SIZE:       'File too large — max ' + Math.round(MAX_BYTES / 1048576) + ' MB.',
        LIMIT_UNEXPECTED_FILE: 'Unexpected field name — use "file".',
        LIMIT_FILE_COUNT:      'Too many files in one request.',
      }[err.code] || 'Upload error: ' + err.message;
      return res.status(400).json({ error: msg });
    }
    console.error('[upload]', err.message);
    return res.status(500).json({ error: 'Upload failed: ' + err.message });
  });
}

function cleanup(paths) {
  [].concat(paths || []).forEach(p => {
    try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  });
}

function parseOpts(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

// ── GET /api/tools ────────────────────────────────────────────
router.get('/tools', (_req, res) => res.json({ tools: TOOLS }));

// ── POST /api/convert ─────────────────────────────────────────
router.post('/convert', auth, safeUpload, async (req, res) => {
  const uploaded = req.files || [];
  const paths    = uploaded.map(f => f.path);

  try {
    if (!uploaded.length)
      return res.status(400).json({ error: 'No file(s) uploaded. Include files in the "file" field.' });

    const toolId  = req.body.toolId;
    const options = parseOpts(req.body.options);

    if (!toolId) { cleanup(paths); return res.status(400).json({ error: 'toolId is required.' }); }

    const tool = toolsById[toolId];
    if (!tool)  { cleanup(paths); return res.status(400).json({ error: 'Unknown toolId: "' + toolId + '".' }); }

    if (tool.multi && uploaded.length < (tool.minFiles || 2)) {
      cleanup(paths);
      return res.status(400).json({
        error: 'This tool needs at least ' + (tool.minFiles || 2) + ' files. Received ' + uploaded.length + '.'
      });
    }

    const user = await User.findById(req.user._id);
    user.checkMonthlyReset();
    const limit = parseInt(process.env.FREE_MONTHLY_LIMIT) || 10;
    if (user.plan === 'free' && user.monthlyCount >= limit) {
      cleanup(paths);
      return res.status(429).json({ error: 'Monthly limit reached (' + limit + '/month on free plan).' });
    }

    const primary      = uploaded[0];
    const inputBase    = path.basename(primary.originalname, path.extname(primary.originalname));
    const outFilename  = uuid() + tool.outputExt;
    const outputPath   = path.join(TEMP_DIR, outFilename);
    const ttlH         = parseInt(process.env.TEMP_FILE_TTL) || 2;
    const expiresAt    = new Date(Date.now() + ttlH * 3600000);
    const downloadToken = uuid();
    const outputName   = (tool.multi ? 'merged' : inputBase) + tool.outputExt;

    const record = await Conversion.create({
      user: user._id, toolId, toolName: tool.name, category: tool.category,
      originalName: primary.originalname, originalSize: primary.size, originalMime: primary.mimetype,
      outputName, outputPath, downloadToken, status: 'processing', expiresAt
    });

    // Respond 202 immediately — client polls for status
    res.status(202).json({ conversionId: record._id, status: 'processing', downloadToken });

    // ── Async conversion ──────────────────────────────────────
    const t0 = Date.now();
    try {
      await convert({
        toolId,
        inputPath:  uploaded[0].path,
        inputPaths: uploaded.map(f => f.path),
        outputPath,
        options
      });

      const stat = fs.statSync(outputPath);
      record.status     = 'done';
      record.outputSize = stat.size;
      record.outputMime = tool.outputMime || 'application/octet-stream';
      record.duration   = Date.now() - t0;
      await record.save();

      user.monthlyCount++;
      user.totalConversions++;
      user.storageUsed = (user.storageUsed || 0) + stat.size;
      await user.save();

      // Send conversion email (async, non-blocking)
      const prefs = user.preferences || {};
      if (prefs.sendConvertedFile !== false && prefs.emailNotifications !== false) {
        const dlUrl = (process.env.APP_URL || 'http://localhost:3000') + '/api/download/' + downloadToken;
        sendConversionEmail({
          to: user.email, firstName: user.firstName, lastName: user.lastName,
          conversion: record, downloadUrl: dlUrl
        }).then(sent => {
          if (sent) { record.emailSent = true; record.save().catch(() => {}); }
        }).catch(err => console.error('[mail]', err.message));
      }

    } catch (convErr) {
      console.error('[converter]', toolId, convErr.message);
      record.status       = 'error';
      record.errorMessage = convErr.message;
      record.duration     = Date.now() - t0;
      await record.save();
    } finally {
      cleanup(paths);
    }

  } catch (err) {
    cleanup(paths);
    console.error('[POST /api/convert]', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Request failed: ' + err.message });
  }
});

// ── GET /api/convert/status/:id ───────────────────────────────
router.get('/convert/status/:id', auth, async (req, res) => {
  try {
    const rec = await Conversion.findOne({ _id: req.params.id, user: req.user._id });
    if (!rec) return res.status(404).json({ error: 'Conversion not found' });
    const base = process.env.APP_URL || 'http://localhost:3000';
    return res.json({
      id: rec._id, status: rec.status, toolName: rec.toolName,
      outputName: rec.outputName, outputSize: rec.outputSize, duration: rec.duration,
      downloadToken: rec.downloadToken,
      downloadUrl: rec.status === 'done' ? base + '/api/download/' + rec.downloadToken : null,
      errorMessage: rec.errorMessage, emailSent: rec.emailSent, expiresAt: rec.expiresAt
    });
  } catch (err) {
    return res.status(500).json({ error: 'Status check failed: ' + err.message });
  }
});

// ── GET /api/history ──────────────────────────────────────────
router.get('/history', auth, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const [items, total] = await Promise.all([
      Conversion.find({ user: req.user._id }).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).lean(),
      Conversion.countDocuments({ user: req.user._id })
    ]);
    return res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    return res.status(500).json({ error: 'History failed: ' + err.message });
  }
});

// ── GET /api/download/:token (public) ─────────────────────────
router.get('/download/:token', async (req, res) => {
  try {
    const rec = await Conversion.findOne({ downloadToken: req.params.token, status: 'done' });
    if (!rec) return res.status(404).json({ error: 'File not found or expired' });
    if (!fs.existsSync(rec.outputPath)) return res.status(410).json({ error: 'File has been deleted' });
    res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURIComponent(rec.outputName) + '"');
    res.setHeader('Content-Type', rec.outputMime || 'application/octet-stream');
    return res.sendFile(path.resolve(rec.outputPath));
  } catch (err) {
    return res.status(500).json({ error: 'Download error: ' + err.message });
  }
});

// ── DELETE /api/history/:id ───────────────────────────────────
router.delete('/history/:id', auth, async (req, res) => {
  try {
    const rec = await Conversion.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!rec) return res.status(404).json({ error: 'Not found' });
    try { if (rec.outputPath && fs.existsSync(rec.outputPath)) fs.unlinkSync(rec.outputPath); } catch {}
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Delete failed: ' + err.message });
  }
});

module.exports = router;
