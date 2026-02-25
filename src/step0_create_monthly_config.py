#!/usr/bin/env python3
"""
[STEP 0] 월별 Config 파일 생성기
새로운 월의 인센티브 계산을 위한 설정 파일을 쉽게 생성합니다.

터미널 실행 명령어:
python src/step0_create_monthly_config.py

실행 순서:
1. 이 파일 실행 (step0) - Config 생성
2. step1_인센티브_계산_개선버전.py - Excel/CSV 계산
3. step2_dashboard_version4.py - HTML 생성
"""

import json
from pathlib import Path
from datetime import datetime
import sys
import pandas as pd
import os

def get_month_names():
    """월 이름 매핑"""
    return {
        1: 'january', 2: 'february', 3: 'march', 4: 'april',
        5: 'may', 6: 'june', 7: 'july', 8: 'august',
        9: 'september', 10: 'october', 11: 'november', 12: 'december'
    }

def get_previous_months(month_num):
    """이전 2개월 가져오기"""
    months = get_month_names()
    
    # 이전 달 계산 (1월의 경우 12월로 순환)
    prev_month1_num = (month_num - 2) if month_num > 2 else (month_num + 10)
    prev_month2_num = (month_num - 1) if month_num > 1 else 12
    
    return [months[prev_month1_num], months[prev_month2_num]]

def create_config():
    """대화형으로 config 파일 생성"""
    
    print("=" * 60)
    print("📅 월별 인센티브 Config 파일 생성기")
    print("=" * 60)
    print()
    
    # 1. 연도 입력
    current_year = datetime.now().year
    year_input = input(f"📌 연도를 입력하세요 (기본값: {current_year}): ").strip()
    year = int(year_input) if year_input else current_year
    
    # 2. 월 선택
    print("\n📅 월을 선택하세요:")
    months = get_month_names()
    for num, name in months.items():
        print(f"  {num:2d}. {name.capitalize()}")
    
    while True:
        try:
            month_num = int(input("\n월 번호 입력 (1-12): "))
            if 1 <= month_num <= 12:
                break
            else:
                print("❌ 1-12 사이의 숫자를 입력하세요.")
        except ValueError:
            print("❌ 올바른 숫자를 입력하세요.")
    
    month_name = months[month_num]
    
    # 3. 근무일수 자동 계산 (attendance 파일에서)
    print(f"\n📊 {year}년 {month_num}월의 근무일수를 계산합니다...")

    # Attendance 파일 경로 확인 (여러 형식 시도)
    attendance_paths = [
        f"input_files/attendance/converted/attendance data {month_name}_converted.csv",
        f"input_files/attendance data {month_name}.csv",
        f"input_files/{year}년 {month_num}월 attendance.csv"
    ]

    working_days = None
    for attendance_file in attendance_paths:
        if os.path.exists(attendance_file):
            try:
                # Attendance 파일에서 실제 근무일 계산
                df_attendance = pd.read_csv(attendance_file)
                print(f"   📁 파일 찾음: {attendance_file}")

                # Date 컬럼이 있는 경우 고유한 날짜 수 계산
                date_columns = ['Date', 'Work Date', '날짜', 'date', 'DATE']
                for date_col in date_columns:
                    if date_col in df_attendance.columns:
                        # 날짜 파싱 (다양한 형식 지원)
                        df_attendance[date_col] = pd.to_datetime(
                            df_attendance[date_col],
                            errors='coerce',
                            format='%Y.%m.%d' if '.' in str(df_attendance[date_col].iloc[0]) else None
                        )

                        # 해당 월의 데이터만 필터링
                        month_data = df_attendance[
                            (df_attendance[date_col].dt.year == year) &
                            (df_attendance[date_col].dt.month == month_num)
                        ]

                        # 고유한 날짜 수 계산
                        unique_dates = month_data[date_col].dropna().dt.date.nunique()
                        if unique_dates > 0:
                            working_days = unique_dates
                            print(f"   ✅ Attendance 파일에서 자동 계산: {working_days}일")
                            print(f"      (컬럼: {date_col}, {year}년 {month_num}월 데이터)")
                            break
            except Exception as e:
                print(f"   ⚠️ 파일 읽기 실패 ({attendance_file}): {e}")
                continue

    # 자동 계산 실패 시 필수 입력 요구
    if working_days is None:
        print(f"   ❌ Attendance 파일에서 근무일을 계산할 수 없습니다.")
        print(f"   ⚠️ {month_num}월의 실제 근무일수를 반드시 입력해야 합니다.")
        print("   (주말과 공휴일을 제외한 실제 근무일)")

        while True:
            working_days_input = input("근무일수 입력 (필수): ").strip()
            if working_days_input:
                try:
                    working_days = int(working_days_input)
                    if 15 <= working_days <= 31:
                        print(f"   ✅ 설정된 근무일수: {working_days}일")
                        break
                    else:
                        print("   ❌ 근무일수는 15일에서 31일 사이여야 합니다.")
                except ValueError:
                    print("   ❌ 숫자를 입력해주세요.")
            else:
                print("   ❌ 근무일수는 필수 입력사항입니다. 기본값을 사용할 수 없습니다.")

    print(f"\n📅 {year}년 {month_num}월 근무일수: {working_days}일")
    
    # 4. 데이터 소스 선택
    print("\n📁 데이터 소스를 선택하세요:")
    print("  1. Google Drive (자동 다운로드)")
    print("  2. 로컬 파일 (input_files 폴더)")
    
    data_source = input("선택 (1 또는 2): ").strip()
    use_drive = (data_source == "1")
    
    # 5. 이전 월 자동 계산
    previous_months = get_previous_months(month_num)
    print(f"\n✅ AQL 연속 실패 체크를 위한 이전 월: {', '.join(previous_months)}")
    
    # 6. 파일 경로 설정
    if use_drive:
        print("\n🌐 Google Drive를 사용합니다.")
        print("   (Drive 설정은 drive_config.json에서 관리)")
        file_paths = {
            "basic_manpower": f"drive://monthly_data/{year}_{month_num:02d}/basic_manpower_data.csv",
            "attendance": f"drive://monthly_data/{year}_{month_num:02d}/attendance_data.csv",
            "5prs": f"drive://monthly_data/{year}_{month_num:02d}/5prs_data.csv",
            "aql_current": f"drive://aql_history/AQL_REPORT_{month_name.upper()}_{year}.csv",
            "aql_history": "drive://aql_history/"
        }
    else:
        print("\n📂 로컬 파일을 사용합니다.")
        file_paths = {
            "basic_manpower": f"input_files/basic manpower data {month_name}.csv",
            "attendance": f"input_files/attendance/converted/attendance data {month_name}_converted.csv",
            "5prs": f"input_files/5prs data {month_name}.csv",
            "aql_current": f"input_files/AQL history/1.HSRG AQL REPORT-{month_name.upper()}.{year}.csv",
            "aql_history": "input_files/AQL history/"
        }
    
    # 7. Config 생성
    config = {
        "year": year,
        "month": month_name,
        "working_days": working_days,
        "previous_months": previous_months,
        "file_paths": file_paths,
        "output_prefix": f"output_QIP_incentive_{month_name}_{year}",
        "created_at": datetime.now().isoformat(),
        "data_source": "google_drive" if use_drive else "local"
    }
    
    # 8. 파일 저장
    config_dir = Path(__file__).parent.parent / "config_files"
    config_dir.mkdir(exist_ok=True)
    
    config_filename = f"config_{month_name}_{year}.json"
    config_path = config_dir / config_filename
    
    # 기존 파일 확인
    if config_path.exists():
        overwrite = input(f"\n⚠️ {config_filename} 파일이 이미 존재합니다. 덮어쓸까요? (y/n): ")
        if overwrite.lower() != 'y':
            print("❌ 취소되었습니다.")
            return
    
    # 저장
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Config 파일이 생성되었습니다: {config_path}")
    
    # 9. 다음 단계 안내
    print("\n" + "=" * 60)
    print("📋 다음 단계:")
    print("=" * 60)
    
    if use_drive:
        print(f"""
1. Google Drive에 {month_num}월 데이터 업로드
2. 인센티브 계산 실행:
   python src/auto_run_with_drive.py --month {month_name} --year {year}
""")
    else:
        print(f"""
1. input_files 폴더에 {month_num}월 데이터 파일 준비
2. 인센티브 계산 실행:
   python src/인센티브_계산_개선버전.py --config config_files/{config_filename}
3. 대시보드 생성:
   python src/step2_dashboard_version4.py --month {month_name} --year {year}
""")
    
    # 10. Config 내용 미리보기
    print("\n📄 생성된 Config 내용:")
    print("-" * 40)
    print(json.dumps(config, indent=2, ensure_ascii=False))
    
    return config_path

