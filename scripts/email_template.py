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
    "container": "max-width:700px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);",
    "header": "background:linear-gradient(135deg,#1e3a5f,#2d5a87);color:#ffffff;padding:24px 32px;",
    "header_title": "font-size:20px;font-weight:700;margin:0 0 4px 0;",
    "header_sub": "font-size:13px;color:#a8c8e8;margin:0;",
    "section_title": "font-size:16px;font-weight:700;color:#1e3a5f;margin:0 0 12px 0;padding:16px 32px 0 32px;",
    "section_body": "padding:0 32px 16px 32px;",
    "divider": "border:none;border-top:2px solid #e8edf2;margin:8px 32px;",
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
# Section renderers
# ---------------------------------------------------------------------------

def _section_1_kpi(data):
    """Section 1: 핵심 KPI 요약"""
    summary = data.get("summary", {})
    total = summary.get("total_employees", 0)
    receiving = summary.get("receiving_employees", 0)
    pct = (receiving / total * 100) if total > 0 else 0
    total_incentive = summary.get("total_incentive", 0)

    return f'''
    <h2 style="{STYLES['section_title']}">&#x1F4CA; &#xFE0F; &#xA0;&#xA0;&#xD540;&#xD575; KPI &#xC694;&#xC57D;</h2>
    <div style="{STYLES['section_body']}">
      <table style="{STYLES['kpi_table']}">
        <tr>
          <td style="{STYLES['kpi_cell']}">
            <p style="{STYLES['kpi_value']}">{total}</p>
            <p style="{STYLES['kpi_label']}">Total</p>
          </td>
          <td style="{STYLES['kpi_cell']}">
            <p style="{STYLES['kpi_value']};color:#22c55e;">{receiving}</p>
            <p style="{STYLES['kpi_label']}">Receiving</p>
          </td>
          <td style="{STYLES['kpi_cell']}">
            <p style="{STYLES['kpi_value']};color:#3b82f6;">{_fmt_pct(pct)}</p>
            <p style="{STYLES['kpi_label']}">Pay Rate</p>
          </td>
          <td style="{STYLES['kpi_cell']}">
            <p style="{STYLES['kpi_value']};color:#f59e0b;">{_fmt_vnd(total_incentive)}</p>
            <p style="{STYLES['kpi_label']}">Total (VND)</p>
          </td>
        </tr>
      </table>
    </div>
    '''


