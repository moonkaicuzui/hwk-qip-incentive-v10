#!/usr/bin/env python3
"""
Attendance Schema Validation Script
====================================
Validates that all columns in converted attendance file are used by the calculation engine.

This script prevents the "Schema Mismatch" bug (Issue #31 in CLAUDE.md):
- Converter creates columns but calculator doesn't read them
- Results in silent data loss (e.g., Approved Leave Days = 0 for all employees)

Usage:
    python scripts/validate_attendance_schema.py [month] [year]

Example:
    python scripts/validate_attendance_schema.py december 2025
"""

import sys
import os
import json
from pathlib import Path

# 프로젝트 루트로 이동
project_root = Path(__file__).parent.parent
os.chdir(project_root)

# Converted 출근 파일에서 생성되는 컬럼들 (convert_attendance_data.py 기준)
CONVERTED_COLUMNS = [
    'ID No',                 # 직원 번호
    'Last name',             # 이름
    'ACTUAL WORK DAY',       # 실제 근무일
    'TOTAL WORK DAY',        # 총 근무일
    'AR1 Absences',          # 무단결근 (AR1)
    'Unapproved Absences',   # 미승인 결근 합계
    'Approved Leave Days',   # 승인휴가 일수 (Issue #31 핵심)
    'Absence Rate (%)',      # 결근율
    'Attendance Rate (%)',   # 출근율 (승인휴가 반영)
    'Come Late Days',        # 지각 일수
    'Leave Early Days',      # 조퇴 일수
]

# 계산 엔진에서 읽어야 하는 필수 컬럼들 (step1_인센티브_계산_개선버전.py 기준)
REQUIRED_BY_CALCULATOR = [
    'ID No',                    # Employee ID
    'ACTUAL WORK DAY',
    'TOTAL WORK DAY',
    'AR1 Absences',
    'Unapproved Absences',
    'Absence Rate (%)',
    'Approved Leave Days',      # Issue #31: 이전에 누락됨
    'Attendance Rate (%)',      # Issue #31: 이전에 누락됨
]

# 계산 엔진 출력에 포함되어야 하는 필드들
EXPECTED_IN_OUTPUT = [
    'Approved Leave Days',                    # Approved Leave Days 매핑
]


def validate_converted_file(month: str, year: int) -> dict:
    """
    Converted 출근 파일의 컬럼 존재 여부 및 Working Days 일치 검증
    """
    import pandas as pd

    converted_path = f"input_files/attendance/converted/attendance data {month}_converted.csv"

    if not Path(converted_path).exists():
        return {
            'status': 'ERROR',
            'message': f'Converted 파일 없음: {converted_path}',
            'missing_columns': [],
            'extra_columns': [],
            'working_days_match': False
        }

    df = pd.read_csv(converted_path, nrows=5)  # 헤더만 확인
    actual_columns = list(df.columns)

    missing = [col for col in REQUIRED_BY_CALCULATOR if col not in actual_columns]
    extra = [col for col in actual_columns if col not in CONVERTED_COLUMNS]

    if missing:
        return {
            'status': 'ERROR',
            'message': f'필수 컬럼 누락: {missing}',
            'missing_columns': missing,
            'extra_columns': extra,
            'working_days_match': False
        }

    # Issue #32: Working Days 불일치 검증
    config_path = Path(f"config_files/config_{month}_{year}.json")
    working_days_match = True
    working_days_msg = ""

    if config_path.exists():
        with open(config_path) as f:
            config = json.load(f)
        config_working_days = config.get('working_days')

        if config_working_days and 'TOTAL WORK DAY' in actual_columns:
            actual_total_days = df['TOTAL WORK DAY'].iloc[0]

            if actual_total_days != config_working_days:
                working_days_match = False
                working_days_msg = f"\n   ⚠️ Issue #32: Working Days 불일치 감지!"
                working_days_msg += f"\n      Config: {config_working_days}일 vs Converted: {actual_total_days}일"
                working_days_msg += f"\n      → python src/convert_attendance_data.py {month} {year}"

    if not working_days_match:
        return {
            'status': 'ERROR',
            'message': f'모든 필수 컬럼 존재하지만 Working Days 불일치{working_days_msg}',
            'missing_columns': [],
            'extra_columns': extra,
            'columns_found': len(actual_columns),
            'working_days_match': False
        }

    return {
        'status': 'OK',
        'message': '모든 필수 컬럼 존재 및 Working Days 일치',
        'missing_columns': [],
        'extra_columns': extra,
        'columns_found': len(actual_columns),
        'working_days_match': True
    }


def validate_output_file(month: str, year: int) -> dict:
    """
    계산 엔진 출력 파일에 Approved Leave Days가 반영되었는지 검증
    """
    import pandas as pd

    # V10.0 우선, V9.0 fallback
    output_path = f"output_files/output_QIP_incentive_{month}_{year}_Complete_V10.0_Complete.csv"
    if not Path(output_path).exists():
        output_path = f"output_files/output_QIP_incentive_{month}_{year}_Complete_V9.0_Complete.csv"

    if not Path(output_path).exists():
        return {
            'status': 'WARNING',
            'message': f'출력 파일 없음 (계산 전): {output_path}',
            'approved_leave_count': 0,
            'approved_leave_total': 0
        }

    df = pd.read_csv(output_path)

    # Approved Leave Days 컬럼 확인
    if 'Approved Leave Days' not in df.columns:
        return {
            'status': 'ERROR',
            'message': 'Approved Leave Days 컬럼이 출력에 없음 - 버그 가능성!',
            'approved_leave_count': 0,
            'approved_leave_total': 0
        }

    # Approved Leave Days 데이터 통계
    approved_leave = df['Approved Leave Days'].fillna(0)
    count_with_leave = (approved_leave > 0).sum()
    total_leave_days = approved_leave.sum()

    if count_with_leave == 0:
        return {
            'status': 'WARNING',
            'message': 'Approved_Leave_Days가 모두 0 - 데이터 확인 필요',
            'approved_leave_count': 0,
            'approved_leave_total': 0
        }

    return {
        'status': 'OK',
        'message': f'{count_with_leave}명에게 총 {int(total_leave_days)}일 승인휴가 반영',
        'approved_leave_count': int(count_with_leave),
        'approved_leave_total': int(total_leave_days)
    }


