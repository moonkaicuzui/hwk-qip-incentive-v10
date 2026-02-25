#!/usr/bin/env python3
"""
AQL Inspector Config 자동 업데이트 스크립트
GitHub Actions workflow에서 인센티브 계산 후 자동 실행
"""

import json
import pandas as pd
import sys
from pathlib import Path
from datetime import datetime

def load_config():
    """기존 config 파일 로드"""
    config_path = Path("config_files/aql_inspector_incentive_config.json")

    if not config_path.exists():
        print(f"❌ ERROR: Config file not found: {config_path}")
        sys.exit(1)

    with open(config_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def find_latest_output_file(year, month_name):
    """최신 인센티브 계산 결과 파일 찾기"""
    output_dir = Path("output_files")

    # Version priority: V10.0 > V9.1 > V9.0 > V8.02 (통일된 fallback 패턴 2026-01-06)
    patterns = [
        f"output_QIP_incentive_{month_name}_{year}_Complete_V10.0_Complete.csv",
        f"output_QIP_incentive_{month_name}_{year}_Complete_V9.1_Complete.csv",
        f"output_QIP_incentive_{month_name}_{year}_Complete_V9.0_Complete.csv",
        f"output_QIP_incentive_{month_name}_{year}_Complete_V8.02_Complete.csv",
    ]

    for pattern in patterns:
        file_path = output_dir / pattern
        if file_path.exists():
            print(f"✅ Found output file: {file_path.name}")
            return file_path

    print(f"❌ ERROR: No output file found for {month_name} {year}")
    sys.exit(1)

def reverse_calculate_months(incentive, is_cfa_certified):
    """실제 지급액에서 Part1/Part3 개월 수 역산 (Fixed: 2025-11-29)

    핵심 로직: Part1과 Part3는 CFA 취득 후 동일하게 증가하므로,
    Part1 == Part3인 경우를 우선 탐색
    """

    # Part1 progression table (1-15 months)
    part1_table = {
        1: 150000, 2: 250000, 3: 300000, 4: 350000, 5: 400000,
        6: 450000, 7: 500000, 8: 650000, 9: 750000, 10: 850000,
        11: 950000, 12: 1000000, 13: 1000000, 14: 1000000, 15: 1000000
    }

    # Part3 HWK table (0-15 months)
    part3_table = {
        0: 0, 1: 0, 2: 0, 3: 0,
        4: 300000, 5: 300000, 6: 300000,
        7: 500000, 8: 500000, 9: 500000,
        10: 700000, 11: 700000, 12: 700000,
        13: 900000, 14: 900000, 15: 900000
    }

    # 조건 실패 (인센티브 0)
    if incentive == 0:
        return 0, 0  # Part1, Part3 모두 리셋

    # Part2 (CFA) 차감
    part2 = 700000 if is_cfa_certified else 0
    remaining = incentive - part2

    # 우선 탐색: Part1 == Part3 (CFA 취득 후 동시 증가하는 경우)
    for months in range(1, 16):
        if part1_table[months] + part3_table.get(months, 0) == remaining:
            return months, months

    # 차선 탐색: Part1 + Part3 조합 (다른 경우)
    for p1_months in range(1, 16):
        part1_amount = part1_table[p1_months]
        part3_amount_needed = remaining - part1_amount

        for p3_months in range(0, 16):
            if part3_table[p3_months] == part3_amount_needed:
                return p1_months, p3_months

    # 매칭 실패 시 보수적 추정 (Part1만 계산)
    for p1_months in range(15, 0, -1):
        if part1_table[p1_months] <= remaining:
            return p1_months, 0

    return 1, 1  # 기본값

def update_config_from_data(config, csv_path, month_name, year):
    """CSV 데이터에서 config 업데이트"""

    # CSV 파일 읽기
    df = pd.read_csv(csv_path)

    # Employee No를 문자열로 변환
    df['Employee No'] = df['Employee No'].astype(str)

    # AQL Inspector 필터링
    aql_inspectors = df[
        (df['ROLE TYPE STD'] == 'TYPE-1') &
        (df['QIP POSITION 1ST  NAME'] == 'AQL INSPECTOR')
    ]

    print(f"\n📊 Found {len(aql_inspectors)} AQL Inspectors in {month_name} {year} data")

    # 월 이름을 소문자로 변환 (config key로 사용)
    month_key = f"{month_name.lower()}_{year}_incentive"
    incentive_col = f"{month_name.capitalize()}_Incentive"

    updated_count = 0

    for emp_id, inspector_config in config['aql_inspectors'].items():
        # 직원 데이터 찾기
        emp_data = aql_inspectors[aql_inspectors['Employee No'] == str(emp_id)]

        if emp_data.empty:
            print(f"⚠️  {inspector_config['name']} ({emp_id}): No data found (resigned or position changed)")
            continue

        emp_row = emp_data.iloc[0]

        # 인센티브 읽기
        incentive = emp_row.get(incentive_col, 0)
        if pd.isna(incentive):
            incentive = 0
        else:
            incentive = int(incentive)

        # 실제 지급액 역산으로 Part1/Part3 개월 수 계산 (Fixed: 2025-11-26)
        part1_months, part3_months = reverse_calculate_months(
            incentive,
            inspector_config.get('cfa_certified', False)
        )

        # Config 업데이트
        new_data = {
            "part1_months": part1_months,
            "part3_months": part3_months,
            "total": incentive
        }

        inspector_config[month_key] = new_data

        print(f"✅ {inspector_config['name']} ({emp_id}): "
              f"Part1={part1_months}개월, Part3={part3_months}개월 → {incentive:,} VND")

        updated_count += 1

    print(f"\n✅ Updated {updated_count} AQL Inspectors")

    return config

def save_config(config):
    """업데이트된 config 저장"""
    config_path = Path("config_files/aql_inspector_incentive_config.json")

    # 백업 생성
    backup_path = config_path.with_suffix(f'.json.backup.{datetime.now().strftime("%Y%m%d_%H%M%S")}')
    if config_path.exists():
        import shutil
        shutil.copy2(config_path, backup_path)
        print(f"\n💾 Backup created: {backup_path.name}")

    # 저장
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

    print(f"✅ Config saved: {config_path}")

def main():
    """메인 함수"""

    if len(sys.argv) < 3:
        print("Usage: python auto_update_aql_config.py <month> <year>")
        print("Example: python auto_update_aql_config.py november 2025")
        sys.exit(1)

    month_name = sys.argv[1].lower()
    year = int(sys.argv[2])

    print("=" * 70)
    print(f"🔄 AQL Inspector Config Auto-Update")
    print(f"📅 Month: {month_name.capitalize()} {year}")
    print("=" * 70)

    # 1. Config 로드
    print("\n📂 Loading config...")
    config = load_config()

    # 2. 최신 output 파일 찾기
    print(f"\n🔍 Finding latest output file for {month_name} {year}...")
    csv_path = find_latest_output_file(year, month_name)

    # 3. Config 업데이트
    print(f"\n🔄 Updating config from {csv_path.name}...")
    config = update_config_from_data(config, csv_path, month_name, year)

    # 4. 저장
    print(f"\n💾 Saving updated config...")
    save_config(config)

    print("\n" + "=" * 70)
    print("✅ AQL Inspector config auto-update completed successfully!")
    print("=" * 70)

if __name__ == "__main__":
    main()