def _section_2_building(data):
    """Section 2: Building별 품질 현황"""
    buildings = data.get("building_quality", {})
    if not buildings:
        return ""

    rows = ""
    total_count = 0
    total_tests = 0
    total_fails = 0
    total_receiving = 0
    total_emp = 0

    # Sort by reject rate (worst first for action priority)
    sorted_bldgs = sorted(buildings.items(),
                          key=lambda x: x[1].get("reject_rate", 0),
                          reverse=True)

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

        rows += f'''
        <tr>
          <td style="{STYLES['td']}">{_grade_emoji(reject_rate)} {_bldg_badge(bldg)}</td>
          <td style="{STYLES['td_center']}">{count}</td>
          <td style="{STYLES['td_center']}">{tests}</td>
          <td style="{STYLES['td_center']}">{fails}</td>
          <td style="{STYLES['td_center']}">{_fmt_pct(reject_rate)}</td>
          <td style="{STYLES['td_center']}">{_fmt_pct(pay_rate)}</td>
          <td style="{STYLES['td_center']}">{_grade_badge(reject_rate)}</td>
        </tr>'''

    # Total row
    total_reject = (total_fails / total_tests * 100) if total_tests > 0 else 0
    total_pay_rate = (total_receiving / total_emp * 100) if total_emp > 0 else 0
    rows += f'''
    <tr style="{STYLES['tr_total']}">
      <td style="{STYLES['td']}">Total</td>
      <td style="{STYLES['td_center']}">{total_emp}</td>
      <td style="{STYLES['td_center']}">{total_tests}</td>
      <td style="{STYLES['td_center']}">{total_fails}</td>
      <td style="{STYLES['td_center']}">{_fmt_pct(total_reject)}</td>
      <td style="{STYLES['td_center']}">{_fmt_pct(total_pay_rate)}</td>
      <td style="{STYLES['td_center']}"></td>
    </tr>'''

    return f'''
    <hr style="{STYLES['divider']}"/>
    <h2 style="{STYLES['section_title']}">&#x1F3ED; Building&#xBCC4; &#xD488;&#xC9C8; &#xD604;&#xD669;</h2>
    <div style="{STYLES['section_body']}">
      <table style="{STYLES['table']}">
        <tr>
          <th style="{STYLES['th']}">Building</th>
          <th style="{STYLES['th_center']}">&#xC9C1;&#xC6D0;&#xC218;</th>
          <th style="{STYLES['th_center']}">AQL &#xAC80;&#xC0AC;</th>
          <th style="{STYLES['th_center']}">AQL &#xC2E4;&#xD328;</th>
          <th style="{STYLES['th_center']}">&#xB9AC;&#xC81D;&#xC728;</th>
          <th style="{STYLES['th_center']}">&#xC9C0;&#xAE09;&#xB960;</th>
          <th style="{STYLES['th_center']}">&#xB4F1;&#xAE09;</th>
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
            action_lines += f"{i}. {boss_name} (LL) &#8594; &#xBD80;&#xD558; {len(emps)}&#xBA85; AQL &#xC7AC;&#xAD50;&#xC721;. &#xBCF4;&#xACE0;: {boss_boss}{suffix}<br/>"

        html += f'''
        <p style="{STYLES['subtitle']}">{_bldg_badge(bldg)} AQL &#xC2E4;&#xD328; {len(fail_employees)}&#xBA85;</p>
        <table style="{STYLES['table']}">
          <tr>
            <th style="{STYLES['th']}">&#xC0AC;&#xBC88;</th>
            <th style="{STYLES['th']}">&#xC774;&#xB984;</th>
            <th style="{STYLES['th_center']}">&#xC2E4;&#xD328;</th>
            <th style="{STYLES['th']}">&#xB2F4;&#xB2F9;&#xC790; &#x2192; &#xC0C1;&#xC0AC;</th>
          </tr>
          {rows}
        </table>
        <div style="{STYLES['action_box']}">
          &#x1F4CB; <strong>&#xAD8C;&#xACE0; &#xC561;&#xC158;:</strong><br/>{action_lines}
        </div>
        '''

    if not has_failures:
        return f'''
        <hr style="{STYLES['divider']}"/>
        <h2 style="{STYLES['section_title']}">&#x1F6A8; AQL &#xC2E4;&#xD328;&#xC790; &#xC0C1;&#xC138;</h2>
        <div style="{STYLES['section_body']}">
          <p style="color:#22c55e;font-weight:600;">&#x2705; &#xC774;&#xBC88; &#xB2EC; AQL &#xC2E4;&#xD328;&#xC790; &#xC5C6;&#xC74C;</p>
        </div>
        '''

    return f'''
    <hr style="{STYLES['divider']}"/>
    <h2 style="{STYLES['section_title']}">&#x1F6A8; AQL &#xC2E4;&#xD328;&#xC790; &#xC0C1;&#xC138; (&#xC989;&#xC2DC; &#xC561;&#xC158; &#xD544;&#xC694;)</h2>
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
        <p style="{STYLES['subtitle']}">&#x1F534; 3&#xAC1C;&#xC6D4; &#xC5F0;&#xC18D; &#xC2E4;&#xD328; (&#xC778;&#xC13C;&#xD2F0;&#xBE0C; &#xCC28;&#xB2E8;): {len(continuous_3m)}&#xBA85;</p>
        <table style="{STYLES['table']}">
          <tr>
            <th style="{STYLES['th']}">&#xC0AC;&#xBC88;</th>
            <th style="{STYLES['th']}">&#xC774;&#xB984;</th>
            <th style="{STYLES['th_center']}">Building</th>
            <th style="{STYLES['th']}">&#xB2F4;&#xB2F9;&#xC790; &#x2192; &#xC0C1;&#xC0AC;</th>
          </tr>
          {rows}
        </table>
        <div style="{STYLES['action_box_red']}">
          &#x1F4CB; <strong>&#xC778;&#xC0AC; &#xC870;&#xCE58; &#xAC80;&#xD1A0; &#xD544;&#xC694;.</strong> 3&#xAC1C;&#xC6D4; &#xC5F0;&#xC18D; &#xC2E4;&#xD328; &#xC2DC; &#xC778;&#xC13C;&#xD2F0;&#xBE0C; &#xC601;&#xAD6C; &#xCC28;&#xB2E8;.
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
        <p style="{STYLES['subtitle']}">&#x1F7E1; 2&#xAC1C;&#xC6D4; &#xC5F0;&#xC18D; &#xC2E4;&#xD328; (&#xACBD;&#xACE0;): {len(continuous_2m)}&#xBA85;</p>
        <table style="{STYLES['table']}">
          <tr>
            <th style="{STYLES['th']}">&#xC0AC;&#xBC88;</th>
            <th style="{STYLES['th']}">&#xC774;&#xB984;</th>
            <th style="{STYLES['th_center']}">Building</th>
            <th style="{STYLES['th']}">&#xB2F4;&#xB2F9;&#xC790; &#x2192; &#xC0C1;&#xC0AC;</th>
          </tr>
          {rows}
        </table>
        <div style="{STYLES['action_box_yellow']}">
          &#x1F4CB; &#xB2E4;&#xC74C; &#xB2EC; &#xC2E4;&#xD328; &#xC2DC; 3&#xAC1C;&#xC6D4; &#xC5F0;&#xC18D; &#x2192; &#xAC01; &#xB2F4;&#xB2F9;&#xC790;&#xC5D0;&#xAC8C; &#xC9D1;&#xC911; &#xAD00;&#xB9AC; &#xC694;&#xCCAD;.
        </div>
        '''

    return f'''
    <hr style="{STYLES['divider']}"/>
    <h2 style="{STYLES['section_title']}">&#x26A0;&#xFE0F; &#xC5F0;&#xC18D; AQL &#xC2E4;&#xD328; &#xACBD;&#xACE0; (&#xC704;&#xD5D8; &#xAD00;&#xB9AC;)</h2>
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
        <p style="{STYLES['subtitle']}">&#x1F7E0; 5PRS &#xD1B5;&#xACFC;&#xC728; &#xBBF8;&#xB2EC; (&lt;{rate_th}%): {len(low_rate)}&#xBA85;</p>
        <table style="{STYLES['table']}">
          <tr>
            <th style="{STYLES['th']}">&#xC0AC;&#xBC88;</th>
            <th style="{STYLES['th']}">&#xC774;&#xB984;</th>
            <th style="{STYLES['th_center']}">&#xD1B5;&#xACFC;&#xC728;</th>
            <th style="{STYLES['th_center']}">&#xAC80;&#xC0AC;&#xB7C9;</th>
            <th style="{STYLES['th']}">&#xB2F4;&#xB2F9;&#xC790; &#x2192; &#xC0C1;&#xC0AC;</th>
          </tr>
          {rows}
        </table>
        <div style="{STYLES['action_box']}">
          &#x1F4CB; &#xAC01; &#xB2F4;&#xB2F9;&#xC790;&#xC5D0;&#xAC8C; 5PRS &#xAC80;&#xC0AC; &#xD488;&#xC9C8; &#xAC1C;&#xC120; &#xC9C0;&#xB3C4; &#xC694;&#xCCAD;.
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
        <p style="{STYLES['subtitle']}">&#x1F7E0; 5PRS &#xAC80;&#xC0AC;&#xB7C9; &#xBBF8;&#xB2EC; (&lt;{qty_th}&#xC871;): {len(low_qty)}&#xBA85;</p>
        <table style="{STYLES['table']}">
          <tr>
            <th style="{STYLES['th']}">&#xC0AC;&#xBC88;</th>
            <th style="{STYLES['th']}">&#xC774;&#xB984;</th>
            <th style="{STYLES['th_center']}">&#xD1B5;&#xACFC;&#xC728;</th>
            <th style="{STYLES['th_center']}">&#xAC80;&#xC0AC;&#xB7C9;</th>
            <th style="{STYLES['th']}">&#xB2F4;&#xB2F9;&#xC790; &#x2192; &#xC0C1;&#xC0AC;</th>
          </tr>
          {rows}
        </table>
        <div style="{STYLES['action_box']}">
          &#x1F4CB; &#xAC80;&#xC0AC; &#xAE30;&#xD68C; &#xBD80;&#xC871; &#xC5EC;&#xBD80; &#xD655;&#xC778; &#x2192; &#xAC80;&#xC0AC; &#xBC30;&#xC815; &#xC870;&#xC815; &#xC694;&#xCCAD;.
        </div>
        '''

    return f'''
    <hr style="{STYLES['divider']}"/>
    <h2 style="{STYLES['section_title']}">&#x1F50D; 5PRS &#xBBF8;&#xB2EC;&#xC790; &#xC0C1;&#xC138; (&#xD488;&#xC9C8; &#xAC80;&#xC0AC; &#xAD00;&#xB9AC;)</h2>
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
        <p style="{STYLES['subtitle']}">&#x1F534; &#xCD9C;&#xADFC;&#xC728; &#xBBF8;&#xB2EC; (&lt;{rate_th}%): {len(low_attendance)}&#xBA85;</p>
        <table style="{STYLES['table']}">
          <tr>
            <th style="{STYLES['th']}">&#xC0AC;&#xBC88;</th>
            <th style="{STYLES['th']}">&#xC774;&#xB984;</th>
            <th style="{STYLES['th_center']}">&#xCD9C;&#xADFC;&#xC728;</th>
            <th style="{STYLES['th_center']}">&#xBB34;&#xB2E8;&#xACB0;&#xADFC;</th>
            <th style="{STYLES['th']}">&#xB2F4;&#xB2F9;&#xC790; &#x2192; &#xC0C1;&#xC0AC;</th>
          </tr>
          {rows}
        </table>
        <div style="{STYLES['action_box_red']}">
          &#x1F4CB; &#xBB34;&#xB2E8;&#xACB0;&#xADFC; &#xCD08;&#xACFC;&#xC790;&#xB294; &#xC989;&#xC2DC; &#xB2F4;&#xB2F9;&#xC790;&#xC5D0;&#xAC8C; &#xC0AC;&#xC720; &#xD655;&#xC778; &#xC694;&#xCCAD;.
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
        <p style="{STYLES['subtitle']}">&#x1F7E1; &#xBB34;&#xB2E8;&#xACB0;&#xADFC; &#xCD08;&#xACFC; (&gt;{absence_th}&#xC77C;): {len(high_absence)}&#xBA85;</p>
        <table style="{STYLES['table']}">
          <tr>
            <th style="{STYLES['th']}">&#xC0AC;&#xBC88;</th>
            <th style="{STYLES['th']}">&#xC774;&#xB984;</th>
            <th style="{STYLES['th_center']}">&#xCD9C;&#xADFC;&#xC728;</th>
            <th style="{STYLES['th_center']}">&#xBB34;&#xB2E8;&#xACB0;&#xADFC;</th>
            <th style="{STYLES['th']}">&#xB2F4;&#xB2F9;&#xC790; &#x2192; &#xC0C1;&#xC0AC;</th>
          </tr>
          {rows}
        </table>
        <div style="{STYLES['action_box_yellow']}">
          &#x1F4CB; &#xAC01; &#xB2F4;&#xB2F9;&#xC790;&#xC5D0;&#xAC8C; &#xBB34;&#xB2E8;&#xACB0;&#xADFC; &#xC0AC;&#xC720; &#xD655;&#xC778; &#xBC0F; &#xC7AC;&#xBC1C; &#xBC29;&#xC9C0; &#xC9C0;&#xB3C4; &#xC694;&#xCCAD;.
        </div>
        '''

    return f'''
    <hr style="{STYLES['divider']}"/>
    <h2 style="{STYLES['section_title']}">&#x1F4C5; &#xCD9C;&#xADFC; &#xBBF8;&#xB2EC;&#xC790; &#xC0C1;&#xC138; (&#xADFC;&#xD0DC; &#xAD00;&#xB9AC;)</h2>
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
    <h2 style="{STYLES['section_title']}">&#x1F4CA; TYPE&#xBCC4; &#xC778;&#xC13C;&#xD2F0;&#xBE0C; &#xD604;&#xD669;</h2>
    <div style="{STYLES['section_body']}">
      <table style="{STYLES['table']}">
        <tr>
          <th style="{STYLES['th']}">TYPE</th>
          <th style="{STYLES['th_center']}">&#xC9C1;&#xC6D0;&#xC218;</th>
          <th style="{STYLES['th_center']}">&#xC218;&#xB839;&#xC790;</th>
          <th style="{STYLES['th_center']}">&#xC9C0;&#xAE09;&#xB960;</th>
          <th style="{STYLES['th_center']}">&#xCD1D; &#xC9C0;&#xAE09;&#xC561; (VND)</th>
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
    <h2 style="{STYLES['section_title']}">&#x1F517; &#xC561;&#xC158; &#xB9C1;&#xD06C;</h2>
    <div style="{STYLES['section_body']}">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;font-size:13px;">&#x2022; <strong>&#xB300;&#xC2DC;&#xBCF4;&#xB4DC;:</strong> <a href="{url}" style="color:#3b82f6;">{url}</a></td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;">&#x2022; <strong>&#xC0C1;&#xC138; &#xC9C1;&#xC6D0; &#xC870;&#xD68C;:</strong> &#xB300;&#xC2DC;&#xBCF4;&#xB4DC; &#x2192; &#xC9C1;&#xC6D0; &#xC774;&#xB984; &#xD074;&#xB9AD;</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;">&#x2022; <strong>AQL &#xBD84;&#xC11D;:</strong> &#xB300;&#xC2DC;&#xBCF4;&#xB4DC; &#x2192; &#xC694;&#xC57D; &#xD0ED; &#x2192; AQL &#xAC80;&#xC99D; &#xC139;&#xC158;</td>
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