def main():
    print("=" * 60)
    print("📋 Attendance Schema Validation")
    print("=" * 60)

    # 월 이름 → 숫자 변환 (날짜 정렬용)
    MONTH_ORDER = {
        'january': 1, 'february': 2, 'march': 3, 'april': 4,
        'may': 5, 'june': 6, 'july': 7, 'august': 8,
        'september': 9, 'october': 10, 'november': 11, 'december': 12
    }

    def get_config_date(config_path):
        """파일 이름에서 (year, month_num) 추출하여 날짜순 정렬 가능하게 함"""
        # config_december_2025.json → (2025, 12)
        name = config_path.stem  # config_december_2025
        parts = name.split('_')  # ['config', 'december', '2025']
        if len(parts) >= 3:
            month_name = parts[1].lower()
            year_num = int(parts[2])
            month_num = MONTH_ORDER.get(month_name, 0)
            return (year_num, month_num)
        return (0, 0)

    # 인자 처리
    if len(sys.argv) >= 3:
        month = sys.argv[1].lower()
        year = int(sys.argv[2])
    else:
        # 최신 config에서 월/년 자동 감지
        # BUG FIX (Issue #43): sorted()는 알파벳순 정렬! september > october > november > december
        # GitHub Actions에서 st_mtime은 체크아웃 시간으로 동일하므로 파일 이름에서 날짜 파싱 필요
        config_files = list(Path("config_files").glob("config_*_2025.json"))
        config_files_2026 = list(Path("config_files").glob("config_*_2026.json"))
        config_files.extend(config_files_2026)

        if config_files:
            # 파일 이름에서 날짜 파싱하여 정렬 (year, month 순)
            # 예: config_december_2025.json → (2025, 12)
            sorted_configs = sorted(config_files, key=get_config_date)

            # [Issue #57] 데이터가 실제 존재하는 최신 config 찾기
            # converted 출근 파일이 없는 월은 건너뜀 (데이터 미존재)
            month = None
            year = None
            for cfg_path in reversed(sorted_configs):
                with open(cfg_path) as f:
                    cfg = json.load(f)
                cfg_month = cfg.get('month', '')
                cfg_year = cfg.get('year', 2025)
                converted_path = f"input_files/attendance/converted/attendance data {cfg_month}_converted.csv"
                if Path(converted_path).exists():
                    month = cfg_month
                    year = cfg_year
                    print(f"ℹ️  자동 감지: {month} {year} (config: {cfg_path.name})")
                    break
                else:
                    print(f"⏭️  {cfg_month} {cfg_year} 건너뜀 (converted 파일 없음 - 데이터 미존재)")

            # 모든 config에 대해 converted 파일이 없는 경우
            if month is None:
                latest = sorted_configs[-1]
                with open(latest) as f:
                    config = json.load(f)
                month = config.get('month', 'december')
                year = config.get('year', 2025)
                print(f"⚠️  Fallback: {month} {year} (converted 파일 존재하는 config 없음)")
        else:
            month = 'december'
            year = 2025

    print(f"\n🔍 검증 대상: {month.capitalize()} {year}")
    print("-" * 60)

    # 1. Converted 파일 검증
    print("\n[1/2] Converted 출근 파일 검증...")
    converted_result = validate_converted_file(month, year)

    if converted_result['status'] == 'OK':
        print(f"   ✅ {converted_result['message']}")
        print(f"   📊 총 {converted_result['columns_found']}개 컬럼")
    elif converted_result['status'] == 'ERROR':
        print(f"   ❌ {converted_result['message']}")
        print(f"   🔧 필수 컬럼: {REQUIRED_BY_CALCULATOR}")
    else:
        print(f"   ⚠️  {converted_result['message']}")

    # 2. 출력 파일 검증
    print("\n[2/2] 계산 엔진 출력 검증...")
    output_result = validate_output_file(month, year)

    if output_result['status'] == 'OK':
        print(f"   ✅ {output_result['message']}")
    elif output_result['status'] == 'ERROR':
        print(f"   ❌ {output_result['message']}")
        print("   🚨 Issue #31 버그 가능성! 계산 엔진 확인 필요")
    else:
        print(f"   ⚠️  {output_result['message']}")

    # 결과 요약
    print("\n" + "=" * 60)
    all_ok = (converted_result['status'] == 'OK' and
              output_result['status'] in ['OK', 'WARNING'])

    if all_ok:
        print("✅ 스키마 검증 통과!")
        print(f"   - Approved Leave Days: {output_result['approved_leave_count']}명")
        print(f"   - 총 승인휴가: {output_result['approved_leave_total']}일")
        return 0
    else:
        print("❌ 스키마 검증 실패!")
        print("\n📖 참조: CLAUDE.md Issue #31 (계산 엔진 Approved Leave Days 미반영 버그)")
        return 1


if __name__ == '__main__':
    sys.exit(main())
