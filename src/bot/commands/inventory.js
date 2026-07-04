const { getActiveHero, equipItem, unequipSlot } = require('../../services/heroService');
const { getHeroInventory, consumeItem } = require('../../services/inventoryService');
const { Markup } = require('telegraf');

function inventoryKeyboard(items) {
  const rows = items.map((i) => {
    const action = i.type === 'consumable' ? `inv_use:${i._id}` : `inv_equip:${i._id}`;
    const label = i.type === 'consumable' ? `Use: ${i.name}` : `Equip: ${i.name}`;
    return [Markup.button.callback(label, action)];
  });
  return Markup.inlineKeyboard(rows);
}

module.exports = (bot) => {
  bot.command('inventory', async (ctx) => {
    const hero = await getActiveHero(ctx.state.user._id);
    if (!hero) return ctx.reply('You have no hero yet. Use /start to create one!');

    const items = await getHeroInventory(hero);
    if (!items.length) return ctx.reply('🎒 Your inventory is empty. Visit /shop to buy gear!');

    await ctx.reply('🎒 *Your Inventory*\nTap an item to equip or use it:', {
      parse_mode: 'Markdown',
      ...inventoryKeyboard(items),
    });
  });

  bot.action(/inv_equip:([a-f0-9]+)/, async (ctx) => {
    const Item = require('../../models/Item');
    const hero = await getActiveHero(ctx.state.user._id);
    const item = await Item.findById(ctx.match[1]);
    if (!hero || !item) return ctx.answerCbQuery('Not found.', { show_alert: true });

    try {
      await equipItem(hero, item);
      await ctx.answerCbQuery(`Equipped ${item.name}!`, { show_alert: true });
    } catch (err) {
      await ctx.answerCbQuery(err.message, { show_alert: true });
    }
  });

  bot.action(/inv_use:([a-f0-9]+)/, async (ctx) => {
    const hero = await getActiveHero(ctx.state.user._id);
    if (!hero) return ctx.answerCbQuery('No active hero.', { show_alert: true });

    try {
      const { consumedItem } = await consumeItem(hero, ctx.match[1]);
      await ctx.answerCbQuery(`Used ${consumedItem.name}!`, { show_alert: true });
    } catch (err) {
      await ctx.answerCbQuery(err.message, { show_alert: true });
    }
  });
};
