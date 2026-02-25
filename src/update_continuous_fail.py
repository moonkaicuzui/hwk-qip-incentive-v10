#!/usr/bin/env python3
"""
Update 3-month consecutive AQL failure information in Excel file
Follows Single Source of Truth principle
Auto month detection and dynamic file loading
"""

import pandas as pd
from pathlib import Path
import numpy as np
import argparse
import json
from datetime import datetime
import calendar

# Month name mappings
MONTH_NAMES = {
    1: 'january', 2: 'february', 3: 'march', 4: 'april',
    5: 'may', 6: 'june', 7: 'july', 8: 'august',
    9: 'september', 10: 'october', 11: 'november', 12: 'december'
}

MONTH_NAMES_KR = {
    1: '1월', 2: '2월', 3: '3월', 4: '4월',
    5: '5월', 6: '6월', 7: '7월', 8: '8월',
    9: '9월', 10: '10월', 11: '11월', 12: '12월'
}

MONTH_NAMES_UPPER = {
    1: 'JANUARY', 2: 'FEBRUARY', 3: 'MARCH', 4: 'APRIL',
    5: 'MAY', 6: 'JUNE', 7: 'JULY', 8: 'AUGUST',
    9: 'SEPTEMBER', 10: 'OCTOBER', 11: 'NOVEMBER', 12: 'DECEMBER'
}

def get_previous_months(current_month, current_year, num_months=2):
    """Calculate previous N months from current month"""
    months = []
    month = current_month
    year = current_year

    for _ in range(num_months):
        month -= 1
        if month < 1:
            month = 12
            year -= 1
        months.append((month, year))

    return list(reversed(months))  # From oldest to newest

def find_aql_file(month_num, year, aql_dir):
    """Find AQL file for given month (supports various formats)"""
    month_upper = MONTH_NAMES_UPPER[month_num]

    # Possible file name patterns
    patterns = [
        f'1.HSRG AQL REPORT-{month_upper}.{year}.csv',
        f'HSRG AQL REPORT-{month_upper}.{year}.csv',
        f'AQL REPORT-{month_upper}.{year}.csv',
        f'aql_report_{MONTH_NAMES[month_num]}_{year}.csv',
    ]

    for pattern in patterns:
        file_path = aql_dir / pattern
        if file_path.exists():
            return file_path

    # File not found
    return None

