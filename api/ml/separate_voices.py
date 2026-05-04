"""
Paso 1: Separación de fuentes usando Demucs.
Separa la voz humana del sonido del perro en cada clip de audio.
Guarda las pistas separadas en separated/{clip_id}/
"""
import sqlite3
import subprocess
from pathlib import Path
from config import DB_PATH, CLIPS_DIR, SEPARATED_DIR


def get_unprocessed_clips() -> list[dict]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT id, file_path, video_path FROM clip WHERE processed = 0 AND purged = 0"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def separate_clip(clip_id: int, audio_path: Path):
    out_dir = SEPARATED_DIR / str(clip_id)
    if out_dir.exists():
        return out_dir

    subprocess.run([
        "python", "-m", "demucs",
        "--two-stems", "vocals",
        "-o", str(SEPARATED_DIR),
        "-n", "htdemucs",
        "--filename", "{stem}.{ext}",
        str(audio_path),
    ], check=True)

    # demucs outputs to separated/htdemucs/{filename}/vocals.wav & no_vocals.wav
    # move to our structure
    demucs_out = SEPARATED_DIR / "htdemucs" / audio_path.stem
    if demucs_out.exists():
        out_dir.mkdir(parents=True, exist_ok=True)
        for f in demucs_out.iterdir():
            f.rename(out_dir / f.name)
        demucs_out.rmdir()
        htdemucs_dir = SEPARATED_DIR / "htdemucs"
        if not any(htdemucs_dir.iterdir()):
            htdemucs_dir.rmdir()

    return out_dir


def run():
    clips = get_unprocessed_clips()
    if not clips:
        print("No hay clips sin procesar.")
        return

    print(f"Procesando {len(clips)} clips...")
    for clip in clips:
        audio_file = None
        if clip["file_path"]:
            audio_file = CLIPS_DIR / clip["file_path"]
        if not audio_file or not audio_file.exists():
            print(f"  Clip {clip['id']}: sin archivo de audio, saltando")
            continue

        print(f"  Clip {clip['id']}: separando {audio_file.name}...")
        try:
            separate_clip(clip["id"], audio_file)
            print(f"  Clip {clip['id']}: OK")
        except Exception as e:
            print(f"  Clip {clip['id']}: ERROR - {e}")

    print("Separación completa.")


if __name__ == "__main__":
    run()
