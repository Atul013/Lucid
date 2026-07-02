from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.connectors import todos

router = APIRouter(prefix="/todos")


class TodoBody(BaseModel):
    text: str


class TodoUpdate(BaseModel):
    text: str | None = None
    done: bool | None = None


@router.get("")
def list_todos():
    return {"items": todos.all_todos()}


@router.post("")
def add_todo(body: TodoBody):
    try:
        return todos.add(body.text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{number}")
def update_todo(number: int, body: TodoUpdate):
    """number is the 1-based list position, same as the Telegram commands."""
    try:
        if body.text is not None:
            item = todos.edit(number, body.text)
        if body.done is not None:
            item = todos.set_done(number, body.done)
        if body.text is None and body.done is None:
            raise ValueError("Nothing to update — send text and/or done.")
        return item
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{number}")
def delete_todo(number: int):
    try:
        return {"deleted": todos.delete(number)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
