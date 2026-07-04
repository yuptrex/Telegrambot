require('dotenv').config();

const express = require('express');
const { connectDB } = require('./services/db');
const { createBot } = require('./bot');
const { scheduleDailyReset } = require('./jobs/dailyReset');
const { scheduleMatchmakingTick } = require('./jobs/matchmakingTick');
const { scheduleSeasonReset } = require('./jobs/seasonReset');

async function main() {
  await connectDB();

  const bot = createBot();
  const app = express();
  app.use(express.json());

  // Health check endpoint required by Render.
  app.get('/health', (req, res) => res.status(200).send('OK'));
  app.get('/', (req, res) => res.status(200).send('Battle Arena Bot is running.'));

  const webhookPath = `/webhook/${bot.secretPathComponent()}`;
  app.use(bot.webhookCallback(webhookPath));

  const port = process.env.PORT || 3000;
  const webhookUrl = process.env.WEBHOOK_URL; // e.g. https://your-app.onrender.com

  app.listen(port, async () => {
    console.log(`[server] Listening on port ${port}`);

    if (webhookUrl) {
      const fullWebhookUrl = `${webhookUrl.replace(/\/$/, '')}${webhookPath}`;
      await bot.telegram.setWebhook(fullWebhookUrl);
      console.log(`[server] Webhook set to ${fullWebhookUrl}`);
    } else {
      console.warn('[server] WEBHOOK_URL not set — bot will not receive updates until it is configured.');
    }
  });

  scheduleDailyReset();
  scheduleMatchmakingTick(bot);
  scheduleSeasonReset();

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
