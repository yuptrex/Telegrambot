const Guild = require('../../models/Guild');
const guildService = require('../../services/guildService');
const { guildMenuKeyboard } = require('../keyboards');

module.exports = (bot) => {
  bot.command('guild', async (ctx) => {
    const hasGuild = !!ctx.state.user.guildId;
    await ctx.reply(hasGuild ? '🏰 Guild Menu' : "You're not in a guild yet.", guildMenuKeyboard(hasGuild));
  });

  bot.action('guild_menu:view', async (ctx) => {
    await ctx.answerCbQuery();
    const guild = await Guild.findById(ctx.state.user.guildId);
    if (!guild) return ctx.reply("You're not in a guild.");
    await ctx.replyWithMarkdown(guildService.formatGuildCard(guild));
  });

  bot.action('guild_menu:leave', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await guildService.leaveGuild(ctx.state.user);
      await ctx.reply('You have left your guild.');
    } catch (err) {
      await ctx.reply(`⚠️ ${err.message}`);
    }
  });

  bot.action('guild_menu:create', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('To create a guild, use:\n`/createguild GuildName | Description`', { parse_mode: 'Markdown' });
  });

  bot.command('createguild', async (ctx) => {
    const raw = ctx.message.text.replace('/createguild', '').trim();
    if (!raw) return ctx.reply('Usage: /createguild GuildName | Description');

    const [name, description = ''] = raw.split('|').map((s) => s.trim());
    if (!name || name.length < 3) return ctx.reply('Guild name must be at least 3 characters.');

    try {
      const guild = await guildService.createGuild(ctx.state.user, name, description);
      await ctx.replyWithMarkdown(`🏰 Guild *${guild.name}* created! You are the leader.`);
    } catch (err) {
      await ctx.reply(`⚠️ ${err.message}`);
    }
  });

  bot.action('guild_menu:browse', async (ctx) => {
    await ctx.answerCbQuery();
    const guilds = await Guild.find().limit(10).sort({ level: -1 });
    if (!guilds.length) return ctx.reply('No guilds exist yet. Be the first to create one with /createguild!');

    const { Markup } = require('telegraf');
    const rows = guilds.map((g) => [Markup.button.callback(`${g.name} (Lv.${g.level}, ${g.members.length} members)`, `guild_join:${g._id}`)]);
    await ctx.reply('🔍 *Guilds*', { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) });
  });

  bot.action(/guild_join:([a-f0-9]+)/, async (ctx) => {
    try {
      const result = await guildService.joinGuild(ctx.state.user, ctx.match[1]);
      await ctx.answerCbQuery(result.pending ? 'Join request sent!' : 'Joined guild!', { show_alert: true });
    } catch (err) {
      await ctx.answerCbQuery(err.message, { show_alert: true });
    }
  });

  bot.action('guild_menu:contribute', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('To contribute gold, use:\n`/contribute 100`', { parse_mode: 'Markdown' });
  });

  bot.command('contribute', async (ctx) => {
    const amount = parseInt(ctx.message.text.split(' ')[1], 10);
    if (!amount || amount <= 0) return ctx.reply('Usage: /contribute <amount>');

    if (!ctx.state.user.guildId) return ctx.reply("You're not in a guild.");
    const guild = await Guild.findById(ctx.state.user.guildId);

    try {
      await guildService.contributeToTreasury(ctx.state.user, guild, amount);
      await ctx.reply(`💰 Contributed ${amount} gold to ${guild.name}'s treasury!`);
    } catch (err) {
      await ctx.reply(`⚠️ ${err.message}`);
    }
  });
};
