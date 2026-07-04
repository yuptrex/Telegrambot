const {
  PVE_GOLD_REWARD,
  PVE_EXP_REWARD,
  PVP_GOLD_REWARD,
  PVP_EXP_REWARD,
  LOSER_CONSOLATION_EXP,
  ITEM_DROP_CHANCE,
  RARITY_ORDER,
} = require('../config/constants');

function randomInRange([min, max]) {
  return Math.round(min + Math.random() * (max - min));
}

/** Compute winner/loser rewards for a completed battle. */
function computeBattleRewards(battleType) {
  const isPvE = battleType === 'pve';
  const gold = randomInRange(isPvE ? PVE_GOLD_REWARD : PVP_GOLD_REWARD);
  const exp = randomInRange(isPvE ? PVE_EXP_REWARD : PVP_EXP_REWARD);

  const itemDropped = Math.random() < ITEM_DROP_CHANCE;
  let dropRarity = null;
  if (itemDropped) {
    // weighted toward common; roll a rarity tier
    const roll = Math.random();
    if (roll > 0.97) dropRarity = 'legendary';
    else if (roll > 0.85) dropRarity = 'epic';
    else if (roll > 0.55) dropRarity = 'rare';
    else dropRarity = 'common';
  }

  return {
    winner: { gold, exp, dropRarity },
    loser: { gold: 0, exp: LOSER_CONSOLATION_EXP },
  };
}

/** Validate & compute the total cost of a purchase, returns { goldCost, gemCost }. */
function purchaseCost(item, quantity = 1) {
  return {
    goldCost: (item.goldPrice || 0) * quantity,
    gemCost: (item.gemPrice || 0) * quantity,
  };
}

function canAfford(user, goldCost, gemCost) {
  return user.gold >= goldCost && user.gems >= gemCost;
}

module.exports = {
  computeBattleRewards,
  purchaseCost,
  canAfford,
  randomInRange,
  RARITY_ORDER,
};
