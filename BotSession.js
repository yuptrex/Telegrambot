const { Schema, model } = require('mongoose');

/**
 * Persists Telegraf's session data (ctx.session, including in-progress Scenes/Wizard state)
 * in MongoDB instead of the default in-memory Map. This is required for a webhook-based
 * deploy on Render: every redeploy or process restart fully wipes in-memory state, which
 * silently breaks anyone mid-flow (e.g. mid hero-creation wizard) with no error shown.
 */
const BotSessionSchema = new Schema({
  key: { type: String, unique: true, index: true, required: true },
  data: { type: Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = model('BotSession', BotSessionSchema);
