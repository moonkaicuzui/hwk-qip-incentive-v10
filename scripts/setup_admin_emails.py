#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Firestore system/config에 admin_emails 필드 추가 (일회성 설정)

Usage:
    python scripts/setup_admin_emails.py
    python scripts/setup_admin_emails.py --dry-run
"""

import os
import sys
import json
import argparse

# Add project root to path for utils import
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from scripts.utils.firebase_common import init_firestore

ADMIN_EMAILS = [
    "ksmoon@hsvina.com"
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print(f"Admin emails to set: {ADMIN_EMAILS}")

    if args.dry_run:
        print("[DRY-RUN] 실제 업데이트 없음")
        return

    db = init_firestore()
    doc_ref = db.collection("system").document("config")
    doc = doc_ref.get()

    if doc.exists:
        current = doc.to_dict()
        print(f"현재 system/config: {list(current.keys())}")
        doc_ref.update({"admin_emails": ADMIN_EMAILS})
        print(f"✅ admin_emails 업데이트: {ADMIN_EMAILS}")
    else:
        doc_ref.set({"admin_emails": ADMIN_EMAILS})
        print(f"✅ system/config 생성 + admin_emails 설정: {ADMIN_EMAILS}")

    # Verify
    verify = doc_ref.get().to_dict()
    print(f"검증 - admin_emails: {verify.get('admin_emails')}")


if __name__ == "__main__":
    main()
