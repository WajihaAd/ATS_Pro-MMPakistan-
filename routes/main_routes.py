from __future__ import annotations

from flask import Blueprint, render_template, jsonify, current_app

from services import pipeline_service as svc

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
def index():
    return render_template("dashboard.html", active="dashboard")


@main_bp.route("/dashboard")
def dashboard():
    return render_template("dashboard.html", active="dashboard")


@main_bp.route("/api/dashboard/stats")
def dashboard_stats():
    try:
        stats = svc.get_dashboard_stats()
        return jsonify({"ok": True, "stats": stats})
    except Exception as e:  # noqa: BLE001
        current_app.logger.exception("dashboard stats failed")
        return jsonify({"ok": False, "error": str(e)}), 500



