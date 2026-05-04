import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional
from ..database import get_session
from ..models import User, Dog
from ..auth import get_current_user
from ..config import PHOTOS_DIR

router = APIRouter(prefix="/api/dogs", tags=["dogs"])


class DogResponse(BaseModel):
    id: int
    name: str
    breed: str
    photo_url: Optional[str]


@router.get("", response_model=list[DogResponse])
def list_dogs(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    dogs = session.exec(select(Dog).where(Dog.owner_id == user.id)).all()
    return [_dog_response(d) for d in dogs]


@router.post("", response_model=DogResponse, status_code=201)
def create_dog(
    name: str = Form(...),
    breed: str = Form(...),
    photo: Optional[UploadFile] = File(None),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    dog = Dog(name=name, breed=breed, owner_id=user.id)
    session.add(dog)
    session.commit()
    session.refresh(dog)

    if photo:
        ext = photo.filename.split(".")[-1] if photo.filename else "jpg"
        filename = f"dog_{dog.id}.{ext}"
        filepath = PHOTOS_DIR / filename
        with open(filepath, "wb") as f:
            shutil.copyfileobj(photo.file, f)
        dog.photo_path = filename
        session.add(dog)
        session.commit()
        session.refresh(dog)

    return _dog_response(dog)


@router.put("/{dog_id}/photo", response_model=DogResponse)
def update_photo(
    dog_id: int,
    photo: UploadFile = File(...),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    dog = session.exec(select(Dog).where(Dog.id == dog_id, Dog.owner_id == user.id)).first()
    if not dog:
        raise HTTPException(status_code=404, detail="Perro no encontrado")

    ext = photo.filename.split(".")[-1] if photo.filename else "jpg"
    filename = f"dog_{dog.id}.{ext}"
    filepath = PHOTOS_DIR / filename
    with open(filepath, "wb") as f:
        shutil.copyfileobj(photo.file, f)
    dog.photo_path = filename
    session.add(dog)
    session.commit()
    session.refresh(dog)
    return _dog_response(dog)


@router.delete("/{dog_id}", status_code=204)
def delete_dog(
    dog_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    dog = session.exec(select(Dog).where(Dog.id == dog_id, Dog.owner_id == user.id)).first()
    if not dog:
        raise HTTPException(status_code=404, detail="Perro no encontrado")
    if dog.photo_path:
        photo_file = PHOTOS_DIR / dog.photo_path
        if photo_file.exists():
            photo_file.unlink()
    session.delete(dog)
    session.commit()


def _dog_response(dog: Dog) -> DogResponse:
    photo_url = f"/uploads/photos/{dog.photo_path}" if dog.photo_path else None
    return DogResponse(id=dog.id, name=dog.name, breed=dog.breed, photo_url=photo_url)
