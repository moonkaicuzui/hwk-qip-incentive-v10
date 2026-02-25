#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Google Drive 다운로드 + Config 자동 업데이트 통합 스크립트

주요 개선사항:
1. 구글 드라이브에서 데이터 다운로드
2. 실제 다운로드된 파일 경로를 config에 자동 반영
3. attendance 데이터에서 working_days 자동 계산
4. 한 번의 실행으로 모든 자동화 완료
"""

import os
import json
import sys
from datetime import datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io
import pandas as pd
import re

def init_google_drive_service():
    """Google Drive 서비스 초기화"""
    try:
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

def list_files_in_folder(service, folder_id, file_type='csv'):
    """특정 폴더의 파일 목록 가져오기"""
    try:
        query = f"'{folder_id}' in parents and trashed=false"
        if file_type:
            if file_type == 'csv':
                query += " and (mimeType='text/csv' or name contains '.csv')"

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
    """Google Drive 파일 다운로드 + modifiedTime 반환"""
    try:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Google Drive에서 파일 메타데이터 가져오기 (modifiedTime 포함)
        file_metadata = service.files().get(
            fileId=file_id,
            fields='modifiedTime, size'
        ).execute()

        google_modified_time = file_metadata.get('modifiedTime')

        if os.path.exists(output_path):
            if force:
                old_mtime = datetime.fromtimestamp(os.path.getmtime(output_path))
                print(f"  🔄 기존 파일 삭제 (로컬 수정일: {old_mtime.strftime('%Y-%m-%d %H:%M:%S')})")
                os.remove(output_path)
            else:
                print(f"  ⚠️ 파일이 이미 존재합니다 (건너뜀)")
                return None

        request = service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)

        done = False
        while not done:
            status, done = downloader.next_chunk()

        with open(output_path, 'wb') as f:
            f.write(fh.getvalue())

        file_size = os.path.getsize(output_path)
        print(f"  ✅ 다운로드 완료 ({file_size:,} bytes)")
        print(f"     📅 Google Drive 수정일: {google_modified_time}")

        return google_modified_time

    except Exception as e:
        print(f"  ❌ 다운로드 실패: {e}")
        return None

def month_number_to_name(month_num):
    """월 숫자를 영문 이름으로 변환"""
    month_names = {
        1: 'january', 2: 'february', 3: 'march', 4: 'april',
        5: 'may', 6: 'june', 7: 'july', 8: 'august',
        9: 'september', 10: 'october', 11: 'november', 12: 'december'
    }
    return month_names.get(month_num, 'unknown')

def calculate_working_days_from_attendance(attendance_file_path):
    """Attendance 데이터에서 실제 근무일수를 계산"""
    try:
        df = pd.read_csv(attendance_file_path, encoding='utf-8-sig')

        if 'Work Date' in df.columns:
            unique_dates = df['Work Date'].dropna().unique()
            working_days = len(unique_dates)
            print(f"    📊 Work Date 기준 총 근무일수: {working_days}일")
            return working_days

        day_columns = [col for col in df.columns if col.startswith('Day_')]
        if day_columns:
            working_days = len(day_columns)
            print(f"    📊 Day 컬럼 기준 총 근무일수: {working_days}일")
            return working_days

        return None

    except Exception as e:
        print(f"    ❌ Attendance 파일 분석 실패: {e}")
        return None

def update_config_for_month(year, month_name, downloaded_files):
    """특정 월의 config 파일을 업데이트 (modifiedTime 포함)

    [Issue #58] 근본 개선: Attendance 파일 필수 검증
    - Config 생성 전 attendance 파일 존재 확인
    - 파일 없으면 config 생성 거부 (잘못된 working_days 방지)
    """
    config_path = f"config_files/config_{month_name}_{year}.json"

    print(f"\n  📝 Config 업데이트: {config_path}")

    # [Issue #58] Attendance 파일 존재 확인 (필수 조건)
    attendance_path = f"input_files/attendance/original/attendance data {month_name}.csv"
    if not os.path.exists(attendance_path):
        print(f"    ❌ [Issue #58] Attendance 파일 없음: {attendance_path}")
        print(f"    ⚠️ Config 생성 건너뜀 - 잘못된 working_days 방지")
        return None  # Config 생성 거부

    # 기존 config 로드 또는 새로 생성
    if os.path.exists(config_path):
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        print("    기존 config 파일 로드")
    else:
        print("    새 config 파일 생성")
        # [Issue #58] default working_days 제거 - 반드시 파일에서 계산
        config = {
            "year": year,
            "month": month_name,
            "working_days": None  # 명시적으로 None (나중에 계산됨)
        }

    # 실제 다운로드된 파일 경로 매핑 + modifiedTime 저장
    file_paths = {}
    files_modified_times = {}

    for file_info in downloaded_files:
        file_path = file_info['local_path']
        file_name = os.path.basename(file_path).lower()
        modified_time = file_info.get('modified_time')

        if 'basic' in file_name and 'manpower' in file_name:
            file_paths['basic_manpower'] = file_path
            if modified_time:
                files_modified_times['basic_manpower'] = modified_time
        elif 'attendance' in file_name or '출근' in file_name:
            # [Issue #54] SSOT 원칙: 항상 original 파일만 사용하여 working_days 계산
            # converted 파일은 stale 데이터일 수 있으므로 무시
            if 'converted' not in file_path and 'original' in file_path:
                file_paths['attendance'] = file_path
                if modified_time:
                    files_modified_times['attendance'] = modified_time
            elif 'attendance' not in file_paths and 'converted' not in file_path:
                # original 폴더에 없는 경우만 다른 위치 허용
                file_paths['attendance'] = file_path
                if modified_time:
                    files_modified_times['attendance'] = modified_time
        elif '5prs' in file_name.lower():
            file_paths['5prs'] = file_path
            if modified_time:
                files_modified_times['5prs'] = modified_time
        elif 'aql' in file_name.lower() and month_name.upper() in file_name.upper():
            file_paths['aql_current'] = file_path
            if modified_time:
                files_modified_times['aql_current'] = modified_time

    # Previous incentive 파일 경로 설정
    prev_month_names = {
        'january': 'december', 'february': 'january', 'march': 'february',
        'april': 'march', 'may': 'april', 'june': 'may',
        'july': 'june', 'august': 'july', 'september': 'august',
        'october': 'september', 'november': 'october', 'december': 'november'
    }
    prev_month = prev_month_names.get(month_name.lower())
    prev_year = year if month_name.lower() != 'january' else year - 1

    # V10.0 only (구버전 완전 제거됨, 2026-01-03)
    # V10.0: Approved Leave Days 버그 수정 + Final Nov incentive.xlsx 기준
    prev_path = f"output_files/output_QIP_incentive_{prev_month}_{prev_year}_Complete_V10.0_Complete.csv"
    file_paths['previous_incentive'] = prev_path

    config['file_paths'] = file_paths
    config['files_modified_times'] = files_modified_times

    # [Issue #58] Working days 계산 및 업데이트 - 필수 검증 강화
    if 'attendance' in file_paths and os.path.exists(file_paths['attendance']):
        print(f"    📊 Working days 계산 중...")
        working_days = calculate_working_days_from_attendance(file_paths['attendance'])
        if working_days and working_days > 0:
            old_days = config.get('working_days', 'N/A')
            config['working_days'] = working_days
            config['working_days_source'] = 'attendance_data'
            config['working_days_updated_at'] = datetime.now().isoformat()
            print(f"    ✅ Working days 업데이트: {old_days} → {working_days}")
        else:
            print(f"    ❌ [Issue #58] Working days 계산 실패 (결과: {working_days})")
            print(f"    ⚠️ Config 생성 중단 - 잘못된 데이터 방지")
            return None  # Config 생성 거부
    else:
        print(f"    ❌ [Issue #58] Attendance 파일 없음 또는 경로 누락")
        print(f"    ⚠️ Config 생성 중단 - working_days 계산 불가")
        return None  # Config 생성 거부

    # [Issue #58] 최종 검증: working_days가 유효한지 확인
    if config.get('working_days') is None or config.get('working_days', 0) <= 0:
        print(f"    ❌ [Issue #58] 최종 검증 실패: working_days = {config.get('working_days')}")
        print(f"    ⚠️ Config 저장 거부")
        return None

    # Previous months 설정
    months = ['january', 'february', 'march', 'april', 'may', 'june',
              'july', 'august', 'september', 'october', 'november', 'december']
    month_idx = months.index(month_name.lower())
    prev_months = []
    for i in range(1, 3):
        prev_idx = (month_idx - i) % 12
        prev_months.append(months[prev_idx])
    config['previous_months'] = list(reversed(prev_months))

    # 기타 필드 업데이트
    config['output_prefix'] = f"output_QIP_incentive_{month_name}_{year}"
    config['data_source'] = 'google_drive'
    config['created_at'] = config.get('created_at', datetime.now().isoformat())

    # last_updated: 가장 최근 파일 수정 시간 사용 (Google Drive modifiedTime)
    if files_modified_times:
        latest_modified = max(files_modified_times.values())
        config['last_updated'] = latest_modified
        print(f"    📅 가장 최근 파일 수정 시간: {latest_modified}")
    else:
        config['last_updated'] = datetime.now().isoformat()

    # Config 저장
    os.makedirs('config_files', exist_ok=True)
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)

    print(f"    ✅ Config 업데이트 완료")

    # 파일 검증
    print(f"    🔍 파일 존재 여부 검증:")
    for key, path in file_paths.items():
        exists = os.path.exists(path)
        status = "✅" if exists else "⚠️"
        print(f"      {status} {key}: {os.path.basename(path)}")

def main():
    """메인 실행 함수"""
    print("=" * 70)
    print("🚀 Google Drive 다운로드 + Config 자동 업데이트 통합 시스템")
    print("=" * 70)

    # Google Drive 서비스 초기화
    service = init_google_drive_service()

    # drive_config.json 로드
    drive_config = None
    if os.path.exists('config_files/drive_config.json'):
        with open('config_files/drive_config.json', 'r', encoding='utf-8') as f:
            drive_config = json.load(f)
        print("✅ drive_config.json 로드 완료")

    # 폴더 ID 가져오기
    if drive_config:
        folder_structure = drive_config.get('google_drive', {}).get('folder_structure', {})
        monthly_data_id = folder_structure.get('monthly_data', {}).get('id')
        aql_folder_id = folder_structure.get('aql_history', {}).get('id')
    else:
        monthly_data_id = os.environ.get('GDRIVE_FOLDER_ID')
        aql_folder_id = None

    if not monthly_data_id:
        print("❌ 월별 데이터 폴더 ID를 찾을 수 없습니다")
        sys.exit(1)

    # 최신 월 폴더 찾기
    print(f"\n📁 월별 데이터 폴더 스캔 중...")
    query = f"'{monthly_data_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
    results = service.files().list(
        q=query,
        fields="files(id, name)",
        orderBy="name desc"
    ).execute()

    month_folders = []
    for folder in results.get('files', []):
        match = re.match(r'(\d{4})_(\d{1,2})', folder['name'])
        if match:
            year = int(match.group(1))
            month = int(match.group(2))
            month_folders.append({
                'id': folder['id'],
                'name': folder['name'],
                'year': year,
                'month': month,
                'month_name': month_number_to_name(month)
            })

    month_folders.sort(key=lambda x: (x['year'], x['month']), reverse=True)

    if not month_folders:
        print("⚠️ 월 폴더를 찾을 수 없습니다")
        sys.exit(1)

    print(f"✅ {len(month_folders)}개 월 폴더 발견")

    # 각 월별로 처리 (최신 3개월만)
    for month_folder in month_folders[:3]:
        print(f"\n{'='*50}")
        print(f"📅 {month_folder['name']} ({month_folder['month_name']} {month_folder['year']}) 처리 중...")

        # 해당 월 파일 다운로드
        files = list_files_in_folder(service, month_folder['id'])
        print(f"  📥 {len(files)}개 파일 발견")

        downloaded_files = []
        for file in files:
            file_name = file['name'].lower()
            output_path = None

            # 파일 타입별 경로 설정
            if 'basic' in file_name and 'manpower' in file_name:
                output_path = f"input_files/basic manpower data {month_folder['month_name']}.csv"
            elif 'attendance' in file_name or '출근' in file_name:
                output_path = f"input_files/attendance/original/attendance data {month_folder['month_name']}.csv"
            elif '5prs' in file_name:
                output_path = f"input_files/5prs data {month_folder['month_name']}.csv"
            else:
                backup_dir = f"input_files/monthly_data/{month_folder['name']}"
                os.makedirs(backup_dir, exist_ok=True)
                output_path = f"{backup_dir}/{file['name']}"

            if output_path:
                print(f"  다운로드: {file['name']} → {output_path}")
                modified_time = download_file(service, file['id'], output_path, force=True)
                if modified_time:
                    downloaded_files.append({
                        'google_name': file['name'],
                        'local_path': output_path,
                        'file_id': file['id'],
                        'modified_time': modified_time
                    })

        # AQL 파일 다운로드
        if aql_folder_id:
            print(f"\n  📊 AQL History 다운로드 중...")
            aql_files = list_files_in_folder(service, aql_folder_id)
            os.makedirs('input_files/AQL history', exist_ok=True)

            for file in aql_files:
                match = re.search(r'AQL_REPORT_([A-Z]+)_(\d{4})', file['name'], re.IGNORECASE)
                if match:
                    aql_month = match.group(1).upper()
                    aql_year = match.group(2)
                    if aql_month == month_folder['month_name'].upper() and aql_year == str(month_folder['year']):
                        output_path = f"input_files/AQL history/1.HSRG AQL REPORT-{aql_month}.{aql_year}.csv"
                        print(f"  다운로드: {file['name']} → {output_path}")
                        modified_time = download_file(service, file['id'], output_path, force=True)
                        if modified_time:
                            downloaded_files.append({
                                'google_name': file['name'],
                                'local_path': output_path,
                                'file_id': file['id'],
                                'modified_time': modified_time
                            })
                        break

        # Config 파일 자동 업데이트 (다운로드된 파일이 있을 때만)
        # [Issue #57] 데이터 없는 월의 config 생성 방지 (GitHub Actions 파이프라인 장애 원인)
        if downloaded_files:
            update_config_for_month(month_folder['year'], month_folder['month_name'], downloaded_files)
        else:
            print(f"  ⏭️ Config 업데이트 건너뜀 (다운로드된 파일 없음 - {month_folder['month_name']} {month_folder['year']})")
            print(f"     → Google Drive에 해당 월 데이터가 아직 없습니다.")

    print("\n" + "=" * 70)
    print("✅ Google Drive 다운로드 + Config 업데이트 완료!")
    print("=" * 70)

if __name__ == "__main__":
    main()