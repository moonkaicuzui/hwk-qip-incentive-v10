#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
QIP Incentive 이메일 리포트 HTML 템플릿

액션 지향 이메일 리포트 생성:
- Section 1: 핵심 KPI 요약
- Section 2: Building별 품질 현황
- Section 3: AQL 실패자 상세 (담당자 체인)
- Section 4: 연속 AQL 실패 경고
- Section 5: 5PRS 미달자 상세
- Section 6: 출근 미달자 상세
- Section 7: TYPE별 인센티브 현황
- Section 8: 액션 링크

Usage:
    from email_template import generate_email_html
    html = generate_email_html(action_data, month='february', year=2026)
"""

# ---------------------------------------------------------------------------
# Inline CSS Styles (이메일 클라이언트 호환: Gmail, Outlook, 모바일)
# ---------------------------------------------------------------------------

STYLES = {
    # ── Foundation ──────────────────────────────────────────────
    "body": "margin:0;padding:0;background-color:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#1f2937;-webkit-text-size-adjust:100%;",
    "container": "max-width:2200px;margin:0 auto;background:#ffffff;",
    # ── Header (executive style) ────────────────────────────────
    "header": "background:#0f1f3a;color:#ffffff;padding:40px 56px 36px 56px;border-bottom:3px solid #c8a96a;",
    "header_eyebrow": "font-size:11px;letter-spacing:2.5px;color:#c8a96a;text-transform:uppercase;font-weight:600;margin:0 0 8px 0;",
    "header_title": "font-size:26px;font-weight:600;margin:0 0 6px 0;letter-spacing:-0.3px;line-height:1.25;",
    "header_sub": "font-size:13px;color:#9aa8c0;margin:0;font-weight:400;",
    # ── Section structure ───────────────────────────────────────
    "section_title": "font-size:14px;font-weight:700;color:#0f1f3a;margin:0;padding:20px 28px 0 28px;letter-spacing:0.3px;text-transform:uppercase;border-left:3px solid #c8a96a;padding-left:25px;margin:20px 28px 14px 28px;",
    "section_body": "padding:0 28px 24px 28px;",
    "section_card": "background:#ffffff;border:1px solid #e5e9f0;border-radius:6px;margin:14px 24px;padding:0;overflow:hidden;",
    "divider": "border:none;margin:0;",
    # ── Progress banner ─────────────────────────────────────────
    "progress_banner": "background:#f8f9fc;border:1px solid #e5e9f0;border-left:3px solid #0f1f3a;border-radius:4px;padding:16px 20px;margin:20px 28px;font-size:13px;color:#1e293b;",
    "progress_bar_bg": "background:#e5e9f0;border-radius:2px;height:6px;width:100%;overflow:hidden;",
    "progress_bar_fill": "background:#0f1f3a;height:6px;border-radius:2px;",
    # ── Condition bars ──────────────────────────────────────────
    "cond_bar_bg": "background:#eef0f4;border-radius:2px;height:14px;width:100%;position:relative;overflow:hidden;",
    "cond_bar_green": "background:#10b981;height:14px;border-radius:2px;",
    "cond_bar_yellow": "background:#d97706;height:14px;border-radius:2px;",
    "cond_bar_red": "background:#dc2626;height:14px;border-radius:2px;",
    # ── Comparison delta (refined) ──────────────────────────────
    "delta_up": "color:#059669;font-size:11px;font-weight:600;",
    "delta_down": "color:#dc2626;font-size:11px;font-weight:600;",
    "delta_neutral": "color:#94a3b8;font-size:11px;font-weight:500;",
    # ── KPI cards (executive numbers) ───────────────────────────
    "kpi_table": "width:100%;border-collapse:collapse;",
    "kpi_cell": "text-align:center;padding:18px 12px;width:25%;border-right:1px solid #eef0f4;",
    "kpi_cell_last": "text-align:center;padding:18px 12px;width:25%;",
    "kpi_value": "font-size:28px;font-weight:600;color:#0f1f3a;margin:0;letter-spacing:-0.5px;line-height:1.1;",
    "kpi_label": "font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1.2px;margin:6px 0 0 0;font-weight:500;",
    # ── Tables (clean grid) ─────────────────────────────────────
    "table": "width:100%;border-collapse:collapse;font-size:13px;",
    "th": "background:#fafbfc;color:#475569;font-weight:600;padding:10px 12px;text-align:left;border-bottom:1px solid #e5e9f0;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;",
    "th_center": "background:#fafbfc;color:#475569;font-weight:600;padding:10px 12px;text-align:center;border-bottom:1px solid #e5e9f0;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;",
    "td": "padding:10px 12px;border-bottom:1px solid #f1f3f7;color:#1e293b;",
    "td_center": "padding:10px 12px;border-bottom:1px solid #f1f3f7;color:#1e293b;text-align:center;",
    "tr_total": "background:#fafbfc;font-weight:600;",
    # ── Badges (refined) ────────────────────────────────────────
    "badge_a": "display:inline-block;padding:2px 9px;border-radius:3px;font-size:10px;font-weight:700;background:#d1fae5;color:#065f46;letter-spacing:0.4px;",
    "badge_b": "display:inline-block;padding:2px 9px;border-radius:3px;font-size:10px;font-weight:700;background:#fef3c7;color:#92400e;letter-spacing:0.4px;",
    "badge_c": "display:inline-block;padding:2px 9px;border-radius:3px;font-size:10px;font-weight:700;background:#fee2e2;color:#991b1b;letter-spacing:0.4px;",
    # ── Callout boxes ───────────────────────────────────────────
    "action_box": "background:#f0f4fa;border-left:3px solid #0f1f3a;padding:12px 16px;margin:10px 0 16px 0;border-radius:0 4px 4px 0;font-size:12px;color:#1e293b;line-height:1.6;",
    "action_box_red": "background:#fef5f5;border-left:3px solid #dc2626;padding:12px 16px;margin:10px 0 16px 0;border-radius:0 4px 4px 0;font-size:12px;color:#7f1d1d;line-height:1.6;",
    "action_box_yellow": "background:#fffbeb;border-left:3px solid #d97706;padding:12px 16px;margin:10px 0 16px 0;border-radius:0 4px 4px 0;font-size:12px;color:#78350f;line-height:1.6;",
    # ── Building tag chips ──────────────────────────────────────
    "bldg_a": "display:inline-block;padding:2px 7px;border-radius:3px;font-size:10px;font-weight:700;background:#fee2e2;color:#991b1b;letter-spacing:0.5px;",
    "bldg_b": "display:inline-block;padding:2px 7px;border-radius:3px;font-size:10px;font-weight:700;background:#dbeafe;color:#1e40af;letter-spacing:0.5px;",
    "bldg_b3": "display:inline-block;padding:2px 7px;border-radius:3px;font-size:10px;font-weight:700;background:#e9d5ff;color:#6b21a8;letter-spacing:0.5px;",
    "bldg_c": "display:inline-block;padding:2px 7px;border-radius:3px;font-size:10px;font-weight:700;background:#d1fae5;color:#065f46;letter-spacing:0.5px;",
    "bldg_d": "display:inline-block;padding:2px 7px;border-radius:3px;font-size:10px;font-weight:700;background:#ffedd5;color:#9a3412;letter-spacing:0.5px;",
    "bldg_default": "display:inline-block;padding:2px 7px;border-radius:3px;font-size:10px;font-weight:700;background:#f1f5f9;color:#475569;letter-spacing:0.5px;",
    # ── Footer (corporate) ──────────────────────────────────────
    "footer": "background:#0f1f3a;padding:28px 56px;color:#9aa8c0;",
    "footer_brand": "font-size:12px;font-weight:600;color:#c8a96a;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 6px 0;",
    "footer_meta": "font-size:11px;color:#9aa8c0;margin:0;line-height:1.7;",
    "footer_legal": "font-size:10px;color:#5e6b85;margin:8px 0 0 0;border-top:1px solid #1e3050;padding-top:10px;",
    # ── Misc ────────────────────────────────────────────────────
    "subtitle": "font-size:13px;font-weight:600;color:#0f1f3a;margin:14px 0 10px 0;letter-spacing:0.2px;",
    "boss_chain": "font-size:11px;color:#64748b;margin:0;",
    # ── Change tracking (new) ───────────────────────────────────
    "change_arrow": "color:#94a3b8;font-weight:400;padding:0 6px;",
    "change_old": "color:#94a3b8;text-decoration:line-through;font-size:12px;",
    "change_new": "color:#0f1f3a;font-weight:600;font-size:12px;",
    # Field-specific chip colors (executive priority encoding)
    "chip_type": "display:inline-block;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:700;background:#fee2e2;color:#991b1b;letter-spacing:0.4px;margin-right:6px;",
    "chip_position": "display:inline-block;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:700;background:#dbeafe;color:#1e40af;letter-spacing:0.4px;margin-right:6px;",
    "chip_position_code": "display:inline-block;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:700;background:#f1f5f9;color:#475569;letter-spacing:0.4px;margin-right:6px;",
    "chip_boss": "display:inline-block;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:700;background:#ede9fe;color:#5b21b6;letter-spacing:0.4px;margin-right:6px;",
    "chip_building": "display:inline-block;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:700;background:#cffafe;color:#155e75;letter-spacing:0.4px;margin-right:6px;",
    "chip_cfa": "display:inline-block;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:700;background:#fef3c7;color:#92400e;letter-spacing:0.4px;margin-right:6px;",
    "chip_talent": "display:inline-block;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:700;background:#fce7f3;color:#9d174d;letter-spacing:0.4px;margin-right:6px;",
    "change_field_chip": "display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;background:#f1f5f9;color:#475569;letter-spacing:0.3px;margin-right:6px;",
}


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _fmt_vnd(amount):
    """VND 금액 포맷 (천 단위 쉼표)"""
    if amount is None or amount == 0:
        return "0"
    return f"{amount:,.0f}"


def _fmt_pct(value):
    """퍼센트 포맷"""
    if value is None:
        return "0.0%"
    return f"{value:.1f}%"


def _grade_badge(reject_rate):
    """Area reject rate → 등급 배지 HTML"""
    if reject_rate == 0:
        return f'<span style="{STYLES["badge_a"]}">A</span>'
    elif reject_rate < 2.0:
        return f'<span style="{STYLES["badge_b"]}">B</span>'
    else:
        return f'<span style="{STYLES["badge_c"]}">C</span>'


def _grade_emoji(reject_rate):
    """Area reject rate → 등급 이모지"""
    if reject_rate == 0:
        return "&#x1F7E2;"  # green circle
    elif reject_rate < 2.0:
        return "&#x1F7E1;"  # yellow circle
    else:
        return "&#x1F534;"  # red circle


def _bldg_badge(building):
    """Building 이름 → 색상 배지 HTML"""
    b = str(building).strip().upper()
    if b.startswith("A"):
        style = STYLES["bldg_a"]
    elif b == "B3":
        style = STYLES["bldg_b3"]
    elif b.startswith("B"):
        style = STYLES["bldg_b"]
    elif b.startswith("C"):
        style = STYLES["bldg_c"]
    elif b.startswith("D"):
        style = STYLES["bldg_d"]
    else:
        style = STYLES["bldg_default"]
    return f'<span style="{style}">{building}</span>'


def _boss_chain_html(boss_name, boss_boss_name, boss_boss_position):
    """담당자 → 상사 체인 HTML"""
    chain = f"{boss_name or '-'}"
    if boss_boss_name and boss_boss_name != "-":
        pos_short = ""
        if boss_boss_position:
            p = str(boss_boss_position).upper()
            if "GROUP" in p:
                pos_short = "GL"
            elif "SUPERVISOR" in p or "SUP" in p:
                pos_short = "SV"
            elif "MANAGER" in p:
                pos_short = "MG"
            elif "LINE LEADER" in p:
                pos_short = "LL"
            else:
                pos_short = p[:6]
        boss_suffix = f" ({pos_short})" if pos_short else ""
        chain += f" &#8594; {boss_boss_name}{boss_suffix}"
    return chain


# ---------------------------------------------------------------------------
# i18n - Multi-language support (ko/vi)
# ---------------------------------------------------------------------------

I18N = {
    "ko": {
        # Condition names (matches cond_1~10 in step1 calculation engine)
        "c1": "출근율", "c2": "무단결근", "c3": "실근무일", "c4": "최소근무일",
        "c5": "AQL 개인실패", "c6": "AQL 연속실패", "c7": "AQL 팀/구역",
        "c8": "구역 리젝율", "c9": "5PRS 통과율", "c10": "5PRS 검사량",
        # Month names
        "m1": "1월", "m2": "2월", "m3": "3월", "m4": "4월", "m5": "5월", "m6": "6월",
        "m7": "7월", "m8": "8월", "m9": "9월", "m10": "10월", "m11": "11월", "m12": "12월",
        # Section titles
        "kpi_title": "핵심 KPI",
        "condition_title": "10개 조건별 통과율",
        "building_title": "Building별 품질 현황",
        "aql_fail_title": "AQL 실패자 상세 (즉시 액션 필요)",
        "aql_none": "이번 달 AQL 실패자 없음",
        "consecutive_title": "연속 AQL 실패 경고 (위험 관리)",
        "prs_title": "5PRS 미달자 상세 (품질 검사 관리)",
        "attendance_title": "출근 미달자 상세 (근태 관리)",
        "type_title": "TYPE별 인센티브 현황",
        # Personnel changes section
        "changes_title": "인사 변동 사항 (전월 대비)",
        "changes_none": "전월 대비 변동된 인사 정보가 없습니다.",
        "changes_subtitle": "전월 대비 직급·역할·소속 변경이 발생한 직원입니다.",
        "changes_total": "변동",
        "changes_field_type": "TYPE",
        "changes_field_position": "직책",
        "changes_field_position_code": "직책 코드",
        "changes_field_boss_name": "직속상사",
        "changes_field_building": "소속 Building",
        "changes_field_cfa_certified": "CFA 자격",
        "changes_field_talent_pool_member": "Talent Pool",
        "changes_arrow": "→",
        "link_title": "액션 링크",
        # KPI labels
        "total_emp": "총 직원", "eligible_emp": "적격 직원",
        "cond_rate": "조건 통과율", "cond_fail": "조건 미달 건",
        # Table headers
        "condition": "조건", "desc": "설명", "pass_rate_h": "통과율",
        "pass_applied": "통과/적용", "vs_prev": "전월비",
        "building": "Building", "emp_count": "직원수", "aql": "AQL",
        "fail": "실패", "reject_rate": "리젝율", "grade": "등급",
        "prev_recv": "전월 수령", "emp_no": "사번", "name": "이름",
        "boss_chain": "담당자 → 상사", "att_rate": "출근율",
        "unapp_abs": "무단결근", "insp_qty": "검사량",
        "type": "TYPE", "receivers": "수령자", "pay_rate": "지급률",
        "total_vnd": "총 지급액 (VND)",
        # Progress banner
        "mid_status": "중간 현황", "days_elapsed": "경과",
        "pre_final": "월말 확정 전 데이터입니다. 인센티브 금액은 월말 계산 시 반영됩니다.",
        "prev_result": "실적 (확정)", "of_total": "명 중", "received": "명 수령",
        # Action recommendations
        "bottleneck": "병목 조건 (인센티브 수령 차단 원인):",
        "ppl_below": "명 미달",
        "action_rec": "권고 액션:",
        "aql_retrain": "AQL 재교육. 보고:",
        "subordinate": "부하",
        "consec_3m": "3개월 연속 실패 (인센티브 차단):",
        "consec_2m": "2개월 연속 실패 (경고):",
        "consec_3m_action": "인사 조치 검토 필요. 3개월 연속 실패 시 인센티브 영구 차단.",
        "consec_2m_action": "다음 달 실패 시 3개월 연속 → 각 담당자에게 집중 관리 요청.",
        "prs_rate_below": "5PRS 통과율 미달",
        "prs_qty_below": "5PRS 검사량 미달",
        "prs_action": "각 담당자에게 5PRS 검사 품질 개선 지도 요청.",
        "prs_qty_action": "검사 기회 부족 여부 확인 → 검사 배정 조정 요청.",
        "att_below": "출근율 미달",
        "abs_over": "무단결근 초과",
        "att_action": "무단결근 초과자는 즉시 담당자에게 사유 확인 요청.",
        "abs_action": "각 담당자에게 무단결근 사유 확인 및 재발 방지 지도 요청.",
        "other_bldgs": "기타",
        "bldg_unit": "개 건물",
        "no_aql": "AQL 검사 없음",
        # Links
        "dashboard": "대시보드:",
        "detail_lookup": "상세 직원 조회:",
        "detail_how": "대시보드 → 직원 이름 클릭",
        "aql_analysis": "AQL 분석:",
        "aql_how": "대시보드 → 요약 탭 → AQL 검증 섹션",
        # Footer
        "data_as_of": "데이터 기준:",
        "auto_gen": "(자동 생성)",
        "auto_sent": "이 이메일은 QIP Incentive Dashboard 시스템에서 자동 발송되었습니다.",
        "prev_month": "전월",
        "ppl": "명",
        "days": "일",
    },
    "en": {
        # Condition names (matches cond_1~10 in step1 calculation engine)
        "c1": "Attendance Rate", "c2": "Unapproved Absence", "c3": "Actual Working Days",
        "c4": "Min Working Days", "c5": "AQL Personal Fail", "c6": "AQL Consecutive",
        "c7": "AQL Team/Area", "c8": "Area Reject Rate", "c9": "5PRS Pass Rate",
        "c10": "5PRS Inspection Qty",
        # Month names
        "m1": "January", "m2": "February", "m3": "March", "m4": "April",
        "m5": "May", "m6": "June", "m7": "July", "m8": "August",
        "m9": "September", "m10": "October", "m11": "November", "m12": "December",
        # Section titles
        "kpi_title": "Key KPI",
        "condition_title": "10 Condition Pass Rates",
        "building_title": "Building Quality Status",
        "aql_fail_title": "AQL Failure Details (Action Required)",
        "aql_none": "No AQL failures this month",
        "consecutive_title": "Consecutive AQL Failure Warning (Risk Management)",
        "prs_title": "5PRS Underperformers (Quality Inspection)",
        "attendance_title": "Attendance Underperformers (Attendance Management)",
        "type_title": "Incentive Status by TYPE",
        "changes_title": "Personnel Changes (vs Previous Month)",
        "changes_none": "No personnel changes detected versus the previous month.",
        "changes_subtitle": "Employees whose role, position, or assignment changed since last month.",
        "changes_total": "Changes",
        "changes_field_type": "TYPE",
        "changes_field_position": "Position",
        "changes_field_position_code": "Position Code",
        "changes_field_boss_name": "Supervisor",
        "changes_field_building": "Building",
        "changes_field_cfa_certified": "CFA",
        "changes_field_talent_pool_member": "Talent Pool",
        "changes_arrow": "→",
        "link_title": "Action Links",
        # KPI labels
        "total_emp": "Total Employees", "eligible_emp": "Eligible Employees",
        "cond_rate": "Condition Pass Rate", "cond_fail": "Condition Failures",
        # Table headers
        "condition": "Cond.", "desc": "Description", "pass_rate_h": "Pass Rate",
        "pass_applied": "Pass/Applied", "vs_prev": "vs Prev",
        "building": "Building", "emp_count": "Employees", "aql": "AQL",
        "fail": "Fail", "reject_rate": "Reject Rate", "grade": "Grade",
        "prev_recv": "Prev Month", "emp_no": "Emp No", "name": "Name",
        "boss_chain": "Supervisor \u2192 Manager", "att_rate": "Attendance Rate",
        "unapp_abs": "Unapp. Absence", "insp_qty": "Insp. Qty",
        "type": "TYPE", "receivers": "Recipients", "pay_rate": "Pay Rate",
        "total_vnd": "Total (VND)",
        # Progress banner
        "mid_status": "Mid-Month Status", "days_elapsed": "elapsed",
        "pre_final": "Data is not finalized. Incentive amounts will be calculated at month-end.",
        "prev_result": "Result (Confirmed)", "of_total": " of ", "received": " received",
        # Action recommendations
        "bottleneck": "Bottleneck conditions (blocking incentive):",
        "ppl_below": " below threshold",
        "action_rec": "Recommended Action:",
        "aql_retrain": "AQL retraining. Report to:",
        "subordinate": " subordinates",
        "consec_3m": "3-month consecutive failure (incentive blocked):",
        "consec_2m": "2-month consecutive failure (warning):",
        "consec_3m_action": "HR action review required. 3 consecutive months = permanent incentive block.",
        "consec_2m_action": "If failed next month = 3 months consecutive. Request focused management from supervisors.",
        "prs_rate_below": "5PRS pass rate below threshold",
        "prs_qty_below": "5PRS inspection quantity below threshold",
        "prs_action": "Request supervisors to guide 5PRS inspection quality improvement.",
        "prs_qty_action": "Check for insufficient inspection opportunities. Adjust inspection assignments.",
        "att_below": "Attendance rate below threshold",
        "abs_over": "Unapproved absence exceeded",
        "att_action": "Immediately request supervisors to confirm reason for unapproved absence.",
        "abs_action": "Request supervisors to confirm absence reasons and prevent recurrence.",
        "other_bldgs": "Others",
        "bldg_unit": "buildings",
        "no_aql": "No AQL inspection",
        # Links
        "dashboard": "Dashboard:",
        "detail_lookup": "Employee Lookup:",
        "detail_how": "Dashboard \u2192 Click employee name",
        "aql_analysis": "AQL Analysis:",
        "aql_how": "Dashboard \u2192 Summary tab \u2192 AQL section",
        # Footer
        "data_as_of": "Data as of:",
        "auto_gen": "(auto-generated)",
        "auto_sent": "This email was sent automatically from the QIP Incentive Dashboard system.",
        "prev_month": "prev month",
        "ppl": "",
        "days": "days",
    },
    "vi": {
        # Condition names (matches cond_1~10 in step1 calculation engine)
        "c1": "Tỷ lệ đi làm", "c2": "Vắng không phép", "c3": "Ngày làm thực tế",
        "c4": "Ngày tối thiểu", "c5": "AQL cá nhân", "c6": "AQL liên tiếp",
        "c7": "AQL nhóm/khu vực", "c8": "Tỷ lệ từ chối", "c9": "Tỷ lệ đạt 5PRS",
        "c10": "Số lượng KT 5PRS",
        # Month names
        "m1": "Tháng 1", "m2": "Tháng 2", "m3": "Tháng 3", "m4": "Tháng 4",
        "m5": "Tháng 5", "m6": "Tháng 6", "m7": "Tháng 7", "m8": "Tháng 8",
        "m9": "Tháng 9", "m10": "Tháng 10", "m11": "Tháng 11", "m12": "Tháng 12",
        # Section titles
        "kpi_title": "KPI ch\u00ednh",
        "condition_title": "T\u1ef7 l\u1ec7 \u0111\u1ea1t 10 \u0111i\u1ec1u ki\u1ec7n",
        "building_title": "Ch\u1ea5t l\u01b0\u1ee3ng theo Building",
        "aql_fail_title": "Chi ti\u1ebft l\u1ed7i AQL (C\u1ea7n x\u1eed l\u00fd ngay)",
        "aql_none": "Kh\u00f4ng c\u00f3 l\u1ed7i AQL trong th\u00e1ng n\u00e0y",
        "consecutive_title": "C\u1ea3nh b\u00e1o l\u1ed7i AQL li\u00ean ti\u1ebfp (Qu\u1ea3n l\u00fd r\u1ee7i ro)",
        "prs_title": "Chi ti\u1ebft ch\u01b0a \u0111\u1ea1t 5PRS (Qu\u1ea3n l\u00fd ki\u1ec3m tra ch\u1ea5t l\u01b0\u1ee3ng)",
        "attendance_title": "Chi ti\u1ebft ch\u01b0a \u0111\u1ea1t chuy\u00ean c\u1ea7n (Qu\u1ea3n l\u00fd \u0111i l\u00e0m)",
        "type_title": "Th\u01b0\u1edfng theo TYPE",
        "changes_title": "Thay \u0111\u1ed5i nh\u00e2n s\u1ef1 (so v\u1edbi th\u00e1ng tr\u01b0\u1edbc)",
        "changes_none": "Kh\u00f4ng c\u00f3 thay \u0111\u1ed5i so v\u1edbi th\u00e1ng tr\u01b0\u1edbc.",
        "changes_subtitle": "Nh\u00e2n vi\u00ean c\u00f3 thay \u0111\u1ed5i v\u1ec1 vai tr\u00f2, v\u1ecb tr\u00ed ho\u1eb7c ph\u00e2n c\u00f4ng.",
        "changes_total": "Thay \u0111\u1ed5i",
        "changes_field_type": "TYPE",
        "changes_field_position": "V\u1ecb tr\u00ed",
        "changes_field_position_code": "M\u00e3 v\u1ecb tr\u00ed",
        "changes_field_boss_name": "C\u1ea5p tr\u00ean",
        "changes_field_building": "Building",
        "changes_field_cfa_certified": "CFA",
        "changes_field_talent_pool_member": "Talent Pool",
        "changes_arrow": "\u2192",
        "link_title": "Li\u00ean k\u1ebft h\u00e0nh \u0111\u1ed9ng",
        # KPI labels
        "total_emp": "T\u1ed5ng NV", "eligible_emp": "NV \u0111\u1ee7 \u0111i\u1ec1u ki\u1ec7n",
        "cond_rate": "T\u1ef7 l\u1ec7 \u0111\u1ea1t \u0110K", "cond_fail": "S\u1ed1 \u0110K ch\u01b0a \u0111\u1ea1t",
        # Table headers
        "condition": "\u0110K", "desc": "M\u00f4 t\u1ea3", "pass_rate_h": "T\u1ef7 l\u1ec7 \u0111\u1ea1t",
        "pass_applied": "\u0110\u1ea1t/\u00c1p d\u1ee5ng", "vs_prev": "So th\u00e1ng tr\u01b0\u1edbc",
        "building": "Building", "emp_count": "S\u1ed1 NV", "aql": "AQL",
        "fail": "L\u1ed7i", "reject_rate": "T\u1ef7 l\u1ec7 t\u1eeb ch\u1ed1i", "grade": "X\u1ebfp h\u1ea1ng",
        "prev_recv": "Nh\u1eadn th\u00e1ng tr\u01b0\u1edbc", "emp_no": "M\u00e3 NV", "name": "H\u1ecd t\u00ean",
        "boss_chain": "Ph\u1ee5 tr\u00e1ch \u2192 Qu\u1ea3n l\u00fd", "att_rate": "T\u1ef7 l\u1ec7 \u0111i l\u00e0m",
        "unapp_abs": "V\u1eafng KP", "insp_qty": "S\u1ed1 l\u01b0\u1ee3ng KT",
        "type": "TYPE", "receivers": "Ng\u01b0\u1eddi nh\u1eadn", "pay_rate": "T\u1ef7 l\u1ec7 chi tr\u1ea3",
        "total_vnd": "T\u1ed5ng (VND)",
        # Progress banner
        "mid_status": "T\u00ecnh h\u00ecnh gi\u1eefa th\u00e1ng", "days_elapsed": "\u0111\u00e3 qua",
        "pre_final": "D\u1eef li\u1ec7u ch\u01b0a ch\u1ed1t. S\u1ed1 ti\u1ec1n th\u01b0\u1edfng s\u1ebd \u0111\u01b0\u1ee3c t\u00ednh cu\u1ed1i th\u00e1ng.",
        "prev_result": "K\u1ebft qu\u1ea3 (ch\u1ed1t)", "of_total": "trong", "received": "nh\u1eadn th\u01b0\u1edfng",
        # Action recommendations
        "bottleneck": "\u0110i\u1ec1u ki\u1ec7n t\u1eafc ngh\u1ebd (nguy\u00ean nh\u00e2n kh\u00f4ng nh\u1eadn th\u01b0\u1edfng):",
        "ppl_below": "ch\u01b0a \u0111\u1ea1t",
        "action_rec": "H\u00e0nh \u0111\u1ed9ng khuy\u1ebfn ngh\u1ecb:",
        "aql_retrain": "\u0111\u00e0o t\u1ea1o l\u1ea1i AQL. B\u00e1o c\u00e1o:",
        "subordinate": "nh\u00e2n vi\u00ean",
        "consec_3m": "L\u1ed7i li\u00ean ti\u1ebfp 3 th\u00e1ng (ch\u1eb7n th\u01b0\u1edfng):",
        "consec_2m": "L\u1ed7i li\u00ean ti\u1ebfp 2 th\u00e1ng (c\u1ea3nh b\u00e1o):",
        "consec_3m_action": "C\u1ea7n xem x\u00e9t bi\u1ec7n ph\u00e1p nh\u00e2n s\u1ef1. L\u1ed7i 3 th\u00e1ng li\u00ean ti\u1ebfp s\u1ebd b\u1ecb ch\u1eb7n th\u01b0\u1edfng v\u0129nh vi\u1ec5n.",
        "consec_2m_action": "N\u1ebfu l\u1ed7i th\u00e1ng sau s\u1ebd \u0111\u1ee7 3 th\u00e1ng \u2192 Y\u00eau c\u1ea7u qu\u1ea3n l\u00fd t\u1eadp trung h\u01b0\u1edbng d\u1eabn.",
        "prs_rate_below": "T\u1ef7 l\u1ec7 \u0111\u1ea1t 5PRS ch\u01b0a \u0111\u1ea1t",
        "prs_qty_below": "S\u1ed1 l\u01b0\u1ee3ng KT 5PRS ch\u01b0a \u0111\u1ea1t",
        "prs_action": "Y\u00eau c\u1ea7u ph\u1ee5 tr\u00e1ch h\u01b0\u1edbng d\u1eabn c\u1ea3i thi\u1ec7n ch\u1ea5t l\u01b0\u1ee3ng ki\u1ec3m tra 5PRS.",
        "prs_qty_action": "Ki\u1ec3m tra xem c\u00f3 thi\u1ebfu c\u01a1 h\u1ed9i ki\u1ec3m tra kh\u00f4ng \u2192 \u0110i\u1ec1u ch\u1ec9nh ph\u00e2n c\u00f4ng.",
        "att_below": "Ch\u01b0a \u0111\u1ea1t t\u1ef7 l\u1ec7 \u0111i l\u00e0m",
        "abs_over": "V\u01b0\u1ee3t qu\u00e1 v\u1eafng kh\u00f4ng ph\u00e9p",
        "att_action": "Y\u00eau c\u1ea7u ph\u1ee5 tr\u00e1ch x\u00e1c nh\u1eadn l\u00fd do v\u1eafng kh\u00f4ng ph\u00e9p ngay.",
        "abs_action": "Y\u00eau c\u1ea7u ph\u1ee5 tr\u00e1ch x\u00e1c nh\u1eadn l\u00fd do v\u00e0 h\u01b0\u1edbng d\u1eabn ph\u00f2ng ng\u1eeba t\u00e1i ph\u1ea1m.",
        "other_bldgs": "Kh\u00e1c",
        "bldg_unit": "building",
        "no_aql": "Kh\u00f4ng c\u00f3 ki\u1ec3m tra AQL",
        # Links
        "dashboard": "Dashboard:",
        "detail_lookup": "Tra c\u1ee9u nh\u00e2n vi\u00ean:",
        "detail_how": "Dashboard \u2192 Nh\u1ea5p t\u00ean nh\u00e2n vi\u00ean",
        "aql_analysis": "Ph\u00e2n t\u00edch AQL:",
        "aql_how": "Dashboard \u2192 Tab T\u1ed5ng h\u1ee3p \u2192 Ph\u1ea7n AQL",
        # Footer
        "data_as_of": "D\u1eef li\u1ec7u t\u00ednh \u0111\u1ebfn:",
        "auto_gen": "(t\u1ef1 \u0111\u1ed9ng t\u1ea1o)",
        "auto_sent": "Email n\u00e0y \u0111\u01b0\u1ee3c g\u1eedi t\u1ef1 \u0111\u1ed9ng t\u1eeb h\u1ec7 th\u1ed1ng QIP Incentive Dashboard.",
        "prev_month": "th\u00e1ng tr\u01b0\u1edbc",
        "ppl": "ng\u01b0\u1eddi",
        "days": "ng\u00e0y",
    },
}


def _t(data, key, default=""):
    """Translation helper - get localized string from data's i18n dict"""
    t = data.get("_t", I18N["ko"])
    return t.get(key, default or key)


