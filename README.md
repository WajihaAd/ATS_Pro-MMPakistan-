# ATS Pro — Flask Edition

Enterprise web frontend for your existing AI-powered ATS pipeline. This project
**removes Streamlit entirely** and replaces it with a Flask + Jinja2 + Bootstrap 5
application, while reusing your original scoring/extraction/ranking logic
**completely unmodified**.

## What was and wasn't touched

**Not touched — copied byte-for-byte into `core/`:**
- `core/resume_extractor_gemini.py`
- `core/job_description_parser.py`
- `core/compare_resume_and_jd.py`
- `core/ats_score_calculator.py`
- `core/ranking.py` (this was your `rankingoriginal.py`)
- `core/exporter.py`

These files still use their original flat, same-directory imports (e.g.
`from ats_score_calculator import evaluate_candidate`). `config.py` puts
`core/` on `sys.path` at startup so those imports resolve exactly as they
did when everything lived next to the old Streamlit `app.py` — no code in
these files was edited.

**New code (the actual "conversion"):**
- `app.py`, `config.py`, `database.py`, `extract_helper.py` — Flask app setup
- `services/pipeline_service.py` — orchestration layer that calls your core
  modules and returns JSON-friendly dicts (this replaces the old app.py's
  `handle_parse_jd` / `handle_process_resumes` / `handle_evaluate_and_rank`
  glue code and Streamlit `st.session_state` usage)
- `routes/` — Flask blueprints (dashboard, JD, resume, evaluate, ranking,
  candidate, reports, settings, export)
- `templates/` — Jinja2 pages (Bootstrap 5, dark/light mode, glassmorphism)
- `static/` — CSS + vanilla JS (drag & drop uploads, AJAX evaluation with a
  live progress/step list, sortable/searchable/paginated ranking table,
  Chart.js dashboards, CSV/Excel export)

## One known gap carried over from the original project

`core/ats_score_calculator.py` optionally loads a JSON Schema file
(`ats_evaluation_output_schema.json`) for strict LLM-output validation if the
`jsonschema` package is installed. That schema file wasn't included in your
uploads, so **`jsonschema` is intentionally left out of `requirements.txt`** —
this makes the module fall back to its own lightweight "are all required
top-level keys present" check, which was already built into the file as a
fallback. If you have the schema file, drop it in `core/` and add
`jsonschema` back to `requirements.txt` to enable full schema validation.

## Setup

```bash
cd ATS_Project
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# then edit .env and set GEMINI_API_KEY and DB_PASSWORD
```

Your PostgreSQL database (`resume_db`, user `postgres`, localhost:5432) must
already be running — same as before. `job_descriptions` and `resumes` tables
are auto-created on startup if missing. The `ats_evaluations` table continues
to be created by `core/compare_resume_and_jd.py`'s own
`ensure_ats_table()`, untouched.

## Run

```bash
python app.py
```

Visit **http://localhost:5000**. No Streamlit, no `streamlit run` — this is
a plain WSGI app (use `gunicorn app:app` for production instead of the
built-in dev server).

## Application flow

1. **Dashboard** (`/dashboard`) — executive stats, charts, recent activity.
2. **Job Description** (`/upload_job`) — paste or upload a JD; parsed via
   Gemini through your unmodified `job_description_parser.py`.
3. **Upload Resumes** (`/upload_resume`) — drag & drop one or more resumes;
   parsed via your unmodified `resume_extractor_gemini.py`. Duplicate files
   (by hash) are detected and reused instead of re-processed.
4. **Evaluate** (`/evaluate`) — one button runs every staged resume against
   the active JD through your unmodified `compare_resume_and_jd.py` (which
   itself calls `ats_score_calculator.py`), one at a time, with a live
   step list and progress bar.
5. **Ranking** (`/ranking`) — searchable, sortable, paginated table built
   from your unmodified `ranking.py`, with score/risk filters and
   Excel/CSV export (via your unmodified `exporter.py`).
6. **Candidate profile** (`/candidate/<id>`) — full ATS category breakdown,
   matched/missing skills, risk flags, strengths/weaknesses, and the LLM's
   hiring reasoning.
7. **Reports** (`/reports`) — cross-JD score distribution and hiring mix.
8. **Settings** (`/settings`) — environment/config status at a glance.

## Notes

- Client-side "session" (active JD, staged resumes) is kept in the browser's
  `sessionStorage` via `static/js/app-state.js`, since this is a stateless
  multi-page Flask app rather than Streamlit's server-side session object.
  It clears when the browser tab closes, same practical behavior as before.
- No authentication/login was in the original project, so none was added —
  `routes/settings_routes.py` and the rest assume a single trusted recruiter
  user, matching the original scope. Add Flask-Login (or similar) in front
  of `routes/` if you need multi-user auth.
