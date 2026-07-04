const { Schema, model } = require('mongoose');

const ItemSchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['weapon', 'armor', 'accessory', 'consumable'], required: true },
  rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], required: true },
  statBonuses: { type: Schema.Types.Mixed, default: {} },
  goldPrice: { type: Number, default: 0 },
  gemPrice: { type: Number, default: 0 },

  // null ownerId + isTemplate = shop catalogue entry; instances are cloned per-purchase
  isTemplate: { type: Boolean, default: true },
  templateId: { type: Schema.Types.ObjectId, ref: 'Item', default: null },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },

  createdAt: { type: Date, default: Date.now },
});

module.exports = model('Item', ItemSchema);
