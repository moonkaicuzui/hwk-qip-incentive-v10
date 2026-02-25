#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
공통 날짜 파싱 모듈
모든 모듈에서 일관된 날짜 처리를 위한 Single Source of Truth
"""

import pandas as pd
from datetime import datetime
from pandas.errors import OutOfBoundsDatetime
import re


class DateParser:
    """통합 날짜 파싱 클래스"""
    
    @staticmethod
    def parse_date(date_value):
        """
        다양한 형식의 날짜를 일관되게 파싱
        
        Args:
            date_value: 파싱할 날짜 값 (문자열, datetime, 또는 기타)
            
        Returns:
            pd.Timestamp 또는 pd.NaT
        """
        # Null 값 처리
        if pd.isna(date_value):
            return pd.NaT
            
        # 이미 datetime/Timestamp인 경우
        if isinstance(date_value, (datetime, pd.Timestamp)):
            return pd.Timestamp(date_value)
            
        # 문자열 처리
        if isinstance(date_value, str):
            date_value = date_value.strip()
            
            # 빈 문자열
            if not date_value:
                return pd.NaT
                
            # 한국식 날짜 형식 (YYYY.MM.DD)
            if '.' in date_value:
                # 2025.08.15 형식
                match = re.match(r'(\d{4})\.(\d{1,2})\.(\d{1,2})', date_value)
                if match:
                    try:
                        year, month, day = map(int, match.groups())
                        return pd.Timestamp(year, month, day)
                    except (ValueError, OutOfBoundsDatetime):
                        return pd.NaT
            
            # 슬래시 형식 처리
            if '/' in date_value:
                # M/D/YYYY 또는 MM/DD/YYYY 형식
                if date_value.count('/') == 2:
                    parts = date_value.split('/')
                    # 년도가 4자리인 부분 찾기
                    if len(parts[2]) == 4:  # MM/DD/YYYY
                        try:
                            month, day, year = map(int, parts)
                            return pd.Timestamp(year, month, day)
                        except (ValueError, OutOfBoundsDatetime):
                            return pd.NaT
                    elif len(parts[0]) == 4:  # YYYY/MM/DD
                        try:
                            year, month, day = map(int, parts)
                            return pd.Timestamp(year, month, day)
                        except (ValueError, OutOfBoundsDatetime):
                            return pd.NaT
                # M/D/YY 형식 (2자리 년도)
                else:
                    try:
                        return pd.to_datetime(date_value, format='%m/%d/%y')
                    except:
                        pass
            
            # ISO 형식 (YYYY-MM-DD)
            if '-' in date_value:
                try:
                    return pd.to_datetime(date_value, format='%Y-%m-%d')
                except:
                    pass
            
            # 마지막 시도: pandas 기본 파싱
            try:
                return pd.to_datetime(date_value, errors='coerce')
            except:
                return pd.NaT
                
        # 숫자형 (Excel 날짜 번호 등)
        if isinstance(date_value, (int, float)):
            try:
                # Excel 날짜 시리얼 번호 처리 (1900-01-01 = 1)
                if date_value > 25569:  # 1970-01-01 이후
                    return pd.Timestamp('1899-12-30') + pd.Timedelta(days=date_value)
                else:
                    return pd.NaT
            except:
                return pd.NaT
                
        return pd.NaT
    
    @staticmethod
    def parse_date_column(df, column_name):
        """
        DataFrame의 특정 날짜 컬럼을 일관되게 파싱
        
        Args:
            df: DataFrame
            column_name: 파싱할 컬럼명
            
        Returns:
            파싱된 날짜 Series
        """
        if column_name not in df.columns:
            return pd.Series([pd.NaT] * len(df), index=df.index)
            
        return df[column_name].apply(DateParser.parse_date)
    
    @staticmethod
    def standardize_dates(df, date_columns=None):
        """
        DataFrame의 모든 날짜 컬럼을 일관되게 파싱
        
        Args:
            df: DataFrame
            date_columns: 날짜 컬럼 리스트 (None이면 자동 감지)
            
        Returns:
            날짜가 표준화된 DataFrame
        """
        df = df.copy()
        
        # 날짜 컬럼 자동 감지
        if date_columns is None:
            date_columns = []
            for col in df.columns:
                if 'date' in col.lower() or 'Date' in col:
                    date_columns.append(col)
        
        # 각 날짜 컬럼 파싱
        for col in date_columns:
            if col in df.columns:
                df[col] = DateParser.parse_date_column(df, col)
                
        return df


# 테스트 함수
def test_date_parser():
    """날짜 파서 테스트"""
    test_cases = [
        ('2025.08.15', pd.Timestamp('2025-08-15')),
        ('2025-08-15', pd.Timestamp('2025-08-15')),
        ('8/15/2025', pd.Timestamp('2025-08-15')),
        ('08/15/2025', pd.Timestamp('2025-08-15')),
        ('2025/08/15', pd.Timestamp('2025-08-15')),
        ('', pd.NaT),
        (None, pd.NaT),
        (pd.NaT, pd.NaT),
        ('invalid', pd.NaT),
    ]
    
    print("=== 날짜 파서 테스트 ===")
    for input_val, expected in test_cases:
        result = DateParser.parse_date(input_val)
        status = "✅" if (pd.isna(result) and pd.isna(expected)) or result == expected else "❌"
        print(f"{status} Input: {repr(input_val):20} → Result: {result}")
        
    print("\n테스트 완료!")


if __name__ == "__main__":
    test_date_parser()