def analyze_consecutive_failures(current_month, current_year):
    """
    Analyze 3-month consecutive AQL failures based on current month

    Args:
        current_month: Current month (1-12)
        current_year: Current year

    Returns:
        Analysis result dictionary
    """

    print("=" * 80)
    print(f"📊 3-Month Consecutive AQL Failure Analysis - {current_year} {MONTH_NAMES_KR[current_month]}")
    print("=" * 80)

    # AQL history directory
    aql_dir = Path('input_files/AQL history')

    if not aql_dir.exists():
        raise FileNotFoundError(f"AQL history directory not found: {aql_dir}")

    # Calculate previous 2 months
    prev_months = get_previous_months(current_month, current_year, num_months=2)
    month_2_ago = prev_months[0]  # 2 months ago
    month_1_ago = prev_months[1]  # 1 month ago

    print(f"\n📅 Target months for analysis:")
    print(f"  2 months ago: {month_2_ago[1]} {MONTH_NAMES_KR[month_2_ago[0]]}")
    print(f"  1 month ago:  {month_1_ago[1]} {MONTH_NAMES_KR[month_1_ago[0]]}")
    print(f"  Current:      {current_year} {MONTH_NAMES_KR[current_month]}")

    # Find AQL files
    file_month2 = find_aql_file(month_2_ago[0], month_2_ago[1], aql_dir)
    file_month1 = find_aql_file(month_1_ago[0], month_1_ago[1], aql_dir)
    file_current = find_aql_file(current_month, current_year, aql_dir)

    # Check file existence
    files_info = {
        'month_2_ago': (month_2_ago, file_month2),
        'month_1_ago': (month_1_ago, file_month1),
        'current_month': ((current_month, current_year), file_current)
    }

    print(f"\n📁 AQL file check:")
    for key, (month_info, file_path) in files_info.items():
        month_num, year = month_info
        status = "✅" if file_path else "❌"
        file_name = file_path.name if file_path else "File not found"
        print(f"  {status} {year} {MONTH_NAMES_KR[month_num]}: {file_name}")

    # Function to extract FAIL records
    def get_fail_employees(df):
        if df is None or df.empty:
            return set()
        fail_df = df[df['RESULT'].str.upper() == 'FAIL']
        emp_ids = fail_df['EMPLOYEE NO'].astype(str).str.strip().str.replace(r'\.0$', '', regex=True)
        return set(emp_ids.unique())

    # Load data for each month
    df_month2 = pd.read_csv(file_month2, encoding='utf-8-sig') if file_month2 else pd.DataFrame()
    df_month1 = pd.read_csv(file_month1, encoding='utf-8-sig') if file_month1 else pd.DataFrame()
    df_current = pd.read_csv(file_current, encoding='utf-8-sig') if file_current else pd.DataFrame()

    # Extract failures
    fails_month2 = get_fail_employees(df_month2)
    fails_month1 = get_fail_employees(df_month1)
    fails_current = get_fail_employees(df_current)

    print(f"\n📈 Monthly failures:")
    print(f"  {MONTH_NAMES_KR[month_2_ago[0]]}: {len(fails_month2)} employees")
    print(f"  {MONTH_NAMES_KR[month_1_ago[0]]}: {len(fails_month1)} employees")
    print(f"  {MONTH_NAMES_KR[current_month]}: {len(fails_current)} employees")

    # Consecutive failure analysis
    consecutive_2month_old = fails_month2 & fails_month1  # 2 months ago + 1 month ago
    consecutive_2month_recent = fails_month1 & fails_current  # 1 month ago + current month
    consecutive_3month = fails_month2 & fails_month1 & fails_current  # All 3 months

    # Generate month name tags
    month2_name = MONTH_NAMES_UPPER[month_2_ago[0]][:3]  # JUL, AUG, etc.
    month1_name = MONTH_NAMES_UPPER[month_1_ago[0]][:3]
    current_name = MONTH_NAMES_UPPER[current_month][:3]

    print(f"\n🔗 Consecutive failure analysis:")
    print(f"  {MONTH_NAMES_KR[month_2_ago[0]]}-{MONTH_NAMES_KR[month_1_ago[0]]} consecutive: {len(consecutive_2month_old)} employees")
    print(f"  {MONTH_NAMES_KR[month_1_ago[0]]}-{MONTH_NAMES_KR[current_month]} consecutive: {len(consecutive_2month_recent)} employees")
    print(f"  {MONTH_NAMES_KR[month_2_ago[0]]}-{MONTH_NAMES_KR[month_1_ago[0]]}-{MONTH_NAMES_KR[current_month]} 3-month consecutive: {len(consecutive_3month)} employees")

    # Create result dictionary
    result = {
        'month_2_ago': month_2_ago,
        'month_1_ago': month_1_ago,
        'current_month': (current_month, current_year),
        'fails_month2': fails_month2,
        'fails_month1': fails_month1,
        'fails_current': fails_current,
        'consecutive_2month_old': consecutive_2month_old,
        'consecutive_2month_recent': consecutive_2month_recent,
        'consecutive_3month': consecutive_3month,
        'tag_2month_old': f'YES_2MONTHS_{month2_name}_{month1_name}',
        'tag_2month_recent': f'YES_2MONTHS_{month1_name}_{current_name}',
        'tag_3month': 'YES_3MONTHS'
    }

    return result

