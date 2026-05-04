"""
Predicción con modelo entrenado.
Usado por el endpoint /api/ml/predict
"""
import numpy as np
import librosa
import joblib
from pathlib import Path
from config import MODELS_DIR, SAMPLE_RATE, N_MFCC, HOP_LENGTH, MAX_DURATION_S

_model = None
_le = None


def _load_model():
    global _model, _le
    model_path = MODELS_DIR / "classifier_v1.joblib"
    le_path = MODELS_DIR / "label_encoder_v1.joblib"
    if not model_path.exists():
        return False
    _model = joblib.load(model_path)
    _le = joblib.load(le_path)
    return True


def predict_audio(audio_bytes: bytes) -> dict | None:
    if _model is None and not _load_model():
        return None

    import io
    import soundfile as sf

    try:
        y, sr = sf.read(io.BytesIO(audio_bytes))
        if sr != SAMPLE_RATE:
            y = librosa.resample(y, orig_sr=sr, target_sr=SAMPLE_RATE)
        if len(y.shape) > 1:
            y = y.mean(axis=1)
    except Exception:
        return None

    y = y[:SAMPLE_RATE * MAX_DURATION_S]

    mfcc = librosa.feature.mfcc(y=y, sr=SAMPLE_RATE, n_mfcc=N_MFCC, hop_length=HOP_LENGTH)
    mfcc_delta = librosa.feature.delta(mfcc)
    spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=SAMPLE_RATE, hop_length=HOP_LENGTH)
    spectral_contrast = librosa.feature.spectral_contrast(y=y, sr=SAMPLE_RATE, hop_length=HOP_LENGTH)
    zcr = librosa.feature.zero_crossing_rate(y, hop_length=HOP_LENGTH)
    chroma = librosa.feature.chroma_stft(y=y, sr=SAMPLE_RATE, hop_length=HOP_LENGTH)
    rms = librosa.feature.rms(y=y, hop_length=HOP_LENGTH)

    def stats(feat):
        return np.concatenate([feat.mean(axis=1), feat.std(axis=1)])

    feature_vector = np.concatenate([
        stats(mfcc), stats(mfcc_delta), stats(spectral_centroid),
        stats(spectral_contrast), stats(zcr), stats(chroma), stats(rms),
    ]).reshape(1, -1)

    proba = _model.predict_proba(feature_vector)[0]
    pred_idx = np.argmax(proba)
    label = _le.inverse_transform([pred_idx])[0]

    return {
        "label": label,
        "confidence": float(proba[pred_idx]),
        "probabilities": {_le.inverse_transform([i])[0]: float(p) for i, p in enumerate(proba)},
    }
