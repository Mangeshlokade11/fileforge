'use strict';
const mongoose = require('mongoose');

const conversionSchema = new mongoose.Schema({
  user:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  toolId:        { type: String, required: true },
  toolName:      { type: String, required: true },
  category:      { type: String, required: true },
  originalName:  { type: String, required: true },
  originalSize:  { type: Number, required: true },
  originalMime:  { type: String, default: '' },
  outputName:    { type: String, default: '' },
  outputSize:    { type: Number, default: 0 },
  outputMime:    { type: String, default: '' },
  outputPath:    { type: String, default: '' },   // server filesystem path
  downloadToken: { type: String, default: '' },   // unique token for download
  status:        { type: String, enum: ['pending','processing','done','error'], default: 'pending' },
  errorMessage:  { type: String, default: '' },
  emailSent:     { type: Boolean, default: false },
  expiresAt:     { type: Date },   // when temp file is cleaned up
  duration:      { type: Number, default: 0 },  // ms
  metadata:      { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

conversionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Conversion', conversionSchema);
