const { getActiveHero } = require('../../services/heroService');
const Hero = require('../../models/Hero');
const battleFlow = require('../battleFlow');
const battleService = require('../../services/battleService');

module.exports = (bot) => {
  // turn:<battleId>:attack | turn:<battleId>:defend | turn:<battleId>:skillmenu | turn:<battleId>:itemmenu | turn:<battleId>:back
  bot.action(/turn:([a-f0-9]+):(attack|defend|skillmenu|itemmenu|back)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, battleId, kind] = ctx.match;

    const state = battleService.getLiveState(battleId);
    if (!state) return ctx.reply('This battle has already ended.');

    const hero = await Hero.findById(state.sides.p1.heroId);
    if (!hero) return;

    if (kind === 'attack') {
      return battleFlow.submitPvEAction(ctx, battleId, { type: 'attack' });
    }
    if (kind === 'defend') {
      return battleFlow.submitPvEAction(ctx, battleId, { type: 'defend' });
    }
    if (kind === 'skillmenu') {
      return battleFlow.showSkillMenu(ctx, battleId, hero);
    }
    if (kind === 'itemmenu') {
      return battleFlow.showItemMenu(ctx, battleId, hero);
    }
    if (kind === 'back') {
      return battleFlow.showBackToActions(ctx, battleId, hero);
    }
  });

  // turn:<battleId>:skill:<skillId>
  bot.action(/turn:([a-f0-9]+):skill:(\w+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, battleId, skillId] = ctx.match;
    return battleFlow.submitPvEAction(ctx, battleId, { type: 'skill', skillId });
  });

  // turn:<battleId>:item:<itemId>
  bot.action(/turn:([a-f0-9]+):item:([a-f0-9]+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, battleId, itemId] = ctx.match;
    const state = battleService.getLiveState(battleId);
    if (!state) return ctx.reply('This battle has already ended.');
    const hero = await Hero.findById(state.sides.p1.heroId);
    return battleFlow.submitItemAction(ctx, battleId, itemId, hero);
  });

  bot.action('noop', async (ctx) => {
    await ctx.answerCbQuery('Not enough mana for that skill.', { show_alert: false });
  });
};
