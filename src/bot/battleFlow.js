/**
 * Handles the turn-by-turn messaging loop for battles: rendering the HP/MP bars,
 * editing the same message each turn, and dispatching player actions into battleService.
 *
 * PvE battles resolve the AI turn automatically. PvP battles wait for both players to
 * submit an action (or the 30s timer to elapse) before resolving the turn — see
 * pendingPvPActions below.
 */
const Hero = require('../models/Hero');
const Item = require('../models/Item');
const battleService = require('../services/battleService');
const { getHeroInventory } = require('../services/inventoryService');
const { checkAchievements } = require('../services/achievementService');
const { recordProgress } = require('../services/questService');
const { turnActionKeyboard, skillSelectKeyboard, itemSelectKeyboard } = require('./keyboards');
const { TURN_TIMEOUT_MS } = require('../config/constants');

// battleId -> { p1Action, p2Action, timer }
const pendingPvPActions = new Map();
// battleId -> { chatId1, messageId1, chatId2, messageId2 } for PvP (two separate DMs/chats)
const battleMessageRefs = new Map();

function barString(current, max, size = 10) {
  const ratio = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(ratio * size);
  return '█'.repeat(filled) + '░'.repeat(size - filled);
}

function renderBattleText(state, recentLogLines = 4) {
  const { p1, p2 } = state.sides;
  const recent = state.log.slice(-recentLogLines).map((e) => `• ${e.message}`).join('\n') || 'Battle begins!';

  return (
    `⚔️ *Turn ${state.turn}*\n\n` +
    `${p1.name}\n${barString(p1.hp, p1.maxHp)} HP ${p1.hp}/${p1.maxHp}\n${barString(p1.mana, p1.maxMana)} MP ${p1.mana}/${p1.maxMana}\n\n` +
    `${p2.name}\n${barString(p2.hp, p2.maxHp)} HP ${p2.hp}/${p2.maxHp}\n${barString(p2.mana, p2.maxMana)} MP ${p2.mana}/${p2.maxMana}\n\n` +
    `📜 *Recent:*\n${recent}`
  );
}

async function sendOrEditBattleMessage(ctx, battleId, text, keyboard) {
  const battle = await require('../models/Battle').findById(battleId);
  if (battle.messageId) {
    try {
      await ctx.telegram.editMessageText(battle.chatId, battle.messageId, undefined, text, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      return;
    } catch (err) {
      // message may be identical (Telegram throws) or unremovable — fall through to send new
      if (!String(err.message).includes('message is not modified')) {
        console.warn('[battleFlow] editMessageText failed, sending new message:', err.message);
      } else {
        return;
      }
    }
  }
  const sent = await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
  battle.chatId = String(ctx.chat.id);
  battle.messageId = sent.message_id;
  await battle.save();
}

/** Kick off a new PvE battle and render turn 1. */
async function startPvEFlow(ctx, hero, difficulty = 1) {
  const { battle, state } = await battleService.startPvEBattle(hero, difficulty);
  const text = renderBattleText(state);
  const keyboard = turnActionKeyboard(hero, battle._id);
  const sent = await ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });

  battle.chatId = String(ctx.chat.id);
  battle.messageId = sent.message_id;
  await battle.save();

  return battle;
}