def update_excel_with_continuous_fail(excel_path, analysis_result):
    """Update Continuous_FAIL column in Excel file"""

    print(f"\n📝 Updating Excel file: {excel_path}")

    # Load Excel file
    df = pd.read_csv(excel_path, encoding='utf-8-sig')

    # Standardize Employee No
    df['emp_no_str'] = df['Employee No'].astype(str).str.strip().str.replace(r'\.0$', '', regex=True)

    # Initialize Continuous_FAIL column
    df['Continuous_FAIL'] = 'NO'

    # Mark 3-month consecutive failures
    consecutive_3month_count = 0
    for emp_id in analysis_result['consecutive_3month']:
        mask = df['emp_no_str'] == emp_id
        if mask.any():
            df.loc[mask, 'Continuous_FAIL'] = analysis_result['tag_3month']
            consecutive_3month_count += 1

    # Mark 2-month consecutive failures
    consecutive_2month_count = 0

    # Recent 2-month consecutive (1 month ago + current month)
    for emp_id in analysis_result['consecutive_2month_recent']:
        if emp_id not in analysis_result['consecutive_3month']:  # Only if not 3-month consecutive
            mask = df['emp_no_str'] == emp_id
            if mask.any():
                df.loc[mask, 'Continuous_FAIL'] = analysis_result['tag_2month_recent']
                consecutive_2month_count += 1

    # Old 2-month consecutive (2 months ago + 1 month ago)
    for emp_id in analysis_result['consecutive_2month_old']:
        if emp_id not in analysis_result['consecutive_3month'] and emp_id not in analysis_result['consecutive_2month_recent']:
            mask = df['emp_no_str'] == emp_id
            if mask.any():
                df.loc[mask, 'Continuous_FAIL'] = analysis_result['tag_2month_old']
                consecutive_2month_count += 1

    # Add Consecutive_Fail_Months column
    df['Consecutive_Fail_Months'] = 0

    # 3-month consecutive
    df.loc[df['Continuous_FAIL'] == 'YES_3MONTHS', 'Consecutive_Fail_Months'] = 3

    # 2-month consecutive
    df.loc[df['Continuous_FAIL'].str.contains('2MONTHS', na=False), 'Consecutive_Fail_Months'] = 2

    # Current month only (1 month)
    current_only_fails = analysis_result['fails_current'] - analysis_result['consecutive_2month_recent']
    for emp_id in current_only_fails:
        mask = df['emp_no_str'] == emp_id
        if mask.any():
            df.loc[mask, 'Consecutive_Fail_Months'] = 1

    month_2_ago = analysis_result['month_2_ago']
    month_1_ago = analysis_result['month_1_ago']
    current_month = analysis_result['current_month']

    # [Issue #59 Fix] Continuous_FAIL_2Month 컬럼 업데이트 (대시보드 모달에서 사용)
    # 대시보드 JavaScript: emp['Continuous_FAIL_2Month'] === 'YES' 로 필터링
    if 'Continuous_FAIL_2Month' not in df.columns:
        df['Continuous_FAIL_2Month'] = 'NO'
    else:
        df['Continuous_FAIL_2Month'] = 'NO'  # 먼저 모두 NO로 초기화

    # 2개월 연속 실패자만 YES 설정 (3개월 연속은 별도 카운트)
    df.loc[df['Continuous_FAIL'].str.contains('2MONTHS', na=False), 'Continuous_FAIL_2Month'] = 'YES'
    df.loc[df['Continuous_FAIL'] == 'YES_3MONTHS', 'Continuous_FAIL_2Month'] = 'NO'  # 3개월은 제외

    two_month_count = (df['Continuous_FAIL_2Month'] == 'YES').sum()
    print(f"\n  [Issue #59] Continuous_FAIL_2Month 컬럼 업데이트: {two_month_count}명")

    print(f"\n✅ Update results:")
    print(f"  3-month consecutive failures ({MONTH_NAMES_KR[month_2_ago[0]]}-{MONTH_NAMES_KR[month_1_ago[0]]}-{MONTH_NAMES_KR[current_month[0]]}): {consecutive_3month_count} employees")
    print(f"  2-month consecutive failures (total): {consecutive_2month_count} employees")
    print(f"    - {MONTH_NAMES_KR[month_1_ago[0]]}-{MONTH_NAMES_KR[current_month[0]]} consecutive: {len(analysis_result['consecutive_2month_recent'])} employees")
    print(f"    - {MONTH_NAMES_KR[month_2_ago[0]]}-{MONTH_NAMES_KR[month_1_ago[0]]} consecutive: {len(analysis_result['consecutive_2month_old'])} employees")
    print(f"  Continuous_FAIL column update completed")

    # Remove temporary emp_no_str column
    df = df.drop(columns=['emp_no_str'])

    return df

def find_excel_file(month, year):
    """Automatically find Excel file for given month/year"""
    output_dir = Path('output_files')
    month_name = MONTH_NAMES[month]

    # Possible file name patterns (우선순위 순서)
    patterns = [
        # V9.0 메인 파일 (최우선)
        f'output_QIP_incentive_{month_name}_{year}_Complete_V9.0_Complete.csv',
        # V8.02 fallback
        f'output_QIP_incentive_{month_name}_{year}_Complete_V8.02_Complete.csv',
        # 이전 버전들
        f'output_QIP_incentive_{month_name}_{year}_최종완성버전_v6.0_Complete.csv',
        f'output_QIP_incentive_{month_name}_{year}_Complete.csv',
        f'output_QIP_incentive_{month}_{year}_최종완성버전_v6.0_Complete.csv',
        f'output_QIP_incentive_{month:02d}_{year}_Complete.csv',
    ]

    for pattern in patterns:
        file_path = output_dir / pattern
        if file_path.exists():
            print(f"ℹ️  Found target file: {file_path.name}")
            return file_path

    # Wildcard search (backup 파일 제외)
    possible_files = list(output_dir.glob(f'*{month_name}*{year}*.csv'))
    # backup 파일 제외하고 정렬
    main_files = [f for f in possible_files if 'backup' not in f.name.lower()]
    if main_files:
        # 파일명이 가장 짧은 것 선택 (메인 파일이 보통 짧음)
        target_file = min(main_files, key=lambda f: len(f.name))
        print(f"ℹ️  Found target file (wildcard): {target_file.name}")
        return target_file

    return None

