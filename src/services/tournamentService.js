const Tournament = require('../models/Tournament');
const Hero = require('../models/Hero');
const { generateBracket, generateNextRound, isTournamentComplete, findNextPendingMatch } = require('../game/tournaments');

async function createTournament(name, season, prizePool = {}) {
  return Tournament.create({ name, season, prizePool, status: 'registration' });
}

async function registerPlayer(tournament, heroId) {
  if (tournament.status !== 'registration') throw new Error('Registration is closed for this tournament.');
  if (tournament.registeredPlayers.some((id) => String(id) === String(heroId))) {
    throw new Error('You are already registered.');
  }
  tournament.registeredPlayers.push(heroId);
  await tournament.save();
  return tournament;
}

/** Lock registration and generate round 1. Call from an admin command or a scheduled job. */
async function startTournament(tournament) {
  if (tournament.registeredPlayers.length < 2) {
    throw new Error('Need at least 2 registered players to start.');
  }
  tournament.bracket = generateBracket(tournament.registeredPlayers);
  tournament.status = 'active';
  tournament.startDate = new Date();
  await tournament.save();
  return tournament;
}

/** Record the result of a match (called after battleService.finalizeBattle for a tournament battle). */
async function recordMatchResult(tournament, battleId, winnerHeroId) {
  for (const round of tournament.bracket) {
    for (const match of round.matches) {
      if (String(match.battleId) === String(battleId)) {
        match.winnerId = winnerHeroId;
      }
    }
  }

  const lastRound = tournament.bracket[tournament.bracket.length - 1];
  const roundComplete = lastRound.matches.every((m) => m.winnerId);

  if (roundComplete) {
    if (isTournamentComplete(tournament.bracket)) {
      tournament.status = 'completed';
      tournament.endDate = new Date();
    } else {
      const nextRound = generateNextRound(tournament.bracket);
      if (nextRound) tournament.bracket.push(nextRound);
    }
  }

  await tournament.save();
  return tournament;
}

function formatBracket(tournament) {
  const lines = [`🏆 *${tournament.name}* (Season ${tournament.season}) — ${tournament.status}`];
  for (const round of tournament.bracket) {
    lines.push(`\nRound ${round.round}:`);
    for (const m of round.matches) {
      const p1 = m.player1Id ? String(m.player1Id).slice(-4) : 'BYE';
      const p2 = m.player2Id ? String(m.player2Id).slice(-4) : 'BYE';
      const winner = m.winnerId ? ` → winner: ${String(m.winnerId).slice(-4)}` : '';
      lines.push(`  ${p1} vs ${p2}${winner}`);
    }
  }
  return lines.join('\n');
}

module.exports = {
  createTournament,
  registerPlayer,
  startTournament,
  recordMatchResult,
  findNextPendingMatch,
  formatBracket,
};
