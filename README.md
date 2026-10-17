# RADIA — COVID-19 Chest X-ray Classification Website

A complete Flask website for your uploaded notebook's trained **StandardScaler → PCA → BaggingClassifier(SVC)** pipeline. It includes a custom dark radiology-lab frontend, image preview, drag-and-drop upload, loading state, error handling, and prediction output.

> **Medical disclaimer:** This is an educational research prototype, not a medical device or diagnostic tool. Do not use predictions for clinical decisions.

## 1. Project structure

```text
radia_covid_xray_website/
├── app.py
├── requirements.txt
├── README.md
├── model/
│   ├── scale.pkl          # copy from your notebook output folder
│   ├── pca.pkl            # copy from your notebook output folder
│   └── bag.pkl            # copy from your notebook output folder
├── templates/
│   └── index.html
└── static/
    ├── style.css
    └── script.js
```

## 2. Add your trained model files

Your notebook saves these files:

```python
pickle.dump(scale, open('picklescovid19/scale.pkl', 'wb'))
pickle.dump(pca, open('picklescovid19/pca.pkl', 'wb'))
pickle.dump(bag, open('picklescovid19/bag.pkl', 'wb'))
```

Copy those three files into this website's `model/` directory and keep their names exactly as shown. The notebook itself does not contain the actual pickle artifacts, so they must be copied from the computer where you trained/saved the model.

If your files are currently in `picklescovid19/`, copy them from there into `model/`.

## 3. Install dependencies

Open this project folder in VS Code and run in the terminal:

```bash
python -m venv .venv
```

Windows PowerShell:
```powershell
.\.venv\Scripts\Activate.ps1
```

Windows Command Prompt:
```bat
.venv\Scripts\activate
```

Then install:
```bash
python -m pip install -r requirements.txt
```

### Version compatibility

Pickle files are Python-version and library-version dependent. Install the same scikit-learn version that was used when the model files were created. In the training notebook, check:

```python
import sklearn
print(sklearn.__version__)
```

## 4. Start the website

```bash
python app.py
```

Open **http://127.0.0.1:5000** in your browser.

The top-right status indicates whether the three model files were found. If files are missing, the interface will still open and the prediction endpoint will return a setup message.

## 5. How prediction works

For every uploaded image, the backend:
1. Converts it to grayscale (`L`).
2. Resizes it to `64 × 64`.
3. Flattens it into 4,096 pixel values.
4. Applies the saved scaler.
5. Applies the saved PCA transformation.
6. Predicts with the saved BaggingClassifier.

This mirrors the image preprocessing and pipeline order shown in your notebook. It assumes the saved scaler was fitted on the raw flattened pixel columns in the same order.

## 6. Important model notes

- Your notebook creates labels from filenames: filenames containing `covid` become `covid`; all others become `non_covid`. Verify this labeling rule against your dataset before relying on results.
- In the notebook, scaling and PCA are fitted before the train/test split. This creates data leakage in evaluation. For a future model version, split first and fit scaler/PCA only on the training split.
- The score displayed by the website is the maximum `predict_proba` output when supported. It is not a medically calibrated probability.
- Only load pickle files you created and trust. Pickle loading can execute code.
- The upload is processed in memory by this app; no image-gallery or database storage has been implemented.

## 7. Deploying

For a Python host such as Render:
- Push the project to a private or public GitHub repository.
- Add your three trusted pickle files to the deployment environment (avoid publishing them publicly if you don't want to distribute your model).
- Build/install command: `pip install -r requirements.txt`
- Start command: `gunicorn app:app`

Ensure the host has enough memory for the model and matches the model's Python/scikit-learn environment. The app binds to the host-provided `PORT` variable when run directly; Gunicorn handles the production server.

## 8. API

`GET /api/health` returns whether model artifacts loaded successfully.

`POST /predict` accepts multipart form data with a file field named `image` and returns JSON such as:

```json
{
  "prediction": "non_covid",
  "confidence": 81.2,
  "classes": ["covid", "non_covid"],
  "note": "Experimental model output only. This is not a medical diagnosis."
}
```