def generate_email_html(action_data, month="february", year=2026, dashboard_url=None, generated_at=None):
    """전체 이메일 HTML 생성

    Args:
        action_data: build_action_report() 결과 dict
        month: 월 이름 (lowercase)
        year: 연도
        dashboard_url: 대시보드 URL (optional)
        generated_at: 생성 시각 문자열 (optional)

    Returns:
        str: 완전한 HTML 이메일 문자열
    """
    month_ko = MONTH_KO.get(month, month)
    if generated_at is None:
        from datetime import datetime
        generated_at = datetime.now().strftime("%Y-%m-%d %H:%M")

    # Render all sections
    s1 = _section_1_kpi(action_data)
    s2 = _section_2_building(action_data)
    s3 = _section_3_aql_failures(action_data)
    s4 = _section_4_consecutive_aql(action_data)
    s5 = _section_5_5prs(action_data)
    s6 = _section_6_attendance(action_data)
    s7 = _section_7_type_breakdown(action_data)
    s8 = _section_8_links(action_data, dashboard_url)

    html = f'''<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>QIP Incentive Report - {year}&#xB144; {month_ko}</title>
</head>
<body style="{STYLES['body']}">
  <div style="{STYLES['container']}">

    <!-- Header -->
    <div style="{STYLES['header']}">
      <h1 style="{STYLES['header_title']}">&#x1F4CA; QIP &#xC778;&#xC13C;&#xD2F0;&#xBE0C; &#xC561;&#xC158; &#xB9AC;&#xD3EC;&#xD2B8; - {year}&#xB144; {month_ko}</h1>
      <p style="{STYLES['header_sub']}">HWK QIP Incentive Dashboard V10</p>
    </div>

    {s1}
    {s2}
    {s3}
    {s4}
    {s5}
    {s6}
    {s7}
    {s8}

    <!-- Footer -->
    <div style="{STYLES['footer']}">
      &#x1F4C5; &#xB370;&#xC774;&#xD130; &#xAE30;&#xC900;: {generated_at} (&#xC790;&#xB3D9; &#xC0DD;&#xC131;)<br/>
      &#xC774; &#xC774;&#xBA54;&#xC77C;&#xC740; QIP Incentive Dashboard &#xC2DC;&#xC2A4;&#xD15C;&#xC5D0;&#xC11C; &#xC790;&#xB3D9; &#xBC1C;&#xC1A1;&#xB418;&#xC5C8;&#xC2B5;&#xB2C8;&#xB2E4;.
    </div>

  </div>
</body>
</html>'''

    return html
