const CLASSES = require('../../config/classes');
const { EXP_PER_LEVEL_BASE, EXP_CURVE_EXPONENT } = require('../../config/constants');
const SKILLS = require('../skills/skillCatalogue');

/** Exp required to go from `level` to `level + 1`. */
function expToNextLevel(level) {
  return Math.round(EXP_PER_LEVEL_BASE * Math.pow(level, EXP_CURVE_EXPONENT));
}

/** Compute full stat block for a class at a given level. */
function computeStatsAtLevel(className, level) {
  const cfg = CLASSES[className];
  if (!cfg) throw new Error(`Unknown class: ${className}`);

  const stats = {};
  for (const key of Object.keys(cfg.base)) {
    stats[key] = Math.round(cfg.base[key] + cfg.growthPerLevel[key] * (level - 1));
  }
  return stats;
}

/** List of skill ids unlocked for a class at a given level. */
function unlockedSkillsAtLevel(className, level) {
  return SKILLS[className].filter((s) => s.unlockLevel <= level).map((s) => s.id);
}

/** Build a brand-new hero document (plain object, not yet saved) for hero creation. */
function createNewHero({ userId, name, className }) {
  const stats = computeStatsAtLevel(className, 1);
  return {
    userId,
    name,
    class: className,
    level: 1,
    exp: 0,
    hp: stats.hp,
    maxHp: stats.hp,
    mana: stats.mana,
    maxMana: stats.mana,
    stats: {
      strength: stats.strength,
      intelligence: stats.intelligence,
      agility: stats.agility,
      defense: stats.defense,
    },
    unlockedSkills: unlockedSkillsAtLevel(className, 1),
    equipment: { weapon: null, armor: null, accessory: null },
    inventory: [],
  };
}

/**
 * Apply exp gain to a hero, handling multi-level-ups.
 * Mutates and returns { hero, leveledUp, newLevel, newSkills }.
 */
function applyExp(hero, expGained) {
  hero.exp += expGained;
  let leveledUp = false;
  const newlyUnlocked = [];

  let needed = expToNextLevel(hero.level);
  while (hero.exp >= needed) {
    hero.exp -= needed;
    hero.level += 1;
    leveledUp = true;

    const stats = computeStatsAtLevel(hero.class, hero.level);
    hero.maxHp = stats.hp;
    hero.maxMana = stats.mana;
    hero.hp = hero.maxHp; // full heal on level up
    hero.mana = hero.maxMana;
    hero.stats = {
      strength: stats.strength,
      intelligence: stats.intelligence,
      agility: stats.agility,
      defense: stats.defense,
    };

    const unlocked = unlockedSkillsAtLevel(hero.class, hero.level);
    for (const id of unlocked) {
      if (!hero.unlockedSkills.includes(id)) {
        hero.unlockedSkills.push(id);
        newlyUnlocked.push(id);
      }
    }

    needed = expToNextLevel(hero.level);
  }

  return { hero, leveledUp, newLevel: hero.level, newSkills: newlyUnlocked };
}

module.exports = {
  expToNextLevel,
  computeStatsAtLevel,
  unlockedSkillsAtLevel,
  createNewHero,
  applyExp,
};
