"""
Handles inline-button taps during gameplay for all three games,
keeps both players' private-chat boards in sync via MongoDB as the
shared source of truth, and records results when a game ends.
"""
from aiogram import Router, F, Bot
from aiogram.types import CallbackQuery

from bot.db.rooms import get_room_by_code, update_state, set_message_ids, finish_room
from bot.db.stats import record_result
from bot.games import tictactoe, checkers, connect4
from bot.utils.rendering import render_for_game
from bot.utils.channel_log import log_match_result

router = Router()

ENGINES = {
    "tictactoe": tictactoe,
    "checkers": checkers,
    "connect4": connect4,
}

# in-memory per-user selection state for checkers (which piece is selected)
# keyed by (user_id, code) -> selected index. Fine to be in-memory since it's
# purely a UI convenience and resets harmlessly if the process restarts.
_checkers_selection: dict[tuple[int, str], int] = {}


async def _sync_both_boards(bot: Bot, room: dict, game: str):
    """Re-render and update both players' board messages after a state change."""
    host_id = room["host_id"]
    guest_id = room["guest_id"]

    host_selected = _checkers_selection.get((host_id, room["code"]))
    guest_selected = _checkers_selection.get((guest_id, room["code"]))

    host_text, host_kb = render_for_game(game, room, host_id, host_selected)
    guest_text, guest_kb = render_for_game(game, room, guest_id, guest_selected)

    if room.get("host_msg_id"):
        try:
            await bot.edit_message_text(
                host_text, chat_id=host_id, message_id=room["host_msg_id"], reply_markup=host_kb
            )
        except Exception:
            pass
    if room.get("guest_msg_id"):
        try:
            await bot.edit_message_text(
                guest_text, chat_id=guest_id, message_id=room["guest_msg_id"], reply_markup=guest_kb
            )
        except Exception:
            pass


async def _finalize_if_over(bot: Bot, room: dict, game: str):
    state = room["state"]
    if state.get("winner") is None:
        return

    engine = ENGINES[game]
    for uid, name in ((room["host_id"], room["host_name"]), (room["guest_id"], room["guest_name"])):
        result = engine.get_result_for_user(state, uid)
        if result:
            await record_result(uid, name, game, result)

    await finish_room(room["code"])
    await log_match_result(bot, game, room)

    # clean up any leftover checkers selection state
    _checkers_selection.pop((room["host_id"], room["code"]), None)
    _checkers_selection.pop((room["guest_id"], room["code"]), None)


@router.callback_query(F.data == "noop")
async def cb_noop(callback: CallbackQuery):
    await callback.answer()


# --------------------------------------------------------------- TicTacToe

@router.callback_query(F.data.startswith("ttt:"))
async def cb_tictactoe_move(callback: CallbackQuery):
    _, code, pos_str = callback.data.split(":")
    position = int(pos_str)

    room = await get_room_by_code(code)
    if not room or room["status"] != "active":
        await callback.answer("This game isn't active anymore.", show_alert=True)
        return

    ok, err = tictactoe.apply_move(room["state"], callback.from_user.id, position)
    if not ok:
        await callback.answer(err, show_alert=True)
        return

    await update_state(code, room["state"])
    await callback.answer()
    await _sync_both_boards(callback.bot, room, "tictactoe")
    await _finalize_if_over(callback.bot, room, "tictactoe")


# ----------------------------------------------------------------- Connect4

@router.callback_query(F.data.startswith("c4:"))
async def cb_connect4_move(callback: CallbackQuery):
    _, code, col_str = callback.data.split(":")
    col = int(col_str)

    room = await get_room_by_code(code)
    if not room or room["status"] != "active":
        await callback.answer("This game isn't active anymore.", show_alert=True)
        return

    ok, err = connect4.apply_move(room["state"], callback.from_user.id, col)
    if not ok:
        await callback.answer(err, show_alert=True)
        return

    await update_state(code, room["state"])
    await callback.answer()
    await _sync_both_boards(callback.bot, room, "connect4")
    await _finalize_if_over(callback.bot, room, "connect4")


# ----------------------------------------------------------------- Checkers

@router.callback_query(F.data.startswith("chk:"))
async def cb_checkers_tap(callback: CallbackQuery):
    _, code, idx_str = callback.data.split(":")
    index = int(idx_str)
    user_id = callback.from_user.id

    room = await get_room_by_code(code)
    if not room or room["status"] != "active":
        await callback.answer("This game isn't active anymore.", show_alert=True)
        return

    state = room["state"]
    color = state["symbols"].get(str(user_id))
    if color is None:
        await callback.answer("You're not part of this game.", show_alert=True)
        return
    if state["turn"] != color:
        await callback.answer("It's not your turn.", show_alert=True)
        return

    sel_key = (user_id, code)
    selected = _checkers_selection.get(sel_key)

    piece_at_index = state["board"][index]
    piece_owner = checkers.owner_color(piece_at_index)

    if selected is not None:
        targets = checkers.legal_targets(state, selected)
        if index in targets:
            ok, err = checkers.apply_move(state, user_id, selected, index)
            if not ok:
                await callback.answer(err, show_alert=True)
                return

            # if the move requires continuing the jump with the same piece, keep it selected
            if state.get("must_continue_from") == index:
                _checkers_selection[sel_key] = index
            else:
                _checkers_selection.pop(sel_key, None)

            await update_state(code, state)
            await callback.answer()
            await _sync_both_boards(callback.bot, room, "checkers")
            await _finalize_if_over(callback.bot, room, "checkers")
            return

        # tapped somewhere that's not a legal target -> maybe reselecting another own piece
        if piece_owner == color:
            _checkers_selection[sel_key] = index
            await callback.answer()
            await _sync_both_boards(callback.bot, room, "checkers")
            return

        await callback.answer("Not a legal move.", show_alert=True)
        return

    # nothing selected yet
    if piece_owner != color:
        await callback.answer("Select one of your own pieces first.", show_alert=True)
        return

    legal = checkers.legal_targets(state, index)
    if not legal:
        await callback.answer("That piece has no legal moves.", show_alert=True)
        return

    _checkers_selection[sel_key] = index
    await callback.answer()
    await _sync_both_boards(callback.bot, room, "checkers")
