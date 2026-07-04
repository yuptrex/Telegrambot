const { Schema, model } = require('mongoose');

const MatchSchema = new Schema(
  {
    player1Id: { type: Schema.Types.ObjectId, ref: 'Hero', default: null },
    player2Id: { type: Schema.Types.ObjectId, ref: 'Hero', default: null },
    winnerId: { type: Schema.Types.ObjectId, ref: 'Hero', default: null },
    battleId: { type: Schema.Types.ObjectId, ref: 'Battle', default: null },
  },
  { _id: false }
);

const RoundSchema = new Schema(
  {
    round: Number,
    matches: [MatchSchema],
  },
  { _id: false }
);

const TournamentSchema = new Schema({
  name: { type: String, required: true },
  season: { type: Number, default: 1 },
  status: { type: String, enum: ['registration', 'active', 'completed'], default: 'registration' },
  bracket: [RoundSchema],
  registeredPlayers: [{ type: Schema.Types.ObjectId, ref: 'Hero' }],
  prizePool: {
    gold: { type: Number, default: 0 },
    gems: { type: Number, default: 0 },
    items: [{ type: Schema.Types.ObjectId, ref: 'Item' }],
  },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = model('Tournament', TournamentSchema);
