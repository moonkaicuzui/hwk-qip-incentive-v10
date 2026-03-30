#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate incentive management report email (ko/en/vi).

Uses the same email_template.py as send_report_email.py so all languages
share the same format. Pulls data from Firestore, builds action_data,
generates HTML, and queues it in pendingNotifications.

Usage:
    python scripts/generate_weekly_report.py --month march --year 2026 --to ksmoon@hsvina.com --lang en
    python scripts/generate_weekly_report.py --month march --year 2026 --to "a@hsvina.com,b@hsvina.com" --lang en
    python scripts/generate_weekly_report.py --month march --year 2026 --to ksmoon@hsvina.com --dry-run
"""

import os
import sys
import argparse
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from scripts.utils.firebase_common import init_firestore
from scripts.send_report_email import load_firestore_data, build_action_report, load_previous_month
from scripts.email_template import generate_email_html

DASHBOARD_URL = "https://moonkaicuzui.github.io/hwk-qip-incentive-v10/"


def get_prev_month(month):
    """Get previous month name."""
    months = ["january", "february", "march", "april", "may", "june",
              "july", "august", "september", "october", "november", "december"]
    idx = months.index(month.lower())
    return months[idx - 1] if idx > 0 else months[11]


def get_prev_year(month, year):
    """Get year for previous month."""
    return year - 1 if month.lower() == "january" else year


def main():
    parser = argparse.ArgumentParser(description="Generate incentive report email")
    parser.add_argument("--month", required=True, help="Target month (e.g., march)")
    parser.add_argument("--year", type=int, required=True, help="Target year (e.g., 2026)")
    parser.add_argument("--to", required=True, help="Recipient emails (comma-separated)")
    parser.add_argument("--lang", default="en", help="Language: ko, en, vi (default: en)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without queueing")
    args = parser.parse_args()

    month = args.month.lower()
    year = args.year
    lang = args.lang.lower()
    recipients = [e.strip() for e in args.to.split(",") if e.strip()]

    print("=" * 60)
    print(f"  QIP Report Generator (lang={lang})")
    print("=" * 60)

    db = init_firestore()

    # Load data using the same function as send_report_email
    print(f"\n  Loading {month.capitalize()} {year} data...")
    firestore_data = load_firestore_data(db, month, year)
    employees = firestore_data.get("employees", [])
    print(f"  → {len(employees)} employees loaded")

    if not employees:
        print("  ERROR: No employee data found!")
        sys.exit(1)

    # Load previous month for comparison
    print(f"  Loading previous month data...")
    prev_data = load_previous_month(db, month, year)
    if prev_data:
        firestore_data["previous"] = prev_data
        print(f"  → Previous month loaded")
    else:
        print(f"  → No previous month data")

    # Load config for data period info
    config = None
    config_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..",
        "config_files", f"config_{month}_{year}.json"
    )
    if os.path.exists(config_path):
        import json
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
        dr = config.get("data_date_ranges", {}).get("attendance", {})
        if dr:
            print(f"  → Data period: {dr.get('min')} — {dr.get('max')}")

    # Build action report (same data structure as Korean report)
    print("\n  Building action report...")
    action_data = build_action_report(firestore_data)

    # Generate HTML using the shared template
    now = datetime.now(timezone.utc)
    generated_at = now.strftime("%Y-%m-%d %H:%M")
    print(f"  Generating {lang} report...")
    html = generate_email_html(
        action_data,
        month=month,
        year=year,
        dashboard_url=DASHBOARD_URL,
        generated_at=generated_at,
        lang=lang,
        config=config,
    )
    print(f"  → HTML generated: {len(html):,} bytes")

    # Subject by language
    if lang == "vi":
        month_idx = ["january","february","march","april","may","june",
                     "july","august","september","october","november","december"].index(month) + 1
        subject = f"[Weekly Update] QIP T\u00ecnh h\u00ecnh Th\u01b0\u1edfng — Th\u00e1ng {month_idx}/{year}"
    elif lang == "en":
        subject = f"[Weekly Update] QIP Incentive Status — {month.capitalize()} {year}"
    else:
        month_ko = {"january": "1월", "february": "2월", "march": "3월", "april": "4월",
                    "may": "5월", "june": "6월", "july": "7월", "august": "8월",
                    "september": "9월", "october": "10월", "november": "11월", "december": "12월"}
        subject = f"[Weekly Update] QIP 인센티브 현황 — {year}년 {month_ko.get(month, month)}"

    if args.dry_run:
        print(f"\n  [DRY-RUN] Subject: {subject}")
        print(f"  [DRY-RUN] To: {', '.join(recipients)}")
        print(f"  [DRY-RUN] HTML size: {len(html):,} bytes")
        os.makedirs("output_files", exist_ok=True)
        preview_path = f"output_files/report_preview_{lang}.html"
        with open(preview_path, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"  [DRY-RUN] Preview saved: {preview_path}")
        return

    # Queue notification for each recipient
    print(f"\n  Queueing to {len(recipients)} recipients...")
    for recipient in recipients:
        doc_ref = db.collection("pendingNotifications").add({
            "reporterEmail": recipient,
            "title": f"Report — {month.capitalize()} {year}",
            "newStatus": "report",
            "customSubject": subject,
            "customHtml": html,
            "sent": False,
            "createdAt": now.isoformat() + "Z",
            "changedBy": "QIP Report System",
        })
        doc_id = doc_ref[1].id if isinstance(doc_ref, tuple) else doc_ref.id
        print(f"  → Queued for {recipient}: {doc_id}")

    print(f"\n  Subject: {subject}")
    print(f"  Recipients: {', '.join(recipients)}")
    print("\n  Done! Trigger GitHub Actions to send.")
    print("=" * 60)


if __name__ == "__main__":
    main()
