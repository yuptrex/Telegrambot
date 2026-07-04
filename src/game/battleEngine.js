const { getSkill } = require('./skills/skillCatalogue');
const { getEffectiveStats } = require('./effectiveStats');
const {
  CRIT_BASE_CHANCE,
  CRIT_AGILITY_SCALING,
  CRIT_DAMAGE_MULTIPLIER,
  DAMAGE_VARIANCE,
  MAX_BATTLE_TURNS,
} = require('../config/constants');

/**
 * Battle engine operates on a plain-object "combat state", not directly on Mongoose docs.
 * Shape of combat state:
 * {
 *   turn: number,
 *   sides: {
 *     p1: { heroId, baseStats:{strength,intelligence,agility,defense}, hp, maxHp, mana, maxMana,
 *           equipmentBonuses, activeBuffs:[{effect,turnsRemaining}], dot:[{type,amount,turnsRemaining}],
 *           stunnedTurns, evadeChance, pendingAction },
 *     p2: { ...same shape, may be AI }
 *   },
 *   log: [ { turn, actorId, action, damage, message } ],
 *   finished: boolean,
 *   winnerSide: 'p1' | 'p2' | null
 * }
 */

function rollVariance(base) {
  const factor = 1 + (Math.random() * 2 - 1) * DAMAGE_VARIANCE;
  return Math.max(1, Math.round(base * factor));
}

function rollCrit(agility) {
  const chance = CRIT_BASE_CHANCE + agility * CRIT_AGILITY_SCALING;
  return Math.random() < chance;
}

/** Resolve a single action (attack/skill/item/defend) into a damage/effect result against a target. */
function resolveAction({ actorSide, actor, action, target }) {
  const actorStats = getEffectiveStats(actor);
  const targetStats = getEffectiveStats(target);

  const result = { damage: 0, heal: 0, message: '', tags: [] };

  if (action.type === 'defend') {
    actor.defending = true;
    result.message = `${actorSide} braces to defend.`;
    return result;
  }

  if (action.type === 'attack') {
    let dmg = actorStats.strength * 1.0 - targetStats.defense * 0.5;
    dmg = Math.max(2, dmg);
    dmg = rollVariance(dmg);
    if (rollCrit(actorStats.agility)) {
      dmg = Math.round(dmg * CRIT_DAMAGE_MULTIPLIER);
      result.tags.push('crit');
    }
    if (target.defending) dmg = Math.round(dmg * 0.5);
    result.damage = dmg;
    result.message = `basic attack`;
    return result;
  }

  if (action.type === 'item') {
    // items are resolved by the caller (services/inventoryService) before reaching here in
    // practice, but engine supports simple heal/mana potions directly for completeness.
    if (action.effect?.healAmount) result.heal = action.effect.healAmount;
    if (action.effect?.manaAmount) result.manaRestore = action.effect.manaAmount;
    result.message = `used an item`;
    return result;
  }

  if (action.type === 'skill') {
    const skill = getSkill(action.skillId);
    if (!skill) {
      result.message = 'attempted an unknown skill (fizzled)';
      return result;
    }

    if (skill.type === 'physical' || skill.type === 'magic') {
      const scalingStat = skill.type === 'physical' ? actorStats.strength : actorStats.intelligence;
      const defenseReduction = skill.type === 'physical' ? targetStats.defense * 0.5 : targetStats.defense * 0.3;
      let dmg = scalingStat * skill.multiplier - defenseReduction;
      dmg = Math.max(2, dmg);
      dmg = rollVariance(dmg);
      const critChance = CRIT_BASE_CHANCE + actorStats.agility * CRIT_AGILITY_SCALING + (skill.critBonus || 0);
      if (Math.random() < critChance) {
        dmg = Math.round(dmg * CRIT_DAMAGE_MULTIPLIER);
        result.tags.push('crit');
      }
      if (skill.hits && skill.hits > 1) dmg = Math.round(dmg / skill.hits) * skill.hits; // multi-hit flavor, same total
      if (target.defending) dmg = Math.round(dmg * 0.5);
      result.damage = dmg;

      if (skill.stun && Math.random() < 0.4) result.tags.push('stun');
      if (skill.burn) result.dot = { type: 'burn', amount: Math.round(dmg * 0.15), turnsRemaining: skill.burn };
      if (skill.poison) result.dot = { type: 'poison', amount: Math.round(dmg * 0.12), turnsRemaining: skill.poison };
      if (skill.slow) result.tags.push('slow');

      result.message = skill.name;
      return result;
    }

    if (skill.type === 'heal') {
      let heal = actorStats.intelligence * skill.multiplier;
      heal = rollVariance(heal);
      result.heal = heal;
      result.message = skill.name;
      return result;
    }

    if (skill.type === 'buff') {
      result.buff = { effect: skill.buff, turnsRemaining: skill.duration || 3 };
      result.message = skill.name;
      return result;
    }

    if (skill.type === 'shield') {
      result.shield = Math.round(actorStats.intelligence * skill.shieldAmount);
      result.message = skill.name;
      return result;
    }

    if (skill.type === 'evade') {
      result.evade = { chance: skill.evadeChance, turnsRemaining: skill.duration || 1 };
      result.message = skill.name;
      return result;
    }
  }

  result.message = 'did nothing';
  return result;
}

