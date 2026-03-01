#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Firestore 설정 동기화 스크립트 - Admin 페이지 설정을 로컬 JSON 파일로 동기화

Firestore configs/ 컬렉션의 설정을 로컬 config_files/ 디렉토리로 다운로드합니다.
이를 통해 Admin 페이지 설정 변경 → 계산 파이프라인으로 반영됩니다.

동기화 대상:
  - configs/type2_position_mapping → config_files/type2_position_mapping.json
  - configs/talent_pool           → config_files/qip_talent_pool.json
  - configs/auditor_area_mapping  → config_files/auditor_trainer_area_mapping.json

Usage:
    python scripts/sync_configs.py
    python scripts/sync_configs.py --dry-run

Authentication:
    1. FIREBASE_SERVICE_ACCOUNT 환경변수 (JSON 문자열)
    2. Fallback: /Users/ksmoon/Downloads/qip-dashboard-dabdc4d51ac9.json
"""

import os
import sys
import json
import argparse
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


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LOCAL_SERVICE_ACCOUNT_PATH = "/Users/ksmoon/Downloads/qip-dashboard-dabdc4d51ac9.json"
TARGET_FIREBASE_PROJECT = "hwk-qip-incentive-dashboard"

# Firestore doc → local file mapping
# Note: continuous_months is NOT synced (it's read-only reference data)
SYNC_MAPPINGS = [
    {
        "firestore_doc": "configs/type2_position_mapping",
        "local_path": "config_files/type2_position_mapping.json",
        "description": "TYPE-2 직급 매핑"
    },
    {
        "firestore_doc": "configs/talent_pool",
        "local_path": "config_files/qip_talent_pool.json",
        "description": "QIP Talent Pool"
    },
    {
        "firestore_doc": "configs/auditor_area_mapping",
        "local_path": "config_files/auditor_trainer_area_mapping.json",
        "description": "Auditor/Trainer 구역 매핑"
    },
]

# Metadata keys to strip from Firestore data before saving locally
METADATA_KEYS = ["_metadata"]


def init_firebase():
    """Initialize Firebase Admin SDK."""
    if firebase_admin._apps:
        return firestore.client()

    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "")

    if sa_json:
        sa_dict = json.loads(sa_json)
        cred = credentials.Certificate(sa_dict)
    elif os.path.exists(LOCAL_SERVICE_ACCOUNT_PATH):
        cred = credentials.Certificate(LOCAL_SERVICE_ACCOUNT_PATH)
    else:
        print("❌ Firebase 서비스 계정을 찾을 수 없습니다.")
        sys.exit(1)

    firebase_admin.initialize_app(cred, {
        "projectId": TARGET_FIREBASE_PROJECT
    })
    return firestore.client()


def strip_metadata(data):
    """Remove Firestore metadata fields from data."""
    if not isinstance(data, dict):
        return data
    return {k: v for k, v in data.items() if k not in METADATA_KEYS}


def sync_config(db, mapping, dry_run=False):
    """Sync a single config from Firestore to local JSON."""
    firestore_doc = mapping["firestore_doc"]
    local_path = mapping["local_path"]
    description = mapping["description"]

    print(f"\n  {description}")
    print(f"    Firestore: {firestore_doc}")
    print(f"    Local:     {local_path}")

    # Parse collection/document
    parts = firestore_doc.split("/")
    collection = parts[0]
    doc_id = parts[1]

    try:
        doc = db.collection(collection).document(doc_id).get()
    except Exception as e:
        print(f"    ⚠️ Firestore 읽기 실패: {e}")
        return False

    if not doc.exists:
        print(f"    ⚠️ Firestore 문서 없음 - 건너뜀 (로컬 파일 유지)")
        return False

    data = doc.to_dict()
    clean_data = strip_metadata(data)

    if dry_run:
        print(f"    [DRY RUN] {len(json.dumps(clean_data, ensure_ascii=False))} bytes 다운로드 예정")
        print(f"    Top-level keys: {list(clean_data.keys())}")
        return True

    # Ensure directory exists
    os.makedirs(os.path.dirname(local_path), exist_ok=True)

    with open(local_path, "w", encoding="utf-8") as f:
        json.dump(clean_data, f, ensure_ascii=False, indent=2)

    print(f"    ✅ 동기화 완료")
    return True


def main():
    parser = argparse.ArgumentParser(description="Firestore 설정 → 로컬 JSON 동기화")
    parser.add_argument("--dry-run", action="store_true", help="실제 파일 쓰기 없이 확인만")
    args = parser.parse_args()

    print("=" * 60)
    print("  Firestore 설정 동기화")
    print(f"  모드: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"  시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    db = init_firebase()

    success_count = 0
    for mapping in SYNC_MAPPINGS:
        if sync_config(db, mapping, dry_run=args.dry_run):
            success_count += 1

    print(f"\n{'='*60}")
    print(f"  완료: {success_count}/{len(SYNC_MAPPINGS)} 설정 동기화")
    print("=" * 60)


if __name__ == "__main__":
    main()
