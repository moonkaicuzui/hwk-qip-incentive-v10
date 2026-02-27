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
from datetime import datetime

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("=" * 60)
    print("firebase-admin 패키지가 설치되지 않았습니다.")
    print("설치: pip install firebase-admin")
    print("=" * 60)
    sys.exit(1)

# Add parent dir to path for email_template import
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from email_template import generate_email_html


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LOCAL_SERVICE_ACCOUNT_PATH = "/Users/ksmoon/Downloads/qip-dashboard-dabdc4d51ac9.json"
TARGET_FIREBASE_PROJECT = "hwk-qip-incentive-dashboard"

# Default SMTP settings (overridden by Firestore system/config)
DEFAULT_SMTP = {
    "host": "mail.hsvina.com",
    "port": 465,
    "from_name": "QIP Incentive Dashboard",
    "from_email": "ksmoon@hsvina.com",
}


# ---------------------------------------------------------------------------
# Firebase initialisation (reuse pattern from upload_to_firestore.py)
# ---------------------------------------------------------------------------

def init_firestore():
    """Firebase Admin SDK 초기화 및 Firestore 클라이언트 반환"""
    if firebase_admin._apps:
        return firestore.client()

    app_options = {"projectId": TARGET_FIREBASE_PROJECT}

    # 1) 환경변수
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "")
    if sa_json:
        try:
            sa_info = json.loads(sa_json)
            cred = credentials.Certificate(sa_info)
            firebase_admin.initialize_app(cred, app_options)
            print(f"  Firebase 초기화 (환경변수 -> {TARGET_FIREBASE_PROJECT})")
            return firestore.client()
        except Exception as e:
            print(f"  환경변수 인증 실패: {e}, 로컬 파일 시도...")

    # 2) 로컬 파일
    if os.path.exists(LOCAL_SERVICE_ACCOUNT_PATH):
        try:
            cred = credentials.Certificate(LOCAL_SERVICE_ACCOUNT_PATH)
            firebase_admin.initialize_app(cred, app_options)
            print(f"  Firebase 초기화 (로컬 파일 -> {TARGET_FIREBASE_PROJECT})")
            return firestore.client()
        except Exception as e:
            print(f"  로컬 파일 인증 실패: {e}")
            sys.exit(1)

    print("  서비스 계정을 찾을 수 없습니다.")
    sys.exit(1)


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

    # --- Building별 품질 집계 ---
    building_quality = {}
    for emp in employees:
        bldg = str(emp.get("building", "")).strip()
        if not bldg:
            bldg = "Unknown"

        if bldg not in building_quality:
            building_quality[bldg] = {
                "count": 0,
                "tests": 0,
                "fail_count": 0,
                "reject_rate": 0,
                "receiving": 0,
                "fail_employees": [],
            }

        bq = building_quality[bldg]
        bq["count"] += 1

        # AQL data
        aql = emp.get("aql", {})
        tests = int(aql.get("total_tests", 0) or 0)
        failures = int(aql.get("failures", 0) or 0)
        bq["tests"] += tests

        if emp.get("current_incentive", 0) > 0:
            bq["receiving"] += 1

        if failures > 0:
            bq["fail_count"] += failures
            # Build boss chain for this failing employee
            boss_id = str(emp.get("boss_id", "")).strip()
            boss = emp_map.get(boss_id, {})
            boss_boss_id = str(boss.get("boss_id", "")).strip()
            boss_boss = emp_map.get(boss_boss_id, {})

            bq["fail_employees"].append({
                "emp_no": emp.get("emp_no", ""),
                "name": emp.get("full_name", ""),
                "fail_count": failures,
                "building": bldg,
                "boss_name": emp.get("boss_name", "-"),
                "boss_id": boss_id,
                "boss_boss_name": boss_boss.get("full_name", "-"),
                "boss_boss_position": boss_boss.get("position", ""),
            })

    # Calculate reject rate per building
    for bldg, bq in building_quality.items():
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

    return {
        "summary": summary,
        "building_quality": building_quality,
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
    }


def _build_emp_chain(emp, emp_map):
    """직원의 담당자 → 상사 체인 정보 구성"""
    boss_id = str(emp.get("boss_id", "")).strip()
    boss = emp_map.get(boss_id, {})
    boss_boss_id = str(boss.get("boss_id", "")).strip()
    boss_boss = emp_map.get(boss_boss_id, {})

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

    try:
        print(f"  SMTP 연결: {host}:{port} (SSL)")
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=30)
        else:
            server = smtplib.SMTP(host, port, timeout=30)
            server.ehlo()
            server.starttls()
            server.ehlo()
        server.login(user, password)
        print(f"  SMTP 로그인 성공: {user}")

        for email_addr in email_list:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = f"{from_name} <{from_email}>"
                msg["To"] = email_addr
                msg.attach(MIMEText(html_body, "html", "utf-8"))

                server.send_message(msg)
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
            if port == 465:
                server = smtplib.SMTP_SSL(host, port, timeout=30)
            else:
                server = smtplib.SMTP(host, port, timeout=30)
                server.ehlo()
                server.starttls()
                server.ehlo()
            server.login(user, password)

            result = {"sent": 0, "failed": 0, "errors": []}
            for email_addr in email_list:
                try:
                    msg = MIMEMultipart("alternative")
                    msg["Subject"] = subject
                    msg["From"] = f"{from_name} <{from_email}>"
                    msg["To"] = email_addr
                    msg.attach(MIMEText(html_body, "html", "utf-8"))
                    server.send_message(msg)
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

    # Step 5: HTML 생성
    print("\n[Step 5] HTML 이메일 생성")
    html = generate_email_html(
        action_data,
        month=month,
        year=year,
    )
    print(f"    HTML 크기: {len(html):,} bytes")

    # Step 6: Dry-run → HTML 저장
    if args.dry_run:
        output_path = args.output or f"output_files/email_report_{month_year}.html"
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

    # Step 8: 수신자 결정
    print("\n[Step 7] 수신자 결정")
    if args.test_email:
        recipients = [args.test_email]
        print(f"    테스트 발송: {args.test_email}")
    else:
        recipients = config.get("email_recipients", [])
        if not recipients:
            # Fallback to admin_emails
            recipients = config.get("admin_emails", [])
        print(f"    수신자: {len(recipients)}명")
        for r in recipients:
            if isinstance(r, dict):
                print(f"      - {r.get('name', '-')} <{r.get('email', '-')}>")
            else:
                print(f"      - {r}")

    if not recipients:
        print("  수신자 없음 — 발송 중단")
        return

    # Step 9: 이메일 발송
    month_ko = {"january": "1월", "february": "2월", "march": "3월", "april": "4월",
                "may": "5월", "june": "6월", "july": "7월", "august": "8월",
                "september": "9월", "october": "10월", "november": "11월", "december": "12월"}
    subject = f"[QIP] {year}년 {month_ko.get(month, month)} 인센티브 액션 리포트"

    print(f"\n[Step 8] 이메일 발송")
    print(f"    제목: {subject}")
    result = send_email(recipients, html, subject, smtp_settings)

    # Step 10: 결과 로깅
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
