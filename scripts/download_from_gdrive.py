#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Google Drive 데이터 자동 다운로드 스크립트 V2
drive_config.json의 file_mappings를 따라 올바른 경로에 파일을 다운로드합니다.
"""

import os
import json
import sys
import hashlib
from datetime import datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io

def init_google_drive_service():
    """Google Drive 서비스 초기화"""
    try:
        # GitHub Secrets에서 서비스 계정 정보 가져오기
        service_account_info = json.loads(os.environ.get('GOOGLE_SERVICE_ACCOUNT', '{}'))

        if not service_account_info:
            print("❌ 오류: GOOGLE_SERVICE_ACCOUNT 환경변수가 설정되지 않았습니다")
            sys.exit(1)

        credentials = service_account.Credentials.from_service_account_info(
            service_account_info,
            scopes=['https://www.googleapis.com/auth/drive.readonly']
        )

        service = build('drive', 'v3', credentials=credentials)
        print("✅ Google Drive 서비스 초기화 성공")
        return service

    except Exception as e:
        print(f"❌ Google Drive 서비스 초기화 실패: {e}")
        sys.exit(1)

def load_drive_config():
    """drive_config.json 로드"""
    config_path = "config_files/drive_config.json"

    if not os.path.exists(config_path):
        print(f"⚠️ {config_path} 파일이 없습니다")
        return None

    with open(config_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def list_files_in_folder(service, folder_id, file_type='csv'):
    """특정 폴더의 파일 목록 가져오기"""
    try:
        query = f"'{folder_id}' in parents and trashed=false"
        if file_type:
            if file_type == 'csv':
                query += " and (mimeType='text/csv' or name contains '.csv')"
            elif file_type == 'json':
                query += " and (mimeType='application/json' or name contains '.json')"

        results = service.files().list(
            q=query,
            fields="files(id, name, modifiedTime, mimeType)",
            orderBy="modifiedTime desc"
        ).execute()

        return results.get('files', [])

    except Exception as e:
        print(f"❌ 폴더 목록 조회 실패 ({folder_id}): {e}")
        return []

def download_file(service, file_id, output_path, force=True):
    """Google Drive 파일 다운로드 (MD5 Checksum 검증 포함)

    Args:
        service: Google Drive 서비스 객체
        file_id: 다운로드할 파일 ID
        output_path: 저장 경로
        force: True면 기존 파일 강제 삭제 후 다운로드 (default: True)

    Returns:
        True: 다운로드 성공 및 검증 완료
        False: 다운로드 실패 또는 검증 실패

    [Issue #55] 근본적 해결책: MD5 Checksum 검증
    - Google Drive API에서 파일의 MD5 해시를 가져옴
    - 다운로드 후 로컬 파일의 MD5 해시 계산
    - 두 해시가 일치하지 않으면 다운로드 실패 처리
    """
    try:
        # 디렉토리 생성
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # [Issue #55] Step 1: Google Drive에서 파일 메타데이터 (MD5 포함) 가져오기
        file_metadata = service.files().get(fileId=file_id, fields='md5Checksum,size,modifiedTime').execute()
        gdrive_md5 = file_metadata.get('md5Checksum')
        gdrive_size = int(file_metadata.get('size', 0))
        gdrive_modified = file_metadata.get('modifiedTime', '')

        # 기존 파일 존재 확인 및 강제 삭제
        if os.path.exists(output_path):
            if force:
                old_mtime = datetime.fromtimestamp(os.path.getmtime(output_path))
                print(f"  🔄 기존 파일 삭제 (수정일: {old_mtime.strftime('%Y-%m-%d %H:%M:%S')})")
                os.remove(output_path)
            else:
                print(f"  ⚠️ 파일이 이미 존재합니다 (건너뜀)")
                return False

        # [Issue #55] Step 2: 파일 다운로드
        request = service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)

        done = False
        while not done:
            status, done = downloader.next_chunk()

        downloaded_content = fh.getvalue()

        # [Issue #55] Step 3: 다운로드된 콘텐츠의 MD5 해시 계산
        local_md5 = hashlib.md5(downloaded_content).hexdigest()

        # [Issue #55] Step 4: MD5 Checksum 검증
        if gdrive_md5 and local_md5 != gdrive_md5:
            print(f"  ❌ [Issue #55] MD5 불일치! 다운로드 실패")
            print(f"     Google Drive MD5: {gdrive_md5}")
            print(f"     Local MD5:        {local_md5}")
            return False

        # [Issue #55] Step 5: 파일 크기 검증
        if gdrive_size > 0 and len(downloaded_content) != gdrive_size:
            print(f"  ❌ [Issue #55] 파일 크기 불일치! 다운로드 실패")
            print(f"     Google Drive Size: {gdrive_size:,} bytes")
            print(f"     Downloaded Size:   {len(downloaded_content):,} bytes")
            return False

        # 파일 저장
        with open(output_path, 'wb') as f:
            f.write(downloaded_content)

        # 다운로드 후 파일 정보 출력
        new_mtime = datetime.fromtimestamp(os.path.getmtime(output_path))
        file_size = os.path.getsize(output_path)

        # [Issue #55] 검증 완료 메시지
        verification_status = "✓ MD5 검증됨" if gdrive_md5 else "⚠️ MD5 없음"
        print(f"  ✅ 다운로드 완료 ({file_size:,} bytes, {verification_status})")

        return True

    except Exception as e:
        print(f"  ❌ 다운로드 실패: {e}")
        return False

def month_number_to_name(month_num):
    """월 숫자를 영문 이름으로 변환 (1 → january)"""
    month_names = {
        1: 'january', 2: 'february', 3: 'march', 4: 'april',
        5: 'may', 6: 'june', 7: 'july', 8: 'august',
        9: 'september', 10: 'october', 11: 'november', 12: 'december'
    }
    return month_names.get(month_num, 'unknown')

def detect_latest_month_folder(service, monthly_data_folder_id):
    """최신 월 폴더 찾기 (예: 2025_11)"""
    try:
        # monthly_data 폴더 내의 하위 폴더 목록
        query = f"'{monthly_data_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = service.files().list(
            q=query,
            fields="files(id, name)",
            orderBy="name desc"
        ).execute()

        folders = results.get('files', [])

        # YYYY_MM 패턴 찾기
        import re
        month_folders = []
        for folder in folders:
            match = re.match(r'(\d{4})_(\d{1,2})', folder['name'])
            if match:
                year = int(match.group(1))
                month = int(match.group(2))
                month_folders.append({
                    'id': folder['id'],
                    'name': folder['name'],
                    'year': year,
                    'month': month,
                    'month_name': month_number_to_name(month)  # 월 이름 추가
                })

        # 최신 월 우선 정렬
        month_folders.sort(key=lambda x: (x['year'], x['month']), reverse=True)

        return month_folders

    except Exception as e:
        print(f"❌ 월 폴더 조회 실패: {e}")
        return []

def main():
    """메인 실행 함수"""
    print("=" * 70)
    print("🚀 Google Drive 데이터 자동 다운로드 V2")
    print("=" * 70)

    # Google Drive 서비스 초기화
    service = init_google_drive_service()

    # drive_config.json 로드
    drive_config = load_drive_config()

    if not drive_config:
        print("⚠️ drive_config.json 없이 기본 다운로드 모드로 실행합니다")
        # 기본 폴더 ID 사용
        folder_id = os.environ.get('GDRIVE_FOLDER_ID')
        if not folder_id:
            print("❌ GDRIVE_FOLDER_ID 환경변수가 설정되지 않았습니다")
            sys.exit(1)

        # 기본 다운로드 (모든 CSV를 output_files에)
        print(f"📁 폴더 ID: {folder_id}")
        files = list_files_in_folder(service, folder_id, 'csv')
        print(f"📥 {len(files)}개 파일 발견")

        os.makedirs('output_files', exist_ok=True)
        downloaded = 0

        for file in files:
            print(f"  다운로드: {file['name']}")
            if download_file(service, file['id'], f"output_files/{file['name']}", force=True):
                downloaded += 1

        print(f"✅ 다운로드 완료: {downloaded}/{len(files)}")
        return

    # drive_config.json 기반 다운로드
    google_drive_config = drive_config.get('google_drive', {})
    folder_structure = google_drive_config.get('folder_structure', {})

    # monthly_data 폴더에서 최신 월 찾기
    monthly_data_id = folder_structure.get('monthly_data', {}).get('id')

    if not monthly_data_id:
        print("⚠️ monthly_data 폴더 ID를 찾을 수 없습니다")
        sys.exit(1)

    print(f"📁 monthly_data 폴더 ID: {monthly_data_id}")

    # 최신 월 폴더 찾기
    month_folders = detect_latest_month_folder(service, monthly_data_id)

    if not month_folders:
        print("⚠️ 월 폴더를 찾을 수 없습니다")
        sys.exit(1)

    print(f"\n📅 발견된 월 폴더: {len(month_folders)}개")
    for folder in month_folders[:3]:  # 최신 3개월만 표시
        print(f"  - {folder['name']} (ID: {folder['id']})")

    # 최신 월 데이터 다운로드
    latest_month = month_folders[0]
    month_name = latest_month['month_name']  # 예: 'november'
    year = latest_month['year']  # 예: 2025

    print(f"\n🎯 다운로드 대상: {latest_month['name']} ({month_name} {year})")

    # 월 폴더 내 파일 목록
    files = list_files_in_folder(service, latest_month['id'])
    print(f"📥 {len(files)}개 파일 발견")

    downloaded = 0
    downloaded_patterns = set()  # 이미 다운로드한 패턴 추적 (최신 파일만 다운로드)

    # ✅ drive_config.json file_mappings 기반 경로 사용
    for file in files:
        file_name = file['name'].lower()
        output_path = None
        pattern_type = None  # 파일 패턴 타입 추적

        # 파일명 패턴 매칭 → drive_config.json 경로로 저장
        if 'basic' in file_name and 'manpower' in file_name:
            # drive_config.json Line 33-35
            pattern_type = 'basic_manpower'
            output_path = f"input_files/basic manpower data {month_name}.csv"
        elif 'attendance' in file_name or '출근' in file_name:
            # drive_config.json Line 37-40
            pattern_type = 'attendance'
            output_path = f"input_files/attendance/original/attendance data {month_name}.csv"
        elif '5prs' in file_name or '5PRS' in file['name']:
            # drive_config.json Line 42-45
            pattern_type = '5prs'
            output_path = f"input_files/5prs data {month_name}.csv"
        else:
            # 기타 파일은 원래 이름 유지 (backup용)
            backup_dir = f"input_files/monthly_data/{latest_month['name']}"
            os.makedirs(backup_dir, exist_ok=True)
            output_path = f"{backup_dir}/{file['name']}"
            pattern_type = None  # Backup 파일은 추적 안함

        # 이미 해당 패턴의 파일을 다운로드했으면 건너뜀 (최신 파일 우선)
        if pattern_type and pattern_type in downloaded_patterns:
            print(f"  ⏭️  건너뜀: {file['name']} (이미 최신 {pattern_type} 파일 다운로드됨)")
            continue

        print(f"  다운로드: {file['name']} → {output_path}")
        if download_file(service, file['id'], output_path, force=True):
            downloaded += 1
            if pattern_type:
                downloaded_patterns.add(pattern_type)

    # AQL history 다운로드
    aql_folder_id = folder_structure.get('aql_history', {}).get('id')
    if aql_folder_id:
        print(f"\n📊 AQL History 다운로드 중...")
        aql_files = list_files_in_folder(service, aql_folder_id, 'csv')

        os.makedirs('input_files/AQL history', exist_ok=True)

        # [FIX 2026-06-04] 기존 aql_files[:3](modifiedTime 최신 3개 파일) 제거.
        #  Drive에 새 달 파일(예: JUNE)이 생기면 최신 3개가 JUNE/MAY/APRIL이 되어
        #  더 오래된 필요월(MARCH)이 누락 → 5월의 3개월 연속실패 판정(3·4·5월)이 깨짐.
        #  → 월별 최신본 dedup 후 '달력 기준' 최근 MAX_AQL_MONTHS개월을 받아 윈도우 보장.
        import re
        MAX_AQL_MONTHS = 6  # 최근 6개월 (detect_stale 최대 4개월 타겟 × 각 2개월 이전 윈도우 커버)
        _month_num = {'JANUARY':1,'FEBRUARY':2,'MARCH':3,'APRIL':4,'MAY':5,'JUNE':6,
                      'JULY':7,'AUGUST':8,'SEPTEMBER':9,'OCTOBER':10,'NOVEMBER':11,'DECEMBER':12}

        # 월별 최신 파일 1개만 (aql_files는 modifiedTime desc 정렬 → 먼저 본 것이 최신)
        aql_by_month = {}  # (year, month_num) -> (file, month_upper, year_str)
        for file in aql_files:
            match = re.search(r'AQL_REPORT_([A-Z]+)_(\d{4})', file['name'], re.IGNORECASE)
            if not match:
                continue
            month_upper = match.group(1).upper()
            year_str = match.group(2)
            mn = _month_num.get(month_upper)
            if not mn:
                continue
            key = (int(year_str), mn)
            if key not in aql_by_month:
                aql_by_month[key] = (file, month_upper, year_str)

        # 달력 기준 최근 MAX_AQL_MONTHS개월 선택 (modifiedTime이 아닌 실제 연-월 기준)
        recent_keys = sorted(aql_by_month.keys(), reverse=True)[:MAX_AQL_MONTHS]
        for key in recent_keys:
            file, month_upper, year_str = aql_by_month[key]
            output_path = f"input_files/AQL history/1.HSRG AQL REPORT-{month_upper}.{year_str}.csv"
            print(f"  다운로드: {file['name']} → {output_path}")
            if download_file(service, file['id'], output_path, force=True):
                downloaded += 1

    print("\n" + "=" * 70)
    print(f"✅ 다운로드 완료: {downloaded}개 파일")
    print("=" * 70)

if __name__ == "__main__":
    main()
