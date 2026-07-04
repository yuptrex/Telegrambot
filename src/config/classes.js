/**
 * Base stats and per-level growth for each hero class.
 * Tune these numbers to rebalance the game without touching engine code.
 */
module.exports = {
  warrior: {
    label: 'Warrior',
    emoji: '🛡️',
    description: 'High HP and defense. A durable melee brawler.',
    base: { hp: 120, mana: 30, strength: 12, intelligence: 4, agility: 6, defense: 10 },
    growthPerLevel: { hp: 12, mana: 2, strength: 2.2, intelligence: 0.5, agility: 0.8, defense: 1.8 },
  },
  mage: {
    label: 'Mage',
    emoji: '🔮',
    description: 'High magic damage, low HP. Mana-hungry glass cannon.',
    base: { hp: 80, mana: 80, strength: 4, intelligence: 14, agility: 7, defense: 4 },
    growthPerLevel: { hp: 6, mana: 8, strength: 0.5, intelligence: 2.5, agility: 1.0, defense: 0.6 },
  },
  rogue: {
    label: 'Rogue',
    emoji: '🗡️',
    description: 'High speed and crit chance. Burst damage specialist.',
    base: { hp: 90, mana: 40, strength: 9, intelligence: 5, agility: 14, defense: 5 },
    growthPerLevel: { hp: 8, mana: 3, strength: 1.6, intelligence: 0.6, agility: 2.4, defense: 0.8 },
  },
  paladin: {
    label: 'Paladin',
    emoji: '⚜️',
    description: 'Hybrid tank/healer. Balanced and resilient.',
    base: { hp: 110, mana: 55, strength: 9, intelligence: 9, agility: 6, defense: 9 },
    growthPerLevel: { hp: 10, mana: 5, strength: 1.4, intelligence: 1.4, agility: 0.8, defense: 1.5 },
  },
};