def _cond_name(data, key):
    """Get condition name in current language"""
    t = data.get("_t", I18N["ko"])
    return t.get(key, key.upper())


CONDITION_NAMES = I18N["ko"]  # backward compat


# ---------------------------------------------------------------------------
# Section renderers
# ---------------------------------------------------------------------------

def _delta_html(current, previous, suffix="%", higher_is_better=True):
    """전월 대비 변화량 HTML"""
    if previous is None or previous == 0:
        return ""
    diff = current - previous
    if abs(diff) < 0.1:
        return f'<span style="{STYLES["delta_neutral"]}">-</span>'
    sign = "+" if diff > 0 else ""
    is_good = (diff > 0) == higher_is_better
    style = STYLES["delta_up"] if is_good else STYLES["delta_down"]
    arrow = "&#9650;" if diff > 0 else "&#9660;"
    return f'<span style="{style}">{arrow} {sign}{diff:.1f}{suffix}</span>'


def _section_0_progress(data, month_ko, year):
    """Section 0: 진행 중 월 배너"""
    summary = data.get("summary", {})
    working_days = summary.get("working_days", 0)
    calendar = summary.get("calendar_data", {})
    days_in_month = calendar.get("days_in_month", 30)

    # Count total working days from weekday_indices (Mon-Sat = 0-5, Sun = 6)
    weekday_indices = calendar.get("weekday_indices", [])
    if weekday_indices:
        total_wd = sum(1 for w in weekday_indices if w < 6)  # Mon-Sat
    else:
        total_wd = int(days_in_month * 26 / 31)  # rough estimate

    if total_wd == 0:
        return ""

    # Calculate progress
    progress_pct = min(100, int((working_days / max(total_wd, 1)) * 100))

    # If month is complete (progress >= 95%), don't show banner
    if progress_pct >= 95:
        return ""

    prev = data.get("previous_summary", {})
    prev_total = prev.get("total_employees", 0)
    prev_receiving = prev.get("receiving_employees", 0)
    prev_rate = (prev_receiving / prev_total * 100) if prev_total > 0 else 0
    prev_incentive = prev.get("total_incentive", 0)

    # Use language-aware previous month name
    prev_month_idx = data.get("previous_month_idx")
    if prev_month_idx:
        prev_month = _t(data, f"m{prev_month_idx}")
    else:
        prev_month = data.get("previous_month_ko", _t(data, 'prev_month'))
    prev_section = ""
    if prev_total > 0:
        prev_section = f'''
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid #bfdbfe;">
          <strong>{prev_month} {_t(data, 'prev_result')}</strong>: {prev_total}{_t(data, 'of_total')} {prev_receiving}{_t(data, 'received')} ({prev_rate:.1f}%) | {_fmt_vnd(prev_incentive)} VND
        </div>'''

    return f'''
    <div style="{STYLES['progress_banner']}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <strong>&#x1F4C5; {year} {month_ko} {_t(data, 'mid_status')}</strong>
        <span>{working_days}{_t(data, 'days')} / ~{total_wd}{_t(data, 'days')} {_t(data, 'days_elapsed')} ({progress_pct}%)</span>
      </div>
      <div style="{STYLES['progress_bar_bg']}">
        <div style="{STYLES['progress_bar_fill']}width:{progress_pct}%;"></div>
      </div>
      <div style="margin-top:6px;font-size:12px;color:#3b82f6;">
        &#x26A0; {_t(data, 'pre_final')}
      </div>
      {prev_section}
    </div>
    '''


