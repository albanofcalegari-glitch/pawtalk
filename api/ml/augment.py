"""
Paso 2.5: Data augmentation via transformaciones de audio.
Para cada clip original, genera variantes (pitch shift, time stretch,
noise, volumen) y extrae features. Guarda .npz en features/
"""
import numpy as np
import librosa
from pathlib import Path
from config import (
    CLIPS_DIR, SEPARATED_DIR, FEATURES_DIR,
    SAMPLE_RATE, AUGMENTATIONS,
)
from extract_features import extract, load_audio, _resolve_wav, get_clips


def apply_augmentation(y: np.ndarray, sr: int, params: dict) -> np.ndarray:
    y_aug = y.copy()
    if "pitch_steps" in params:
        y_aug = librosa.effects.pitch_shift(y_aug, sr=sr, n_steps=params["pitch_steps"])
    if "stretch_rate" in params:
        y_aug = librosa.effects.time_stretch(y_aug, rate=params["stretch_rate"])
    if "noise_std" in params:
        rng = np.random.default_rng()
        noise = rng.normal(0, params["noise_std"], len(y_aug)).astype(y_aug.dtype)
        y_aug = y_aug + noise
    if "volume" in params:
        y_aug = y_aug * params["volume"]
    return y_aug


def run():
    clips = get_clips()
    if not clips:
        print("No hay clips para augmentar.")
        return

    created = 0
    skipped = 0
    errors = 0

    for clip in clips:
        orig_npz = FEATURES_DIR / f"{clip['id']}.npz"
        if not orig_npz.exists():
            continue

        separated_path = SEPARATED_DIR / str(clip["id"]) / "no_vocals.wav"
        raw_path = _resolve_wav(clip)
        if not raw_path and not separated_path.exists():
            continue

        audio_path = separated_path if separated_path.exists() else raw_path
        y = load_audio(audio_path)
        if y is None or len(y) < SAMPLE_RATE * 0.3:
            continue

        orig_data = np.load(orig_npz, allow_pickle=True)

        for aug_name, params in AUGMENTATIONS:
            aug_path = FEATURES_DIR / f"{clip['id']}_aug_{aug_name}.npz"
            if aug_path.exists():
                skipped += 1
                continue

            try:
                y_aug = apply_augmentation(y, SAMPLE_RATE, params)
                features = extract(y_aug)
                feature_vector = np.concatenate(list(features.values()))

                np.savez_compressed(
                    aug_path,
                    features=feature_vector,
                    label=str(orig_data["label"]),
                    dog_id=int(orig_data["dog_id"]),
                    clip_id=int(orig_data["clip_id"]),
                    source="augmented",
                    augmentation=aug_name,
                    has_human_voice=bool(orig_data.get("has_human_voice", False)),
                )
                created += 1
            except Exception as e:
                print(f"  Clip {clip['id']} aug={aug_name}: error — {e}")
                errors += 1

    print(f"Augmentation completa. Creados: {created}, ya existían: {skipped}", end="")
    if errors:
        print(f", errores: {errors}")
    else:
        print()


if __name__ == "__main__":
    run()
