from flask import current_app
from flask_mail import Message

from extensions import mail


def send_password_reset_email(
    recipient_email,
    recipient_name,
    token
):

    reset_url = (
        f"http://localhost:5000/reset-password/{token}"
    )


    msg = Message(
        subject="Reset your ATS Pro password",
        recipients=[recipient_email]
    )


    msg.body = f"""
Hello {recipient_name},

Someone requested a password reset for your ATS Pro account.

Click the link below to reset your password:

{reset_url}

This link will expire in 15 minutes.

If you did not request this password reset, please ignore this email.

Regards,
ATS Pro Team
"""


    try:
        mail.send(msg)

        current_app.logger.info(
            "Password reset email sent to %s",
            recipient_email
        )

        return True


    except Exception as e:
        current_app.logger.exception(
            "Failed to send password reset email: %s",
            e
        )

        return False