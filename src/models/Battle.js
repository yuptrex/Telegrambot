const { Schema, model } = require('mongoose');

const BattleLogEntrySchema = new Schema(
  {
    turn: Number,
    actorId: Schema.Types.ObjectId, // heroId, or null for AI/system
    action: String, // 'attack' | 'skill:<id>' | 'item:<id>' | 'defend' | 'timeout' | 'forfeit'
    damage: Number,
    message: String,
  },
  { _id: false }
);

const BattleSchema = new Schema({
  type: { type: String, enum: ['pve', 'pvp', 'ranked', 'tournament'], required: true },

  player1: {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    heroId: { type: Schema.Types.ObjectId, ref: 'Hero' },
  },
  player2: {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    heroId: { type: Schema.Types.ObjectId, ref: 'Hero', default: null },
    isAI: { type: Boolean, default: false },
    aiDifficulty: { type: Number, default: 1 },
  },

  winnerId: { type: Schema.Types.ObjectId, ref: 'Hero', default: null },

  battleLog: [BattleLogEntrySchema],

  rewards: {
    gold: { type: Number, default: 0 },
    exp: { type: Number, default: 0 },
    itemDropId: { type: Schema.Types.ObjectId, ref: 'Item', default: null },
  },

  // live combat state while battle is active (mirrors what's cached in memory/Redis)
  state: { type: Schema.Types.Mixed, default: {} },

  chatId: { type: String, default: null }, // for editing the same message
  messageId: { type: Number, default: null },

  tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', default: null },

  status: { type: String, enum: ['pending', 'active', 'completed', 'forfeited'], default: 'pending' },

  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
});

module.exports = model('Battle', BattleSchema);
