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


class ClipResponse(BaseModel):
    id: int
    dog_id: int
    dog_name: str
    label: str
    duration_ms: int
    processed: bool
    purged: bool
    created_at: str


class StatsResponse(BaseModel):
    total: int
    by_label: dict[str, int]
    by_dog: dict[str, int]
    processed: int
    pending: int
    disk_mb: float


@router.post("", response_model=ClipResponse, status_code=201)
def upload_clip(
    dog_id: int = Form(...),
    label: str = Form(...),
    duration_ms: int = Form(...),
    audio: UploadFile = File(...),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    dog = session.exec(select(Dog).where(Dog.id == dog_id, Dog.owner_id == user.id)).first()
    if not dog:
        raise HTTPException(status_code=404, detail="Perro no encontrado")

    valid_labels = {"bark", "whine", "growl", "howl", "pant"}
    if label not in valid_labels:
        raise HTTPException(status_code=400, detail=f"Label debe ser uno de: {valid_labels}")

    clip = Clip(dog_id=dog_id, label=label, duration_ms=duration_ms, file_path="")
    session.add(clip)
    session.commit()
    session.refresh(clip)

    ext = "webm"
    filename = f"{dog.name.lower()}_{label}_{clip.id}.{ext}"
    filepath = CLIPS_DIR / filename
    with open(filepath, "wb") as f:
        shutil.copyfileobj(audio.file, f)

    clip.file_path = filename
    session.add(clip)
    session.commit()
    session.refresh(clip)

    return _clip_response(clip, dog.name)


@router.get("", response_model=list[ClipResponse])
def list_clips(
    dog_id: Optional[int] = None,
    label: Optional[str] = None,
    limit: int = 50,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    query = select(Clip, Dog).join(Dog).where(Dog.owner_id == user.id)
    if dog_id:
        query = query.where(Clip.dog_id == dog_id)
    if label:
        query = query.where(Clip.label == label)
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
    processed = 0
    total_bytes = 0

    for clip, dog in clips:
        by_label[clip.label] = by_label.get(clip.label, 0) + 1
        by_dog[dog.name] = by_dog.get(dog.name, 0) + 1
        if clip.processed:
            processed += 1
        clip_path = CLIPS_DIR / clip.file_path
        if clip_path.exists():
            total_bytes += clip_path.stat().st_size

    return StatsResponse(
        total=len(clips),
        by_label=by_label,
        by_dog=by_dog,
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
        clip_path = CLIPS_DIR / clip.file_path
        if clip_path.exists():
            freed_bytes += clip_path.stat().st_size
            clip_path.unlink()
        clip.purged = True
        clip.file_path = ""
        session.add(clip)
        purged_count += 1

    session.commit()
    return {
        "purged": purged_count,
        "freed_mb": round(freed_bytes / 1024 / 1024, 2),
    }


def _clip_response(clip: Clip, dog_name: str) -> ClipResponse:
    return ClipResponse(
        id=clip.id,
        dog_id=clip.dog_id,
        dog_name=dog_name,
        label=clip.label,
        duration_ms=clip.duration_ms,
        processed=clip.processed,
        purged=clip.purged,
        created_at=clip.created_at.isoformat(),
    )
