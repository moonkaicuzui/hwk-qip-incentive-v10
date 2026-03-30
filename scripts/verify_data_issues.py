#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
QIP Data Verification — detect issues and queue alert email.

Runs after weekly report generation. If data issues are found,
queues an "[Action Required]" email to hwk_qa@hsvina.com and ksmoon@hsvina.com.

Usage:
    python scripts/verify_data_issues.py --month march --year 2026
    python scripts/verify_data_issues.py --month march --year 2026 --dry-run
"""

import os
import sys
import argparse
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from scripts.utils.firebase_common import init_firestore

ALERT_RECIPIENTS = ["hwk_qa@hsvina.com", "ksmoon@hsvina.com"]


def detect_issues(db, month, year):
    """Scan employee data for anomalies. Returns list of issue dicts."""
    doc = db.collection("employees").document(f"{month}_{year}").collection("all_data").document("data").get()
    if not doc.exists:
        return []

    employees = doc.to_dict().get("employees", [])
    issues = []

    # --- Issue: TYPE-2 with AQL data ---
    type2_aql = []
    for e in employees:
        if e.get("type") == "TYPE-2":
            aql = e.get("aql", {})
            tests = int(aql.get("total_tests", 0) or 0)
            if tests > 0:
                type2_aql.append({
                    "emp_no": e.get("emp_no", ""),
                    "name": e.get("full_name", ""),
                    "building": e.get("building", ""),
                    "tests": tests,
                    "fails": int(aql.get("failures", 0) or 0),
                })
    if type2_aql:
        issues.append({
            "id": "TYPE2_AQL",
            "severity": "HIGH",
            "title": "TYPE-2 Employees with AQL Data",
            "description": "TYPE-2 employees should not have AQL inspections. They are evaluated only on attendance conditions (C1-C4).",
            "action": "Verify if these employees should be TYPE-1, or if AQL data was incorrectly assigned.",
            "employees": type2_aql,
        })

    # --- Issue: TYPE-3 with AQL data ---
    type3_aql = []
    for e in employees:
        if e.get("type") == "TYPE-3":
            aql = e.get("aql", {})
            tests = int(aql.get("total_tests", 0) or 0)
            if tests > 0:
                type3_aql.append({
                    "emp_no": e.get("emp_no", ""),
                    "name": e.get("full_name", ""),
                    "building": e.get("building", ""),
                    "tests": tests,
                    "fails": int(aql.get("failures", 0) or 0),
                })
    if type3_aql:
        issues.append({
            "id": "TYPE3_AQL",
            "severity": "MEDIUM",
            "title": "TYPE-3 (New Hires) with AQL Data",
            "description": "New hire employees classified as TYPE-3 have AQL inspection data.",
            "action": "Check if these employees have been promoted to TYPE-1 but not reclassified.",
            "employees": type3_aql,
        })

    # --- Issue: Extremely high unapproved absence (non-resigned) ---
    high_absence = []
    for e in employees:
        if e.get("stop_working_date"):
            continue
        att = e.get("attendance", {})
        unapp = float(att.get("unapproved_absence", 0) or 0)
        if unapp >= 5:
            high_absence.append({
                "emp_no": e.get("emp_no", ""),
                "name": e.get("full_name", ""),
                "building": e.get("building", ""),
                "type": e.get("type", ""),
                "unapproved_absence": unapp,
                "attendance_rate": float(att.get("rate", 0) or 0),
            })
    if high_absence:
        issues.append({
            "id": "HIGH_ABSENCE",
            "severity": "MEDIUM",
            "title": f"Active Employees with 5+ Unapproved Absence Days",
            "description": "These employees are NOT resigned but have very high unapproved absence. May need status verification.",
            "action": "Confirm if these employees are still active or should be marked as resigned.",
            "employees": high_absence,
        })

    return issues


def build_alert_html(issues, month, year):
    """Build HTML email for data verification alert."""
    month_cap = month.capitalize()
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    sections = ""
    for i, issue in enumerate(issues, 1):
        sev_color = "#dc2626" if issue["severity"] == "HIGH" else "#f59e0b"
        sev_bg = "#fef2f2" if issue["severity"] == "HIGH" else "#fefce8"

        rows = ""
        emps = issue["employees"]
        # Build table based on issue type
        if issue["id"] in ("TYPE2_AQL", "TYPE3_AQL"):
            header = """<tr style="background:#f8f9fb;">
                <th style="padding:8px;text-align:left;border-bottom:2px solid #e2e8f0;">Emp No</th>
                <th style="padding:8px;text-align:left;border-bottom:2px solid #e2e8f0;">Name</th>
                <th style="padding:8px;text-align:center;border-bottom:2px solid #e2e8f0;">Building</th>
                <th style="padding:8px;text-align:center;border-bottom:2px solid #e2e8f0;">TYPE</th>
                <th style="padding:8px;text-align:center;border-bottom:2px solid #e2e8f0;">AQL Tests</th>
                <th style="padding:8px;text-align:center;border-bottom:2px solid #e2e8f0;">AQL Fails</th>
            </tr>"""
            emp_type = "TYPE-2" if "TYPE2" in issue["id"] else "TYPE-3"
            for emp in emps:
                rows += f"""<tr style="background:{sev_bg};">
                    <td style="padding:8px;border-bottom:1px solid #eee;">{emp['emp_no']}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">{emp['name']}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;">{emp['building']}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;color:#dc2626;font-weight:700;">{emp_type}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;">{emp['tests']}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;">{emp['fails']}</td>
                </tr>"""
        else:
            header = """<tr style="background:#f8f9fb;">
                <th style="padding:8px;text-align:left;border-bottom:2px solid #e2e8f0;">Emp No</th>
                <th style="padding:8px;text-align:left;border-bottom:2px solid #e2e8f0;">Name</th>
                <th style="padding:8px;text-align:center;border-bottom:2px solid #e2e8f0;">Building</th>
                <th style="padding:8px;text-align:center;border-bottom:2px solid #e2e8f0;">TYPE</th>
                <th style="padding:8px;text-align:center;border-bottom:2px solid #e2e8f0;">Att. Rate</th>
                <th style="padding:8px;text-align:center;border-bottom:2px solid #e2e8f0;">Unapp. Abs.</th>
            </tr>"""
            for emp in emps:
                rows += f"""<tr style="background:{sev_bg};">
                    <td style="padding:8px;border-bottom:1px solid #eee;">{emp['emp_no']}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">{emp['name']}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;">{emp['building']}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;">{emp.get('type','')}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;">{emp.get('attendance_rate',0):.1f}%</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;">{emp.get('unapproved_absence',0)}</td>
                </tr>"""

        sections += f"""
        <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
            <div style="background:{sev_bg};padding:14px 24px;border-bottom:2px solid {sev_color};">
                <span style="font-size:16px;font-weight:700;color:{sev_color};">Issue #{i}: {issue['title']}</span>
                <span style="display:inline-block;margin-left:10px;padding:2px 8px;background:{sev_color};color:white;border-radius:4px;font-size:11px;font-weight:600;">{issue['severity']}</span>
                <span style="float:right;font-size:13px;color:#64748b;">{len(emps)} employee(s)</span>
            </div>
            <div style="padding:20px 24px;">
                <p style="font-size:14px;color:#334155;line-height:1.7;margin:0 0 12px 0;">
                    <strong>What we found:</strong> {issue['description']}
                </p>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    {header}
                    {rows}
                </table>
                <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:0 6px 6px 0;margin-top:16px;font-size:13px;color:#1e40af;">
                    <strong>Please verify:</strong> {issue['action']}
                </div>
            </div>
        </div>"""

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;max-width:1400px;margin:0 auto;padding:24px;color:#1e293b;background:#f8fafc;">
    <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:24px 32px;border-radius:14px;color:white;margin-bottom:24px;">
        <div style="font-size:11px;opacity:0.8;text-transform:uppercase;letter-spacing:1.5px;">Action Required — Data Verification</div>
        <h1 style="margin:6px 0 0 0;font-size:22px;">QIP {month_cap} {year} — {len(issues)} Data Issue(s) Found</h1>
        <p style="margin:6px 0 0 0;font-size:13px;opacity:0.85;">Generated: {now_str} &middot; Please verify and respond</p>
    </div>
    {sections}
    <div style="text-align:center;padding:16px;color:#94a3b8;font-size:11px;">
        QIP Incentive Dashboard V10 &middot; Automated Data Verification<br/>
        This check runs every Monday with the weekly report. Reply to ksmoon@hsvina.com for questions.
    </div>
</body></html>"""


