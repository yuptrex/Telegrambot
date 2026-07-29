"""
Checkers (English draughts rules, simplified) game engine.

8x8 board, only dark squares used (32 playable squares).
We store the full 64-cell board flat (row-major, 0..63) for simplicity,
but only dark squares ((row+col) % 2 == 1) are ever occupied.

Pieces:
  "r" = red man,    "R" = red king
  "b" = black man,  "B" = black king
  " " = empty

State shape:
{
    "board": [...64 cells...],
    "turn": "r",                          # "r" or "b"
    "symbols": {host_id: "r", guest_id: "b"},
    "winner": None,                       # None | "r" | "b" | "draw"
    "must_continue_from": None,           # index, if mid multi-jump
}

Move notation used by handlers: (from_index, to_index)
Captures are optional (not forced) to keep the UI simple — a player
may choose any legal move, capture or not.
"""

SIZE = 8


def _idx(row: int, col: int) -> int:
    return row * SIZE + col


def _rc(index: int) -> tuple[int, int]:
    return divmod(index, SIZE)


def new_state(host_id: int, guest_id: int) -> dict:
    board = [" "] * 64
    # Black pieces on rows 0-2, red pieces on rows 5-7, dark squares only.
    for row in range(3):
        for col in range(SIZE):
            if (row + col) % 2 == 1:
                board[_idx(row, col)] = "b"
    for row in range(5, 8):
        for col in range(SIZE):
            if (row + col) % 2 == 1:
                board[_idx(row, col)] = "r"

    return {
        "board": board,
        "turn": "r",
        "symbols": {str(host_id): "r", str(guest_id): "b"},
        "winner": None,
        "must_continue_from": None,
    }


def _is_king(piece: str) -> bool:
    return piece in ("R", "B")


def owner_color(piece: str) -> str | None:
    """Public helper: returns 'r', 'b', or None for an empty square."""
    if piece in ("r", "R"):
        return "r"
    if piece in ("b", "B"):
        return "b"
    return None


# internal alias kept for brevity within this module
_owner_color = owner_color


def _forward_dirs(color: str, piece: str) -> list[tuple[int, int]]:
    """Direction(s) a piece may move diagonally."""
    if _is_king(piece):
        return [(-1, -1), (-1, 1), (1, -1), (1, 1)]
    # red moves "up" (decreasing row), black moves "down" (increasing row)
    return [(-1, -1), (-1, 1)] if color == "r" else [(1, -1), (1, 1)]


def _simple_moves(board: list[str], index: int) -> list[int]:
    piece = board[index]
    color = _owner_color(piece)
    row, col = _rc(index)
    moves = []
    for dr, dc in _forward_dirs(color, piece):
        r, c = row + dr, col + dc
        if 0 <= r < SIZE and 0 <= c < SIZE and board[_idx(r, c)] == " ":
            moves.append(_idx(r, c))
    return moves


def _jump_moves(board: list[str], index: int) -> list[tuple[int, int]]:
    """Returns list of (landing_index, captured_index)."""
    piece = board[index]
    color = _owner_color(piece)
    row, col = _rc(index)
    jumps = []
    for dr, dc in _forward_dirs(color, piece):
        mid_r, mid_c = row + dr, col + dc
        land_r, land_c = row + 2 * dr, col + 2 * dc
        if not (0 <= land_r < SIZE and 0 <= land_c < SIZE):
            continue
        mid_piece = board[_idx(mid_r, mid_c)]
        if mid_piece == " " or _owner_color(mid_piece) == color:
            continue
        if board[_idx(land_r, land_c)] != " ":
            continue
        jumps.append((_idx(land_r, land_c), _idx(mid_r, mid_c)))
    return jumps


def legal_moves_for_piece(board: list[str], index: int) -> dict:
    """Returns {landing_index: captured_index_or_None}."""
    result = {}
    for land, captured in _jump_moves(board, index):
        result[land] = captured
    if not result:
        for land in _simple_moves(board, index):
            result[land] = None
    return result


def all_pieces_for(board: list[str], color: str) -> list[int]:
    return [i for i, p in enumerate(board) if _owner_color(p) == color]


def has_any_capture(board: list[str], color: str) -> bool:
    for i in all_pieces_for(board, color):
        if _jump_moves(board, i):
            return True
    return False


def legal_targets(state: dict, index: int) -> dict:
    """Legal target squares for the piece at `index`, respecting
    forced-continuation of an in-progress multi-jump."""
    board = state["board"]
    if state["must_continue_from"] is not None and index != state["must_continue_from"]:
        return {}
    moves = legal_moves_for_piece(board, index)
    return moves


def apply_move(state: dict, user_id: int, from_index: int, to_index: int) -> tuple[bool, str]:
    color = state["symbols"].get(str(user_id))
    if color is None:
        return False, "You're not part of this game."
    if state["winner"] is not None:
        return False, "Game already finished."
    if state["turn"] != color:
        return False, "It's not your turn."

    board = state["board"]
    piece = board[from_index]
    if _owner_color(piece) != color:
        return False, "That's not your piece."

    if state["must_continue_from"] is not None and from_index != state["must_continue_from"]:
        return False, "You must continue jumping with the same piece."

    targets = legal_targets(state, from_index)
    if to_index not in targets:
        return False, "Illegal move."

    captured = targets[to_index]
    board[from_index] = " "
    board[to_index] = piece
    if captured is not None:
        board[captured] = " "

    # king promotion
    row, _ = _rc(to_index)
    if piece == "r" and row == 0:
        board[to_index] = "R"
    elif piece == "b" and row == SIZE - 1:
        board[to_index] = "B"

    # multi-jump continuation
    if captured is not None:
        further_jumps = _jump_moves(board, to_index)
        if further_jumps:
            state["must_continue_from"] = to_index
            return True, ""

    state["must_continue_from"] = None
    state["turn"] = "b" if color == "r" else "r"

    _check_winner(state)
    return True, ""


def _check_winner(state: dict) -> None:
    board = state["board"]
    red_pieces = all_pieces_for(board, "r")
    black_pieces = all_pieces_for(board, "b")

    if not red_pieces:
        state["winner"] = "b"
        return
    if not black_pieces:
        state["winner"] = "r"
        return

    # if the side to move has no legal moves at all, they lose
    side = state["turn"]
    pieces = red_pieces if side == "r" else black_pieces
    has_move = False
    for i in pieces:
        if legal_moves_for_piece(board, i):
            has_move = True
            break
    if not has_move:
        state["winner"] = "b" if side == "r" else "r"


def get_result_for_user(state: dict, user_id: int) -> str | None:
    if state["winner"] is None:
        return None
    if state["winner"] == "draw":
        return "draw"
    color = state["symbols"].get(str(user_id))
    return "win" if color == state["winner"] else "loss"
