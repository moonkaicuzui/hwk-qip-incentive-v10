#!/usr/bin/env python3
"""
Attendance data conversion script
Converts raw daily attendance data to aggregated per-employee format

Input format (raw):
  - Work Date, Personnel Number, Attendance Name, Reason Description, ...

Output format (aggregated):
  - ID No, ACTUAL WORK DAY, TOTAL WORK DAY, AR1 Absences, Approved Leave Days, Absence Rate (%), ...
"""

import pandas as pd
import os
import sys
import json
from pathlib import Path
from datetime import datetime


def load_config(month: str, year: int = 2025) -> dict:
    """Load config file to get working days"""
    base_dir = Path(__file__).parent.parent
    config_file = base_dir / f"config_files/config_{month}_{year}.json"

    if config_file.exists():
        with open(config_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def aggregate_attendance(df: pd.DataFrame, total_working_days: int = None) -> pd.DataFrame:
    """
    Aggregate raw daily attendance data to per-employee summary

    Args:
        df: Raw attendance DataFrame with daily records
        total_working_days: Total working days in the month (from config)

    Returns:
        Aggregated DataFrame with per-employee attendance summary
    """
    # Clean column names
    df.columns = df.columns.str.strip()

    # Identify employee ID column
    emp_col = None
    for col in ['Personnel Number', 'Employee No', 'ID No', 'EMPLOYEE NO']:
        if col in df.columns:
            emp_col = col
            break

    if not emp_col:
        print(f"❌ Employee ID column not found. Available: {df.columns.tolist()}")
        return pd.DataFrame()

    # Calculate total working days from data if not provided
    if total_working_days is None:
        total_working_days = df['Work Date'].nunique()

    print(f"  📅 Total working days: {total_working_days}")

    # Aggregate per employee
    results = []

    for emp_id in df[emp_col].unique():
        if pd.isna(emp_id):
            continue

        emp_data = df[df[emp_col] == emp_id]
        emp_name = emp_data['Last name'].iloc[0] if 'Last name' in emp_data.columns else ''

        # Count actual working days (Đi làm)
        actual_days = len(emp_data[emp_data['Attendance Name'] == 'Đi làm'])

        # Count absences by type
        absences = emp_data[emp_data['Attendance Name'] == 'Vắng mặt']

        # AR1 (unapproved) absences - reason starts with 'AR1'
        ar1_absences = len(absences[absences['Reason Description'].fillna('').str.startswith('AR1')])

        # Approved leave (all other absences)
        approved_leave = len(absences) - ar1_absences

        # Count Come Late and Leave Early days
        # Values > 0 indicate late arrival or early departure (in minutes)
        come_late_days = 0
        leave_early_days = 0

        if 'Come late' in emp_data.columns:
            # Count days where Come late > 0
            come_late_days = len(emp_data[pd.to_numeric(emp_data['Come late'], errors='coerce').fillna(0) > 0])

        if 'Leave early' in emp_data.columns:
            # Count days where Leave early > 0
            leave_early_days = len(emp_data[pd.to_numeric(emp_data['Leave early'], errors='coerce').fillna(0) > 0])

        # Calculate rates
        # 출근율 = 100 - (무단결근일 / 총근무일 × 100)
        # 승인휴가는 출근으로 인정
        absence_days = total_working_days - actual_days - approved_leave
        if absence_days < 0:
            absence_days = 0

        absence_rate = (absence_days / total_working_days * 100) if total_working_days > 0 else 0
        attendance_rate = 100 - absence_rate

        results.append({
            'ID No': str(emp_id).zfill(9),  # Standardize to 9 digits
            'Last name': emp_name,
            'ACTUAL WORK DAY': actual_days,
            'TOTAL WORK DAY': total_working_days,
            'AR1 Absences': ar1_absences,
            'Unapproved Absences': ar1_absences,  # Same as AR1 for compatibility
            'Approved Leave Days': approved_leave,
            'Absence Rate (%)': round(absence_rate, 2),
            'Attendance Rate (%)': round(attendance_rate, 2),
            'Come Late Days': come_late_days,        # 지각 일수
            'Leave Early Days': leave_early_days     # 조퇴 일수
        })

    result_df = pd.DataFrame(results)
    print(f"  👥 Aggregated {len(result_df)} employees")

    return result_df


def update_config_working_days(month: str, year: int, actual_working_days: int) -> bool:
    """
    Update config file with actual working days from attendance data
    This ensures Config is always in sync with the actual data (SSOT principle)

    Args:
        month: Month name (e.g., 'january')
        year: Year (e.g., 2026)
        actual_working_days: Actual working days calculated from attendance data

    Returns:
        bool: True if updated, False if no change needed
    """
    base_dir = Path(__file__).parent.parent
    config_file = base_dir / f"config_files/config_{month}_{year}.json"

    if not config_file.exists():
        print(f"  ⚠️ Config file not found: {config_file}")
        return False

    with open(config_file, 'r', encoding='utf-8') as f:
        config = json.load(f)

    old_days = config.get('working_days', None)

    if old_days != actual_working_days:
        config['working_days'] = actual_working_days
        config['working_days_source'] = 'attendance_data_ssot'
        config['working_days_updated_at'] = datetime.now().isoformat()

        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)

        print(f"  🔄 [SSOT] Config working_days 자동 업데이트: {old_days} → {actual_working_days}")
        return True

    return False


