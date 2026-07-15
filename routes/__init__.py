from flask import Flask


def register_blueprints(app: Flask) -> None:
    from routes.auth_routes import auth_bp
    from routes.main_routes import main_bp
    from routes.jd_routes import jd_bp
    from routes.resume_routes import resume_bp
    from routes.evaluate_routes import evaluate_bp
    from routes.ranking_routes import ranking_bp
    from routes.candidate_routes import candidate_bp
    from routes.reports_routes import reports_bp
    from routes.settings_routes import settings_bp
    from routes.export_routes import export_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(jd_bp)
    app.register_blueprint(resume_bp)
    app.register_blueprint(evaluate_bp)
    app.register_blueprint(ranking_bp)
    app.register_blueprint(candidate_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(export_bp)
