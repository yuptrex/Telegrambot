const { getShopPage, buyItem } = require('../../services/shopService');
const { shopPageKeyboard } = require('../keyboards');

async function renderShopPage(ctx, page, edit = false) {
  const { items, totalPages } = await getShopPage(page);
  if (!items.length) return ctx.reply('The shop is empty right now — an admin needs to run the seed script.');

  const text = `🛒 *Shop* (Page ${page + 1}/${totalPages})\nYour gold: ${ctx.state.user.gold} | gems: ${ctx.state.user.gems}`;
  const keyboard = shopPageKeyboard(items, page, totalPages);

  if (edit) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
  } else {
    await ctx.replyWithMarkdown(text, keyboard);
  }
}

module.exports = (bot) => {
  bot.command('shop', async (ctx) => renderShopPage(ctx, 0));

  bot.action(/shop_page:(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    await renderShopPage(ctx, parseInt(ctx.match[1], 10), true);
  });

  bot.action(/shop_buy:([a-f0-9]+)/, async (ctx) => {
    const itemId = ctx.match[1];
    try {
      const item = await buyItem(ctx.state.user, itemId);
      await ctx.answerCbQuery(`Purchased ${item.name}!`, { show_alert: true });

      const { getActiveHero } = require('../../services/heroService');
      const hero = await getActiveHero(ctx.state.user._id);
      if (hero) {
        hero.inventory.push(item._id);
        await hero.save();
      }
    } catch (err) {
      await ctx.answerCbQuery(err.message, { show_alert: true });
    }
  });
};
