#!/usr/bin/env python3
"""
Generate QIP Incentive Policy Document Version 3
- Follows V2 document structure/format exactly
- 100% aligned with V10 system code
- Validity: March 2026 ~ February 2027
"""

from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml
import os


def set_cell_shading(cell, color):
    shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color}"/>')
    cell._tc.get_or_add_tcPr().append(shading)


def make_header_row(table, headers, bg="2F5496"):
    hdr = table.rows[0].cells
    for i, text in enumerate(headers):
        p = hdr[i].paragraphs[0]
        run = p.add_run(text)
        run.bold = True
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(255, 255, 255)
        set_cell_shading(hdr[i], bg)


def add_row(table, cells_data, bold=False, bg_color=None):
    row = table.add_row()
    for i, text in enumerate(cells_data):
        cell = row.cells[i]
        p = cell.paragraphs[0]
        run = p.add_run(str(text))
        run.font.size = Pt(9)
        if bold:
            run.bold = True
        if bg_color:
            set_cell_shading(cell, bg_color)
    return row


def bullet(doc, text, bold_prefix=None):
    p = doc.add_paragraph(style='List Bullet')
    if bold_prefix:
        run = p.add_run(bold_prefix)
        run.bold = True
        run.font.size = Pt(10)
        p.add_run(text)
    else:
        run = p.add_run(text)
        run.font.size = Pt(10)
    return p


def bold_para(doc, bold_text, normal_text=""):
    p = doc.add_paragraph()
    run = p.add_run(bold_text)
    run.bold = True
    if normal_text:
        p.add_run(normal_text)
    return p


