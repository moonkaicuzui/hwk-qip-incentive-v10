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
import calendar
from datetime import datetime, timezone

import pandas as pd

# Add project root to path for utils import
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from scripts.utils.firebase_common import init_firestore

CSV_PATTERN = "output_files/output_QIP_incentive_{month}_{year}_Complete_V10.0_Complete.csv"

# Column name mappings: CSV column -> Firestore field key
# CSV uses full descriptive names like "cond_1_attendance_rate"
CONDITION_COLS = {
    "cond_1_attendance_rate": "c1",
    "cond_2_unapproved_absence": "c2",
    "cond_3_actual_working_days": "c3",
    "cond_4_minimum_days": "c4",
    "cond_5_aql_personal_failure": "c5",
    "cond_6_aql_continuous": "c6",
    "cond_7_aql_team_area": "c7",
    "cond_8_area_reject": "c8",
    "cond_9_5prs_pass_rate": "c9",
    "cond_10_5prs_inspection_qty": "c10",
}

# CSV condition values -> Firestore normalized values
CONDITION_VALUE_MAP = {
    "PASS": "YES",
    "FAIL": "NO",
    "NOT_APPLICABLE": "N/A",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def safe_float(value, default=0.0):
    """NaN/None/empty 안전 float 변환 (pandas NA 포함)"""
    if value is None:
        return default
    # pandas NA/NaT 처리 (pd.isna handles None, np.nan, pd.NA, pd.NaT)
    try:
        if pd.isna(value):
            return default
    except (ValueError, TypeError):
        pass  # pd.isna can fail on some types, fall through to manual check
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
    # Condition results: normalize CSV values (PASS/FAIL/NOT_APPLICABLE) → (YES/NO/N/A)
    conditions = {}
    for csv_col, fs_key in CONDITION_COLS.items():
        raw = safe_str(row.get(csv_col, ""), "N/A").strip().upper()
        conditions[fs_key] = CONDITION_VALUE_MAP.get(raw, raw)

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
        "boss_id": safe_str(row.get("MST direct boss name", "")).replace(".0", ""),
        "boss_name": safe_str(row.get("direct boss name", "")),
        "entrance_date": safe_str(row.get("Entrance Date", "")),
        "stop_working_date": safe_str(row.get("Stop working Date", "")),

        "conditions": conditions,
        "condition_values": condition_values,
        "conditions_applicable": safe_int(row.get("conditions_applicable")),
        "conditions_passed": safe_int(row.get("conditions_passed")),
        "conditions_pass_rate": safe_float(row.get("conditions_pass_rate")),

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

        # AQL Inspector 3-Part breakdown (if available)
        "aql_part2_amount": safe_float(row.get("AQL_Part2_Amount")),
        "aql_part3_amount": safe_float(row.get("AQL_Part3_Amount")),
        "aql_part3_months": safe_int(row.get("AQL_Part3_Months")),
        "cfa_certified": safe_str(row.get("CFA_Certified", ""), "N"),
    }

    return employee


# ---------------------------------------------------------------------------
# Transform: DataFrame -> dashboard summary
# ---------------------------------------------------------------------------

