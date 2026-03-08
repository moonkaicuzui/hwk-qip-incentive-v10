#!/usr/bin/env python3
"""
Config 파일의 working_days를 attendance 데이터에서 자동으로 업데이트하는 스크립트
Single Source of Truth 원칙: attendance 데이터가 진실의 유일한 소스
"""

import json
import pandas as pd
import os
from datetime import datetime, timezone
import argparse
import sys

def calculate_working_days_from_attendance(attendance_file_path):
    """
    Attendance 데이터에서 실제 근무일수를 계산
    방법: Work Date 컬럼의 unique 날짜 수를 계산 (회사 전체 근무일)

    Returns:
        int: 실제 총 근무일수
    """
    try:
        # attendance 파일 읽기
        df_attendance = pd.read_csv(attendance_file_path, encoding='utf-8-sig')

        # 방법 1: Work Date 컬럼의 unique 날짜 수 (가장 정확한 방법)
        if 'Work Date' in df_attendance.columns:
            unique_dates = df_attendance['Work Date'].dropna().unique()
            working_days = len(unique_dates)
            print(f"📊 Work Date 기준 총 근무일수: {working_days}일")

            # 날짜 목록 출력 (디버깅용)
            if working_days > 0:
                print(f"   첫 날: {min(unique_dates)}")
                print(f"   마지막 날: {max(unique_dates)}")

            print(f"✅ Attendance 데이터 분석 완료: {working_days}일")
            return working_days

        # 방법 2: Day_XX 컬럼이 있는 경우 (구 형식)
        day_columns = [col for col in df_attendance.columns if col.startswith('Day_')]
        if day_columns:
            working_days_set = set()
            for col in day_columns:
                day_data = df_attendance[col].dropna()
                if len(day_data) > 0:
                    # 실제 근무 데이터가 있는지 확인
                    work_indicators = day_data[~day_data.isin(['L', 'S', 'H', 'OFF', ''])]
                    if len(work_indicators) > 0:
                        day_number = int(col.split('_')[1])
                        working_days_set.add(day_number)

            working_days = len(working_days_set)
            print(f"📊 Day_XX 컬럼 기준 총 근무일수: {working_days}일")
            print(f"✅ Attendance 데이터 분석 완료: {working_days}일")
            return working_days

        print("⚠️ Work Date 또는 Day_XX 컬럼을 찾을 수 없습니다.")
        return None

    except Exception as e:
        print(f"❌ Attendance 파일 분석 실패: {e}")
        return None

def update_config_working_days(month, year, force_update=False):
    """
    Config 파일의 working_days를 자동으로 업데이트

    Args:
        month: 월 (1-12 또는 월 이름)
        year: 년도
        force_update: True면 기존 값과 같아도 업데이트
    """
    # 월 이름 변환
    month_names = {
        1: 'january', 2: 'february', 3: 'march', 4: 'april',
        5: 'may', 6: 'june', 7: 'july', 8: 'august',
        9: 'september', 10: 'october', 11: 'november', 12: 'december'
    }

    if isinstance(month, int):
        month_name = month_names[month]
    else:
        month_name = month.lower()

    # Config 파일 경로
    config_path = f'config_files/config_{month_name}_{year}.json'

    if not os.path.exists(config_path):
        print(f"❌ Config 파일이 존재하지 않습니다: {config_path}")
        return False

    # Config 파일 로드
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)

    # Attendance 파일 경로 가져오기
    attendance_path = config.get('file_paths', {}).get('attendance')
    if not attendance_path:
        print("❌ Config에 attendance 파일 경로가 없습니다.")
        return False

    if not os.path.exists(attendance_path):
        print(f"❌ Attendance 파일이 존재하지 않습니다: {attendance_path}")
        return False

    # 실제 근무일수 계산
    actual_working_days = calculate_working_days_from_attendance(attendance_path)

    if actual_working_days is None:
        print("❌ 근무일수 계산 실패")
        return False

    # 기존 값과 비교
    current_working_days = config.get('working_days')

    if current_working_days == actual_working_days and not force_update:
        print(f"✅ Working days already correct: {actual_working_days}일")
        return True

    # Config 업데이트
    config['working_days'] = actual_working_days
    config['working_days_source'] = 'attendance_data'
    config['working_days_updated_at'] = datetime.now(timezone.utc).isoformat()

    # 백업 생성
    backup_path = config_path.replace('.json', f'_backup_{datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")}.json')
    with open(backup_path, 'w', encoding='utf-8') as f:
        with open(config_path, 'r', encoding='utf-8') as orig:
            f.write(orig.read())
    print(f"📁 백업 생성: {backup_path}")

    # Config 파일 저장
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

    print(f"✅ Config 파일 업데이트 완료:")
    print(f"   - 이전 값: {current_working_days}일")
    print(f"   - 새로운 값: {actual_working_days}일")
    print(f"   - 파일: {config_path}")

    return True

def main():
    parser = argparse.ArgumentParser(description='Config 파일의 working_days를 자동 업데이트')
    parser.add_argument('--month', type=str, required=True, help='월 (1-12 또는 월 이름)')
    parser.add_argument('--year', type=int, required=True, help='년도')
    parser.add_argument('--force', action='store_true', help='강제 업데이트')

    args = parser.parse_args()

    # 월 처리
    try:
        month = int(args.month)
    except ValueError:
        month = args.month

    print("="*60)
    print("Config Working Days 자동 업데이트")
    print(f"대상: {args.year}년 {month}월")
    print("="*60)

    success = update_config_working_days(month, args.year, args.force)

    if not success:
        sys.exit(1)

    print("\n✅ 작업 완료!")

if __name__ == '__main__':
    main()