/** Apply a player's chosen action for a PvE battle turn, resolve it (AI auto-acts), and render. */
async function submitPvEAction(ctx, battleId, action) {
  const state = battleService.processTurn(battleId, { p1Action: action, p2Action: null });
  const hero = await Hero.findById(state.sides.p1.heroId);

  // quest progress: damage dealt this turn by p1
  const p1DamageThisTurn = state.log
    .filter((e) => e.turn === state.turn && String(e.actorId || '') === String(hero._id))
    .reduce((sum, e) => sum + (e.damage || 0), 0);
  if (p1DamageThisTurn > 0) {
    recordProgress(ctx.state.user, 'damage', p1DamageThisTurn);
  }
  if (action.type === 'skill') recordProgress(ctx.state.user, 'skills_used', 1);

  if (state.finished) {
    const { summary } = await battleService.finalizeBattle(battleId);
    await renderBattleEnd(ctx, battleId, state, summary, hero);

    recordProgress(ctx.state.user, 'battles_played', 1);
    if (summary.winnerHeroId && String(summary.winnerHeroId) === String(hero._id)) {
      recordProgress(ctx.state.user, 'wins', 1);
      recordProgress(ctx.state.user, 'pve_wins', 1);
      const freshHero = await Hero.findById(hero._id);
      await checkAchievements(ctx.state.user, freshHero);
    }
    await ctx.state.user.save();
    return;
  }

  const text = renderBattleText(state);
  const keyboard = turnActionKeyboard(hero, battleId);
  await sendOrEditBattleMessage(ctx, battleId, text, keyboard);
}

async function renderBattleEnd(ctx, battleId, state, summary, hero) {
  let text = renderBattleText(state, 6) + '\n\n';

  if (summary.draw) {
    text += '🤝 The battle ends in a draw!';
  } else if (String(summary.winnerHeroId) === String(hero._id)) {
    text += `🎉 *Victory!* You earned ${summary.rewards.gold} gold and ${summary.rewards.exp} exp.`;
    if (summary.rewards.item) text += `\n🎁 Item drop: *${summary.rewards.item.name}* (${summary.rewards.item.rarity})!`;
    if (summary.winnerLevelUp) {
      text += `\n\n⬆️ *Level up!* You are now level ${summary.winnerLevelUp}.`;
      if (summary.winnerNewSkills?.length) text += `\n✨ New skill(s) unlocked!`;
    }
  } else {
    text += `💀 Defeat. You gained a small consolation exp reward.`;
  }

  await sendOrEditBattleMessage(ctx, battleId, text, { reply_markup: { inline_keyboard: [] } });
}

/** Show the skill submenu for the current battle turn. */
async function showSkillMenu(ctx, battleId, hero) {
  const state = battleService.getLiveState(battleId);
  const freshHero = await Hero.findById(hero._id); // mana may have changed
  const text = renderBattleText(state, 3) + '\n\nChoose a skill:';
  await sendOrEditBattleMessage(ctx, battleId, text, skillSelectKeyboard(freshHero, battleId));
}

/** Show the item submenu for the current battle turn. */
async function showItemMenu(ctx, battleId, hero) {
  const items = await getHeroInventory(hero);
  const state = battleService.getLiveState(battleId);
  const text = renderBattleText(state, 3) + '\n\nChoose an item:';
  const consumables = items.filter((i) => i.type === 'consumable');
  if (!consumables.length) {
    await ctx.answerCbQuery('You have no consumable items.', { show_alert: true });
    return showBackToActions(ctx, battleId, hero);
  }
  await sendOrEditBattleMessage(ctx, battleId, text, itemSelectKeyboard(items, battleId));
}

async function showBackToActions(ctx, battleId, hero) {
  const state = battleService.getLiveState(battleId);
  const text = renderBattleText(state);
  await sendOrEditBattleMessage(ctx, battleId, text, turnActionKeyboard(hero, battleId));
}

/** Apply an item-use action within a PvE battle turn (heal/mana potion), then resolve as a turn. */
async function submitItemAction(ctx, battleId, itemId, hero) {
  const item = await Item.findById(itemId);
  if (!item) throw new Error('Item not found.');

  const action = { type: 'item', itemId: item._id, effect: item.statBonuses };
  hero.inventory = hero.inventory.filter((id) => String(id) !== String(item._id));
  await hero.save();
  await Item.findByIdAndDelete(item._id);

  await submitPvEAction(ctx, battleId, action);
}

module.exports = {
  renderBattleText,
  sendOrEditBattleMessage,
  startPvEFlow,
  submitPvEAction,
  showSkillMenu,
  showItemMenu,
  showBackToActions,
  submitItemAction,
  pendingPvPActions,
  battleMessageRefs,
};
