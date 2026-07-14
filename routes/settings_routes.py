from __future__ import annotations

from flask import Blueprint, render_template, current_app

settings_bp = Blueprint("settings", __name__)


@settings_bp.route("/settings")
def settings_page():
    config_status = {
        "gemini_api_key_set": bool(current_app.config.get("GEMINI_API_KEY")),
        "db_password_set": bool(current_app.config.get("DB_PASSWORD")),
        "max_upload_mb": round(current_app.config.get("MAX_CONTENT_LENGTH", 0) / (1024 * 1024)),
        "allowed_resume_types": sorted(current_app.config.get("ALLOWED_RESUME_EXTENSIONS", [])),
        "allowed_jd_types": sorted(current_app.config.get("ALLOWED_JD_EXTENSIONS", [])),
    }
    return render_template("settings.html", active="settings", config_status=config_status)
