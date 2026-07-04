/**
 * Single-elimination bracket generation. Designed so double-elimination can be added later
 * by extending Tournament.bracket with a second "losers" bracket array without touching
 * the core match-resolution flow in services/tournamentService.js.
 */

/** Pads the player list to the next power of two with `null` (bye) entries. */
function padToPowerOfTwo(players) {
  let size = 1;
  while (size < players.length) size *= 2;
  const padded = [...players];
  while (padded.length < size) padded.push(null);
  return padded;
}

/** Shuffle (Fisher-Yates) for random seeding. */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Generate round 1 of a single-elimination bracket from a list of heroIds. Byes auto-advance. */
function generateBracket(heroIds) {
  if (heroIds.length < 2) throw new Error('Need at least 2 players for a tournament.');

  const shuffled = shuffle(heroIds);
  const padded = padToPowerOfTwo(shuffled);

  const matches = [];
  for (let i = 0; i < padded.length; i += 2) {
    const player1Id = padded[i];
    const player2Id = padded[i + 1];
    // if one side is a bye (null), the other auto-wins
    const winnerId = player2Id === null ? player1Id : player1Id === null ? player2Id : null;
    matches.push({ player1Id, player2Id, winnerId, battleId: null });
  }

  return [{ round: 1, matches }];
}

/** Given a completed round's matches, build the next round's matchups from the winners. */
function generateNextRound(bracket) {
  const lastRound = bracket[bracket.length - 1];
  const winners = lastRound.matches.map((m) => m.winnerId).filter(Boolean);

  if (winners.length <= 1) return null; // tournament is over

  const matches = [];
  for (let i = 0; i < winners.length; i += 2) {
    const player1Id = winners[i];
    const player2Id = winners[i + 1] || null;
    const winnerId = player2Id === null ? player1Id : null;
    matches.push({ player1Id, player2Id, winnerId, battleId: null });
  }

  return { round: lastRound.round + 1, matches };
}

/** Is the entire tournament finished (last round has exactly one match with a winner)? */
function isTournamentComplete(bracket) {
  const lastRound = bracket[bracket.length - 1];
  return lastRound.matches.length === 1 && !!lastRound.matches[0].winnerId;
}

function getChampion(bracket) {
  if (!isTournamentComplete(bracket)) return null;
  return bracket[bracket.length - 1].matches[0].winnerId;
}

/** Find the next unplayed match (both players set, no battleId yet) across the whole bracket. */
function findNextPendingMatch(bracket) {
  for (const round of bracket) {
    for (const match of round.matches) {
      if (match.player1Id && match.player2Id && !match.winnerId && !match.battleId) {
        return { round: round.round, match };
      }
    }
  }
  return null;
}

module.exports = {
  generateBracket,
  generateNextRound,
  isTournamentComplete,
  getChampion,
  findNextPendingMatch,
  padToPowerOfTwo,
};
