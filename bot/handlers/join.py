"""
/join CODE — lets a second player join a waiting room and starts the game.
"""
from aiogram import Router
from aiogram.filters import Command, CommandObject
from aiogram.types import Message

from bot.db.users import upsert_user
from bot.db.rooms import get_room_by_code, get_active_room_for_user, join_room, set_message_ids
from bot.games import tictactoe, checkers, connect4
from bot.utils.rendering import render_for_game

router = Router()

ENGINES = {
    "tictactoe": tictactoe,
    "checkers": checkers,
    "connect4": connect4,
}


@router.message(Command("join"))
async def cmd_join(message: Message, command: CommandObject):
    await upsert_user(message.from_user.id, message.from_user.username, message.from_user.first_name)

    if not command.args:
        await message.answer("Usage: <code>/join CODE</code> (the 4-digit code your friend shared)", parse_mode="HTML")
        return

    code = command.args.strip()
    if not (code.isdigit() and len(code) == 4):
        await message.answer("That doesn't look like a valid 4-digit code.")
        return

    existing_room = await get_active_room_for_user(message.from_user.id)
    if existing_room:
        await message.answer("You already have an active room. Use /cancel first.")
        return

    room = await get_room_by_code(code)
    if not room:
        await message.answer("No room found with that code.")
        return
    if room["status"] != "waiting":
        await message.answer("That room isn't available to join (already started or finished).")
        return
    if room["host_id"] == message.from_user.id:
        await message.answer("You can't join your own room!")
        return

    guest = message.from_user
    guest_name = guest.username and f"@{guest.username}" or guest.first_name

    engine = ENGINES[room["game"]]
    initial_state = engine.new_state(room["host_id"], guest.id)

    updated_room = await join_room(code, guest.id, guest_name, initial_state)
    if not updated_room:
        await message.answer("That room just became unavailable. Ask for a fresh code.")
        return

    await message.answer(f"\u2705 Joined! Game starting against {room['host_name']}...")

    # Send the initial board to both players
    host_text, host_kb = render_for_game(room["game"], updated_room, room["host_id"])
    guest_text, guest_kb = render_for_game(room["game"], updated_room, guest.id)

    host_msg = await message.bot.send_message(room["host_id"], host_text, reply_markup=host_kb)
    guest_msg = await message.answer(guest_text, reply_markup=guest_kb)

    await set_message_ids(code, host_msg_id=host_msg.message_id, guest_msg_id=guest_msg.message_id)
