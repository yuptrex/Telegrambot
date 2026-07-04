const { Schema, model } = require('mongoose');

const GuildMemberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['leader', 'officer', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const GuildSchema = new Schema({
  name: { type: String, unique: true, required: true },
  description: { type: String, default: '' },
  leaderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  members: [GuildMemberSchema],
  joinRequests: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  treasury: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  exp: { type: Number, default: 0 },
  joinType: { type: String, enum: ['open', 'request', 'invite'], default: 'open' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = model('Guild', GuildSchema);
