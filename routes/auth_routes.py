"""
routes/auth_routes.py

Authentication for the ATS. Uses the same database.get_db_connection()
helper as the rest of the app (no second connection system) and
Werkzeug's password hashing utilities. Sessions are plain Flask
cookie-sessions (session["user_id"], session["user_name"], session["role"]),
which is enough for a single-server enterprise-internal tool like this one.

This file does NOT touch resume_extractor_gemini, ats_score_calculator,
compare_resume_and_jd, job_description_parser, ranking, or exporter — it
only adds users + the login_required guard other blueprints opt into.
"""

from __future__ import annotations

import re
from functools import wraps
from services.email_service import send_password_reset_email
import secrets
from datetime import datetime, timedelta, timezone

from flask import (
    Blueprint,
    current_app,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash

from database import get_db_connection

auth_bp = Blueprint("auth", __name__)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def get_user_by_email(email):
    conn = get_db_connection()

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, full_name, email
                FROM users
                WHERE email = %s
                LIMIT 1
                """,
                (email,),
            )

            return cur.fetchone()

    except Exception:
        current_app.logger.exception("forgot password user lookup failed")
        return None

    finally:
        conn.close()

def create_password_reset_token(user_id):

    token = secrets.token_urlsafe(48)

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)


    conn = get_db_connection()

    try:
        with conn.cursor() as cur:

            cur.execute(
                """
                INSERT INTO password_reset_tokens
                (
                    user_id,
                    token,
                    expires_at
                )
                VALUES (%s, %s, %s)
                RETURNING id
                """,
                (
                    user_id,
                    token,
                    expires_at
                )
            )

            reset_id = cur.fetchone()[0]

        conn.commit()

        return token


    except Exception:
        conn.rollback()
        current_app.logger.exception(
            "Could not create password reset token"
        )
        return None


    finally:
        conn.close()

def _wants_json() -> bool:
    """True for XHR/fetch calls (our auth.js posts JSON-accepting fetches),
    False for a plain browser navigation — lets login_required redirect
    humans to /login but return a 401 JSON payload to API callers."""
    if request.path.startswith("/api/"):
        return True
    best = request.accept_mimetypes.best_match(["application/json", "text/html"])
    return best == "application/json" and request.accept_mimetypes[best] >= request.accept_mimetypes["text/html"]


def login_required(view_func):
    """Decorator: protect a route so it requires an active session.
    Usage:
        from routes.auth_routes import login_required

        @some_bp.route("/whatever")
        @login_required
        def whatever():
            ...
    """

    @wraps(view_func)
    def wrapped_view(*args, **kwargs):
        if "user_id" not in session:
            if _wants_json():
                return jsonify({"ok": False, "error": "Authentication required. Please log in."}), 401
            return redirect(url_for("auth.login", next=request.path))
        return view_func(*args, **kwargs)

    return wrapped_view


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        if "user_id" in session:
            return redirect(url_for("main.dashboard"))
        next_url = request.args.get("next", "")
        return render_template("login.html", next_url=next_url)

    # POST
    email = (request.form.get("email") or "").strip().lower()
    password = request.form.get("password") or ""
    next_url = request.form.get("next") or url_for("main.dashboard")

    if not email or not password:
        return jsonify({"ok": False, "error": "Email and password are required."}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, full_name, password_hash, role FROM users WHERE email = %s",
                (email,),
            )
            row = cur.fetchone()
    except Exception as e:  # noqa: BLE001
        current_app.logger.exception("login query failed")
        return jsonify({"ok": False, "error": "Could not reach the database. Try again shortly."}), 500
    finally:
        conn.close()

    if not row or not check_password_hash(row[2], password):
        return jsonify({"ok": False, "error": "Invalid email or password."}), 401

    user_id, full_name, _hash, role = row

    session.clear()
    session.permanent = True
    session["user_id"] = user_id
    session["user_name"] = full_name
    session["role"] = role

    # Only allow relative redirects (avoid open-redirect via ?next=)
    if not next_url.startswith("/"):
        next_url = url_for("main.dashboard")

    return jsonify({"ok": True, "redirect": next_url})


@auth_bp.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "GET":
        if "user_id" in session:
            return redirect(url_for("main.dashboard"))
        return render_template("signup.html")

    # POST
    full_name = (request.form.get("full_name") or "").strip()
    email = (request.form.get("email") or "").strip().lower()
    password = request.form.get("password") or ""
    confirm_password = request.form.get("confirm_password") or ""

    if not full_name or not email or not password or not confirm_password:
        return jsonify({"ok": False, "error": "All fields are required."}), 400
    if not _EMAIL_RE.match(email):
        return jsonify({"ok": False, "error": "Enter a valid email address."}), 400
    if len(password) < 8:
        return jsonify({"ok": False, "error": "Password must be at least 8 characters."}), 400
    if password != confirm_password:
        return jsonify({"ok": False, "error": "Passwords do not match."}), 400

    password_hash = generate_password_hash(password)

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cur.fetchone():
                return jsonify({"ok": False, "error": "An account with this email already exists."}), 409

            cur.execute(
                """
                INSERT INTO users (full_name, email, password_hash, role)
                VALUES (%s, %s, %s, 'hr')
                RETURNING id, full_name, role
                """,
                (full_name, email, password_hash),
            )
            new_id, new_name, new_role = cur.fetchone()
        conn.commit()
    except Exception as e:  # noqa: BLE001
        conn.rollback()
        current_app.logger.exception("signup insert failed")
        return jsonify({"ok": False, "error": "Could not create the account. Try again shortly."}), 500
    finally:
        conn.close()

    session.clear()
    session.permanent = True
    session["user_id"] = new_id
    session["user_name"] = new_name
    session["role"] = new_role

    return jsonify({"ok": True, "redirect": url_for("main.dashboard")})

@auth_bp.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():

    if request.method == "GET":
        return render_template("forgot_password.html")


    email = (request.form.get("email") or "").strip().lower()


    if not email:
        return jsonify({
            "ok": False,
            "message": "Email is required."
        }), 400


    user = get_user_by_email(email)


    if user:
        user_id, full_name, user_email = user
        token = create_password_reset_token(user_id)

        if token:
            print("✅ RESET TOKEN CREATED:")
            print(token)


            send_password_reset_email(
                recipient_email=user_email,
                recipient_name=full_name,
                token=token
            )

    else:
        print("❌ USER NOT FOUND:", email)


    return jsonify({
        "ok": True,
        "message": "If this email exists, a reset link will be sent."
    })

@auth_bp.route("/reset-password/<token>", methods=["GET", "POST"])
def reset_password(token):

    conn = get_db_connection()

    try:
        with conn.cursor() as cur:

            cur.execute(
                """
                SELECT user_id
                FROM password_reset_tokens
                WHERE token = %s
                AND expires_at > NOW()
                """,
                (token,)
            )

            row = cur.fetchone()

    finally:
        conn.close()


    if not row:
        return "Invalid or expired reset link", 400


    user_id = row[0]


    if request.method == "GET":
        return render_template(
            "reset_password.html",
            token=token
        )


    password = request.form.get("password")
    confirm_password = request.form.get("confirm_password")


    if not password or password != confirm_password:
        return jsonify({
            "ok": False,
            "error": "Passwords do not match"
        }), 400


    new_hash = generate_password_hash(password)


    conn = get_db_connection()

    try:
        with conn.cursor() as cur:

            cur.execute(
                """
                UPDATE users
                SET password_hash=%s
                WHERE id=%s
                """,
                (new_hash, user_id)
            )


            cur.execute(
                """
                DELETE FROM password_reset_tokens
                WHERE token=%s
                """,
                (token,)
            )


        conn.commit()

    finally:
        conn.close()


    return redirect(url_for("auth.login"))

@auth_bp.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("auth.login"))
