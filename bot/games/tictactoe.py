"""
Tic-Tac-Toe game engine.

State shape:
{
    "board": [" "] * 9,      # 3x3 grid flattened, " " | "X" | "O"
    "turn": "X",              # whose turn it is
    "symbols": {host_id: "X", guest_id: "O"},
    "winner": None,           # None | "X" | "O" | "draw"
}
"""

WIN_LINES = [
    (0, 1, 2), (3, 4, 5), (6, 7, 8),  # rows
    (0, 3, 6), (1, 4, 7), (2, 5, 8),  # cols
    (0, 4, 8), (2, 4, 6),             # diagonals
]


def new_state(host_id: int, guest_id: int) -> dict:
    return {
        "board": [" "] * 9,
        "turn": "X",
        "symbols": {str(host_id): "X", str(guest_id): "O"},
        "winner": None,
    }


def check_winner(board: list[str]) -> str | None:
    for a, b, c in WIN_LINES:
        if board[a] != " " and board[a] == board[b] == board[c]:
            return board[a]
    if " " not in board:
        return "draw"
    return None


def apply_move(state: dict, user_id: int, position: int) -> tuple[bool, str]:
    """Returns (success, error_message)."""
    symbol = state["symbols"].get(str(user_id))
    if symbol is None:
        return False, "You're not part of this game."
    if state["winner"] is not None:
        return False, "Game already finished."
    if state["turn"] != symbol:
        return False, "It's not your turn."
    if state["board"][position] != " ":
        return False, "That cell is already taken."

    state["board"][position] = symbol
    winner = check_winner(state["board"])
    if winner:
        state["winner"] = winner
    else:
        state["turn"] = "O" if symbol == "X" else "X"
    return True, ""


def get_result_for_user(state: dict, user_id: int) -> str | None:
    """Returns 'win' | 'loss' | 'draw' | None (game not over)."""
    if state["winner"] is None:
        return None
    if state["winner"] == "draw":
        return "draw"
    symbol = state["symbols"].get(str(user_id))
    return "win" if symbol == state["winner"] else "loss"
