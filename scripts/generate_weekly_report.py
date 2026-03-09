#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate weekly/monthly incentive management report email.

Pulls employee data from Firestore, computes management insights,
generates HTML email, and queues it in pendingNotifications.

Usage:
    python scripts/generate_weekly_report.py --month february --year 2026 --to ksmoon@hsvina.com
    python scripts/generate_weekly_report.py --month february --year 2026 --to ksmoon@hsvina.com --dry-run
"""

import os
import sys
import argparse
import math
from datetime import datetime, timezone
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from scripts.utils.firebase_common import init_firestore

DASHBOARD_URL = "https://moonkaicuzui.github.io/hwk-qip-incentive-v10/"

# Condition descriptions (Korean)
CONDITION_NAMES = {
    "c1": "출근율",
    "c2": "무단결근",
    "c3": "실근무일",
    "c4": "최소근무일",
    "c5": "AQL 개인실패",
    "c6": "AQL 연속실패",
    "c7": "AQL 팀실패",
    "c8": "Reject Rate",
    "c9": "5PRS 통과율",
    "c10": "5PRS 검사량",
}

# Condition descriptions (English)
CONDITION_NAMES_EN = {
    "c1": "Attendance Rate",
    "c2": "Unapproved Absence",
    "c3": "Actual Working Days",
    "c4": "Min Working Days",
    "c5": "AQL Personal Fail",
    "c6": "AQL Consecutive",
    "c7": "AQL Team/Area",
    "c8": "Area Reject Rate",
    "c9": "5PRS Pass Rate",
    "c10": "5PRS Inspection Qty",
}


def load_employees(db, month, year):
    """Load employee data from Firestore."""
    doc_key = f"{month}_{year}"
    doc = db.collection("employees").document(doc_key).collection("all_data").document("data").get()
    if not doc.exists:
        return []
    data = doc.to_dict()
    return data.get("employees", [])


def load_summary(db, month, year):
    """Load dashboard summary from Firestore."""
    doc_key = f"{month}_{year}"
    doc = db.collection("dashboard_summary").document(doc_key).get()
    if not doc.exists:
        return {}
    return doc.to_dict()


def analyze_borderline(employees):
    """Find borderline employees: close to passing or at risk of failing.

    Returns dict of condition -> {manageable: [...], at_risk: [...]}
    """
    borderline = {}

    # Define borderline ranges per condition
    # (condition_key, value_key, threshold_key, is_gte, manageable_range, risk_range)
    checks = [
        # C1: attendance rate >= threshold (default 88-90%)
        ("c1", "c1_value", "c1_threshold", True, (0.85, 1.0), (1.0, 1.05)),
        # C4: min working days >= threshold
        ("c4", "c4_value", "c4_threshold", True, (0.75, 1.0), (1.0, 1.2)),
        # C9: 5PRS pass rate >= threshold (default 95-97%)
        ("c9", "c9_value", "c9_threshold", True, (0.95, 1.0), (1.0, 1.03)),
        # C10: 5PRS inspection qty >= threshold
        ("c10", "c10_value", "c10_threshold", True, (0.80, 1.0), (1.0, 1.2)),
    ]

    for cond_key, val_key, thresh_key, is_gte, mgmt_range, risk_range in checks:
        manageable = []
        at_risk = []

        for emp in employees:
            cond_result = emp.get("conditions", {}).get(cond_key, "N/A")
            if cond_result == "N/A":
                continue

            cv = emp.get("condition_values", {})
            value = cv.get(val_key, 0)
            threshold = cv.get(thresh_key, 0)

            if threshold == 0:
                continue

            ratio = value / threshold if threshold else 0

            if cond_result == "NO":  # FAIL
                if mgmt_range[0] <= ratio < mgmt_range[1]:
                    manageable.append({
                        "emp_no": emp.get("emp_no"),
                        "name": emp.get("full_name"),
                        "building": emp.get("building"),
                        "value": value,
                        "threshold": threshold,
                        "gap": threshold - value if is_gte else value - threshold,
                    })
            elif cond_result == "YES":  # PASS
                if risk_range[0] <= ratio < risk_range[1]:
                    at_risk.append({
                        "emp_no": emp.get("emp_no"),
                        "name": emp.get("full_name"),
                        "building": emp.get("building"),
                        "value": value,
                        "threshold": threshold,
                    })

        if manageable or at_risk:
            borderline[cond_key] = {
                "manageable": manageable,
                "at_risk": at_risk,
            }

    return borderline


def analyze_changes(employees):
    """Analyze incentive gains and losses vs previous month."""
    gained = []  # prev=0, current>0
    lost = []    # prev>0, current=0

    for emp in employees:
        curr = emp.get("current_incentive", 0) or 0
        prev = emp.get("previous_incentive", 0) or 0

        if prev > 0 and curr == 0:
            # Find which conditions failed
            failed_conditions = []
            conditions = emp.get("conditions", {})
            for i in range(1, 11):
                key = f"c{i}"
                if conditions.get(key) == "NO":
                    failed_conditions.append(CONDITION_NAMES.get(key, key))

            lost.append({
                "emp_no": emp.get("emp_no"),
                "name": emp.get("full_name"),
                "building": emp.get("building"),
                "position": emp.get("position"),
                "prev_amount": prev,
                "failed_conditions": failed_conditions,
                "prev_continuous": emp.get("previous_continuous_months", 0),
            })
        elif prev == 0 and curr > 0:
            gained.append({
                "emp_no": emp.get("emp_no"),
                "name": emp.get("full_name"),
                "building": emp.get("building"),
                "amount": curr,
            })

    return gained, lost


def analyze_buildings(employees):
    """Building performance ranking."""
    buildings = defaultdict(lambda: {"total": 0, "receiving": 0, "amount": 0, "fails": defaultdict(int)})

    for emp in employees:
        bldg = emp.get("building", "Unknown") or "Unknown"
        buildings[bldg]["total"] += 1
        curr = emp.get("current_incentive", 0) or 0
        if curr > 0:
            buildings[bldg]["receiving"] += 1
            buildings[bldg]["amount"] += curr

        # Track failure conditions per building
        conditions = emp.get("conditions", {})
        for i in range(1, 11):
            key = f"c{i}"
            if conditions.get(key) == "NO":
                buildings[bldg]["fails"][key] += 1

    # Calculate rates and sort
    result = []
    for bldg, data in buildings.items():
        rate = (data["receiving"] / data["total"] * 100) if data["total"] > 0 else 0
        # Find top failure condition
        top_fail = ""
        top_fail_count = 0
        for k, v in data["fails"].items():
            if v > top_fail_count:
                top_fail = k
                top_fail_count = v

        result.append({
            "building": bldg,
            "total": data["total"],
            "receiving": data["receiving"],
            "rate": rate,
            "amount": data["amount"],
            "top_fail": CONDITION_NAMES.get(top_fail, ""),
            "top_fail_count": top_fail_count,
        })

    result.sort(key=lambda x: x["rate"], reverse=True)
    return result


def analyze_continuous_months(employees):
    """Continuous months distribution and talent pool analysis."""
    distribution = defaultdict(int)
    talent_pool = []
    near_talent = []  # 10-11 months (approaching talent pool)
    streak_broken = []  # had streak > 0 previously, now 0

    for emp in employees:
        cm = emp.get("continuous_months", 0) or 0
        pcm = emp.get("previous_continuous_months", 0) or 0
        emp_type = emp.get("type", "")
        curr = emp.get("current_incentive", 0) or 0

        if emp_type != "TYPE-1":
            continue

        distribution[cm] += 1

        if cm >= 12:
            talent_pool.append({
                "name": emp.get("full_name"),
                "months": cm,
                "building": emp.get("building"),
            })
        elif cm in (10, 11):
            near_talent.append({
                "name": emp.get("full_name"),
                "months": cm,
                "building": emp.get("building"),
                "months_to_tp": 12 - cm,
            })

        if pcm >= 3 and curr == 0:
            streak_broken.append({
                "name": emp.get("full_name"),
                "prev_months": pcm,
                "building": emp.get("building"),
                "position": emp.get("position"),
            })

    return distribution, talent_pool, near_talent, streak_broken


def analyze_condition_failures(employees):
    """Condition-level failure analysis."""
    stats = {}
    for i in range(1, 11):
        key = f"c{i}"
        passed = 0
        failed = 0
        na = 0
        for emp in employees:
            v = emp.get("conditions", {}).get(key, "N/A")
            if v == "YES":
                passed += 1
            elif v == "NO":
                failed += 1
            else:
                na += 1

        applicable = passed + failed
        pass_rate = (passed / applicable * 100) if applicable > 0 else 0
        stats[key] = {
            "passed": passed,
            "failed": failed,
            "na": na,
            "applicable": applicable,
            "pass_rate": pass_rate,
        }

    return stats


def analyze_boss_performance(employees):
    """Boss/team leader performance (TYPE-2 subordinates under TYPE-1 leaders)."""
    boss_stats = defaultdict(lambda: {"total": 0, "receiving": 0, "amount": 0})

    for emp in employees:
        boss = emp.get("boss_name", "") or ""
        if not boss or boss in ("", "N/A"):
            continue
        curr = emp.get("current_incentive", 0) or 0
        boss_stats[boss]["total"] += 1
        if curr > 0:
            boss_stats[boss]["receiving"] += 1
            boss_stats[boss]["amount"] += curr

    result = []
    for boss, data in boss_stats.items():
        if data["total"] < 3:  # Skip very small teams
            continue
        rate = (data["receiving"] / data["total"] * 100) if data["total"] > 0 else 0
        result.append({
            "boss": boss,
            "total": data["total"],
            "receiving": data["receiving"],
            "rate": rate,
        })

    result.sort(key=lambda x: x["rate"], reverse=True)
    return result


def format_vnd(amount):
    """Format VND amount."""
    if amount >= 1_000_000:
        return f"{amount/1_000_000:,.1f}M"
    elif amount >= 1_000:
        return f"{amount/1_000:,.0f}K"
    return f"{amount:,.0f}"


def generate_html(month, year, summary, employees, prev_employees):
    """Generate management-focused HTML report."""
    now = datetime.now(timezone.utc)
    week_num = now.isocalendar()[1]
    month_cap = month.capitalize()

    total = len(employees)
    receiving = sum(1 for e in employees if (e.get("current_incentive", 0) or 0) > 0)
    total_amount = sum(e.get("current_incentive", 0) or 0 for e in employees)
    rate = (receiving / total * 100) if total > 0 else 0

    # Previous month comparison
    prev_total = len(prev_employees) if prev_employees else 0
    prev_receiving = sum(1 for e in prev_employees if (e.get("current_incentive", 0) or 0) > 0) if prev_employees else 0
    prev_amount = sum(e.get("current_incentive", 0) or 0 for e in prev_employees) if prev_employees else 0
    prev_rate = (prev_receiving / prev_total * 100) if prev_total > 0 else 0

    amount_change = total_amount - prev_amount
    rate_change = rate - prev_rate
    receiving_change = receiving - prev_receiving

    # Run all analyses
    borderline = analyze_borderline(employees)
    gained, lost = analyze_changes(employees)
    buildings = analyze_buildings(employees)
    cond_stats = analyze_condition_failures(employees)
    cm_dist, talent_pool, near_talent, streak_broken = analyze_continuous_months(employees)
    boss_perf = analyze_boss_performance(employees)

    # Count total manageable employees
    total_manageable = sum(len(v["manageable"]) for v in borderline.values())
    potential_rate = ((receiving + total_manageable) / total * 100) if total > 0 else rate

    # ---- Build HTML ----
    # Helper for trend arrows
    def trend_arrow(val, reverse=False):
        if val > 0:
            color = "#059669" if not reverse else "#dc2626"
            return f'<span style="color:{color}">▲ +{val:.1f}</span>'
        elif val < 0:
            color = "#dc2626" if not reverse else "#059669"
            return f'<span style="color:{color}">▼ {val:.1f}</span>'
        return '<span style="color:#64748b">— 0</span>'

    # ---- Section: Condition failure bars ----
    cond_bars_html = ""
    sorted_conds = sorted(cond_stats.items(), key=lambda x: x[1]["failed"], reverse=True)
    for key, stat in sorted_conds:
        if stat["applicable"] == 0:
            continue
        bar_pct = stat["pass_rate"]
        fail_count = stat["failed"]
        bar_color = "#059669" if bar_pct >= 90 else "#f59e0b" if bar_pct >= 80 else "#dc2626"
        cond_bars_html += f"""
        <div style="display:flex;align-items:center;margin:4px 0;font-size:13px;">
            <div style="width:120px;color:#64748b;">{CONDITION_NAMES.get(key, key)}</div>
            <div style="flex:1;background:#f1f5f9;border-radius:4px;height:20px;margin:0 8px;position:relative;">
                <div style="width:{bar_pct:.0f}%;background:{bar_color};height:100%;border-radius:4px;"></div>
            </div>
            <div style="width:45px;text-align:right;font-weight:600;">{bar_pct:.0f}%</div>
            <div style="width:55px;text-align:right;color:#dc2626;font-size:12px;">{fail_count} fail</div>
        </div>"""

    # ---- Section: Borderline / Action Items ----
    action_items_html = ""
    if borderline:
        for key, data in borderline.items():
            mgmt = data["manageable"]
            risk = data["at_risk"]
            if mgmt:
                action_items_html += f"""
                <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 8px 8px 0;margin:8px 0;">
                    <div style="font-weight:700;color:#92400e;font-size:13px;">
                        {CONDITION_NAMES.get(key, key)} — {len(mgmt)}명 개선 가능
                    </div>
                    <div style="font-size:12px;color:#78350f;margin-top:4px;">
                        기준에 근접하여 관리하면 인센티브 수령 가능한 직원들
                    </div>
                    <div style="font-size:11px;color:#92400e;margin-top:6px;">
                        건물별: {', '.join(f'{b}: {c}명' for b, c in sorted(
                            defaultdict(int, {e["building"]: 0 for e in mgmt}).items()
                        ) if c > 0) if mgmt else ''}
                    </div>
                </div>"""
            if risk:
                action_items_html += f"""
                <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;margin:8px 0;">
                    <div style="font-weight:700;color:#991b1b;font-size:13px;">
                        {CONDITION_NAMES.get(key, key)} — {len(risk)}명 하락 위험
                    </div>
                    <div style="font-size:12px;color:#7f1d1d;margin-top:4px;">
                        현재 통과하고 있으나 기준에 아슬아슬한 직원들
                    </div>
                </div>"""

    # Borderline building breakdown
    if borderline:
        bldg_counts = defaultdict(int)
        for key, data in borderline.items():
            for e in data["manageable"]:
                bldg_counts[e["building"]] += 1
        if bldg_counts:
            sorted_bldgs = sorted(bldg_counts.items(), key=lambda x: x[1], reverse=True)
            action_items_html += f"""
            <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:0 8px 8px 0;margin:8px 0;">
                <div style="font-weight:700;color:#1e40af;font-size:13px;">
                    개선 가능 직원 건물 분포 (총 {total_manageable}명)
                </div>
                <div style="font-size:12px;color:#1e3a5f;margin-top:4px;">
                    {', '.join(f'{b}: {c}명' for b, c in sorted_bldgs[:8])}
                </div>
                <div style="font-size:12px;color:#2563eb;margin-top:6px;font-weight:600;">
                    → 이 직원들을 관리하면 수령률 {rate:.1f}% → {potential_rate:.1f}% 향상 가능
                </div>
            </div>"""

    # ---- Section: Building ranking ----
    building_rows = ""
    for i, b in enumerate(buildings[:10]):
        medal = "🥇" if i == 0 else "🥈" if i == 1 else "🥉" if i == 2 else f"{i+1}"
        rate_color = "#059669" if b["rate"] >= 85 else "#f59e0b" if b["rate"] >= 70 else "#dc2626"
        building_rows += f"""
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 6px;text-align:center;font-size:13px;">{medal}</td>
            <td style="padding:8px 6px;font-weight:600;font-size:13px;">{b['building']}</td>
            <td style="padding:8px 6px;text-align:center;font-size:13px;">{b['total']}</td>
            <td style="padding:8px 6px;text-align:center;font-size:13px;">{b['receiving']}</td>
            <td style="padding:8px 6px;text-align:center;font-weight:700;color:{rate_color};font-size:13px;">{b['rate']:.0f}%</td>
            <td style="padding:8px 6px;text-align:right;font-size:13px;">{format_vnd(b['amount'])}</td>
            <td style="padding:8px 6px;text-align:center;font-size:11px;color:#dc2626;">{b['top_fail']} ({b['top_fail_count']})</td>
        </tr>"""

    # ---- Section: Change analysis ----
    # Group lost by failure reason
    lost_by_reason = defaultdict(int)
    for l in lost:
        for fc in l["failed_conditions"]:
            lost_by_reason[fc] += 1
    lost_reasons_html = ""
    for reason, count in sorted(lost_by_reason.items(), key=lambda x: x[1], reverse=True)[:5]:
        lost_reasons_html += f'<span style="display:inline-block;background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:12px;font-size:11px;margin:2px;">{reason}: {count}명</span> '

    # ---- Section: Continuous months ----
    ranges = {"1개월": 0, "2-3개월": 0, "4-6개월": 0, "7-11개월": 0, "12+개월": 0}
    for months, count in cm_dist.items():
        if months <= 0:
            continue
        elif months == 1:
            ranges["1개월"] += count
        elif months <= 3:
            ranges["2-3개월"] += count
        elif months <= 6:
            ranges["4-6개월"] += count
        elif months <= 11:
            ranges["7-11개월"] += count
        else:
            ranges["12+개월"] += count

    cm_bars = ""
    max_range = max(ranges.values()) if ranges.values() else 1
    for label, count in ranges.items():
        pct = (count / max_range * 100) if max_range > 0 else 0
        cm_bars += f"""
        <div style="display:flex;align-items:center;margin:3px 0;font-size:12px;">
            <div style="width:70px;color:#64748b;">{label}</div>
            <div style="flex:1;background:#f1f5f9;border-radius:3px;height:16px;margin:0 8px;">
                <div style="width:{pct:.0f}%;background:#6366f1;height:100%;border-radius:3px;min-width:2px;"></div>
            </div>
            <div style="width:35px;text-align:right;font-weight:600;font-size:12px;">{count}명</div>
        </div>"""

    # ---- Section: Boss performance (Top 3 & Bottom 3) ----
    boss_html = ""
    if len(boss_perf) >= 6:
        top3 = boss_perf[:3]
        bottom3 = boss_perf[-3:]
        boss_html = '<div style="display:flex;gap:16px;flex-wrap:wrap;">'
        boss_html += '<div style="flex:1;min-width:200px;">'
        boss_html += '<div style="font-weight:700;color:#059669;font-size:12px;margin-bottom:4px;">Best Teams</div>'
        for b in top3:
            boss_html += f'<div style="font-size:12px;padding:3px 0;"><strong>{b["boss"]}</strong> — {b["rate"]:.0f}% ({b["receiving"]}/{b["total"]})</div>'
        boss_html += '</div>'
        boss_html += '<div style="flex:1;min-width:200px;">'
        boss_html += '<div style="font-weight:700;color:#dc2626;font-size:12px;margin-bottom:4px;">Needs Attention</div>'
        for b in bottom3:
            boss_html += f'<div style="font-size:12px;padding:3px 0;"><strong>{b["boss"]}</strong> — {b["rate"]:.0f}% ({b["receiving"]}/{b["total"]})</div>'
        boss_html += '</div></div>'

    # ---- Assemble full HTML ----
    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;max-width:680px;margin:0 auto;padding:20px;color:#1e293b;background:#f8fafc;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:28px;border-radius:14px;color:white;margin-bottom:20px;">
        <div style="font-size:12px;opacity:0.8;text-transform:uppercase;letter-spacing:1px;">QIP Incentive Management Report</div>
        <h1 style="margin:6px 0 0 0;font-size:22px;">{month_cap} {year} — Week {week_num}</h1>
        <div style="font-size:12px;opacity:0.7;margin-top:4px;">Generated: {now.strftime('%Y-%m-%d %H:%M UTC')}</div>
    </div>

    <!-- KPI Cards -->
    <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">
        <div style="flex:1;min-width:140px;background:white;border-radius:10px;padding:16px;border:1px solid #e2e8f0;">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;">Total Employees</div>
            <div style="font-size:28px;font-weight:800;color:#1e293b;">{total}</div>
            <div style="font-size:11px;">{trend_arrow(total - prev_total) if prev_total else ''} vs prev</div>
        </div>
        <div style="flex:1;min-width:140px;background:white;border-radius:10px;padding:16px;border:1px solid #e2e8f0;">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;">Recipients</div>
            <div style="font-size:28px;font-weight:800;color:#059669;">{receiving}</div>
            <div style="font-size:11px;">{trend_arrow(receiving_change)} ({rate:.1f}%)</div>
        </div>
        <div style="flex:1;min-width:140px;background:white;border-radius:10px;padding:16px;border:1px solid #e2e8f0;">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;">Total Amount</div>
            <div style="font-size:28px;font-weight:800;color:#2563eb;">{format_vnd(total_amount)}</div>
            <div style="font-size:11px;">{trend_arrow(amount_change/1_000_000) if prev_amount else ''} M vs prev</div>
        </div>
    </div>

    <!-- Section 1: Action Items / Early Warning -->
    <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0;">
        <h2 style="margin:0 0 12px 0;font-size:16px;color:#1e293b;border-bottom:2px solid #f59e0b;padding-bottom:8px;">
            ⚠️ 관리 포인트 — Action Required
        </h2>
        <div style="font-size:13px;color:#64748b;margin-bottom:12px;">
            기준에 근접한 직원을 관리하면 수령률을 <strong style="color:#059669;">{potential_rate:.1f}%</strong>까지 올릴 수 있습니다 (현재 {rate:.1f}%)
        </div>
        {action_items_html if action_items_html else '<div style="color:#64748b;font-size:13px;">경계선 직원 없음</div>'}
    </div>

    <!-- Section 2: Incentive Change Analysis -->
    <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0;">
        <h2 style="margin:0 0 12px 0;font-size:16px;color:#1e293b;border-bottom:2px solid #6366f1;padding-bottom:8px;">
            🔄 인센티브 변동 분석
        </h2>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;">
            <div style="flex:1;min-width:150px;background:#fef2f2;border-radius:8px;padding:14px;text-align:center;">
                <div style="font-size:32px;font-weight:800;color:#dc2626;">{len(lost)}</div>
                <div style="font-size:12px;color:#991b1b;">수령 → 미수령 전환</div>
                <div style="font-size:11px;color:#7f1d1d;margin-top:4px;">인센티브 상실</div>
            </div>
            <div style="flex:1;min-width:150px;background:#f0fdf4;border-radius:8px;padding:14px;text-align:center;">
                <div style="font-size:32px;font-weight:800;color:#059669;">{len(gained)}</div>
                <div style="font-size:12px;color:#166534;">미수령 → 수령 전환</div>
                <div style="font-size:11px;color:#14532d;margin-top:4px;">신규 수령</div>
            </div>
            <div style="flex:1;min-width:150px;background:#eff6ff;border-radius:8px;padding:14px;text-align:center;">
                <div style="font-size:32px;font-weight:800;color:{'#059669' if len(gained) >= len(lost) else '#dc2626'};">{'+' if len(gained) >= len(lost) else ''}{len(gained) - len(lost)}</div>
                <div style="font-size:12px;color:#1e40af;">순 변동</div>
                <div style="font-size:11px;color:#1e3a5f;margin-top:4px;">{'개선 추세' if len(gained) >= len(lost) else '하락 추세'}</div>
            </div>
        </div>
        {'<div style="margin-top:8px;"><div style="font-size:12px;font-weight:700;color:#991b1b;margin-bottom:6px;">상실 사유 분류:</div>' + lost_reasons_html + '</div>' if lost_reasons_html else ''}
    </div>

    <!-- Section 3: Condition Failure Analysis -->
    <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0;">
        <h2 style="margin:0 0 12px 0;font-size:16px;color:#1e293b;border-bottom:2px solid #dc2626;padding-bottom:8px;">
            📊 조건별 통과율
        </h2>
        {cond_bars_html}
    </div>

    <!-- Section 4: Building Performance Ranking -->
    <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0;">
        <h2 style="margin:0 0 12px 0;font-size:16px;color:#1e293b;border-bottom:2px solid #059669;padding-bottom:8px;">
            🏢 건물별 성과 순위
        </h2>
        <table style="width:100%;border-collapse:collapse;">
            <thead>
                <tr style="border-bottom:2px solid #e2e8f0;">
                    <th style="padding:8px 6px;font-size:11px;color:#64748b;text-align:center;">#</th>
                    <th style="padding:8px 6px;font-size:11px;color:#64748b;text-align:left;">Building</th>
                    <th style="padding:8px 6px;font-size:11px;color:#64748b;text-align:center;">Total</th>
                    <th style="padding:8px 6px;font-size:11px;color:#64748b;text-align:center;">Recv</th>
                    <th style="padding:8px 6px;font-size:11px;color:#64748b;text-align:center;">Rate</th>
                    <th style="padding:8px 6px;font-size:11px;color:#64748b;text-align:right;">Amount</th>
                    <th style="padding:8px 6px;font-size:11px;color:#64748b;text-align:center;">Top Fail</th>
                </tr>
            </thead>
            <tbody>{building_rows}</tbody>
        </table>
    </div>

    <!-- Section 5: Continuous Months & Talent Pool -->
    <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0;">
        <h2 style="margin:0 0 12px 0;font-size:16px;color:#1e293b;border-bottom:2px solid #8b5cf6;padding-bottom:8px;">
            📈 연속 수령 현황 (TYPE-1)
        </h2>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;">
            <div style="flex:1;min-width:150px;background:#faf5ff;border-radius:8px;padding:14px;text-align:center;">
                <div style="font-size:28px;font-weight:800;color:#7c3aed;">{len(talent_pool)}</div>
                <div style="font-size:12px;color:#6d28d9;">Talent Pool (12+)</div>
            </div>
            <div style="flex:1;min-width:150px;background:#eff6ff;border-radius:8px;padding:14px;text-align:center;">
                <div style="font-size:28px;font-weight:800;color:#2563eb;">{len(near_talent)}</div>
                <div style="font-size:12px;color:#1d4ed8;">Talent Pool 진입 예정</div>
                <div style="font-size:10px;color:#64748b;">(10-11개월)</div>
            </div>
            <div style="flex:1;min-width:150px;background:#fef2f2;border-radius:8px;padding:14px;text-align:center;">
                <div style="font-size:28px;font-weight:800;color:#dc2626;">{len(streak_broken)}</div>
                <div style="font-size:12px;color:#991b1b;">연속 수령 중단</div>
                <div style="font-size:10px;color:#64748b;">(3개월+ 연속 후 상실)</div>
            </div>
        </div>
        <div style="margin-top:12px;">
            <div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:6px;">연속 수령 분포:</div>
            {cm_bars}
        </div>
        {f'''<div style="margin-top:12px;background:#faf5ff;border-radius:8px;padding:12px;">
            <div style="font-size:12px;font-weight:700;color:#7c3aed;margin-bottom:4px;">Talent Pool 진입 예정자 ({len(near_talent)}명):</div>
            <div style="font-size:11px;color:#6d28d9;">{"、".join(f"{t['name']} ({t['months']}개월, {t['building']})" for t in near_talent)}</div>
        </div>''' if near_talent else ''}
        {f'''<div style="margin-top:8px;background:#fef2f2;border-radius:8px;padding:12px;">
            <div style="font-size:12px;font-weight:700;color:#dc2626;margin-bottom:4px;">연속 수령 중단자 ({len(streak_broken)}명):</div>
            <div style="font-size:11px;color:#991b1b;">{"、".join(f"{s['name']} ({s['prev_months']}개월→중단, {s['building']})" for s in streak_broken[:10])}{f'... 외 {len(streak_broken)-10}명' if len(streak_broken) > 10 else ''}</div>
        </div>''' if streak_broken else ''}
    </div>

    <!-- Section 6: Team Performance -->
    {f'''<div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0;">
        <h2 style="margin:0 0 12px 0;font-size:16px;color:#1e293b;border-bottom:2px solid #f97316;padding-bottom:8px;">
            👥 관리자별 팀 성과
        </h2>
        {boss_html}
    </div>''' if boss_html else ''}

    <!-- Section 7: Management Recommendations -->
    <div style="background:linear-gradient(135deg,#f0fdf4,#eff6ff);border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0;">
        <h2 style="margin:0 0 12px 0;font-size:16px;color:#1e293b;">
            💡 관리 권고사항
        </h2>
        <ul style="font-size:13px;line-height:1.8;color:#334155;padding-left:20px;margin:0;">
            {f'<li><strong>경계선 직원 {total_manageable}명 집중 관리</strong> → 수령률 {rate:.1f}% → {potential_rate:.1f}% 향상 가능</li>' if total_manageable > 0 else ''}
            {f'<li><strong>인센티브 상실 {len(lost)}명</strong> 중 주요 사유: {", ".join(f"{r}({c}명)" for r, c in list(sorted(lost_by_reason.items(), key=lambda x: x[1], reverse=True))[:3])}</li>' if lost else ''}
            {f'<li><strong>건물 {buildings[-1]["building"]}</strong> 수령률 {buildings[-1]["rate"]:.0f}%로 최하위 — {buildings[-1]["top_fail"]} 조건 개선 필요</li>' if buildings and buildings[-1]["rate"] < 80 else ''}
            {f'<li><strong>Talent Pool 진입 예정 {len(near_talent)}명</strong> — 연속 수령 유지 독려 필요</li>' if near_talent else ''}
            {f'<li><strong>연속 수령 중단 {len(streak_broken)}명</strong> (평균 {sum(s["prev_months"] for s in streak_broken)/len(streak_broken):.1f}개월 연속 후 상실) — 원인 파악 필요</li>' if streak_broken else ''}
        </ul>
    </div>

    <!-- Dashboard Link -->
    <div style="text-align:center;margin:20px 0;">
        <a href="{DASHBOARD_URL}web/dashboard.html" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;padding:12px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
            대시보드에서 상세 확인
        </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;margin-top:20px;">
        QIP Incentive Dashboard V10 · Weekly Management Report<br>
        이 보고서는 자동으로 생성되었습니다 · {now.strftime('%Y-%m-%d')}
    </div>

</body>
</html>"""

    return html


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
    parser = argparse.ArgumentParser(description="Generate weekly incentive management report")
    parser.add_argument("--month", required=True, help="Target month (e.g., february)")
    parser.add_argument("--year", type=int, required=True, help="Target year (e.g., 2026)")
    parser.add_argument("--to", required=True, help="Recipient email")
    parser.add_argument("--dry-run", action="store_true", help="Print HTML without queueing")
    args = parser.parse_args()

    month = args.month.lower()
    year = args.year

    print("=" * 60)
    print("  QIP Weekly Management Report Generator")
    print("=" * 60)

    db = init_firestore()

    # Load current month data
    print(f"\n  Loading {month.capitalize()} {year} data...")
    employees = load_employees(db, month, year)
    summary = load_summary(db, month, year)
    print(f"  → {len(employees)} employees loaded")

    if not employees:
        print("  ERROR: No employee data found!")
        sys.exit(1)

    # Load previous month data for comparison
    prev_month = get_prev_month(month)
    prev_year = get_prev_year(month, year)
    print(f"  Loading {prev_month.capitalize()} {prev_year} data...")
    prev_employees = load_employees(db, prev_month, prev_year)
    print(f"  → {len(prev_employees)} previous month employees loaded")

    # Generate HTML
    print("\n  Generating report...")
    html = generate_html(month, year, summary, employees, prev_employees)
    print(f"  → HTML generated: {len(html):,} bytes")

    now = datetime.now(timezone.utc)
    week_num = now.isocalendar()[1]
    subject = f"[QIP Weekly] {month.capitalize()} {year} Incentive Management Report — Week {week_num}"

    if args.dry_run:
        print(f"\n  [DRY-RUN] Subject: {subject}")
        print(f"  [DRY-RUN] To: {args.to}")
        print(f"  [DRY-RUN] HTML size: {len(html):,} bytes")
        # Save to file for preview
        preview_path = f"output_files/weekly_report_preview.html"
        with open(preview_path, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"  [DRY-RUN] Preview saved: {preview_path}")
        return

    # Queue notification in Firestore
    print(f"\n  Queueing notification to {args.to}...")
    doc_ref = db.collection("pendingNotifications").add({
        "reporterEmail": args.to,
        "title": f"Weekly Report — {month.capitalize()} {year}",
        "newStatus": "report",
        "customSubject": subject,
        "customHtml": html,
        "sent": False,
        "createdAt": now.isoformat() + "Z",
        "changedBy": "QIP Report System",
    })

    doc_id = doc_ref[1].id if isinstance(doc_ref, tuple) else doc_ref.id
    print(f"  → Queued: {doc_id}")
    print(f"  → Subject: {subject}")

    print("\n  Done! Trigger GitHub Actions to send the email.")
    print("=" * 60)


if __name__ == "__main__":
    main()
