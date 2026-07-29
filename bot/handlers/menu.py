"""
/start command and the main game-selection menu.
"""
from aiogram import Router, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton

from bot.db.users import upsert_user
from bot.db.rooms import get_active_room_for_user, create_room, cancel_room
from bot.db.stats import get_user_stats
from bot.utils.channel_log import log_room_created

router = Router()

GAME_LABELS = {
    "tictactoe": "\u274c\u2b55 Tic-Tac-Toe",
    "checkers": "\u26ab🔴 Checkers",
    "connect4": "🔴🟡 Connect 4",
}


def main_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=label, callback_data=f"newgame:{key}")]
            for key, label in GAME_LABELS.items()
        ]
        + [
            [InlineKeyboardButton(text="📊 My Stats", callback_data="mystats")],
        ]
    )


@router.message(CommandStart())
async def cmd_start(message: Message):
    await upsert_user(message.from_user.id, message.from_user.username, message.from_user.first_name)

    existing_room = await get_active_room_for_user(message.from_user.id)
    if existing_room:
        await message.answer(
            f"You're already in an active room (code <code>{existing_room['code']}</code>).\n"
            f"Use /cancel to leave it, or continue playing there.",
            parse_mode="HTML",
        )
        return

    await message.answer(
        "🎮 <b>Welcome!</b>\n\n"
        "Pick a game to create a room, or join a friend's room with /join CODE.",
        parse_mode="HTML",
        reply_markup=main_menu_keyboard(),
    )


@router.message(Command("menu"))
async def cmd_menu(message: Message):
    await message.answer("Pick a game:", reply_markup=main_menu_keyboard())


@router.message(Command("cancel"))
async def cmd_cancel(message: Message):
    room = await get_active_room_for_user(message.from_user.id)
    if not room:
        await message.answer("You don't have an active room.")
        return
    await cancel_room(room["code"])
    await message.answer(f"Room <code>{room['code']}</code> cancelled.", parse_mode="HTML")


@router.callback_query(F.data == "mystats")
async def cb_mystats(callback: CallbackQuery):
    stats = await get_user_stats(callback.from_user.id)
    if not stats:
        await callback.answer("You haven't played any games yet!", show_alert=True)
        return

    text = (
        f"📊 <b>Your Stats</b>\n\n"
        f"Total: {stats.get('wins', 0)}W / {stats.get('losses', 0)}L / {stats.get('draws', 0)}D\n\n"
        f"\u274c\u2b55 Tic-Tac-Toe: {stats.get('wins_tictactoe', 0)}W / {stats.get('losses_tictactoe', 0)}L / {stats.get('draws_tictactoe', 0)}D\n"
        f"\u26ab🔴 Checkers: {stats.get('wins_checkers', 0)}W / {stats.get('losses_checkers', 0)}L / {stats.get('draws_checkers', 0)}D\n"
        f"🔴🟡 Connect 4: {stats.get('wins_connect4', 0)}W / {stats.get('losses_connect4', 0)}L / {stats.get('draws_connect4', 0)}D"
    )
    await callback.message.answer(text, parse_mode="HTML")
    await callback.answer()


@router.callback_query(F.data.startswith("newgame:"))
async def cb_newgame(callback: CallbackQuery):
    game = callback.data.split(":", 1)[1]
    user = callback.from_user

    existing_room = await get_active_room_for_user(user.id)
    if existing_room:
        await callback.answer("You already have an active room. Use /cancel first.", show_alert=True)
        return

    host_name = user.username and f"@{user.username}" or user.first_name
    room = await create_room(game, user.id, host_name)

    await callback.message.answer(
        f"\u2705 Room created for <b>{GAME_LABELS[game]}</b>!\n\n"
        f"Your code: <code>{room['code']}</code>\n\n"
        f"Share this code with your opponent. They should send:\n"
        f"<code>/join {room['code']}</code>\n\n"
        f"Waiting for them to join... (/cancel to abort)",
        parse_mode="HTML",
    )
    await callback.answer()

    await log_room_created(callback.bot, game, host_name, room["code"])
