const Item = require('../models/Item');
const Hero = require('../models/Hero');

async function getHeroInventory(hero) {
  return Item.find({ _id: { $in: hero.inventory } });
}

/** Consume a consumable item: apply its effect to the hero and remove it from inventory. */
async function consumeItem(hero, itemId) {
  const item = await Item.findOne({ _id: itemId, ownerId: hero.userId });
  if (!item) throw new Error('Item not found in your inventory.');
  if (item.type !== 'consumable') throw new Error('Only consumables can be used directly; equip other items instead.');

  if (item.statBonuses?.healAmount) {
    hero.hp = Math.min(hero.maxHp, hero.hp + item.statBonuses.healAmount);
  }
  if (item.statBonuses?.manaAmount) {
    hero.mana = Math.min(hero.maxMana, hero.mana + item.statBonuses.manaAmount);
  }

  hero.inventory = hero.inventory.filter((id) => String(id) !== String(item._id));
  await hero.save();
  await Item.findByIdAndDelete(item._id);

  return { hero, consumedItem: item };
}

module.exports = { getHeroInventory, consumeItem };
