const Tournament = require('../../models/Tournament');
const tournamentService = require('../../services/tournamentService');
const { getActiveHero } = require('../../services/heroService');
const { Markup } = require('telegraf');

module.exports = (bot) => {
  bot.command('tournament', async (ctx) => {
    const active = await Tournament.findOne({ status: { $in: ['registration', 'active'] } }).sort({ createdAt: -1 });
    if (!active) return ctx.reply('No active tournament right now. Check back later!');

    const text = tournamentService.formatBracket(active);
    if (active.status === 'registration') {
      await ctx.replyWithMarkdown(
        text + `\n\nRegistered: ${active.registeredPlayers.length} players`,
        Markup.inlineKeyboard([[Markup.button.callback('📝 Register', `tourney_register:${active._id}`)]])
      );
    } else {
      await ctx.replyWithMarkdown(text);
    }
  });

  bot.action(/tourney_register:([a-f0-9]+)/, async (ctx) => {
    const hero = await getActiveHero(ctx.state.user._id);
    if (!hero) return ctx.answerCbQuery('You need a hero first! Use /start.', { show_alert: true });

    const tournament = await Tournament.findById(ctx.match[1]);
    if (!tournament) return ctx.answerCbQuery('Tournament not found.', { show_alert: true });

    try {
      await tournamentService.registerPlayer(tournament, hero._id);
      await ctx.answerCbQuery('Registered! Good luck.', { show_alert: true });
    } catch (err) {
      await ctx.answerCbQuery(err.message, { show_alert: true });
    }
  });

  // Admin-only: start the tournament (locks registration, generates bracket).
  bot.command('starttournament', async (ctx) => {
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map((s) => s.trim());
    if (!adminIds.includes(String(ctx.from.id))) return ctx.reply('⛔ Admins only.');

    const tournament = await Tournament.findOne({ status: 'registration' }).sort({ createdAt: -1 });
    if (!tournament) return ctx.reply('No tournament in registration phase.');

    try {
      await tournamentService.startTournament(tournament);
      await ctx.replyWithMarkdown(tournamentService.formatBracket(tournament));
    } catch (err) {
      await ctx.reply(`⚠️ ${err.message}`);
    }
  });

  // Admin-only: create a new tournament.
  bot.command('newtournament', async (ctx) => {
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map((s) => s.trim());
    if (!adminIds.includes(String(ctx.from.id))) return ctx.reply('⛔ Admins only.');

    const name = ctx.message.text.replace('/newtournament', '').trim() || `Season Tournament`;
    const tournament = await tournamentService.createTournament(name, 1, { gold: 1000, gems: 50 });
    await ctx.reply(`🏆 Tournament "${tournament.name}" created and open for registration!`);
  });
};