def build_calendar_data(month: str, year: int) -> dict:
    """출근 CSV에서 캘린더 데이터 생성

    원본 출근 파일에서 근무일 날짜 목록과 날짜별 출근 인원수를 추출한다.

    Args:
        month: 월 이름 (lowercase, e.g. "february")
        year: 연도 (e.g. 2026)

    Returns:
        dict: calendar_data 또는 None (파일 없을 때)
    """
    # 월 이름 → 숫자
    month_names = {
        "january": 1, "february": 2, "march": 3, "april": 4,
        "may": 5, "june": 6, "july": 7, "august": 8,
        "september": 9, "october": 10, "november": 11, "december": 12
    }
    month_num = month_names.get(month)
    if not month_num:
        print(f"  ⚠️ 캘린더: 알 수 없는 월 이름 '{month}'")
        return None

    # 원본 출근 CSV 찾기
    attendance_dir = "input_files/attendance/original"
    attendance_file = os.path.join(attendance_dir, f"attendance data {month}.csv")
    if not os.path.exists(attendance_file):
        print(f"  ⚠️ 캘린더: 출근 파일 없음 — {attendance_file}")
        return None

    try:
        att_df = pd.read_csv(attendance_file, encoding="utf-8-sig")
    except Exception as e:
        print(f"  ⚠️ 캘린더: 출근 파일 읽기 실패 — {e}")
        return None

    if "Work Date" not in att_df.columns:
        print("  ⚠️ 캘린더: 'Work Date' 컬럼 없음")
        return None

    # Work Date 파싱 (형식: "2026.02.02")
    att_df["_parsed_date"] = pd.to_datetime(att_df["Work Date"], errors="coerce")
    valid = att_df["_parsed_date"].notna()
    att_df = att_df[valid].copy()

    # 해당 월 데이터만 필터
    att_df = att_df[
        (att_df["_parsed_date"].dt.month == month_num) &
        (att_df["_parsed_date"].dt.year == year)
    ]

    if att_df.empty:
        print(f"  ⚠️ 캘린더: {month.capitalize()} {year} 데이터 없음")
        return None

    # 날짜(일)별 출근 인원 카운트 (Personnel Number 기준 고유 직원 수)
    att_df["_day"] = att_df["_parsed_date"].dt.day
    if "Personnel Number" in att_df.columns:
        daily = att_df.groupby("_day")["Personnel Number"].nunique()
    else:
        daily = att_df.groupby("_day").size()

    working_day_dates = sorted(daily.index.tolist())
    daily_counts = {str(day): int(count) for day, count in daily.items()}
    days_in_month = calendar.monthrange(year, month_num)[1]

    # 각 날짜의 요일 (0=월, 1=화, ..., 6=일)
    weekday_indices = []
    for day in range(1, days_in_month + 1):
        weekday_indices.append(calendar.weekday(year, month_num, day))

    cal_data = {
        "working_day_dates": working_day_dates,
        "daily_counts": daily_counts,
        "days_in_month": days_in_month,
        "total_working_days": len(working_day_dates),
        "weekday_indices": weekday_indices,
    }

    print(f"  📅 캘린더: {len(working_day_dates)}일 근무 / {days_in_month}일 총")
    return cal_data


