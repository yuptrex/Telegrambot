const ACHIEVEMENTS = [
  { id: 'first_blood', label: 'First Blood', description: 'Win your first battle.', check: (h) => h.wins >= 1 },
  { id: 'ten_wins', label: 'Battle-Hardened', description: 'Win 10 battles.', check: (h) => h.wins >= 10 },
  { id: 'hundred_wins', label: '100 Wins', description: 'Win 100 battles.', check: (h) => h.wins >= 100 },
  { id: 'max_level', label: 'Max Level', description: 'Reach level 20.', check: (h) => h.level >= 20 },
  { id: 'elo_1200', label: 'Rising Star', description: 'Reach 1200 ELO.', check: (h) => h.eloRating >= 1200 },
  { id: 'elo_1500', label: 'Elite Contender', description: 'Reach 1500 ELO.', check: (h) => h.eloRating >= 1500 },
];

/** Check a hero against all achievement definitions; returns newly-unlocked achievement ids. */
async function checkAchievements(user, hero) {
  const newlyUnlocked = [];
  for (const ach of ACHIEVEMENTS) {
    if (!user.achievements.includes(ach.id) && ach.check(hero)) {
      user.achievements.push(ach.id);
      newlyUnlocked.push(ach);
    }
  }
  if (newlyUnlocked.length) await user.save();
  return newlyUnlocked;
}

function formatAchievements(user) {
  if (!user.achievements.length) return '🏅 No achievements unlocked yet. Get battling!';
  const lines = ACHIEVEMENTS.filter((a) => user.achievements.includes(a.id)).map((a) => `🏅 *${a.label}* — ${a.description}`);
  return lines.join('\n');
}

module.exports = { ACHIEVEMENTS, checkAchievements, formatAchievements };
