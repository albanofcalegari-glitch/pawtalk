import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional
from ..database import get_session
from ..models import User, Dog, Clip
from ..auth import get_current_user
from ..config import CLIPS_DIR

router = APIRouter(prefix="/api/clips", tags=["clips"])

VALID_LABELS = {"bark", "whine", "growl", "howl", "pant", "lying", "sitting", "playing", "eating", "sleeping", "alert", "relaxed", "walking", "other"}
VALID_MEDIA_TYPES = {"audio", "video", "photo"}


class ClipResponse(BaseModel):
    id: int
    dog_id: int
    dog_name: str
    label: str
    media_type: str
    duration_ms: int
    has_video: bool
    has_photo: bool
    processed: bool
    purged: bool
    created_at: str


class StatsResponse(BaseModel):
    total: int
    by_label: dict[str, int]
    by_dog: dict[str, int]
    by_media: dict[str, int]
    processed: int
    pending: int
    disk_mb: float


@router.post("", response_model=ClipResponse, status_code=201)
def upload_clip(
    dog_id: int = Form(...),
    label: str = Form(...),
    media_type: str = Form("audio"),
    duration_ms: int = Form(0),
    audio: Optional[UploadFile] = File(None),
    video: Optional[UploadFile] = File(None),
    photo: Optional[UploadFile] = File(None),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    dog = session.exec(select(Dog).where(Dog.id == dog_id, Dog.owner_id == user.id)).first()
    if not dog:
        raise HTTPException(status_code=404, detail="Perro no encontrado")

    if label not in VALID_LABELS:
        raise HTTPException(status_code=400, detail=f"Label debe ser uno de: {VALID_LABELS}")

    if media_type not in VALID_MEDIA_TYPES:
        raise HTTPException(status_code=400, detail=f"media_type debe ser uno de: {VALID_MEDIA_TYPES}")

    clip = Clip(dog_id=dog_id, label=label, media_type=media_type, duration_ms=duration_ms)
    session.add(clip)
    session.commit()
    session.refresh(clip)

    prefix = f"{dog.name.lower()}_{label}_{clip.id}"

    if audio:
        ext = _get_ext(audio.filename, "webm")
        filename = f"{prefix}.{ext}"
        _save_file(audio, CLIPS_DIR / filename)
        clip.file_path = filename

    if video:
        ext = _get_ext(video.filename, "webm")
        filename = f"{prefix}_video.{ext}"
        _save_file(video, CLIPS_DIR / filename)
        clip.video_path = filename

    if photo:
        ext = photo.filename.split(".")[-1] if photo.filename else "jpg"
        filename = f"{prefix}_photo.{ext}"
        _save_file(photo, CLIPS_DIR / filename)
        clip.photo_path = filename

    session.add(clip)
    session.commit()
    session.refresh(clip)

    return _clip_response(clip, dog.name)


@router.get("", response_model=list[ClipResponse])
def list_clips(
    dog_id: Optional[int] = None,
    label: Optional[str] = None,
    media_type: Optional[str] = None,
    limit: int = 50,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    query = select(Clip, Dog).join(Dog).where(Dog.owner_id == user.id)
    if dog_id:
        query = query.where(Clip.dog_id == dog_id)
    if label:
        query = query.where(Clip.label == label)
    if media_type:
        query = query.where(Clip.media_type == media_type)
    query = query.order_by(Clip.created_at.desc()).limit(limit)

    results = session.exec(query).all()
    return [_clip_response(clip, dog.name) for clip, dog in results]


@router.get("/stats", response_model=StatsResponse)
def clip_stats(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    clips = session.exec(
        select(Clip, Dog).join(Dog).where(Dog.owner_id == user.id, Clip.purged == False)
    ).all()

    by_label: dict[str, int] = {}
    by_dog: dict[str, int] = {}
    by_media: dict[str, int] = {}
    processed = 0
    total_bytes = 0

    for clip, dog in clips:
        by_label[clip.label] = by_label.get(clip.label, 0) + 1
        by_dog[dog.name] = by_dog.get(dog.name, 0) + 1
        by_media[clip.media_type] = by_media.get(clip.media_type, 0) + 1
        if clip.processed:
            processed += 1
        for p in [clip.file_path, clip.video_path, clip.photo_path]:
            if p:
                fp = CLIPS_DIR / p
                if fp.exists():
                    total_bytes += fp.stat().st_size

    return StatsResponse(
        total=len(clips),
        by_label=by_label,
        by_dog=by_dog,
        by_media=by_media,
        processed=processed,
        pending=len(clips) - processed,
        disk_mb=round(total_bytes / 1024 / 1024, 2),
    )


@router.post("/purge")
def purge_processed(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    clips = session.exec(
        select(Clip, Dog).join(Dog).where(
            Dog.owner_id == user.id,
            Clip.processed == True,
            Clip.purged == False,
        )
    ).all()

    purged_count = 0
    freed_bytes = 0

    for clip, _ in clips:
        for p in [clip.file_path, clip.video_path, clip.photo_path]:
            if p:
                fp = CLIPS_DIR / p
                if fp.exists():
                    freed_bytes += fp.stat().st_size
                    fp.unlink()
        clip.purged = True
        clip.file_path = ""
        clip.video_path = None
        clip.photo_path = None
        session.add(clip)
        purged_count += 1

    session.commit()
    return {
        "purged": purged_count,
        "freed_mb": round(freed_bytes / 1024 / 1024, 2),
    }


def _save_file(upload: UploadFile, path: Path):
    with open(path, "wb") as f:
        shutil.copyfileobj(upload.file, f)


def _get_ext(filename: str | None, default: str) -> str:
    if filename and "." in filename:
        return filename.rsplit(".", 1)[-1].lower()
    return default


def _clip_response(clip: Clip, dog_name: str) -> ClipResponse:
    return ClipResponse(
        id=clip.id,
        dog_id=clip.dog_id,
        dog_name=dog_name,
        label=clip.label,
        media_type=clip.media_type,
        duration_ms=clip.duration_ms,
        has_video=bool(clip.video_path),
        has_photo=bool(clip.photo_path),
        processed=clip.processed,
        purged=clip.purged,
        created_at=clip.created_at.isoformat(),
    )
