from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from app.connectors import gmail as gmail_connector

router = APIRouter()


@router.get("/auth/google")
def auth_google():
    return RedirectResponse(gmail_connector.get_auth_url())


@router.get("/auth/google/callback")
def auth_google_callback(code: str):
    gmail_connector.handle_callback(code)
    return {"status": "gmail connected"}


@router.get("/gmail/status")
def gmail_status():
    return {"connected": gmail_connector.is_connected()}


@router.get("/gmail/sync")
def gmail_sync(max_results: int = 100):
    if not gmail_connector.is_connected():
        raise HTTPException(status_code=401, detail="Gmail not connected")
    emails = gmail_connector.sync_emails(max_results)
    return {"count": len(emails), "emails": emails}
