"""
Paso 3: Entrenamiento del clasificador.
Carga features (originales + augmentados), entrena con class weighting,
y guarda el mejor modelo en models/
"""
import sqlite3
import numpy as np
import joblib
from pathlib import Path
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.model_selection import cross_val_score, StratifiedKFold, LeaveOneOut
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report
from config import DB_PATH, FEATURES_DIR, MODELS_DIR, LABELS


def load_dataset() -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    features_list = []
    labels_list = []
    dog_ids = []
    is_augmented = []

    for npz_path in sorted(FEATURES_DIR.glob("*.npz")):
        data = np.load(npz_path, allow_pickle=True)
        label = str(data["label"])
        if label not in LABELS:
            continue
        features_list.append(data["features"])
        labels_list.append(label)
        dog_ids.append(int(data["dog_id"]))
        is_augmented.append("aug" in npz_path.stem)

    if not features_list:
        return np.array([]), np.array([]), np.array([]), np.array([])

    return (
        np.array(features_list),
        np.array(labels_list),
        np.array(dog_ids),
        np.array(is_augmented),
    )


def compute_sample_weights(y: np.ndarray) -> np.ndarray:
    classes, counts = np.unique(y, return_counts=True)
    total = len(y)
    n_classes = len(classes)
    weight_map = {c: total / (n_classes * count) for c, count in zip(classes, counts)}
    return np.array([weight_map[label] for label in y])


def run():
    X, y, dog_ids, is_aug = load_dataset()

    if len(X) == 0:
        print("No hay features extraídas. Ejecutá primero extract_features.py")
        return

    n_original = (~is_aug).sum()
    n_augmented = is_aug.sum()
    n_classes = len(set(y))
    print(f"Dataset: {len(X)} muestras ({n_original} originales + {n_augmented} augmentadas), {n_classes} clases")
    for label in LABELS:
        orig = ((y == label) & ~is_aug).sum()
        aug = ((y == label) & is_aug).sum()
        if orig + aug > 0:
            print(f"  {label}: {orig} + {aug} aug = {orig + aug}")

    if n_original < 20:
        print(f"\nPocas muestras originales ({n_original}). Modelo preliminar.\n")

    le = LabelEncoder()
    le.fit(LABELS)
    y_encoded = le.transform(y)

    sample_weights = compute_sample_weights(y)

    model = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", GradientBoostingClassifier(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.1,
            min_samples_leaf=2,
            subsample=0.8,
            random_state=42,
        )),
    ])

    min_class_count = min((y == label).sum() for label in set(y))

    if n_classes >= 2 and min_class_count >= 2:
        n_splits = min(5, min_class_count)
        cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        scores = cross_val_score(model, X, y_encoded, cv=cv, scoring="f1_weighted")
        print(f"Cross-validation ({n_splits}-fold, F1 weighted): {scores.mean():.3f} ± {scores.std():.3f}")

    model.fit(X, y_encoded, clf__sample_weight=sample_weights)

    model_path = MODELS_DIR / "classifier_v1.joblib"
    le_path = MODELS_DIR / "label_encoder_v1.joblib"
    joblib.dump(model, model_path)
    joblib.dump(le, le_path)

    print(f"\nModelo guardado en {model_path}")
    print(f"Label encoder guardado en {le_path}")

    y_pred = model.predict(X)
    orig_mask = ~is_aug
    if orig_mask.sum() > 0:
        present_labels = sorted(set(y_encoded[orig_mask]) | set(y_pred[orig_mask]))
        present_names = [le.classes_[i] for i in present_labels]
        print(f"\nReporte en originales ({orig_mask.sum()} muestras):")
        print(classification_report(
            y_encoded[orig_mask], y_pred[orig_mask],
            labels=present_labels, target_names=present_names,
        ))

    mark_processed()


def mark_processed():
    clip_ids = set()
    for npz_path in FEATURES_DIR.glob("*.npz"):
        data = np.load(npz_path, allow_pickle=True)
        clip_ids.add(int(data["clip_id"]))

    if not clip_ids:
        return

    conn = sqlite3.connect(DB_PATH)
    placeholders = ",".join("?" * len(clip_ids))
    conn.execute(f"UPDATE clip SET processed = 1 WHERE id IN ({placeholders})", list(clip_ids))
    conn.commit()
    conn.close()
    print(f"{len(clip_ids)} clips marcados como procesados.")


if __name__ == "__main__":
    run()
