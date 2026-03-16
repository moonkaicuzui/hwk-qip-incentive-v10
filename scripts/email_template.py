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
    "body": "margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;",
    "container": "max-width:1050px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);",
    "header": "background:linear-gradient(135deg,#1e3a5f,#2d5a87);color:#ffffff;padding:24px 32px;",
    "header_title": "font-size:20px;font-weight:700;margin:0 0 4px 0;",
    "header_sub": "font-size:13px;color:#a8c8e8;margin:0;",
    "section_title": "font-size:16px;font-weight:700;color:#1e3a5f;margin:0 0 12px 0;padding:16px 32px 0 32px;",
    "section_body": "padding:0 32px 16px 32px;",
    "divider": "border:none;border-top:2px solid #e8edf2;margin:8px 32px;",
    # Progress banner
    "progress_banner": "background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:12px 16px;margin:16px 32px;font-size:13px;color:#1e40af;",
    "progress_bar_bg": "background:#e5e7eb;border-radius:4px;height:8px;width:100%;overflow:hidden;",
    "progress_bar_fill": "background:linear-gradient(90deg,#3b82f6,#60a5fa);height:8px;border-radius:4px;",
    # Condition bars
    "cond_bar_bg": "background:#e5e7eb;border-radius:3px;height:16px;width:100%;position:relative;overflow:hidden;",
    "cond_bar_green": "background:#22c55e;height:16px;border-radius:3px;",
    "cond_bar_yellow": "background:#f59e0b;height:16px;border-radius:3px;",
    "cond_bar_red": "background:#ef4444;height:16px;border-radius:3px;",
    # Comparison delta
    "delta_up": "color:#22c55e;font-size:11px;font-weight:600;",
    "delta_down": "color:#ef4444;font-size:11px;font-weight:600;",
    "delta_neutral": "color:#6b7280;font-size:11px;font-weight:600;",
    # KPI cards
    "kpi_table": "width:100%;border-collapse:collapse;",
    "kpi_cell": "text-align:center;padding:12px 8px;width:25%;",
    "kpi_value": "font-size:24px;font-weight:700;color:#1e3a5f;margin:0;",
    "kpi_label": "font-size:11px;color:#6b7b8d;text-transform:uppercase;letter-spacing:0.5px;margin:4px 0 0 0;",
    # Tables
    "table": "width:100%;border-collapse:collapse;font-size:13px;",
    "th": "background:#f0f4f8;color:#1e3a5f;font-weight:600;padding:8px 10px;text-align:left;border-bottom:2px solid #d0d8e0;",
    "th_center": "background:#f0f4f8;color:#1e3a5f;font-weight:600;padding:8px 10px;text-align:center;border-bottom:2px solid #d0d8e0;",
    "td": "padding:8px 10px;border-bottom:1px solid #eef1f5;color:#333;",
    "td_center": "padding:8px 10px;border-bottom:1px solid #eef1f5;color:#333;text-align:center;",
    "tr_total": "background:#f8f9fb;font-weight:700;",
    # Badges
    "badge_a": "display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#dcfce7;color:#166534;",
    "badge_b": "display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#fef9c3;color:#854d0e;",
    "badge_c": "display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#fecaca;color:#991b1b;",
    # Action box
    "action_box": "background:#eff6ff;border-left:4px solid #3b82f6;padding:10px 14px;margin:8px 0 16px 0;border-radius:0 6px 6px 0;font-size:12px;color:#1e40af;",
    "action_box_red": "background:#fef2f2;border-left:4px solid #ef4444;padding:10px 14px;margin:8px 0 16px 0;border-radius:0 6px 6px 0;font-size:12px;color:#991b1b;",
    "action_box_yellow": "background:#fefce8;border-left:4px solid #f59e0b;padding:10px 14px;margin:8px 0 16px 0;border-radius:0 6px 6px 0;font-size:12px;color:#854d0e;",
    # Building colors
    "bldg_a": "display:inline-block;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:600;background:#fee2e2;color:#b91c1c;",
    "bldg_b": "display:inline-block;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:600;background:#dbeafe;color:#1d4ed8;",
    "bldg_b3": "display:inline-block;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:600;background:#e9d5ff;color:#7c3aed;",
    "bldg_c": "display:inline-block;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:600;background:#dcfce7;color:#166534;",
    "bldg_d": "display:inline-block;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:600;background:#ffedd5;color:#c2410c;",
    "bldg_default": "display:inline-block;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:600;background:#f3f4f6;color:#4b5563;",
    # Footer
    "footer": "background:#f8f9fb;padding:16px 32px;text-align:center;font-size:11px;color:#9ca3af;",
    # Subtitle for sub-sections
    "subtitle": "font-size:14px;font-weight:600;color:#374151;margin:12px 0 8px 0;",
    # Boss chain text
    "boss_chain": "font-size:11px;color:#6b7280;margin:0;",
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
        # Condition names
        "c1": "출근율", "c2": "AQL 합격률", "c3": "5PRS 통과율", "c4": "연속 불합격",
        "c5": "근속 기간", "c6": "징계 이력", "c7": "무단 결근", "c8": "지각 횟수",
        "c9": "조기 퇴근", "c10": "특별 감점",
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
    "vi": {
        # Condition names
        "c1": "Tỷ lệ đi làm", "c2": "Tỷ lệ đạt AQL", "c3": "Tỷ lệ đạt 5PRS",
        "c4": "Lỗi liên tiếp", "c5": "Thâm niên", "c6": "Kỷ luật",
        "c7": "Vắng không phép", "c8": "Số lần đi trễ", "c9": "Về sớm",
        "c10": "Trừ điểm đặc biệt",
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
    <h2 style="{STYLES['section_title']}">&#x1F3AF; {_t(data, 'condition_title')}</h2>
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
    <h2 style="{STYLES['section_title']}">&#x1F4CA; {_t(data, 'kpi_title')}</h2>
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
    <h2 style="{STYLES['section_title']}">&#x1F4CA; {_t(data, 'kpi_title')}</h2>
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


def _section_2_building(data):
    """Section 2: Building별 품질 현황 (전월 비교, 주요 건물만)"""
    buildings = data.get("building_quality", {})
    if not buildings:
        return ""

    prev_bldg = data.get("previous_building", {})

    # Separate into active (has AQL tests or >5 employees) and others
    active_bldgs = {}
    other_count = 0
    other_emp = 0
    for bldg, info in buildings.items():
        tests = info.get("tests", 0)
        count = info.get("count", 0)
        if tests > 0 or count >= 10:
            active_bldgs[bldg] = info
        else:
            other_count += 1
            other_emp += count

    rows = ""
    total_count = 0
    total_tests = 0
    total_fails = 0
    total_receiving = 0
    total_emp = 0

    # Sort by reject rate (worst first for action priority)
    sorted_bldgs = sorted(active_bldgs.items(),
                          key=lambda x: (-x[1].get("reject_rate", 0), -x[1].get("count", 0)))

    for bldg, info in sorted_bldgs:
        count = info.get("count", 0)
        tests = info.get("tests", 0)
        fails = info.get("fail_count", 0)
        reject_rate = info.get("reject_rate", 0)
        receiving = info.get("receiving", 0)
        pay_rate = (receiving / count * 100) if count > 0 else 0

        total_count += count
        total_tests += tests
        total_fails += fails
        total_receiving += receiving
        total_emp += count

        # Previous month comparison for this building
        prev_info = prev_bldg.get(bldg, {})
        prev_recv = prev_info.get("receiving", 0)
        prev_cnt = prev_info.get("count", 0)
        prev_pay = (prev_recv / prev_cnt * 100) if prev_cnt > 0 else 0
        prev_col = ""
        if prev_cnt > 0:
            prev_col = f'{prev_recv}/{prev_cnt} ({prev_pay:.0f}%)'

        rows += f'''
        <tr>
          <td style="{STYLES['td']}">{_grade_emoji(reject_rate)} {_bldg_badge(bldg)}</td>
          <td style="{STYLES['td_center']}">{count}</td>
          <td style="{STYLES['td_center']}">{tests}</td>
          <td style="{STYLES['td_center']}">{fails}</td>
          <td style="{STYLES['td_center']}">{_fmt_pct(reject_rate)}</td>
          <td style="{STYLES['td_center']}">{_grade_badge(reject_rate)}</td>
          <td style="{STYLES['td_center']};font-size:11px;color:#6b7280;">{prev_col}</td>
        </tr>'''

    # Other buildings row (collapsed)
    if other_count > 0:
        total_emp += other_emp
        rows += f'''
        <tr style="background:#fafbfc;">
          <td style="{STYLES['td']};color:#9ca3af;font-style:italic;" colspan="2">{_t(data, 'other_bldgs')} {other_count}{_t(data, 'bldg_unit')} ({other_emp}{_t(data, 'ppl')})</td>
          <td style="{STYLES['td_center']};color:#9ca3af;" colspan="5">{_t(data, 'no_aql')}</td>
        </tr>'''

    # Total row
    total_reject = (total_fails / total_tests * 100) if total_tests > 0 else 0
    rows += f'''
    <tr style="{STYLES['tr_total']}">
      <td style="{STYLES['td']}">Total</td>
      <td style="{STYLES['td_center']}">{total_emp}</td>
      <td style="{STYLES['td_center']}">{total_tests}</td>
      <td style="{STYLES['td_center']}">{total_fails}</td>
      <td style="{STYLES['td_center']}">{_fmt_pct(total_reject)}</td>
      <td style="{STYLES['td_center']}"></td>
      <td style="{STYLES['td_center']}"></td>
    </tr>'''

    return f'''
    <hr style="{STYLES['divider']}"/>
    <h2 style="{STYLES['section_title']}">&#x1F3ED; {_t(data, 'building_title')}</h2>
    <div style="{STYLES['section_body']}">
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
        {rows}
      </table>
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
        <h2 style="{STYLES['section_title']}">&#x1F6A8; {_t(data, 'aql_fail_title')}</h2>
        <div style="{STYLES['section_body']}">
          <p style="color:#22c55e;font-weight:600;">&#x2705; {_t(data, 'aql_none')}</p>
        </div>
        '''

    return f'''
    <hr style="{STYLES['divider']}"/>
    <h2 style="{STYLES['section_title']}">&#x1F6A8; {_t(data, 'aql_fail_title')}</h2>
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
    <h2 style="{STYLES['section_title']}">&#x26A0;&#xFE0F; {_t(data, 'consecutive_title')}</h2>
    <div style="{STYLES['section_body']}">
      {html}
    </div>
    '''


def _section_5_5prs(data):
    """Section 5: 5PRS 미달자 상세"""
    low_rate = data.get("low_prs_rate", [])
    low_qty = data.get("low_prs_qty", [])

    if not low_rate and not low_qty:
        return ""

    html = ""
    thresholds = data.get("thresholds", {})
    rate_th = thresholds.get("5prs_pass_rate", 95)
    qty_th = thresholds.get("5prs_min_qty", 100)

    # Low pass rate
    if low_rate:
        rows = ""
        for emp in low_rate:
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

        html += f'''
        <p style="{STYLES['subtitle']}">&#x1F7E0; {_t(data, 'prs_rate_below')} (&lt;{rate_th}%): {len(low_rate)}{_t(data, 'ppl')}</p>
        <table style="{STYLES['table']}">
          <tr>
            <th style="{STYLES['th']}">{_t(data, 'emp_no')}</th>
            <th style="{STYLES['th']}">{_t(data, 'name')}</th>
            <th style="{STYLES['th_center']}">{_t(data, 'pass_rate_h')}</th>
            <th style="{STYLES['th_center']}">{_t(data, 'insp_qty')}</th>
            <th style="{STYLES['th']}">{_t(data, 'boss_chain')}</th>
          </tr>
          {rows}
        </table>
        <div style="{STYLES['action_box']}">
          &#x1F4CB; {_t(data, 'prs_action')}
        </div>
        '''

    # Low inspection quantity
    if low_qty:
        rows = ""
        for emp in low_qty:
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

        html += f'''
        <p style="{STYLES['subtitle']}">&#x1F7E0; {_t(data, 'prs_qty_below')} (&lt;{qty_th}): {len(low_qty)}{_t(data, 'ppl')}</p>
        <table style="{STYLES['table']}">
          <tr>
            <th style="{STYLES['th']}">{_t(data, 'emp_no')}</th>
            <th style="{STYLES['th']}">{_t(data, 'name')}</th>
            <th style="{STYLES['th_center']}">{_t(data, 'pass_rate_h')}</th>
            <th style="{STYLES['th_center']}">{_t(data, 'insp_qty')}</th>
            <th style="{STYLES['th']}">{_t(data, 'boss_chain')}</th>
          </tr>
          {rows}
        </table>
        <div style="{STYLES['action_box']}">
          &#x1F4CB; {_t(data, 'prs_qty_action')}
        </div>
        '''

    return f'''
    <hr style="{STYLES['divider']}"/>
    <h2 style="{STYLES['section_title']}">&#x1F50D; {_t(data, 'prs_title')}</h2>
    <div style="{STYLES['section_body']}">
      {html}
    </div>
    '''


def _section_6_attendance(data):
    """Section 6: 출근 미달자 상세"""
    low_attendance = data.get("low_attendance", [])
    high_absence = data.get("high_absence", [])

    if not low_attendance and not high_absence:
        return ""

    html = ""
    thresholds = data.get("thresholds", {})
    rate_th = thresholds.get("attendance_rate", 88)
    absence_th = thresholds.get("unapproved_absence", 2)

    # Low attendance rate
    if low_attendance:
        rows = ""
        for emp in low_attendance:
            chain = _boss_chain_html(
                emp.get("boss_name"), emp.get("boss_boss_name"), emp.get("boss_boss_position")
            )
            rows += f'''
            <tr>
              <td style="{STYLES['td']}">{emp.get('emp_no', '')}</td>
              <td style="{STYLES['td']}">{emp.get('name', '')}</td>
              <td style="{STYLES['td_center']}">{_fmt_pct(emp.get('attendance_rate', 0))}</td>
              <td style="{STYLES['td_center']}">{emp.get('unapproved_absence', 0)}</td>
              <td style="{STYLES['td']};font-size:12px;">{chain}</td>
            </tr>'''

        html += f'''
        <p style="{STYLES['subtitle']}">&#x1F534; {_t(data, 'att_below')} (&lt;{rate_th}%): {len(low_attendance)}{_t(data, 'ppl')}</p>
        <table style="{STYLES['table']}">
          <tr>
            <th style="{STYLES['th']}">{_t(data, 'emp_no')}</th>
            <th style="{STYLES['th']}">{_t(data, 'name')}</th>
            <th style="{STYLES['th_center']}">{_t(data, 'att_rate')}</th>
            <th style="{STYLES['th_center']}">{_t(data, 'unapp_abs')}</th>
            <th style="{STYLES['th']}">{_t(data, 'boss_chain')}</th>
          </tr>
          {rows}
        </table>
        <div style="{STYLES['action_box_red']}">
          &#x1F4CB; {_t(data, 'att_action')}
        </div>
        '''

    # High unapproved absence
    if high_absence:
        rows = ""
        for emp in high_absence:
            chain = _boss_chain_html(
                emp.get("boss_name"), emp.get("boss_boss_name"), emp.get("boss_boss_position")
            )
            rows += f'''
            <tr>
              <td style="{STYLES['td']}">{emp.get('emp_no', '')}</td>
              <td style="{STYLES['td']}">{emp.get('name', '')}</td>
              <td style="{STYLES['td_center']}">{_fmt_pct(emp.get('attendance_rate', 0))}</td>
              <td style="{STYLES['td_center']}">{emp.get('unapproved_absence', 0)}</td>
              <td style="{STYLES['td']};font-size:12px;">{chain}</td>
            </tr>'''

        html += f'''
        <p style="{STYLES['subtitle']}">&#x1F7E1; {_t(data, 'abs_over')} (&gt;{absence_th}{_t(data, 'days')}): {len(high_absence)}{_t(data, 'ppl')}</p>
        <table style="{STYLES['table']}">
          <tr>
            <th style="{STYLES['th']}">{_t(data, 'emp_no')}</th>
            <th style="{STYLES['th']}">{_t(data, 'name')}</th>
            <th style="{STYLES['th_center']}">{_t(data, 'att_rate')}</th>
            <th style="{STYLES['th_center']}">{_t(data, 'unapp_abs')}</th>
            <th style="{STYLES['th']}">{_t(data, 'boss_chain')}</th>
          </tr>
          {rows}
        </table>
        <div style="{STYLES['action_box_yellow']}">
          &#x1F4CB; {_t(data, 'abs_action')}
        </div>
        '''

    return f'''
    <hr style="{STYLES['divider']}"/>
    <h2 style="{STYLES['section_title']}">&#x1F4C5; {_t(data, 'attendance_title')}</h2>
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
    <h2 style="{STYLES['section_title']}">&#x1F4CA; {_t(data, 'type_title')}</h2>
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


def _section_8_links(data, dashboard_url=None):
    """Section 8: 액션 링크"""
    url = dashboard_url or "https://moonkaicuzui.github.io/hwk-qip-incentive-v10/"

    return f'''
    <hr style="{STYLES['divider']}"/>
    <h2 style="{STYLES['section_title']}">&#x1F517; {_t(data, 'link_title')}</h2>
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

MONTH_KO = {
    "january": "1월", "february": "2월", "march": "3월", "april": "4월",
    "may": "5월", "june": "6월", "july": "7월", "august": "8월",
    "september": "9월", "october": "10월", "november": "11월", "december": "12월"
}


def generate_email_html(action_data, month="february", year=2026, dashboard_url=None, generated_at=None, lang="ko"):
    """전체 이메일 HTML 생성

    Args:
        action_data: build_action_report() 결과 dict
        month: 월 이름 (lowercase)
        year: 연도
        dashboard_url: 대시보드 URL (optional)
        generated_at: 생성 시각 문자열 (optional)
        lang: 언어 코드 ("ko" or "vi")

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
    s2 = _section_2_building(action_data)
    s3 = _section_3_aql_failures(action_data)
    s4 = _section_4_consecutive_aql(action_data)
    s5 = _section_5_5prs(action_data)
    s6 = _section_6_attendance(action_data)
    s7 = _section_7_type_breakdown(action_data)
    s8 = _section_8_links(action_data, dashboard_url)

    html_lang = "vi" if lang == "vi" else "ko"
    html = f'''<!DOCTYPE html>
<html lang="{html_lang}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>QIP Incentive Report - {year} {month_local}</title>
</head>
<body style="{STYLES['body']}">
  <div style="{STYLES['container']}">

    <!-- Header -->
    <div style="{STYLES['header']}">
      <h1 style="{STYLES['header_title']}">QIP - {year} {month_local}</h1>
      <p style="{STYLES['header_sub']}">HWK QIP Incentive Dashboard V10</p>
    </div>

    {s0}
    {s1}
    {s1b}
    {s2}
    {s3}
    {s4}
    {s5}
    {s6}
    {s7}
    {s8}

    <!-- Footer -->
    <div style="{STYLES['footer']}">
      &#x1F4C5; {_t(action_data, 'data_as_of')} {generated_at} {_t(action_data, 'auto_gen')}<br/>
      {_t(action_data, 'auto_sent')}
    </div>

  </div>
</body>
</html>'''

    # Clean up injected translation
    action_data.pop("_t", None)
    return html
