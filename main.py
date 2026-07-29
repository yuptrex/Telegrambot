"""
Entry point.

Runs the bot as a **web service** using Telegram webhooks (aiohttp),
the same deployment shape as the reference file-indexer bot: it binds
$PORT immediately so platforms like Render's "Web Service" don't time
out waiting for an open port, and Telegram pushes updates to us
instead of us polling for them.

Falls back to long polling automatically if no webhook URL can be
determined (e.g. running locally for development) — set WEBHOOK_URL
yourself if you want webhook mode outside of Render.
"""
import asyncio
import logging
import os

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import ErrorEvent
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from aiohttp import web

from bot.config import BOT_TOKEN, PORT, WEBHOOK_URL
from bot.db.connection import init_indexes
from bot.handlers import menu, join, gameplay
from bot.utils.reactions import GameAwareReactionMiddleware
from bot.utils.scheduler import run_daily_leaderboard_loop

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("game_bot.main")

WEBHOOK_PATH = f"/webhook/{BOT_TOKEN}"


def build_dispatcher() -> Dispatcher:
    dp = Dispatcher()

    # Outer middleware so it runs on every incoming message before any
    # router/filter decides whether to handle it — this is what gives
    # every general chat message its emoji reaction, while skipping
    # players who are mid-game (see bot/utils/reactions.py).
    dp.message.outer_middleware(GameAwareReactionMiddleware())

    dp.include_router(menu.router)
    dp.include_router(join.router)
    dp.include_router(gameplay.router)

    # Global error handler: without this, an exception inside any
    # handler (e.g. a transient Mongo hiccup) is only written to the
    # logs — the user's chat gets no reply at all, which looks exactly
    # like "the bot didn't respond." This makes failures visible (full
    # traceback in logs) and gives the user a heads-up instead of dead
    # silence.
    @dp.errors()
    async def on_error(event: ErrorEvent, bot: Bot):
        logger.error(
            "Unhandled exception while processing update %s",
            event.update.update_id,
            exc_info=event.exception,
        )

        chat_id = None
        if event.update.message:
            chat_id = event.update.message.chat.id
        elif event.update.callback_query and event.update.callback_query.message:
            chat_id = event.update.callback_query.message.chat.id

        if chat_id is not None:
            try:
                await bot.send_message(
                    chat_id,
                    "\u26a0\ufe0f Something went wrong on my end handling that. "
                    "Please try again, or send /start to reset.",
                )
            except Exception:
                pass

        return True

    return dp


async def _init_shared(bot: Bot):
    await init_indexes()
    # Fire-and-forget background task for the daily leaderboard post
    asyncio.create_task(run_daily_leaderboard_loop(bot))


async def _run_webhook(bot: Bot, dp: Dispatcher, webhook_target: str):
    webhook_base = webhook_target.rstrip("/")
    if not webhook_base.startswith(("http://", "https://")):
        webhook_base = f"https://{webhook_base}"
    full_webhook_url = f"{webhook_base}{WEBHOOK_PATH}"

    async def on_startup(bot: Bot):
        await _init_shared(bot)
        logger.info("Registering webhook URL: %s", full_webhook_url)
        await bot.set_webhook(full_webhook_url, drop_pending_updates=True)

    dp.startup.register(on_startup)

    app = web.Application()
    SimpleRequestHandler(dispatcher=dp, bot=bot).register(app, path=WEBHOOK_PATH)
    setup_application(app, dp, bot=bot)

    async def health(_request):
        return web.Response(text="ok")

    app.router.add_get("/", health)

    logger.info("Starting in webhook mode on port %s", PORT)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host="0.0.0.0", port=PORT)
    await site.start()

    # Keep the process alive.
    await asyncio.Event().wait()


async def _run_polling(bot: Bot, dp: Dispatcher):
    await _init_shared(bot)
    logger.info("Starting in polling mode (no WEBHOOK_URL / RENDER_EXTERNAL_URL set)")
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


async def main():
    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = build_dispatcher()

    # On Render (or any host with an expected HTTP port), run in webhook
    # mode: it binds $PORT immediately, which is what stops the platform
    # from timing out the deploy. Long polling never binds a port, so if
    # this fell through to polling on a Web Service, Render would wait
    # for a port that never opens and kill the deploy.
    render_url = os.environ.get("RENDER_EXTERNAL_URL")  # auto-set by Render
    on_render = os.environ.get("RENDER") == "true"  # set on every Render service
    webhook_target = WEBHOOK_URL or render_url

    if on_render and not webhook_target:
        raise RuntimeError(
            "Running on Render but no webhook URL could be determined. "
            "Set the WEBHOOK_URL env var to this service's public URL "
            "(Render dashboard -> service -> the https://<name>.onrender.com address)."
        )

    if webhook_target:
        await _run_webhook(bot, dp, webhook_target)
    else:
        await _run_polling(bot, dp)


if __name__ == "__main__":
    asyncio.run(main())
