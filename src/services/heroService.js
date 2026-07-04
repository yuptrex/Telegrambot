const Hero = require('../models/Hero');
const User = require('../models/User');
const Item = require('../models/Item');
const { createNewHero, expToNextLevel } = require('../game/classes/heroFactory');
const { getSkill } = require('../game/skills/skillCatalogue');

async function getActiveHero(userId) {
  const user = await User.findById(userId);
  if (!user || !user.activeHeroId) return null;
  return Hero.findById(user.activeHeroId);
}

async function createHeroForUser(userId, name, className) {
  const heroData = createNewHero({ userId, name, className });
  const hero = await Hero.create(heroData);
  await User.findByIdAndUpdate(userId, { activeHeroId: hero._id });
  return hero;
}

/** Compute equipment stat bonuses for a hero (weapon+armor+accessory), summed. */
async function getEquipmentBonuses(hero) {
  const ids = [hero.equipment?.weapon, hero.equipment?.armor, hero.equipment?.accessory].filter(Boolean);
  if (!ids.length) return {};

  const items = await Item.find({ _id: { $in: ids } });
  const bonuses = {};
  for (const item of items) {
    for (const [stat, value] of Object.entries(item.statBonuses || {})) {
      if (['strength', 'intelligence', 'agility', 'defense'].includes(stat)) {
        bonuses[stat] = (bonuses[stat] || 0) + value;
      }
    }
  }
  return bonuses;
}

async function equipItem(hero, item) {
  if (!['weapon', 'armor', 'accessory'].includes(item.type)) {
    throw new Error('Only weapon, armor, or accessory items can be equipped.');
  }
  hero.equipment[item.type] = item._id;
  await hero.save();
  return hero;
}

async function unequipSlot(hero, slot) {
  if (!['weapon', 'armor', 'accessory'].includes(slot)) throw new Error('Invalid equipment slot.');
  hero.equipment[slot] = null;
  await hero.save();
  return hero;
}

function formatStatCard(hero, ownerLabel = '') {
  const expNeeded = expToNextLevel(hero.level);
  const skillNames = hero.unlockedSkills.map((id) => getSkill(id)?.name || id).join(', ') || 'None yet';

  return (
    `🧙 *${hero.name}* ${ownerLabel}\n` +
    `Class: ${hero.class} | Level ${hero.level}\n` +
    `EXP: ${hero.exp}/${expNeeded}\n` +
    `HP: ${hero.hp}/${hero.maxHp}  MP: ${hero.mana}/${hero.maxMana}\n` +
    `STR: ${hero.stats.strength}  INT: ${hero.stats.intelligence}  AGI: ${hero.stats.agility}  DEF: ${hero.stats.defense}\n` +
    `Record: ${hero.wins}W / ${hero.losses}L | ELO: ${hero.eloRating}\n` +
    `Skills: ${skillNames}`
  );
}

module.exports = {
  getActiveHero,
  createHeroForUser,
  getEquipmentBonuses,
  equipItem,
  unequipSlot,
  formatStatCard,
};
