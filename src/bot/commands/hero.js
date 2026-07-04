const { getActiveHero, formatStatCard } = require('../../services/heroService');
const { getHeroInventory } = require('../../services/inventoryService');
const { Markup } = require('telegraf');

module.exports = (bot) => {
  bot.command('hero', async (ctx) => {
    const hero = await getActiveHero(ctx.state.user._id);
    if (!hero) return ctx.reply('You have no hero yet. Use /start to create one!');

    const card = formatStatCard(hero);
    await ctx.replyWithMarkdown(
      card,
      Markup.inlineKeyboard([
        [Markup.button.callback('🎒 Inventory', 'hero_menu:inventory')],
        [Markup.button.callback('⚔️ Equipment', 'hero_menu:equipment')],
      ])
    );
  });

  bot.action('hero_menu:inventory', async (ctx) => {
    await ctx.answerCbQuery();
    const hero = await getActiveHero(ctx.state.user._id);
    const items = await getHeroInventory(hero);
    if (!items.length) return ctx.reply('🎒 Your inventory is empty. Visit /shop to buy gear!');

    const lines = items.map((i) => `• ${i.name} (${i.rarity}, ${i.type})`);
    await ctx.reply(`🎒 *Inventory*\n\n${lines.join('\n')}\n\nUse /inventory to equip or consume items.`, {
      parse_mode: 'Markdown',
    });
  });

  bot.action('hero_menu:equipment', async (ctx) => {
    await ctx.answerCbQuery();
    const hero = await getActiveHero(ctx.state.user._id);
    const { getEquipmentBonuses } = require('../../services/heroService');
    const Item = require('../../models/Item');

    const [weapon, armor, accessory] = await Promise.all([
      hero.equipment.weapon ? Item.findById(hero.equipment.weapon) : null,
      hero.equipment.armor ? Item.findById(hero.equipment.armor) : null,
      hero.equipment.accessory ? Item.findById(hero.equipment.accessory) : null,
    ]);

    await ctx.reply(
      `⚔️ *Equipment*\n\n` +
        `Weapon: ${weapon ? weapon.name : 'None'}\n` +
        `Armor: ${armor ? armor.name : 'None'}\n` +
        `Accessory: ${accessory ? accessory.name : 'None'}\n\n` +
        `Use /inventory to equip items.`,
      { parse_mode: 'Markdown' }
    );
  });
};
