# Telegram Multiplayer Game Bot

Play **Tic-Tac-Toe**, **Checkers**, and **Connect 4** against another
player over Telegram, each in your own private chat with the bot.
Rooms are matched via a 4-digit code (like a private lobby).

---

## 1. Where to put your credentials

**This is the only file you need to edit before running the bot:**

```
.env.example   →  copy this to a new file named  .env
```

Open the new `.env` file and replace these three placeholder lines:

```env
BOT_TOKEN=REPLACE_WITH_YOUR_BOT_TOKEN
MONGO_URI=REPLACE_WITH_YOUR_MONGODB_URI
CHANNEL_ID=REPLACE_WITH_YOUR_CHANNEL_ID
```

with your real values:

| Variable | Where to get it |
|---|---|
| `BOT_TOKEN` | Message **@BotFather** on Telegram → `/newbot` (or `/mybots` → your bot → API Token) |
| `MONGO_URI` | MongoDB Atlas → Database → **Connect** → "Drivers" → copy the connection string (fill in your real password, no `<>`) |
| `CHANNEL_ID` | See step 2 below |
| `MONGO_DB_NAME` | Optional — defaults to `game_bot`, only change if you want a specific DB name |

**Never commit `.env` to git or paste it anywhere public** — `.gitignore` already excludes it.

### ⚠️ Important — credentials you shared in our chat
You pasted a live bot token and MongoDB password earlier in this
conversation. Since that text now exists in a chat transcript,
please treat both as compromised:

1. **BotFather** → `/mybots` → your bot → **API Token** → **Revoke current token**, then use the new token.
2. **MongoDB Atlas** → Database Access → edit your user → **Edit Password** → set a new password, then use the new connection string.

Do this even if you plan to use this bot privately — it costs two minutes and closes the exposure.

---

## 2. Getting your Telegram Channel ID

1. Create a Telegram channel (or use an existing one) for stats/leaderboard logs.
2. Add your bot to the channel as an **admin** (needs "Post Messages" permission).
3. Get the channel's numeric ID — easiest way:
   - Forward any message from the channel to **@userinfobot** or **@RawDataBot**, or
   - Temporarily make the channel public, visit `https://t.me/s/yourchannelname`, and use an ID-lookup bot.
4. The ID will look like `-1001234567890` (negative, starts with `-100`). Put that in `.env` as `CHANNEL_ID`.

---

## 3. Install & run locally

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then edit .env with your real values
python3 main.py
```

If it starts without errors, your bot is now polling Telegram for messages.

---

## 4. Deploying on Render

1. Push this project to a GitHub repo (make sure `.env` is **not** included — check `.gitignore`).
2. On Render: **New +** → **Background Worker** (not a Web Service — this bot uses polling, not a webhook, so it doesn't need a public URL).
3. Connect your repo.
4. **Build Command:** `pip install -r requirements.txt`
5. **Start Command:** `python3 main.py`
6. Under **Environment**, add the same three variables from your `.env` (`BOT_TOKEN`, `MONGO_URI`, `CHANNEL_ID`, and optionally `MONGO_DB_NAME`) — enter the real values directly in Render's dashboard, not in the code.
7. Deploy. Check the logs to confirm it starts polling without errors.

---

## 5. How the bot works

### Commands
- `/start` — welcome message + game selection menu
- `/menu` — show the game menu again
- `/join CODE` — join a friend's room using their 4-digit code
- `/cancel` — cancel/leave your current room

### Game flow
1. Player A picks a game from the menu → bot creates a room and gives a 4-digit code.
2. Player A shares that code with Player B (via chat, voice call, whatever).
3. Player B sends `/join 1234` to the bot.
4. Both players get a private-chat message with the game board as inline buttons.
5. Moves sync in real time between both chats (each tap updates both boards).
6. On game end, results are saved to MongoDB and posted to your Telegram channel.

### MongoDB collections
- `users` — every user who has messaged the bot
- `rooms` — room codes, host/guest, live game state, status (waiting/active/finished)
- `stats` — per-user win/loss/draw counts, overall and per-game

### Channel posts
- **Room opened** — posted when a player creates a room
- **Match result** — posted immediately when a game finishes
- **Daily leaderboard** — posted once every 24 hours (default: 12:00 UTC, configurable in `bot/utils/scheduler.py` via `DAILY_POST_HOUR_UTC`)

---

## 6. Project structure

```
main.py                      Entry point (starts polling)
bot/config.py                Loads .env variables
bot/db/                       MongoDB connection + data access (users, rooms, stats)
bot/games/                    Pure game logic (no Telegram code) — tictactoe, checkers, connect4
bot/handlers/                 aiogram handlers — menu, join, gameplay (button taps)
bot/utils/rendering.py        Converts game state into Telegram inline keyboards
bot/utils/channel_log.py      Posts match results & leaderboard to your channel
bot/utils/scheduler.py        Daily leaderboard timer loop
```

---

## 7. Notes & limitations

- **Checkers** captures are optional (not forced), simplifying the UI — a player may make any legal move, jump or not.
- Game state lives in MongoDB, so if the bot restarts mid-game, active rooms and boards survive (checkers' "selected piece" UI state does not — it's in-memory only and just resets to "nothing selected," which is harmless).
- This uses **long polling**, not webhooks — simplest to run on Render as a background worker with no public HTTPS endpoint needed.
