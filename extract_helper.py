"""
extract_helper.py

Thin Flask-facing wrapper around core.resume_extractor_gemini.extract_text_from_file,
used for BOTH resume uploads and JD file uploads — exactly as the original
Streamlit app did (it called the same extractor for JD file uploads in the
sidebar's "Upload file" mode).
"""

from __future__ import annotations

from werkzeug.datastructures import FileStorage

from core.resume_extractor_gemini import extract_text_from_file  # unmodified core module


def allowed_file(filename: str, allowed_extensions: set[str]) -> bool:
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in allowed_extensions


def extract_text_from_upload(file: FileStorage) -> str:
    file_bytes = file.read()
    file.seek(0)
    return extract_text_from_file(file_bytes, file.filename)
