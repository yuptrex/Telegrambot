const { getTopHeroes, getGuildLeaderboard, formatLeaderboard } = require('../../services/leaderboardService');

module.exports = (bot) => {
  bot.command('leaderboard', async (ctx) => {
    const heroes = await getTopHeroes(10);
    await ctx.replyWithMarkdown(formatLeaderboard(heroes));

    if (ctx.state.user.guildId) {
      const guildHeroes = await getGuildLeaderboard(ctx.state.user.guildId, 10);
      await ctx.replyWithMarkdown(formatLeaderboard(guildHeroes, '🏰 Guild Leaderboard'));
    }
  });
};
