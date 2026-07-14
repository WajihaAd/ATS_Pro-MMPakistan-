from __future__ import annotations

from flask import Blueprint, render_template, request, jsonify, current_app

from services import pipeline_service as svc
from extract_helper import extract_text_from_upload, allowed_file

jd_bp = Blueprint("jd", __name__)


@jd_bp.route("/upload_job")
def upload_job_page():
    return render_template("upload_job.html", active="upload_job")


@jd_bp.route("/api/jd/extract", methods=["POST"])
def extract_jd_text():
    """Extract raw text from an uploaded JD file (pdf/docx/txt) for preview
    before parsing — mirrors the 'Upload file' mode in the old sidebar."""
    file = request.files.get("file")
    if not file or file.filename == "":
        return jsonify({"ok": False, "error": "No file uploaded."}), 400
    if not allowed_file(file.filename, current_app.config["ALLOWED_JD_EXTENSIONS"]):
        return jsonify({"ok": False, "error": "Unsupported file type. Use PDF, DOCX, TXT or MD."}), 400
    try:
        text = extract_text_from_upload(file)
        return jsonify({"ok": True, "text": text})
    except Exception as e:  # noqa: BLE001
        return jsonify({"ok": False, "error": str(e)}), 400


@jd_bp.route("/api/jd/parse", methods=["POST"])
def parse_jd():
    data = request.get_json(silent=True) or {}
    jd_text = data.get("jd_text", "")
    result = svc.parse_jd_text(jd_text)
    status = 200 if result.get("ok") else 400
    return jsonify(result), status


@jd_bp.route("/api/jd/list")
def list_jds():
    try:
        jds = svc.fetch_all_jds()
        return jsonify({"ok": True, "jds": jds})
    except Exception as e:  # noqa: BLE001
        return jsonify({"ok": False, "error": str(e)}), 500


@jd_bp.route("/api/jd/<int:jd_id>")
def get_jd(jd_id: int):
    rec = svc.fetch_jd_record(jd_id)
    if not rec:
        return jsonify({"ok": False, "error": "Job description not found."}), 404
    return jsonify({"ok": True, "jd": rec})
