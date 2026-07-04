const { getActiveHero } = require('../../services/heroService');
const { formatQuestList, ensureTodayQuests, getTodayQuestDefs } = require('../../services/questService');
const { formatAchievements } = require('../../services/achievementService');
const friendService = require('../../services/friendService');
const Guild = require('../../models/Guild');
const User = require('../../models/User');
const { Markup } = require('telegraf');

module.exports = (bot) => {
  bot.command('profile', async (ctx) => {
    const hero = await getActiveHero(ctx.state.user._id);
    if (!hero) return ctx.reply('You have no hero yet. Use /start to create one!');

    const guild = ctx.state.user.guildId ? await Guild.findById(ctx.state.user.guildId) : null;

    const text =
      `👤 *${hero.name}*'s Profile\n\n` +
      `Class: ${hero.class} | Level ${hero.level}\n` +
      `Record: ${hero.wins}W / ${hero.losses}L\n` +
      `ELO Rank: ${hero.eloRating}\n` +
      `Guild: ${guild ? guild.name : 'None'}\n` +
      `Gold: ${ctx.state.user.gold} | Gems: ${ctx.state.user.gems}\n` +
      `Login streak: ${ctx.state.user.loginStreak} days\n\n` +
      formatAchievements(ctx.state.user);

    await ctx.replyWithMarkdown(text);
  });

  bot.command('quests', async (ctx) => {
    ensureTodayQuests(ctx.state.user);
    await ctx.state.user.save();
    await ctx.replyWithMarkdown(formatQuestList(ctx.state.user));

    // offer claim buttons for completed-but-unclaimed quests
    const defs = getTodayQuestDefs(ctx.state.user);
    const claimable = defs.filter((q) => {
      const p = ctx.state.user.dailyQuestProgress[q.id];
      return p.completed && !p.claimed;
    });
    if (claimable.length) {
      const rows = claimable.map((q) => [Markup.button.callback(`🎁 Claim: ${q.label}`, `quest_claim:${q.id}`)]);
      await ctx.reply('You have rewards to claim:', Markup.inlineKeyboard(rows));
    }
  });

  bot.action(/quest_claim:(\w+)/, async (ctx) => {
    const questId = ctx.match[1];
    const { QUEST_POOL } = require('../../services/questService');
    const def = QUEST_POOL.find((q) => q.id === questId);
    const progress = ctx.state.user.dailyQuestProgress[questId];

    if (!def || !progress || !progress.completed || progress.claimed) {
      return ctx.answerCbQuery('Nothing to claim.', { show_alert: true });
    }

    progress.claimed = true;
    ctx.state.user.gold += def.rewardGold;
    ctx.state.user.markModified('dailyQuestProgress');
    await ctx.state.user.save();

    const hero = await getActiveHero(ctx.state.user._id);
    if (hero) {
      const { applyExp } = require('../../game/classes/heroFactory');
      applyExp(hero, def.rewardExp);
      await hero.save();
    }

    await ctx.answerCbQuery(`Claimed ${def.rewardGold} gold + ${def.rewardExp} exp!`, { show_alert: true });
  });

  bot.command('friends', async (ctx) => {
    const friends = await friendService.getFriendsList(ctx.state.user);
    const incoming = ctx.state.user.friendRequestsIncoming;

    let text = `👥 *Friends* (${friends.length})\n`;
    text += friends.length ? friends.map((f) => `• ${f.username ? '@' + f.username : f.firstName}`).join('\n') : 'No friends yet.';

    await ctx.replyWithMarkdown(text);

    if (incoming.length) {
      const requesters = await User.find({ _id: { $in: incoming } });
      for (const r of requesters) {
        await ctx.reply(
          `📨 Friend request from ${r.username ? '@' + r.username : r.firstName}`,
          Markup.inlineKeyboard([
            [Markup.button.callback('✅ Accept', `friend_accept:${r._id}`), Markup.button.callback('❌ Decline', `friend_decline:${r._id}`)],
          ])
        );
      }
    }
  });

  bot.command('addfriend', async (ctx) => {
    const parts = ctx.message.text.split(' ').filter(Boolean);
    if (parts.length < 2) return ctx.reply('Usage: /addfriend @username');

    const username = parts[1].replace('@', '');
    const target = await User.findOne({ username });
    if (!target) return ctx.reply('User not found.');

    try {
      await friendService.sendFriendRequest(ctx.state.user, target);
      await ctx.reply(`Friend request sent to @${username}!`);
    } catch (err) {
      await ctx.reply(`⚠️ ${err.message}`);
    }
  });

  bot.action(/friend_accept:([a-f0-9]+)/, async (ctx) => {
    try {
      await friendService.acceptFriendRequest(ctx.state.user, ctx.match[1]);
      await ctx.answerCbQuery('Friend added!', { show_alert: true });
    } catch (err) {
      await ctx.answerCbQuery(err.message, { show_alert: true });
    }
  });

  bot.action(/friend_decline:([a-f0-9]+)/, async (ctx) => {
    await friendService.declineFriendRequest(ctx.state.user, ctx.match[1]);
    await ctx.answerCbQuery('Declined.');
  });

  bot.command('help', async (ctx) => {
    await ctx.replyWithMarkdown(
      `⚔️ *Battle Arena Bot — Commands*\n\n` +
        `/start — Create your hero\n` +
        `/hero — View your hero's stats\n` +
        `/battle — Fight (PvE, Challenge, Ranked)\n` +
        `/challenge @user — Challenge a friend directly\n` +
        `/shop — Buy equipment\n` +
        `/inventory — Equip or use items\n` +
        `/guild — Guild menu\n` +
        `/createguild Name | Description — Create a guild\n` +
        `/contribute <amount> — Donate gold to guild treasury\n` +
        `/leaderboard — Global & guild rankings\n` +
        `/tournament — View/register for tournaments\n` +
        `/profile — Full stat card & achievements\n` +
        `/quests — Daily quests\n` +
        `/friends — Manage friends\n` +
        `/addfriend @user — Send a friend request\n\n` +
        `*How battles work:* each turn, pick Attack, Skill, Item, or Defend within 30 seconds. ` +
        `Turn order is based on Agility. Reduce your opponent's HP to 0 to win!`
    );
  });
};
