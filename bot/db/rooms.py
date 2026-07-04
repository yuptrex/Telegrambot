"""
Rooms are how two players find each other:
  1. Player A creates a room for a chosen game -> gets a 4-digit code.
  2. Player A shares the code with Player B (outside the bot).
  3. Player B sends /join CODE -> room fills up -> game starts.

The room document also stores the live game state (board, turn, etc.)
so both players' private-chat messages can be re-rendered from a
single shared source of truth in MongoDB.
"""
import random
from datetime import datetime, timezone
from bot.db.connection import rooms_col

STATUS_WAITING = "waiting"
STATUS_ACTIVE = "active"
STATUS_FINISHED = "finished"


async def _generate_unique_code() -> str:
    for _ in range(50):
        code = f"{random.randint(0, 9999):04d}"
        existing = await rooms_col.find_one({"code": code, "status": {"$ne": STATUS_FINISHED}})
        if not existing:
            return code
    raise RuntimeError("Could not generate a unique room code, try again.")


async def create_room(game: str, host_id: int, host_name: str) -> dict:
    code = await _generate_unique_code()
    room = {
        "code": code,
        "game": game,
        "status": STATUS_WAITING,
        "host_id": host_id,
        "host_name": host_name,
        "guest_id": None,
        "guest_name": None,
        "state": None,  # populated when game starts
        "created_at": datetime.now(timezone.utc),
        "host_msg_id": None,   # message id of the board in host's chat
        "guest_msg_id": None,  # message id of the board in guest's chat
    }
    await rooms_col.insert_one(room)
    return room


async def get_room_by_code(code: str) -> dict | None:
    return await rooms_col.find_one({"code": code})


async def get_active_room_for_user(user_id: int) -> dict | None:
    """Find a room (waiting or active) where this user is host or guest."""
    return await rooms_col.find_one(
        {
            "$or": [{"host_id": user_id}, {"guest_id": user_id}],
            "status": {"$in": [STATUS_WAITING, STATUS_ACTIVE]},
        }
    )


async def join_room(code: str, guest_id: int, guest_name: str, initial_state: dict) -> dict | None:
    result = await rooms_col.find_one_and_update(
        {"code": code, "status": STATUS_WAITING},
        {
            "$set": {
                "guest_id": guest_id,
                "guest_name": guest_name,
                "status": STATUS_ACTIVE,
                "state": initial_state,
            }
        },
        return_document=True,
    )
    return result


async def update_state(code: str, state: dict) -> None:
    await rooms_col.update_one({"code": code}, {"$set": {"state": state}})


async def set_message_ids(code: str, host_msg_id: int | None = None, guest_msg_id: int | None = None) -> None:
    update = {}
    if host_msg_id is not None:
        update["host_msg_id"] = host_msg_id
    if guest_msg_id is not None:
        update["guest_msg_id"] = guest_msg_id
    if update:
        await rooms_col.update_one({"code": code}, {"$set": update})


async def finish_room(code: str) -> None:
    await rooms_col.update_one({"code": code}, {"$set": {"status": STATUS_FINISHED}})


async def cancel_room(code: str) -> None:
    await rooms_col.update_one({"code": code}, {"$set": {"status": STATUS_FINISHED}})
