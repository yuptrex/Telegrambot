# ⚔️ Battle Arena Bot

A production-grade Telegram bot that turns Telegram into a persistent, competitive RPG battle
platform: hero creation, turn-based PvE/PvP combat, ranked ELO matchmaking, guilds, an economy,
daily quests, and single-elimination tournaments — all driven by inline keyboards.

All game state lives in MongoDB. Telegram is purely the presentation layer.

---

## 🧱 Tech Stack

- Node.js + [Telegraf.js](https://telegraf.js.org/) (bot framework)
- Express.js (webhook receiver + health check)
- MongoDB Atlas via Mongoose
- node-cron (daily quest reset, ranked matchmaking tick, season reset)
- Deployed as a Render Web Service using **webhooks** (not polling)

---

## 🗂️ Project Structure

```
src/
├── bot/            # Telegraf setup, commands, scenes, keyboards, middleware, battle flow
├── game/           # Battle engine, matchmaking/ELO, economy, tournaments, class/skill logic
├── models/         # Mongoose schemas: User, Hero, Battle, Item, Guild, Tournament
├── services/       # DB access + business logic layer used by bot commands
├── jobs/           # Cron jobs: daily reset, matchmaking tick, season reset
├── config/         # Tunable data: class stats, skills, items, constants
└── server.js       # Express entrypoint (webhook + health check)
scripts/seed.js      # Seeds the shop with base item templates
```

---

## 🚀 Setup Instructions

### 1. Create your Telegram bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts (choose a name and a unique username ending in `bot`).
3. BotFather will give you a **bot token** — copy it, you'll need it as `BOT_TOKEN`.
4. Optional: send `/setcommands` to BotFather and paste in a command list (see `/help` output in
   `src/bot/commands/misc.js` for the full list) so commands autocomplete in the Telegram UI.

### 2. Set up MongoDB Atlas

1. Create a free account at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a new Cluster (the free M0 tier is enough to start).
3. Under **Database Access**, create a database user with a username/password.
4. Under **Network Access**, add `0.0.0.0/0` (allow access from anywhere) so Render can connect —
   or restrict to Render's outbound IPs if you want tighter security.
5. Click **Connect → Drivers**, copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Add a database name into the path (e.g. `.../battle-arena?retryWrites=...`) — this becomes your
   `MONGODB_URI`.

### 3. Push this project to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Battle Arena Bot"
git branch -M main
git remote add origin https://github.com/<your-username>/battle-arena-bot.git
git push -u origin main
```

### 4. Deploy to Render

**Option A — Blueprint (one-click):**
1. Push to GitHub (above).
2. In Render, click **New → Blueprint**, connect your repo. Render will read `render.yaml`
   automatically and create the web service.
3. You'll be prompted to fill in the environment variables marked `sync: false`
   (`BOT_TOKEN`, `MONGODB_URI`, `WEBHOOK_URL`, `ADMIN_TELEGRAM_IDS`).

**Option B — Manual:**
1. In Render, click **New → Web Service**, connect your repo.
2. Environment: Node. Build command: `npm install`. Start command: `npm start`.
3. Add the environment variables listed in `.env.example` under **Environment**.
4. For `WEBHOOK_URL`, use the `.onrender.com` URL Render assigns your service (you can update this
   env var after the first deploy once you know the URL, then redeploy).

### 5. Set the Telegram webhook

You don't need to call Telegram's API manually — `src/server.js` calls
`bot.telegram.setWebhook(...)` automatically on startup using `WEBHOOK_URL`. Just make sure
`WEBHOOK_URL` is set to your Render service's public URL **before** the app starts (or redeploy
after setting it).

To verify it worked, visit:
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```
You should see your Render URL under `"url"` with no recent errors.

### 6. Seed the shop

Item templates need to exist before `/shop` shows anything. Run once, locally or via Render's
shell:
```bash
npm run seed
```
This is safe to run multiple times — it skips seeding if item templates already exist.

### 7. Talk to your bot

Open Telegram, find your bot by its username, and send `/start`.

---

## 🎮 Commands

| Command | Purpose |
|---|---|
| `/start` | Create your hero (name + class) |
| `/hero` | View hero stats, inventory, equipment |
| `/battle` | PvE / Challenge Friend / Ranked Queue |
| `/challenge @username` | Challenge a specific player |
| `/shop` | Browse and buy items |
| `/inventory` | Equip or use owned items |
| `/guild` | Guild menu |
| `/createguild Name \| Description` | Create a guild |
| `/contribute <amount>` | Donate gold to your guild's treasury |
| `/leaderboard` | Global and guild rankings |
| `/tournament` | View or register for the active tournament |
| `/newtournament <name>` | (admin) Create a tournament |
| `/starttournament` | (admin) Lock registration and generate the bracket |
| `/profile` | Full stat card + achievements |
| `/quests` | Daily quests and claimable rewards |
| `/friends`, `/addfriend @username` | Manage friends list |
| `/help` | Command reference |

Admin commands require your numeric Telegram user ID to be listed in `ADMIN_TELEGRAM_IDS`. You can
get your ID by messaging [@userinfobot](https://t.me/userinfobot).

---

## ⚔️ How Battles Work

Each turn, you pick **Attack**, **Skill**, **Item**, or **Defend** via inline buttons. Turn order
between the two combatants is determined by Agility. Damage uses:

```
physicalDamage = attacker.strength * skillMultiplier - defender.defense * 0.5
magicDamage    = attacker.intelligence * skillMultiplier - defender.defense * 0.3
```

with ±10% random variance and an agility-scaled crit chance. Battles end when a hero's HP hits 0,
a player forfeits, or the turn limit is reached (highest remaining HP% wins on timeout).

PvE battles resolve instantly (AI acts automatically each turn). PvP and ranked battles send both
players their own message in their own chat, each with their own action buttons; the same message
is edited in place turn-by-turn rather than sending new messages.

---

## 🌱 Extending the Game

All balance data lives in `src/config/` — edit `classes.js`, `skills.js`, or `items.js` without
touching engine code:

- **New class**: add an entry to `src/config/classes.js` and a matching skill list in
  `src/config/skills.js`, then add it to the `enum` in `src/models/Hero.js` and the class buttons
  in `src/bot/keyboards/index.js`.
- **New skill**: add to the relevant class's array in `src/config/skills.js` — the battle engine
  reads `type` (`physical`/`magic`/`heal`/`buff`/`shield`/`evade`) to decide how to resolve it.
- **New item**: add to `BASE_ITEMS` in `src/config/items.js`, then re-run `npm run seed` (delete
  existing templates first if you want to reseed).
- **Double-elimination tournaments**: `src/game/tournaments.js` only builds a single-elimination
  bracket today; the `Tournament` model's `bracket` array is generic enough to add a second
  losers-bracket array alongside it without a schema migration.

---

## ⚠️ Known v1 Limitations

- The ranked matchmaking queue and live battle combat state are stored **in memory**
  (`src/game/matchmaking.js`, `src/services/battleService.js`). This is fine for a single Render
  instance, but if you ever scale to multiple instances/dynos, move both to Redis or MongoDB so
  state is shared across processes.
- Guild wars, crafting, generated profile card images, and payment integration are stretch goals
  and are not implemented in v1 (see the original project brief for details).
- Turn timeouts are supported structurally in the engine but the bot layer currently expects the
  player to tap a button; wiring a hard 30s auto-attack timer per-turn is a straightforward addition
  in `src/bot/battleFlow.js` using `setTimeout` alongside `pendingPvPActions`.
