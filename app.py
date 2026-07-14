"""
app.py — AI ATS Resume Ranking System (Flask)
==============================================

Enterprise web frontend for the existing AI-powered ATS pipeline. This file
does NOT contain any scoring, extraction, comparison, or ranking logic — it
only wires up routes, templates, and the unmodified pipeline modules living
in `core/` (resume_extractor_gemini.py, job_description_parser.py,
compare_resume_and_jd.py, ats_score_calculator.py, ranking.py, exporter.py).

Run with:
    python app.py
"""

from __future__ import annotations

import config  # noqa: F401  (import first: puts core/ on sys.path, loads .env)
from flask import Flask, render_template

from config import Config
from database import ensure_schema
from routes import register_blueprints


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    register_blueprints(app)

    @app.errorhandler(404)
    def not_found(e):
        return render_template("error.html", code=404, message="Page not found."), 404

    @app.errorhandler(500)
    def server_error(e):
        return render_template("error.html", code=500, message="Something went wrong on our end."), 500

    @app.errorhandler(413)
    def too_large(e):
        return render_template("error.html", code=413, message="Upload too large. Please split into smaller batches."), 413

    @app.context_processor
    def inject_globals():
        return {"app_name": "AI-Powered ATS"}

    with app.app_context():
        try:
            ensure_schema()
        except Exception as e:  # noqa: BLE001
            app.logger.warning(
                "Could not verify/create database schema at startup (%s). "
                "Check DB_PASSWORD in .env and that PostgreSQL is running. "
                "The app will still start; individual requests will show errors until this is fixed.",
                e,
            )

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
