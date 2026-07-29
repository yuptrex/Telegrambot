const { Telegraf, Scenes, session } = require('telegraf');
const { attachUser, rateLimit } = require('./middlewares');
const { heroCreationScene } = require('./scenes/heroCreation');
const { mongoSessionStore } = require('../services/sessionStore');

function createBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error('BOT_TOKEN is not set in environment variables.');

  const bot = new Telegraf(token);

  // Session must come before scene middleware; stage manages the hero-creation wizard.
  // IMPORTANT: backed by MongoDB, not the default in-memory Map — every redeploy/restart
  // on Render kills the process, and an in-memory store would silently wipe anyone's
  // in-progress wizard/scene state (e.g. mid hero-creation), leaving their buttons dead
  // with no error shown.
  bot.use(session({ store: mongoSessionStore() }));

  // attachUser/rateLimit must run BEFORE the stage middleware — scene action handlers
  // (e.g. create_class:* in heroCreation.js) rely on ctx.state.user already being set.
  bot.use(attachUser);
  bot.use(rateLimit);

  // /start must always be able to reset the user out of whatever state they're stuck in
  // (stale wizard step, orphaned scene after a past crash, etc.) — without this, once
  // inside a scene, even /start gets swallowed by the current wizard step instead of
  // reaching the global /start handler below.
  bot.use((ctx, next) => {
    if (ctx.message?.text === '/start' && ctx.session?.__scenes) {
      ctx.session.__scenes = {};
    }
    return next();
  });

  const stage = new Scenes.Stage([heroCreationScene]);
  bot.use(stage.middleware());

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

