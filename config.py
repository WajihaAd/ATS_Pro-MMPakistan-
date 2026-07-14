"""
config.py

Central configuration for the Flask app. Also responsible for putting
`core/` on sys.path *before anything else runs*, because the existing
business-logic modules (compare_resume_and_jd.py, ats_score_calculator.py,
resume_extractor_gemini.py, job_description_parser.py, ranking.py) use flat,
same-directory imports like:

    from ats_score_calculator import evaluate_candidate

exactly as they did when they all lived next to the old Streamlit app.py.
Rather than touch a single line inside those files, we make `core/` behave
like the project root did before, by adding it to sys.path. This is the only
"trick" required to reuse the modules completely unmodified.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
CORE_DIR = BASE_DIR / "core"

if str(CORE_DIR) not in sys.path:
    sys.path.insert(0, str(CORE_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BASE_DIR / ".env")


class Config:
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "dev-secret-key-change-me")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    MAX_CONTENT_LENGTH = 25 * 1024 * 1024  # 25 MB total upload cap
    ALLOWED_RESUME_EXTENSIONS = {"pdf", "docx", "txt", "md"}
    ALLOWED_JD_EXTENSIONS = {"pdf", "docx", "txt", "md"}
    UPLOAD_TMP_DIR = BASE_DIR / "static" / "_tmp_uploads"

    JSONIFY_PRETTYPRINT_REGULAR = False


Config.UPLOAD_TMP_DIR.mkdir(parents=True, exist_ok=True)
