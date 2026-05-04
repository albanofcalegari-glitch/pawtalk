import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
PHOTOS_DIR = UPLOADS_DIR / "photos"
CLIPS_DIR = UPLOADS_DIR / "clips"

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'pawtalk.db'}")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-prod-pawtalk-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week
