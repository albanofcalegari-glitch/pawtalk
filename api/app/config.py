import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
PHOTOS_DIR = UPLOADS_DIR / "photos"
CLIPS_DIR = UPLOADS_DIR / "clips"

ML_DIR = BASE_DIR / "ml"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'pawtalk.db'}")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-prod-pawtalk-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@pawtalk.com.ar")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin1234")
ADMIN_OTP_DELIVERY = os.getenv("ADMIN_OTP_DELIVERY", "")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
OTP_EXPIRE_MINUTES = 10
