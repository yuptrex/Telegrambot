/**
 * Base item catalogue used to seed the database (scripts/seed.js).
 * Rarity multiplier is applied to statBonuses at seed time for variety.
 */
const RARITY_MULTIPLIER = {
  common: 1,
  rare: 1.5,
  epic: 2.2,
  legendary: 3.2,
};

const BASE_ITEMS = [
  // Weapons
  { name: 'Rusty Sword', type: 'weapon', rarity: 'common', statBonuses: { strength: 3 }, goldPrice: 50, gemPrice: 0 },
  { name: 'Steel Longsword', type: 'weapon', rarity: 'rare', statBonuses: { strength: 6 }, goldPrice: 200, gemPrice: 0 },
  { name: 'Flameforged Blade', type: 'weapon', rarity: 'epic', statBonuses: { strength: 10, intelligence: 2 }, goldPrice: 600, gemPrice: 10 },
  { name: 'Excalibur', type: 'weapon', rarity: 'legendary', statBonuses: { strength: 16, agility: 4 }, goldPrice: 0, gemPrice: 80 },

  { name: 'Apprentice Wand', type: 'weapon', rarity: 'common', statBonuses: { intelligence: 3 }, goldPrice: 50, gemPrice: 0 },
  { name: 'Runed Staff', type: 'weapon', rarity: 'rare', statBonuses: { intelligence: 6 }, goldPrice: 200, gemPrice: 0 },
  { name: 'Staff of the Archmage', type: 'weapon', rarity: 'epic', statBonuses: { intelligence: 10, agility: 2 }, goldPrice: 600, gemPrice: 10 },

  { name: 'Twin Daggers', type: 'weapon', rarity: 'rare', statBonuses: { agility: 6 }, goldPrice: 200, gemPrice: 0 },
  { name: 'Shadowfang Daggers', type: 'weapon', rarity: 'epic', statBonuses: { agility: 10, strength: 2 }, goldPrice: 600, gemPrice: 10 },

  // Armor
  { name: 'Leather Vest', type: 'armor', rarity: 'common', statBonuses: { defense: 3, hp: 10 }, goldPrice: 50, gemPrice: 0 },
  { name: 'Chainmail Armor', type: 'armor', rarity: 'rare', statBonuses: { defense: 6, hp: 20 }, goldPrice: 200, gemPrice: 0 },
  { name: 'Plate of the Sentinel', type: 'armor', rarity: 'epic', statBonuses: { defense: 10, hp: 40 }, goldPrice: 600, gemPrice: 10 },
  { name: 'Aegis of Eternity', type: 'armor', rarity: 'legendary', statBonuses: { defense: 16, hp: 70 }, goldPrice: 0, gemPrice: 80 },

  // Accessories
  { name: 'Copper Ring', type: 'accessory', rarity: 'common', statBonuses: { agility: 2 }, goldPrice: 40, gemPrice: 0 },
  { name: 'Ring of Vigor', type: 'accessory', rarity: 'rare', statBonuses: { hp: 15, mana: 10 }, goldPrice: 180, gemPrice: 0 },
  { name: 'Amulet of Focus', type: 'accessory', rarity: 'epic', statBonuses: { intelligence: 6, mana: 20 }, goldPrice: 550, gemPrice: 8 },
  { name: 'Crown of the Fallen King', type: 'accessory', rarity: 'legendary', statBonuses: { strength: 6, defense: 6, hp: 30 }, goldPrice: 0, gemPrice: 70 },

  // Consumables
  { name: 'Minor Health Potion', type: 'consumable', rarity: 'common', statBonuses: { healAmount: 40 }, goldPrice: 20, gemPrice: 0 },
  { name: 'Health Potion', type: 'consumable', rarity: 'rare', statBonuses: { healAmount: 90 }, goldPrice: 60, gemPrice: 0 },
  { name: 'Mana Potion', type: 'consumable', rarity: 'common', statBonuses: { manaAmount: 30 }, goldPrice: 20, gemPrice: 0 },
  { name: 'Elixir of Power', type: 'consumable', rarity: 'epic', statBonuses: { healAmount: 150, manaAmount: 60 }, goldPrice: 250, gemPrice: 5 },
];

module.exports = { BASE_ITEMS, RARITY_MULTIPLIER };
