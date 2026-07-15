from __future__ import annotations

from flask import Blueprint, render_template, request, jsonify, current_app

from services import pipeline_service as svc
from extract_helper import allowed_file
from routes.auth_routes import login_required

resume_bp = Blueprint("resume", __name__)

import io
from flask import send_file

@resume_bp.route("/download_resume/<int:resume_id>")
@login_required
def download_resume(resume_id):

    resume = svc.get_resume_file(resume_id)

    if not resume:
        return "Resume not found", 404

    filename, file_data = resume

    return send_file(
        io.BytesIO(file_data),
        as_attachment=True,
        download_name=filename
    )


@resume_bp.route("/upload_resume")
@login_required
def upload_resume_page():
    return render_template("upload_resume.html", active="upload_resume")


@resume_bp.route("/api/resume/upload", methods=["POST"])
@login_required
def upload_resumes():
    """Accepts one or more files under the 'files' field, processes each
    through the unmodified resume_extractor_gemini pipeline, and returns a
    per-file result list so the frontend can render success/failure per row."""
    files = request.files.getlist("files")
    if not files:
        return jsonify({"ok": False, "error": "No files uploaded."}), 400

    allowed = current_app.config["ALLOWED_RESUME_EXTENSIONS"]
    results = []
    for f in files:
        if f.filename == "":
            continue
        if not allowed_file(f.filename, allowed):
            results.append({"ok": False, "filename": f.filename, "error": "Unsupported file type."})
            continue
        try:
            file_bytes = f.read()
            result = svc.process_one_resume(file_bytes, f.filename)
            results.append(result)
        except Exception as e:  # noqa: BLE001
            results.append({"ok": False, "filename": f.filename, "error": str(e)})

    succeeded = sum(1 for r in results if r.get("ok") and not r.get("reused"))
    reused = sum(1 for r in results if r.get("ok") and r.get("reused"))
    failed = sum(1 for r in results if not r.get("ok"))

    return jsonify({
        "ok": True,
        "results": results,
        "summary": {"succeeded": succeeded, "reused": reused, "failed": failed, "total": len(results)},
    })


@resume_bp.route("/api/resume/list")
@login_required
def list_resumes():
    try:
        resumes = svc.fetch_all_resumes()
        return jsonify({"ok": True, "resumes": resumes})
    except Exception as e:  # noqa: BLE001
        return jsonify({"ok": False, "error": str(e)}), 500
