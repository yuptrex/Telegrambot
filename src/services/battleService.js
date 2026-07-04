const Battle = require('../models/Battle');
const Hero = require('../models/Hero');
const Item = require('../models/Item');
const {
  createInitialState,
  buildCombatantFromHero,
  buildAICombatant,
  resolveTurn,
  decideAIAction,
} = require('../game/battleEngine');
const { getEquipmentBonuses } = require('./heroService');
const { applyExp } = require('../game/classes/heroFactory');
const { computeBattleRewards } = require('../game/economy');
const { computeEloUpdate } = require('../game/matchmaking');
const { BASE_ITEMS, RARITY_MULTIPLIER } = require('../config/items');
const { TURN_TIMEOUT_MS } = require('../config/constants');

/**
 * In-memory registry of live battle combat states, keyed by battleId string.
 * This is the "in-memory or Redis-cached battle state" the spec calls for; swapping in
 * Redis later just means replacing this Map with get/set calls against a Redis client,
 * since all reads/writes go through the functions below.
 */
const liveStates = new Map();

function getLiveState(battleId) {
  return liveStates.get(String(battleId));
}

function setLiveState(battleId, state) {
  liveStates.set(String(battleId), state);
}

function clearLiveState(battleId) {
  liveStates.delete(String(battleId));
}

/** Start a PvE battle: creates the Battle doc + initial combat state. */
async function startPvEBattle(hero, difficulty = 1) {
  const equipmentBonuses = await getEquipmentBonuses(hero);
  const p1Combatant = buildCombatantFromHero(hero, equipmentBonuses);
  const p2Combatant = buildAICombatant({ name: `Level ${hero.level} Bandit`, level: hero.level, difficulty });

  const battle = await Battle.create({
    type: 'pve',
    player1: { userId: hero.userId, heroId: hero._id },
    player2: { isAI: true, aiDifficulty: difficulty },
    status: 'active',
  });

  const state = createInitialState({ p1Combatant, p2Combatant });
  setLiveState(battle._id, state);
  return { battle, state };
}

/** Start a PvP battle (challenge or ranked) between two heroes. */
async function startPvPBattle(hero1, hero2, type = 'pvp') {
  const [bonus1, bonus2] = await Promise.all([getEquipmentBonuses(hero1), getEquipmentBonuses(hero2)]);
  const p1Combatant = buildCombatantFromHero(hero1, bonus1);
  const p2Combatant = buildCombatantFromHero(hero2, bonus2);

  const battle = await Battle.create({
    type,
    player1: { userId: hero1.userId, heroId: hero1._id },
    player2: { userId: hero2.userId, heroId: hero2._id },
    status: 'active',
  });

  const state = createInitialState({ p1Combatant, p2Combatant });
  setLiveState(battle._id, state);
  return { battle, state };
}

/**
 * Process one turn given a player's chosen action. For PvE, the AI action is auto-decided.
 * For PvP, both `p1Action` and `p2Action` should be supplied (pass null to default to attack/timeout).
 */
function processTurn(battleId, { p1Action, p2Action }) {
  const state = getLiveState(battleId);
  if (!state) throw new Error('No live battle state found for this battle.');
  if (state.finished) return state;

  const actions = {
    p1: p1Action || { type: 'attack' },
    p2: p2Action || (state.sides.p2.isAI ? decideAIAction(state.sides.p2, state.sides.p1) : { type: 'attack' }),
  };

  resolveTurn(state, actions);
  setLiveState(battleId, state);
  return state;
}

/** Pick a random item template scaled to a rarity tier, clone it as an owned instance. */
async function grantRandomItemDrop(rarity, ownerId) {
  const candidates = BASE_ITEMS.filter((i) => i.rarity === rarity && i.type !== 'consumable');
  if (!candidates.length) return null;
  const template = candidates[Math.floor(Math.random() * candidates.length)];

  const item = await Item.create({
    name: template.name,
    type: template.type,
    rarity: template.rarity,
    statBonuses: template.statBonuses,
    goldPrice: template.goldPrice,
    gemPrice: template.gemPrice,
    isTemplate: false,
    ownerId,
  });

  return item;
}

