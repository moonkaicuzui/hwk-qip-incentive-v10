#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
QIP Data Verification — detect issues and queue alert email.

Runs after weekly report generation. If data issues are found,
queues an "[Action Required]" email to hwk_qa@hsvina.com and ksmoon@hsvina.com.

Verification items (confirmed with management):
  1. TYPE-2 employees with AQL data (should not have AQL)
  2. AQL tests=0 but C5(AQL Personal)=YES (auto-PASS without inspection)
  3. Active employees (not resigned) with 5+ unapproved absence days

Excluded by design:
  - Resigned employee incentive amounts (frontend handles display)
  - continuous_months=0 (updated at month-end only)
  - TYPE-1 managers without PRS data (management roles, not inspectors)
  - Resigned employee conditions YES/NO (history preservation)
  - Employees without boss_name (top-level managers)

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

    # --- Issue 1: TYPE-2 with AQL data ---
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
            "description": (
                "TYPE-2 employees should NOT have AQL inspections. "
                "They are evaluated only on attendance conditions (C1-C4). "
                "Either these employees should be reclassified as TYPE-1, "
                "or AQL data was incorrectly assigned to them in the source file."
            ),
            "action": (
                "1. Check Basic Manpower file — is this employee's TYPE correct?<br/>"
                "2. Check AQL History file — is AQL data linked to the correct employee?<br/>"
                "3. If TYPE should be TYPE-1, update in source data."
            ),
            "employees": type2_aql,
            "table_type": "aql",
        })

    # --- Issue 2: AQL tests=0 but C5=YES (auto-PASS without inspection) ---
    auto_pass = []
    for e in employees:
        if e.get("type") != "TYPE-1" or e.get("stop_working_date"):
            continue
        aql = e.get("aql", {})
        tests = int(aql.get("total_tests", 0) or 0)
        conds = e.get("conditions", {})
        c5 = conds.get("c5", "N/A")
        if tests == 0 and c5 == "YES":
            auto_pass.append({
                "emp_no": e.get("emp_no", ""),
                "name": e.get("full_name", ""),
                "building": e.get("building", ""),
                "position": e.get("position", ""),
                "aql_tests": 0,
                "c5": "YES",
                "c6": conds.get("c6", "N/A"),
                "c7": conds.get("c7", "N/A"),
            })
    if auto_pass:
        issues.append({
            "id": "AQL_AUTO_PASS",
            "severity": "MEDIUM",
            "title": "TYPE-1 with Zero AQL Tests but C5=YES (Auto-PASS)",
            "description": (
                "These TYPE-1 employees have no AQL inspection records, "
                "but their C5 (AQL Personal Fail) condition is marked as YES (PASS). "
                "This means they passed the AQL condition without any actual inspection. "
                "If they are supposed to perform AQL inspections, this is a data gap."
            ),
            "action": (
                "1. Verify if these employees should be performing AQL inspections.<br/>"
                "2. If yes — check why no AQL data exists for them this month.<br/>"
                "3. If no (management/indirect role) — C5 should be N/A, not YES."
            ),
            "employees": auto_pass,
            "table_type": "auto_pass",
        })

    # --- Issue 3: Active employees with 5+ unapproved absence ---
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
            "description": (
                "These employees are NOT marked as resigned but have very high "
                "unapproved absence (5+ days). They may have actually left the company "
                "without proper resignation processing, or there may be a data entry issue."
            ),
            "action": (
                "1. Confirm if these employees are still actively working.<br/>"
                "2. If they have left — update stop_working_date in source data.<br/>"
                "3. If still active — confirm absence reasons with their supervisors."
            ),
            "employees": high_absence,
            "table_type": "absence",
        })

    # --- Issue 4: Non-TYPE-3 employees without boss (data gap) ---
    no_boss = []
    supervisor_positions = {"SUPERVISOR", "MANAGER", "A.MANAGER", "DIRECTOR", "GENERAL MANAGER"}
    for e in employees:
        if e.get("type") == "TYPE-3" or e.get("stop_working_date"):
            continue
        boss = e.get("boss_name", "") or ""
        if boss in ("", "-", "N/A"):
            pos = (e.get("position", "") or "").upper()
            # Skip top-level managers — they legitimately have no boss
            if any(sp in pos for sp in supervisor_positions):
                continue
            att = e.get("attendance") or {}
            no_boss.append({
                "emp_no": e.get("emp_no", ""),
                "name": e.get("full_name", ""),
                "building": e.get("building", ""),
                "type": e.get("type", ""),
                "position": e.get("position", ""),
                "actual_days": att.get("actual_days", 0),
                "approved_leave": att.get("approved_leave", 0),
                "total_days": att.get("total_days", 0),
                "unapproved_absence": att.get("unapproved_absence", 0),
            })
    if no_boss:
        issues.append({
            "id": "NO_BOSS",
            "severity": "MEDIUM",
            "title": "Non-management Employees without Supervisor Assignment",
            "description": (
                "These employees are NOT top-level managers but have no supervisor (boss) assigned. "
                "This means they are invisible in the management chain — their issues won't appear "
                "under any team leader in the weekly report."
            ),
            "action": (
                "1. Check Basic Manpower file — is the boss_id column filled for these employees?<br/>"
                "2. Assign the correct Line Leader or Supervisor.<br/>"
                "3. If they report directly to management, this can be ignored.<br/>"
                "<span style=\"color:#7c3aed;\">★ If <b>Working Days ≈ 0</b> and <b>Approved Leave ≈ Total Days</b> "
                "(shown in italic gray) → likely on long-term leave (maternity/medical) and can be ignored.</span>"
            ),
            "employees": no_boss,
            "table_type": "no_boss",
        })

    return issues


