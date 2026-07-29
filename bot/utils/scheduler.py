"""
Simple asyncio-based daily scheduler for the leaderboard snapshot.
No external scheduling library needed — just sleeps until the next
target time in a loop, running for the lifetime of the bot process.
"""
import asyncio
from datetime import datetime, timedelta, timezone

from aiogram import Bot
from bot.utils.channel_log import post_leaderboard_snapshot

# UTC hour at which the daily leaderboard is posted (0-23)
DAILY_POST_HOUR_UTC = 12


async def _seconds_until_next_run() -> float:
    now = datetime.now(timezone.utc)
    target = now.replace(hour=DAILY_POST_HOUR_UTC, minute=0, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return (target - now).total_seconds()


async def run_daily_leaderboard_loop(bot: Bot):
    while True:
        wait_seconds = await _seconds_until_next_run()
        await asyncio.sleep(wait_seconds)
        try:
            await post_leaderboard_snapshot(bot)
        except Exception as e:
            print(f"[scheduler] Failed to post leaderboard: {e}")
