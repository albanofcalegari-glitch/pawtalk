"""
Pipeline completo: separa voces → extrae features → entrena modelo.
Ejecutar: python pipeline.py [--skip-separation]
"""
import sys


def run(skip_separation=False):
    if not skip_separation:
        print("=" * 50)
        print("PASO 1: Separación de voces (Demucs)")
        print("=" * 50)
        try:
            import separate_voices
            separate_voices.run()
        except ImportError:
            print("Demucs no instalado. Saltando separación (se usará audio crudo).")
        except Exception as e:
            print(f"Error en separación: {e}. Continuando con audio crudo.")
    else:
        print("Saltando separación de voces.")

    print()
    print("=" * 50)
    print("PASO 2: Extracción de features")
    print("=" * 50)
    import extract_features
    extract_features.run()

    print()
    print("=" * 50)
    print("PASO 3: Entrenamiento del modelo")
    print("=" * 50)
    import train_model
    train_model.run()


if __name__ == "__main__":
    skip = "--skip-separation" in sys.argv
    run(skip_separation=skip)
