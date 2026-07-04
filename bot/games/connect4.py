"""
Connect 4 game engine.

Board is 7 columns x 6 rows, stored as a flat list of 42 cells,
row-major, row 0 = top row, row 5 = bottom row.
index = row * 7 + col

State shape:
{
    "board": [" "] * 42,
    "turn": "R",                             # "R" or "Y"
    "symbols": {host_id: "R", guest_id: "Y"},
    "winner": None,                          # None | "R" | "Y" | "draw"
}
"""

COLS = 7
ROWS = 6


def new_state(host_id: int, guest_id: int) -> dict:
    return {
        "board": [" "] * (COLS * ROWS),
        "turn": "R",
        "symbols": {str(host_id): "R", str(guest_id): "Y"},
        "winner": None,
    }


def _idx(row: int, col: int) -> int:
    return row * COLS + col


def _lowest_empty_row(board: list[str], col: int) -> int | None:
    for row in range(ROWS - 1, -1, -1):
        if board[_idx(row, col)] == " ":
            return row
    return None


def check_winner(board: list[str]) -> str | None:
    def cell(r, c):
        return board[_idx(r, c)]

    # horizontal, vertical, diagonal checks
    directions = [(0, 1), (1, 0), (1, 1), (1, -1)]
    for row in range(ROWS):
        for col in range(COLS):
            symbol = cell(row, col)
            if symbol == " ":
                continue
            for dr, dc in directions:
                cells = []
                for step in range(4):
                    r, c = row + dr * step, col + dc * step
                    if 0 <= r < ROWS and 0 <= c < COLS:
                        cells.append(cell(r, c))
                if len(cells) == 4 and all(x == symbol for x in cells):
                    return symbol

    if " " not in board:
        return "draw"
    return None


def apply_move(state: dict, user_id: int, col: int) -> tuple[bool, str]:
    symbol = state["symbols"].get(str(user_id))
    if symbol is None:
        return False, "You're not part of this game."
    if state["winner"] is not None:
        return False, "Game already finished."
    if state["turn"] != symbol:
        return False, "It's not your turn."

    row = _lowest_empty_row(state["board"], col)
    if row is None:
        return False, "That column is full."

    state["board"][_idx(row, col)] = symbol
    winner = check_winner(state["board"])
    if winner:
        state["winner"] = winner
    else:
        state["turn"] = "Y" if symbol == "R" else "R"
    return True, ""


def get_result_for_user(state: dict, user_id: int) -> str | None:
    if state["winner"] is None:
        return None
    if state["winner"] == "draw":
        return "draw"
    symbol = state["symbols"].get(str(user_id))
    return "win" if symbol == state["winner"] else "loss"
