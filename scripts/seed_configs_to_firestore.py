#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Firestore 설정 시드 스크립트 - V9 JSON 설정 파일을 Firestore configs/ 컬렉션에 업로드

Usage:
    python scripts/seed_configs_to_firestore.py
    python scripts/seed_configs_to_firestore.py --dry-run

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

# Config file → Firestore document mapping
CONFIG_MAPPINGS = [
    {
        "local_path": "config_files/type2_position_mapping.json",
        "firestore_doc": "configs/type2_position_mapping",
        "description": "TYPE-2 직급 매핑 설정"
    },
    {
        "local_path": "config_files/qip_talent_pool.json",
        "firestore_doc": "configs/talent_pool",
        "description": "QIP Talent Pool 특별 인센티브"
    },
    {
        "local_path": "config_files/auditor_trainer_area_mapping.json",
        "firestore_doc": "configs/auditor_area_mapping",
        "description": "Auditor/Trainer 구역 매핑"
    },
    {
        "local_path": "config_files/assembly_inspector_continuous_months.json",
        "firestore_doc": "configs/continuous_months",
        "description": "Assembly Inspector 연속 근무월 추적"
    },
]


def seed_config(db, mapping, dry_run=False):
    """Upload a single config file to Firestore."""
    local_path = mapping["local_path"]
    firestore_doc = mapping["firestore_doc"]
    description = mapping["description"]

    print(f"\n{'='*60}")
    print(f"  {description}")
    print(f"  Local: {local_path}")
    print(f"  Firestore: {firestore_doc}")
    print(f"{'='*60}")

    if not os.path.exists(local_path):
        print(f"  ⚠️ 파일 없음: {local_path} - 건너뜀")
        return False

    with open(local_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Add metadata
    data["_metadata"] = {
        "updated_at": datetime.utcnow().isoformat() + "Z",
        "updated_by": "seed_script",
        "version": 1,
        "source": "v9_migration"
    }

    if dry_run:
        print(f"  [DRY RUN] Would upload {len(json.dumps(data, ensure_ascii=False))} bytes")
        print(f"  Top-level keys: {list(data.keys())}")
        return True

    # Parse collection/document from path
    parts = firestore_doc.split("/")
    collection = parts[0]
    doc_id = parts[1]

    db.collection(collection).document(doc_id).set(data)
    print(f"  ✅ 업로드 완료: {firestore_doc}")
    return True


def main():
    parser = argparse.ArgumentParser(description="V9 설정 파일을 Firestore에 시드")
    parser.add_argument("--dry-run", action="store_true", help="실제 업로드 없이 확인만")
    args = parser.parse_args()

    print("=" * 60)
    print("  Firestore 설정 시드 스크립트")
    print(f"  모드: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print("=" * 60)

    db = init_firestore()

    success_count = 0
    for mapping in CONFIG_MAPPINGS:
        if seed_config(db, mapping, dry_run=args.dry_run):
            success_count += 1

    print(f"\n{'='*60}")
    print(f"  완료: {success_count}/{len(CONFIG_MAPPINGS)} 설정 파일 업로드")
    print("=" * 60)


if __name__ == "__main__":
    main()