def convert_attendance(month: str, year: int = 2025) -> bool:
    """
    Convert raw daily attendance data to aggregated format

    [Issue #51 - SSOT Architecture]
    원본 attendance 데이터의 실제 근무일수를 Single Source of Truth로 사용.
    Config 파일은 캐시로만 활용하고, 불일치 시 자동 업데이트.

    Args:
        month: Month name (e.g., 'july', 'august', 'december')
        year: Year (default: 2025)

    Returns:
        bool: Success status
    """
    try:
        print(f"\n📊 Converting attendance data for {month.capitalize()} {year}...")

        # Set paths
        base_dir = Path(__file__).parent.parent
        original_file = base_dir / f"input_files/attendance/original/attendance data {month}.csv"
        converted_file = base_dir / f"input_files/attendance/converted/attendance data {month}_converted.csv"

        # Create converted folder
        converted_file.parent.mkdir(parents=True, exist_ok=True)

        # Skip if original file doesn't exist
        if not original_file.exists():
            print(f"  ⚠️ Original file not found: {original_file}")
            return False

        # ============================================================
        # [SSOT] Step 1: 원본 데이터에서 실제 근무일수 계산 (Single Source of Truth)
        # ============================================================
        df_preview = pd.read_csv(original_file, encoding='utf-8-sig')
        actual_working_days = df_preview['Work Date'].nunique()
        print(f"  📅 [SSOT] 원본 데이터 실제 근무일: {actual_working_days}일")

        # ============================================================
        # [SSOT] Step 2: Config 파일 자동 동기화
        # ============================================================
        config = load_config(month, year)
        config_working_days = config.get('working_days', None)

        if config_working_days != actual_working_days:
            print(f"  ⚠️ [SSOT] 불일치 감지: Config({config_working_days}일) ≠ 원본({actual_working_days}일)")
            update_config_working_days(month, year, actual_working_days)

        # 항상 원본 데이터의 값을 사용 (SSOT)
        total_working_days = actual_working_days

        # ============================================================
        # [SSOT] Step 3: Converted 파일 검증 및 재변환 판단
        # ============================================================
        if converted_file.exists():
            original_mtime = original_file.stat().st_mtime
            converted_mtime = converted_file.stat().st_mtime

            if converted_mtime >= original_mtime:
                try:
                    existing = pd.read_csv(converted_file, nrows=5, encoding='utf-8-sig')
                    if 'ACTUAL WORK DAY' in existing.columns and 'TOTAL WORK DAY' in existing.columns:
                        existing_total_days = int(existing['TOTAL WORK DAY'].iloc[0])

                        # [SSOT] Converted 파일도 원본과 비교
                        if existing_total_days == actual_working_days:
                            print(f"  ✅ [SSOT] 모든 데이터 동기화됨: {actual_working_days}일")
                            return True
                        else:
                            print(f"  🔄 [SSOT] Converted 파일 불일치: {existing_total_days} → {actual_working_days}")
                            print(f"     강제 재변환 실행...")
                except Exception as e:
                    print(f"  ⚠️ Could not validate existing file: {e}")

            print(f"  🔄 Reconverting: {original_file.name}")

        # Read raw CSV file (이미 위에서 읽었으므로 재사용)
        df = df_preview
        print(f"  📂 Loaded {len(df)} daily records")

        # Check if already in aggregated format
        if 'ACTUAL WORK DAY' in df.columns:
            print(f"  ℹ️ File already in aggregated format")
            df.to_csv(converted_file, index=False, encoding='utf-8-sig')
            return True

        # Aggregate the data
        aggregated_df = aggregate_attendance(df, total_working_days)

        if aggregated_df.empty:
            print(f"  ❌ Failed to aggregate data")
            return False

        # Save converted file
        aggregated_df.to_csv(converted_file, index=False, encoding='utf-8-sig')
        print(f"  ✅ Saved: {converted_file.name}")

        # Print summary
        print(f"\n  📈 Summary:")
        print(f"     - Employees: {len(aggregated_df)}")
        print(f"     - Avg actual days: {aggregated_df['ACTUAL WORK DAY'].mean():.1f}")
        print(f"     - Avg attendance rate: {aggregated_df['Attendance Rate (%)'].mean():.1f}%")
        print(f"     - Employees with AR1 absences: {(aggregated_df['AR1 Absences'] > 0).sum()}")
        if 'Come Late Days' in aggregated_df.columns:
            print(f"     - Employees with late arrivals: {(aggregated_df['Come Late Days'] > 0).sum()}")
        if 'Leave Early Days' in aggregated_df.columns:
            print(f"     - Employees with early departures: {(aggregated_df['Leave Early Days'] > 0).sum()}")

        return True

    except Exception as e:
        print(f"  ❌ Conversion failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def convert_all_attendance(year: int = 2025):
    """Convert attendance data for all months"""
    months = ['january', 'february', 'march', 'april', 'may', 'june',
              'july', 'august', 'september', 'october', 'november', 'december']

    success_count = 0
    for month in months:
        if convert_attendance(month, year):
            success_count += 1

    print(f"\n✅ Converted {success_count}/{len(months)} months")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        month = sys.argv[1].lower()
        year = int(sys.argv[2]) if len(sys.argv) > 2 else 2025
        convert_attendance(month, year)
    else:
        # Convert all months
        convert_all_attendance()
