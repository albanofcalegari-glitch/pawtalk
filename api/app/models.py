from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    name: str
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    dogs: list["Dog"] = Relationship(back_populates="owner")


class Dog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    breed: str
    photo_path: Optional[str] = None
    owner_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    owner: Optional[User] = Relationship(back_populates="dogs")
    clips: list["Clip"] = Relationship(back_populates="dog")


class Clip(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    dog_id: int = Field(foreign_key="dog.id")
    label: str  # bark, whine, growl, howl, pant
    file_path: str
    duration_ms: int
    processed: bool = Field(default=False)
    purged: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    dog: Optional[Dog] = Relationship(back_populates="clips")
