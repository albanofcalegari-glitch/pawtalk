from pathlib import Path

ML_DIR = Path(__file__).resolve().parent
API_DIR = ML_DIR.parent
DB_PATH = API_DIR / "pawtalk.db"
CLIPS_DIR = API_DIR / "uploads" / "clips"
PHOTOS_DIR = API_DIR / "uploads" / "photos"

PROCESSED_DIR = ML_DIR / "processed"
FEATURES_DIR = ML_DIR / "features"
MODELS_DIR = ML_DIR / "models"
SEPARATED_DIR = ML_DIR / "separated"

for d in [PROCESSED_DIR, FEATURES_DIR, MODELS_DIR, SEPARATED_DIR]:
    d.mkdir(parents=True, exist_ok=True)

LABELS = [
    "bark", "whine", "growl", "howl", "pant",
    "playing", "sitting", "lying", "eating", "sleeping",
    "alert", "relaxed", "walking", "other",
]
SAMPLE_RATE = 16000
N_MFCC = 40
HOP_LENGTH = 512
MAX_DURATION_S = 10
FEATURE_VERSION = 2

AUGMENTATIONS = [
    ("pitch_up", {"pitch_steps": 2}),
    ("pitch_down", {"pitch_steps": -2}),
    ("faster", {"stretch_rate": 1.15}),
    ("slower", {"stretch_rate": 0.85}),
    ("noisy", {"noise_std": 0.005}),
]
