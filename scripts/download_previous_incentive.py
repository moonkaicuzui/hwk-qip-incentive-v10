#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Firestore에서 이전 월 인센티브 데이터 다운로드 → CSV 생성

CI 파이프라인에서 output_files/가 gitignored되어 이전 월 인센티브 파일이 없음.
이 스크립트가 Firestore에서 데이터를 읽어 CSV를 재구성하여
step1_인센티브_계산.py의 _load_previous_incentive_early()가 정상 동작하도록 함.

Usage:
    python scripts/download_previous_incentive.py --month february --year 2026

    → Firestore employees/january_2026/all_data 읽기
    → output_files/output_QIP_incentive_january_2026_Complete_V10.0_Complete.csv 생성
"""

import os
import sys
import json
import argparse
from datetime import datetime

import pandas as pd

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("firebase-admin 패키지가 설치되지 않았습니다.")
    print("설치: pip install firebase-admin")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LOCAL_SERVICE_ACCOUNT_PATH = "/Users/ksmoon/Downloads/qip-dashboard-dabdc4d51ac9.json"
TARGET_FIREBASE_PROJECT = "hwk-qip-incentive-dashboard"

MONTHS = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
]


# ---------------------------------------------------------------------------
# Firebase initialisation (upload_to_firestore.py와 동일 패턴)
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
            print(f"✅ Firebase 초기화 성공 (환경변수 → {TARGET_FIREBASE_PROJECT})")
            return firestore.client()
        except Exception as e:
            print(f"⚠️ 환경변수 인증 실패: {e}")

    # 2) 로컬 서비스 계정 파일
    if os.path.exists(LOCAL_SERVICE_ACCOUNT_PATH):
        try:
            cred = credentials.Certificate(LOCAL_SERVICE_ACCOUNT_PATH)
            firebase_admin.initialize_app(cred, app_options)
            print(f"✅ Firebase 초기화 성공 (로컬 파일 → {TARGET_FIREBASE_PROJECT})")
            return firestore.client()
        except Exception as e:
            print(f"❌ 로컬 파일 인증 실패: {e}")
            sys.exit(1)
    else:
        print(f"❌ 서비스 계정 없음. FIREBASE_SERVICE_ACCOUNT 환경변수를 설정하세요.")
        sys.exit(1)


# ---------------------------------------------------------------------------
# Previous month calculation
# ---------------------------------------------------------------------------

def get_previous_month(target_month: str, target_year: int) -> tuple:
    """계산 대상 월에서 이전 월/연도 계산

    Args:
        target_month: 계산 대상 월 (e.g. "february")
        target_year: 계산 대상 연도 (e.g. 2026)

    Returns:
        (prev_month, prev_year) 튜플
    """
    idx = MONTHS.index(target_month)
    prev_idx = (idx - 1) % 12
    prev_month = MONTHS[prev_idx]
    prev_year = target_year if prev_idx < idx else target_year - 1
    return prev_month, prev_year


# ---------------------------------------------------------------------------
# Firestore → CSV
# ---------------------------------------------------------------------------

def download_and_create_csv(db, prev_month: str, prev_year: int) -> str:
    """Firestore에서 이전 월 직원 데이터를 읽어 CSV 생성

    Args:
        db: Firestore client
        prev_month: 이전 월 이름 (e.g. "january")
        prev_year: 이전 연도 (e.g. 2026)

    Returns:
        생성된 CSV 파일 경로
    """
    month_year = f"{prev_month}_{prev_year}"
    prev_month_cap = prev_month.capitalize()

    print(f"\n📥 Firestore에서 데이터 로드: employees/{month_year}/all_data/data")

    # Firestore 문서 읽기
    doc_ref = db.collection("employees").document(month_year).collection("all_data").document("data")
    doc = doc_ref.get()

    if not doc.exists:
        print(f"⚠️ Firestore에 {month_year} 데이터가 없습니다.")
        print(f"   이전 월 인센티브가 계산되지 않았을 수 있습니다.")
        print(f"   기존 fallback 로직(Previous_Incentive=0)이 적용됩니다.")
        sys.exit(0)  # 정상 종료 - 기존 fallback이 처리

    data = doc.to_dict()
    employees = data.get("employees", [])

    if not employees:
        print(f"⚠️ {month_year} 직원 데이터가 비어있습니다.")
        sys.exit(0)

    print(f"   {len(employees)}명 직원 데이터 로드 완료")

    # Firestore 데이터 → CSV 행 변환
    # _load_previous_incentive_early()가 필요로 하는 컬럼:
    #   - Employee No: 직원 번호 (매핑 키)
    #   - {Month}_Incentive 또는 Final Incentive amount: 인센티브 금액
    #   - Continuous_Months: 연속 수령 개월 수
    # _find_previous_month_csv()가 필요로 하는 추가 컬럼:
    #   - ROLE TYPE STD: TYPE-1/2/3
    #   - QIP POSITION 1ST  NAME: 직급명
    #   - Full Name: 이름
    rows = []
    for emp in employees:
        row = {
            "Employee No": emp.get("emp_no", ""),
            "Full Name": emp.get("full_name", ""),
            "ROLE TYPE STD": emp.get("type", ""),
            "QIP POSITION 1ST  NAME": emp.get("position", ""),
            "BUILDING": emp.get("building", ""),
            "Final Incentive amount": emp.get("current_incentive", 0),
            f"{prev_month_cap}_Incentive": emp.get("current_incentive", 0),
            "Continuous_Months": emp.get("continuous_months", 0),
            "Previous_Continuous_Months": emp.get("previous_continuous_months", 0),
        }
        rows.append(row)

    df = pd.DataFrame(rows)

    # 출력 경로
    os.makedirs("output_files", exist_ok=True)
    output_path = f"output_files/output_QIP_incentive_{prev_month}_{prev_year}_Complete_V10.0_Complete.csv"

    df.to_csv(output_path, index=False, encoding="utf-8-sig")
    print(f"\n✅ CSV 생성 완료: {output_path}")
    print(f"   직원 수: {len(df)}")

    # 검증 출력
    incentive_col = "Final Incentive amount"
    receiving = df[df[incentive_col] > 0]
    total = df[incentive_col].sum()
    cont_months = df[df["Continuous_Months"] > 0]

    print(f"   인센티브 수령: {len(receiving)}명")
    print(f"   총 인센티브: {total:,.0f} VND")
    print(f"   Continuous_Months > 0: {len(cont_months)}명")

    return output_path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Firestore에서 이전 월 인센티브 데이터를 다운로드하여 CSV 생성"
    )
    parser.add_argument(
        "--month", required=True,
        help="계산 대상 월 (e.g. february) - 이전 월 데이터를 다운로드"
    )
    parser.add_argument(
        "--year", required=True, type=int,
        help="계산 대상 연도 (e.g. 2026)"
    )
    args = parser.parse_args()

    target_month = args.month.lower().strip()
    target_year = args.year

    if target_month not in MONTHS:
        print(f"❌ 잘못된 월 이름: {target_month}")
        sys.exit(1)

    # 이전 월 계산
    prev_month, prev_year = get_previous_month(target_month, target_year)

    print("=" * 60)
    print(f"📥 Previous Incentive Download from Firestore")
    print(f"   계산 대상: {target_month.capitalize()} {target_year}")
    print(f"   다운로드 대상 (이전 월): {prev_month.capitalize()} {prev_year}")
    print("=" * 60)

    # 이미 파일이 존재하면 스킵
    output_path = f"output_files/output_QIP_incentive_{prev_month}_{prev_year}_Complete_V10.0_Complete.csv"
    if os.path.exists(output_path):
        df = pd.read_csv(output_path, encoding="utf-8-sig")
        print(f"ℹ️ 이전 월 파일이 이미 존재합니다: {output_path}")
        print(f"   {len(df)}행 — 다운로드 건너뜀")
        return

    # Firebase 초기화
    db = init_firestore()

    # Firestore → CSV
    download_and_create_csv(db, prev_month, prev_year)

    print(f"\n✅ 완료! step1_인센티브_계산.py가 이 파일을 Previous_Incentive로 사용합니다.")


if __name__ == "__main__":
    main()
