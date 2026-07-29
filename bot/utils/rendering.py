"""
Converts game state dicts into Telegram inline keyboards and
human-readable status text.
"""
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from bot.games import tictactoe, connect4, checkers

TTT_SYMBOLS = {" ": "\u2b1c", "X": "\u274c", "O": "\u2b55"}
C4_SYMBOLS = {" ": "\u26aa", "R": "🔴", "Y": "🟡"}
CHK_SYMBOLS = {
    " ": "\u2b1c",
    "r": "🔴", "R": "👑",
    "b": "\u26ab", "B": "\u2b50",
}
DARK_SQUARE = "\u25a0"


def _name_for(room: dict, user_id: int) -> str:
    if room["host_id"] == user_id:
        return room["host_name"]
    return room["guest_name"]


def _opponent_id(room: dict, user_id: int) -> int:
    return room["guest_id"] if room["host_id"] == user_id else room["host_id"]


# ---------------------------------------------------------------- TicTacToe

def render_tictactoe(room: dict, viewer_id: int) -> tuple[str, InlineKeyboardMarkup]:
    state = room["state"]
    board = state["board"]
    code = room["code"]

    rows = []
    for r in range(3):
        row_buttons = []
        for c in range(3):
            i = r * 3 + c
            row_buttons.append(
                InlineKeyboardButton(text=TTT_SYMBOLS[board[i]], callback_data=f"ttt:{code}:{i}")
            )
        rows.append(row_buttons)

    text = _status_text(room, viewer_id, state, tictactoe)
    return text, InlineKeyboardMarkup(inline_keyboard=rows)


# ----------------------------------------------------------------- Connect4

def render_connect4(room: dict, viewer_id: int) -> tuple[str, InlineKeyboardMarkup]:
    state = room["state"]
    board = state["board"]
    code = room["code"]

    # column-select row on top, then the board itself (no per-cell buttons needed for board display,
    # but we render the board as disabled-look buttons via a "noop" callback, and a real button row for column drops)
    rows = []
    col_row = [
        InlineKeyboardButton(text=str(c + 1), callback_data=f"c4:{code}:{c}")
        for c in range(connect4.COLS)
    ]
    rows.append(col_row)
    for r in range(connect4.ROWS):
        row_buttons = []
        for c in range(connect4.COLS):
            i = r * connect4.COLS + c
            row_buttons.append(
                InlineKeyboardButton(text=C4_SYMBOLS[board[i]], callback_data="noop")
            )
        rows.append(row_buttons)

    text = _status_text(room, viewer_id, state, connect4)
    return text, InlineKeyboardMarkup(inline_keyboard=rows)


# ----------------------------------------------------------------- Checkers

def render_checkers(room: dict, viewer_id: int, selected: int | None = None) -> tuple[str, InlineKeyboardMarkup]:
    state = room["state"]
    board = state["board"]
    code = room["code"]

    legal_targets = {}
    if selected is not None:
        legal_targets = checkers.legal_targets(state, selected)

    rows = []
    for r in range(8):
        row_buttons = []
        for c in range(8):
            i = r * 8 + c
            is_dark = (r + c) % 2 == 1
            if not is_dark:
                row_buttons.append(InlineKeyboardButton(text="\u2b1c", callback_data="noop"))
                continue

            piece = board[i]
            if i == selected:
                label = "🟨"  # selected marker
            elif i in legal_targets:
                label = "\u2795"  # possible move marker
            else:
                label = CHK_SYMBOLS[piece]

            row_buttons.append(
                InlineKeyboardButton(text=label, callback_data=f"chk:{code}:{i}")
            )
        rows.append(row_buttons)

    text = _status_text(room, viewer_id, state, checkers)
    if selected is not None:
        text += "\n\nPiece selected \u2014 tap a \u2795 to move there, or tap another of your pieces to reselect."
    return text, InlineKeyboardMarkup(inline_keyboard=rows)


# ------------------------------------------------------------------- Shared

def _status_text(room: dict, viewer_id: int, state: dict, engine) -> str:
    host_name = room["host_name"]
    guest_name = room["guest_name"]
    opponent_name = guest_name if room["host_id"] == viewer_id else host_name

    result = engine.get_result_for_user(state, viewer_id)
    if result == "win":
        return f"🎉 You won against {opponent_name}!"
    if result == "loss":
        return f"😢 You lost against {opponent_name}."
    if result == "draw":
        return f"🤝 It's a draw against {opponent_name}!"

    your_symbol = state["symbols"].get(str(viewer_id))
    is_your_turn = state["turn"] == your_symbol
    turn_text = "Your turn!" if is_your_turn else f"Waiting for {opponent_name}..."
    return f"vs {opponent_name}\n{turn_text}"


def render_for_game(game: str, room: dict, viewer_id: int, selected: int | None = None):
    if game == "tictactoe":
        return render_tictactoe(room, viewer_id)
    if game == "connect4":
        return render_connect4(room, viewer_id)
    if game == "checkers":
        return render_checkers(room, viewer_id, selected)
    raise ValueError(f"Unknown game: {game}")
