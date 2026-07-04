const Hero = require('../../models/Hero');
const { HERO_CREATION_SCENE_ID } = require('../scenes/heroCreation');

module.exports = (bot) => {
  bot.command('start', async (ctx) => {
    const user = ctx.state.user;

    if (user.activeHeroId) {
      const hero = await Hero.findById(user.activeHeroId);
      if (hero) {
        return ctx.reply(
          `Welcome back, ${hero.name}! 👋\nUse /hero to view your stats or /battle to fight.`
        );
      }
    }

    return ctx.scene.enter(HERO_CREATION_SCENE_ID);
  });
};
