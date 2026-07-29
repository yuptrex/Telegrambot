const BotSession = require('../models/BotSession');

/**
 * Telegraf's session() middleware accepts any store with get/set/delete methods
 * (sync or returning a Promise). This backs it with MongoDB so wizard/scene state
 * (e.g. hero creation) survives redeploys and process restarts.
 */
function mongoSessionStore() {
  return {
    async get(key) {
      const doc = await BotSession.findOne({ key }).lean();
      return doc?.data;
    },
    async set(key, data) {
      await BotSession.findOneAndUpdate(
        { key },
        { data, updatedAt: new Date() },
        { upsert: true }
      );
    },
    async delete(key) {
      await BotSession.deleteOne({ key });
    },
  };
}

module.exports = { mongoSessionStore };
