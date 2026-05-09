#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Process pending email notifications from Firestore.

Reads pendingNotifications collection, sends emails via SMTP,
and marks notifications as sent.

Usage:
    python scripts/process_notifications.py
    python scripts/process_notifications.py --dry-run
"""

import os
import sys
import json
import argparse
import smtplib
import ssl
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime, timezone

# Add project root to path for utils import
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from scripts.utils.firebase_common import init_firestore

# Port 587 STARTTLS — port 465 SSL was silently dropping self-sent mail
# (ksmoon → ksmoon) on the Hwaseung mail server. Watchdog (port 587) reaches.
SMTP_HOST = "mail.hsvina.com"
SMTP_PORT = 587
FROM_NAME = "QIP Incentive Dashboard"
FROM_EMAIL = "ksmoon@hsvina.com"

DASHBOARD_URL = "https://moonkaicuzui.github.io/hwk-qip-incentive-v10/"


def get_smtp_credentials(db):
    user = os.environ.get("SMTP_USER", "")
    password = os.environ.get("SMTP_PASSWORD", "")
    if user and password:
        return user, password
    try:
        doc = db.collection("system").document("config").get()
        if doc.exists:
            settings = doc.to_dict().get("email_settings", {})
            user = settings.get("smtp_user", "")
            password = settings.get("smtp_password", "")
            if user and password:
                return user, password
    except Exception:
        pass
    return "", ""


def build_notification_html(title, new_status, comment, changed_by):
    status_colors = {
        "completed": ("#059669", "#d1fae5", "Completed"),
        "approved": ("#4338ca", "#e0e7ff", "Approved"),
    }
    color, bg, label = status_colors.get(new_status, ("#64748b", "#f1f5f9", new_status.capitalize()))

    comment_html = ""
    if comment:
        comment_html = f"""
        <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;">
            <div style="font-weight:600;font-size:13px;color:#64748b;margin-bottom:6px;">Resolution Comment:</div>
            <div style="font-size:14px;color:#334155;line-height:1.6;">{comment}</div>
        </div>"""

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#334155;">
    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:24px;border-radius:12px;color:white;text-align:center;margin-bottom:20px;">
        <h1 style="margin:0;font-size:20px;">QIP System Feedback Update</h1>
    </div>

    <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:16px;">
        <h3 style="margin:0 0 12px 0;font-size:16px;color:#1e293b;">{title}</h3>
        <div style="display:inline-block;background:{bg};color:{color};padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;">
            {label}
        </div>
        <div style="font-size:13px;color:#64748b;margin-top:8px;">Updated by: {changed_by}</div>
        {comment_html}
    </div>

    <div style="text-align:center;margin:20px 0;">
        <a href="{DASHBOARD_URL}web/feedback.html" style="display:inline-block;background:#667eea;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            View on Dashboard
        </a>
    </div>

    <div style="text-align:center;padding:12px;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;margin-top:20px;">
        QIP Incentive Dashboard V10 &middot; Automated Notification
    </div>
</body>
</html>"""


def send_notification(to_email, subject, html_body, smtp_user, smtp_password, attachment=None, attachments=None):
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        # Port 587 STARTTLS path (consistent with workflow-watchdog dawidd6 pattern)
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30)
        server.ehlo()
        server.starttls(context=ctx)
        server.ehlo()
        code, resp = server.docmd("AUTH LOGIN", base64.b64encode(smtp_user.encode()).decode())
        if code == 334:
            code, resp = server.docmd(base64.b64encode(smtp_password.encode()).decode())
        if code != 235:
            print(f"  AUTH failed: {code}")
            return False

        msg = MIMEMultipart("mixed")
        msg["Subject"] = subject
        msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        # Build list of attachments to process
        att_list = []
        if attachment:
            att_list.append(attachment)
        if attachments and isinstance(attachments, list):
            att_list.extend(attachments)

        for att in att_list:
            filename = att.get("filename", "attachment")
            file_data = base64.b64decode(att.get("content", att.get("data", "")))
            content_type = att.get("contentType", "application/octet-stream")
            maintype, subtype = content_type.split("/", 1) if "/" in content_type else ("application", "octet-stream")
            part = MIMEBase(maintype, subtype)
            part.set_payload(file_data)
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", "attachment", filename=filename)
            msg.attach(part)
            print(f"    Attached: {filename}")

        server.mail(FROM_EMAIL)
        server.rcpt(to_email)
        server.data(msg.as_bytes())
        server.quit()
        return True
    except Exception as e:
        print(f"  Send error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Process pending feedback notifications")
    parser.add_argument("--dry-run", action="store_true", help="Don't send emails or update Firestore")
    args = parser.parse_args()

    print("=" * 60)
    print("  Processing Pending Notifications")
    print("=" * 60)

    db = init_firestore()

    # Get pending notifications
    pending = db.collection("pendingNotifications").where("sent", "==", False).stream()
    notifications = []
    for doc in pending:
        data = doc.to_dict()
        data["_id"] = doc.id
        notifications.append(data)

    if not notifications:
        print("\n  No pending notifications.")
        return

    print(f"\n  Found {len(notifications)} pending notification(s)")

    if args.dry_run:
        for n in notifications:
            print(f"  [DRY-RUN] To: {n.get('reporterEmail')}, Status: {n.get('newStatus')}, Title: {n.get('title')}")
        return

    smtp_user, smtp_password = get_smtp_credentials(db)
    if not smtp_user or not smtp_password:
        print("  ERROR: No SMTP credentials. Set SMTP_USER/SMTP_PASSWORD env vars.")
        sys.exit(1)

    sent = 0
    failed = 0
    for n in notifications:
        to_email = n.get("reporterEmail", "")
        title = n.get("title", "Untitled")
        new_status = n.get("newStatus", "")
        comment = n.get("comment", "")
        changed_by = n.get("changedBy", "Admin")

        if not to_email or "@" not in to_email:
            print(f"  Skip (invalid email): {to_email}")
            db.collection("pendingNotifications").document(n["_id"]).update({
                "sent": False, "error": "Invalid email address", "lastAttempt": datetime.utcnow().isoformat() + "Z"
            })
            failed += 1
            continue

        # Support custom HTML for weekly reports etc.
        custom_html = n.get("customHtml", "")
        custom_subject = n.get("customSubject", "")
        if custom_html and custom_subject:
            subject = custom_subject
            html = custom_html
        else:
            subject = f"[QIP Feedback] Your issue '{title}' has been {new_status}"
            html = build_notification_html(title, new_status, comment, changed_by)

        # Check for attachment(s) — supports both singular and plural
        attachment = n.get("attachment", None)
        attachments = n.get("attachments", None)

        print(f"\n  Sending to {to_email}...")
        if send_notification(to_email, subject, html, smtp_user, smtp_password, attachment=attachment, attachments=attachments):
            db.collection("pendingNotifications").document(n["_id"]).update({
                "sent": True, "sentAt": datetime.utcnow().isoformat() + "Z"
            })
            sent += 1
            print(f"  Sent successfully")
        else:
            failed += 1
            print(f"  Failed")

    print(f"\n  Results: {sent} sent, {failed} failed")
    print("=" * 60)


if __name__ == "__main__":
    main()
