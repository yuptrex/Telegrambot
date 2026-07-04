const cron = require('node-cron');
const Hero = require('../models/Hero');
const matchmaking = require('../game/matchmaking');
const battleService = require('../services/battleService');
const battleFlow = require('../bot/battleFlow');
const { turnActionKeyboard } = require('../bot/keyboards');

/** Runs every 5 seconds: attempts to pair up ranked-queue players and starts their battles. */
function scheduleMatchmakingTick(bot) {
  cron.schedule('*/5 * * * * *', async () => {
    try {
      const matches = matchmaking.findMatches();
      for (const { a, b } of matches) {
        const [hero1, hero2] = await Promise.all([Hero.findById(a.heroId), Hero.findById(b.heroId)]);
        if (!hero1 || !hero2) continue;

        const { battle, state } = await battleService.startPvPBattle(hero1, hero2, 'ranked');
        const text = battleFlow.renderBattleText(state);

        const msg1 = await bot.telegram.sendMessage(a.chatId, `🏆 Ranked match found!\n\n${text}`, {
          parse_mode: 'Markdown',
          ...turnActionKeyboard(hero1, battle._id),
        });
        const msg2 = await bot.telegram.sendMessage(b.chatId, `🏆 Ranked match found!\n\n${text}`, {
          parse_mode: 'Markdown',
          ...turnActionKeyboard(hero2, battle._id),
        });

        battleFlow.battleMessageRefs.set(String(battle._id), {
          chatId1: a.chatId,
          messageId1: msg1.message_id,
          chatId2: b.chatId,
          messageId2: msg2.message_id,
        });
      }
    } catch (err) {
      console.error('[jobs] Matchmaking tick failed:', err);
    }
  });
}

module.exports = { scheduleMatchmakingTick };
