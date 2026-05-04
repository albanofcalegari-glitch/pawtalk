from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File
from pydantic import BaseModel
from ..auth import get_current_user
from ..models import User
from ..config import BASE_DIR

router = APIRouter(prefix="/api/ml", tags=["ml"])

ML_DIR = BASE_DIR / "ml"
MODELS_DIR = ML_DIR / "models"
FEATURES_DIR = ML_DIR / "features"


class MLStatus(BaseModel):
    model_available: bool
    total_features: int
    model_file: str | None


class PredictionResult(BaseModel):
    label: str
    confidence: float
    probabilities: dict[str, float]


@router.get("/status", response_model=MLStatus)
def ml_status(user: User = Depends(get_current_user)):
    model_path = MODELS_DIR / "classifier_v1.joblib"
    features_count = len(list(FEATURES_DIR.glob("*.npz"))) if FEATURES_DIR.exists() else 0
    return MLStatus(
        model_available=model_path.exists(),
        total_features=features_count,
        model_file=model_path.name if model_path.exists() else None,
    )


@router.post("/predict", response_model=PredictionResult)
async def predict(
    audio: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    import sys
    sys.path.insert(0, str(ML_DIR))
    from predict import predict_audio

    audio_bytes = await audio.read()
    result = predict_audio(audio_bytes)

    if result is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Modelo no disponible. Entrená primero con el pipeline.")

    return PredictionResult(**result)