/**
 * Finalize a completed battle: persist log, grant rewards, update exp/level/ELO/win-loss,
 * and clear the in-memory state. Returns a summary for messaging the player(s).
 */
async function finalizeBattle(battleId) {
  const state = getLiveState(battleId);
  const battle = await Battle.findById(battleId);
  if (!state || !battle) throw new Error('Battle or state not found.');

  battle.battleLog = state.log.map((entry) => ({
    turn: entry.turn,
    actorId: entry.actorId,
    action: entry.action,
    damage: entry.damage,
    message: entry.message,
  }));
  battle.status = state.winnerSide ? 'completed' : 'completed';
  battle.completedAt = new Date();

  const summary = { draw: false, winnerHeroId: null, p1: {}, p2: {} };

  const hero1 = await Hero.findById(battle.player1.heroId);
  const hero2 = battle.player2.heroId ? await Hero.findById(battle.player2.heroId) : null;

  if (!state.winnerSide) {
    summary.draw = true;
    // sync current HP back for reference, no rewards on draw/timeout tie
    if (hero1) {
      hero1.hp = Math.max(1, state.sides.p1.hp);
      await hero1.save();
    }
    if (hero2) {
      hero2.hp = Math.max(1, state.sides.p2.hp);
      await hero2.save();
    }
  } else {
    const winnerIsP1 = state.winnerSide === 'p1';
    const winnerHero = winnerIsP1 ? hero1 : hero2;
    const loserHero = winnerIsP1 ? hero2 : hero1;
    const rewards = computeBattleRewards(battle.type);

    if (winnerHero) {
      winnerHero.wins += 1;
      winnerHero.hp = Math.max(1, winnerIsP1 ? state.sides.p1.hp : state.sides.p2.hp);
      const expResult = applyExp(winnerHero, rewards.winner.exp);
      summary.p1.leveledUp = winnerIsP1 ? expResult.leveledUp : summary.p1.leveledUp;

      let droppedItem = null;
      if (rewards.winner.dropRarity) {
        droppedItem = await grantRandomItemDrop(rewards.winner.dropRarity, winnerHero.userId);
        if (droppedItem) winnerHero.inventory.push(droppedItem._id);
      }

      await winnerHero.save();

      const winnerUser = await require('../models/User').findById(winnerHero.userId);
      if (winnerUser) {
        winnerUser.gold += rewards.winner.gold;
        await winnerUser.save();
      }

      battle.rewards = { gold: rewards.winner.gold, exp: rewards.winner.exp, itemDropId: droppedItem?._id || null };
      battle.winnerId = winnerHero._id;

      summary.winnerHeroId = winnerHero._id;
      summary.rewards = { gold: rewards.winner.gold, exp: rewards.winner.exp, item: droppedItem };
      summary.winnerLevelUp = expResult.leveledUp ? expResult.newLevel : null;
      summary.winnerNewSkills = expResult.newSkills;
    }

    if (loserHero) {
      loserHero.losses += 1;
      loserHero.hp = Math.max(1, winnerIsP1 ? state.sides.p2.hp : state.sides.p1.hp);
      applyExp(loserHero, rewards.loser.exp);
      await loserHero.save();
    }

    // ELO update only for ranked/tournament matches, and only PvP-vs-real-hero
    if ((battle.type === 'ranked' || battle.type === 'tournament') && winnerHero && loserHero) {
      const { newRatingA, newRatingB } = computeEloUpdate(
        winnerIsP1 ? hero1.eloRating : hero2.eloRating,
        winnerIsP1 ? hero2.eloRating : hero1.eloRating,
        1
      );
      if (winnerIsP1) {
        hero1.eloRating = newRatingA;
        hero2.eloRating = newRatingB;
      } else {
        hero2.eloRating = newRatingA;
        hero1.eloRating = newRatingB;
      }
      await hero1.save();
      await hero2.save();
    }
  }

  await battle.save();
  clearLiveState(battleId);

  return { battle, summary, finalState: state };
}

module.exports = {
  getLiveState,
  setLiveState,
  clearLiveState,
  startPvEBattle,
  startPvPBattle,
  processTurn,
  finalizeBattle,
};