def main():
    parser = argparse.ArgumentParser(description="QIP Data Verification")
    parser.add_argument("--month", required=True)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    month = args.month.lower()
    year = args.year

    print("=" * 60)
    print("  QIP Data Verification")
    print("=" * 60)

    db = init_firestore()

    print(f"\n  Scanning {month.capitalize()} {year}...")
    issues = detect_issues(db, month, year)

    if not issues:
        print("  ✅ No data issues found. No alert email needed.")
        return

    print(f"  ⚠️  {len(issues)} issue(s) found:")
    for issue in issues:
        print(f"    [{issue['severity']}] {issue['title']} — {len(issue['employees'])} employee(s)")

    html = build_alert_html(issues, month, year)
    subject = f"[QIP Action Required] Data Verification — {month.capitalize()} {year}"

    if args.dry_run:
        os.makedirs("output_files", exist_ok=True)
        with open("output_files/verification_alert.html", "w", encoding="utf-8") as f:
            f.write(html)
        print(f"\n  [DRY-RUN] Preview saved: output_files/verification_alert.html")
        return

    now = datetime.now(timezone.utc)
    for recipient in ALERT_RECIPIENTS:
        db.collection("pendingNotifications").add({
            "reporterEmail": recipient,
            "title": "Data Verification Alert",
            "newStatus": "report",
            "customSubject": subject,
            "customHtml": html,
            "sent": False,
            "createdAt": now.isoformat() + "Z",
            "changedBy": "QIP Data Verifier",
        })
        print(f"  → Queued for {recipient}")

    print(f"\n  Subject: {subject}")
    print("  Done!")
    print("=" * 60)


if __name__ == "__main__":
    main()