def _section_1b_condition_rates(data):
    """Section 1b: 10개 조건별 통과율 (핵심 병목 분석)"""
    condition_stats = data.get("condition_stats", {})
    if not condition_stats:
        return ""

    prev_stats = data.get("previous_condition_stats", {})

    rows = ""
    blocking_conditions = []

    for i in range(1, 11):
        key = f"c{i}"
        pass_count = condition_stats.get(f"{key}_pass", 0)
        fail_count = condition_stats.get(f"{key}_fail", 0)
        na_count = condition_stats.get(f"{key}_na", 0)
        applicable = pass_count + fail_count
        total = pass_count + fail_count + na_count

        if applicable == 0:
            rate = 100.0
            bar_width = 100
        else:
            rate = (pass_count / applicable * 100)
            bar_width = max(1, int(rate))

        # Previous month comparison
        prev_rate = None
        if prev_stats:
            prev_pass = prev_stats.get(f"{key}_pass", 0)
            prev_fail = prev_stats.get(f"{key}_fail", 0)
            prev_app = prev_pass + prev_fail
            if prev_app > 0:
                prev_rate = prev_pass / prev_app * 100

        delta = _delta_html(rate, prev_rate) if prev_rate is not None else ""

        # Color based on rate
        if rate >= 95:
            bar_style = STYLES["cond_bar_green"]
        elif rate >= 80:
            bar_style = STYLES["cond_bar_yellow"]
        else:
            bar_style = STYLES["cond_bar_red"]

        # Track blocking conditions
        if fail_count > 0 and rate < 95:
            blocking_conditions.append((_cond_name(data, key), fail_count, rate))

        name = _cond_name(data, key)
        rows += f'''
        <tr>
          <td style="{STYLES['td']};font-weight:600;white-space:nowrap;">{key.upper()}</td>
          <td style="{STYLES['td']}">{name}</td>
          <td style="{STYLES['td']};min-width:120px;">
            <div style="{STYLES['cond_bar_bg']}">
              <div style="{bar_style}width:{bar_width}%;"></div>
            </div>
          </td>
          <td style="{STYLES['td_center']};font-weight:600;">{rate:.1f}%</td>
          <td style="{STYLES['td_center']}">{pass_count}/{applicable}</td>
          <td style="{STYLES['td_center']}">{delta}</td>
        </tr>'''

    # Blocking summary
    blocking_html = ""
    if blocking_conditions:
        blocking_conditions.sort(key=lambda x: x[2])  # worst first
        items = ""
        for name, fail_cnt, rate in blocking_conditions[:5]:
            severity = "&#x1F534;" if rate < 50 else "&#x1F7E0;" if rate < 80 else "&#x1F7E1;"
            items += f"<br/>{severity} <strong>{name}</strong>: {fail_cnt}{_t(data, 'ppl_below')} ({rate:.1f}%)"
        blocking_html = f'''
        <div style="{STYLES['action_box_red']}">
          &#x26A0; <strong>{_t(data, 'bottleneck')}</strong>
          {items}
        </div>'''

    return f'''
    <hr style="{STYLES['divider']}"/>
    <h2 style="{STYLES['section_title']}">{_t(data, 'condition_title')}</h2>
    <div style="{STYLES['section_body']}">
      <table style="{STYLES['table']}">
        <tr>
          <th style="{STYLES['th']}">{_t(data, 'condition')}</th>
          <th style="{STYLES['th']}">{_t(data, 'desc')}</th>
          <th style="{STYLES['th']}">{_t(data, 'pass_rate_h')}</th>
          <th style="{STYLES['th_center']}">%</th>
          <th style="{STYLES['th_center']}">{_t(data, 'pass_applied')}</th>
          <th style="{STYLES['th_center']}">{_t(data, 'vs_prev')}</th>
        </tr>
        {rows}
      </table>
      {blocking_html}
    </div>
    '''


