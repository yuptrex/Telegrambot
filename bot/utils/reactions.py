"""
Native Telegram message reactions (the little emoji that pops onto a
message — the same feature as double-tapping a message in WhatsApp).

Behavior required:
  - Every general chat message the bot receives (menu taps, /start,
    casual text, /join, etc.) gets an automatic emoji reaction.
  - Messages sent *during active gameplay* are NOT reacted to. Gameplay
    itself is entirely inline-button taps (callback queries), which
    Telegram doesn't allow reactions on anyway — but a player can also
    type plain text while a game is in progress (e.g. trash talk, or a
    stray text sent to the board chat). Those are suppressed too, so
    the reaction never fires mid-game.

Implementation: an aiogram outer middleware on Message updates. It
checks whether the sender currently has a room in "waiting" or
"active" status (bot.db.rooms.get_active_room_for_user) and skips the
reaction if so. Reactions are fire-and-forget: any failure (message
too old, reaction not permitted in that chat, etc.) is swallowed so it
never breaks the actual bot reply.
"""
import logging
import random
from typing import Any, Awaitable, Callable, Dict

from aiogram import BaseMiddleware
from aiogram.types import Message, ReactionTypeEmoji
from aiogram.exceptions import TelegramAPIError

from bot.db.rooms import get_active_room_for_user

logger = logging.getLogger("game_bot.reactions")

# Telegram only accepts a fixed, curated set of unicode emoji for
# setMessageReaction (see https://core.telegram.org/bots/api#reactiontypeemoji).
# This is a friendly, general-purpose subset of that allow-list — one is
# picked at random per message so it doesn't feel robotic.
REACTION_EMOJIS = [
    "\U0001F44D",  # 👍
    "\u2764\ufe0f",  # ❤️
    "\U0001F525",  # 🔥
    "\U0001F389",  # 🎉
    "\U0001F44F",  # 👏
    "\U0001F60D",  # 😍
    "\U0001F60E",  # 😎
    "\U0001F929",  # 🤩
    "\U0001F447",  # 👇
    "\u2b50",  # ⭐
]


async def react_to_message(message: Message, emoji: str | None = None) -> None:
    """Best-effort: pop a native reaction onto the user's message."""
    chosen = emoji or random.choice(REACTION_EMOJIS)
    try:
        await message.bot.set_message_reaction(
            chat_id=message.chat.id,
            message_id=message.message_id,
            reaction=[ReactionTypeEmoji(emoji=chosen)],
        )
    except TelegramAPIError:
        # Reactions are a nice-to-have — never let this take down a handler.
        logger.debug("Couldn't set message reaction", exc_info=True)


class GameAwareReactionMiddleware(BaseMiddleware):
    """Outer middleware for Message updates.

    Reacts with an emoji to every message EXCEPT when the sender is
    currently inside an active/waiting game room, so board-chat chatter
    during a live match is left alone.
    """

    async def __call__(
        self,
        handler: Callable[[Message, Dict[str, Any]], Awaitable[Any]],
        event: Message,
        data: Dict[str, Any],
    ) -> Any:
        # Only meaningful in 1:1 chats with the bot; group/channel posts
        # are out of scope for this feature.
        if event.from_user and not event.from_user.is_bot:
            try:
                in_game = bool(await get_active_room_for_user(event.from_user.id))
            except Exception:
                # If the DB hiccups, fail open on "in_game" (skip the
                # reaction) rather than risk reacting mid-game.
                logger.debug("Couldn't check active room for reaction gating", exc_info=True)
                in_game = True

            if not in_game:
                await react_to_message(event)

        return await handler(event, data)
