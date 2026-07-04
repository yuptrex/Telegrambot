const { Scenes, Markup } = require('telegraf');
const { createHeroForUser } = require('../../services/heroService');
const { classSelectionKeyboard } = require('../keyboards');
const CLASSES = require('../../config/classes');

const HERO_CREATION_SCENE_ID = 'HERO_CREATION';

const heroCreationScene = new Scenes.WizardScene(
  HERO_CREATION_SCENE_ID,
  // Step 1: ask for a hero name
  async (ctx) => {
    await ctx.reply('⚔️ Welcome, adventurer! What will your hero be named?\n(2-20 characters, letters/numbers only)');
    return ctx.wizard.next();
  },
  // Step 2: validate name, ask for class
  async (ctx) => {
    const name = ctx.message?.text?.trim();
    if (!name || !/^[a-zA-Z0-9 _-]{2,20}$/.test(name)) {
      await ctx.reply('❌ Invalid name. Please use 2-20 letters/numbers/spaces only.');
      return; // stay on this step
    }

    ctx.wizard.state.heroName = name;

    const classDescriptions = Object.entries(CLASSES)
      .map(([key, cfg]) => `${cfg.emoji} *${cfg.label}* — ${cfg.description}`)
      .join('\n');

    await ctx.replyWithMarkdown(
      `Nice, *${name}*! Now choose your class:\n\n${classDescriptions}`,
      classSelectionKeyboard()
    );
    return ctx.wizard.next();
  },
  // Step 3: handled entirely by the create_class:* action handler (registered on bot), which
  // creates the hero and leaves the scene. This step just guards against stray text input.
  async (ctx) => {
    if (ctx.callbackQuery) return; // handled by action handler below
    await ctx.reply('Please tap one of the class buttons above to continue. 👆');
  }
);

// Class selection handler — must be registered on the scene so it fires while inside the wizard.
heroCreationScene.action(/create_class:(warrior|mage|rogue|paladin)/, async (ctx) => {
  await ctx.answerCbQuery();
  const className = ctx.match[1];
  const heroName = ctx.wizard.state.heroName;

  if (!heroName) {
    await ctx.reply('Something went wrong — please restart with /start.');
    return ctx.scene.leave();
  }

  const hero = await createHeroForUser(ctx.state.user._id, heroName, className);
  const cfg = CLASSES[className];

  await ctx.editMessageText(
    `🎉 *${hero.name}* the ${cfg.label} has entered the arena!\n\n` +
      `HP: ${hero.maxHp} | MP: ${hero.maxMana}\n` +
      `STR: ${hero.stats.strength} | INT: ${hero.stats.intelligence} | AGI: ${hero.stats.agility} | DEF: ${hero.stats.defense}\n\n` +
      `Use /hero to view your stats, or /battle to start fighting!`,
    { parse_mode: 'Markdown' }
  );

  return ctx.scene.leave();
});

module.exports = { heroCreationScene, HERO_CREATION_SCENE_ID };
