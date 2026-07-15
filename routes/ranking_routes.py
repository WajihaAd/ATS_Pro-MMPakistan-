from __future__ import annotations

from flask import Blueprint, render_template, request, jsonify

from services import pipeline_service as svc
from routes.auth_routes import login_required

ranking_bp = Blueprint("ranking", __name__)


@ranking_bp.route("/ranking")
@login_required
def ranking_page():
    return render_template("ranking.html", active="ranking")


@ranking_bp.route("/api/rank")
@login_required
def api_rank():
    jd_id = request.args.get("jd_id", type=int)
    if not jd_id:
        return jsonify({"ok": False, "error": "jd_id is required."}), 400

    min_score = request.args.get("min_score", default=0, type=float)
    min_experience_score = request.args.get("min_experience_score", default=0, type=float)
    only_hire_or_better = request.args.get("only_hire_or_better", default="false") == "true"
    exclude_risk_flags = request.args.get("exclude_risk_flags", default="")
    exclude_risk_flags = [f for f in exclude_risk_flags.split(",") if f]

    filters = svc.build_ranking_filter(
        min_score=min_score,
        min_experience_score=min_experience_score,
        exclude_risk_flags=exclude_risk_flags,
        only_hire_or_better=only_hire_or_better,
    )

    result = svc.get_ranking_for_jd(jd_id, filters)
    status = 200 if result.get("ok") else 400
    return jsonify(result), status
