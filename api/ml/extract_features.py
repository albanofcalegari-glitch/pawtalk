"""
Paso 2: Extracción de features de audio.
Genera MFCCs, espectral centroid, ZCR, chroma, spectral contrast,
bandwidth, flatness y rolloff para cada clip.
Guarda un .npz por clip en features/
"""
import sqlite3
import numpy as np
import librosa
from pathlib import Path
from config import (
    DB_PATH, CLIPS_DIR, SEPARATED_DIR, FEATURES_DIR,
    LABELS, SAMPLE_RATE, N_MFCC, HOP_LENGTH, MAX_DURATION_S,
    FEATURE_VERSION,
)


VERSION_FILE = FEATURES_DIR / ".version"


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
    spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=SAMPLE_RATE, hop_length=HOP_LENGTH)
    spectral_flatness = librosa.feature.spectral_flatness(y=y, hop_length=HOP_LENGTH)
    spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=SAMPLE_RATE, hop_length=HOP_LENGTH)

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
        "spectral_bandwidth": stats(spectral_bandwidth),
        "spectral_flatness": stats(spectral_flatness),
        "spectral_rolloff": stats(spectral_rolloff),
    }


def _resolve_wav(clip: dict) -> Path | None:
    if clip["file_path"]:
        wav_from_fp = CLIPS_DIR / clip["file_path"]
        if wav_from_fp.exists() and wav_from_fp.suffix == ".wav":
            return wav_from_fp
        wav_sibling = wav_from_fp.with_suffix(".wav")
        if wav_sibling.exists():
            return wav_sibling
        if wav_from_fp.exists():
            return wav_from_fp

    if clip["video_path"]:
        video_p = CLIPS_DIR / clip["video_path"]
        wav_from_video = video_p.with_suffix(".wav")
        if wav_from_video.exists():
            return wav_from_video

    return None


def get_clips() -> list[dict]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT id, file_path, video_path, label, dog_id "
        "FROM clip WHERE purged = 0 AND media_type != 'photo'"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def check_version():
    if VERSION_FILE.exists():
        stored = VERSION_FILE.read_text().strip()
        if stored == str(FEATURE_VERSION):
            return True
    return False


def clear_features():
    count = 0
    for f in FEATURES_DIR.glob("*.npz"):
        f.unlink()
        count += 1
    VERSION_FILE.write_text(str(FEATURE_VERSION))
    return count


def run():
    if not check_version():
        removed = clear_features()
        if removed:
            print(f"  Feature version cambió → eliminados {removed} .npz antiguos")

    clips = get_clips()
    if not clips:
        print("No hay clips con audio.")
        return

    processed = 0
    skipped = 0
    print(f"Evaluando {len(clips)} clips con audio/video...")
    for clip in clips:
        out_path = FEATURES_DIR / f"{clip['id']}.npz"
        if out_path.exists():
            skipped += 1
            continue

        separated_path = SEPARATED_DIR / str(clip["id"]) / "no_vocals.wav"
        raw_path = _resolve_wav(clip)

        if not raw_path and not separated_path.exists():
            print(f"  Clip {clip['id']}: sin archivo de audio, saltando")
            continue

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
            version=FEATURE_VERSION,
        )
        processed += 1
        print(f"  Clip {clip['id']}: {len(feature_vector)} features ({audio_path.name})")

    print(f"Extracción completa. Procesados: {processed}, ya existían: {skipped}")


if __name__ == "__main__":
    run()
