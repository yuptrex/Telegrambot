const cron = require('node-cron');
const Hero = require('../models/Hero');
const { SEASON_LENGTH_DAYS, STARTING_ELO } = require('../config/constants');

/**
 * Runs daily at 00:05 UTC but only acts every SEASON_LENGTH_DAYS, tracked via an env-configured
 * anchor date. Soft-resets ELO toward the starting value rather than a hard wipe, and grants
 * simple rank-based gold rewards for top finishers.
 */
function scheduleSeasonReset() {
  cron.schedule('5 0 * * *', async () => {
    try {
      const anchor = process.env.SEASON_ANCHOR_DATE ? new Date(process.env.SEASON_ANCHOR_DATE) : new Date('2026-01-01');
      const daysSinceAnchor = Math.floor((Date.now() - anchor.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceAnchor < 0 || daysSinceAnchor % SEASON_LENGTH_DAYS !== 0) return;

      console.log('[jobs] Running season reset...');
      const topHeroes = await Hero.find().sort({ eloRating: -1 }).limit(10);

      const User = require('../models/User');
      for (let i = 0; i < topHeroes.length; i++) {
        const reward = Math.max(50, 500 - i * 40);
        const user = await User.findById(topHeroes[i].userId);
        if (user) {
          user.gold += reward;
          await user.save();
        }
      }

      // soft reset: move everyone halfway back toward the starting ELO
      const allHeroes = await Hero.find();
      for (const hero of allHeroes) {
        hero.eloRating = Math.round(STARTING_ELO + (hero.eloRating - STARTING_ELO) * 0.5);
        await hero.save();
      }

      console.log(`[jobs] Season reset complete. Rewarded top ${topHeroes.length} players.`);
    } catch (err) {
      console.error('[jobs] Season reset failed:', err);
    }
  });
}

module.exports = { scheduleSeasonReset };