def _section_1_kpi(data):
    """Section 1: 핵심 KPI 요약 (전월 비교 포함)"""
    summary = data.get("summary", {})
    total = summary.get("total_employees", 0)
    receiving = summary.get("receiving_employees", 0)
    pct = (receiving / total * 100) if total > 0 else 0
    total_incentive = summary.get("total_incentive", 0)
    eligible = summary.get("eligible_employees", total)

    # Condition-based metrics
    condition_stats = data.get("condition_stats", {})
    all_pass_count = 0
    total_fail_conditions = 0
    if condition_stats:
        # Count employees passing ALL applicable conditions
        # (Use the summary receiving count, or calculate from condition stats)
        for i in range(1, 11):
            total_fail_conditions += condition_stats.get(f"c{i}_fail", 0)

    # Average condition pass rate
    total_applicable = 0
    total_passed = 0
    for i in range(1, 11):
        p = condition_stats.get(f"c{i}_pass", 0)
        f = condition_stats.get(f"c{i}_fail", 0)
        total_applicable += (p + f)
        total_passed += p
    avg_cond_rate = (total_passed / total_applicable * 100) if total_applicable > 0 else 0

    # Previous month
    prev = data.get("previous_summary", {})
    prev_total = prev.get("total_employees", 0)
    prev_receiving = prev.get("receiving_employees", 0)
    prev_rate = (prev_receiving / prev_total * 100) if prev_total > 0 else 0

    # KPI cards: show condition-focused metrics for in-progress months
    if receiving == 0 and total > 0:
        # In-progress month: show condition analysis instead of zeros
        return f'''
    <h2 style="{STYLES['section_title']}">{_t(data, 'kpi_title')}</h2>
    <div style="{STYLES['section_body']}">
      <table style="{STYLES['kpi_table']}">
        <tr>
          <td style="{STYLES['kpi_cell']}">
            <p style="{STYLES['kpi_value']}">{total}</p>
            <p style="{STYLES['kpi_label']}">{_t(data, 'total_emp')}</p>
          </td>
          <td style="{STYLES['kpi_cell']}">
            <p style="{STYLES['kpi_value']};color:#3b82f6;">{eligible}</p>
            <p style="{STYLES['kpi_label']}">{_t(data, 'eligible_emp')}</p>
          </td>
          <td style="{STYLES['kpi_cell']}">
            <p style="{STYLES['kpi_value']};color:{'#22c55e' if avg_cond_rate >= 90 else '#f59e0b' if avg_cond_rate >= 70 else '#ef4444'};">{avg_cond_rate:.1f}%</p>
            <p style="{STYLES['kpi_label']}">{_t(data, 'cond_rate')}</p>
          </td>
          <td style="{STYLES['kpi_cell']}">
            <p style="{STYLES['kpi_value']};color:#ef4444;">{total_fail_conditions}</p>
            <p style="{STYLES['kpi_label']}">{_t(data, 'cond_fail')}</p>
          </td>
        </tr>
      </table>
    </div>
    '''
    else:
        # Completed month: show incentive-focused metrics
        receiving_delta = _delta_html(pct, prev_rate) if prev_rate else ""
        return f'''
    <h2 style="{STYLES['section_title']}">{_t(data, 'kpi_title')}</h2>
    <div style="{STYLES['section_body']}">
      <table style="{STYLES['kpi_table']}">
        <tr>
          <td style="{STYLES['kpi_cell']}">
            <p style="{STYLES['kpi_value']}">{total}</p>
            <p style="{STYLES['kpi_label']}">{_t(data, 'total_emp')}</p>
          </td>
          <td style="{STYLES['kpi_cell']}">
            <p style="{STYLES['kpi_value']};color:#22c55e;">{receiving}</p>
            <p style="{STYLES['kpi_label']}">{_t(data, 'receivers')} {receiving_delta}</p>
          </td>
          <td style="{STYLES['kpi_cell']}">
            <p style="{STYLES['kpi_value']};color:#3b82f6;">{_fmt_pct(pct)}</p>
            <p style="{STYLES['kpi_label']}">{_t(data, 'pay_rate')}</p>
          </td>
          <td style="{STYLES['kpi_cell']}">
            <p style="{STYLES['kpi_value']};color:#f59e0b;">{_fmt_vnd(total_incentive)}</p>
            <p style="{STYLES['kpi_label']}">{_t(data, 'total_vnd')}</p>
          </td>
        </tr>
      </table>
    </div>
    '''


