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
from datetime import datetime, timezone

# Add project root to path for utils import
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from scripts.utils.firebase_common import init_firestore

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
    {
        "firestore_doc": "configs/position_condition_matrix",
        "local_path": "config_files/position_condition_matrix.json",
        "description": "Position Condition Matrix (merge)",
        "merge_mode": True,
        "merge_keys": ["position_matrix", "incentive_progression", "type_2_multipliers"]
    },
]

# Metadata keys to strip from Firestore data before saving locally
METADATA_KEYS = ["_metadata"]


def strip_metadata(data):
    """Remove Firestore metadata fields from data."""
    if not isinstance(data, dict):
        return data
    return {k: v for k, v in data.items() if k not in METADATA_KEYS}


def sync_config(db, mapping, dry_run=False):
    """Sync a single config from Firestore to local JSON.

    If merge_mode is True, only merge_keys sections from Firestore
    overwrite the local file; other sections in the local file are preserved.
    """
    firestore_doc = mapping["firestore_doc"]
    local_path = mapping["local_path"]
    description = mapping["description"]
    merge_mode = mapping.get("merge_mode", False)
    merge_keys = mapping.get("merge_keys", [])

    print(f"\n  {description}")
    print(f"    Firestore: {firestore_doc}")
    print(f"    Local:     {local_path}")
    if merge_mode:
        print(f"    Mode:      MERGE (keys: {merge_keys})")

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
        if merge_mode:
            print(f"    Merge keys to overwrite: {[k for k in merge_keys if k in clean_data]}")
        return True

    # Ensure directory exists
    os.makedirs(os.path.dirname(local_path), exist_ok=True)

    if merge_mode and os.path.exists(local_path):
        # Load existing local JSON and merge only specified keys
        with open(local_path, "r", encoding="utf-8") as f:
            local_data = json.load(f)

        merged_count = 0
        for key in merge_keys:
            if key in clean_data:
                local_data[key] = clean_data[key]
                merged_count += 1
                print(f"    🔄 Merged: {key}")

        with open(local_path, "w", encoding="utf-8") as f:
            json.dump(local_data, f, ensure_ascii=False, indent=2)

        print(f"    ✅ 병합 완료 ({merged_count}/{len(merge_keys)} sections)")
    else:
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
    print(f"  시간: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    db = init_firestore()

    success_count = 0
    for mapping in SYNC_MAPPINGS:
        if sync_config(db, mapping, dry_run=args.dry_run):
            success_count += 1

    print(f"\n{'='*60}")
    print(f"  완료: {success_count}/{len(SYNC_MAPPINGS)} 설정 동기화")
    print("=" * 60)


if __name__ == "__main__":
    main()
