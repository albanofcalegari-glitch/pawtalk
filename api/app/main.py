from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .database import init_db
from .config import UPLOADS_DIR, PHOTOS_DIR, CLIPS_DIR
from .routers import auth_router, dogs_router, clips_router, ml_router, admin_router, places_router

PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
CLIPS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="PawTalk API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.include_router(auth_router.router)
app.include_router(dogs_router.router)
app.include_router(clips_router.router)
app.include_router(ml_router.router)
app.include_router(admin_router.router)
app.include_router(places_router.router)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "pawtalk"}
