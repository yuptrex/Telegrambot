"""
Loads configuration from environment variables (.env file).
"""
import os
from dotenv import load_dotenv

load_dotenv()


def _require(name: str) -> str:
    value = os.getenv(name)
    if not value or value.startswith("REPLACE_WITH"):
        raise RuntimeError(
            f"Missing required environment variable: {name}. "
            f"Copy .env.example to .env and fill in real values."
        )
    return value


BOT_TOKEN = _require("BOT_TOKEN")
MONGO_URI = _require("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "game_bot")
CHANNEL_ID = int(_require("CHANNEL_ID"))
