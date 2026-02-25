#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Firestore Thresholds 동기화 스크립트 - Admin 페이지 임계값 설정을 로컬 Config에 반영

Admin 페이지에서 변경된 threshold 값을 Firestore에서 읽어 로컬 config JSON에 반영합니다.
이를 통해 admin threshold 변경 → 계산 파이프라인으로 자연스럽게 흐릅니다.

Usage:
    python scripts/sync_thresholds.py --month february --year 2026
    python scripts/sync_thresholds.py --month february --year 2026 --dry-run

Authentication:
    1. FIREBASE_SERVICE_ACCOUNT 환경변수 (JSON 문자열)
    2. Fallback: /Users/ksmoon/Downloads/qip-dashboard-dabdc4d51ac9.json
"""

import os
import sys
import json
import argparse
from datetime import datetime
from typing import Dict, List, Optional, Tuple


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

# 대상 Firebase 프로젝트 ID (서비스 계정과 Firestore 프로젝트가 다름)
TARGET_FIREBASE_PROJECT = "hwk-qip-incentive-dashboard"

# Default thresholds (Issue #60 참조: 기본 정책 값)
DEFAULT_THRESHOLDS = {
    "attendance_rate": 88,
    "unapproved_absence": 2,
    "minimum_working_days": 12,
    "area_reject_rate": 3.0,
    "5prs_pass_rate": 95,
    "5prs_min_qty": 100,
    "consecutive_aql_months": 3,
}

# Firestore에서 읽을 threshold 키 목록 (Firestore 문서 → 로컬 config 매핑)
THRESHOLD_KEYS = [
    "attendance_rate",
    "unapproved_absence",
    "minimum_working_days",
    "area_reject_rate",
    "5prs_pass_rate",
    "5prs_min_qty",
    "consecutive_aql_months",
]


# ---------------------------------------------------------------------------
# Firebase initialisation (upload_to_firestore.py 패턴 재사용)
# ---------------------------------------------------------------------------

def init_firestore(dry_run=False):
    """Firebase Admin SDK 초기화 및 Firestore 클라이언트 반환

    Args:
        dry_run: True이면 실제 연결도 수행 (읽기 전용이므로)

    Returns:
        Firestore client 또는 None (인증 실패 시)
    """
    # 이미 초기화된 경우 기존 앱 사용
    if firebase_admin._apps:
        print("  Firebase 이미 초기화됨 - 기존 앱 사용")
        return firestore.client()

    # Firebase 앱 초기화 옵션 — 대상 프로젝트 명시
    app_options = {"projectId": TARGET_FIREBASE_PROJECT}

    # 1) 환경변수에서 서비스 계정 정보 로드
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "")
    if sa_json:
        try:
            sa_info = json.loads(sa_json)
            cred = credentials.Certificate(sa_info)
            firebase_admin.initialize_app(cred, app_options)
            print(f"  Firebase 초기화 성공 (환경변수 → {TARGET_FIREBASE_PROJECT})")
            return firestore.client()
        except Exception as e:
            print(f"  환경변수 인증 실패: {e}")
            print("  로컬 파일로 fallback 시도...")

    # 2) 로컬 서비스 계정 파일
    if os.path.exists(LOCAL_SERVICE_ACCOUNT_PATH):
        try:
            cred = credentials.Certificate(LOCAL_SERVICE_ACCOUNT_PATH)
            firebase_admin.initialize_app(cred, app_options)
            print(f"  Firebase 초기화 성공 (로컬 파일 → {TARGET_FIREBASE_PROJECT})")
            return firestore.client()
        except Exception as e:
            print(f"  로컬 파일 인증 실패: {e}")
            return None
    else:
        print(f"  서비스 계정 파일 없음: {LOCAL_SERVICE_ACCOUNT_PATH}")
        print("  FIREBASE_SERVICE_ACCOUNT 환경변수를 설정하거나 로컬 파일을 배치하세요.")
        return None


# ---------------------------------------------------------------------------
# Firestore read
# ---------------------------------------------------------------------------

def read_firestore_thresholds(db, month_year: str) -> Optional[dict]:
    """Firestore에서 thresholds 문서 읽기

    Args:
        db: Firestore client
        month_year: 문서 ID (e.g. "february_2026")

    Returns:
        dict: threshold 값 또는 None (문서 없음)
    """
    try:
        doc_ref = db.collection("thresholds").document(month_year)
        doc = doc_ref.get()

        if not doc.exists:
            return None

        data = doc.to_dict()
        # threshold 키만 추출 (updated_at, updated_by 등 메타 필드 제외)
        thresholds = {}
        for key in THRESHOLD_KEYS:
            if key in data:
                thresholds[key] = data[key]

        return thresholds

    except Exception as e:
        print(f"  Firestore 읽기 오류: {e}")
        return None


# ---------------------------------------------------------------------------
# Local config read/write
# ---------------------------------------------------------------------------

def read_local_config(config_path: str) -> dict:
    """로컬 config JSON 파일 읽기

    Args:
        config_path: config 파일 경로

    Returns:
        dict: config 내용 또는 빈 dict
    """
    if not os.path.exists(config_path):
        return {}

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"  config 파일 읽기 오류: {e}")
        return {}


def write_local_config(config_path: str, config: dict):
    """로컬 config JSON 파일 쓰기

    Args:
        config_path: config 파일 경로
        config: 저장할 config dict
    """
    # config_files 디렉토리가 없으면 생성
    os.makedirs(os.path.dirname(config_path), exist_ok=True)

    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Threshold comparison and merge
# ---------------------------------------------------------------------------

def compare_thresholds(current: dict, incoming: dict) -> list:
    """현재 threshold와 새 threshold 비교

    Args:
        current: 현재 config의 thresholds 섹션
        incoming: Firestore에서 읽은 thresholds

    Returns:
        list of (key, old_value, new_value) 튜플 (변경된 항목만)
    """
    changes = []
    for key in THRESHOLD_KEYS:
        old_val = current.get(key)
        new_val = incoming.get(key)

        if new_val is None:
            continue

        # 타입 정규화 (int/float 비교)
        if old_val is not None:
            # 두 값이 다를 때만 변경으로 기록
            if isinstance(new_val, float) or isinstance(old_val, float):
                if float(old_val) != float(new_val):
                    changes.append((key, old_val, new_val))
            else:
                if old_val != new_val:
                    changes.append((key, old_val, new_val))
        else:
            # 기존 값이 없으면 새로 추가
            changes.append((key, None, new_val))

    return changes


def merge_thresholds(config: dict, thresholds: dict) -> dict:
    """config에 thresholds 섹션 병합 (다른 키는 보존)

    Args:
        config: 전체 config dict
        thresholds: 새 threshold 값

    Returns:
        dict: 병합된 config
    """
    if "thresholds" not in config:
        config["thresholds"] = {}

    for key in THRESHOLD_KEYS:
        if key in thresholds:
            config["thresholds"][key] = thresholds[key]

    # 동기화 메타 정보 추가
    config["thresholds_synced_at"] = datetime.utcnow().isoformat() + "Z"
    config["thresholds_source"] = "firestore"

    return config


# ---------------------------------------------------------------------------
# Display helpers
# ---------------------------------------------------------------------------

def print_threshold_table(thresholds: dict, label: str):
    """threshold 값을 테이블 형태로 출력"""
    print(f"\n  [{label}]")
    print(f"  {'Key':<30} {'Value':>10}")
    print(f"  {'-' * 30} {'-' * 10}")
    for key in THRESHOLD_KEYS:
        val = thresholds.get(key, "-")
        print(f"  {key:<30} {str(val):>10}")


def print_changes(changes: list):
    """변경 사항을 테이블 형태로 출력"""
    if not changes:
        print("\n  변경 사항 없음 - 모든 threshold 값이 동일합니다.")
        return

    print(f"\n  {'Key':<30} {'Before':>10} {'':>3} {'After':>10}")
    print(f"  {'-' * 30} {'-' * 10} {'':>3} {'-' * 10}")
    for key, old_val, new_val in changes:
        old_str = str(old_val) if old_val is not None else "(없음)"
        new_str = str(new_val)
        print(f"  {key:<30} {old_str:>10} -> {new_str:>10}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Firestore thresholds를 로컬 config JSON에 동기화"
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
        help="테스트 모드 - 변경 사항만 출력하고 파일에 쓰지 않음"
    )
    args = parser.parse_args()

    month = args.month.lower().strip()
    year = args.year
    month_year = f"{month}_{year}"
    month_capitalized = month.capitalize()
    dry_run = args.dry_run

    config_path = f"config_files/config_{month}_{year}.json"

    print("=" * 60)
    print(f"  Firestore Thresholds Sync")
    print(f"  Month/Year: {month_capitalized} {year}")
    print(f"  Firestore Doc: thresholds/{month_year}")
    print(f"  Local Config: {config_path}")
    if dry_run:
        print(f"  Mode: DRY-RUN (파일 변경 안 함)")
    else:
        print(f"  Mode: LIVE (config 파일 업데이트)")
    print("=" * 60)

    # -----------------------------------------------------------------------
    # Step 1: Firebase 초기화 및 Firestore 읽기
    # -----------------------------------------------------------------------
    print("\n[Step 1] Firestore에서 thresholds 읽기")

    db = init_firestore(dry_run=False)  # dry-run이어도 읽기는 필요
    if db is None:
        print("  Firebase 초기화 실패 - 기본값(defaults) 사용")
        firestore_thresholds = None
    else:
        firestore_thresholds = read_firestore_thresholds(db, month_year)

    if firestore_thresholds is None:
        print(f"  Firestore 문서 없음: thresholds/{month_year}")
        print(f"  기본값(defaults) 사용:")
        firestore_thresholds = DEFAULT_THRESHOLDS.copy()
        print_threshold_table(firestore_thresholds, "Defaults")
        source_label = "defaults"
    else:
        print(f"  Firestore 문서 읽기 성공: thresholds/{month_year}")
        # Firestore에 없는 키는 default로 보충
        for key in THRESHOLD_KEYS:
            if key not in firestore_thresholds:
                firestore_thresholds[key] = DEFAULT_THRESHOLDS[key]
                print(f"    {key}: Firestore에 없음 -> default {DEFAULT_THRESHOLDS[key]} 사용")
        print_threshold_table(firestore_thresholds, "Firestore")
        source_label = "firestore"

    # -----------------------------------------------------------------------
    # Step 2: 로컬 config 읽기
    # -----------------------------------------------------------------------
    print(f"\n[Step 2] 로컬 config 읽기: {config_path}")

    config = read_local_config(config_path)
    config_exists = bool(config)

    if config_exists:
        current_thresholds = config.get("thresholds", {})
        print(f"  Config 파일 존재 (키 {len(config)}개)")
        if current_thresholds:
            print_threshold_table(current_thresholds, "Current Config Thresholds")
        else:
            print("  thresholds 섹션 없음 (신규 추가 예정)")
    else:
        current_thresholds = {}
        print(f"  Config 파일 없음 - 최소 config 생성 예정")

    # -----------------------------------------------------------------------
    # Step 3: 비교 및 변경 사항 확인
    # -----------------------------------------------------------------------
    print(f"\n[Step 3] 변경 사항 비교")
    changes = compare_thresholds(current_thresholds, firestore_thresholds)
    print_changes(changes)

    # -----------------------------------------------------------------------
    # Step 4: config 업데이트 (또는 dry-run 출력)
    # -----------------------------------------------------------------------
    if not changes:
        print(f"\n[Step 4] 변경 사항 없음 - 완료")
        print("=" * 60)
        print("  Sync 완료: 변경 없음")
        print("=" * 60)
        return

    print(f"\n[Step 4] Config 업데이트 ({len(changes)}개 변경)")

    if not config_exists:
        # 새 config 파일 생성 (최소 구조)
        config = {
            "year": year,
            "month": month,
        }
        print(f"  최소 config 생성: year={year}, month={month}")

    config = merge_thresholds(config, firestore_thresholds)

    if dry_run:
        print(f"\n  [DRY-RUN] 파일에 쓰지 않음")
        print(f"  적용될 thresholds:")
        print_threshold_table(config["thresholds"], "After Sync")
        print(f"\n  실제 적용: --dry-run 플래그를 제거하고 다시 실행하세요.")
    else:
        write_local_config(config_path, config)
        print(f"  Config 파일 업데이트 완료: {config_path}")
        print_threshold_table(config["thresholds"], "After Sync")

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    print("\n" + "=" * 60)
    mode_label = "DRY-RUN" if dry_run else "LIVE"
    print(f"  Sync 완료 [{mode_label}]")
    print(f"  Source: {source_label}")
    print(f"  Changes: {len(changes)}개")
    for key, old_val, new_val in changes:
        old_str = str(old_val) if old_val is not None else "(없음)"
        print(f"    {key}: {old_str} -> {new_val}")
    print("=" * 60)


if __name__ == "__main__":
    main()
