"""Firebase Admin SDK 공통 초기화 모듈.

모든 스크립트에서 중복된 Firebase 초기화 코드를 단일 모듈로 통합.
"""
import os
import json
import tempfile
import firebase_admin
from firebase_admin import credentials, firestore

LOCAL_SERVICE_ACCOUNT_PATH = "/Users/ksmoon/Downloads/qip-dashboard-dabdc4d51ac9.json"
TARGET_FIREBASE_PROJECT = "hwk-qip-incentive-dashboard"


def init_firestore():
    """Firebase Admin SDK를 초기화하고 Firestore 클라이언트를 반환합니다.

    인증 순서:
    1. 이미 초기화된 앱이 있으면 재사용
    2. GOOGLE_APPLICATION_CREDENTIALS 환경변수 (파일 경로)
    3. FIREBASE_SERVICE_ACCOUNT 환경변수 (JSON 문자열 → 임시 파일)
    4. 로컬 서비스 계정 파일

    Returns:
        google.cloud.firestore.Client: Firestore 클라이언트

    Raises:
        FileNotFoundError: 서비스 계정을 찾을 수 없는 경우
    """
    # 이미 초기화된 경우 기존 앱 사용
    if firebase_admin._apps:
        return firestore.client()

    cred = None

    # 1. GOOGLE_APPLICATION_CREDENTIALS 파일 경로
    gac_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
    if gac_path and os.path.exists(gac_path):
        cred = credentials.Certificate(gac_path)

    # 2. FIREBASE_SERVICE_ACCOUNT JSON 문자열 (GitHub Actions 등)
    if cred is None:
        sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "")
        if sa_json:
            try:
                sa_dict = json.loads(sa_json)
                cred = credentials.Certificate(sa_dict)
            except (json.JSONDecodeError, ValueError) as e:
                print(f"  FIREBASE_SERVICE_ACCOUNT 파싱 실패: {e}")

    # 3. 로컬 서비스 계정 파일
    if cred is None and os.path.exists(LOCAL_SERVICE_ACCOUNT_PATH):
        cred = credentials.Certificate(LOCAL_SERVICE_ACCOUNT_PATH)

    if cred is None:
        raise FileNotFoundError(
            "Firebase 서비스 계정을 찾을 수 없습니다.\n"
            "다음 중 하나를 설정하세요:\n"
            "  - GOOGLE_APPLICATION_CREDENTIALS 환경변수 (파일 경로)\n"
            "  - FIREBASE_SERVICE_ACCOUNT 환경변수 (JSON 문자열)\n"
            f"  - {LOCAL_SERVICE_ACCOUNT_PATH} 파일 배치"
        )

    firebase_admin.initialize_app(cred, {
        'projectId': TARGET_FIREBASE_PROJECT
    })

    return firestore.client()
