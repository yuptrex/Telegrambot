const Hero = require('../models/Hero');
const Guild = require('../models/Guild');

async function getTopHeroes(limit = 10) {
  return Hero.find().sort({ eloRating: -1 }).limit(limit);
}

async function getGuildLeaderboard(guildId, limit = 10) {
  const guild = await Guild.findById(guildId);
  if (!guild) return [];
  const memberUserIds = guild.members.map((m) => m.userId);
  return Hero.find({ userId: { $in: memberUserIds } })
    .sort({ eloRating: -1 })
    .limit(limit);
}

function formatLeaderboard(heroes, title = '🏆 Global Leaderboard') {
  if (!heroes.length) return `${title}\n\nNo ranked players yet.`;
  const lines = heroes.map((h, i) => `${i + 1}. ${h.name} (Lv.${h.level} ${h.class}) — ${h.eloRating} ELO`);
  return `${title}\n\n${lines.join('\n')}`;
}

module.exports = { getTopHeroes, getGuildLeaderboard, formatLeaderboard };