def _cond_pass_badge(passed, total):
    """Condition pass rate → colored badge HTML"""
    if total == 0:
        return '<span style="color:#9ca3af;">-</span>'
    rate = passed / total * 100
    if rate >= 95:
        color = "#166534"
        bg = "#dcfce7"
    elif rate >= 80:
        color = "#854d0e"
        bg = "#fef9c3"
    else:
        color = "#991b1b"
        bg = "#fecaca"
    return f'<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:600;background:{bg};color:{color};">{passed}/{total} ({rate:.0f}%)</span>'


def _section_2_building(data):
    """Section 2: Building별 품질 현황 (TYPE별 그룹 → TYPE별 다른 칼럼)"""
    bq_by_type = data.get("building_quality_by_type", {})
    buildings = data.get("building_quality", {})

    if not buildings and not bq_by_type:
        return ""

    prev_bldg = data.get("previous_building", {})

    if not bq_by_type and buildings:
        bq_by_type = {"ALL": buildings}

    # Condition short names for TYPE-2/3 table headers
    cond_headers = {
        "c1": (_t(data, "c1"), _t(data, "att_rate")),
        "c2": (_t(data, "c2"), _t(data, "unapp_abs")),
        "c3": ("C3", _t(data, "c3") if len(_t(data, "c3")) < 15 else "C3"),
        "c4": ("C4", _t(data, "c4") if len(_t(data, "c4")) < 15 else "C4"),
    }

    def _prev_col(bldg, prev_bldg_data):
        prev_info = prev_bldg_data.get(bldg, {})
        prev_recv = prev_info.get("receiving", 0)
        prev_cnt = prev_info.get("count", 0)
        if prev_cnt > 0:
            prev_pay = prev_recv / prev_cnt * 100
            return f'{prev_recv}/{prev_cnt} ({prev_pay:.0f}%)'
        return ""

    def _build_type1_rows(bldg_dict):
        """TYPE-1: AQL/5PRS columns"""
        rows = ""
        t_emp = 0
        t_tests = 0
        t_fails = 0
        active = {}
        other_count = 0
        other_emp = 0

        for bldg, info in bldg_dict.items():
            if info.get("tests", 0) > 0 or info.get("count", 0) >= 10:
                active[bldg] = info
            else:
                other_count += 1
                other_emp += info.get("count", 0)

        for bldg, info in sorted(active.items(), key=lambda x: (-x[1].get("reject_rate", 0), -x[1].get("count", 0))):
            count = info.get("count", 0)
            tests = info.get("tests", 0)
            fails = info.get("fail_count", 0)
            rr = info.get("reject_rate", 0)
            t_emp += count
            t_tests += tests
            t_fails += fails
            pc = _prev_col(bldg, prev_bldg)
            rows += f'''
            <tr>
              <td style="{STYLES['td']}">{_grade_emoji(rr)} {_bldg_badge(bldg)}</td>
              <td style="{STYLES['td_center']}">{count}</td>
              <td style="{STYLES['td_center']}">{tests}</td>
              <td style="{STYLES['td_center']}">{fails}</td>
              <td style="{STYLES['td_center']}">{_fmt_pct(rr)}</td>
              <td style="{STYLES['td_center']}">{_grade_badge(rr)}</td>
              <td style="{STYLES['td_center']};font-size:11px;color:#6b7280;">{pc}</td>
            </tr>'''

        if other_count > 0:
            t_emp += other_emp
            rows += f'''
            <tr style="background:#fafbfc;">
              <td style="{STYLES['td']};color:#9ca3af;font-style:italic;" colspan="2">{_t(data, 'other_bldgs')} {other_count}{_t(data, 'bldg_unit')} ({other_emp}{_t(data, 'ppl')})</td>
              <td style="{STYLES['td_center']};color:#9ca3af;" colspan="5">{_t(data, 'no_aql')}</td>
            </tr>'''
        return rows, t_emp, t_tests, t_fails

    def _build_type2_rows(bldg_dict):
        """TYPE-2/3: Condition pass columns (c1-c4) + AQL error check"""
        rows = ""
        t_emp = 0
        aql_errors = []

        sorted_bldgs = sorted(bldg_dict.items(), key=lambda x: -x[1].get("count", 0))
        for bldg, info in sorted_bldgs:
            count = info.get("count", 0)
            recv = info.get("receiving", 0)
            recv_rate = (recv / count * 100) if count > 0 else 0
            t_emp += count

            # AQL error check for TYPE-2
            aql_tests = info.get("tests", 0)
            if aql_tests > 0:
                aql_errors.append({"building": bldg, "tests": aql_tests, "fails": info.get("fail_count", 0)})

            # Condition columns
            c1p = info.get("c1_pass", 0)
            c1f = info.get("c1_fail", 0)
            c2p = info.get("c2_pass", 0)
            c2f = info.get("c2_fail", 0)
            c3p = info.get("c3_pass", 0)
            c3f = info.get("c3_fail", 0)
            c4p = info.get("c4_pass", 0)
            c4f = info.get("c4_fail", 0)

            recv_color = "#166534" if recv_rate >= 85 else "#854d0e" if recv_rate >= 70 else "#991b1b"
            pc = _prev_col(bldg, prev_bldg)

            rows += f'''
            <tr>
              <td style="{STYLES['td']}">{_bldg_badge(bldg)}</td>
              <td style="{STYLES['td_center']}">{count}</td>
              <td style="{STYLES['td_center']}">{_cond_pass_badge(c1p, c1p+c1f)}</td>
              <td style="{STYLES['td_center']}">{_cond_pass_badge(c2p, c2p+c2f)}</td>
              <td style="{STYLES['td_center']}">{_cond_pass_badge(c3p, c3p+c3f)}</td>
              <td style="{STYLES['td_center']}">{_cond_pass_badge(c4p, c4p+c4f)}</td>
              <td style="{STYLES['td_center']};font-weight:700;color:{recv_color};">{_fmt_pct(recv_rate)}</td>
              <td style="{STYLES['td_center']};font-size:11px;color:#6b7280;">{pc}</td>
            </tr>'''

        return rows, t_emp, aql_errors

    # ---- Build complete section ----
    html_parts = []
    grand_emp = 0
    grand_tests = 0
    grand_fails = 0

    type_order = ["TYPE-1", "TYPE-2", "TYPE-3"]
    for t in bq_by_type:
        if t not in type_order and t != "ALL":
            type_order.append(t)
    if list(bq_by_type.keys()) == ["ALL"]:
        type_order = ["ALL"]

    for type_key in type_order:
        type_bldgs = bq_by_type.get(type_key, {})
        if not type_bldgs:
            continue

        type_emp = sum(b.get("count", 0) for b in type_bldgs.values())
        type_recv = sum(b.get("receiving", 0) for b in type_bldgs.values())
        type_rate = (type_recv / type_emp * 100) if type_emp > 0 else 0

        is_type1 = type_key in ("TYPE-1", "ALL")
        is_type2or3 = type_key in ("TYPE-2", "TYPE-3")

        # TYPE header
        type_color = "#1e40af" if type_key == "TYPE-1" else "#7c3aed" if type_key == "TYPE-2" else "#059669"
        if type_key != "ALL":
            recv_style = f'color:{type_color}'
            if type_key == "TYPE-3" and type_rate == 0:
                recv_style = "color:#dc2626;font-style:italic"

        if is_type1:
            # TYPE-1: AQL table
            if type_key != "ALL":
                colspan_left = 5
                colspan_right = 2
            else:
                colspan_left = 5
                colspan_right = 2

            type_header = ""
            if type_key != "ALL":
                type_header = f'''
                <tr style="background:linear-gradient(90deg,#f0f4f8,#ffffff);">
                  <td style="padding:10px;font-weight:700;font-size:14px;color:{type_color};border-bottom:2px solid {type_color};" colspan="{colspan_left}">
                    {type_key} ({type_emp}{_t(data, 'ppl')})
                  </td>
                  <td style="padding:10px;font-weight:700;font-size:13px;{recv_style};text-align:center;border-bottom:2px solid {type_color};" colspan="{colspan_right}">
                    {type_recv}/{type_emp} ({type_rate:.0f}%)
                  </td>
                </tr>'''

            rows, t_emp, t_tests, t_fails = _build_type1_rows(type_bldgs)
            grand_emp += t_emp
            grand_tests += t_tests
            grand_fails += t_fails

            table_html = f'''
            <table style="{STYLES['table']}">
              <tr>
                <th style="{STYLES['th']}">{_t(data, 'building')}</th>
                <th style="{STYLES['th_center']}">{_t(data, 'emp_count')}</th>
                <th style="{STYLES['th_center']}">{_t(data, 'aql')}</th>
                <th style="{STYLES['th_center']}">{_t(data, 'fail')}</th>
                <th style="{STYLES['th_center']}">{_t(data, 'reject_rate')}</th>
                <th style="{STYLES['th_center']}">{_t(data, 'grade')}</th>
                <th style="{STYLES['th_center']};font-size:11px;">{_t(data, 'prev_recv')}</th>
              </tr>
              {type_header}
              {rows}
            </table>'''
            html_parts.append(table_html)

        elif is_type2or3:
            # TYPE-2/3: Condition pass columns
            rows, t_emp, aql_errors = _build_type2_rows(type_bldgs)
            grand_emp += t_emp

            # AQL ERROR WARNING for TYPE-2
            aql_warning = ""
            if aql_errors:
                err_details = ", ".join(f"{e['building']}: {e['tests']} tests / {e['fails']} fails" for e in aql_errors)
                aql_warning = f'''
                <div style="background:#fef2f2;border:2px solid #dc2626;border-radius:8px;padding:14px 18px;margin:8px 0 12px 0;">
                  <div style="color:#dc2626;font-weight:800;font-size:14px;">&#x1F6A8; AQL DATA ERROR — {type_key}</div>
                  <div style="color:#991b1b;font-weight:700;font-size:13px;margin-top:4px;">
                    {type_key} should NOT have AQL inspection data. Found: {err_details}
                  </div>
                  <div style="color:#7f1d1d;font-size:12px;margin-top:4px;">
                    Check data source. {type_key} employees are exempt from AQL inspection.
                  </div>
                </div>'''

            table_html = f'''
            {aql_warning}
            <table style="{STYLES['table']}">
              <tr>
                <th style="{STYLES['th']}">{_t(data, 'building')}</th>
                <th style="{STYLES['th_center']}">{_t(data, 'emp_count')}</th>
                <th style="{STYLES['th_center']};font-size:11px;">C1 {_t(data, 'att_rate')}</th>
                <th style="{STYLES['th_center']};font-size:11px;">C2 {_t(data, 'unapp_abs')}</th>
                <th style="{STYLES['th_center']};font-size:11px;">C3 {_t(data, 'c3')}</th>
                <th style="{STYLES['th_center']};font-size:11px;">C4 {_t(data, 'c4')}</th>
                <th style="{STYLES['th_center']}">{_t(data, 'pay_rate')}</th>
                <th style="{STYLES['th_center']};font-size:11px;">{_t(data, 'prev_recv')}</th>
              </tr>
              <tr style="background:linear-gradient(90deg,#f0f4f8,#ffffff);">
                <td style="padding:10px;font-weight:700;font-size:14px;color:{type_color};border-bottom:2px solid {type_color};" colspan="6">
                  {type_key} ({type_emp}{_t(data, 'ppl')})
                </td>
                <td style="padding:10px;font-weight:700;font-size:13px;{recv_style};text-align:center;border-bottom:2px solid {type_color};" colspan="2">
                  {type_recv}/{type_emp} ({type_rate:.0f}%)
                </td>
              </tr>
              {rows}
            </table>'''
            html_parts.append(table_html)

    # Grand total
    grand_reject = (grand_fails / grand_tests * 100) if grand_tests > 0 else 0
    total_recv = sum(b.get("receiving", 0) for b in buildings.values())
    total_html = f'''
    <table style="{STYLES['table']};margin-top:8px;">
      <tr style="{STYLES['tr_total']}">
        <td style="{STYLES['td']}">Total</td>
        <td style="{STYLES['td_center']}">{grand_emp}</td>
        <td style="{STYLES['td_center']}">{grand_tests} AQL</td>
        <td style="{STYLES['td_center']}">{grand_fails} {_t(data, 'fail')}</td>
        <td style="{STYLES['td_center']}">{_fmt_pct(grand_reject)}</td>
        <td style="{STYLES['td_center']};font-weight:700;">{total_recv}/{grand_emp} ({(total_recv/grand_emp*100) if grand_emp else 0:.0f}%)</td>
      </tr>
    </table>'''

    return f'''
    <hr style="{STYLES['divider']}"/>
    <h2 style="{STYLES['section_title']}">{_t(data, 'building_title')}</h2>
    <div style="{STYLES['section_body']}">
      {''.join(html_parts)}
      {total_html}
    </div>
    '''


