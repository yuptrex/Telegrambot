const { Schema, model } = require('mongoose');

const HeroSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  name: { type: String, required: true },
  class: { type: String, enum: ['warrior', 'mage', 'rogue', 'paladin'], required: true },

  level: { type: Number, default: 1 },
  exp: { type: Number, default: 0 },

  hp: Number,
  maxHp: Number,
  mana: Number,
  maxMana: Number,

  stats: {
    strength: Number,
    intelligence: Number,
    agility: Number,
    defense: Number,
  },

  unlockedSkills: { type: [String], default: [] },

  equipment: {
    weapon: { type: Schema.Types.ObjectId, ref: 'Item', default: null },
    armor: { type: Schema.Types.ObjectId, ref: 'Item', default: null },
    accessory: { type: Schema.Types.ObjectId, ref: 'Item', default: null },
  },

  inventory: [{ type: Schema.Types.ObjectId, ref: 'Item' }],

  eloRating: { type: Number, default: 1000 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
});

module.exports = model('Hero', HeroSchema);
