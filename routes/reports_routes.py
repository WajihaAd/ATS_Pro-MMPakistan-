from __future__ import annotations

from flask import Blueprint, render_template, jsonify

from services import pipeline_service as svc

reports_bp = Blueprint("reports", __name__)


@reports_bp.route("/reports")
def reports_page():
    return render_template("reports.html", active="reports")


@reports_bp.route("/api/reports/summary")
def reports_summary():
    try:
        stats = svc.get_dashboard_stats()
        jds = svc.fetch_all_jds(limit=10)
        return jsonify({"ok": True, "stats": stats, "recent_jds": jds})
    except Exception as e:  # noqa: BLE001
        return jsonify({"ok": False, "error": str(e)}), 500