def _section_3_aql_failures(data):
    """Section 3: AQL 실패자 상세 (Building별 그룹 + 담당자 체인)"""
    buildings = data.get("building_quality", {})
    html = ""
    has_failures = False

    for bldg, info in sorted(buildings.items()):
        fail_employees = info.get("fail_employees", [])
        if not fail_employees:
            continue
        has_failures = True

        rows = ""
        # Group by boss_name for action recommendation
        boss_groups = {}
        for emp in fail_employees:
            boss = emp.get("boss_name", "-")
            if boss not in boss_groups:
                boss_groups[boss] = []
            boss_groups[boss].append(emp)

        for emp in fail_employees:
            chain = _boss_chain_html(
                emp.get("boss_name"), emp.get("boss_boss_name"), emp.get("boss_boss_position")
            )
            rows += f'''
            <tr>
              <td style="{STYLES['td']}">{emp.get('emp_no', '')}</td>
              <td style="{STYLES['td']}">{emp.get('name', '')}</td>
              <td style="{STYLES['td_center']}">{emp.get('fail_count', 0)}</td>
              <td style="{STYLES['td']};font-size:12px;">{chain}</td>
            </tr>'''

        # Action recommendation per boss
        action_lines = ""
        for i, (boss_name, emps) in enumerate(boss_groups.items(), 1):
            boss_boss = emps[0].get("boss_boss_name", "-")
            boss_boss_pos = emps[0].get("boss_boss_position", "")
            pos_short = ""
            if boss_boss_pos:
                p = str(boss_boss_pos).upper()
                if "GROUP" in p:
                    pos_short = "GL"
                elif "SUPERVISOR" in p or "SUP" in p:
                    pos_short = "SV"
                elif "MANAGER" in p:
                    pos_short = "MG"
            suffix = f" ({pos_short})" if pos_short else ""
            action_lines += f"{i}. {boss_name} (LL) &#8594; {_t(data, 'subordinate')} {len(emps)}{_t(data, 'ppl')} {_t(data, 'aql_retrain')} {boss_boss}{suffix}<br/>"

        html += f'''
        <p style="{STYLES['subtitle']}">{_bldg_badge(bldg)} AQL {_t(data, 'fail')} {len(fail_employees)}{_t(data, 'ppl')}</p>
        <table style="{STYLES['table']}">
          <tr>
            <th style="{STYLES['th']}">{_t(data, 'emp_no')}</th>
            <th style="{STYLES['th']}">{_t(data, 'name')}</th>
            <th style="{STYLES['th_center']}">{_t(data, 'fail')}</th>
            <th style="{STYLES['th']}">{_t(data, 'boss_chain')}</th>
          </tr>
          {rows}
        </table>
        <div style="{STYLES['action_box']}">
          &#x1F4CB; <strong>{_t(data, 'action_rec')}</strong><br/>{action_lines}
        </div>
        '''

    if not has_failures:
        return f'''
        <hr style="{STYLES['divider']}"/>
        <h2 style="{STYLES['section_title']}">{_t(data, 'aql_fail_title')}</h2>
        <div style="{STYLES['section_body']}">
          <p style="color:#22c55e;font-weight:600;">&#x2705; {_t(data, 'aql_none')}</p>
        </div>
        '''

    return f'''
    <hr style="{STYLES['divider']}"/>
    <h2 style="{STYLES['section_title']}">{_t(data, 'aql_fail_title')}</h2>
    <div style="{STYLES['section_body']}">
      {html}
    </div>
    '''


def _section_4_consecutive_aql(data):
    """Section 4: 연속 AQL 실패 경고"""
    continuous_3m = data.get("continuous_3m", [])
    continuous_2m = data.get("continuous_2m", [])

    if not continuous_3m and not continuous_2m:
        return ""

    html = ""

    # 3-month consecutive (critical)
    if continuous_3m:
        rows = ""
        for emp in continuous_3m:
            chain = _boss_chain_html(
                emp.get("boss_name"), emp.get("boss_boss_name"), emp.get("boss_boss_position")
            )
            rows += f'''
            <tr>
              <td style="{STYLES['td']}">{emp.get('emp_no', '')}</td>
              <td style="{STYLES['td']}">{emp.get('name', '')}</td>
              <td style="{STYLES['td_center']}">{_bldg_badge(emp.get('building', '-'))}</td>
              <td style="{STYLES['td']};font-size:12px;">{chain}</td>
            </tr>'''

        html += f'''
        <p style="{STYLES['subtitle']}">&#x1F534; {_t(data, 'consec_3m')} {len(continuous_3m)}{_t(data, 'ppl')}</p>
        <table style="{STYLES['table']}">
          <tr>
            <th style="{STYLES['th']}">{_t(data, 'emp_no')}</th>
            <th style="{STYLES['th']}">{_t(data, 'name')}</th>
            <th style="{STYLES['th_center']}">{_t(data, 'building')}</th>
            <th style="{STYLES['th']}">{_t(data, 'boss_chain')}</th>
          </tr>
          {rows}
        </table>
        <div style="{STYLES['action_box_red']}">
          &#x1F4CB; {_t(data, 'consec_3m_action')}
        </div>
        '''

    # 2-month consecutive (warning)
    if continuous_2m:
        rows = ""
        for emp in continuous_2m:
            chain = _boss_chain_html(
                emp.get("boss_name"), emp.get("boss_boss_name"), emp.get("boss_boss_position")
            )
            rows += f'''
            <tr>
              <td style="{STYLES['td']}">{emp.get('emp_no', '')}</td>
              <td style="{STYLES['td']}">{emp.get('name', '')}</td>
              <td style="{STYLES['td_center']}">{_bldg_badge(emp.get('building', '-'))}</td>
              <td style="{STYLES['td']};font-size:12px;">{chain}</td>
            </tr>'''

        html += f'''
        <p style="{STYLES['subtitle']}">&#x1F7E1; {_t(data, 'consec_2m')} {len(continuous_2m)}{_t(data, 'ppl')}</p>
        <table style="{STYLES['table']}">
          <tr>
            <th style="{STYLES['th']}">{_t(data, 'emp_no')}</th>
            <th style="{STYLES['th']}">{_t(data, 'name')}</th>
            <th style="{STYLES['th_center']}">{_t(data, 'building')}</th>
            <th style="{STYLES['th']}">{_t(data, 'boss_chain')}</th>
          </tr>
          {rows}
        </table>
        <div style="{STYLES['action_box_yellow']}">
          &#x1F4CB; {_t(data, 'consec_2m_action')}
        </div>
        '''

    return f'''
    <hr style="{STYLES['divider']}"/>
    <h2 style="{STYLES['section_title']}">{_t(data, 'consecutive_title')}</h2>
    <div style="{STYLES['section_body']}">
      {html}
    </div>
    '''


def _grouped_by_building(emp_list):
    """Group employee list by building."""
    groups = {}
    for emp in emp_list:
        bldg = emp.get("building", "Unknown") or "Unknown"
        groups.setdefault(bldg, []).append(emp)
    return groups


def _section_5_5prs(data):
    """Section 5: 5PRS 미달자 상세 (Building별 그룹)"""
    low_rate = data.get("low_prs_rate", [])
    low_qty = data.get("low_prs_qty", [])

    if not low_rate and not low_qty:
        return ""

    html = ""
    thresholds = data.get("thresholds", {})
    rate_th = thresholds.get("5prs_pass_rate", 95)
    qty_th = thresholds.get("5prs_min_qty", 100)

    # Low pass rate — grouped by building
    if low_rate:
        rate_html = ""
        for bldg, emps in sorted(_grouped_by_building(low_rate).items()):
            rows = ""
            for emp in emps:
                chain = _boss_chain_html(
                    emp.get("boss_name"), emp.get("boss_boss_name"), emp.get("boss_boss_position")
                )
                rows += f'''
                <tr>
                  <td style="{STYLES['td']}">{emp.get('emp_no', '')}</td>
                  <td style="{STYLES['td']}">{emp.get('name', '')}</td>
                  <td style="{STYLES['td_center']}">{_fmt_pct(emp.get('pass_rate', 0))}</td>
                  <td style="{STYLES['td_center']}">{int(emp.get('inspection_qty', 0))}</td>
                  <td style="{STYLES['td']};font-size:12px;">{chain}</td>
                </tr>'''

            rate_html += f'''
            <p style="{STYLES['subtitle']}">{_bldg_badge(bldg)} {_t(data, 'prs_rate_below')} {len(emps)}{_t(data, 'ppl')}</p>
            <table style="{STYLES['table']}">
              <tr>
                <th style="{STYLES['th']}">{_t(data, 'emp_no')}</th>
                <th style="{STYLES['th']}">{_t(data, 'name')}</th>
                <th style="{STYLES['th_center']}">{_t(data, 'pass_rate_h')}</th>
                <th style="{STYLES['th_center']}">{_t(data, 'insp_qty')}</th>
                <th style="{STYLES['th']}">{_t(data, 'boss_chain')}</th>
              </tr>
              {rows}
            </table>'''

        html += f'''
        <p style="font-size:15px;font-weight:700;color:#c2410c;margin:0 0 10px 0;">&#x1F7E0; {_t(data, 'prs_rate_below')} (&lt;{rate_th}%): {len(low_rate)}{_t(data, 'ppl')}</p>
        {rate_html}
        <div style="{STYLES['action_box']}">
          &#x1F4CB; {_t(data, 'prs_action')}
        </div>'''

    # Low inspection quantity — grouped by building
    if low_qty:
        qty_html = ""
        for bldg, emps in sorted(_grouped_by_building(low_qty).items()):
            rows = ""
            for emp in emps:
                chain = _boss_chain_html(
                    emp.get("boss_name"), emp.get("boss_boss_name"), emp.get("boss_boss_position")
                )
                rows += f'''
                <tr>
                  <td style="{STYLES['td']}">{emp.get('emp_no', '')}</td>
                  <td style="{STYLES['td']}">{emp.get('name', '')}</td>
                  <td style="{STYLES['td_center']}">{_fmt_pct(emp.get('pass_rate', 0))}</td>
                  <td style="{STYLES['td_center']}">{int(emp.get('inspection_qty', 0))}</td>
                  <td style="{STYLES['td']};font-size:12px;">{chain}</td>
                </tr>'''

            qty_html += f'''
            <p style="{STYLES['subtitle']}">{_bldg_badge(bldg)} {_t(data, 'prs_qty_below')} {len(emps)}{_t(data, 'ppl')}</p>
            <table style="{STYLES['table']}">
              <tr>
                <th style="{STYLES['th']}">{_t(data, 'emp_no')}</th>
                <th style="{STYLES['th']}">{_t(data, 'name')}</th>
                <th style="{STYLES['th_center']}">{_t(data, 'pass_rate_h')}</th>
                <th style="{STYLES['th_center']}">{_t(data, 'insp_qty')}</th>
                <th style="{STYLES['th']}">{_t(data, 'boss_chain')}</th>
              </tr>
              {rows}
            </table>'''

        html += f'''
        <p style="font-size:15px;font-weight:700;color:#c2410c;margin:16px 0 10px 0;">&#x1F7E0; {_t(data, 'prs_qty_below')} (&lt;{qty_th}): {len(low_qty)}{_t(data, 'ppl')}</p>
        {qty_html}
        <div style="{STYLES['action_box']}">
          &#x1F4CB; {_t(data, 'prs_qty_action')}
        </div>'''

    return f'''
    <hr style="{STYLES['divider']}"/>
    <h2 style="{STYLES['section_title']}">{_t(data, 'prs_title')}</h2>
    <div style="{STYLES['section_body']}">
      {html}
    </div>
    '''


