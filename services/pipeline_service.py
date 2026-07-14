"""
services/pipeline_service.py

This is the Flask-side replacement for the read/write "glue" code that used
to live directly inside the Streamlit app.py (hashing, dedup lookups,
fetch-by-id queries, and the handle_parse_jd / handle_process_resumes /
handle_evaluate_and_rank orchestration functions).

None of this touches the protected business-logic modules. It only *calls*
them, exactly like the original app.py did:

    core.job_description_parser.parse_job_description
    core.resume_extractor_gemini.parse_resume / get_resume_hash / extract_text_from_file
    core.compare_resume_and_jd.compare_resume_and_jd
    core.ranking.rank_all_candidates / get_tier_summary / get_score_band_summary /
                 export_ranked_to_dicts / RankingFilter
    core.exporter.generate_excel / generate_csv_all / generate_csv_top10 / generate_csv_top20

Every public function here returns plain dicts/lists (JSON-serializable)
instead of writing into Streamlit's st.session_state, so it can be called
from ordinary Flask routes and returned as JSON to the frontend JS.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Optional

import psycopg

from database import get_db_connection, ensure_schema

# Unmodified core pipeline (see config.py for why these flat imports work)
from job_description_parser import parse_job_description
from resume_extractor_gemini import parse_resume, get_resume_hash, extract_text_from_file
from compare_resume_and_jd import compare_resume_and_jd
from core.ranking import (
    rank_all_candidates,
    get_tier_summary,
    get_score_band_summary,
    export_ranked_to_dicts,
    RankingFilter,
)
from exporter import generate_excel, generate_csv_all, generate_csv_top10, generate_csv_top20


# ---------------------------------------------------------------------------
# small helpers
# ---------------------------------------------------------------------------
def _parse_maybe_json(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value
    return value


def make_jd_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Read-only DB lookups (ported 1:1 from the old app.py)
# ---------------------------------------------------------------------------
def get_jd_id_by_hash(jd_hash: str) -> Optional[int]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM job_descriptions WHERE jd_hash = %s", (jd_hash,))
            row = cur.fetchone()
        return row[0] if row else None
    finally:
        conn.close()


def get_resume_id_by_hash(file_hash: str) -> Optional[int]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM resumes WHERE file_hash = %s", (file_hash,))
            row = cur.fetchone()
        return row[0] if row else None
    finally:
        conn.close()


def fetch_jd_record(jd_id: int) -> Optional[dict]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, job_title, department, seniority, location, employment_type,
                          required_degree, required_major, required_cgpa,
                          required_experience_years, required_skills, preferred_skills,
                          required_certifications, preferred_certifications,
                          required_languages, required_projects, required_keywords,
                          responsibilities, weights,
                          consultancy_experience_required, mega_project_experience_required,
                          donor_project_experience_required, created_at
                   FROM job_descriptions WHERE id = %s""",
                (jd_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [
                "id", "job_title", "department", "seniority", "location", "employment_type",
                "required_degree", "required_major", "required_cgpa",
                "required_experience_years", "required_skills", "preferred_skills",
                "required_certifications", "preferred_certifications",
                "required_languages", "required_projects", "required_keywords",
                "responsibilities", "weights",
                "consultancy_experience_required", "mega_project_experience_required",
                "donor_project_experience_required", "created_at",
            ]
            rec = dict(zip(cols, row))
            for k in ("required_major", "required_skills", "preferred_skills",
                      "required_certifications", "preferred_certifications",
                      "required_languages", "required_projects", "required_keywords",
                      "responsibilities", "weights"):
                rec[k] = _parse_maybe_json(rec.get(k))
            if rec.get("created_at"):
                rec["created_at"] = rec["created_at"].isoformat()
            return rec
    finally:
        conn.close()


def fetch_all_jds(limit: int = 100) -> list[dict]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, job_title, department, created_at FROM job_descriptions "
                "ORDER BY id DESC LIMIT %s",
                (limit,),
            )
            rows = cur.fetchall()
        return [
            {
                "id": r[0],
                "job_title": r[1] or "Untitled",
                "department": r[2] or "",
                "created_at": r[3].isoformat() if r[3] else None,
            }
            for r in rows
        ]
    finally:
        conn.close()


