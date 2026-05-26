"""
Pipeline nocturno: procesa clips nuevos y re-entrena el modelo.
Diseñado para correr via cron en el VPS.
"""
import sys
import os
import sqlite3
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))
from config import DB_PATH


def mark_photo_clips_processed():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute(
        "UPDATE clip SET processed = 1 "
        "WHERE processed = 0 AND media_type = 'photo'"
    )
    count = cur.rowcount
    conn.commit()
    conn.close()
    return count


def main():
    print(f"\n{'='*50}")
    print(f"  PawTalk ML — Pipeline nocturno")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*50}\n")

    print("[1/5] Marcando fotos como procesadas...")
    n = mark_photo_clips_processed()
    print(f"  {n} fotos marcadas." if n else "  Sin fotos pendientes.")

    print()
    print("[2/5] Separación de voces (Demucs)...")
    try:
        import separate_voices
        separate_voices.run()
    except ImportError:
        print("  Demucs no instalado, usando audio crudo.")
    except Exception as e:
        print(f"  Error en separación: {e}. Continuando con audio crudo.")

    print()
    print("[3/5] Extracción de features...")
    import extract_features
    extract_features.run()

    print()
    print("[4/5] Data augmentation...")
    import augment
    augment.run()

    print()
    print("[5/5] Entrenamiento del modelo...")
    import train_model
    train_model.run()

    print(f"\nPipeline completo — {datetime.now().strftime('%H:%M:%S')}")


if __name__ == "__main__":
    main()