def load_config(month, year):
    """Load month information from config file"""
    month_name = MONTH_NAMES[month]
    config_path = Path(f'config_files/config_{month_name}_{year}.json')

    if config_path.exists():
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

def main():
    """Main execution function"""

    parser = argparse.ArgumentParser(description='3-month consecutive AQL failure analysis and Excel update')
    parser.add_argument('--month', type=str, help='Month (e.g., september or 9)')
    parser.add_argument('--year', type=int, help='Year (e.g., 2025)')

    args = parser.parse_args()

    # Determine month/year
    if args.month and args.year:
        # Convert month name to number
        if args.month.isdigit():
            month_num = int(args.month)
        else:
            month_lower = args.month.lower()
            month_num = next((k for k, v in MONTH_NAMES.items() if v == month_lower), None)
            if month_num is None:
                print(f"❌ Invalid month name: {args.month}")
                return

        year = args.year
    else:
        # Find most recent config file
        config_dir = Path('config_files')
        config_files = list(config_dir.glob('config_*.json'))

        if not config_files:
            print("❌ Config file not found.")
            print("Usage: python update_continuous_fail_column.py --month september --year 2025")
            return

        # Most recent config file
        latest_config = max(config_files, key=lambda p: p.stat().st_mtime)

        with open(latest_config, 'r', encoding='utf-8') as f:
            config = json.load(f)

        year = config['year']
        month_name = config['month'].lower()
        month_num = next((k for k, v in MONTH_NAMES.items() if v == month_name), None)

        print(f"ℹ️  Auto-detected from config file: {year} {MONTH_NAMES_KR[month_num]}")

    # 3-month consecutive failure analysis
    analysis_result = analyze_consecutive_failures(month_num, year)

    # Find Excel file path
    excel_path = find_excel_file(month_num, year)

    if not excel_path:
        print(f"\n❌ Excel file not found.")
        print(f"Expected path: output_files/output_QIP_incentive_{MONTH_NAMES[month_num]}_{year}_*.csv")
        return

    print(f"\n✅ Excel file found: {excel_path.name}")

    # Update Excel
    updated_df = update_excel_with_continuous_fail(excel_path, analysis_result)

    # Create backup
    backup_path = excel_path.with_suffix('.backup.csv')
    pd.read_csv(excel_path, encoding='utf-8-sig').to_csv(backup_path, index=False, encoding='utf-8-sig')
    print(f"\n💾 Backup created: {backup_path.name}")

    # Save updated file
    updated_df.to_csv(excel_path, index=False, encoding='utf-8-sig')
    print(f"💾 Excel file update completed: {excel_path.name}")

    # Also create Excel XLSX file
    excel_xlsx_path = excel_path.with_suffix('.xlsx')
    updated_df.to_excel(excel_xlsx_path, index=False, engine='openpyxl')
    print(f"💾 Excel XLSX file also updated: {excel_xlsx_path.name}")

    # Verification
    print("\n🔍 Verification:")
    print(f"  Continuous_FAIL = 'YES_3MONTHS': {(updated_df['Continuous_FAIL'] == 'YES_3MONTHS').sum()} employees")
    print(f"  Consecutive_Fail_Months = 3: {(updated_df['Consecutive_Fail_Months'] == 3).sum()} employees")
    print(f"  Consecutive_Fail_Months = 2: {(updated_df['Consecutive_Fail_Months'] == 2).sum()} employees")

    # Sample output
    sample = updated_df[updated_df['Consecutive_Fail_Months'] > 0][['Employee No', 'Full Name', 'Continuous_FAIL', 'Consecutive_Fail_Months']].head(10)
    if not sample.empty:
        print(f"\n📋 Sample data (consecutive failures):")
        print(sample.to_string(index=False))

    print("\n" + "=" * 80)
    print("✅ Single Source of Truth principle followed:")
    print("  - Analyzed actual data from AQL history files")
    print("  - Automatically calculated previous 2 months and loaded files")
    print("  - Saved results to Excel file")
    print("  - Dashboard references Excel file")
    print("=" * 80)

if __name__ == "__main__":
    main()
