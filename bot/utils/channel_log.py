"""
Posts game events and periodic leaderboard snapshots to the
configured Telegram channel (CHANNEL_ID).
"""
import logging

from aiogram import Bot
from aiogram.exceptions import TelegramAPIError
from bot.config import CHANNEL_ID
from bot.db.stats import get_top_players

logger = logging.getLogger("game_bot.channel_log")

GAME_LABELS = {
    "tictactoe": "Tic-Tac-Toe",
    "checkers": "Checkers",
    "connect4": "Connect 4",
}


async def _post(bot: Bot, text: str) -> None:
    """Best-effort channel post: never let a logging failure (bad
    CHANNEL_ID, bot not admin there, etc.) bubble up and break the
    actual game flow for the players."""
    try:
        await bot.send_message(CHANNEL_ID, text, parse_mode="HTML")
    except TelegramAPIError:
        logger.warning("Couldn't post to log channel", exc_info=True)


async def log_match_result(bot: Bot, game: str, room: dict) -> None:
    state = room["state"]
    host_name = room["host_name"]
    guest_name = room["guest_name"]
    winner_symbol = state["winner"]

    label = GAME_LABELS.get(game, game)

    if winner_symbol == "draw":
        text = f"🤝 <b>{label}</b> \u2014 {host_name} vs {guest_name} ended in a draw."
    else:
        host_symbol = state["symbols"].get(str(room["host_id"]))
        winner_name = host_name if winner_symbol == host_symbol else guest_name
        loser_name = guest_name if winner_name == host_name else host_name
        text = f"🏆 <b>{label}</b> \u2014 {winner_name} defeated {loser_name}!"

    await _post(bot, text)


async def log_room_created(bot: Bot, game: str, host_name: str, code: str) -> None:
    label = GAME_LABELS.get(game, game)
    text = f"🆕 {host_name} opened a <b>{label}</b> room (code: <code>{code}</code>)"
    await _post(bot, text)


async def post_leaderboard_snapshot(bot: Bot, top_n: int = 10) -> None:
    players = await get_top_players(top_n)
    if not players:
        return

    lines = ["📊 <b>Daily Leaderboard</b>\n"]
    medals = ["🥇", "🥈", "🥉"]
    for i, p in enumerate(players):
        prefix = medals[i] if i < 3 else f"{i + 1}."
        name = p.get("username") or "Player"
        wins = p.get("wins", 0)
        losses = p.get("losses", 0)
        draws = p.get("draws", 0)
        lines.append(f"{prefix} {name} \u2014 {wins}W / {losses}L / {draws}D")

    await _post(bot, "\n".join(lines))
