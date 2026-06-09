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
from scripts.send_report_email import (
    load_firestore_data,
    build_action_report,
    load_previous_month,
    load_basic_manpower_csv,
    merge_type_change_history,
)
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

    # 2026-06-09 (Firebase 기반화, KH-QOS-008): 수신자를 YAML/코드 하드코딩 대신 Firestore SSOT 에서.
    #   config/email_recipients.incentive.weekly[lang] 우선, 비면 --to fallback (메일 절대 안 끊김).
    try:
        _rdoc = db.collection('config').document('email_recipients').get()
        if _rdoc.exists:
            _cron = (_rdoc.to_dict() or {}).get('incentive', {}).get('weekly', {})
            _fs = _cron.get(lang) or _cron.get('all')
            if isinstance(_fs, list) and _fs:
                recipients = [str(e).strip() for e in _fs if str(e).strip()]
                print(f"  -> recipients from QOS Firestore (incentive.weekly.{lang}): {recipients}")
    except Exception as _e:
        print(f"  -> Firestore recipients lookup failed, using --to fallback: {_e}")

    # Load data using the same function as send_report_email
    print(f"\n  Loading {month.capitalize()} {year} data...")
    firestore_data = load_firestore_data(db, month, year)
    employees = firestore_data.get("employees", [])
    print(f"  → {len(employees)} employees loaded")

    if not employees:
        print("  ERROR: No employee data found!")
        sys.exit(1)

    # Enrich employees with QIP POSITION 1ST/2ND/3RD NAME + lab/qip remark
    # from basic_manpower CSV (Firestore에 이 필드들이 없으므로 메일 전용 join).
    print(f"  Loading basic_manpower CSV for QIP POSITION enrichment...")
    manpower_map = load_basic_manpower_csv(month)
    if manpower_map:
        for e in employees:
            emp_no = str(e.get("emp_no", "")).strip()
            if emp_no in manpower_map:
                e.update(manpower_map[emp_no])

    # Load previous month for comparison
    print(f"  Loading previous month data...")
    prev_data = load_previous_month(db, month, year)
    if prev_data:
        firestore_data["previous"] = prev_data
        # Enrich prev month employees too (변동 비교 안정성)
        prev_emps = prev_data.get("employees", [])
        if prev_emps and manpower_map:
            for e in prev_emps:
                emp_no = str(e.get("emp_no", "")).strip()
                if emp_no in manpower_map:
                    e.update(manpower_map[emp_no])
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

    # Merge TYPE 변경 history (idempotent, first-detection 시각 보존).
    # 빨강 박스 강조 결정에 사용 — detected_at < 7일이면 "최근 변경".
    if action_data.get("employee_changes"):
        year_month_key = f"{year}_{month}"
        merge_type_change_history(db, action_data["employee_changes"], year_month_key)
        recent_count = sum(1 for c in action_data["employee_changes"]
                           if c.get("type_days_since") is not None and c["type_days_since"] <= 7)
        print(f"  → TYPE history merged. 최근 7일 이내 변경: {recent_count}명")

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