def _emp_status_badge(emp, lang="ko"):
    """Employee status badge (resigned / maternity leave)."""
    status = emp.get("emp_status", "")
    stop = emp.get("stop_working_date", "")
    if status == "resigned":
        labels = {"ko": "퇴사", "en": "Resigned", "vi": "Nghỉ việc"}
        label = labels.get(lang, "Resigned")
        return f' <span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;background:#fecaca;color:#991b1b;">{label} {stop}</span>'
    elif status == "maternity_leave":
        labels = {"ko": "출산휴가", "en": "Maternity", "vi": "Thai sản"}
        label = labels.get(lang, "Maternity")
        return f' <span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;background:#e0e7ff;color:#3730a3;">{label}</span>'
    return ""


def _att_grouped_by_type_building(emp_list):
    """Group employees by TYPE → Building."""
    groups = {}
    for emp in emp_list:
        emp_type = emp.get("type", "Unknown") or "Unknown"
        bldg = emp.get("building", "Unknown") or "Unknown"
        groups.setdefault(emp_type, {}).setdefault(bldg, []).append(emp)
    return groups


def _render_att_table(data, emp_list, lang="ko"):
    """Render attendance table grouped by TYPE → Building with status badges."""
    grouped = _att_grouped_by_type_building(emp_list)
    html = ""

    type_order = ["TYPE-1", "TYPE-2", "TYPE-3"]
    for t in grouped:
        if t not in type_order:
            type_order.append(t)

    for emp_type in type_order:
        bldg_groups = grouped.get(emp_type, {})
        if not bldg_groups:
            continue

        type_total = sum(len(emps) for emps in bldg_groups.values())
        type_color = "#1e40af" if emp_type == "TYPE-1" else "#7c3aed" if emp_type == "TYPE-2" else "#059669"

        # TYPE-3 label override
        type_label = emp_type
        if emp_type == "TYPE-3":
            type3_labels = {"ko": "TYPE-3 — 정식 근무지 미배정 신입공", "en": "TYPE-3 — New hires, unassigned workstation", "vi": "TYPE-3 — Nhân viên mới, chưa phân công"}
            type_label = type3_labels.get(lang, type3_labels["en"])

        # Open TYPE inner card
        html += f'''
        <div style="margin:12px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#fafbfd;">
          <div style="padding:10px 16px;background:linear-gradient(90deg,{type_color}10,{type_color}05);border-bottom:2px solid {type_color};">
            <span style="font-weight:700;font-size:14px;color:{type_color};">{type_label}</span>
            <span style="font-size:12px;color:#64748b;margin-left:8px;">{type_total}{_t(data, 'ppl')}</span>
          </div>
          <div style="padding:8px 16px 16px 16px;">'''

        for bldg in sorted(bldg_groups.keys()):
            emps = bldg_groups[bldg]
            rows = ""
            for emp in emps:
                chain = _boss_chain_html(
                    emp.get("boss_name"), emp.get("boss_boss_name"), emp.get("boss_boss_position")
                )
                status_badge = _emp_status_badge(emp, lang)
                rows += f'''
                <tr>
                  <td style="{STYLES['td']}">{emp.get('emp_no', '')}</td>
                  <td style="{STYLES['td']}">{emp.get('name', '')}{status_badge}</td>
                  <td style="{STYLES['td_center']}">{_fmt_pct(emp.get('attendance_rate', 0))}</td>
                  <td style="{STYLES['td_center']}">{emp.get('unapproved_absence', 0)}</td>
                  <td style="{STYLES['td']};font-size:12px;">{chain}</td>
                </tr>'''

            # Hide building badge for TYPE-3 (unassigned new hires)
            bldg_label = f"{_bldg_badge(bldg)} " if emp_type != "TYPE-3" else ""

            html += f'''
            <p style="{STYLES['subtitle']}">{bldg_label}{len(emps)}{_t(data, 'ppl')}</p>
            <table style="{STYLES['table']}">
              <tr>
                <th style="{STYLES['th']}">{_t(data, 'emp_no')}</th>
                <th style="{STYLES['th']}">{_t(data, 'name')}</th>
                <th style="{STYLES['th_center']}">{_t(data, 'att_rate')}</th>
                <th style="{STYLES['th_center']}">{_t(data, 'unapp_abs')}</th>
                <th style="{STYLES['th']}">{_t(data, 'boss_chain')}</th>
              </tr>
              {rows}
            </table>'''

        # Close TYPE inner card
        html += '''
          </div>
        </div>'''

    return html


def _section_6_attendance(data):
    """Section 6: 출근 미달자 상세 (TYPE별 → Building별 그룹 + 퇴사/휴가 표시)"""
    low_attendance = data.get("low_attendance", [])
    high_absence = data.get("high_absence", [])

    if not low_attendance and not high_absence:
        return ""

    # Detect language from _t
    t = data.get("_t", I18N["ko"])
    lang = "en" if t.get("kpi_title") == "Key KPI" else "vi" if t.get("kpi_title") == "KPI chính" else "ko"

    html = ""
    thresholds = data.get("thresholds", {})
    rate_th = thresholds.get("attendance_rate", 88)
    absence_th = thresholds.get("unapproved_absence", 2)

    # Low attendance rate — grouped by TYPE → Building
    if low_attendance:
        html += f'''
        <p style="font-size:15px;font-weight:700;color:#dc2626;margin:0 0 6px 0;">&#x1F534; {_t(data, 'att_below')} (&lt;{rate_th}%): {len(low_attendance)}{_t(data, 'ppl')}</p>
        {_render_att_table(data, low_attendance, lang)}
        <div style="{STYLES['action_box_red']}">
          &#x1F4CB; {_t(data, 'att_action')}
        </div>'''

    # High unapproved absence — grouped by TYPE → Building
    if high_absence:
        html += f'''
        <p style="font-size:15px;font-weight:700;color:#854d0e;margin:16px 0 6px 0;">&#x1F7E1; {_t(data, 'abs_over')} (&gt;{absence_th}{_t(data, 'days')}): {len(high_absence)}{_t(data, 'ppl')}</p>
        {_render_att_table(data, high_absence, lang)}
        <div style="{STYLES['action_box_yellow']}">
          &#x1F4CB; {_t(data, 'abs_action')}
        </div>'''

    return f'''
    <hr style="{STYLES['divider']}"/>
    <h2 style="{STYLES['section_title']}">{_t(data, 'attendance_title')}</h2>
    <div style="{STYLES['section_body']}">
      {html}
    </div>
    '''


def _section_7_type_breakdown(data):
    """Section 7: TYPE별 인센티브 현황"""
    summary = data.get("summary", {})
    type_breakdown = summary.get("type_breakdown", {})
    if not type_breakdown:
        return ""

    rows = ""
    for t in ["TYPE-1", "TYPE-2", "TYPE-3"]:
        info = type_breakdown.get(t, {})
        count = info.get("count", 0)
        receiving = info.get("receiving", 0)
        total_amount = info.get("total_amount", 0)
        pct = (receiving / count * 100) if count > 0 else 0

        rows += f'''
        <tr>
          <td style="{STYLES['td']};font-weight:600;">{t}</td>
          <td style="{STYLES['td_center']}">{count}</td>
          <td style="{STYLES['td_center']}">{receiving}</td>
          <td style="{STYLES['td_center']}">{_fmt_pct(pct)}</td>
          <td style="{STYLES['td_center']}">{_fmt_vnd(total_amount)}</td>
        </tr>'''

    return f'''
    <hr style="{STYLES['divider']}"/>
    <h2 style="{STYLES['section_title']}">{_t(data, 'type_title')}</h2>
    <div style="{STYLES['section_body']}">
      <table style="{STYLES['table']}">
        <tr>
          <th style="{STYLES['th']}">{_t(data, 'type')}</th>
          <th style="{STYLES['th_center']}">{_t(data, 'emp_count')}</th>
          <th style="{STYLES['th_center']}">{_t(data, 'receivers')}</th>
          <th style="{STYLES['th_center']}">{_t(data, 'pay_rate')}</th>
          <th style="{STYLES['th_center']}">{_t(data, 'total_vnd')}</th>
        </tr>
        {rows}
      </table>
    </div>
    '''


