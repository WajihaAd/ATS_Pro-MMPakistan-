from __future__ import annotations

from flask import Blueprint, render_template, jsonify, request, abort

from services import pipeline_service as svc

candidate_bp = Blueprint("candidate", __name__)


@candidate_bp.route("/candidate/<int:resume_id>")
def candidate_page(resume_id: int):
    jd_id = request.args.get("jd_id", type=int)
    profile = svc.fetch_resume_profile(resume_id)
    if not profile:
        abort(404)
    return render_template("candidate.html", active="ranking", resume_id=resume_id, jd_id=jd_id, profile=profile)


@candidate_bp.route("/api/candidate/<int:resume_id>")
def candidate_detail(resume_id: int):
    eval_id = request.args.get("eval_id", type=int)
    profile = svc.fetch_resume_profile(resume_id)
    if not profile:
        return jsonify({"ok": False, "error": "Candidate not found."}), 404

    extra = {}
    if eval_id:
        extra = svc.batch_fetch_eval_extras([eval_id]).get(eval_id, {})

    return jsonify({"ok": True, "profile": profile, "evaluation": extra})
