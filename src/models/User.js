const { Schema, model } = require('mongoose');
const { STARTING_GOLD, STARTING_GEMS } = require('../config/constants');

const UserSchema = new Schema({
  telegramId: { type: String, unique: true, index: true, required: true },
  username: String,
  firstName: String,

  gold: { type: Number, default: STARTING_GOLD },
  gems: { type: Number, default: STARTING_GEMS },

  activeHeroId: { type: Schema.Types.ObjectId, ref: 'Hero', default: null },
  guildId: { type: Schema.Types.ObjectId, ref: 'Guild', default: null },

  friends: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  friendRequestsIncoming: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  friendRequestsOutgoing: [{ type: Schema.Types.ObjectId, ref: 'User' }],

  achievements: [String],

  dailyQuestProgress: { type: Schema.Types.Mixed, default: {} },
  dailyQuestDate: { type: String, default: null }, // YYYY-MM-DD, used to detect reset

  loginStreak: { type: Number, default: 0 },
  lastLoginAt: { type: Date, default: null },

  // lightweight session data for mid-flow state (e.g. pending challenge, scene step)
  session: { type: Schema.Types.Mixed, default: {} },

  createdAt: { type: Date, default: Date.now },
});

module.exports = model('User', UserSchema);
