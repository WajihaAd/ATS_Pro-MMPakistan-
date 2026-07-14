from __future__ import annotations

import io
from datetime import datetime

import pandas as pd
from flask import Blueprint, request, jsonify, send_file

from services import pipeline_service as svc
from exporter import generate_excel, generate_csv_all, generate_csv_top10, generate_csv_top20

export_bp = Blueprint("export", __name__)


def _build_pipeline_output(jd_id: int, filters) -> dict | None:
    result = svc.get_ranking_for_jd(jd_id, filters)
    if not result.get("ok"):
        return None
    rows = svc.build_export_rows(result["ranked"])
    df_all = pd.DataFrame(rows)
    df_top10 = df_all.head(10)
    df_top20 = df_all.head(20)
    jd = svc.fetch_jd_record(jd_id) or {}
    return {"jd": jd, "df_all": df_all, "df_top10": df_top10, "df_top20": df_top20}


def _filters_from_args():
    return svc.build_ranking_filter(
        min_score=request.args.get("min_score", default=0, type=float),
        min_experience_score=request.args.get("min_experience_score", default=0, type=float),
        exclude_risk_flags=[f for f in request.args.get("exclude_risk_flags", "").split(",") if f],
        only_hire_or_better=request.args.get("only_hire_or_better", default="false") == "true",
    )


@export_bp.route("/export/excel")
def export_excel():
    jd_id = request.args.get("jd_id", type=int)
    if not jd_id:
        return jsonify({"ok": False, "error": "jd_id is required."}), 400

    output = _build_pipeline_output(jd_id, _filters_from_args())
    if output is None:
        return jsonify({"ok": False, "error": "No ranked candidates to export."}), 400

    excel_bytes = generate_excel(output)
    filename = f"ats_ranking_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return send_file(
        io.BytesIO(excel_bytes),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename,
    )


@export_bp.route("/export/csv/<kind>")
def export_csv(kind: str):
    jd_id = request.args.get("jd_id", type=int)
    if not jd_id:
        return jsonify({"ok": False, "error": "jd_id is required."}), 400

    output = _build_pipeline_output(jd_id, _filters_from_args())
    if output is None:
        return jsonify({"ok": False, "error": "No ranked candidates to export."}), 400

    generators = {"all": generate_csv_all, "top10": generate_csv_top10, "top20": generate_csv_top20}
    generator = generators.get(kind)
    if not generator:
        return jsonify({"ok": False, "error": "Unknown export kind. Use all, top10, or top20."}), 400

    csv_text = generator(output)
    filename = f"ats_{kind}_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
    return send_file(
        io.BytesIO(csv_text.encode("utf-8")),
        mimetype="text/csv",
        as_attachment=True,
        download_name=filename,
    )
