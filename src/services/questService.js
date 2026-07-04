const { DAILY_QUEST_COUNT } = require('../config/constants');

const QUEST_POOL = [
  { id: 'win_3_battles', label: 'Win 3 battles', target: 3, type: 'wins', rewardGold: 50, rewardExp: 40 },
  { id: 'deal_500_damage', label: 'Deal 500 damage', target: 500, type: 'damage', rewardGold: 40, rewardExp: 30 },
  { id: 'win_1_pve', label: 'Win 1 PvE battle', target: 1, type: 'pve_wins', rewardGold: 25, rewardExp: 20 },
  { id: 'play_5_battles', label: 'Play 5 battles (win or lose)', target: 5, type: 'battles_played', rewardGold: 35, rewardExp: 25 },
  { id: 'use_3_skills', label: 'Use 3 different skills', target: 3, type: 'skills_used', rewardGold: 30, rewardExp: 25 },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

/** Deterministic-ish daily pick per user so everyone doesn't get the exact same 3, but stable per day. */
function pickDailyQuests(seed) {
  const shuffled = [...QUEST_POOL];
  // simple seeded shuffle so the same user gets the same quests all day
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, DAILY_QUEST_COUNT);
}

function hashStringToInt(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}

/** Ensure the user has today's quests initialized; resets if the stored date != today. */
function ensureTodayQuests(user) {
  const today = todayKey();
  if (user.dailyQuestDate === today && user.dailyQuestProgress && Object.keys(user.dailyQuestProgress).length) {
    return user;
  }

  const seed = hashStringToInt(user.telegramId + today);
  const quests = pickDailyQuests(seed);

  const progress = {};
  for (const q of quests) {
    progress[q.id] = { current: 0, target: q.target, completed: false, claimed: false };
  }

  user.dailyQuestProgress = progress;
  user.dailyQuestDate = today;
  user.markModified('dailyQuestProgress');
  return user;
}

function getTodayQuestDefs(user) {
  ensureTodayQuests(user);
  const ids = Object.keys(user.dailyQuestProgress);
  return QUEST_POOL.filter((q) => ids.includes(q.id));
}

/** Record progress for a quest `type` event (e.g. 'wins', 'damage') by `amount`. Mutates user in place. */
function recordProgress(user, type, amount = 1) {
  ensureTodayQuests(user);
  const defs = QUEST_POOL.filter((q) => q.type === type);
  for (const def of defs) {
    const p = user.dailyQuestProgress[def.id];
    if (p && !p.completed) {
      p.current = Math.min(p.target, p.current + amount);
      if (p.current >= p.target) p.completed = true;
    }
  }
  user.markModified('dailyQuestProgress');
  return user;
}

function formatQuestList(user) {
  const defs = getTodayQuestDefs(user);
  const lines = defs.map((q) => {
    const p = user.dailyQuestProgress[q.id];
    const status = p.completed ? (p.claimed ? '✅ Claimed' : '🎁 Ready to claim!') : `${p.current}/${p.target}`;
    return `• ${q.label} — ${status} (${q.rewardGold}g, ${q.rewardExp}xp)`;
  });
  return `📜 *Today's Quests*\n\n${lines.join('\n')}`;
}

module.exports = {
  QUEST_POOL,
  todayKey,
  ensureTodayQuests,
  getTodayQuestDefs,
  recordProgress,
  formatQuestList,
};
