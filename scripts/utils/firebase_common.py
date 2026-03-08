"""Firebase Admin SDK 공통 초기화 모듈.

모든 스크립트에서 중복된 Firebase 초기화 코드를 단일 모듈로 통합.
"""
import os
import firebase_admin
from firebase_admin import credentials, firestore

LOCAL_SERVICE_ACCOUNT_PATH = "/Users/ksmoon/Downloads/qip-dashboard-dabdc4d51ac9.json"
TARGET_FIREBASE_PROJECT = "hwk-qip-incentive-dashboard"


def init_firestore():
    """Firebase Admin SDK를 초기화하고 Firestore 클라이언트를 반환합니다.

    Returns:
        google.cloud.firestore.Client: Firestore 클라이언트

    Raises:
        FileNotFoundError: 서비스 계정 파일을 찾을 수 없는 경우
        ValueError: Firebase 프로젝트가 올바르지 않은 경우
    """
    # 이미 초기화된 경우 기존 앱 사용
    if firebase_admin._apps:
        return firestore.client()

    # 서비스 계정 경로 결정
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", LOCAL_SERVICE_ACCOUNT_PATH)

    if not os.path.exists(cred_path):
        raise FileNotFoundError(
            f"Firebase 서비스 계정 파일을 찾을 수 없습니다: {cred_path}\n"
            f"GOOGLE_APPLICATION_CREDENTIALS 환경변수를 설정하거나 "
            f"{LOCAL_SERVICE_ACCOUNT_PATH}에 파일을 배치하세요."
        )

    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred, {
        'projectId': TARGET_FIREBASE_PROJECT
    })

    return firestore.client()
