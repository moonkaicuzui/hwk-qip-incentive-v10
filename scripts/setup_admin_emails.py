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

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("firebase-admin 패키지 필요: pip install firebase-admin")
    sys.exit(1)

LOCAL_SERVICE_ACCOUNT_PATH = "/Users/ksmoon/Downloads/qip-dashboard-dabdc4d51ac9.json"
TARGET_FIREBASE_PROJECT = "hwk-qip-incentive-dashboard"

ADMIN_EMAILS = [
    "ksmoon@hsvina.com"
]


def init_firestore():
    if firebase_admin._apps:
        return firestore.client()

    app_options = {"projectId": TARGET_FIREBASE_PROJECT}

    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "")
    if sa_json:
        try:
            sa_info = json.loads(sa_json)
            cred = credentials.Certificate(sa_info)
            firebase_admin.initialize_app(cred, app_options)
            return firestore.client()
        except Exception as e:
            print(f"환경변수 인증 실패: {e}")

    if os.path.exists(LOCAL_SERVICE_ACCOUNT_PATH):
        cred = credentials.Certificate(LOCAL_SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred, app_options)
        return firestore.client()

    print("서비스 계정을 찾을 수 없습니다.")
    sys.exit(1)


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
