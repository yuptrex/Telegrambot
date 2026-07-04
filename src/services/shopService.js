const Item = require('../models/Item');
const { purchaseCost, canAfford } = require('../game/economy');

const PAGE_SIZE = 5;

/** Fetch a page of shop templates (isTemplate: true), optionally filtered by type. */
async function getShopPage(page = 0, type = null) {
  const filter = { isTemplate: true };
  if (type) filter.type = type;

  const total = await Item.countDocuments(filter);
  const items = await Item.find(filter)
    .sort({ rarity: 1, goldPrice: 1 })
    .skip(page * PAGE_SIZE)
    .limit(PAGE_SIZE);

  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Buy a template item: clones it into a new owned Item instance and deducts currency. */
async function buyItem(user, templateId) {
  const template = await Item.findOne({ _id: templateId, isTemplate: true });
  if (!template) throw new Error('Item not found in shop.');

  const { goldCost, gemCost } = purchaseCost(template);
  if (!canAfford(user, goldCost, gemCost)) {
    throw new Error('Insufficient funds.');
  }

  user.gold -= goldCost;
  user.gems -= gemCost;
  await user.save();

  const owned = await Item.create({
    name: template.name,
    type: template.type,
    rarity: template.rarity,
    statBonuses: template.statBonuses,
    goldPrice: template.goldPrice,
    gemPrice: template.gemPrice,
    isTemplate: false,
    templateId: template._id,
    ownerId: user._id,
  });

  return owned;
}

module.exports = { getShopPage, buyItem, PAGE_SIZE };
