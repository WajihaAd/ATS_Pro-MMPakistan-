"""
database.py

Connection helper + schema bootstrap for the tables the core pipeline
modules INSERT into (job_descriptions, resumes). `ats_evaluations` is
created lazily by core.compare_resume_and_jd.ensure_ats_table(), exactly
as it was in the original Streamlit app — untouched here.

This mirrors what the old app.py did with get_db_connection() / ensure_schema(),
just moved into its own module and adapted from st.cache_resource to a
simple module-level "run once" flag, since Flask has no direct equivalent.
"""

from __future__ import annotations

import psycopg
from config import Config

_schema_ready = False


def get_db_connection() -> psycopg.Connection:
    # 1. Read the Supabase connection string from Render variables
    conn_string = os.getenv("DATABASE_URL")
    
    if conn_string:
        # Standardize prefix for older libraries just in case
        if conn_string.startswith("postgres://"):
            conn_string = conn_string.replace("postgres://", "postgresql://", 1)
        return psycopg.connect(conn_string)

    return psycopg.connect(
        dbname="resume_db",
        user="postgres",
        password=Config.DB_PASSWORD,
        host="localhost",
        port="5432",
    )


def ensure_schema(force: bool = False) -> bool:
    """Create job_descriptions / resumes tables if they don't exist yet."""
    global _schema_ready
    if _schema_ready and not force:
        return True

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS job_descriptions (
                    id SERIAL PRIMARY KEY,
                    job_title TEXT,
                    department TEXT,
                    seniority TEXT,
                    location TEXT,
                    employment_type TEXT,
                    required_degree TEXT,
                    required_major JSONB,
                    required_cgpa NUMERIC,
                    required_experience_years NUMERIC,
                    required_skills JSONB,
                    preferred_skills JSONB,
                    required_certifications JSONB,
                    preferred_certifications JSONB,
                    required_languages JSONB,
                    required_coursework JSONB,
                    required_projects JSONB,
                    required_keywords JSONB,
                    responsibilities JSONB,
                    consultancy_experience_required BOOLEAN,
                    mega_project_experience_required BOOLEAN,
                    donor_project_experience_required BOOLEAN,
                    weights JSONB,
                    raw_data JSONB,
                    jd_hash TEXT UNIQUE,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    full_name VARCHAR(100),
                    email VARCHAR(150) UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    role VARCHAR(50) DEFAULT 'hr',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS resumes (
                    id SERIAL PRIMARY KEY,
                    name TEXT,
                    email TEXT,
                    phone TEXT,
                    location TEXT,
                    degree TEXT,
                    major TEXT,
                    cgpa TEXT,
                    university TEXT,
                    graduation_year TEXT,
                    experience_years NUMERIC,
                    skills JSONB,
                    certifications JSONB,
                    leadership JSONB,
                    languages JSONB,
                    consultancy_companies JSONB,
                    mega_projects JSONB,
                    raw_data JSONB,
                    filename TEXT,
                    file_hash TEXT UNIQUE,
                    communication_score NUMERIC,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
                """
            )
        conn.commit()
        _schema_ready = True
        return True
    finally:
        conn.close()