def build_alert_html(issues, month, year):
    """Build HTML email for data verification alert."""
    month_cap = month.capitalize()
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    total_emps = sum(len(issue["employees"]) for issue in issues)

    sections = ""
    for i, issue in enumerate(issues, 1):
        sev_color = "#dc2626" if issue["severity"] == "HIGH" else "#f59e0b"
        sev_bg = "#fef2f2" if issue["severity"] == "HIGH" else "#fefce8"

        rows = ""
        emps = issue["employees"]
        ttype = issue.get("table_type", "")

        if ttype == "aql":
            header = """<tr style="background:#f8f9fb;">
                <th style="padding:10px;text-align:left;border-bottom:2px solid #e2e8f0;">Emp No</th>
                <th style="padding:10px;text-align:left;border-bottom:2px solid #e2e8f0;">Name</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">Building</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">AQL Tests</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">AQL Fails</th>
            </tr>"""
            for emp in emps:
                rows += f"""<tr style="background:{sev_bg};">
                    <td style="padding:8px;border-bottom:1px solid #eee;">{emp['emp_no']}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">{emp['name']}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;">{emp['building']}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;">{emp['tests']}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;">{emp['fails']}</td>
                </tr>"""
        elif ttype == "auto_pass":
            header = """<tr style="background:#f8f9fb;">
                <th style="padding:10px;text-align:left;border-bottom:2px solid #e2e8f0;">Emp No</th>
                <th style="padding:10px;text-align:left;border-bottom:2px solid #e2e8f0;">Name</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">Building</th>
                <th style="padding:10px;text-align:left;border-bottom:2px solid #e2e8f0;">Position</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">AQL Tests</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">C5</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">C7</th>
            </tr>"""
            for emp in emps:
                rows += f"""<tr style="background:{sev_bg};">
                    <td style="padding:8px;border-bottom:1px solid #eee;">{emp['emp_no']}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">{emp['name']}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;">{emp['building']}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px;">{emp['position']}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;">{emp['aql_tests']}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;color:#dc2626;font-weight:700;">{emp['c5']}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;">{emp['c7']}</td>
                </tr>"""
        elif ttype == "no_boss":
            header = """<tr style="background:#f8f9fb;">
                <th style="padding:10px;text-align:left;border-bottom:2px solid #e2e8f0;">Emp No</th>
                <th style="padding:10px;text-align:left;border-bottom:2px solid #e2e8f0;">Name</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">Building</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">TYPE</th>
                <th style="padding:10px;text-align:left;border-bottom:2px solid #e2e8f0;">Position</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">Working Days</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">Approved Leave</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">Unapp. Absence</th>
            </tr>"""
            for emp in emps:
                actual = emp.get('actual_days', 0) or 0
                approved = emp.get('approved_leave', 0) or 0
                total = emp.get('total_days', 0) or 0
                unapp = emp.get('unapproved_absence', 0) or 0
                # 장기 승인 휴가 시각적 강조 (raw 데이터만 표시, 자동 분류 X)
                long_leave = total > 0 and actual <= total * 0.2 and approved >= total * 0.8
                wd_style = "color:#94a3b8;font-style:italic;" if long_leave else ""
                rows += f"""<tr style="background:{sev_bg};">
                    <td style="padding:8px;border-bottom:1px solid #eee;">{emp['emp_no']}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">{emp['name']}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;">{emp['building']}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;">{emp.get('type','')}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;">{emp.get('position','')}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;{wd_style}">{actual} / {total}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;{wd_style}">{approved}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;{'color:#dc2626;font-weight:700;' if unapp > 0 else ''}">{unapp}</td>
                </tr>"""
        else:  # absence
            header = """<tr style="background:#f8f9fb;">
                <th style="padding:10px;text-align:left;border-bottom:2px solid #e2e8f0;">Emp No</th>
                <th style="padding:10px;text-align:left;border-bottom:2px solid #e2e8f0;">Name</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">Building</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">TYPE</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">Att. Rate</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">Unapp. Absence</th>
            </tr>"""
            for emp in emps:
                rows += f"""<tr style="background:{sev_bg};">
                    <td style="padding:8px;border-bottom:1px solid #eee;">{emp['emp_no']}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">{emp['name']}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;">{emp['building']}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;">{emp.get('type','')}</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;">{emp.get('attendance_rate',0):.1f}%</td>
                    <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;font-weight:700;color:#dc2626;">{emp.get('unapproved_absence',0):.0f}</td>
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
                    <strong>Please verify:</strong><br/>{issue['action']}
                </div>
            </div>
        </div>"""

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;max-width:1400px;margin:0 auto;padding:24px;color:#1e293b;background:#f8fafc;">
    <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:24px 32px;border-radius:14px;color:white;margin-bottom:24px;">
        <div style="font-size:11px;opacity:0.8;text-transform:uppercase;letter-spacing:1.5px;">Action Required — Data Verification</div>
        <h1 style="margin:6px 0 0 0;font-size:22px;">QIP {month_cap} {year} — {len(issues)} Issue(s), {total_emps} Employee(s)</h1>
        <p style="margin:6px 0 0 0;font-size:13px;opacity:0.85;">Generated: {now_str} &middot; Please verify and respond</p>
    </div>
    {sections}
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 24px;margin-bottom:16px;font-size:13px;color:#1e40af;">
        This verification runs automatically every Monday with the weekly QIP report.<br/>
        If no issues are found, this email is not sent.
    </div>
    <div style="text-align:center;padding:16px;color:#94a3b8;font-size:11px;">
        QIP Incentive Dashboard V10 &middot; Automated Data Verification<br/>
        Reply to ksmoon@hsvina.com for questions.
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
    from datetime import date
    today = date.today().strftime("%B %d %Y")
    subject = f"[QA Review Required] QIP Incentive Data Verification — {today}"

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
