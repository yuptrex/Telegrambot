const { Telegraf, Scenes, session } = require('telegraf');
const { attachUser, rateLimit } = require('./middlewares');
const { heroCreationScene } = require('./scenes/heroCreation');

function createBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error('BOT_TOKEN is not set in environment variables.');

  const bot = new Telegraf(token);

  // Session must come before scene middleware; stage manages the hero-creation wizard.
  bot.use(session());
  const stage = new Scenes.Stage([heroCreationScene]);
  bot.use(stage.middleware());

  bot.use(attachUser);
  bot.use(rateLimit);

  // Register command modules
  require('./commands/start')(bot);
  require('./commands/hero')(bot);
  require('./commands/battle')(bot);
  require('./commands/turnActions')(bot);
  require('./commands/shop')(bot);
  require('./commands/inventory')(bot);
  require('./commands/guild')(bot);
  require('./commands/leaderboard')(bot);
  require('./commands/tournament')(bot);
  require('./commands/misc')(bot);

  bot.catch((err, ctx) => {
    console.error(`[bot] Unhandled error for update ${ctx.updateType}:`, err);
  });

  return bot;
}

module.exports = { createBot };
