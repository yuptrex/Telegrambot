const { getActiveHero } = require('../../services/heroService');
const { battleMenuKeyboard } = require('../keyboards');
const battleFlow = require('../battleFlow');
const battleService = require('../../services/battleService');
const Hero = require('../../models/Hero');
const matchmaking = require('../../game/matchmaking');
const { Markup } = require('telegraf');

module.exports = (bot) => {
  bot.command('battle', async (ctx) => {
    const hero = await getActiveHero(ctx.state.user._id);
    if (!hero) return ctx.reply('You have no hero yet. Use /start to create one!');
    if (hero.hp <= 0) return ctx.reply('Your hero has 0 HP! Rest up before battling (HP regenerates over time).');

    await ctx.reply('⚔️ Choose your battle type:', battleMenuKeyboard());
  });

  bot.action('battle_menu:pve', async (ctx) => {
    await ctx.answerCbQuery();
    const hero = await getActiveHero(ctx.state.user._id);
    if (!hero) return ctx.reply('You have no hero yet. Use /start to create one!');
    await battleFlow.startPvEFlow(ctx, hero);
  });

  bot.action('battle_menu:ranked', async (ctx) => {
    await ctx.answerCbQuery();
    const hero = await getActiveHero(ctx.state.user._id);
    if (!hero) return ctx.reply('You have no hero yet. Use /start to create one!');

    if (matchmaking.isQueued(hero._id)) {
      return ctx.reply('You are already in the ranked queue. Hang tight!');
    }

    matchmaking.enqueue({ heroId: hero._id, userId: ctx.state.user._id, eloRating: hero.eloRating, chatId: ctx.chat.id });
    await ctx.reply(
      `🏆 You've entered the ranked queue (ELO ${hero.eloRating}). Queue size: ${matchmaking.queueSize()}.\n` +
        `You'll be matched automatically — this can take a bit depending on how many players are online.`
    );
  });

  bot.action('battle_menu:challenge', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      "🤺 To challenge a friend, ask them to send you their Telegram @username, then use:\n`/challenge @username`",
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('challenge', async (ctx) => {
    const hero = await getActiveHero(ctx.state.user._id);
    if (!hero) return ctx.reply('You have no hero yet. Use /start to create one!');

    const parts = ctx.message.text.split(' ').filter(Boolean);
    if (parts.length < 2) return ctx.reply('Usage: /challenge @username');

    const targetUsername = parts[1].replace('@', '');
    const User = require('../../models/User');
    const targetUser = await User.findOne({ username: targetUsername });
    if (!targetUser) return ctx.reply('Could not find that user (they need to have messaged this bot at least once).');
    if (String(targetUser._id) === String(ctx.state.user._id)) return ctx.reply("You can't challenge yourself!");

    const targetHero = targetUser.activeHeroId ? await Hero.findById(targetUser.activeHeroId) : null;
    if (!targetHero) return ctx.reply('That player has no hero yet.');

    await ctx.reply(
      `🤺 Challenge sent to @${targetUsername}! Waiting for them to accept...`
    );

    try {
      await ctx.telegram.sendMessage(
        targetUser.telegramId,
        `⚔️ ${ctx.from.first_name} (${hero.name}) has challenged you to a PvP battle!`,
        Markup.inlineKeyboard([
          [Markup.button.callback('✅ Accept', `challenge_accept:${hero._id}:${ctx.chat.id}`)],
          [Markup.button.callback('❌ Decline', `challenge_decline:${hero._id}`)],
        ])
      );
    } catch (err) {
      await ctx.reply("Couldn't reach that player — they may need to start a chat with the bot first.");
    }
  });

  bot.action(/challenge_accept:([a-f0-9]+):(-?\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, challengerHeroId, challengerChatId] = ctx.match;

    const accepterHero = await getActiveHero(ctx.state.user._id);
    if (!accepterHero) return ctx.reply('You have no hero yet. Use /start to create one!');

    const challengerHero = await Hero.findById(challengerHeroId);
    if (!challengerHero) return ctx.reply('That challenge is no longer valid.');

    await ctx.reply(`⚔️ Challenge accepted! Battle starting...`);
    await ctx.telegram.sendMessage(challengerChatId, `⚔️ Your challenge was accepted! Battle starting...`);

    // Simplified PvP: since true simultaneous cross-chat turns need per-chat message refs,
    // v1 runs PvP as sequential exchanges rendered independently to each player's chat.
    const { battle, state } = await battleService.startPvPBattle(challengerHero, accepterHero, 'pvp');

    const { turnActionKeyboard } = require('../keyboards');
    const text = battleFlow.renderBattleText(state);

    const msg1 = await ctx.telegram.sendMessage(challengerChatId, text, {
      parse_mode: 'Markdown',
      ...turnActionKeyboard(challengerHero, battle._id),
    });
    const msg2 = await ctx.reply(text, { parse_mode: 'Markdown', ...turnActionKeyboard(accepterHero, battle._id) });

    battleFlow.battleMessageRefs.set(String(battle._id), {
      chatId1: challengerChatId,
      messageId1: msg1.message_id,
      chatId2: ctx.chat.id,
      messageId2: msg2.message_id,
    });
  });

  bot.action(/challenge_decline:([a-f0-9]+)/, async (ctx) => {
    await ctx.answerCbQuery('Challenge declined.');
    await ctx.editMessageText('You declined the challenge.');
  });
};