def clean_old_configs():
    """오래된 config 파일 정리"""
    config_dir = Path(__file__).parent.parent / "config_files"
    
    # 삭제할 파일 목록
    files_to_delete = [
        "config_july_2025_documented.json",
        "drive_config_documented.json",
        "sample_july_config.json",
        "README_CONFIG.md"
    ]
    
    print("\n🗑️ 불필요한 config 파일 정리...")
    deleted_count = 0
    
    for filename in files_to_delete:
        file_path = config_dir / filename
        if file_path.exists():
            try:
                file_path.unlink()
                print(f"  ✅ 삭제됨: {filename}")
                deleted_count += 1
            except Exception as e:
                print(f"  ❌ 삭제 실패: {filename} - {e}")
    
    if deleted_count > 0:
        print(f"\n✅ {deleted_count}개 파일이 정리되었습니다.")
    else:
        print("  이미 정리되어 있습니다.")

def main():
    """메인 실행 함수"""
    try:
        # 옵션 메뉴
        print("\n🛠️ Config 관리 도구")
        print("=" * 40)
        print("1. 새로운 월 Config 생성")
        print("2. 불필요한 Config 파일 정리")
        print("3. 모두 실행")
        
        choice = input("\n선택 (1-3): ").strip()
        
        if choice == "1":
            create_config()
        elif choice == "2":
            clean_old_configs()
        elif choice == "3":
            clean_old_configs()
            print()
            create_config()
        else:
            print("❌ 잘못된 선택입니다.")
            
    except KeyboardInterrupt:
        print("\n\n❌ 사용자가 취소했습니다.")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()