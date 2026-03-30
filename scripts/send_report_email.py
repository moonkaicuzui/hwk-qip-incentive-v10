#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
QIP Incentive 주간 이메일 리포트 발송 스크립트

Firestore에서 계산 결과를 읽어 액션 지향 이메일 리포트를 생성/발송합니다.

Usage:
    # Dry-run (HTML 파일로 저장)
    python scripts/send_report_email.py --month february --year 2026 --dry-run

    # 테스트 발송 (특정 이메일)
    python scripts/send_report_email.py --month february --year 2026 --test-email ksmoon@hsvina.com

    # 실제 발송 (Firestore 수신자 목록)
    python scripts/send_report_email.py --month february --year 2026

Authentication:
    - FIREBASE_SERVICE_ACCOUNT: Firestore 접근용 (환경변수 또는 로컬 파일)
    - SMTP_USER / SMTP_PASSWORD: 이메일 발송용 (환경변수 또는 Firestore system/config)
"""

import os
import sys
import json
import argparse
import hashlib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone

# Add project root to path for utils import
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from scripts.utils.firebase_common import init_firestore

# Add parent dir to path for email_template import
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from email_template import generate_email_html

# Default SMTP settings (overridden by Firestore system/config)
DEFAULT_SMTP = {
    "host": "mail.hsvina.com",
    "port": 465,
    "from_name": "QIP Incentive Dashboard",
    "from_email": "ksmoon@hsvina.com",
}


# ---------------------------------------------------------------------------
# Firestore data loading
# ---------------------------------------------------------------------------

def load_firestore_data(db, month, year):
    """Firestore에서 이메일 리포트에 필요한 모든 데이터 로드

    Returns:
        dict: {summary, employees, thresholds, config}
    """
    month_year = f"{month}_{year}"
    print(f"\n  Firestore 데이터 로드: {month_year}")

    # 1. Dashboard summary
    summary_ref = db.collection("dashboard_summary").document(month_year)
    summary_doc = summary_ref.get()
    if not summary_doc.exists:
        print(f"  dashboard_summary/{month_year} 없음")
        sys.exit(1)
    summary = summary_doc.to_dict()
    print(f"    dashboard_summary: {summary.get('total_employees', 0)}명, "
          f"{summary.get('receiving_employees', 0)}명 수령")

    # 2. Employee data
    emp_ref = (db.collection("employees").document(month_year)
               .collection("all_data").document("data"))
    emp_doc = emp_ref.get()
    if not emp_doc.exists:
        print(f"  employees/{month_year}/all_data/data 없음")
        sys.exit(1)
    emp_data = emp_doc.to_dict()
    employees = emp_data.get("employees", [])
    print(f"    employees: {len(employees)}명 로드")

    # 3. Thresholds
    th_ref = db.collection("thresholds").document(month_year)
    th_doc = th_ref.get()
    thresholds = th_doc.to_dict() if th_doc.exists else {}
    if not thresholds:
        # Fallback: latest thresholds
        th_ref2 = db.collection("thresholds").document("latest")
        th_doc2 = th_ref2.get()
        thresholds = th_doc2.to_dict() if th_doc2.exists else {}
    print(f"    thresholds: {list(thresholds.keys()) if thresholds else '(기본값 사용)'}")

    # 4. System config (email settings + recipients)
    config_ref = db.collection("system").document("config")
    config_doc = config_ref.get()
    config = config_doc.to_dict() if config_doc.exists else {}
    print(f"    system/config: {list(config.keys()) if config else '(없음)'}")

    return {
        "summary": summary,
        "employees": employees,
        "thresholds": thresholds,
        "config": config,
    }


# ---------------------------------------------------------------------------
# Action report builder (핵심 비즈니스 로직)
# ---------------------------------------------------------------------------

PREV_MONTH_MAP = {
    "january": "december", "february": "january", "march": "february",
    "april": "march", "may": "april", "june": "may",
    "july": "june", "august": "july", "september": "august",
    "october": "september", "november": "october", "december": "november",
}

MONTH_KO = {
    "january": "1월", "february": "2월", "march": "3월", "april": "4월",
    "may": "5월", "june": "6월", "july": "7월", "august": "8월",
    "september": "9월", "october": "10월", "november": "11월", "december": "12월"
}


def load_previous_month(db, month, year):
    """전월 데이터 로드 (비교용)

    Returns:
        dict: {summary, condition_stats, building_breakdown} or empty dict
    """
    prev_month = PREV_MONTH_MAP.get(month, "")
    prev_year = year - 1 if month == "january" else year
    if not prev_month:
        return {}

    month_year = f"{prev_month}_{prev_year}"
    print(f"  전월 데이터 로드: {month_year}")

    summary_ref = db.collection("dashboard_summary").document(month_year)
    summary_doc = summary_ref.get()
    if not summary_doc.exists:
        print(f"    전월 dashboard_summary 없음")
        return {}

    summary = summary_doc.to_dict()
    print(f"    전월: {summary.get('total_employees', 0)}명, "
          f"{summary.get('receiving_employees', 0)}명 수령")

    months = ["january","february","march","april","may","june",
              "july","august","september","october","november","december"]
    prev_month_idx = months.index(prev_month) + 1 if prev_month in months else None

    return {
        "summary": summary,
        "condition_stats": summary.get("condition_stats", {}),
        "building_breakdown": summary.get("building_breakdown", {}),
        "month_ko": MONTH_KO.get(prev_month, prev_month),
        "month_idx": prev_month_idx,
    }


def build_action_report(firestore_data):
    """Firestore 데이터에서 액션 리포트 데이터 구조 생성

    핵심: 각 문제 직원에 대해 담당자(LINE LEADER) → 상사(GL/SV) 체인 구성

    Args:
        firestore_data: load_firestore_data() 결과

    Returns:
        dict: email_template.generate_email_html()에 전달할 데이터
    """
    employees = firestore_data["employees"]
    summary = firestore_data["summary"]
    thresholds = firestore_data["thresholds"]

    # Employee map for boss chain lookup (Issue #28: str() 변환 필수)
    emp_map = {}
    for e in employees:
        emp_no = str(e.get("emp_no", "")).strip()
        if emp_no:
            emp_map[emp_no] = e

    # --- Threshold defaults ---
    att_rate_th = float(thresholds.get("attendance_rate", 88))
    absence_th = float(thresholds.get("unapproved_absence", 2))
    prs_rate_th = float(thresholds.get("5prs_pass_rate", 95))
    prs_qty_th = float(thresholds.get("5prs_min_qty", 100))

    # --- Building별 품질 집계 (TYPE별 그룹 포함) ---
    building_quality = {}
    building_quality_by_type = {}  # TYPE → Building → stats
    for emp in employees:
        bldg = str(emp.get("building", "")).strip()
        if not bldg:
            bldg = "Unknown"
        emp_type = str(emp.get("type", "")).strip() or "Unknown"

        # Flat building_quality (backward compat)
        if bldg not in building_quality:
            building_quality[bldg] = {
                "count": 0, "tests": 0, "fail_count": 0,
                "reject_rate": 0, "receiving": 0, "fail_employees": [],
            }

        # TYPE-grouped building_quality
        if emp_type not in building_quality_by_type:
            building_quality_by_type[emp_type] = {}
        if bldg not in building_quality_by_type[emp_type]:
            building_quality_by_type[emp_type][bldg] = {
                "count": 0, "tests": 0, "fail_count": 0,
                "reject_rate": 0, "receiving": 0, "fail_employees": [],
            }

        bq = building_quality[bldg]
        bq_typed = building_quality_by_type[emp_type][bldg]

        bq["count"] += 1
        bq_typed["count"] += 1

        # AQL data
        aql = emp.get("aql", {})
        tests = int(aql.get("total_tests", 0) or 0)
        failures = int(aql.get("failures", 0) or 0)
        bq["tests"] += tests
        bq_typed["tests"] += tests

        if emp.get("current_incentive", 0) > 0:
            bq["receiving"] += 1
            bq_typed["receiving"] += 1

        # Condition pass/fail per building (for TYPE-2/3 columns)
        conditions = emp.get("conditions", {})
        for ci in range(1, 11):
            ck = f"c{ci}"
            cv = conditions.get(ck, "N/A")
            if cv == "YES":
                bq_typed[f"{ck}_pass"] = bq_typed.get(f"{ck}_pass", 0) + 1
            elif cv == "NO":
                bq_typed[f"{ck}_fail"] = bq_typed.get(f"{ck}_fail", 0) + 1

        if failures > 0:
            bq["fail_count"] += failures
            bq_typed["fail_count"] += failures
            # Build boss chain for this failing employee
            boss_id = str(emp.get("boss_id", "")).strip()
            boss = emp_map.get(boss_id, {})
            boss_boss_id = str(boss.get("boss_id", "")).strip()
            boss_boss = emp_map.get(boss_boss_id, {})

            fail_entry = {
                "emp_no": emp.get("emp_no", ""),
                "name": emp.get("full_name", ""),
                "fail_count": failures,
                "building": bldg,
                "boss_name": emp.get("boss_name", "-"),
                "boss_id": boss_id,
                "boss_boss_name": boss_boss.get("full_name", "-"),
                "boss_boss_position": boss_boss.get("position", ""),
            }
            bq["fail_employees"].append(fail_entry)
            bq_typed["fail_employees"].append(fail_entry)

    # Calculate reject rate per building (flat and typed)
    for bldg, bq in building_quality.items():
        if bq["tests"] > 0:
            bq["reject_rate"] = (bq["fail_count"] / bq["tests"]) * 100
        else:
            bq["reject_rate"] = 0
    for emp_type in building_quality_by_type:
        for bldg, bq in building_quality_by_type[emp_type].items():
            if bq["tests"] > 0:
                bq["reject_rate"] = (bq["fail_count"] / bq["tests"]) * 100
            else:
                bq["reject_rate"] = 0

    # --- 연속 AQL 실패자 (Issue #48: startswith('YES') 사용) ---
    continuous_3m = []
    continuous_2m = []
    for emp in employees:
        cf = str(emp.get("aql", {}).get("continuous_fail", "NO"))
        emp_info = _build_emp_chain(emp, emp_map)

        if cf.startswith("YES_3") or cf == "YES_3MONTHS":
            continuous_3m.append(emp_info)
        elif cf.startswith("YES_2") or cf.startswith("YES") and "2" in cf:
            continuous_2m.append(emp_info)

    # --- 5PRS 미달자 (TYPE-1만) ---
    low_prs_rate = []
    low_prs_qty = []
    for emp in employees:
        emp_type = str(emp.get("type", "")).strip()
        if emp_type != "TYPE-1":
            continue

        prs = emp.get("prs", {})
        pass_rate = float(prs.get("pass_rate", 0) or 0)
        insp_qty = float(prs.get("inspection_qty", 0) or 0)

        emp_info = _build_emp_chain(emp, emp_map)
        emp_info["pass_rate"] = pass_rate
        emp_info["inspection_qty"] = insp_qty

        if pass_rate > 0 and pass_rate < prs_rate_th:
            low_prs_rate.append(emp_info)
        if insp_qty > 0 and insp_qty < prs_qty_th:
            low_prs_qty.append(emp_info)

    # --- 출근 미달자 ---
    low_attendance = []
    high_absence = []
    for emp in employees:
        att = emp.get("attendance", {})
        att_rate = float(att.get("rate", 0) or 0)
        unapp_abs = float(att.get("unapproved_absence", 0) or 0)
        actual_days = int(att.get("actual_days", 0) or 0)

        # Skip employees with 0 actual days (not yet working this month)
        if actual_days == 0:
            continue

        emp_info = _build_emp_chain(emp, emp_map)
        emp_info["attendance_rate"] = att_rate
        emp_info["unapproved_absence"] = unapp_abs

        if att_rate > 0 and att_rate < att_rate_th:
            low_attendance.append(emp_info)
        if unapp_abs > absence_th:
            high_absence.append(emp_info)

    # --- Condition stats from summary ---
    condition_stats = summary.get("condition_stats", {})

    # --- Previous month data ---
    prev_data = firestore_data.get("previous", {})
    prev_summary = prev_data.get("summary", {}) if prev_data else {}
    prev_condition_stats = prev_data.get("condition_stats", {}) if prev_data else {}
    prev_building = prev_data.get("building_breakdown", {}) if prev_data else {}
    prev_month_ko = prev_data.get("month_ko", "") if prev_data else ""

    return {
        "summary": summary,
        "building_quality": building_quality,
        "building_quality_by_type": building_quality_by_type,
        "continuous_3m": continuous_3m,
        "continuous_2m": continuous_2m,
        "low_prs_rate": low_prs_rate,
        "low_prs_qty": low_prs_qty,
        "low_attendance": low_attendance,
        "high_absence": high_absence,
        "thresholds": {
            "attendance_rate": att_rate_th,
            "unapproved_absence": absence_th,
            "5prs_pass_rate": prs_rate_th,
            "5prs_min_qty": prs_qty_th,
        },
        # New: condition and comparison data
        "condition_stats": condition_stats,
        "previous_summary": prev_summary,
        "previous_condition_stats": prev_condition_stats,
        "previous_building": prev_building,
        "previous_month_ko": prev_month_ko,
        "previous_month_idx": prev_data.get("month_idx") if prev_data else None,
    }


def _build_emp_chain(emp, emp_map):
    """직원의 담당자 → 상사 체인 정보 구성"""
    boss_id = str(emp.get("boss_id", "")).strip()
    boss = emp_map.get(boss_id, {})
    boss_boss_id = str(boss.get("boss_id", "")).strip()
    boss_boss = emp_map.get(boss_boss_id, {})

    # Determine status: resigned / maternity leave / active
    stop_date = emp.get("stop_working_date", "")
    att = emp.get("attendance", {})
    approved_leave = float(att.get("approved_leave", 0) or 0)
    actual_days = float(att.get("actual_days", 0) or 0)
    unapp_abs = float(att.get("unapproved_absence", 0) or 0)

    emp_status = ""
    if stop_date:
        emp_status = "resigned"
    elif approved_leave >= 5 and actual_days < 5 and unapp_abs == 0:
        emp_status = "maternity_leave"

    return {
        "emp_no": emp.get("emp_no", ""),
        "name": emp.get("full_name", ""),
        "building": emp.get("building", "-"),
        "position": emp.get("position", ""),
        "type": emp.get("type", ""),
        "boss_name": emp.get("boss_name", "-"),
        "boss_id": boss_id,
        "boss_boss_name": boss_boss.get("full_name", "-"),
        "boss_boss_position": boss_boss.get("position", ""),
        "emp_status": emp_status,
        "stop_working_date": stop_date,
    }


# ---------------------------------------------------------------------------
# Email sending
# ---------------------------------------------------------------------------

def send_email(recipients, html_body, subject, smtp_settings):
    """SMTP를 통해 이메일 발송

    Args:
        recipients: 수신자 이메일 리스트 또는 dict 리스트 [{email, name, lang}]
        html_body: HTML 이메일 본문
        subject: 이메일 제목
        smtp_settings: {host, port, user, password, from_name, from_email}

    Returns:
        dict: {sent: int, failed: int, errors: list}
    """
    host = smtp_settings.get("host", DEFAULT_SMTP["host"])
    port = int(smtp_settings.get("port", DEFAULT_SMTP["port"]))
    user = smtp_settings.get("user", "")
    password = smtp_settings.get("password", "")
    from_name = smtp_settings.get("from_name", DEFAULT_SMTP["from_name"])
    from_email = smtp_settings.get("from_email", user or DEFAULT_SMTP["from_email"])

    if not user or not password:
        print("  SMTP 인증 정보 없음 (SMTP_USER, SMTP_PASSWORD 필요)")
        return {"sent": 0, "failed": len(recipients), "errors": ["No SMTP credentials"]}

    # Normalize recipients to email list
    email_list = []
    for r in recipients:
        if isinstance(r, dict):
            email_list.append(r.get("email", ""))
        else:
            email_list.append(str(r))
    email_list = [e for e in email_list if e and "@" in e]

    if not email_list:
        print("  유효한 수신자 없음")
        return {"sent": 0, "failed": 0, "errors": ["No valid recipients"]}

    result = {"sent": 0, "failed": 0, "errors": []}

    def _connect_and_auth(host, port, user, password):
        """한비로 SMTP AUTH LOGIN 직접 사용 (CRAM-MD5/PLAIN 실패로 인한 503 방지)"""
        import ssl
        import base64
        if port == 465:
            ctx = ssl.create_default_context()
            srv = smtplib.SMTP_SSL(host, port, timeout=30, context=ctx)
        else:
            srv = smtplib.SMTP(host, port, timeout=30)
            srv.ehlo()
            srv.starttls()
            srv.ehlo()
        srv.ehlo()
        # AUTH LOGIN 직접 실행
        code, resp = srv.docmd(
            "AUTH LOGIN",
            base64.b64encode(user.encode()).decode()
        )
        if code == 334:
            code, resp = srv.docmd(
                base64.b64encode(password.encode()).decode()
            )
        if code != 235:
            raise smtplib.SMTPAuthenticationError(code, resp)
        return srv

    try:
        print(f"  SMTP 연결: {host}:{port} (AUTH LOGIN)")
        server = _connect_and_auth(host, port, user, password)
        print(f"  SMTP 로그인 성공: {user}")

        for email_addr in email_list:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = f"{from_name} <{from_email}>"
                msg["To"] = email_addr
                msg.attach(MIMEText(html_body, "html", "utf-8"))

                server.mail(from_email)
                server.rcpt(email_addr)
                server.data(msg.as_bytes())
                result["sent"] += 1
                print(f"    -> {email_addr} 발송 성공")
            except Exception as e:
                result["failed"] += 1
                result["errors"].append(f"{email_addr}: {e}")
                print(f"    -> {email_addr} 발송 실패: {e}")

        server.quit()
        print(f"  SMTP 연결 종료")

    except Exception as e:
        result["failed"] = len(email_list)
        result["errors"].append(f"SMTP connection: {e}")
        print(f"  SMTP 연결 실패: {e}")

        # Retry once
        print("  1회 재시도...")
        try:
            import time
            time.sleep(3)
            server = _connect_and_auth(host, port, user, password)

            result = {"sent": 0, "failed": 0, "errors": []}
            for email_addr in email_list:
                try:
                    msg = MIMEMultipart("alternative")
                    msg["Subject"] = subject
                    msg["From"] = f"{from_name} <{from_email}>"
                    msg["To"] = email_addr
                    msg.attach(MIMEText(html_body, "html", "utf-8"))
                    server.mail(from_email)
                    server.rcpt(email_addr)
                    server.data(msg.as_bytes())
                    result["sent"] += 1
                    print(f"    -> {email_addr} 발송 성공 (재시도)")
                except Exception as e2:
                    result["failed"] += 1
                    result["errors"].append(f"{email_addr}: {e2}")
            server.quit()
        except Exception as e2:
            print(f"  재시도 실패: {e2}")

    return result


# ---------------------------------------------------------------------------
# Duplicate prevention
# ---------------------------------------------------------------------------

def should_send_email(db, month, year):
    """중복 발송 방지 체크

    Returns:
        bool: True이면 발송 진행
    """
    today = datetime.utcnow().strftime("%Y-%m-%d")
    month_year = f"{month}_{year}"

    log_ref = db.collection("system").document("email_logs")
    log_doc = log_ref.get()
    if not log_doc.exists:
        return True

    logs = log_doc.to_dict() or {}
    last_sent = logs.get(month_year, {})

    if last_sent.get("date") == today:
        print(f"  오늘 이미 발송됨 ({today}) — 스킵")
        return False

    # Data change check via summary hash
    summary_ref = db.collection("dashboard_summary").document(month_year)
    summary_doc = summary_ref.get()
    if summary_doc.exists:
        summary_str = json.dumps(summary_doc.to_dict(), sort_keys=True, default=str)
        current_hash = hashlib.md5(summary_str.encode()).hexdigest()[:12]
        if last_sent.get("data_hash") == current_hash:
            print(f"  데이터 변경 없음 (hash: {current_hash}) — 스킵")
            return False

    return True


def log_email_sent(db, month, year, sent_count, data_hash=None):
    """발송 기록 저장"""
    month_year = f"{month}_{year}"
    today = datetime.utcnow().strftime("%Y-%m-%d")
    now = datetime.utcnow().isoformat() + "Z"

    log_ref = db.collection("system").document("email_logs")
    log_ref.set({
        month_year: {
            "date": today,
            "sent_at": now,
            "sent_count": sent_count,
            "data_hash": data_hash or "",
        }
    }, merge=True)
    print(f"  발송 기록 저장: {month_year} ({sent_count}건, {today})")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="QIP Incentive 주간 이메일 리포트 발송"
    )
    parser.add_argument("--month", required=True, help="월 (lowercase, e.g. february)")
    parser.add_argument("--year", required=True, type=int, help="연도 (e.g. 2026)")
    parser.add_argument("--dry-run", action="store_true",
                        help="발송 없이 HTML 파일로 저장")
    parser.add_argument("--test-email", type=str, default=None,
                        help="테스트 발송할 이메일 주소")
    parser.add_argument("--force", action="store_true",
                        help="중복 체크 무시하고 강제 발송")
    parser.add_argument("--output", type=str, default=None,
                        help="Dry-run 시 HTML 저장 경로")
    parser.add_argument("--lang", type=str, default=None,
                        help="언어 코드 (ko, vi). 미지정 시 수신자별 lang 필드 사용")
    args = parser.parse_args()

    month = args.month.lower().strip()
    year = args.year
    month_year = f"{month}_{year}"

    print("=" * 60)
    print(f"  QIP Incentive Email Report")
    print(f"  Period: {month.capitalize()} {year}")
    if args.dry_run:
        print(f"  Mode: DRY-RUN (HTML 저장)")
    elif args.test_email:
        print(f"  Mode: TEST ({args.test_email})")
    else:
        print(f"  Mode: LIVE (Firestore 수신자)")
    print("=" * 60)

    # Step 1: Firestore 초기화
    print("\n[Step 1] Firebase 초기화")
    db = init_firestore()

    # Step 2: 중복 체크 (dry-run/test/force 시 스킵)
    if not args.dry_run and not args.test_email and not args.force:
        print("\n[Step 2] 중복 발송 체크")
        if not should_send_email(db, month, year):
            print("  발송 스킵 (중복 또는 데이터 미변경)")
            return
        print("  발송 진행")
    else:
        print("\n[Step 2] 중복 체크 건너뜀")

    # Step 3: Firestore 데이터 로드
    print("\n[Step 3] Firestore 데이터 로드")
    firestore_data = load_firestore_data(db, month, year)

    # Step 3.5: 전월 데이터 로드 (비교용)
    print("\n[Step 3.5] 전월 데이터 로드")
    prev_data = load_previous_month(db, month, year)
    firestore_data["previous"] = prev_data

    # Step 4: 액션 리포트 데이터 빌드
    print("\n[Step 4] 액션 리포트 데이터 생성")
    action_data = build_action_report(firestore_data)

    # Print summary
    bq = action_data["building_quality"]
    total_fails = sum(len(b.get("fail_employees", [])) for b in bq.values())
    print(f"    Building 수: {len(bq)}")
    print(f"    AQL 실패자: {total_fails}명")
    print(f"    3개월 연속: {len(action_data['continuous_3m'])}명")
    print(f"    2개월 연속: {len(action_data['continuous_2m'])}명")
    print(f"    5PRS 통과율 미달: {len(action_data['low_prs_rate'])}명")
    print(f"    5PRS 검사량 미달: {len(action_data['low_prs_qty'])}명")
    print(f"    출근율 미달: {len(action_data['low_attendance'])}명")
    print(f"    무단결근 초과: {len(action_data['high_absence'])}명")

    # Step 4.9: Config 로드 (데이터 기간 정보)
    monthly_config = None
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                               "config_files", f"config_{month}_{year}.json")
    if os.path.exists(config_path):
        import json as _json
        with open(config_path, "r", encoding="utf-8") as f:
            monthly_config = _json.load(f)

    # Step 5: HTML 생성 (언어별)
    print("\n[Step 5] HTML 이메일 생성")
    report_lang = args.lang or "ko"
    html = generate_email_html(
        action_data,
        month=month,
        year=year,
        lang=report_lang,
        config=monthly_config,
    )
    print(f"    HTML 크기: {len(html):,} bytes (lang={report_lang})")

    # Step 6: Dry-run → HTML 저장
    if args.dry_run:
        lang_suffix = f"_{report_lang}" if report_lang != "ko" else ""
        output_path = args.output or f"output_files/email_report_{month_year}{lang_suffix}.html"
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"\n  [DRY-RUN] HTML 저장: {output_path}")
        print(f"  브라우저에서 확인: open {output_path}")
        return

    # Step 7: SMTP 설정 로드
    print("\n[Step 6] SMTP 설정 로드")
    config = firestore_data.get("config", {})
    email_settings = config.get("email_settings", {})

    smtp_settings = {
        "host": email_settings.get("smtp_host", DEFAULT_SMTP["host"]),
        "port": email_settings.get("smtp_port", DEFAULT_SMTP["port"]),
        "from_name": email_settings.get("from_name", DEFAULT_SMTP["from_name"]),
        "from_email": email_settings.get("from_email", DEFAULT_SMTP["from_email"]),
        "user": os.environ.get("SMTP_USER", email_settings.get("smtp_user", "")),
        "password": os.environ.get("SMTP_PASSWORD", email_settings.get("smtp_password", "")),
    }
    print(f"    SMTP: {smtp_settings['host']}:{smtp_settings['port']}")
    print(f"    From: {smtp_settings['from_name']} <{smtp_settings['from_email']}>")

    # Step 8: 수신자 결정 + 언어별 그룹화
    print("\n[Step 7] 수신자 결정")
    if args.test_email:
        # 테스트 모드: 지정된 언어로 한 명에게만 발송
        lang_groups = {report_lang: [args.test_email]}
        print(f"    테스트 발송: {args.test_email} (lang={report_lang})")
    else:
        recipients = config.get("email_recipients", [])
        if not recipients:
            recipients = config.get("admin_emails", [])

        # 언어별 그룹화
        lang_groups = {}
        for r in recipients:
            if isinstance(r, dict):
                rlang = r.get("lang", "vi")
                email = r.get("email", "")
                rname = r.get("name", "-")
                if email:
                    lang_groups.setdefault(rlang, []).append(email)
                    print(f"      - {rname} <{email}> (lang={rlang})")
            else:
                lang_groups.setdefault("vi", []).append(str(r))
                print(f"      - {r} (lang=vi)")

        # --lang 플래그 지정 시 모든 수신자에게 해당 언어로 발송
        if args.lang:
            all_emails = [e for group in lang_groups.values() for e in group]
            lang_groups = {args.lang: all_emails}

        print(f"    수신자: {sum(len(v) for v in lang_groups.values())}명 ({len(lang_groups)}개 언어)")

    if not lang_groups:
        print("  수신자 없음 — 발송 중단")
        return

    # Step 9: 언어별 이메일 발송
    total_result = {"sent": 0, "failed": 0, "errors": []}

    for send_lang, send_recipients in lang_groups.items():
        # 언어별 HTML 생성
        import copy
        lang_data = copy.deepcopy(action_data)
        lang_html = generate_email_html(
            lang_data,
            month=month,
            year=year,
            lang=send_lang,
            config=monthly_config,
        )

        # 언어별 제목
        if send_lang == "vi":
            month_idx = ["january","february","march","april","may","june",
                         "july","august","september","october","november","december"].index(month) + 1
            subject = f"[QIP] B\u00e1o c\u00e1o Th\u01b0\u1edfng Th\u00e1ng {month_idx}/{year}"
        elif send_lang == "en":
            subject = f"[QIP] {month.capitalize()} {year} Incentive Action Report"
        else:
            month_ko_map = {"january": "1월", "february": "2월", "march": "3월", "april": "4월",
                        "may": "5월", "june": "6월", "july": "7월", "august": "8월",
                        "september": "9월", "october": "10월", "november": "11월", "december": "12월"}
            subject = f"[QIP] {year}년 {month_ko_map.get(month, month)} 인센티브 액션 리포트"

        print(f"\n[Step 8] 이메일 발송 (lang={send_lang}, {len(send_recipients)}명)")
        print(f"    제목: {subject}")
        result = send_email(send_recipients, lang_html, subject, smtp_settings)
        total_result["sent"] += result["sent"]
        total_result["failed"] += result["failed"]
        total_result["errors"].extend(result["errors"])

    # Step 10: 결과 로깅
    result = total_result
    print(f"\n[Step 9] 결과")
    print(f"    발송: {result['sent']}건")
    print(f"    실패: {result['failed']}건")
    if result["errors"]:
        for err in result["errors"]:
            print(f"    에러: {err}")

    # Save log to Firestore
    if result["sent"] > 0 and not args.test_email:
        summary_str = json.dumps(firestore_data["summary"], sort_keys=True, default=str)
        data_hash = hashlib.md5(summary_str.encode()).hexdigest()[:12]
        log_email_sent(db, month, year, result["sent"], data_hash)

    print("\n" + "=" * 60)
    if result["sent"] > 0:
        print(f"  발송 완료 ({result['sent']}건)")
    elif result["failed"] > 0:
        print(f"  발송 실패 ({result['failed']}건)")
    else:
        print(f"  발송 없음")
    print("=" * 60)


if __name__ == "__main__":
    main()
