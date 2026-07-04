const { getOrCreateUser } = require('../../services/userService');

/** Attach `ctx.state.user` (Mongo User doc) to every update. */
async function attachUser(ctx, next) {
  if (!ctx.from) return next();
  try {
    ctx.state.user = await getOrCreateUser(ctx.from);
  } catch (err) {
    console.error('[middleware] Failed to load/create user:', err);
    return ctx.reply('⚠️ Something went wrong loading your profile. Please try again.');
  }
  return next();
}

/** Very simple in-memory per-user rate limiter to prevent callback spam during battles. */
const lastActionAt = new Map();
const MIN_INTERVAL_MS = 400;

function rateLimit(ctx, next) {
  const id = ctx.from?.id;
  if (!id) return next();

  const now = Date.now();
  const last = lastActionAt.get(id) || 0;
  if (now - last < MIN_INTERVAL_MS) {
    if (ctx.answerCbQuery) ctx.answerCbQuery('Slow down a little!', { show_alert: false }).catch(() => {});
    return;
  }
  lastActionAt.set(id, now);
  return next();
}

/** Wraps a handler so unexpected errors don't crash the bot process. */
function safeHandler(handler) {
  return async (ctx) => {
    try {
      await handler(ctx);
    } catch (err) {
      console.error('[handler error]', err);
      const msg = err.message && err.message.length < 200 ? err.message : 'Something went wrong. Please try again.';
      try {
        if (ctx.answerCbQuery) await ctx.answerCbQuery(msg, { show_alert: true });
        else await ctx.reply(`⚠️ ${msg}`);
      } catch (_) {
        // ignore secondary errors while reporting the first
      }
    }
  };
}

module.exports = { attachUser, rateLimit, safeHandler };
