import os
import pickle
import logging
from pathlib import Path

import numpy as np
from PIL import Image, UnidentifiedImageError
from flask import Flask, render_template, request, jsonify

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model"
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_IMAGE_BYTES
logging.basicConfig(level=logging.INFO)

def load_pickle(filename):
    path = MODEL_DIR / filename
    if not path.exists():
        return None
    # Only load pickle files that you created and trust.
    with path.open("rb") as handle:
        return pickle.load(handle)

# Filenames match the save paths used in the uploaded notebook:
# picklescovid19/scale.pkl, picklescovid19/pca.pkl, picklescovid19/bag.pkl
scaler = load_pickle("scale.pkl")
pca = load_pickle("pca.pkl")
model = load_pickle("bag.pkl")

def model_ready():
    return scaler is not None and pca is not None and model is not None

@app.get("/")
def index():
    return render_template("index.html", model_ready=model_ready())

@app.get("/api/health")
def health():
    return jsonify({
        "status": "ready" if model_ready() else "setup_required",
        "model_loaded": model_ready(),
        "classes": [str(c) for c in getattr(model, "classes_", [])] if model is not None else []
    })

@app.post("/predict")
def predict():
    if not model_ready():
        return jsonify({
            "error": "Model files are missing. Add scale.pkl, pca.pkl, and bag.pkl to the model/ folder, then restart the app."
        }), 503

    uploaded = request.files.get("image")
    if uploaded is None or not uploaded.filename:
        return jsonify({"error": "Choose a chest X-ray image first."}), 400

    suffix = Path(uploaded.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "Unsupported file type. Upload PNG, JPG, JPEG, WEBP, or BMP."}), 400

    try:
        # Match the notebook preprocessing exactly: grayscale, 64x64, flattened.
        image = Image.open(uploaded.stream).convert("L").resize((64, 64))
        pixels = np.asarray(image, dtype=np.float64).reshape(1, -1)

        expected_features = getattr(scaler, "n_features_in_", pixels.shape[1])
        if pixels.shape[1] != expected_features:
            return jsonify({
                "error": f"Preprocessing mismatch: scaler expects {expected_features} features, but the uploaded image creates {pixels.shape[1]}. Check that these are the pickle files from the supplied notebook."
            }), 500

        scaled = scaler.transform(pixels)
        reduced = pca.transform(scaled)
        predicted = model.predict(reduced)[0]

        # BaggingClassifier exposes probabilities only when its base estimator supports them.
        confidence = None
        try:
            probabilities = model.predict_proba(reduced)[0]
            confidence = round(float(np.max(probabilities)) * 100, 1)
        except (AttributeError, ValueError, TypeError):
            pass

        return jsonify({
            "prediction": str(predicted),
            "confidence": confidence,
            "classes": [str(c) for c in getattr(model, "classes_", [])],
            "note": "Experimental model output only. This is not a medical diagnosis."
        })

    except (UnidentifiedImageError, OSError):
        return jsonify({"error": "This file could not be read as an image. Try a valid chest X-ray image."}), 400
    except Exception:
        app.logger.exception("Prediction failed")
        return jsonify({
            "error": "Prediction failed. Confirm the pickle files were exported from this notebook and that the installed scikit-learn version is compatible."
        }), 500

@app.errorhandler(413)
def too_large(_error):
    return jsonify({"error": "Image is too large. Maximum upload size is 10 MB."}), 413

if __name__ == "__main__":
    # Debug is disabled by default; enable only during local development if needed.
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=False)
