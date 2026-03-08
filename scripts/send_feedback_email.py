#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Send feedback improvement notification email with attachment.

Usage:
    python scripts/send_feedback_email.py \
        --to "huynhnhurgqa04@hsvina.com" \
        --subject "QIP System - February 2026 Improvement Report" \
        --attachment "output_files/February_2026_Improvement_Report.txt"
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

# Add project root to path for utils import
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from scripts.utils.firebase_common import init_firestore

# SMTP settings
SMTP_HOST = "mail.hsvina.com"
SMTP_PORT = 465
FROM_NAME = "QIP Incentive Dashboard"
FROM_EMAIL = "ksmoon@hsvina.com"


def get_smtp_credentials():
    """Get SMTP credentials from environment or Firestore."""
    user = os.environ.get("SMTP_USER", "")
    password = os.environ.get("SMTP_PASSWORD", "")
    if user and password:
        return user, password

    # Try Firestore
    try:
        db = init_firestore()
        doc = db.collection("system").document("config").get()
        if doc.exists:
            config = doc.to_dict()
            settings = config.get("email_settings", {})
            user = settings.get("smtp_user", "")
            password = settings.get("smtp_password", "")
            if user and password:
                return user, password
    except Exception as e:
        print(f"  Firestore credential lookup failed: {e}")

    return "", ""


