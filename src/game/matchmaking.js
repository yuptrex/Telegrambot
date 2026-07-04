const { ELO_K_FACTOR } = require('../config/constants');

/**
 * In-memory ranked queue. Not persisted — if the process restarts, the queue empties
 * and queued players simply re-queue. Fine for a single Render instance; if you scale
 * to multiple instances, move this to Redis/Mongo (a `MatchmakingTicket` collection).
 */
const queue = []; // { heroId, userId, eloRating, queuedAt }

function enqueue(entry) {
  // avoid duplicate entries for the same hero
  removeFromQueue(entry.heroId);
  queue.push({ ...entry, queuedAt: Date.now() });
}

function removeFromQueue(heroId) {
  const idx = queue.findIndex((q) => String(q.heroId) === String(heroId));
  if (idx !== -1) queue.splice(idx, 1);
}

function isQueued(heroId) {
  return queue.some((q) => String(q.heroId) === String(heroId));
}

function queueSize() {
  return queue.length;
}

/**
 * Try to find the closest ELO match for everyone currently queued.
 * Returns an array of matched pairs [{ a, b }], removing them from the queue.
 * Widens the acceptable ELO gap the longer someone has waited.
 */
function findMatches() {
  const matches = [];
  const sorted = [...queue].sort((a, b) => a.eloRating - b.eloRating);
  const matched = new Set();

  for (let i = 0; i < sorted.length; i++) {
    if (matched.has(sorted[i].heroId)) continue;
    const a = sorted[i];
    const waitMs = Date.now() - a.queuedAt;
    const tolerance = 50 + Math.floor(waitMs / 5000) * 25; // widen by 25 every 5s waited

    let bestMatch = null;
    let bestDiff = Infinity;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (matched.has(b.heroId)) continue;
      const diff = Math.abs(a.eloRating - b.eloRating);
      if (diff <= tolerance && diff < bestDiff) {
        bestDiff = diff;
        bestMatch = b;
      }
    }

    if (bestMatch) {
      matched.add(a.heroId);
      matched.add(bestMatch.heroId);
      matches.push({ a, b: bestMatch });
    }
  }

  for (const m of matches) {
    removeFromQueue(m.a.heroId);
    removeFromQueue(m.b.heroId);
  }

  return matches;
}

/** Standard ELO update. Returns { newRatingA, newRatingB }. `scoreA` is 1 (win), 0.5 (draw), or 0 (loss). */
function computeEloUpdate(ratingA, ratingB, scoreA) {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;
  const scoreB = 1 - scoreA;

  const newRatingA = Math.round(ratingA + ELO_K_FACTOR * (scoreA - expectedA));
  const newRatingB = Math.round(ratingB + ELO_K_FACTOR * (scoreB - expectedB));

  return { newRatingA, newRatingB };
}

module.exports = {
  enqueue,
  removeFromQueue,
  isQueued,
  queueSize,
  findMatches,
  computeEloUpdate,
};