/** Apply damage-over-time and tick down buffs/status at the start of a combatant's turn. */
function tickStatusEffects(combatant) {
  const messages = [];

  if (combatant.dot && combatant.dot.length) {
    for (const effect of combatant.dot) {
      combatant.hp = Math.max(0, combatant.hp - effect.amount);
      messages.push(`${effect.type} deals ${effect.amount} damage`);
      effect.turnsRemaining -= 1;
    }
    combatant.dot = combatant.dot.filter((e) => e.turnsRemaining > 0);
  }

  if (combatant.activeBuffs && combatant.activeBuffs.length) {
    combatant.activeBuffs = combatant.activeBuffs.filter((b) => {
      b.turnsRemaining -= 1;
      return b.turnsRemaining > 0;
    });
  }

  if (combatant.stunnedTurns > 0) combatant.stunnedTurns -= 1;

  return messages;
}

/**
 * Resolve one full turn: both sides act based on agility priority.
 * `actions` = { p1: actionObject, p2: actionObject }
 * Mutates `state` in place and appends to state.log. Returns the updated state.
 */
function resolveTurn(state, actions) {
  const { p1, p2 } = state.sides;
  state.turn += 1;
  p1.defending = false;
  p2.defending = false;

  const p1Stats = getEffectiveStats(p1);
  const p2Stats = getEffectiveStats(p2);

  // Determine order by agility (ties: p1 first).
  const order = p1Stats.agility >= p2Stats.agility ? ['p1', 'p2'] : ['p2', 'p1'];

  for (const sideKey of order) {
    const actorSide = sideKey;
    const targetSide = sideKey === 'p1' ? 'p2' : 'p1';
    const actor = state.sides[actorSide];
    const target = state.sides[targetSide];

    if (actor.hp <= 0 || target.hp <= 0) continue; // battle already decided mid-turn

    if (actor.stunnedTurns > 0) {
      state.log.push({ turn: state.turn, actorId: actor.heroId, action: 'stunned', damage: 0, message: `${actor.name} is stunned and cannot act.` });
      continue;
    }

    const action = actions[actorSide] || { type: 'attack' };
    const result = resolveAction({ actorSide, actor, action, target });

    // Evasion check
    if (target.evade && target.evade.chance && Math.random() < target.evade.chance && result.damage > 0) {
      state.log.push({ turn: state.turn, actorId: actor.heroId, action: describeAction(action), damage: 0, message: `${target.name} evaded the attack!` });
      continue;
    }

    if (result.damage > 0) {
      target.hp = Math.max(0, target.hp - result.damage);
    }
    if (result.heal > 0) {
      actor.hp = Math.min(actor.maxHp, actor.hp + result.heal);
    }
    if (result.manaRestore) {
      actor.mana = Math.min(actor.maxMana, actor.mana + result.manaRestore);
    }
    if (result.dot) {
      target.dot = target.dot || [];
      target.dot.push(result.dot);
    }
    if (result.buff) {
      actor.activeBuffs = actor.activeBuffs || [];
      actor.activeBuffs.push(result.buff);
    }
    if (result.shield) {
      actor.hp = Math.min(actor.maxHp, actor.hp + 0); // shields modeled as temp HP buffer here
      actor.shield = (actor.shield || 0) + result.shield;
    }
    if (result.evade) {
      actor.evade = { chance: result.evade.chance };
      actor.evadeTurns = result.evade.turnsRemaining;
    }
    if (result.tags?.includes('stun')) {
      target.stunnedTurns = (target.stunnedTurns || 0) + 1;
    }

    // deduct mana cost for skills
    if (action.type === 'skill') {
      const skill = getSkill(action.skillId);
      if (skill) actor.mana = Math.max(0, actor.mana - skill.manaCost);
    }

    const critTag = result.tags?.includes('crit') ? ' 💥 Critical hit!' : '';
    const dmgText = result.damage > 0 ? ` dealing ${result.damage} damage.` : '';
    const healText = result.heal > 0 ? ` healing for ${result.heal}.` : '';
    state.log.push({
      turn: state.turn,
      actorId: actor.heroId,
      action: describeAction(action),
      damage: result.damage || 0,
      message: `${actor.name} used ${result.message}${dmgText}${healText}${critTag}`,
    });

    if (target.hp <= 0) break;
  }

  // End-of-turn DOT ticks for both sides (applies to whoever is still alive)
  for (const sideKey of ['p1', 'p2']) {
    const combatant = state.sides[sideKey];
    if (combatant.hp <= 0) continue;
    const dotMessages = tickStatusEffects(combatant);
    for (const msg of dotMessages) {
      state.log.push({ turn: state.turn, actorId: combatant.heroId, action: 'dot', damage: 0, message: `${combatant.name}: ${msg}` });
    }
  }

  // Check win conditions
  if (state.sides.p1.hp <= 0 && state.sides.p2.hp <= 0) {
    state.finished = true;
    state.winnerSide = null; // draw
  } else if (state.sides.p1.hp <= 0) {
    state.finished = true;
    state.winnerSide = 'p2';
  } else if (state.sides.p2.hp <= 0) {
    state.finished = true;
    state.winnerSide = 'p1';
  } else if (state.turn >= MAX_BATTLE_TURNS) {
    state.finished = true;
    // higher remaining HP% wins on timeout
    const p1Pct = state.sides.p1.hp / state.sides.p1.maxHp;
    const p2Pct = state.sides.p2.hp / state.sides.p2.maxHp;
    state.winnerSide = p1Pct === p2Pct ? null : p1Pct > p2Pct ? 'p1' : 'p2';
  }

  return state;
}

