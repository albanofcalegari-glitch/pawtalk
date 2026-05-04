"""
Paso 3: Entrenamiento del clasificador.
Carga features, entrena un modelo y lo guarda en models/
"""
import sqlite3
import numpy as np
import joblib
from pathlib import Path
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report
from config import DB_PATH, FEATURES_DIR, MODELS_DIR, LABELS


def load_dataset() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    features_list = []
    labels_list = []
    dog_ids = []

    for npz_path in sorted(FEATURES_DIR.glob("*.npz")):
        data = np.load(npz_path, allow_pickle=True)
        label = str(data["label"])
        if label not in LABELS:
            continue
        features_list.append(data["features"])
        labels_list.append(label)
        dog_ids.append(int(data["dog_id"]))

    if not features_list:
        return np.array([]), np.array([]), np.array([])

    return np.array(features_list), np.array(labels_list), np.array(dog_ids)


def run():
    X, y, dog_ids = load_dataset()

    if len(X) == 0:
        print("No hay features extraídas. Ejecutá primero extract_features.py")
        return

    print(f"Dataset: {len(X)} muestras, {len(set(y))} clases")
    for label in LABELS:
        count = (y == label).sum()
        print(f"  {label}: {count}")

    if len(X) < 20:
        print(f"\nMuy pocas muestras ({len(X)}). Se necesitan ~50+ por clase para resultados útiles.")
        print("Entrenando modelo preliminar de todas formas...\n")

    le = LabelEncoder()
    le.fit(LABELS)
    y_encoded = le.transform(y)

    model = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", GradientBoostingClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.1,
            random_state=42,
        )),
    ])

    # Cross-validation si hay suficientes datos
    min_class_count = min((y == label).sum() for label in set(y))
    n_splits = min(5, min_class_count) if min_class_count >= 2 else 2

    if len(set(y)) >= 2 and min_class_count >= 2:
        cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        scores = cross_val_score(model, X, y_encoded, cv=cv, scoring="accuracy")
        print(f"Cross-validation ({n_splits}-fold): {scores.mean():.3f} ± {scores.std():.3f}")

    # Entrenar modelo final con todos los datos
    model.fit(X, y_encoded)

    # Guardar modelo + label encoder
    model_path = MODELS_DIR / "classifier_v1.joblib"
    le_path = MODELS_DIR / "label_encoder_v1.joblib"
    joblib.dump(model, model_path)
    joblib.dump(le, le_path)

    print(f"\nModelo guardado en {model_path}")
    print(f"Label encoder guardado en {le_path}")

    # Reporte en training set (referencia, no evaluación real)
    y_pred = model.predict(X)
    print(f"\nReporte en training set (referencia):")
    print(classification_report(y_encoded, y_pred, target_names=le.classes_))

    # Marcar clips como procesados
    mark_processed()


def mark_processed():
    clip_ids = []
    for npz_path in FEATURES_DIR.glob("*.npz"):
        data = np.load(npz_path, allow_pickle=True)
        clip_ids.append(int(data["clip_id"]))

    if not clip_ids:
        return

    conn = sqlite3.connect(DB_PATH)
    placeholders = ",".join("?" * len(clip_ids))
    conn.execute(f"UPDATE clip SET processed = 1 WHERE id IN ({placeholders})", clip_ids)
    conn.commit()
    conn.close()
    print(f"\n{len(clip_ids)} clips marcados como procesados.")


if __name__ == "__main__":
    run()
