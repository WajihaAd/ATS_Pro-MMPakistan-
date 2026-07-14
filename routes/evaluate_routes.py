from __future__ import annotations

from flask import Blueprint, render_template, request, jsonify

from services import pipeline_service as svc

evaluate_bp = Blueprint("evaluate", __name__)


@evaluate_bp.route("/evaluate")
def evaluate_page():
    return render_template("evaluation.html", active="evaluate")


@evaluate_bp.route("/api/evaluate/one", methods=["POST"])
def evaluate_one():
    """Evaluates a single resume against a single JD. The frontend calls this
    once per resume in sequence, updating the progress bar and status line
    between calls — this is what drives the 'Extracting… Comparing… Running
    AI… Calculating ATS… Saving…' step list on the evaluation page without
    needing a background task queue or websockets."""
    data = request.get_json(silent=True) or {}
    resume_id = data.get("resume_id")
    jd_id = data.get("jd_id")

    if not resume_id or not jd_id:
        return jsonify({"ok": False, "error": "resume_id and jd_id are required."}), 400

    result = svc.evaluate_one(int(resume_id), int(jd_id))
    status = 200 if result.get("ok") else 400
    return jsonify(result), status
