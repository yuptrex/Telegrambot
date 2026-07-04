const cron = require('node-cron');
const User = require('../models/User');
const { ensureTodayQuests, todayKey } = require('../services/questService');

/** Runs once at midnight UTC: refresh daily quests for all users, update login streaks. */
function scheduleDailyReset() {
  cron.schedule('0 0 * * *', async () => {
    console.log('[jobs] Running daily reset...');
    try {
      const users = await User.find();
      const today = todayKey();

      for (const user of users) {
        ensureTodayQuests(user); // regenerates quest progress for the new day

        if (user.lastLoginAt) {
          const lastLoginDay = new Date(user.lastLoginAt).toISOString().slice(0, 10);
          const yesterdayDate = new Date();
          yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
          const yesterday = yesterdayDate.toISOString().slice(0, 10);

          if (lastLoginDay !== today && lastLoginDay !== yesterday) {
            user.loginStreak = 0; // streak broken if they missed a day
          }
        }

        await user.save();
      }
      console.log(`[jobs] Daily reset complete for ${users.length} users.`);
    } catch (err) {
      console.error('[jobs] Daily reset failed:', err);
    }
  });
}

module.exports = { scheduleDailyReset };
