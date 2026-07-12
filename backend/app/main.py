from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from scalar_fastapi import get_scalar_api_reference
from dotenv import load_dotenv
import os

load_dotenv()

from app.routers.gmail import router as gmail_router
from app.routers.archive import router as archive_router
from app.routers.ego import router as ego_router
from app.routers.drift import router as drift_router
from app.routers.graph import router as graph_router
from app.routers.relationships import router as relationships_router
from app.routers.timeline import router as timeline_router
from app.routers.briefing import router as briefing_router
from app.routers.calendar import router as calendar_router
from app.routers.sentiment import router as sentiment_router
from app.routers.health import router as health_router
from app.routers.finance import router as finance_router
from app.routers.telegram import router as telegram_router
from app.routers.whatsapp import router as whatsapp_router
from app.routers.todos import router as todos_router
from app.routers.twin import router as twin_router
from app.routers.agent import router as agent_router
from app.routers.snn import router as snn_router
from app.routers.privacy import router as privacy_router
from app.routers.notes import router as notes_router
from app.connectors import telegram as telegram_connector
from app.connectors import reminders
from app.connectors import chroma
from app import embeddings, security

app = FastAPI(title="Lucid API", docs_url=None, redoc_url=None)


@app.on_event("startup")
def start_background_workers():
    # Resume the live Telegram bot (todo commands + archiving) if connected,
    # and the reminder scheduler that fires due todo reminders.
    telegram_connector.start_poller()
    reminders.start()
    # Load (and, on first run, download) the mock-mode search embedding model
    # in the background, so it's not the first search request's problem. The
    # real ChromaDB backend embeds on its own — nothing to warm there.
    if chroma.MOCK_MODE:
        embeddings.warm()

# Security stack (API key auth, rate limit, body cap, audit log, headers).
# Must be installed before CORS so CORS stays outermost — see security.install.
security.install(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    # Any private-LAN origin on the frontend dev port is fine — phone testing
    # keeps working when the wifi network (and the laptop's IP) changes.
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):3000$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", "X-API-Key"],
    expose_headers=["Content-Type"],
)

app.include_router(gmail_router)
app.include_router(archive_router)
app.include_router(graph_router)
app.include_router(relationships_router)
app.include_router(timeline_router)
app.include_router(briefing_router)
app.include_router(ego_router)
app.include_router(drift_router)
app.include_router(calendar_router)
app.include_router(sentiment_router)
app.include_router(health_router)
app.include_router(finance_router)
app.include_router(telegram_router)
app.include_router(whatsapp_router)
app.include_router(todos_router)
app.include_router(twin_router)
app.include_router(agent_router)
app.include_router(snn_router)
app.include_router(privacy_router)
app.include_router(notes_router)


@app.get("/docs", include_in_schema=False)
def docs():
    return get_scalar_api_reference(openapi_url="/openapi.json", title="Lucid API")


@app.get("/health")
def health():
    return {"status": "ok"}