def fetch_all_resumes(limit: int = 200) -> list[dict]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, name, email, filename, created_at FROM resumes
                   ORDER BY id DESC LIMIT %s""",
                (limit,),
            )
            rows = cur.fetchall()
        return [
            {
                "id": r[0],
                "name": r[1] or "Unknown",
                "email": r[2] or "",
                "filename": r[3] or "",
                "created_at": r[4].isoformat() if r[4] else None,
            }
            for r in rows
        ]
    finally:
        conn.close()


def batch_fetch_resume_profiles(resume_ids: list[int]) -> dict[int, dict]:
    if not resume_ids:
        return {}
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, name, email, phone, location, degree, major, university,
                          experience_years, skills, certifications, graduation_year,
                          cgpa, languages, leadership, achievements, filename
                   FROM resumes WHERE id = ANY(%s)""",
                (resume_ids,),
            )
            rows = cur.fetchall()
        cols = ["id", "name", "email", "phone", "location", "degree", "major",
                "university", "experience_years", "skills", "certifications",
                "graduation_year", "cgpa", "languages", "leadership", "achievements",
                "filename"]
        out = {}
        for r in rows:
            rec = dict(zip(cols, r))
            for k in ("skills", "certifications", "languages", "leadership", "achievements"):
                rec[k] = _parse_maybe_json(rec.get(k)) or []
            out[rec["id"]] = rec
        return out
    finally:
        conn.close()


def fetch_resume_profile(resume_id: int) -> Optional[dict]:
    return batch_fetch_resume_profiles([resume_id]).get(resume_id)