function describeAction(action) {
  if (action.type === 'skill') return `skill:${action.skillId}`;
  if (action.type === 'item') return `item:${action.itemId || 'unknown'}`;
  return action.type;
}

/** Build a fresh combat-state "side" object from a hero document + resolved equipment bonuses. */
function buildCombatantFromHero(hero, equipmentBonuses = {}) {
  return {
    heroId: hero._id,
    name: hero.name,
    baseStats: { ...hero.stats },
    hp: hero.hp,
    maxHp: hero.maxHp,
    mana: hero.mana,
    maxMana: hero.maxMana,
    equipmentBonuses,
    activeBuffs: [],
    dot: [],
    stunnedTurns: 0,
    defending: false,
    shield: 0,
  };
}

/** Simple scaling AI opponent for PvE, built directly as a combat-state side (no Hero doc). */
function buildAICombatant({ name = 'Training Dummy', level = 1, difficulty = 1 }) {
  const scale = 1 + (level - 1) * 0.12 * difficulty;
  return {
    heroId: null,
    name,
    baseStats: {
      strength: Math.round(8 * scale),
      intelligence: Math.round(6 * scale),
      agility: Math.round(6 * scale),
      defense: Math.round(6 * scale),
    },
    hp: Math.round(90 * scale),
    maxHp: Math.round(90 * scale),
    mana: Math.round(30 * scale),
    maxMana: Math.round(30 * scale),
    equipmentBonuses: {},
    activeBuffs: [],
    dot: [],
    stunnedTurns: 0,
    defending: false,
    shield: 0,
    isAI: true,
  };
}

/** Very simple AI decision: attack, or use a random unlocked skill if enough mana. */
function decideAIAction() {
  // Kept intentionally simple; can be swapped for smarter logic (e.g. skill priority) later.
  return { type: 'attack' };
}

function createInitialState({ p1Combatant, p2Combatant }) {
  return {
    turn: 0,
    sides: { p1: p1Combatant, p2: p2Combatant },
    log: [],
    finished: false,
    winnerSide: null,
  };
}

module.exports = {
  resolveTurn,
  buildCombatantFromHero,
  buildAICombatant,
  decideAIAction,
  createInitialState,
  getEffectiveStats,
};