def create_policy():
    doc = Document()

    # Page setup
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin = Cm(2.5)
    section.right_margin = Cm(2.5)

    style = doc.styles['Normal']
    style.font.name = 'Calibri'
    style.font.size = Pt(10)

    # ══════════════════════════════════════════
    # TITLE PAGE
    # ══════════════════════════════════════════
    for _ in range(6):
        doc.add_paragraph()

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("HWK QIP INCENTIVE POLICY")
    run.font.size = Pt(26)
    run.bold = True
    run.font.color.rgb = RGBColor(47, 84, 150)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("Version 3 — Updated March 2026")
    run.font.size = Pt(14)
    run.font.color.rgb = RGBColor(89, 89, 89)

    doc.add_paragraph()

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("Validity Period: March 2026 ~ February 2027")
    run.font.size = Pt(13)
    run.bold = True
    run.font.color.rgb = RGBColor(47, 84, 150)

    doc.add_paragraph()

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("Quality Improvement Program Department\nHWK Vina")
    run.font.size = Pt(11)
    run.font.color.rgb = RGBColor(89, 89, 89)

    doc.add_page_break()

    # ══════════════════════════════════════════
    # TABLE OF CONTENTS
    # ══════════════════════════════════════════
    doc.add_heading("TABLE OF CONTENTS", level=1)

    toc_items = [
        ("Section 1.", " Overview"),
        ("Section 2.", " General Explanation on Incentive Policy Structure"),
        ("Section 3.", " Scope and Objects"),
        ("Section 4.", " Definitions & Abbreviations"),
        ("Section 5.", " Incentive Amount Calculation Method — Program 1"),
        ("Section 6.", " Incentive Amount Calculation Method — Program 2"),
        ("Section 7.", " Summary of Exceptional Clauses"),
        ("Section 8.", " System Architecture & Dashboard (V10)"),
        ("Appendix 1:", " 10 Incentive Conditions — Detailed Description"),
        ("Appendix 2:", " Position-Condition Application Matrix"),
        ("Appendix 3:", " HWK QIP Talent Pool Status"),
        ("Appendix 4:", " QIP Team R&R Map"),
    ]
    for bold_part, normal_part in toc_items:
        p = doc.add_paragraph(style='List Number')
        run = p.add_run(bold_part)
        run.bold = True
        p.add_run(normal_part)

    doc.add_page_break()

    # ══════════════════════════════════════════
    # SECTION 1. OVERVIEW
    # ══════════════════════════════════════════
    doc.add_heading("SECTION 1. OVERVIEW", level=1)

    doc.add_paragraph(
        '"HWK QIP INCENTIVE POLICY" is designed to renew every 6 months. The 1st version was created '
        'in February 2025, and this document represents the updated Version 3, reflecting the current '
        'V10 system architecture with Firestore-based data management and automated calculation pipeline.'
    )
    doc.add_paragraph(
        'This document provides an overview of the HWK company\'s incentive policy aimed at achieving '
        'key quality targets. By offering incentives based on quality performance metrics, we seek to '
        'strengthen company-wide quality management and ultimately reach our 5Q KPI milestones as a '
        'Global Top 3 quality Factory continuously. Through this incentive scheme, we aim to solidify '
        'our HWK factory culture of quality management, increase employee engagement, and reduce turnover '
        'rates, thereby ensuring a stable and motivated workforce. The QIP incentive policy applies to '
        'all QIP team members.'
    )

    doc.add_heading("PURPOSE", level=2)
    bullet(doc, "To improve & achieve the best HWK quality performance through sustainable motivation.")
    bullet(doc, "Establish a continuous quality management system: By providing quality performance-based incentives, "
           "our goal is to maintain and enhance company-wide quality initiatives.")
    bullet(doc, "Achieve 5Q goals: We aim to motivate all teams, including the quality team, to meet the highest "
           "quality standards (5Q) and ensure that the company's objectives are clearly shared across the organization.")
    bullet(doc, "Enhance motivation and organizational stability: Through a well-defined rewards system tied to "
           "excellent quality performance, we seek to increase employees' sense of accomplishment and effectively manage turnover rates.")
    bullet(doc, "Strengthen collaboration and internal communication: By fostering interdepartmental collaboration and "
           "sharing of best practices, we aim to support overall organizational performance and progress toward quality targets.")

    doc.add_page_break()

    # ══════════════════════════════════════════
    # SECTION 2. GENERAL EXPLANATION
    # ══════════════════════════════════════════
    doc.add_heading("SECTION 2. GENERAL EXPLANATION ON INCENTIVE POLICY STRUCTURE", level=1)

    doc.add_paragraph("HWK QIP incentive policy has mainly 2 Programs:")
    bullet(doc, 'Program 1: "Monthly-Performance-Based-Incentive Program"')
    bullet(doc, 'Program 2: "6-Month-Performance-Based-Incentive Program"')

    doc.add_paragraph(
        "Program 1 of HWK QIP incentive policy has 3 evaluation processes. Every QIP member is categorized "
        "into three types: Type-1, Type-2, and Type-3. Depending on a member's type, the incentive calculation "
        "method is applied differently."
    )

    doc.add_heading("Type-1 Evaluation (Direct Assembly QIP)", level=2)
    doc.add_paragraph(
        "For Type-1 QIP team members, performance is evaluated based on up to 10 conditions across four categories:"
    )
    bullet(doc, "Attendance conditions (C1–C4): ", bold_prefix=None)
    bullet(doc, "Attendance Rate, Unapproved Absence, Actual Working Days, Minimum Working Days")
    bullet(doc, "AQL conditions (C5–C8): Personal AQL failure, personal consecutive failures, team/area consecutive failures, area reject rate")
    bullet(doc, "5PRS conditions (C9–C10): 5PRS pass rate, 5PRS inspection quantity")

    doc.add_paragraph(
        "IMPORTANT: The conditions that apply differ by position within Type-1. Not all 10 conditions apply to "
        "every position. However, 100% of applicable conditions must be met for an employee to receive any incentive. "
        "The monthly incentive amount is calculated based on each member's continuous performance months using a "
        "progressive incentive table."
    )

    doc.add_heading("Type-2 Evaluation (Indirect Assembly QIP)", level=2)
    doc.add_paragraph(
        "For Type-2 QIP team members, performance is evaluated based on attendance conditions only (C1–C4):"
    )
    bullet(doc, "Attendance Rate ≥ 88%")
    bullet(doc, "Unapproved Absence ≤ 2 days")
    bullet(doc, "Actual Working Days > 0")
    bullet(doc, "Minimum Working Days ≥ 12 days")
    doc.add_paragraph(
        "The monthly incentive amount is determined by the average incentive of corresponding Type-1 positions and "
        "position-based multipliers. For leadership positions (Group Leader and above), the amount is calculated as "
        "the TYPE-1 LINE LEADER receiving average multiplied by a position-specific multiplier."
    )

    doc.add_heading("Type-3 (New QIP Members)", level=2)
    doc.add_paragraph(
        "For Type-3 QIP team members (newly hired workers with less than 30 working days), no evaluation is conducted, "
        "and the incentive policy does not apply. After completing the probation period (approximately 3 months), "
        "Type-3 members are upgraded to Type-2."
    )

    doc.add_heading("Program 2 — 6-Month Performance-Based Incentive", level=2)
    doc.add_paragraph(
        "Program 2 is a supplementary incentive program for selected QIP Talent Pool members. "
        "The purpose is to build a foundation for the yearly growing HWK QIP Talent Pool as a future HWK Quality investment, "
        "and to empower QIP manpower to achieve critical HWK-quality KPIs."
    )
    doc.add_paragraph(
        "In the V10 system, Program 2 is implemented as a Talent Pool bonus that is automatically applied alongside "
        "regular (Program 1) incentive. See Section 6 for details."
    )

    doc.add_page_break()

    # ══════════════════════════════════════════
    # SECTION 3. SCOPE AND OBJECTS
    # ══════════════════════════════════════════
    doc.add_heading("SECTION 3. SCOPE AND OBJECTS", level=1)

    doc.add_paragraph(
        "This policy applies to all QIP team members. "
        "Except for QIP Type-3 employees, who are newly hired workers in the process of familiarizing themselves "
        "with and training in inspection skills, with less than 30 working days."
    )

    doc.add_heading("Classification of QIP Employees", level=2)

    bold_para(doc, "Type 1 — Direct-assembly QIP: ", "anyone who inspects the final product quality")
    bullet(doc, "Inspector in Assembly line (Assembly Inspector)")
    bullet(doc, "Inspector in Repacking line")
    bullet(doc, "Inspector in AQL (AQL Inspector)")
    bullet(doc, "Trainer who inspects the inspector (Audit & Training Team)")
    bullet(doc, "QIP Model Master team")
    bullet(doc, "RQC Assembly Inspector (position code A1B — C7 and C10 exemptions apply from February 2026)")
    bullet(doc, "Line Leader")

    bold_para(doc, "Type 2 — Indirect assembly QIP: ", "anyone who contributes to the final product quality")
    bullet(doc, "Material (MTL) QIP team")
    bullet(doc, "Cutting QIP team")
    bullet(doc, "OSC/Inhouse QIP team")
    bullet(doc, "Stitching QIP team")
    bullet(doc, "Bottom QIP team")
    bullet(doc, "Packing QIP team")
    bullet(doc, "QA team")
    bullet(doc, "QIP office team")
    bullet(doc, "OCPT team")
    bullet(doc, "All other members of the QIP team who are not in Type 1 and the Testing Department (LAB)")

    bold_para(doc, "Type 3 — New QIP: ", "Newly hired workers with less than 30 working days")
    bullet(doc, "No incentive evaluation or payment during probation period")
    bullet(doc, "Automatically upgraded to Type-2 after approximately 3 months")

    doc.add_heading("Evaluation Period & Payment Schedule", level=2)
    bullet(doc, "Evaluation period: From the first day of the month to the last day of the month.")
    bullet(doc, "Reward consideration period: From the 1st to the 15th of the following month.")
    bullet(doc, "For employees still working: Payment will be made in the next payroll cycle.")
    bullet(doc, "For employees who have left: Payment will be made within 14 working days from the departure date.")

    doc.add_page_break()

    # ══════════════════════════════════════════
    # SECTION 4. DEFINITIONS & ABBREVIATIONS
    # ══════════════════════════════════════════
    doc.add_heading("SECTION 4. DEFINITIONS & ABBREVIATIONS", level=1)

    tbl = doc.add_table(rows=1, cols=2)
    tbl.style = 'Table Grid'
    make_header_row(tbl, ["Term", "Definition"])

    terms = [
        ["QIP", "Quality Improvement Program — HWK's quality-focused employee incentive system"],
        ["5Q", "Five Quality targets — HWK's strategic quality performance goals"],
        ["AQL", "Acceptable Quality Level — international sampling inspection standard"],
        ["5PRS", "5 Pairs Random Sampling — internal quality inspection method checking 5 random pairs"],
        ["CFA", "Certified Final Auditor — adidas-approved AQL inspection certificate"],
        ["PO", "Production Order — individual manufacturing order unit"],
        ["C1–C10", "The 10 incentive conditions evaluated by the system"],
        ["TYPE-1", "Direct quality workers with full condition evaluation"],
        ["TYPE-2", "Indirect/management staff with attendance-only evaluation"],
        ["TYPE-3", "New employees (< 3 months) excluded from incentive"],
        ["Progressive Table", "Incentive amount schedule increasing with consecutive qualifying months (150K–1M VND)"],
        ["Consecutive Months", "Number of uninterrupted months where all applicable conditions were met"],
        ["Allowance", "Exception override — manager-approved condition bypass for justified cases"],
        ["Firestore", "Google Cloud NoSQL database used for V10 data storage"],
        ["RBAC", "Role-Based Access Control — admin vs regular user permission system"],
        ["SMTP", "Simple Mail Transfer Protocol — email delivery system (mail.hsvina.com)"],
    ]
    for t in terms:
        add_row(tbl, t)

    doc.add_page_break()

    # ══════════════════════════════════════════
    # SECTION 5. PROGRAM 1
    # ══════════════════════════════════════════
    doc.add_heading("SECTION 5. INCENTIVE AMOUNT CALCULATION METHOD — PROGRAM 1", level=1)

    # 5.1
    doc.add_heading("5.1 The 10 Incentive Conditions", level=2)
    doc.add_paragraph(
        "The V10 system evaluates up to 10 conditions for each QIP member. Not all conditions apply to every "
        "position — the applicable conditions are determined by the Position-Condition Matrix (see Section 5.2 "
        "and Appendix 2). However, ALL applicable conditions must be met (100% pass rate) for an employee to "
        "receive incentive."
    )

    tbl = doc.add_table(rows=1, cols=5)
    tbl.style = 'Table Grid'
    make_header_row(tbl, ["#", "Condition", "Category", "Default Threshold", "Description"])

    conditions = [
        ["C1", "Attendance Rate", "Attendance", "≥ 88%", "Attendance rate with approved-leave adjustment"],
        ["C2", "Unapproved Absence", "Attendance", "≤ 2 days", "AR1 unapproved absence days within limit"],
        ["C3", "Actual Working Days", "Attendance", "> 0 days", "At least 1 actual working day in the month"],
        ["C4", "Minimum Working Days", "Attendance", "≥ 12 days", "Only enforced after 20th of month (interim exempt)"],
        ["C5", "Personal AQL Failure", "AQL", "= 0 failures", "No personal AQL failures in current month"],
        ["C6", "Personal AQL Consecutive", "AQL", "No consecutive", "2025: 3+ months, 2026+: 2+ months consecutive"],
        ["C7", "Team/Area AQL Consecutive", "AQL", "No consecutive", "Same year-dependent threshold as C6"],
        ["C8", "Area Reject Rate", "AQL", "< 3.0%", "Reject rate for assigned area below threshold"],
        ["C9", "5PRS Pass Rate", "5PRS", "≥ 95%", "5PRS quality inspection pass rate"],
        ["C10", "5PRS Inspection Qty", "5PRS", "≥ 100 pairs", "Minimum 5PRS inspection quantity"],
    ]
    for c in conditions:
        add_row(tbl, c)

    doc.add_paragraph()
    bold_para(doc, "Note on Configurable Thresholds: ",
              "All thresholds above are system defaults. Administrators can adjust thresholds monthly via the Admin Panel. "
              "Seven thresholds are configurable: attendance_rate, unapproved_absence, minimum_working_days, area_reject_rate, "
              "5prs_pass_rate, 5prs_min_qty, and consecutive_aql_months. All changes are logged with immutable audit trail.")

    bold_para(doc, "Note on Consecutive Failure Policy: ",
              "From 2026 onwards, the consecutive failure threshold has been updated from 3 months to 2 months. "
              "This means that 2 or more months of consecutive AQL failures will result in incentive exclusion (C6, C7). "
              "For 2025, only 3 or more months of consecutive failures cause exclusion.")

    # 5.2
    doc.add_heading("5.2 Position-Condition Application Matrix (Type-1)", level=2)
    doc.add_paragraph(
        "Different positions within Type-1 have different applicable conditions. "
        "The following table summarizes which conditions apply to each position:"
    )

    tbl = doc.add_table(rows=1, cols=11)
    tbl.style = 'Table Grid'
    make_header_row(tbl, ["Position", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10"])

    matrix = [
        ["ASSEMBLY INSPECTOR", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "—", "—", "Yes", "Yes"],
        ["RQC ASSEMBLY INSPECTOR\n(A1B, from 2026.02)", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "—", "—", "Yes", "—"],
        ["AQL INSPECTOR", "Yes", "Yes", "Yes", "Yes", "Yes", "—", "—", "—", "—", "—"],
        ["LINE LEADER", "Yes", "Yes", "Yes", "Yes", "—", "—", "Yes", "—", "—", "—"],
        ["AUDITOR & TRAINER", "Yes", "Yes", "Yes", "Yes", "—", "—", "Yes", "Yes", "—", "—"],
        ["MODEL MASTER", "Yes", "Yes", "Yes", "Yes", "—", "—", "—", "Yes", "—", "—"],
        ["Management (Group Leader,\nSupervisor, Manager, etc.)", "Yes", "Yes", "Yes", "Yes", "—", "—", "—", "—", "—", "—"],
    ]
    for m in matrix:
        add_row(tbl, m)

    doc.add_paragraph()
    bold_para(doc, "RQC Assembly Inspector (A1B): ",
              "From February 2026, position code A1B is classified as RQC_ASSEMBLY_INSPECTOR. "
              "C7 (Team/Area AQL) and C10 (5PRS Inspection Qty) are exempted because RQC inspectors perform "
              "process checking and reports, not line inspection. Before February 2026, A1B is treated as regular Assembly Inspector.")

    doc.add_page_break()

    # 5.3
    doc.add_heading("5.3 Type-1 Progressive Incentive Table", level=2)
    doc.add_paragraph(
        "For Type-1 members who pass all applicable conditions, the incentive amount increases with continuous "
        "months of qualifying. The progressive table applies to Assembly Inspectors, Model Masters, and Audit & Training team members:"
    )

    # Horizontal table like V2
    tbl = doc.add_table(rows=2, cols=14)
    tbl.style = 'Table Grid'
    headers = ["Months", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12–15"]
    amounts = ["VND (×1,000)", "150", "250", "300", "350", "400", "450", "500", "650", "750", "850", "950", "1,000"]

    for i, text in enumerate(headers):
        cell = tbl.rows[0].cells[i]
        p = cell.paragraphs[0]
        run = p.add_run(text)
        run.bold = True
        run.font.size = Pt(8)
        run.font.color.rgb = RGBColor(255, 255, 255)
        set_cell_shading(cell, "2F5496")

    for i, text in enumerate(amounts):
        cell = tbl.rows[1].cells[i]
        p = cell.paragraphs[0]
        run = p.add_run(text)
        run.font.size = Pt(8)
        if i == 0:
            run.bold = True

    doc.add_paragraph()
    doc.add_paragraph("Key rules for the progressive table:")
    bullet(doc, "Maximum cap: 1,000,000 VND per month (reached at 12 continuous months)")
    bullet(doc, "Reset on failure: If an employee fails to meet conditions in any month, continuous months reset to 0")
    bullet(doc, "Carry over: Continuous months carry over from the previous month upon meeting conditions")
    bullet(doc, "Maximum tracking: 15 months (amounts remain at 1,000,000 VND from month 12 onwards)")

    # 5.4
    doc.add_heading("5.4 AQL Inspector — 3-Part Incentive Calculation", level=2)
    doc.add_paragraph(
        "AQL Inspectors receive a special 3-part incentive calculation. The final monthly amount is the sum of all three parts:"
    )

    bold_para(doc, "Part 1: AQL Inspection Evaluation Result")
    doc.add_paragraph(
        "Based on the progressive table (same as Section 5.3 above). Requires rejection rate by adidas/T1QM/3rd Party "
        "inspectors < 3%."
    )

    bold_para(doc, "Part 2: CFA Certificate Incentive")
    doc.add_paragraph(
        "AQL Inspectors with a valid adidas-approved AQL certificate receive a fixed monthly amount of 700,000 VND. "
        "This is paid every month as long as the certificate remains valid and the inspector meets all applicable conditions."
    )

    bold_para(doc, "Part 3: HWK Claim Prevention Incentive")
    doc.add_paragraph(
        "Considering the role of AQL inspectors as the final quality gatekeeper, an additional incentive for "
        "preventing HWK complaints is provided. This amount increases progressively starting from month 4:"
    )

    # Horizontal table like V2
    tbl = doc.add_table(rows=2, cols=6)
    tbl.style = 'Table Grid'
    headers2 = ["Months", "1–3", "4–6", "7–9", "10–12", "13–15"]
    amounts2 = ["VND (×1,000)", "0", "300", "500", "700", "900"]
    for i, text in enumerate(headers2):
        cell = tbl.rows[0].cells[i]
        p = cell.paragraphs[0]
        run = p.add_run(text)
        run.bold = True
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(255, 255, 255)
        set_cell_shading(cell, "2F5496")
    for i, text in enumerate(amounts2):
        cell = tbl.rows[1].cells[i]
        p = cell.paragraphs[0]
        run = p.add_run(text)
        run.font.size = Pt(9)
        if i == 0:
            run.bold = True

    doc.add_paragraph()
    doc.add_paragraph("Example: An AQL Inspector with CFA certificate at 12 continuous months:")
    bullet(doc, "Part 1 (Progressive): 1,000,000 VND")
    bullet(doc, "Part 2 (CFA Certificate): 700,000 VND")
    bullet(doc, "Part 3 (HWK Prevention): 700,000 VND")
    bullet(doc, "Total: 2,400,000 VND")

    doc.add_page_break()

    # 5.5
    doc.add_heading("5.5 Line Leader Incentive Calculation (Type-1)", level=2)
    doc.add_paragraph(
        "Line Leaders in Type-1 receive incentive calculated based on their subordinate team's performance:"
    )
    bold_para(doc, "Formula: ", "Subordinate Total Incentive × 12%")
    doc.add_paragraph(
        "The system uses a subordinate mapping to identify all team members under each Line Leader. "
        "Only subordinates who received incentive (> 0 VND) are counted in the total. "
        "Line Leaders must also pass all applicable conditions (C1, C2, C3, C4, C7) to receive the incentive."
    )
    doc.add_paragraph("Line Leader incentive exclusion cases:")
    bullet(doc, "If any inspector in the Line Leader's team has \"at least 1 case of AQL Fail\" continuously for "
           "more than the consecutive failure threshold without receiving quality incentive during that period, "
           "the responsible Line Leader will not receive monthly incentive.")

    # 5.6
    doc.add_heading("5.6 Type-2 Incentive Calculation", level=2)
    doc.add_paragraph(
        "Type-2 members must meet attendance conditions (C1–C4) at 100% pass rate. The incentive amount is "
        "determined based on the average incentive of corresponding Type-1 positions."
    )

    bold_para(doc, "TYPE-2 Position Mapping for Incentive Calculation:")

    tbl = doc.add_table(rows=1, cols=3)
    tbl.style = 'Table Grid'
    make_header_row(tbl, ["Type-2 Position", "Incentive Reference", "Description"])

    mappings = [
        ["BOTTOM INSPECTOR", "ASSEMBLY INSPECTOR average", "Uses Type-1 Assembly Inspector receiving average"],
        ["CUTTING INSPECTOR", "ASSEMBLY INSPECTOR average", "Uses Type-1 Assembly Inspector receiving average"],
        ["MTL INSPECTOR", "ASSEMBLY INSPECTOR average", "Uses Type-1 Assembly Inspector receiving average"],
        ["STITCHING INSPECTOR", "ASSEMBLY INSPECTOR average", "Uses Type-1 Assembly Inspector receiving average"],
        ["OSC INSPECTOR", "ASSEMBLY INSPECTOR average", "Uses Type-1 Assembly Inspector receiving average"],
        ["OCPT STAFF", "ASSEMBLY INSPECTOR average", "Uses Type-1 Assembly Inspector receiving average"],
        ["RQC", "ASSEMBLY INSPECTOR average", "Uses Type-1 Assembly Inspector receiving average"],
        ["AQL INSPECTOR (TYPE-2)", "ASSEMBLY INSPECTOR average", "Uses Type-1 Assembly Inspector receiving average"],
        ["QA TEAM (default)", "ASSEMBLY INSPECTOR average", "Uses Type-1 Assembly Inspector receiving average"],
        ["QA TEAM (code QA3A)", "GROUP LEADER average", "Special: mapped to Group Leader average"],
        ["QA TEAM (code QA3B)", "ASSEMBLY INSPECTOR average", "Uses Type-1 Assembly Inspector receiving average"],
        ["LINE LEADER (TYPE-2)", "LINE LEADER average", "Uses Type-1 Line Leader receiving average"],
    ]
    for m in mappings:
        add_row(tbl, m)

    # 5.7
    doc.add_heading("5.7 Type-2 Leadership Position Multipliers", level=2)
    doc.add_paragraph(
        "For mid-to-leadership management positions in Type-2, the incentive is calculated as the TYPE-1 LINE LEADER "
        "receiving average multiplied by a position-specific multiplier:"
    )

    tbl = doc.add_table(rows=1, cols=4)
    tbl.style = 'Table Grid'
    make_header_row(tbl, ["Position", "Multiplier", "Formula", "Description"])

    multipliers = [
        ["GROUP LEADER", "2.0×", "LL Avg × 2.0", "Line Leader receiving average × 2.0"],
        ["SUPERVISOR /\n(V) SUPERVISOR /\nA.SUPERVISOR", "2.5×", "LL Avg × 2.5", "Line Leader receiving average × 2.5"],
        ["A.MANAGER", "3.0×", "LL Avg × 3.0", "Line Leader receiving average × 3.0"],
        ["MANAGER", "3.5×", "LL Avg × 3.5", "Line Leader receiving average × 3.5"],
        ["S.MANAGER", "4.0×", "LL Avg × 4.0", "Line Leader receiving average × 4.0"],
    ]
    for m in multipliers:
        add_row(tbl, m)

    doc.add_paragraph()
    doc.add_paragraph("Example calculation:")
    bullet(doc, "If TYPE-1 Line Leaders receiving incentive average is 400,000 VND:")
    bullet(doc, "Group Leader (Type-2) = 400,000 × 2.0 = 800,000 VND")
    bullet(doc, "(V) Supervisor (Type-2) = 400,000 × 2.5 = 1,000,000 VND")
    bullet(doc, "A.Manager (Type-2) = 400,000 × 3.0 = 1,200,000 VND")
    bullet(doc, "Manager (Type-2) = 400,000 × 3.5 = 1,400,000 VND")
    bullet(doc, "S.Manager (Type-2) = 400,000 × 4.0 = 1,600,000 VND")

    bold_para(doc, "Note: ",
              "\"LINE LEADER receiving average\" means the average of Type-1 Line Leader incentives for recipients only "
              "(employees with incentive > 0 VND). Employees with 0 VND are excluded from the average calculation.")

    # 5.8
    doc.add_heading("5.8 Audit & Training Team (Trainer) Incentive", level=2)
    doc.add_paragraph(
        "Each training staff member has their own area of responsibility for employee inspection and training."
    )
    bullet(doc, "If the error rate (Area Reject Rate, C8) in the area they are responsible for is below threshold: Meets the requirements.")
    bullet(doc, "If the error rate is above threshold: Does not meet the requirements.")
    bullet(doc, "Applicable conditions: C1, C2, C3, C4, C7 (Team/Area AQL Consecutive), C8 (Area Reject Rate)")
    doc.add_paragraph(
        "Each Auditor/Trainer is assigned to specific building areas (A, B, C, D, or Repacking). "
        "The area mapping is maintained in the system configuration. "
        "The progressive table (Section 5.3) applies for incentive amount calculation."
    )

    # 5.9
    doc.add_heading("5.9 Model Master Team Incentive", level=2)
    doc.add_paragraph(
        "The Model Master team's incentive is based on the HWK AQL rejection percentage across all factories."
    )
    bullet(doc, "If the official HWK AQL rejection percentage across all factories (Area Reject Rate, C8) is below threshold: eligible.")
    bullet(doc, "Applicable conditions: C1, C2, C3, C4, C8 (Area Reject Rate)")
    doc.add_paragraph("The progressive table (Section 5.3) applies for incentive amount calculation.")

    doc.add_page_break()

    # ══════════════════════════════════════════
    # SECTION 6. PROGRAM 2
    # ══════════════════════════════════════════
    doc.add_heading("SECTION 6. INCENTIVE AMOUNT CALCULATION METHOD — PROGRAM 2", level=1)

    doc.add_paragraph(
        'Program 2 is the "6-Month-Performance-Based-Incentive Program." Only selected QIP team members are '
        "evaluated through a comprehensive process spanning six months. The evaluation method or focus may vary "
        "every six months based on the quality team's targets and HWK quality status."
    )

    bold_para(doc, "IMPORTANT: ", "Anyone who receives incentive based on Program 1 can also receive incentive based on Program 2.")

    doc.add_paragraph()
    doc.add_paragraph(
        "The following 6-step process is used for Program 2 management. "
        "In the V10 system, the Talent Pool bonus is implemented as an automatic supplementary incentive "
        "managed through the system configuration."
    )

    steps = [
        ("Step 1: Target Set-Up", "Every January and July, the QIP team reviews the previous six months of quality performance "
         "and plans for the next six months. QIP managers and leadership team select critical quality topics, define measurable KPIs, "
         "or initiate a quality project operation plan."),
        ("Step 2: Task Assignment", "The QIP managers and leadership team select the \"right person\" for each target, regardless of position. "
         "The incentive amount and payment period are defined. Approval is obtained from the COO."),
        ("Step 3: Monthly Monitoring & Feedback", "The QIP QA team, office team, and managers conduct monthly reviews using measurable KPIs "
         "and provide feedback to all candidate members of the HWK QIP Talent Pool."),
        ("Step 4: Final Evaluation", "After six months, QIP managers review the plan and performance outcomes, making a final decision on "
         "who will receive certification for the HWK QIP Talent Pool."),
        ("Step 5: Confirmation of Talent Pool Membership", "The QIP manager requests approval from HWK HR team and HWK COO via the HS "
         "groupware system. Once approved, the updated talent pool information is integrated into the system configuration."),
        ("Step 6: Developing the HWK QIP Talent Pool", "The process is continuous with a new cycle every 6 months. "
         "The goal is to certify at least 3–5% of total QIP team members as talented individuals over time. "
         "Certification remains valid for 12 months."),
    ]
    for title, desc in steps:
        bold_para(doc, title)
        doc.add_paragraph(desc)

    doc.add_paragraph()
    bold_para(doc, "V10 System Implementation:")
    bullet(doc, "Auto-apply: Talent Pool bonus is automatically applied alongside regular incentive")
    bullet(doc, "Stackable: Talent Pool bonus stacks with regular (Program 1) incentive")
    bullet(doc, "Payment timing: Together with regular monthly incentive cycle")
    bullet(doc, "Conditions requirement: No — Talent Pool members receive bonus regardless of condition pass/fail")
    bullet(doc, "Exclusion: Resigned employees are automatically excluded")

    doc.add_page_break()

    # ══════════════════════════════════════════
    # SECTION 7. EXCEPTIONAL CLAUSES
    # ══════════════════════════════════════════
    doc.add_heading("SECTION 7. SUMMARY OF EXCEPTIONAL CLAUSES", level=1)

    doc.add_heading("7.1 Conditions for NOT Receiving Incentive", level=2)

    bold_para(doc, "For Type-1 (Program 1):")
    bullet(doc, "If any applicable condition among the 10 conditions is not met (100% pass required), monthly incentive is not provided.")
    bullet(doc, "If attendance rate < threshold, if unapproved absence > threshold, if actual working days = 0, or if minimum working days < threshold.")
    bullet(doc, "If 5PRS pass rate < threshold (for positions where C9 applies), monthly incentive is not provided.")
    bullet(doc, "If 5PRS inspection quantity < threshold (for positions where C10 applies), monthly incentive is not provided.")
    bullet(doc, "If there is an adidas official claim and the responsibility belongs to the individual, monthly incentive is not provided.")
    bullet(doc, "If the number of personal AQL PO reject is more than 0 (for positions where C5 applies), monthly incentive is not provided.")
    bullet(doc, "For Line Leaders: If any inspector in the team has consecutive AQL failures exceeding the threshold, the Line Leader will not receive monthly incentive.")
    bullet(doc, "For Trainers: If the assigned building's official monthly AQL reject rate exceeds the area reject threshold, monthly incentive is not provided.")
    bullet(doc, "For Trainers: If any inspector in the trainer's responsible building has consecutive AQL failures exceeding the threshold, the trainer will not receive monthly incentive.")

    bold_para(doc, "For Type-2 (Program 1):")
    bullet(doc, "If attendance conditions (C1–C4) are not all met at 100%, monthly incentive is not provided.")
    bullet(doc, "If there is an adidas official claim or critical internal complaint and the responsibility belongs to the individual, monthly incentive is not provided.")

    bold_para(doc, "For Type-3 (Program 1):")
    bullet(doc, "For ALL QIP members of Type-3, monthly incentive is not provided (policy exclusion).")

    bold_para(doc, "For Program 2:")
    bullet(doc, "If the QIP manager's suggested targets, person in charge, incentive amount, and provision period are rejected by COO during the 6-month renewal, all Program 2 processes are not effective.")

    doc.add_heading("7.2 Exceptional Cases for RECEIVING Incentive (Manager Override / Allowance)", level=2)

    doc.add_paragraph(
        "The V10 system includes an Allowance/Exception Override system accessible through the Admin Dashboard. "
        "This allows authorized managers to grant exceptions in the following cases:"
    )

    bullet(doc, "Due to limited annual leave days or unexpected urgent personal issues, if anyone cannot meet the attendance "
           "prerequisite, QIP managers can review and validate the case as \"exceptional.\" Without counting the exceptional "
           "case into absent days, if the employee can meet the attendance rule, monthly incentive is provided.")
    bullet(doc, "If an AQL reject PO case is related to \"not inspector's poor performance\" but \"production team's poor quality "
           "ownership issue\" (such as intended wrong packing finding from AQL room), the AQL reject PO will not count for the "
           "related Inspector's monthly AQL performance validation.")
    bullet(doc, "If 5PRS validation result is under threshold and total validation quantity does not meet expectation, QIP manager "
           "can review case by case and make an exceptional allowance if the root cause is reasonable (such as working area rotation, R&R update, etc.).")
    bullet(doc, "Case by case, exceptional cases can be allowed by QIP manager to provide incentive to a right-performance-made "
           "member, consistent with the concept of providing incentive for QIP team motivation and fostering quality culture.")

    bold_para(doc, "V10 System Allowance Implementation:")
    doc.add_paragraph("The system provides 4 reason codes for documenting allowance overrides:")
    tbl = doc.add_table(rows=1, cols=2)
    tbl.style = 'Table Grid'
    make_header_row(tbl, ["Reason Code", "Description"])
    codes = [
        ["MEDICAL", "Medical reason (illness, injury, hospitalization)"],
        ["COMPANY_ORDER", "Company order (reassignment, mandatory tasks)"],
        ["NATURAL_DISASTER", "Natural disaster (flooding, typhoon, etc.)"],
        ["OTHER", "Other documented reason (free text justification required)"],
    ]
    for c in codes:
        add_row(tbl, c)

    doc.add_paragraph()
    doc.add_paragraph("Allowance workflow in the system:")
    bullet(doc, "1. Administrator searches for the employee in the Allowance tab")
    bullet(doc, "2. System displays current condition status (pass/fail for each applicable condition)")
    bullet(doc, "3. Administrator selects failed conditions to override")
    bullet(doc, "4. Administrator provides reason code + detailed justification (required)")
    bullet(doc, "5. Preview screen shows the override impact before applying")
    bullet(doc, "6. On Apply: system updates employee data, recalculates incentive amount, updates dashboard summary")
    bullet(doc, "7. Allowance can be revoked later (restores original condition status)")
    bullet(doc, "8. Bulk recalculation available for all allowance employees with 0 incentive")

    doc.add_paragraph()
    doc.add_paragraph(
        "All allowance overrides are tracked with audit trails including: override date, authorized manager (email), "
        "affected employee, original condition status, overridden conditions, override reason code, reason detail, "
        "and recalculated incentive amount."
    )

    doc.add_page_break()

    # ══════════════════════════════════════════
    # SECTION 8. SYSTEM ARCHITECTURE
    # ══════════════════════════════════════════
    doc.add_heading("SECTION 8. SYSTEM ARCHITECTURE & DASHBOARD (V10)", level=1)

    doc.add_paragraph(
        "The HWK QIP Incentive System V10 is a cloud-based platform that automates the entire incentive calculation "
        "pipeline, from data collection to final payment determination. All employee data is loaded securely from "
        "Firestore after authentication, replacing the previous approach of embedding data directly in HTML files."
    )

    doc.add_heading("8.1 Data Flow & CI/CD Pipeline", level=2)
    doc.add_paragraph("The system follows this automated data flow (runs every 6 hours + manual trigger):")
    bullet(doc, "Google Drive: Source data files (basic manpower, attendance, AQL reports, 5PRS data) are uploaded to Google Drive.")
    bullet(doc, "GitHub Actions: Automated CI/CD pipeline downloads data from Google Drive, syncs thresholds and configs from Firestore.")
    bullet(doc, "Auto-Detection: System automatically detects stale months requiring recalculation.")
    bullet(doc, "Attendance Conversion: Raw attendance data is converted and schema-validated.")
    bullet(doc, "Python Calculation Engine: Processes all 10 conditions for each employee and calculates incentive amounts.")
    bullet(doc, "Firestore Upload: Calculated results are uploaded to Google Cloud Firestore database.")
    bullet(doc, "Email Processing: Pending email notifications are sent via SMTP (mail.hsvina.com).")
    bullet(doc, "Deployment: Dashboard is deployed to GitHub Pages.")

    doc.add_heading("8.2 Dashboard Features (8 Tabs)", level=2)
    bullet(doc, "Summary Tab: ", bold_prefix=None)
    doc.add_paragraph("   KPI cards (recipients count, payment rate, total amount with trend indicators), TYPE distribution table, "
                      "condition pass/fail charts, trend chart, talent pool display.")
    bullet(doc, "Position Detail Tab: Position-specific breakdown tables with condition status.")
    bullet(doc, "Individual Detail Tab: Per-employee searchable/filterable list with detailed condition modal (250ms debounce).")
    bullet(doc, "Incentive Criteria Tab: Current threshold reference and condition descriptions.")
    bullet(doc, "Organization Chart Tab: QIP team hierarchical structure with expected incentive calculations.")
    bullet(doc, "Team Management Tab: Team-level analytics and performance comparison.")
    bullet(doc, "Validation Summary Tab: 12 KPI validation cards, data integrity checks, system verification.")
    bullet(doc, "Attendance Lookup Tab: Individual attendance calendar with daily status lookup.")

    doc.add_heading("8.3 Admin Panel (5 Tabs)", level=2)
    doc.add_paragraph("The Admin Panel is accessible to administrators only (role-based access control):")
    bullet(doc, "Thresholds: Adjust 7 configurable thresholds per month with change history and audit trail.")
    bullet(doc, "Config Management: Position mapping, progressive table configuration, type classification rules.")
    bullet(doc, "System: Pipeline status monitoring, system configuration, admin email list management.")
    bullet(doc, "Data Lookup: Direct Firestore data querying and verification.")
    bullet(doc, "Allowances: Exception override management with apply/revoke workflow and bulk recalculation.")

    doc.add_heading("8.4 Threshold Management", level=2)
    doc.add_paragraph(
        "All threshold values are centrally managed in Firestore and can be adjusted by administrators through the Admin Dashboard. "
        "Every change creates an immutable record in the threshold_history collection including: changed fields, old values, "
        "new values, changed by (email), and timestamp. The Python calculation engine syncs these values before each run."
    )

    tbl = doc.add_table(rows=1, cols=3)
    tbl.style = 'Table Grid'
    make_header_row(tbl, ["Parameter", "System Default", "Configurable"])

    params = [
        ["Attendance Rate (C1)", "88%", "Yes"],
        ["Unapproved Absence (C2)", "2 days", "Yes"],
        ["Minimum Working Days (C4)", "12 days", "Yes"],
        ["Area Reject Rate (C8)", "3.0%", "Yes"],
        ["5PRS Pass Rate (C9)", "95%", "Yes"],
        ["5PRS Min Quantity (C10)", "100 pairs", "Yes"],
        ["Consecutive AQL Months (C6, C7)", "3 months", "Yes"],
    ]
    for p_row in params:
        add_row(tbl, p_row)

    doc.add_heading("8.5 Feedback System", level=2)
    doc.add_paragraph(
        "The system includes a built-in feedback/issue tracking system accessible to all authenticated users:"
    )
    bullet(doc, "Feedback Types: BUG, IMPROVEMENT, NEW_FEATURE, UI_UX, DATA, OTHER")
    bullet(doc, "Priorities: Critical, High, Medium, Low")
    bullet(doc, "Status Flow: SUBMITTED → REVIEWING → IN_PROGRESS → COMPLETED (or REJECTED)")
    bullet(doc, "Features: Image attachments (up to 3), multiple notification recipients, admin reply with email notification")

    doc.add_heading("8.6 Email Notification System", level=2)
    doc.add_paragraph("Three automated email notifications via Cloud Functions (Node.js 22, asia-northeast3):")
    bullet(doc, "New feedback submitted → All administrators receive email notification (3-language: ko/en/vi)")
    bullet(doc, "Feedback status changed → Feedback reporter receives status update notification")
    bullet(doc, "Admin replies to feedback → Feedback reporter receives reply email")
    doc.add_paragraph("SMTP server: mail.hsvina.com:465 (SSL). All emails logged to email_logs collection for audit.")

    doc.add_heading("8.7 Multi-Language Support", level=2)
    doc.add_paragraph("The entire dashboard supports three languages: Korean (ko), English (en), and Vietnamese (vi). "
                      "All UI strings, error messages, and labels are managed through the i18n system.")

    doc.add_heading("8.8 Authentication & RBAC", level=2)
    doc.add_paragraph("Firebase Email/Password authentication with Role-Based Access Control:")
    bullet(doc, "Regular users: Read-only dashboard access + feedback submission")
    bullet(doc, "Administrators: Full access including admin panel, threshold management, allowance overrides, feedback management")
    doc.add_paragraph("Admin email list is dynamically managed in Firestore (system/config.admin_emails).")

    doc.add_page_break()

    # ══════════════════════════════════════════
    # APPENDIX 1
    # ══════════════════════════════════════════
    doc.add_heading("APPENDIX 1: 10 INCENTIVE CONDITIONS — DETAILED DESCRIPTION", level=1)

    appendix_conditions = [
        ("C1 — Attendance Rate",
         "The employee's monthly attendance rate must meet the configured threshold (default ≥ 88%). "
         "Calculated as: (Actual Working Days) / (Total Working Days − Approved Leave Days) × 100%. "
         "Approved leave types are not counted as absences. Business trips (Di cong tac) count as actual working days."),
        ("C2 — Unapproved Absence",
         "The number of AR1 (unapproved) absence days must be within the configured limit (default ≤ 2 days per month). "
         "Special exceptions may be approved by QIP manager via the Allowance system."),
        ("C3 — Actual Working Days",
         "The employee must have at least 1 actual working day in the month. "
         "This excludes employees who were entirely absent or on extended leave."),
        ("C4 — Minimum Working Days",
         "The employee must work at least the configured minimum days (default 12) in the month to be eligible. "
         "IMPORTANT: This condition is only enforced after the 20th of the current month. Interim reports (before 20th) "
         "automatically exempt this condition to avoid penalizing employees mid-month."),
        ("C5 — Personal AQL Failure",
         "For AQL-related positions: the employee must have 0 personal AQL failure cases in the current month. "
         "Any single AQL failure disqualifies the employee from incentive. Exception possible via Allowance system."),
        ("C6 — Personal AQL Consecutive Failures",
         "No consecutive month personal AQL failures. Year-dependent threshold: "
         "2025: only 3+ months consecutive = disqualified. 2026 onwards: 2+ months consecutive = disqualified. "
         "The system automatically applies the correct threshold based on the evaluation year."),
        ("C7 — Team/Area AQL Consecutive Failures",
         "No consecutive month team or area AQL failures. Same year-dependent threshold as C6. "
         "Applies to: Line Leaders, Audit & Training Team. "
         "RQC Assembly Inspector (A1B) is exempt from this condition from February 2026."),
        ("C8 — Area Reject Rate",
         "The reject rate in the employee's responsible area must be below the configured threshold (default < 3.0%). "
         "Applies to: Model Master (all factories) and Audit & Training Team (assigned building areas). "
         "Each Auditor/Trainer has specific building assignments maintained in the system configuration."),
        ("C9 — 5PRS Pass Rate",
         "The 5PRS (5 Pairs Random Sampling) pass rate must meet the configured threshold (default ≥ 95%). "
         "Applies to: Assembly Inspector positions (including RQC Assembly Inspector A1B)."),
        ("C10 — 5PRS Inspection Quantity",
         "The total 5PRS inspection quantity must meet the configured minimum (default ≥ 100 pairs per month). "
         "Applies to: Assembly Inspector positions. "
         "RQC Assembly Inspector (A1B) is EXEMPT from this condition from February 2026, because RQC inspectors "
         "perform process checking and reports, not line inspection."),
    ]

    for title, desc in appendix_conditions:
        bold_para(doc, title)
        doc.add_paragraph(desc)
        doc.add_paragraph()

    doc.add_page_break()

    # ══════════════════════════════════════════
    # APPENDIX 2
    # ══════════════════════════════════════════
    doc.add_heading("APPENDIX 2: POSITION-CONDITION APPLICATION MATRIX", level=1)

    doc.add_paragraph(
        "This appendix provides the complete position-condition matrix used by the V10 calculation engine. "
        "All positions are configured through JSON configuration files, ensuring consistency across the Python "
        "calculation engine, web dashboard, and validation system."
    )

    doc.add_heading("Type-1 Positions", level=2)
    doc.add_paragraph('Each Type-1 position has a specific set of applicable conditions. "Yes" means the condition must be passed; "—" means not applicable.')

    tbl = doc.add_table(rows=1, cols=11)
    tbl.style = 'Table Grid'
    make_header_row(tbl, ["Position", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10"])

    full_matrix = [
        ["ASSEMBLY INSPECTOR", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "—", "—", "Yes", "Yes"],
        ["RQC ASSEMBLY INSPECTOR\n(A1B, from 2026.02)", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "—", "—", "Yes", "—"],
        ["AQL INSPECTOR", "Yes", "Yes", "Yes", "Yes", "Yes", "—", "—", "—", "—", "—"],
        ["LINE LEADER", "Yes", "Yes", "Yes", "Yes", "—", "—", "Yes", "—", "—", "—"],
        ["AUDITOR & TRAINER", "Yes", "Yes", "Yes", "Yes", "—", "—", "Yes", "Yes", "—", "—"],
        ["MODEL MASTER", "Yes", "Yes", "Yes", "Yes", "—", "—", "—", "Yes", "—", "—"],
        ["Management\n(GL, Supervisor, Manager)", "Yes", "Yes", "Yes", "Yes", "—", "—", "—", "—", "—", "—"],
    ]
    for m in full_matrix:
        add_row(tbl, m)

    doc.add_heading("Type-2 Positions", level=2)
    doc.add_paragraph(
        "All Type-2 positions apply only attendance conditions (C1–C4). The incentive amount is calculated based on "
        "the average of their corresponding Type-1 position reference, as described in Section 5.6 and 5.7."
    )
    doc.add_paragraph(
        "Type-2 positions include: Line Leader, Assembly Inspector, AQL Inspector, Stitching Inspector, "
        "Bottom Inspector, Cutting Inspector, MTL Inspector, OSC Inspector, OCPT Staff, QA Team, RQC"
    )

    doc.add_heading("Type-3 Positions", level=2)
    doc.add_paragraph(
        "Type-3 (New QIP Member) positions have no applicable conditions and are excluded from incentive payment. "
        "They automatically transition to Type-2 after approximately 3 months."
    )

    doc.add_page_break()

    # ══════════════════════════════════════════
    # APPENDIX 3
    # ══════════════════════════════════════════
    doc.add_heading("APPENDIX 3: HWK QIP TALENT POOL STATUS", level=1)

    doc.add_paragraph(
        "The HWK QIP Talent Pool is managed through the V10 system via the system configuration. "
        "Talent Pool members receive additional monthly incentive independent of their regular Type-1/Type-2 incentive."
    )

    doc.add_paragraph("Current Talent Pool Configuration:")
    bullet(doc, "Auto-apply: Yes — Talent Pool bonus is automatically applied alongside regular incentive.")
    bullet(doc, "Stackable: Yes — Talent Pool bonus stacks with regular incentive.")
    bullet(doc, "Payment timing: With regular incentive cycle.")
    bullet(doc, "Conditions requirement: No — Talent Pool members receive bonus regardless of condition pass/fail.")
    bullet(doc, "Exclusion: Resigned employees are automatically excluded; active status required.")

    doc.add_paragraph()
    doc.add_paragraph(
        "Note: The specific members, amounts, and validity periods are managed by QIP managers and approved by "
        "HWK COO through the standard approval process described in Section 6."
    )

    doc.add_page_break()

    # ══════════════════════════════════════════
    # APPENDIX 4
    # ══════════════════════════════════════════
    doc.add_heading("APPENDIX 4: QIP TEAM R&R MAP", level=1)
    doc.add_paragraph(
        "Please refer to the separate QIP Team R&R Map document for the complete 69-job list mapping of all "
        "QIP team member roles and responsibilities."
    )

    # ══════════════════════════════════════════
    # APPENDIX 5 (NEW)
    # ══════════════════════════════════════════
    doc.add_heading("APPENDIX 5: FIRESTORE DATA COLLECTIONS", level=1)
    doc.add_paragraph("The V10 system uses the following Firestore collections:")

    tbl = doc.add_table(rows=1, cols=3)
    tbl.style = 'Table Grid'
    make_header_row(tbl, ["Collection", "Purpose", "Access"])

    collections = [
        ["employees/{monthYear}/all_data/data", "Employee + incentive data", "Auth: read, Admin: write"],
        ["dashboard_summary/{monthYear}", "KPI summary statistics", "Auth: read, Admin: write"],
        ["thresholds/{monthYear}", "7 configurable thresholds", "Auth: read, Admin: write"],
        ["threshold_history/{autoId}", "Immutable audit trail", "Auth: read, Admin: create"],
        ["allowances/{monthYear}/items/{docId}", "Exception overrides", "Auth: read, Admin: write"],
        ["system/config", "System settings", "Auth: read, Admins: write"],
        ["configs/{document}", "Position mapping, config", "Auth: read, Admin: write"],
        ["system_feedback/{autoId}", "Feedback / issue tracking", "Auth: read/create, Admin: full"],
        ["pendingNotifications/{autoId}", "Email notification queue", "Auth: create, Admin: read"],
        ["config/email", "SMTP credentials", "Admin only"],
        ["email_logs/{autoId}", "Email delivery audit", "Admin only"],
    ]
    for c in collections:
        add_row(tbl, c)

    # ── Footer ──
    doc.add_paragraph()
    doc.add_paragraph()
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("— The End —")
    run.font.size = Pt(11)
    run.font.color.rgb = RGBColor(128, 128, 128)
    run.italic = True

    return doc


if __name__ == "__main__":
    doc = create_policy()
    output_path = os.path.expanduser(
        "~/Downloads/2025 QIP INCENTIVE POLICY Version3_Mar2026-Feb2027_En.docx"
    )
    doc.save(output_path)
    print(f"Policy document saved to: {output_path}")
    print(f"File size: {os.path.getsize(output_path):,} bytes")
