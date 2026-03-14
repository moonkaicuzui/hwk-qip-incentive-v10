#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Send QIP Incentive Policy V3 documents via email.
Generates both EN/VI policy documents and sends them as attachments.

Usage (in GitHub Actions with SMTP_USER/SMTP_PASSWORD env vars):
    python scripts/send_policy_email.py --to "hwk_qa@hsvina.com"
"""

import os
import sys
import smtplib
import ssl
import base64
import argparse
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

SMTP_HOST = "mail.hsvina.com"
SMTP_PORT = 465
FROM_NAME = "QIP Incentive Dashboard"
FROM_EMAIL = "ksmoon@hsvina.com"


def get_smtp_credentials():
    user = os.environ.get("SMTP_USER", "")
    password = os.environ.get("SMTP_PASSWORD", "")
    if user and password:
        return user, password
    # Try Firestore
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")
        from scripts.utils.firebase_common import init_firestore
        db = init_firestore()
        doc = db.collection("config").document("email").get()
        if doc.exists:
            cfg = doc.to_dict()
            return cfg.get("smtp_user", ""), cfg.get("smtp_password", "")
    except Exception:
        pass
    return "", ""


def send_email(to_email, subject, html_body, attachment_paths):
    user, password = get_smtp_credentials()
    if not user or not password:
        print("ERROR: No SMTP credentials. Set SMTP_USER/SMTP_PASSWORD.")
        return False

    msg = MIMEMultipart()
    msg["Subject"] = subject
    msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    for fpath in attachment_paths:
        if not os.path.exists(fpath):
            print(f"  WARNING: {fpath} not found, skipping")
            continue
        fname = os.path.basename(fpath)
        with open(fpath, "rb") as f:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", "attachment", filename=fname)
        msg.attach(part)
        print(f"  Attached: {fname} ({os.path.getsize(fpath):,} bytes)")

    print(f"  Connecting to {SMTP_HOST}:{SMTP_PORT}...")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=30, context=ctx)
    server.ehlo()
    code, resp = server.docmd("AUTH LOGIN", base64.b64encode(user.encode()).decode())
    if code == 334:
        code, resp = server.docmd(base64.b64encode(password.encode()).decode())
    if code != 235:
        print(f"  AUTH failed: {code} {resp}")
        return False
    print("  AUTH OK")

    server.sendmail(FROM_EMAIL, [to_email], msg.as_string())
    server.quit()
    print(f"  Email sent to {to_email}")
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--to", required=True)
    args = parser.parse_args()

    # Generate policy documents
    print("Generating English policy document...")
    from generate_policy_v3_docx import create_policy_en
    en_doc = create_policy_en()
    en_path = "/tmp/QIP_INCENTIVE_POLICY_V3_En.docx"
    en_doc.save(en_path)
    print(f"  Saved: {en_path} ({os.path.getsize(en_path):,} bytes)")

    print("Generating Vietnamese policy document...")
    from generate_policy_v3_vi_docx import create_policy_vi
    vi_doc = create_policy_vi()
    vi_path = "/tmp/QIP_INCENTIVE_POLICY_V3_Vi.docx"
    vi_doc.save(vi_path)
    print(f"  Saved: {vi_path} ({os.path.getsize(vi_path):,} bytes)")

    html = """<html><body style="font-family:Calibri,sans-serif;max-width:700px;margin:0 auto;">
<h2 style="color:#2F5496;border-bottom:2px solid #2F5496;padding-bottom:8px;">QIP Incentive Policy V3 — Major Update</h2>
<p>Dear QIP Team,</p>
<p>The QIP Incentive Policy documents (Version 3) have been significantly improved. Both English and Vietnamese versions are attached.</p>

<h3 style="color:#2F5496;">Key Improvements:</h3>
<ul>
<li><b>Detailed Condition Explanations</b> — Each of 10 conditions now has What/Why/Who sections with PASS/FAIL examples and step-by-step calculations</li>
<li><b>Absence Classification Table</b> — 12 approved leave types vs 2 unapproved (AR1 only)</li>
<li><b>System Screenshots</b> — 5+ real dashboard screenshots in both English and Vietnamese</li>
<li><b>FAQ Section</b> — 10+ frequently asked questions with detailed answers</li>
<li><b>Simple Language</b> — Written for new employees who know nothing about the system</li>
</ul>

<h3 style="color:#2F5496;">Attachments:</h3>
<ol>
<li><b>English:</b> QIP INCENTIVE POLICY V3 (EN)</li>
<li><b>Vietnamese:</b> QIP INCENTIVE POLICY V3 (VI)</li>
</ol>

<p style="margin-top:20px;padding-top:10px;border-top:1px solid #ddd;color:#666;font-size:12px;">
Generated by HWK QIP Incentive System V10<br>QIP Department - HWK Vina</p>
</body></html>"""

    subject = "QIP Incentive Policy V3 - Updated with Detailed Explanations & Examples (EN/VI)"
    send_email(args.to, subject, html, [en_path, vi_path])


if __name__ == "__main__":
    main()
