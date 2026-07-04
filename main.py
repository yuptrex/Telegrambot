"""
Entry point. Runs the bot using long polling (simplest to deploy on
Render as a background worker — no public HTTPS endpoint needed).
"""
import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from bot.config import BOT_TOKEN
from bot.db.connection import init_indexes
from bot.handlers import menu, join, gameplay
from bot.utils.scheduler import run_daily_leaderboard_loop

logging.basicConfig(level=logging.INFO)


async def main():
    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()

    dp.include_router(menu.router)
    dp.include_router(join.router)
    dp.include_router(gameplay.router)

    await init_indexes()

    # Fire-and-forget background task for the daily leaderboard post
    asyncio.create_task(run_daily_leaderboard_loop(bot))

    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
