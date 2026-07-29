"""
MongoDB connection using Motor (async driver for MongoDB).
"""
from motor.motor_asyncio import AsyncIOMotorClient
from bot.config import MONGO_URI, MONGO_DB_NAME

client = AsyncIOMotorClient(MONGO_URI)
db = client[MONGO_DB_NAME]

# Collections
users_col = db["users"]
rooms_col = db["rooms"]
games_col = db["games"]
stats_col = db["stats"]


async def init_indexes():
    """Create indexes needed for fast lookups. Call once at startup."""
    await users_col.create_index("user_id", unique=True)
    await rooms_col.create_index("code", unique=True)
    await rooms_col.create_index("status")
    await stats_col.create_index("user_id", unique=True)
