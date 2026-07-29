"""
User account handling — stores basic profile info the first time
someone talks to the bot, and updates it on subsequent visits.
"""
from datetime import datetime, timezone
from bot.db.connection import users_col


async def upsert_user(user_id: int, username: str | None, first_name: str) -> None:
    await users_col.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "username": username,
                "first_name": first_name,
                "last_seen": datetime.now(timezone.utc),
            },
            "$setOnInsert": {
                "joined_at": datetime.now(timezone.utc),
            },
        },
        upsert=True,
    )


async def get_user(user_id: int) -> dict | None:
    return await users_col.find_one({"user_id": user_id})
