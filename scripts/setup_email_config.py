#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Firestore 이메일 설정 초기화 스크립트

system/config 문서에 이메일 수신자 및 SMTP 설정을 저장합니다.
수신자 추가/제거 및 설정 변경에 사용합니다.

Usage:
    # 초기 설정
    python scripts/setup_email_config.py

    # 수신자 추가
    python scripts/setup_email_config.py --add-recipient "manager@hsvina.com" --name "Kim Manager" --lang ko

    # 수신자 제거
    python scripts/setup_email_config.py --remove-recipient "old@hsvina.com"

    # 현재 설정 확인
    python scripts/setup_email_config.py --show

    # Dry-run
    python scripts/setup_email_config.py --dry-run
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


def init_firestore():
    if firebase_admin._apps:
        return firestore.client()

    app_options = {"projectId": TARGET_FIREBASE_PROJECT}
    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "")
    if sa_json:
        try:
            cred = credentials.Certificate(json.loads(sa_json))
            firebase_admin.initialize_app(cred, app_options)
            return firestore.client()
        except Exception:
            pass

    if os.path.exists(LOCAL_SERVICE_ACCOUNT_PATH):
        cred = credentials.Certificate(LOCAL_SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred, app_options)
        return firestore.client()

    print("서비스 계정을 찾을 수 없습니다.")
    sys.exit(1)


# Default email configuration
DEFAULT_EMAIL_CONFIG = {
    "email_recipients": [
        {"email": "ksmoon@hsvina.com", "name": "KS Moon", "lang": "ko"},
    ],
    "email_settings": {
        "smtp_host": "mail.hsvina.com",
        "smtp_port": 465,
        "from_name": "QIP Incentive Dashboard",
        "from_email": "ksmoon@hsvina.com",
        "enabled": True,
    },
}


def show_config(db):
    """현재 이메일 설정 표시"""
    doc = db.collection("system").document("config").get()
    if not doc.exists:
        print("system/config 문서 없음")
        return

    config = doc.to_dict()
    print("\n=== 현재 이메일 설정 ===")

    recipients = config.get("email_recipients", [])
    print(f"\n수신자 ({len(recipients)}명):")
    for i, r in enumerate(recipients, 1):
        if isinstance(r, dict):
            print(f"  {i}. {r.get('name', '-')} <{r.get('email', '-')}> [{r.get('lang', 'ko')}]")
        else:
            print(f"  {i}. {r}")

    settings = config.get("email_settings", {})
    print(f"\nSMTP 설정:")
    print(f"  Host: {settings.get('smtp_host', '-')}")
    print(f"  Port: {settings.get('smtp_port', '-')}")
    print(f"  From: {settings.get('from_name', '-')} <{settings.get('from_email', '-')}>")
    print(f"  Enabled: {settings.get('enabled', False)}")

    admin_emails = config.get("admin_emails", [])
    if admin_emails:
        print(f"\nAdmin emails: {admin_emails}")


def main():
    parser = argparse.ArgumentParser(description="Firestore 이메일 설정 관리")
    parser.add_argument("--show", action="store_true", help="현재 설정 표시")
    parser.add_argument("--add-recipient", type=str, help="수신자 이메일 추가")
    parser.add_argument("--name", type=str, default="", help="수신자 이름 (--add-recipient 함께 사용)")
    parser.add_argument("--lang", type=str, default="ko", help="수신자 언어 (ko/en/vi)")
    parser.add_argument("--remove-recipient", type=str, help="수신자 이메일 제거")
    parser.add_argument("--dry-run", action="store_true", help="실제 변경 없이 확인만")
    args = parser.parse_args()

    db = init_firestore()
    doc_ref = db.collection("system").document("config")

    if args.show:
        show_config(db)
        return

    if args.add_recipient:
        doc = doc_ref.get()
        config = doc.to_dict() if doc.exists else {}
        recipients = config.get("email_recipients", [])

        # Check duplicate
        existing = [r.get("email") if isinstance(r, dict) else r for r in recipients]
        if args.add_recipient in existing:
            print(f"이미 등록됨: {args.add_recipient}")
            return

        new_recipient = {
            "email": args.add_recipient,
            "name": args.name or args.add_recipient.split("@")[0],
            "lang": args.lang,
        }

        if args.dry_run:
            print(f"[DRY-RUN] 추가 예정: {new_recipient}")
            return

        recipients.append(new_recipient)
        doc_ref.set({"email_recipients": recipients}, merge=True)
        print(f"수신자 추가: {new_recipient}")
        show_config(db)
        return

    if args.remove_recipient:
        doc = doc_ref.get()
        config = doc.to_dict() if doc.exists else {}
        recipients = config.get("email_recipients", [])

        new_list = [r for r in recipients
                    if (r.get("email") if isinstance(r, dict) else r) != args.remove_recipient]

        if len(new_list) == len(recipients):
            print(f"수신자 없음: {args.remove_recipient}")
            return

        if args.dry_run:
            print(f"[DRY-RUN] 제거 예정: {args.remove_recipient}")
            return

        doc_ref.set({"email_recipients": new_list}, merge=True)
        print(f"수신자 제거: {args.remove_recipient}")
        show_config(db)
        return

    # Default: 초기 설정
    print("이메일 설정 초기화 중...")
    if args.dry_run:
        print(f"[DRY-RUN] 설정 예정:")
        print(json.dumps(DEFAULT_EMAIL_CONFIG, indent=2, ensure_ascii=False))
        return

    doc_ref.set(DEFAULT_EMAIL_CONFIG, merge=True)
    print("이메일 설정 초기화 완료")
    show_config(db)


if __name__ == "__main__":
    main()
