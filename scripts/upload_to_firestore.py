#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Firestore 업로드 스크립트 - QIP Incentive 계산 결과를 Firebase Firestore에 업로드

Usage:
    python scripts/upload_to_firestore.py --month february --year 2026
    python scripts/upload_to_firestore.py --month february --year 2026 --dry-run

Authentication:
    1. FIREBASE_SERVICE_ACCOUNT 환경변수 (JSON 문자열)
    2. Fallback: /Users/ksmoon/Downloads/qip-dashboard-dabdc4d51ac9.json
"""

import os
import sys
import json
import argparse
import math
from datetime import datetime

import pandas as pd

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("=" * 60)
    print("firebase-admin 패키지가 설치되지 않았습니다.")
    print("설치: pip install firebase-admin")
    print("=" * 60)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LOCAL_SERVICE_ACCOUNT_PATH = "/Users/ksmoon/Downloads/qip-dashboard-dabdc4d51ac9.json"

# 대상 Firebase 프로젝트 ID
# 서비스 계정은 qip-dashboard 소속이지만, Firestore는 hwk-qip-incentive-dashboard에 위치
# firebase_admin 초기화 시 대상 프로젝트를 명시적으로 지정해야 함
TARGET_FIREBASE_PROJECT = "hwk-qip-incentive-dashboard"

CSV_PATTERN = "output_files/output_QIP_incentive_{month}_{year}_Complete_V10.0_Complete.csv"

# Column name mappings: CSV column -> internal key
# These map the CSV header names to the Firestore field names
CONDITION_COLS = {f"cond_{i}": f"c{i}" for i in range(1, 11)}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def safe_float(value, default=0.0):
    """NaN/None/empty 안전 float 변환"""
    if value is None:
        return default
    if isinstance(value, float) and math.isnan(value):
        return default
    try:
        result = float(value)
        return default if math.isnan(result) else result
    except (ValueError, TypeError):
        return default


def safe_int(value, default=0):
    """NaN/None/empty 안전 int 변환"""
    f = safe_float(value, float(default))
    return int(f)


def safe_str(value, default=""):
    """NaN/None 안전 str 변환"""
    if value is None:
        return default
    if isinstance(value, float) and math.isnan(value):
        return default
    s = str(value).strip()
    if s.lower() in ("nan", "none", ""):
        return default
    return s


# ---------------------------------------------------------------------------
# Firebase initialisation
# ---------------------------------------------------------------------------

def init_firestore(dry_run=False):
    """Firebase Admin SDK 초기화 및 Firestore 클라이언트 반환

    Args:
        dry_run: True이면 실제 연결 없이 None 반환

    Returns:
        Firestore client 또는 None (dry-run 시)
    """
    if dry_run:
        print("🔸 [DRY-RUN] Firestore 초기화 건너뜀 (dry-run 모드)")
        return None

    # 이미 초기화된 경우 기존 앱 사용
    if firebase_admin._apps:
        print("✅ Firebase 이미 초기화됨 — 기존 앱 사용")
        return firestore.client()

    # Firebase 앱 초기화 옵션 — 대상 프로젝트 명시
    # 서비스 계정(qip-dashboard)과 Firestore 프로젝트(hwk-qip-incentive-dashboard)가 다르므로
    # projectId를 명시적으로 지정해야 올바른 Firestore에 접근 가능
    app_options = {"projectId": TARGET_FIREBASE_PROJECT}

    # 1) 환경변수에서 서비스 계정 정보 로드
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "")
    if sa_json:
        try:
            sa_info = json.loads(sa_json)
            cred = credentials.Certificate(sa_info)
            firebase_admin.initialize_app(cred, app_options)
            print(f"✅ Firebase 초기화 성공 (환경변수 → 프로젝트: {TARGET_FIREBASE_PROJECT})")
            return firestore.client()
        except Exception as e:
            print(f"⚠️ 환경변수 인증 실패: {e}")
            print("   로컬 파일로 fallback 시도...")

    # 2) 로컬 서비스 계정 파일
    if os.path.exists(LOCAL_SERVICE_ACCOUNT_PATH):
        try:
            cred = credentials.Certificate(LOCAL_SERVICE_ACCOUNT_PATH)
            firebase_admin.initialize_app(cred, app_options)
            print(f"✅ Firebase 초기화 성공 (로컬 파일 → 프로젝트: {TARGET_FIREBASE_PROJECT})")
            return firestore.client()
        except Exception as e:
            print(f"❌ 로컬 파일 인증 실패: {e}")
            sys.exit(1)
    else:
        print(f"❌ 서비스 계정 파일 없음: {LOCAL_SERVICE_ACCOUNT_PATH}")
        print("   FIREBASE_SERVICE_ACCOUNT 환경변수를 설정하거나 로컬 파일을 배치하세요.")
        sys.exit(1)


# ---------------------------------------------------------------------------
# CSV loading
# ---------------------------------------------------------------------------

def load_csv(month: str, year: int) -> pd.DataFrame:
    """계산 결과 CSV 파일 로드

    Args:
        month: 월 이름 (lowercase, e.g. "february")
        year: 연도 (e.g. 2026)

    Returns:
        pandas DataFrame
    """
    csv_path = CSV_PATTERN.format(month=month, year=year)

    if not os.path.exists(csv_path):
        print(f"❌ CSV 파일 없음: {csv_path}")
        print(f"   먼저 인센티브 계산을 실행하세요.")
        sys.exit(1)

    print(f"📂 CSV 로드: {csv_path}")
    df = pd.read_csv(csv_path, encoding="utf-8-sig")
    print(f"   {len(df)} 행, {len(df.columns)} 열 로드 완료")
    return df


# ---------------------------------------------------------------------------
# Transform: DataFrame row -> Firestore employee document
# ---------------------------------------------------------------------------

def row_to_employee(row: pd.Series, month_capitalized: str) -> dict:
    """CSV 1행을 Firestore employee 객체로 변환

    Args:
        row: pandas Series (CSV 한 행)
        month_capitalized: 월 이름 대문자 시작 (e.g. "February")

    Returns:
        dict: Firestore에 저장할 employee 객체
    """
    # Condition results (YES / NO / N/A)
    conditions = {}
    for csv_col, fs_key in CONDITION_COLS.items():
        conditions[fs_key] = safe_str(row.get(csv_col, ""), "N/A")

    # Condition values and thresholds
    condition_values = {}
    for i in range(1, 11):
        condition_values[f"c{i}_value"] = safe_float(row.get(f"cond_{i}_value"))
        condition_values[f"c{i}_threshold"] = safe_float(row.get(f"cond_{i}_threshold"))

    # AQL failures column is month-dynamic
    aql_failures_col = f"{month_capitalized} AQL Failures"

    employee = {
        "stt": safe_int(row.get("STT", row.get("stt", 0))),
        "emp_no": safe_str(row.get("Employee No", row.get("emp_no", ""))),
        "full_name": safe_str(row.get("Full Name", row.get("FULL NAME", ""))),
        "building": safe_str(row.get("BUILDING", "")),
        "position": safe_str(row.get("QIP POSITION 1ST  NAME", "")),
        "position_code": safe_str(row.get("FINAL QIP POSITION NAME CODE", "")),
        "type": safe_str(row.get("ROLE TYPE STD", "")),
        "boss_name": safe_str(row.get("direct boss name", "")),
        "entrance_date": safe_str(row.get("Entrance Date", "")),
        "stop_working_date": safe_str(row.get("Stop working Date", "")),

        "conditions": conditions,
        "condition_values": condition_values,
        "conditions_applicable": safe_int(row.get("Conditions_Applicable")),
        "conditions_passed": safe_int(row.get("Conditions_Passed")),
        "conditions_pass_rate": safe_float(row.get("Condition_Pass_Rate")),

        "attendance": {
            "rate": safe_float(row.get("출근율_Attendance_Rate_Percent")),
            "total_days": safe_int(row.get("Total Working Days")),
            "actual_days": safe_int(row.get("Actual Working Days")),
            "unapproved_absence": safe_float(row.get("Unapproved Absences")),
            "approved_leave": safe_float(row.get("Approved Leave Days")),
            "absence_rate": safe_float(row.get("결근율_Absence_Rate_Percent")),
        },

        "aql": {
            "failures": safe_int(row.get(aql_failures_col, 0)),
            "continuous_fail": safe_str(row.get("Continuous_FAIL", ""), "NO"),
            "area_reject_rate": safe_float(row.get("Area_Reject_Rate")),
            "total_tests": safe_float(row.get("AQL_Total_Tests")),
            "pass_count": safe_float(row.get("AQL_Pass_Count")),
            "fail_percent": safe_float(row.get("AQL_Fail_Percent")),
        },

        "prs": {
            "pass_rate": safe_float(row.get("5PRS_Pass_Rate")),
            "inspection_qty": safe_float(row.get("5PRS_Inspection_Qty")),
            "total_qty": safe_float(row.get("Total Valiation Qty")),
            "total_pass": safe_float(row.get("Total Pass Qty")),
        },

        "current_incentive": safe_float(row.get("Final Incentive amount")),
        "previous_incentive": safe_float(row.get("Previous_Month_Incentive")),
        "continuous_months": safe_int(row.get("Continuous_Months")),
        "previous_continuous_months": safe_int(row.get("Previous_Continuous_Months")),
        "next_month_expected": safe_int(row.get("Next_Month_Expected")),
        "talent_pool_member": safe_str(row.get("Talent_Pool_Member", ""), "NO"),
        "talent_pool_bonus": safe_float(row.get("Talent_Pool_Bonus")),
    }

    return employee


# ---------------------------------------------------------------------------
# Transform: DataFrame -> dashboard summary
# ---------------------------------------------------------------------------

def build_summary(df: pd.DataFrame, month: str, year: int, working_days: int) -> dict:
    """계산 결과 DataFrame에서 대시보드 요약 생성

    Args:
        df: 전체 employee DataFrame
        month: 월 이름 (lowercase)
        year: 연도
        working_days: 총 근무일

    Returns:
        dict: dashboard_summary document
    """
    incentive_col = "Final Incentive amount"

    # 안전하게 인센티브 컬럼 float 변환
    df["_incentive"] = df[incentive_col].apply(safe_float)

    total_employees = len(df)
    receiving = df[df["_incentive"] > 0]
    receiving_count = len(receiving)
    total_incentive = float(receiving["_incentive"].sum())

    # TYPE 분류
    type_col = "ROLE TYPE STD"
    type_breakdown = {}
    for t in ["TYPE-1", "TYPE-2", "TYPE-3"]:
        mask = df[type_col].astype(str).str.strip() == t
        subset = df[mask]
        sub_receiving = subset[subset["_incentive"] > 0]
        type_breakdown[t] = {
            "count": int(len(subset)),
            "receiving": int(len(sub_receiving)),
            "total_amount": float(sub_receiving["_incentive"].sum()),
        }

    # Building 분류
    building_col = "BUILDING"
    building_breakdown = {}
    if building_col in df.columns:
        for bldg in df[building_col].dropna().unique():
            bldg_str = safe_str(bldg)
            if not bldg_str:
                continue
            mask = df[building_col].astype(str).str.strip() == bldg_str
            subset = df[mask]
            sub_receiving = subset[subset["_incentive"] > 0]
            building_breakdown[bldg_str] = {
                "count": int(len(subset)),
                "receiving": int(len(sub_receiving)),
                "total_amount": float(sub_receiving["_incentive"].sum()),
            }

    # Condition 통계 (c1 ~ c10)
    condition_stats = {}
    for i in range(1, 11):
        col = f"cond_{i}"
        if col in df.columns:
            values = df[col].astype(str).str.strip().str.upper()
            condition_stats[f"c{i}_pass"] = int((values == "YES").sum())
            condition_stats[f"c{i}_fail"] = int((values == "NO").sum())
            condition_stats[f"c{i}_na"] = int((values == "N/A").sum())
        else:
            condition_stats[f"c{i}_pass"] = 0
            condition_stats[f"c{i}_fail"] = 0
            condition_stats[f"c{i}_na"] = 0

    # Eligible employees (퇴사 전 직원 제외)
    eligible_count = total_employees
    if "Stop working Date" in df.columns:
        # 빈 값이면 재직 중으로 간주
        non_resigned = df["Stop working Date"].isna() | (df["Stop working Date"].astype(str).str.strip() == "")
        eligible_count = int(non_resigned.sum())

    now_iso = datetime.utcnow().isoformat() + "Z"

    summary = {
        "total_employees": total_employees,
        "eligible_employees": eligible_count,
        "receiving_employees": receiving_count,
        "total_incentive": total_incentive,
        "type_breakdown": type_breakdown,
        "building_breakdown": building_breakdown,
        "condition_stats": condition_stats,
        "working_days": working_days,
        "month": month,
        "year": year,
        "data_updated_at": now_iso,
        "calculated_at": now_iso,
    }

    # 임시 컬럼 제거
    df.drop(columns=["_incentive"], inplace=True, errors="ignore")

    return summary


# ---------------------------------------------------------------------------
# Upload to Firestore
# ---------------------------------------------------------------------------

def upload_employees(db, month_year: str, employees: list, dry_run: bool = False):
    """직원 데이터를 Firestore에 업로드 (단일 문서)

    Schema: employees/{month_year}/all_data (single document)

    Args:
        db: Firestore client
        month_year: 문서 ID (e.g. "february_2026")
        employees: employee dict 리스트
        dry_run: True이면 업로드하지 않음
    """
    doc_data = {
        "employees": employees,
        "meta": {
            "count": len(employees),
            "updated_at": datetime.utcnow().isoformat() + "Z",
            "month": month_year.split("_")[0],
            "year": int(month_year.split("_")[1]),
        }
    }

    # Firestore 문서 크기 제한: 1MB
    # 540명 직원 * ~1KB/직원 = ~540KB (안전 범위)
    estimated_size_kb = len(json.dumps(doc_data, ensure_ascii=False).encode("utf-8")) / 1024
    print(f"   예상 문서 크기: {estimated_size_kb:.1f} KB")

    if estimated_size_kb > 900:
        print(f"⚠️ 문서 크기가 900KB 초과 ({estimated_size_kb:.1f}KB) - Firestore 1MB 제한 주의")

    if dry_run:
        print(f"🔸 [DRY-RUN] employees/{month_year}/all_data 업로드 건너뜀")
        print(f"   직원 수: {len(employees)}")
        # 샘플 출력 (처음 3명)
        for i, emp in enumerate(employees[:3]):
            print(f"   [{i+1}] {emp['emp_no']} {emp['full_name']} | "
                  f"{emp['type']} | {emp['position']} | "
                  f"Incentive: {emp['current_incentive']:,.0f} VND")
        if len(employees) > 3:
            print(f"   ... 외 {len(employees) - 3}명")
        return

    doc_ref = db.collection("employees").document(month_year).collection("all_data").document("data")
    doc_ref.set(doc_data)
    print(f"✅ employees/{month_year}/all_data 업로드 완료 ({len(employees)}명)")


def upload_summary(db, month_year: str, summary: dict, dry_run: bool = False):
    """대시보드 요약을 Firestore에 업로드

    Schema: dashboard_summary/{month_year}

    Args:
        db: Firestore client
        month_year: 문서 ID (e.g. "february_2026")
        summary: 요약 dict
        dry_run: True이면 업로드하지 않음
    """
    if dry_run:
        print(f"🔸 [DRY-RUN] dashboard_summary/{month_year} 업로드 건너뜀")
        print(f"   총 직원: {summary['total_employees']}")
        print(f"   적격 직원: {summary['eligible_employees']}")
        print(f"   수령 직원: {summary['receiving_employees']}")
        print(f"   총 인센티브: {summary['total_incentive']:,.0f} VND")
        print(f"   근무일: {summary['working_days']}")
        for t, info in summary["type_breakdown"].items():
            print(f"   {t}: {info['count']}명 (수령: {info['receiving']}명, "
                  f"합계: {info['total_amount']:,.0f} VND)")
        return

    doc_ref = db.collection("dashboard_summary").document(month_year)
    doc_ref.set(summary)
    print(f"✅ dashboard_summary/{month_year} 업로드 완료")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="QIP Incentive 계산 결과를 Firebase Firestore에 업로드"
    )
    parser.add_argument(
        "--month", required=True,
        help="월 이름 (lowercase, e.g. february)"
    )
    parser.add_argument(
        "--year", required=True, type=int,
        help="연도 (e.g. 2026)"
    )
    parser.add_argument(
        "--dry-run", action="store_true", default=False,
        help="테스트 모드 - Firestore에 업로드하지 않고 데이터만 출력"
    )
    args = parser.parse_args()

    month = args.month.lower().strip()
    year = args.year
    month_year = f"{month}_{year}"
    month_capitalized = month.capitalize()
    dry_run = args.dry_run

    print("=" * 60)
    print(f"🚀 QIP Incentive Firestore 업로드")
    print(f"   월/년: {month_capitalized} {year}")
    print(f"   문서 ID: {month_year}")
    if dry_run:
        print(f"   모드: 🔸 DRY-RUN (업로드 안 함)")
    else:
        print(f"   모드: 🟢 LIVE (Firestore 업로드)")
    print("=" * 60)

    # 1. CSV 로드
    print("\n📋 Step 1: CSV 데이터 로드")
    df = load_csv(month, year)

    # 2. Firebase 초기화
    print("\n🔑 Step 2: Firebase 초기화")
    db = init_firestore(dry_run=dry_run)

    # 3. Employee 데이터 변환
    print(f"\n🔄 Step 3: {len(df)}명 직원 데이터 변환 중...")
    employees = []
    error_count = 0
    for idx, row in df.iterrows():
        try:
            emp = row_to_employee(row, month_capitalized)
            employees.append(emp)
        except Exception as e:
            error_count += 1
            emp_no = safe_str(row.get("Employee No", "UNKNOWN"))
            print(f"   ⚠️ 변환 실패 [{emp_no}]: {e}")
            if error_count >= 10:
                print(f"   ❌ 변환 오류 10건 초과 - 중단")
                sys.exit(1)

    print(f"   변환 완료: {len(employees)}명 성공, {error_count}건 실패")

    # 4. Working days 추출
    working_days = 0
    if "Total Working Days" in df.columns:
        working_days = safe_int(df["Total Working Days"].dropna().iloc[0] if len(df) > 0 else 0)
    print(f"   총 근무일: {working_days}")

    # 5. 요약 데이터 생성
    print(f"\n📊 Step 4: 대시보드 요약 생성")
    summary = build_summary(df, month, year, working_days)

    # 6. Firestore 업로드
    print(f"\n☁️  Step 5: Firestore 업로드")
    print(f"   Uploading {len(employees)} employees to Firestore...")

    upload_employees(db, month_year, employees, dry_run=dry_run)
    upload_summary(db, month_year, summary, dry_run=dry_run)

    # 7. 최종 요약
    print("\n" + "=" * 60)
    print("📊 업로드 결과 요약")
    print("=" * 60)
    print(f"   월/년: {month_capitalized} {year}")
    print(f"   총 직원: {summary['total_employees']}명")
    print(f"   적격 직원: {summary['eligible_employees']}명")
    print(f"   수령 직원: {summary['receiving_employees']}명")
    print(f"   총 인센티브: {summary['total_incentive']:,.0f} VND")
    print(f"   근무일: {summary['working_days']}일")
    print(f"   TYPE 분류:")
    for t, info in summary["type_breakdown"].items():
        pct = (info["receiving"] / info["count"] * 100) if info["count"] > 0 else 0
        print(f"     {t}: {info['count']}명 → {info['receiving']}명 수령 "
              f"({pct:.1f}%) = {info['total_amount']:,.0f} VND")
    if summary["building_breakdown"]:
        print(f"   Building 분류:")
        for bldg, info in sorted(summary["building_breakdown"].items()):
            print(f"     {bldg}: {info['count']}명 → {info['receiving']}명 수령 "
                  f"= {info['total_amount']:,.0f} VND")
    print("=" * 60)

    mode_label = "DRY-RUN 완료" if dry_run else "업로드 완료"
    print(f"\n✅ {mode_label}!")
    if dry_run:
        print("   실제 업로드: --dry-run 플래그를 제거하고 다시 실행하세요.")


if __name__ == "__main__":
    main()
