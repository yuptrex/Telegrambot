"""
Posts game events and periodic leaderboard snapshots to the
configured Telegram channel (CHANNEL_ID).
"""
from aiogram import Bot
from bot.config import CHANNEL_ID
from bot.db.stats import get_top_players

GAME_LABELS = {
    "tictactoe": "Tic-Tac-Toe",
    "checkers": "Checkers",
    "connect4": "Connect 4",
}


async def log_match_result(bot: Bot, game: str, room: dict) -> None:
    state = room["state"]
    host_name = room["host_name"]
    guest_name = room["guest_name"]
    winner_symbol = state["winner"]

    label = GAME_LABELS.get(game, game)

    if winner_symbol == "draw":
        text = f"\ud83e\udd1d <b>{label}</b> \u2014 {host_name} vs {guest_name} ended in a draw."
    else:
        host_symbol = state["symbols"].get(str(room["host_id"]))
        winner_name = host_name if winner_symbol == host_symbol else guest_name
        loser_name = guest_name if winner_name == host_name else host_name
        text = f"\ud83c\udfc6 <b>{label}</b> \u2014 {winner_name} defeated {loser_name}!"

    await bot.send_message(CHANNEL_ID, text, parse_mode="HTML")


async def log_room_created(bot: Bot, game: str, host_name: str, code: str) -> None:
    label = GAME_LABELS.get(game, game)
    text = f"\ud83c\udd95 {host_name} opened a <b>{label}</b> room (code: <code>{code}</code>)"
    await bot.send_message(CHANNEL_ID, text, parse_mode="HTML")


async def post_leaderboard_snapshot(bot: Bot, top_n: int = 10) -> None:
    players = await get_top_players(top_n)
    if not players:
        return

    lines = ["\ud83d\udcca <b>Daily Leaderboard</b>\n"]
    medals = ["\ud83e\udd47", "\ud83e\udd48", "\ud83e\udd49"]
    for i, p in enumerate(players):
        prefix = medals[i] if i < 3 else f"{i + 1}."
        name = p.get("username") or "Player"
        wins = p.get("wins", 0)
        losses = p.get("losses", 0)
        draws = p.get("draws", 0)
        lines.append(f"{prefix} {name} \u2014 {wins}W / {losses}L / {draws}D")

    await bot.send_message(CHANNEL_ID, "\n".join(lines), parse_mode="HTML")
