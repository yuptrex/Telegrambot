const { Markup } = require('telegraf');
const { getSkillsForClass } = require('../../game/skills/skillCatalogue');

function classSelectionKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🛡️ Warrior', 'create_class:warrior'), Markup.button.callback('🔮 Mage', 'create_class:mage')],
    [Markup.button.callback('🗡️ Rogue', 'create_class:rogue'), Markup.button.callback('⚜️ Paladin', 'create_class:paladin')],
  ]);
}

function battleMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⚔️ PvE Battle', 'battle_menu:pve')],
    [Markup.button.callback('🤺 Challenge Friend', 'battle_menu:challenge')],
    [Markup.button.callback('🏆 Ranked Queue', 'battle_menu:ranked')],
  ]);
}

function turnActionKeyboard(hero, battleId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⚔️ Attack', `turn:${battleId}:attack`), Markup.button.callback('✨ Skill', `turn:${battleId}:skillmenu`)],
    [Markup.button.callback('🎒 Item', `turn:${battleId}:itemmenu`), Markup.button.callback('🛡️ Defend', `turn:${battleId}:defend`)],
  ]);
}

function skillSelectKeyboard(hero, battleId) {
  const skills = getSkillsForClass(hero.class).filter((s) => hero.unlockedSkills.includes(s.id));
  const rows = skills.map((s) => {
    const disabled = hero.mana < s.manaCost;
    const label = `${s.name} (${s.manaCost} MP)${disabled ? ' ❌' : ''}`;
    return [Markup.button.callback(label, disabled ? 'noop' : `turn:${battleId}:skill:${s.id}`)];
  });
  rows.push([Markup.button.callback('⬅️ Back', `turn:${battleId}:back`)]);
  return Markup.inlineKeyboard(rows);
}

function itemSelectKeyboard(items, battleId) {
  const rows = items
    .filter((i) => i.type === 'consumable')
    .map((i) => [Markup.button.callback(i.name, `turn:${battleId}:item:${i._id}`)]);
  rows.push([Markup.button.callback('⬅️ Back', `turn:${battleId}:back`)]);
  return Markup.inlineKeyboard(rows);
}

function shopPageKeyboard(items, page, totalPages) {
  const itemButtons = items.map((i) => [
    Markup.button.callback(`${i.name} (${i.rarity}) — ${i.goldPrice}g${i.gemPrice ? `/${i.gemPrice}💎` : ''}`, `shop_buy:${i._id}`),
  ]);
  const navRow = [];
  if (page > 0) navRow.push(Markup.button.callback('⬅️ Prev', `shop_page:${page - 1}`));
  if (page < totalPages - 1) navRow.push(Markup.button.callback('Next ➡️', `shop_page:${page + 1}`));
  if (navRow.length) itemButtons.push(navRow);
  return Markup.inlineKeyboard(itemButtons);
}

function guildMenuKeyboard(hasGuild) {
  if (hasGuild) {
    return Markup.inlineKeyboard([
      [Markup.button.callback('📋 View Guild', 'guild_menu:view')],
      [Markup.button.callback('💰 Contribute Gold', 'guild_menu:contribute')],
      [Markup.button.callback('🚪 Leave Guild', 'guild_menu:leave')],
    ]);
  }
  return Markup.inlineKeyboard([
    [Markup.button.callback('🆕 Create Guild', 'guild_menu:create')],
    [Markup.button.callback('🔍 Browse Guilds', 'guild_menu:browse')],
  ]);
}

function confirmKeyboard(actionPrefix) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Confirm', `${actionPrefix}:confirm`), Markup.button.callback('❌ Cancel', `${actionPrefix}:cancel`)],
  ]);
}

module.exports = {
  classSelectionKeyboard,
  battleMenuKeyboard,
  turnActionKeyboard,
  skillSelectKeyboard,
  itemSelectKeyboard,
  shopPageKeyboard,
  guildMenuKeyboard,
  confirmKeyboard,
};