def send_email_with_attachment(to_email, subject, html_body, attachment_path=None):
    """Send email via SMTP with optional file attachment."""
    user, password = get_smtp_credentials()
    if not user or not password:
        print("ERROR: No SMTP credentials found.")
        print("Set SMTP_USER and SMTP_PASSWORD environment variables,")
        print("or configure in Firestore system/config.email_settings")
        return False

    msg = MIMEMultipart()
    msg["Subject"] = subject
    msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
    msg["To"] = to_email

    msg.attach(MIMEText(html_body, "html", "utf-8"))

    # Attach file if provided
    if attachment_path and os.path.exists(attachment_path):
        filename = os.path.basename(attachment_path)
        with open(attachment_path, "rb") as f:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f"attachment; filename={filename}")
        msg.attach(part)
        print(f"  Attachment: {filename} ({os.path.getsize(attachment_path):,} bytes)")

    # Connect and send with AUTH LOGIN
    try:
        print(f"  Connecting to {SMTP_HOST}:{SMTP_PORT}...")
        ctx = ssl.create_default_context()
        server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=30, context=ctx)
        server.ehlo()

        # AUTH LOGIN
        code, resp = server.docmd("AUTH LOGIN", base64.b64encode(user.encode()).decode())
        if code == 334:
            code, resp = server.docmd(base64.b64encode(password.encode()).decode())
        if code != 235:
            print(f"  AUTH failed: {code} {resp}")
            return False

        print(f"  Authenticated as {user}")

        server.mail(FROM_EMAIL)
        server.rcpt(to_email)
        server.data(msg.as_bytes())

        server.quit()
        print(f"  Email sent successfully to {to_email}")
        return True

    except Exception as e:
        print(f"  Send failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Send feedback notification email")
    parser.add_argument("--to", required=True, help="Recipient email")
    parser.add_argument("--subject", default="QIP System - Improvement Report", help="Email subject")
    parser.add_argument("--attachment", default=None, help="File to attach")
    parser.add_argument("--body-file", default=None, help="HTML body file (optional)")
    args = parser.parse_args()

    # Build HTML body
    if args.body_file and os.path.exists(args.body_file):
        with open(args.body_file, "r", encoding="utf-8") as f:
            html_body = f.read()
    else:
        # Read attachment content for inline display
        report_text = ""
        if args.attachment and os.path.exists(args.attachment):
            with open(args.attachment, "r", encoding="utf-8") as f:
                report_text = f.read()

        html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color: #334155;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; color: white; text-align: center; margin-bottom: 24px;">
        <h1 style="margin: 0; font-size: 22px;">QIP Incentive System</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">February 2026 - Improvement Report</p>
    </div>

    <div style="background: #f8fafc; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
        <h2 style="color: #1e293b; font-size: 16px; margin-top: 0;">Dear QA Team,</h2>
        <p style="font-size: 14px; line-height: 1.6;">
            Thank you for reporting the issues with the February 2026 QIP Incentive calculation.
            We have investigated and resolved <strong>all 4 reported issues</strong> that were affecting
            <strong>55 employees</strong>.
        </p>
        <p style="font-size: 14px; line-height: 1.6;">
            The detailed improvement report is attached to this email. Below is a brief summary:
        </p>
    </div>

    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #059669; font-size: 15px; margin-top: 0;">Issues Fixed:</h3>
        <ol style="font-size: 14px; line-height: 1.8; padding-left: 20px;">
            <li><strong>Continuous_Months incorrectly showing 2 for all employees</strong>
                <br><span style="color: #64748b;">Root cause: Previous month data path mismatch. Now loads correctly from output_files/.</span></li>
            <li><strong>CFA AQL Inspector Part 2 &amp; Part 3 not calculated</strong>
                <br><span style="color: #64748b;">Same root cause. Now uses Previous_Continuous_Months directly instead of reverse calculation.</span></li>
            <li><strong>Progressive Incentive Table showing wrong values</strong>
                <br><span style="color: #64748b;">7 values corrected in dashboard display (months 2,3,4,9,10,11 were using old V9 values).</span></li>
            <li><strong>minimum_working_days threshold too high (15 &rarr; 12)</strong>
                <br><span style="color: #64748b;">February threshold was blocking all employees. Corrected to 12 days.</span></li>
        </ol>
    </div>

    <div style="background: #f0fdf4; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #059669; font-size: 15px; margin-top: 0;">Verification Results:</h3>
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; color: #64748b;">Total Employees:</td><td style="padding: 6px 0; font-weight: 600;">380</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Receiving Incentive:</td><td style="padding: 6px 0; font-weight: 600;">337</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Total Amount:</td><td style="padding: 6px 0; font-weight: 600;">~172,500,000 VND</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Continuous Months Range:</td><td style="padding: 6px 0; font-weight: 600;">1 to 15 (correctly distributed)</td></tr>
        </table>
    </div>

    <div style="background: #eff6ff; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #1d4ed8; font-size: 15px; margin-top: 0;">Action Required:</h3>
        <p style="font-size: 14px; line-height: 1.6;">
            Please verify the corrected data on the production dashboard:<br>
            <a href="https://moonkaicuzui.github.io/hwk-qip-incentive-v10/" style="color: #2563eb; font-weight: 600;">
                https://moonkaicuzui.github.io/hwk-qip-incentive-v10/
            </a>
        </p>
        <p style="font-size: 14px; line-height: 1.6;">
            Check the following:
        </p>
        <ul style="font-size: 14px; line-height: 1.8;">
            <li>February 2026 Continuous_Months values (should range 1-15)</li>
            <li>AQL Inspector Part 2 &amp; Part 3 incentive amounts</li>
            <li>Progressive Incentive Table values on the dashboard</li>
        </ul>
        <p style="font-size: 14px; line-height: 1.6;">
            If you find any remaining issues, please submit feedback through the
            <strong>System Feedback</strong> page on the dashboard.
        </p>
    </div>

    <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; margin-top: 20px;">
        QIP Incentive Dashboard V10 &middot; HWK QIP System<br>
        This is an automated notification from the QIP system.
    </div>
</body>
</html>"""

    print("=" * 60)
    print(f"  Sending Feedback Improvement Email")
    print(f"  To: {args.to}")
    print(f"  Subject: {args.subject}")
    if args.attachment:
        print(f"  Attachment: {args.attachment}")
    print("=" * 60)

    success = send_email_with_attachment(
        to_email=args.to,
        subject=args.subject,
        html_body=html_body,
        attachment_path=args.attachment,
    )

    if success:
        print("\nEmail sent successfully!")
    else:
        print("\nEmail sending failed.")
        sys.exit(1)


if __name__ == "__main__":
    main()