def batch_fetch_eval_extras(eval_ids: list[int]) -> dict[int, dict]:
    """Pulls fields ranking.py's own query doesn't select (matched/missing
    skills, strengths/weaknesses, ranking summary, true weighted score, etc.)
    straight from ats_evaluations, keyed by evaluation id."""
    if not eval_ids:
        return {}
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, matched_skills, missing_skills, top_strengths, top_weaknesses,
                          ranking_summary, llm_recommendation, weighted_final_ats_score,
                          score_band_recommendation, recommendation_alignment,
                          job_title, department, full_evaluation_json
                   FROM ats_evaluations WHERE id = ANY(%s)""",
                (eval_ids,),
            )
            rows = cur.fetchall()
        cols = ["id", "matched_skills", "missing_skills", "top_strengths", "top_weaknesses",
                "ranking_summary", "llm_recommendation", "weighted_final_ats_score",
                "score_band_recommendation", "recommendation_alignment", "job_title",
                "department", "full_evaluation_json"]
        out = {}
        for r in rows:
            rec = dict(zip(cols, r))
            for k in ("matched_skills", "missing_skills", "top_strengths", "top_weaknesses"):
                rec[k] = _parse_maybe_json(rec.get(k)) or []
            rec["full_evaluation_json"] = _parse_maybe_json(rec.get("full_evaluation_json")) or {}
            out[rec["id"]] = rec
        return out
    except psycopg.errors.UndefinedTable:
        conn.rollback()
        return {}
    finally:
        conn.close()


def get_dashboard_stats() -> dict:
    """Aggregate stats for the executive dashboard. Reads straight from
    ats_evaluations / job_descriptions / resumes; does not touch scoring logic."""
    ensure_schema()
    conn = get_db_connection()
    stats = {
        "total_candidates": 0, "total_hired": 0, "total_maybe": 0, "total_no_hire": 0,
        "avg_ats_score": 0, "avg_final_score": 0, "avg_risk_score": 0,
        "recent_uploads": [], "latest_jd": None, "top_candidate": None,
        "total_jds": 0, "score_distribution": [],
    }
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM job_descriptions")
            stats["total_jds"] = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM resumes")
            stats["total_candidates"] = cur.fetchone()[0]

            try:
                cur.execute(
                    """SELECT score_band_recommendation, COUNT(*)
                       FROM ats_evaluations GROUP BY score_band_recommendation"""
                )
                for band, count in cur.fetchall():
                    b = (band or "").lower()
                    if b in ("hire", "strong hire"):
                        stats["total_hired"] += count
                    elif b == "maybe":
                        stats["total_maybe"] += count
                    else:
                        stats["total_no_hire"] += count

                cur.execute(
                    """SELECT AVG(weighted_final_ats_score) FROM ats_evaluations"""
                )
                row = cur.fetchone()
                stats["avg_ats_score"] = round(float(row[0]), 1) if row and row[0] is not None else 0
                stats["avg_final_score"] = stats["avg_ats_score"]

                cur.execute(
                    """SELECT candidate_name, weighted_final_ats_score, job_title
                       FROM ats_evaluations ORDER BY weighted_final_ats_score DESC LIMIT 1"""
                )
                top = cur.fetchone()
                if top:
                    stats["top_candidate"] = {
                        "name": top[0], "score": round(float(top[1]), 1), "job_title": top[2]
                    }

                cur.execute(
                    """SELECT weighted_final_ats_score FROM ats_evaluations
                       ORDER BY id DESC LIMIT 200"""
                )
                stats["score_distribution"] = [round(float(r[0]), 1) for r in cur.fetchall() if r[0] is not None]
            except psycopg.errors.UndefinedTable:
                conn.rollback()

            cur.execute(
                """SELECT id, name, filename, created_at FROM resumes
                   ORDER BY id DESC LIMIT 6"""
            )
            stats["recent_uploads"] = [
                {"id": r[0], "name": r[1] or "Unknown", "filename": r[2] or "", "created_at": r[3].isoformat() if r[3] else None}
                for r in cur.fetchall()
            ]

            cur.execute(
                """SELECT id, job_title, department, created_at FROM job_descriptions
                   ORDER BY id DESC LIMIT 1"""
            )
            jd_row = cur.fetchone()
            if jd_row:
                stats["latest_jd"] = {
                    "id": jd_row[0], "job_title": jd_row[1] or "Untitled",
                    "department": jd_row[2] or "", "created_at": jd_row[3].isoformat() if jd_row[3] else None,
                }
    finally:
        conn.close()
    return stats


# ---------------------------------------------------------------------------
# Orchestration (adapted from handle_parse_jd / handle_process_resumes /
# handle_evaluate_and_rank in the old app.py — same steps, same modules,
# just returning results instead of writing to st.session_state)
# ---------------------------------------------------------------------------
def parse_jd_text(jd_text: str) -> dict:
    jd_text = (jd_text or "").strip()
    if len(jd_text) < 30:
        return {"ok": False, "error": "Job description text is too short to parse (minimum 30 characters)."}

    jd_hash = make_jd_hash(jd_text)
    existing_id = get_jd_id_by_hash(jd_hash)

    if existing_id:
        return {
            "ok": True, "reused": True, "jd_id": existing_id,
            "jd": fetch_jd_record(existing_id),
            "message": f"Job description already in database — reusing JD #{existing_id}.",
        }

    try:
        jd = parse_job_description(jd_text)
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"Failed to parse job description: {e}"}

    new_id = get_jd_id_by_hash(jd.get("jd_hash") or jd_hash)
    if not new_id:
        return {"ok": False, "error": "Job description was parsed but could not be located in the database afterward."}

    return {
        "ok": True, "reused": False, "jd_id": new_id,
        "jd": fetch_jd_record(new_id) or jd,
        "message": f"Job description parsed and stored as JD #{new_id}.",
    }


def process_one_resume(file_bytes: bytes, filename: str) -> dict:
    try:
        file_hash = get_resume_hash(file_bytes)
        existing_id = get_resume_id_by_hash(file_hash)

        if existing_id:
            profile = batch_fetch_resume_profiles([existing_id]).get(existing_id, {})
            return {
                "ok": True, "reused": True, "resume_id": existing_id,
                "filename": filename, "file_hash": file_hash,
                "name": profile.get("name", filename),
            }

        result = parse_resume(file_bytes, filename)
        new_id = get_resume_id_by_hash(file_hash)
        if not new_id:
            return {"ok": False, "filename": filename, "error": "Resume parsed but not found in database afterward."}

        return {
            "ok": True, "reused": False, "resume_id": new_id,
            "filename": filename, "file_hash": file_hash,
            "name": result.get("name", filename),
        }
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "filename": filename, "error": str(e)}


def evaluate_one(resume_id: int, jd_id: int) -> dict:
    try:
        compare_resume_and_jd(resume_id, jd_id)
        return {"ok": True, "resume_id": resume_id}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "resume_id": resume_id, "error": str(e)}


def build_ranking_filter(
    min_score: float = 0,
    min_experience_score: float = 0,
    exclude_risk_flags: Optional[list[str]] = None,
    only_hire_or_better: bool = False,
) -> "RankingFilter":
    return RankingFilter(
        min_score=float(min_score or 0),
        min_experience_score=float(min_experience_score or 0),
        exclude_risk_flags=exclude_risk_flags or [],
        only_hire_or_better=bool(only_hire_or_better),
    )


def get_ranking_for_jd(jd_id: int, filters: Optional["RankingFilter"] = None) -> dict:
    try:
        ranked_objs = rank_all_candidates(jd_id=jd_id, filters=filters)
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"Ranking failed: {e}"}

    ranked = export_ranked_to_dicts(ranked_objs)
    resume_ids = [c["resume_id"] for c in ranked]
    eval_ids = [c["eval_id"] for c in ranked]
    profiles = batch_fetch_resume_profiles(resume_ids)
    extras = batch_fetch_eval_extras(eval_ids)

    # Enrich each ranked row with display-ready fields, exactly the way
    # the Streamlit UI derived get_display_score() / matched-missing skills.
    for c in ranked:
        extra = extras.get(c["eval_id"], {})
        profile = profiles.get(c["resume_id"], {})
        display_score = extra.get("weighted_final_ats_score")
        try:
            display_score = float(display_score) if display_score is not None else float(c.get("raw_ats_score") or 0)
        except (TypeError, ValueError):
            display_score = float(c.get("raw_ats_score") or 0)

        c["display_score"] = round(display_score, 2)
        c["email"] = profile.get("email") or ""
        c["candidate_name"] = c.get("candidate_name") or profile.get("name") or f"Resume #{c['resume_id']}"
        c["matched_skills"] = extra.get("matched_skills") or []
        c["missing_skills"] = extra.get("missing_skills") or []
        c["top_strengths"] = extra.get("top_strengths") or c.get("top_strengths") or []
        c["top_weaknesses"] = extra.get("top_weaknesses") or c.get("top_weaknesses") or []
        c["ranking_summary"] = extra.get("ranking_summary") or c.get("ranking_summary") or ""
        c["llm_recommendation"] = extra.get("llm_recommendation") or c.get("score_band", "")

    return {
        "ok": True,
        "ranked": ranked,
        "tier_summary": get_tier_summary(ranked_objs),
        "band_summary": get_score_band_summary(ranked_objs),
        "profiles": profiles,
        "extras": extras,
    }
    
def get_resume_file(resume_id):

    conn = get_db_connection()

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT filename, resume_file
                FROM resumes
                WHERE id = %s
                """,
                (resume_id,)
            )

            row = cur.fetchone()

            if not row:
                return None

            return row[0], row[1]

    finally:
        conn.close()


def build_export_rows(ranked: list[dict]) -> list[dict]:
    rows = []
    for c in ranked:
        rows.append({
            "Rank": c["rank"],
            "Candidate Name": c.get("candidate_name", ""),
            "Email": c.get("email", ""),
            "ATS Score": c.get("display_score", 0),
            "Final Rank Score": round(c.get("final_rank_score", 0), 2),
            "Tier": c.get("tier", ""),
            "Score Band": c.get("score_band", ""),
            "Risk Flags": ", ".join(c.get("risk_flags") or []),
            "Top Strengths": "; ".join(c.get("top_strengths") or []),
            "Top Weaknesses": "; ".join(c.get("top_weaknesses") or []),
            "Ranking Summary": c.get("ranking_summary", ""),
        })
    return rows
