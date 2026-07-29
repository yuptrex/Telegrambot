"""
Win/loss/draw stats per user, used for the leaderboard.
"""
from bot.db.connection import stats_col

GAME_KEYS = ["tictactoe", "checkers", "connect4"]


async def ensure_stats(user_id: int, username: str) -> None:
    existing = await stats_col.find_one({"user_id": user_id})
    if existing:
        # keep username fresh in case it changed
        await stats_col.update_one(
            {"user_id": user_id}, {"$set": {"username": username}}
        )
        return

    doc = {"user_id": user_id, "username": username, "wins": 0, "losses": 0, "draws": 0}
    for g in GAME_KEYS:
        doc[f"wins_{g}"] = 0
        doc[f"losses_{g}"] = 0
        doc[f"draws_{g}"] = 0
    await stats_col.insert_one(doc)


async def record_result(user_id: int, username: str, game: str, result: str) -> None:
    """
    result: "win" | "loss" | "draw"
    """
    await ensure_stats(user_id, username)
    field_map = {"win": "wins", "loss": "losses", "draw": "draws"}
    base_field = field_map[result]
    await stats_col.update_one(
        {"user_id": user_id},
        {"$inc": {base_field: 1, f"{base_field}_{game}": 1}},
    )


async def get_user_stats(user_id: int) -> dict | None:
    return await stats_col.find_one({"user_id": user_id})


async def get_top_players(limit: int = 10) -> list[dict]:
    cursor = stats_col.find().sort("wins", -1).limit(limit)
    return await cursor.to_list(length=limit)
