import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func, col
from pydantic import BaseModel
from jose import jwt

from ..database import get_session
from ..models import User, Dog, Clip, AdminOtp
from ..config import (
    ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_OTP_DELIVERY, SECRET_KEY, ALGORITHM,
    RESEND_API_KEY, OTP_EXPIRE_MINUTES,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


class AdminLoginBody(BaseModel):
    email: str
    password: str


class OtpVerifyBody(BaseModel):
    email: str
    code: str


def _send_otp_email(to: str, code: str) -> bool:
    if not RESEND_API_KEY:
        print(f"[OTP mock] {to} -> {code}")
        return True

    import httpx
    resp = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
        json={
            "from": "PawTalk <noreply@turnit.com.ar>",
            "to": to,
            "subject": f"{code} — Codigo de verificacion PawTalk Admin",
            "html": f"""<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#0a0a12;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#161625;border-radius:12px;padding:32px;color:#ededf5;">
    <div style="font-weight:700;font-size:18px;color:#a78bfa;margin-bottom:24px;">🐾 PawTalk Admin</div>
    <h1 style="margin:0 0 16px;font-size:22px;color:#ededf5;">Codigo de verificacion</h1>
    <p style="color:#b0b0cc;">Usa este codigo para acceder al panel de administracion:</p>
    <div style="margin:24px 0;text-align:center;">
      <span style="display:inline-block;background:#1e1e35;border:2px solid #2a2a4a;border-radius:12px;padding:16px 32px;font-size:32px;font-weight:700;letter-spacing:8px;color:#a78bfa;">{code}</span>
    </div>
    <p style="color:#6a6a8a;font-size:13px;">El codigo vence en {OTP_EXPIRE_MINUTES} minutos. Si no solicitaste este codigo, ignora este email.</p>
    <hr style="border:none;border-top:1px solid #2a2a4a;margin:32px 0 16px;">
    <p style="font-size:12px;color:#6a6a8a;margin:0;">PawTalk — traductor canino inteligente</p>
  </div>
</body></html>""",
        },
    )
    return resp.status_code == 200


def _create_admin_token() -> str:
    expire = datetime.utcnow() + timedelta(hours=12)
    return jwt.encode({"sub": "admin", "role": "admin", "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


from fastapi import Header

def _get_admin_token(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autorizado")
    token = authorization[7:]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("role") != "admin":
            raise ValueError()
    except Exception:
        raise HTTPException(status_code=401, detail="No autorizado")
    return token


# ── Auth endpoints ──

@router.post("/login")
def admin_login(body: AdminLoginBody, session: Session = Depends(get_session)):
    if body.email != ADMIN_EMAIL or body.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Credenciales invalidas")

    code = f"{secrets.randbelow(1000000):06d}"
    otp = AdminOtp(
        email=body.email,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES),
    )
    session.add(otp)
    session.commit()

    deliver_to = ADMIN_OTP_DELIVERY or body.email
    sent = _send_otp_email(deliver_to, code)
    if not sent:
        raise HTTPException(status_code=500, detail="Error enviando email")

    return {"status": "otp_sent", "email": deliver_to}


@router.post("/verify-otp")
def verify_otp(body: OtpVerifyBody, session: Session = Depends(get_session)):
    otp = session.exec(
        select(AdminOtp)
        .where(
            AdminOtp.email == body.email,
            AdminOtp.code == body.code,
            AdminOtp.used == False,
            AdminOtp.expires_at > datetime.utcnow(),
        )
        .order_by(AdminOtp.created_at.desc())
    ).first()

    if not otp:
        raise HTTPException(status_code=401, detail="Codigo invalido o expirado")

    otp.used = True
    session.add(otp)
    session.commit()

    token = _create_admin_token()
    return {"access_token": token, "token_type": "bearer"}


@router.post("/resend-otp")
def resend_otp(body: AdminLoginBody, session: Session = Depends(get_session)):
    if body.email != ADMIN_EMAIL or body.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Credenciales invalidas")

    session.exec(
        select(AdminOtp).where(AdminOtp.email == body.email, AdminOtp.used == False)
    )
    for old in session.exec(select(AdminOtp).where(AdminOtp.email == body.email, AdminOtp.used == False)).all():
        old.used = True
        session.add(old)

    code = f"{secrets.randbelow(1000000):06d}"
    otp = AdminOtp(
        email=body.email,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES),
    )
    session.add(otp)
    session.commit()

    deliver_to = ADMIN_OTP_DELIVERY or body.email
    _send_otp_email(deliver_to, code)
    return {"status": "otp_sent"}


# ── Data endpoints ──

@router.get("/stats")
def admin_stats(
    _: str = Depends(_get_admin_token),
    session: Session = Depends(get_session),
):

    total_users = session.exec(select(func.count(User.id))).one()
    total_dogs = session.exec(select(func.count(Dog.id))).one()
    total_clips = session.exec(select(func.count(Clip.id))).one()
    processed = session.exec(select(func.count(Clip.id)).where(Clip.processed == True)).one()

    by_label = {}
    rows = session.exec(select(Clip.label, func.count(Clip.id)).group_by(Clip.label)).all()
    for label, count in rows:
        by_label[label] = count

    by_media = {}
    rows = session.exec(select(Clip.media_type, func.count(Clip.id)).group_by(Clip.media_type)).all()
    for media, count in rows:
        by_media[media] = count

    return {
        "total_users": total_users,
        "total_dogs": total_dogs,
        "total_clips": total_clips,
        "processed": processed,
        "pending": total_clips - processed,
        "by_label": by_label,
        "by_media": by_media,
    }


@router.get("/users")
def admin_users(
    _: str = Depends(_get_admin_token),
    session: Session = Depends(get_session),
):

    users = session.exec(select(User).order_by(User.created_at.desc())).all()
    result = []
    for u in users:
        dogs = session.exec(select(Dog).where(Dog.owner_id == u.id)).all()
        clip_count = session.exec(
            select(func.count(Clip.id)).join(Dog).where(Dog.owner_id == u.id)
        ).one()

        dogs_data = []
        for d in dogs:
            dog_clips = session.exec(
                select(func.count(Clip.id)).where(Clip.dog_id == d.id)
            ).one()
            dogs_data.append({
                "id": d.id,
                "name": d.name,
                "breed": d.breed,
                "photo_url": f"/uploads/photos/{d.photo_path}" if d.photo_path else None,
                "clip_count": dog_clips,
            })

        result.append({
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "created_at": u.created_at.isoformat(),
            "dog_count": len(dogs),
            "clip_count": clip_count,
            "dogs": dogs_data,
        })

    return result