def _section_changes(data):
    """전월 대비 인사 변동 사항 섹션 (TYPE / 직책 / 직속상사 / Building / CFA / Talent Pool)."""
    changes = data.get("employee_changes", []) or []
    # Hide entire section if previous month data was unavailable AND no changes
    if not changes and not data.get("previous_month_name"):
        return ""

    t = data.get("_t") or I18N["ko"]
    title = t.get("changes_title", "Personnel Changes")
    subtitle = t.get("changes_subtitle", "")
    arrow = t.get("changes_arrow", "→")

    # Field label map
    field_labels = {
        "type": t.get("changes_field_type", "TYPE"),
        "position": t.get("changes_field_position", "Position"),
        "position_code": t.get("changes_field_position_code", "Code"),
        "boss_name": t.get("changes_field_boss_name", "Supervisor"),
        "building": t.get("changes_field_building", "Building"),
        "cfa_certified": t.get("changes_field_cfa_certified", "CFA"),
        "talent_pool_member": t.get("changes_field_talent_pool_member", "Talent Pool"),
    }

    # Field → chip style map (priority/severity encoding)
    field_chip_style = {
        "type": STYLES["chip_type"],
        "position": STYLES["chip_position"],
        "position_code": STYLES["chip_position_code"],
        "boss_name": STYLES["chip_boss"],
        "building": STYLES["chip_building"],
        "cfa_certified": STYLES["chip_cfa"],
        "talent_pool_member": STYLES["chip_talent"],
    }

    if not changes:
        body = f'<p style="font-size:13px;color:#64748b;margin:8px 0 4px 0;">{t.get("changes_none","")}</p>'
    else:
        rows = ""
        # Limit to 30 rows in email; provide note when truncated
        display_changes = changes[:30]
        for c in display_changes:
            emp_no = c.get("emp_no", "")
            name = c.get("name", "—")
            curr = c.get("current", {})
            curr_type = str(curr.get("type", "") or "—")
            change_cells = []
            for fld, (old, new) in c["changes"].items():
                label = field_labels.get(fld, fld)
                chip_style = field_chip_style.get(fld, STYLES["change_field_chip"])
                old_disp = old if old not in ("", "None", "False") else "—"
                new_disp = new if new not in ("", "None", "False") else "—"
                # boolean prettification
                if fld in ("cfa_certified", "talent_pool_member"):
                    old_disp = "Yes" if str(old).lower() in ("true", "1", "yes") else "No"
                    new_disp = "Yes" if str(new).lower() in ("true", "1", "yes") else "No"
                change_cells.append(
                    f'<div style="margin:3px 0;font-size:12px;line-height:1.7;">'
                    f'<span style="{chip_style}">{label}</span>'
                    f'<span style="{STYLES["change_old"]}">{old_disp}</span>'
                    f'<span style="{STYLES["change_arrow"]}">{arrow}</span>'
                    f'<span style="{STYLES["change_new"]}">{new_disp}</span>'
                    f'</div>'
                )
            rows += f'''
            <tr>
              <td style="{STYLES['td_center']};font-family:'SF Mono',Consolas,monospace;font-size:12px;color:#64748b;">{emp_no}</td>
              <td style="{STYLES['td']};font-weight:600;">{name}</td>
              <td style="{STYLES['td_center']};"><span style="{STYLES['badge_a'] if curr_type=='TYPE-1' else STYLES['badge_b'] if curr_type=='TYPE-2' else STYLES['badge_c'] if curr_type=='TYPE-3' else STYLES['bldg_default']}">{curr_type}</span></td>
              <td style="{STYLES['td']}">{''.join(change_cells)}</td>
            </tr>'''

        truncation_note = ""
        if len(changes) > 30:
            truncation_note = f'<p style="font-size:11px;color:#94a3b8;margin:8px 0 0 0;font-style:italic;">… +{len(changes)-30} {t.get("more","more")}</p>'

        body = f'''
        <p style="font-size:12px;color:#64748b;margin:0 0 12px 0;">{subtitle} <span style="color:#0f1f3a;font-weight:600;">{len(changes)} {t.get("changes_total","Changes")}</span></p>
        <table style="{STYLES['table']}">
          <tr>
            <th style="{STYLES['th_center']};width:90px;">{t.get('emp_no','#')}</th>
            <th style="{STYLES['th']};width:160px;">{t.get('name','Name')}</th>
            <th style="{STYLES['th_center']};width:80px;">{t.get('type','TYPE')}</th>
            <th style="{STYLES['th']}">{t.get('changes_title','Changes')}</th>
          </tr>
          {rows}
        </table>
        {truncation_note}
        '''

    return f'''
    <hr style="{STYLES['divider']}"/>
    <h2 style="{STYLES['section_title']}">{title}</h2>
    <div style="{STYLES['section_body']}">
      {body}
    </div>
    '''


def _section_8_links(data, dashboard_url=None):
    """Section 8: 액션 링크"""
    url = dashboard_url or "https://moonkaicuzui.github.io/hwk-qip-incentive-v10/"

    return f'''
    <hr style="{STYLES['divider']}"/>
    <h2 style="{STYLES['section_title']}">{_t(data, 'link_title')}</h2>
    <div style="{STYLES['section_body']}">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;font-size:13px;">&#x2022; <strong>{_t(data, 'dashboard')}</strong> <a href="{url}" style="color:#3b82f6;">{url}</a></td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;">&#x2022; <strong>{_t(data, 'detail_lookup')}</strong> {_t(data, 'detail_how')}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;">&#x2022; <strong>{_t(data, 'aql_analysis')}</strong> {_t(data, 'aql_how')}</td>
        </tr>
      </table>
    </div>
    '''


# ---------------------------------------------------------------------------
# Main template generator
# ---------------------------------------------------------------------------

def _header_data_period(config, lang="ko"):
    """Header sub-section: data source period info."""
    if not config:
        return ""

    date_ranges = config.get("data_date_ranges", {})
    att_range = date_ranges.get("attendance", {})
    files_times = config.get("files_modified_times", {})
    working_days = config.get("working_days", "")
    last_updated = config.get("last_updated", "")

    if not att_range and not files_times:
        return ""

    data_start = att_range.get("min", "")
    data_end = att_range.get("max", "")

    # Source file dates
    src_parts = []
    name_map = {"attendance": "Attendance", "5prs": "5PRS", "basic_manpower": "Manpower", "aql_current": "AQL"}
    for src_name, src_time in files_times.items():
        label = name_map.get(src_name, src_name)
        src_parts.append(f"{label}: {src_time[:10]}")

    # Labels by language
    if lang == "ko":
        period_label = "데이터 반영 기간"
        source_label = "소스 파일 날짜"
        wd_label = "근무일"
        updated_label = "최종 갱신"
    elif lang == "vi":
        period_label = "Kỳ dữ liệu"
        source_label = "Ngày tệp nguồn"
        wd_label = "ngày làm việc"
        updated_label = "Cập nhật cuối"
    else:
        period_label = "Data Period"
        source_label = "Source Files"
        wd_label = "working days"
        updated_label = "Last Updated"

    period_text = f"{data_start} — {data_end}" if data_start and data_end else ""
    wd_text = f" ({working_days} {wd_label})" if working_days else ""
    src_text = " | ".join(src_parts)
    upd_text = last_updated[:19].replace("T", " ") if last_updated else ""

    return f'''
      <div style="margin-top:10px;background:rgba(255,255,255,0.12);border-radius:6px;padding:10px 14px;font-size:12px;color:#c8ddf0;">
        <div><strong>{period_label}:</strong> {period_text}{wd_text}</div>
        <div style="margin-top:3px;"><strong>{source_label}:</strong> {src_text}</div>
        <div style="margin-top:3px;"><strong>{updated_label}:</strong> {upd_text}</div>
      </div>'''


MONTH_KO = {
    "january": "1월", "february": "2월", "march": "3월", "april": "4월",
    "may": "5월", "june": "6월", "july": "7월", "august": "8월",
    "september": "9월", "october": "10월", "november": "11월", "december": "12월"
}


def generate_email_html(action_data, month="february", year=2026, dashboard_url=None, generated_at=None, lang="ko", config=None):
    """전체 이메일 HTML 생성

    Args:
        action_data: build_action_report() 결과 dict
        month: 월 이름 (lowercase)
        year: 연도
        dashboard_url: 대시보드 URL (optional)
        generated_at: 생성 시각 문자열 (optional)
        lang: 언어 코드 ("ko", "en", or "vi")
        config: monthly config dict (for data period info, optional)

    Returns:
        str: 완전한 HTML 이메일 문자열
    """
    # Inject translation dict into action_data for section functions
    t = I18N.get(lang, I18N["ko"])
    action_data["_t"] = t

    # Get month name in target language
    month_idx = ["january","february","march","april","may","june",
                 "july","august","september","october","november","december"].index(month) + 1
    month_local = t.get(f"m{month_idx}", month)
    month_ko = MONTH_KO.get(month, month)  # keep for backward compat
    if generated_at is None:
        from datetime import datetime, timezone
        generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")

    # Render all sections
    s0 = _section_0_progress(action_data, month_local, year)
    s1 = _section_1_kpi(action_data)
    s1b = _section_1b_condition_rates(action_data)
    sc = _section_changes(action_data)  # NEW: personnel changes
    s2 = _section_2_building(action_data)
    s3 = _section_3_aql_failures(action_data)
    s4 = _section_4_consecutive_aql(action_data)
    s5 = _section_5_5prs(action_data)
    s6 = _section_6_attendance(action_data)
    s7 = _section_7_type_breakdown(action_data)
    s8 = _section_8_links(action_data, dashboard_url)

    # Wrap each section in a card
    card = STYLES["section_card"]
    def _card(content):
        if not content or not content.strip():
            return ""
        return f'<div style="{card}">{content}</div>'

    html_lang = "vi" if lang == "vi" else "en" if lang == "en" else "ko"

    # Build executive-style header eyebrow + title
    eyebrow_text = "HWK QUALITY · MANAGEMENT REPORT" if lang == "en" else \
                   "HWK QUALITY · BÁO CÁO QUẢN TRỊ" if lang == "vi" else \
                   "HWK QUALITY · 경영 리포트"
    issue_label = "Issue" if lang == "en" else "Số" if lang == "vi" else "발행"
    issue_id = f"{year}-{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month_idx-1]}"

    html = f'''<!DOCTYPE html>
<html lang="{html_lang}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>QIP Incentive Report — {year} {month_local}</title>
</head>
<body style="{STYLES['body']}">
  <div style="{STYLES['container']}">

    <!-- Executive Header -->
    <div style="{STYLES['header']}">
      <p style="{STYLES['header_eyebrow']}">{eyebrow_text}</p>
      <h1 style="{STYLES['header_title']}">QIP Incentive Status — {month_local} {year}</h1>
      <p style="{STYLES['header_sub']}">HWK QIP Incentive Dashboard · {issue_label} {issue_id}</p>
      {_header_data_period(config, lang)}
    </div>

    {s0}
    {_card(s1 + s1b)}
    {_card(sc)}
    {_card(s2)}
    {_card(s3)}
    {_card(s4)}
    {_card(s5)}
    {_card(s6)}
    {_card(s7)}
    {_card(s8)}

    <!-- Corporate Footer -->
    <div style="{STYLES['footer']}">
      <p style="{STYLES['footer_brand']}">HWK · Quality Operations</p>
      <p style="{STYLES['footer_meta']}">
        {_t(action_data, 'data_as_of')} {generated_at} (UTC) · {_t(action_data, 'auto_gen')}<br/>
        {_t(action_data, 'auto_sent')}
      </p>
      <p style="{STYLES['footer_legal']}">
        Confidential — for internal recipients only. © {year} Hwaseung Vina · QIP Incentive Dashboard V10
      </p>
    </div>

  </div>
</body>
</html>'''

    # Clean up injected translation
    action_data.pop("_t", None)
    return html