def build_summary(df: pd.DataFrame, month: str, year: int, working_days: int,
                  calendar_data: dict = None) -> dict:
    """계산 결과 DataFrame에서 대시보드 요약 생성

    Args:
        df: 전체 employee DataFrame
        month: 월 이름 (lowercase)
        year: 연도
        working_days: 총 근무일
        calendar_data: 캘린더 데이터 (optional)

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

    # Condition 통계 (c1 ~ c10) — CSV uses PASS/FAIL/NOT_APPLICABLE
    condition_stats = {}
    for csv_col, fs_key in CONDITION_COLS.items():
        i = fs_key.replace("c", "")  # "c1" -> "1"
        if csv_col in df.columns:
            values = df[csv_col].astype(str).str.strip().str.upper()
            condition_stats[f"c{i}_pass"] = int((values == "PASS").sum())
            condition_stats[f"c{i}_fail"] = int((values == "FAIL").sum())
            condition_stats[f"c{i}_na"] = int((values == "NOT_APPLICABLE").sum())
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

    now_iso = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

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

    # 캘린더 데이터 포함 (있으면)
    if calendar_data:
        summary["calendar_data"] = calendar_data

    # 임시 컬럼 제거
    df.drop(columns=["_incentive"], inplace=True, errors="ignore")

    return summary


# ---------------------------------------------------------------------------
# Upload to Firestore
# ---------------------------------------------------------------------------

def reapply_allowances(db, month_year: str):
    """파이프라인 재업로드 후 활성 allowances를 자동 재적용

    Args:
        db: Firestore client
        month_year: 문서 ID (e.g. "february_2026")
    """
    print(f"\n🔄 Step 6.5: Allowance 재적용 확인")

    try:
        items_ref = db.collection("allowances").document(month_year).collection("items")
        active_docs = items_ref.where("status", "==", "APPLIED").stream()
        active_list = list(active_docs)

        if not active_list:
            print(f"   활성 allowance 없음 — 건너뜀")
            return

        print(f"   활성 allowance {len(active_list)}건 발견 — 재적용 시작")

        # Load employee data
        emp_ref = db.collection("employees").document(month_year).collection("all_data").document("data")
        emp_doc = emp_ref.get()
        if not emp_doc.exists:
            print(f"   ⚠️ 직원 데이터 없음 — allowance 재적용 건너뜀")
            return

        data = emp_doc.to_dict()
        employees = data.get("employees", [])
        emp_map = {}
        for i, emp in enumerate(employees):
            emp_no = str(emp.get("emp_no", emp.get("Employee No", "")))
            emp_map[emp_no] = i

        modified = False
        for adoc in active_list:
            allow = adoc.to_dict()
            emp_no = allow.get("employeeNo", "")
            conditions = allow.get("conditions", [])
            overridden = allow.get("overriddenValues", {})

            if emp_no not in emp_map:
                print(f"   ⚠️ {emp_no} 직원 없음 — 건너뜀")
                continue

            idx = emp_map[emp_no]
            emp = employees[idx]

            # Override conditions
            if "conditions" not in emp:
                emp["conditions"] = {}
            for cond in conditions:
                emp["conditions"][cond] = "YES"

            emp["conditions_passed"] = overridden.get("conditions_passed", emp.get("conditions_passed", 0))
            emp["conditions_pass_rate"] = overridden.get("conditions_pass_rate", emp.get("conditions_pass_rate", 0))
            emp["current_incentive"] = overridden.get("incentive_amount", emp.get("current_incentive", 0))
            emp["allowance_applied"] = True
            emp["allowance_conditions"] = conditions

            employees[idx] = emp
            modified = True
            print(f"   ✅ {emp_no} ({emp.get('full_name', '--')}) — {', '.join(c.upper() for c in conditions)} 재적용")

        if modified:
            from datetime import datetime, timezone
            data["employees"] = employees
            data["meta"]["updated_at"] = datetime.now(timezone.utc).isoformat() + "Z"
            emp_ref.set(data)
            print(f"   ✅ 직원 데이터 업데이트 완료 (allowance 재적용)")

            # Recalculate summary
            sum_ref = db.collection("dashboard_summary").document(month_year)
            sum_doc = sum_ref.get()
            if sum_doc.exists:
                summary = sum_doc.to_dict()
                total = len(employees)
                receiving = sum(1 for e in employees if float(e.get("current_incentive", 0) or 0) > 0)
                total_inc = sum(float(e.get("current_incentive", 0) or 0) for e in employees)
                summary["receiving_employees"] = receiving
                summary["total_incentive"] = total_inc
                summary["payment_rate"] = (receiving / total * 100) if total > 0 else 0
                summary["data_updated_at"] = datetime.now(timezone.utc).isoformat() + "Z"
                sum_ref.set(summary, merge=True)
                print(f"   ✅ 대시보드 요약 재계산 완료")

    except Exception as e:
        print(f"   ⚠️ Allowance 재적용 오류 (비치명적): {e}")


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
            "updated_at": datetime.now(timezone.utc).isoformat() + "Z",
            "month": month_year.split("_")[0],
            "year": int(month_year.split("_")[1]),
        }
    }

    # Firestore 문서 크기 제한: 1MB
    # 540명 직원 * ~1KB/직원 = ~540KB (안전 범위)
    estimated_size_kb = len(json.dumps(doc_data, ensure_ascii=False).encode("utf-8")) / 1024
    print(f"   예상 문서 크기: {estimated_size_kb:.1f} KB")

    if estimated_size_kb > 1024:
        print(f"❌ 문서 크기가 1MB 초과 ({estimated_size_kb:.1f}KB) - Firestore 제한 위반. 업로드 중단.")
        raise ValueError(f"Firestore 문서 크기 제한 초과: {estimated_size_kb:.1f}KB > 1024KB")
    elif estimated_size_kb > 900:
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
    try:
        doc_ref.set(doc_data)
        print(f"✅ employees/{month_year}/all_data 업로드 완료 ({len(employees)}명)")
    except Exception as e:
        print(f"❌ employees/{month_year}/all_data 업로드 실패: {e}")
        raise


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
    try:
        doc_ref.set(summary)
        print(f"✅ dashboard_summary/{month_year} 업로드 완료")
    except Exception as e:
        print(f"❌ dashboard_summary/{month_year} 업로드 실패: {e}")
        raise


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

    # 1.5. 퇴사자 필터링 (계산월 시작일 이전 퇴사자 제외)
    print(f"\n🔍 Step 1.5: 퇴사자 필터링")
    total_before = len(df)
    if "Stop working Date" in df.columns:
        # 월 시작일 계산
        month_names = {
            "january": 1, "february": 2, "march": 3, "april": 4,
            "may": 5, "june": 6, "july": 7, "august": 8,
            "september": 9, "october": 10, "november": 11, "december": 12
        }
        month_num = month_names.get(month, 1)
        month_start = pd.Timestamp(year=year, month=month_num, day=1)

        # Stop working Date가 비어있으면 재직 중
        swd = df["Stop working Date"].copy()
        swd_parsed = pd.to_datetime(swd, errors="coerce")

        # 퇴사일이 있고 계산월 시작일 이전인 직원 제외
        resigned_before = swd_parsed.notna() & (swd_parsed < month_start)
        resigned_count = resigned_before.sum()
        df = df[~resigned_before].reset_index(drop=True)
        print(f"   전체: {total_before}명 → 퇴사자 {resigned_count}명 제외 → 활성: {len(df)}명")
    else:
        print(f"   Stop working Date 컬럼 없음 — 필터링 건너뜀 ({total_before}명 유지)")

    # 2. Firebase 초기화
    print("\n🔑 Step 2: Firebase 초기화")
    if dry_run:
        print("🔸 [DRY-RUN] Firestore 초기화 건너뜀 (dry-run 모드)")
        db = None
    else:
        db = init_firestore()

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

    # 4. Working days 추출 (config 우선, CSV fallback)
    working_days = 0
    config_path = f"config_files/config_{month}_{year}.json"
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
            working_days = config.get("working_days", 0)
            print(f"   총 근무일: {working_days} (config 파일)")
        except Exception:
            pass
    if working_days == 0 and "Total Working Days" in df.columns:
        working_days = safe_int(df["Total Working Days"].dropna().iloc[0] if len(df) > 0 else 0)
        print(f"   총 근무일: {working_days} (CSV fallback)")

    # 4.5. 캘린더 데이터 생성
    print(f"\n📅 Step 4.5: 캘린더 데이터 생성")
    calendar_data = build_calendar_data(month, year)

    # 5. 요약 데이터 생성
    print(f"\n📊 Step 5: 대시보드 요약 생성")
    summary = build_summary(df, month, year, working_days, calendar_data=calendar_data)

    # 6. Firestore 업로드
    print(f"\n☁️  Step 5: Firestore 업로드")
    print(f"   Uploading {len(employees)} employees to Firestore...")

    upload_employees(db, month_year, employees, dry_run=dry_run)
    upload_summary(db, month_year, summary, dry_run=dry_run)

    # 6.5. Re-apply active allowances if any exist
    if not dry_run:
        reapply_allowances(db, month_year)

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
