// 'use strict';
// const mongoose = require('mongoose');
// const bcrypt   = require('bcryptjs');

// const userSchema = new mongoose.Schema({
//   firstName:    { type: String, required: true, trim: true, maxlength: 50 },
//   lastName:     { type: String, required: true, trim: true, maxlength: 50 },
//   email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
//   password:     { type: String, minlength: 6 },           // optional for Google users
//   authProvider: { type: String, enum: ['local','google'], default: 'local' },
//   googleId:     { type: String, sparse: true, default: null },
//   avatar:       { type: String, default: '' },
//   plan:         { type: String, enum: ['free','pro','team'], default: 'free' },
//   isVerified:   { type: Boolean, default: false },
//   isActive:     { type: Boolean, default: true },
//   lastLogin:    { type: Date },
//   monthlyCount: { type: Number, default: 0 },
//   monthlyReset: { type: Date, default: () => new Date() },
//   totalConversions: { type: Number, default: 0 },
//   storageUsed:  { type: Number, default: 0 },
//   preferences: {
//     emailNotifications: { type: Boolean, default: true },
//     sendConvertedFile:  { type: Boolean, default: true },
//     theme:              { type: String,  default: 'dark' }
//   }
// }, { timestamps: true });

// // userSchema.index({ email: 1 });
// userSchema.index({ googleId: 1 }, { sparse: true });

// userSchema.pre('save', async function(next) {
//   if (!this.isModified('password') || !this.password) return next();
//   this.password = await bcrypt.hash(this.password, 12);
//   next();
// });

// userSchema.methods.comparePassword = async function(candidate) {
//   if (!this.password) return false;
//   return bcrypt.compare(candidate, this.password);
// };

// userSchema.methods.checkMonthlyReset = function() {
//   const now = new Date(), reset = new Date(this.monthlyReset);
//   if (now.getMonth() !== reset.getMonth() || now.getFullYear() !== reset.getFullYear()) {
//     this.monthlyCount = 0;
//     this.monthlyReset = now;
//   }
// };

// userSchema.methods.toProfile = function() {
//   return {
//     id: this._id, firstName: this.firstName, lastName: this.lastName,
//     email: this.email, avatar: this.avatar, plan: this.plan,
//     isVerified: this.isVerified, authProvider: this.authProvider,
//     monthlyCount: this.monthlyCount, totalConversions: this.totalConversions,
//     storageUsed: this.storageUsed, preferences: this.preferences,
//     createdAt: this.createdAt, lastLogin: this.lastLogin
//   };
// };

// module.exports = mongoose.model('User', userSchema);



'use strict';
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName:    { type: String, required: true, trim: true, maxlength: 50 },
  lastName:     { type: String, required: true, trim: true, maxlength: 50 },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:     { type: String, minlength: 6 },           // optional for Google users
  authProvider: { type: String, enum: ['local','google'], default: 'local' },
  googleId:     { type: String, sparse: true, default: null },
  avatar:       { type: String, default: '' },
  plan:         { type: String, enum: ['free','pro','team'], default: 'free' },
  isVerified:   { type: Boolean, default: false },
  isActive:     { type: Boolean, default: true },
  lastLogin:    { type: Date },
  monthlyCount: { type: Number, default: 0 },
  monthlyReset: { type: Date, default: () => new Date() },
  totalConversions: { type: Number, default: 0 },
  storageUsed:  { type: Number, default: 0 },
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    sendConvertedFile:  { type: Boolean, default: true },
    theme:              { type: String,  default: 'dark' }
  }
}, { timestamps: true });

// Only index Google ID, email is unique in schema
userSchema.index({ googleId: 1 }, { sparse: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.checkMonthlyReset = function() {
  const now = new Date(), reset = new Date(this.monthlyReset);
  if (now.getMonth() !== reset.getMonth() || now.getFullYear() !== reset.getFullYear()) {
    this.monthlyCount = 0;
    this.monthlyReset = now;
  }
};

userSchema.methods.toProfile = function() {
  return {
    id: this._id, firstName: this.firstName, lastName: this.lastName,
    email: this.email, avatar: this.avatar, plan: this.plan,
    isVerified: this.isVerified, authProvider: this.authProvider,
    monthlyCount: this.monthlyCount, totalConversions: this.totalConversions,
    storageUsed: this.storageUsed, preferences: this.preferences,
    createdAt: this.createdAt, lastLogin: this.lastLogin
  };
};

/**
 * Create or link Google user
 * @param {Object} profile - Google profile object
 * @returns {User} mongoose user document
 */
userSchema.statics.findOrCreateGoogle = async function(profile) {
  let user = await this.findOne({ googleId: profile.id });
  if (user) return user;

  // Check if email exists for local signup → link
  user = await this.findOne({ email: profile.emails[0].value });
  if (user) {
    user.googleId = profile.id;
    user.authProvider = 'google';
    await user.save();
    return user;
  }

  // New Google user
  return this.create({
    firstName: profile.name.givenName || 'Google',
    lastName: profile.name.familyName || 'User',
    email: profile.emails[0].value,
    googleId: profile.id,
    authProvider: 'google',
    avatar: profile.photos?.[0]?.value || ''
  });
};

module.exports = mongoose.model('User', userSchema);