/**
 * Computes a combatant's *effective* stats for the current turn, layering:
 *   base hero stats -> equipment bonuses -> active buff multipliers
 *
 * `combatant` is the in-memory battle state object for one side (see battleEngine.js),
 * which holds a snapshot of base stats plus `equipmentBonuses` and `activeBuffs`.
 */
function getEffectiveStats(combatant) {
  const stats = { ...combatant.baseStats };

  // Flat equipment bonuses (strength/intelligence/agility/defense/hp/mana already folded
  // into maxHp/maxMana at snapshot time; this only covers the four combat stats here).
  for (const key of ['strength', 'intelligence', 'agility', 'defense']) {
    stats[key] += combatant.equipmentBonuses?.[key] || 0;
  }

  // Multiplicative buffs (e.g. { strength: 1.2 } from Rally Cry), each with remaining duration.
  for (const buff of combatant.activeBuffs || []) {
    if (buff.turnsRemaining > 0) {
      for (const [stat, mult] of Object.entries(buff.effect)) {
        if (stats[stat] !== undefined) stats[stat] = Math.round(stats[stat] * mult);
      }
    }
  }

  return stats;
}

module.exports = { getEffectiveStats };
