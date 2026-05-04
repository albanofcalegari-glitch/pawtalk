"""
Paso 2: Extracción de features de audio.
Genera MFCCs, espectral centroid, ZCR, chroma, y spectral contrast
para cada clip. Guarda un .npz por clip en features/
"""
import sqlite3
import numpy as np
import librosa
from pathlib import Path
from config import (
    DB_PATH, CLIPS_DIR, SEPARATED_DIR, FEATURES_DIR,
    LABELS, SAMPLE_RATE, N_MFCC, HOP_LENGTH, MAX_DURATION_S,
)


def load_audio(path: Path) -> np.ndarray | None:
    try:
        y, _ = librosa.load(str(path), sr=SAMPLE_RATE, duration=MAX_DURATION_S)
        return y
    except Exception:
        return None


def extract(y: np.ndarray) -> dict[str, np.ndarray]:
    mfcc = librosa.feature.mfcc(y=y, sr=SAMPLE_RATE, n_mfcc=N_MFCC, hop_length=HOP_LENGTH)
    mfcc_delta = librosa.feature.delta(mfcc)
    spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=SAMPLE_RATE, hop_length=HOP_LENGTH)
    spectral_contrast = librosa.feature.spectral_contrast(y=y, sr=SAMPLE_RATE, hop_length=HOP_LENGTH)
    zcr = librosa.feature.zero_crossing_rate(y, hop_length=HOP_LENGTH)
    chroma = librosa.feature.chroma_stft(y=y, sr=SAMPLE_RATE, hop_length=HOP_LENGTH)
    rms = librosa.feature.rms(y=y, hop_length=HOP_LENGTH)

    # Stats: mean + std per feature across time
    def stats(feat):
        return np.concatenate([feat.mean(axis=1), feat.std(axis=1)])

    return {
        "mfcc": stats(mfcc),
        "mfcc_delta": stats(mfcc_delta),
        "spectral_centroid": stats(spectral_centroid),
        "spectral_contrast": stats(spectral_contrast),
        "zcr": stats(zcr),
        "chroma": stats(chroma),
        "rms": stats(rms),
    }


def get_clips() -> list[dict]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT id, file_path, label, dog_id FROM clip WHERE purged = 0 AND file_path != ''"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def run():
    clips = get_clips()
    if not clips:
        print("No hay clips con audio.")
        return

    print(f"Extrayendo features de {len(clips)} clips...")
    for clip in clips:
        out_path = FEATURES_DIR / f"{clip['id']}.npz"
        if out_path.exists():
            continue

        # Prefer separated dog-only audio if available
        separated_path = SEPARATED_DIR / str(clip["id"]) / "no_vocals.wav"
        raw_path = CLIPS_DIR / clip["file_path"]

        audio_path = separated_path if separated_path.exists() else raw_path
        y = load_audio(audio_path)
        if y is None or len(y) < SAMPLE_RATE * 0.3:
            print(f"  Clip {clip['id']}: audio muy corto o inválido, saltando")
            continue

        features = extract(y)
        feature_vector = np.concatenate(list(features.values()))

        np.savez_compressed(
            out_path,
            features=feature_vector,
            label=clip["label"],
            dog_id=clip["dog_id"],
            clip_id=clip["id"],
            source="separated" if separated_path.exists() else "raw",
            has_human_voice=separated_path.exists(),
        )
        print(f"  Clip {clip['id']}: {len(feature_vector)} features extraídas ({audio_path.name})")

    print("Extracción completa.")


if __name__ == "__main__":
    run()
