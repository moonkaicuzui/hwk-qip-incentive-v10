#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Performance Utilities for QIP Dashboard
========================================
@PerformanceEngineer & @BackendEngineer 협업 개발

고성능 데이터 처리 유틸리티 함수들

사용법:
    from scripts.utils.performance_utils import (
        fast_iterate_df,
        fast_build_string,
        fast_filter_df,
        batch_process
    )

성능 개선:
    - .iterrows() → .itertuples() : 10배 빠름
    - 문자열 += → list.append() + join() : 3-5배 빠름
    - DataFrame 필터링 최적화 : 2-3배 빠름
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Callable, Any, Iterator, Tuple
from functools import wraps
import time


def timing_decorator(func):
    """함수 실행 시간 측정 데코레이터"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        end = time.perf_counter()
        print(f"⏱️ {func.__name__}: {end - start:.4f}초")
        return result
    return wrapper


def fast_iterate_df(df: pd.DataFrame, columns: List[str] = None) -> Iterator[Tuple]:
    """
    DataFrame 고속 반복 (iterrows() 대체)

    Args:
        df: 반복할 DataFrame
        columns: 필요한 컬럼 리스트 (None이면 전체)

    Yields:
        (index, namedtuple) 형태

    성능:
        .iterrows() 대비 10배 빠름

    예시:
        # 기존 (느림)
        for idx, row in df.iterrows():
            print(row['name'])

        # 개선 (빠름)
        for row in fast_iterate_df(df, ['name']):
            print(row.name)
    """
    if columns:
        df = df[columns]
    return df.itertuples(index=True, name='Row')


def fast_iterate_df_dict(df: pd.DataFrame, columns: List[str] = None) -> Iterator[Dict]:
    """
    DataFrame을 dict로 고속 반복 (row['col'] 형태 유지 필요시)

    Args:
        df: 반복할 DataFrame
        columns: 필요한 컬럼 리스트 (None이면 전체)

    Yields:
        dict 형태의 row

    성능:
        .iterrows() 대비 3-5배 빠름 (dict 변환 오버헤드 있음)
    """
    if columns:
        df = df[columns]
    records = df.to_dict('records')
    for i, record in enumerate(records):
        record['_index'] = df.index[i]
        yield record


def fast_build_string(items: List[str], separator: str = '') -> str:
    """
    문자열 고속 연결 (+= 대체)

    Args:
        items: 연결할 문자열 리스트
        separator: 구분자 (기본: 없음)

    Returns:
        연결된 문자열

    성능:
        += 대비 3-5배 빠름 (O(n²) → O(n))

    예시:
        # 기존 (느림)
        result = ''
        for item in items:
            result += f'<li>{item}</li>'

        # 개선 (빠름)
        parts = [f'<li>{item}</li>' for item in items]
        result = fast_build_string(parts)
    """
    return separator.join(items)


class FastStringBuilder:
    """
    고성능 문자열 빌더 클래스

    예시:
        builder = FastStringBuilder()
        for item in items:
            builder.append(f'<li>{item}</li>')
        result = builder.build()
    """

    def __init__(self, separator: str = ''):
        self.parts: List[str] = []
        self.separator = separator

    def append(self, s: str) -> 'FastStringBuilder':
        """문자열 추가"""
        self.parts.append(s)
        return self

    def extend(self, items: List[str]) -> 'FastStringBuilder':
        """여러 문자열 추가"""
        self.parts.extend(items)
        return self

    def build(self) -> str:
        """최종 문자열 생성"""
        return self.separator.join(self.parts)

    def __len__(self) -> int:
        return len(self.parts)


def fast_filter_df(df: pd.DataFrame, conditions: Dict[str, Any]) -> pd.DataFrame:
    """
    DataFrame 고속 필터링

    Args:
        df: 필터링할 DataFrame
        conditions: {컬럼명: 조건값} 또는 {컬럼명: (연산자, 값)}

    Returns:
        필터링된 DataFrame

    예시:
        # 단순 조건
        result = fast_filter_df(df, {'TYPE': 'TYPE-1', 'active': True})

        # 복합 조건
        result = fast_filter_df(df, {
            'age': ('>=', 30),
            'salary': ('<=', 100000),
            'dept': 'IT'
        })
    """
    mask = pd.Series([True] * len(df), index=df.index)

    for col, condition in conditions.items():
        if isinstance(condition, tuple):
            op, value = condition
            if op == '>=':
                mask &= df[col] >= value
            elif op == '<=':
                mask &= df[col] <= value
            elif op == '>':
                mask &= df[col] > value
            elif op == '<':
                mask &= df[col] < value
            elif op == '!=':
                mask &= df[col] != value
            elif op == 'in':
                mask &= df[col].isin(value)
            elif op == 'contains':
                mask &= df[col].str.contains(value, na=False)
        else:
            mask &= df[col] == condition

    return df[mask]


def batch_process(items: List, batch_size: int, processor: Callable) -> List:
    """
    배치 처리로 대용량 데이터 효율적 처리

    Args:
        items: 처리할 아이템 리스트
        batch_size: 배치 크기
        processor: 배치를 처리하는 함수

    Returns:
        처리된 결과 리스트

    예시:
        def process_batch(batch):
            return [item * 2 for item in batch]

        results = batch_process(large_list, 100, process_batch)
    """
    results = []
    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        batch_result = processor(batch)
        if isinstance(batch_result, list):
            results.extend(batch_result)
        else:
            results.append(batch_result)
    return results


def vectorized_condition_check(df: pd.DataFrame, column: str,
                               threshold: float, operator: str = '>=') -> pd.Series:
    """
    벡터화된 조건 검사 (루프 없이 전체 컬럼 처리)

    Args:
        df: DataFrame
        column: 검사할 컬럼
        threshold: 임계값
        operator: 비교 연산자

    Returns:
        Boolean Series

    성능:
        루프 대비 100배+ 빠름
    """
    operators = {
        '>=': lambda x, t: x >= t,
        '<=': lambda x, t: x <= t,
        '>': lambda x, t: x > t,
        '<': lambda x, t: x < t,
        '==': lambda x, t: x == t,
        '!=': lambda x, t: x != t,
    }

    if operator not in operators:
        raise ValueError(f"Unknown operator: {operator}")

    return operators[operator](df[column], threshold)


def cached_calculation(cache_key: str):
    """
    계산 결과 캐싱 데코레이터

    예시:
        @cached_calculation('employee_stats')
        def calculate_stats(df):
            return df.groupby('dept').agg({...})
    """
    _cache = {}

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            key = f"{cache_key}_{hash(str(args))}"
            if key not in _cache:
                _cache[key] = func(*args, **kwargs)
            return _cache[key]
        return wrapper
    return decorator


# HTML 생성 최적화 유틸리티
class HtmlBuilder:
    """
    고성능 HTML 생성기

    예시:
        html = HtmlBuilder()
        html.open_tag('div', {'class': 'container'})
        for item in items:
            html.tag('p', item)
        html.close_tag('div')
        result = html.build()
    """

    def __init__(self):
        self.parts: List[str] = []

    def add(self, content: str) -> 'HtmlBuilder':
        """원시 HTML 추가"""
        self.parts.append(content)
        return self

    def tag(self, name: str, content: str = '', attrs: Dict[str, str] = None) -> 'HtmlBuilder':
        """단일 태그 추가"""
        attrs_str = ''
        if attrs:
            attrs_str = ' ' + ' '.join(f'{k}="{v}"' for k, v in attrs.items())
        self.parts.append(f'<{name}{attrs_str}>{content}</{name}>')
        return self

    def open_tag(self, name: str, attrs: Dict[str, str] = None) -> 'HtmlBuilder':
        """여는 태그"""
        attrs_str = ''
        if attrs:
            attrs_str = ' ' + ' '.join(f'{k}="{v}"' for k, v in attrs.items())
        self.parts.append(f'<{name}{attrs_str}>')
        return self

    def close_tag(self, name: str) -> 'HtmlBuilder':
        """닫는 태그"""
        self.parts.append(f'</{name}>')
        return self

    def build(self) -> str:
        """최종 HTML 생성"""
        return ''.join(self.parts)


# 성능 측정 유틸리티
class PerformanceMonitor:
    """
    성능 모니터링 클래스

    예시:
        monitor = PerformanceMonitor()

        with monitor.measure('data_loading'):
            df = pd.read_csv(...)

        with monitor.measure('processing'):
            result = process(df)

        monitor.report()
    """

    def __init__(self):
        self.measurements: Dict[str, float] = {}

    class _Timer:
        def __init__(self, name: str, measurements: Dict):
            self.name = name
            self.measurements = measurements

        def __enter__(self):
            self.start = time.perf_counter()
            return self

        def __exit__(self, *args):
            elapsed = time.perf_counter() - self.start
            self.measurements[self.name] = elapsed

    def measure(self, name: str) -> '_Timer':
        """컨텍스트 매니저로 시간 측정"""
        return self._Timer(name, self.measurements)

    def report(self):
        """측정 결과 출력"""
        print("\n📊 Performance Report")
        print("=" * 40)
        total = sum(self.measurements.values())
        for name, elapsed in sorted(self.measurements.items(), key=lambda x: -x[1]):
            pct = (elapsed / total * 100) if total > 0 else 0
            print(f"  {name}: {elapsed:.4f}s ({pct:.1f}%)")
        print(f"  {'─' * 30}")
        print(f"  Total: {total:.4f}s")


# 편의 함수
def df_to_records(df: pd.DataFrame, columns: List[str] = None) -> List[Dict]:
    """
    DataFrame을 records 리스트로 변환 (iterrows 대체용)

    Args:
        df: 변환할 DataFrame
        columns: 필요한 컬럼만 선택

    Returns:
        dict 리스트
    """
    if columns:
        return df[columns].to_dict('records')
    return df.to_dict('records')


def parallel_apply(df: pd.DataFrame, func: Callable,
                   n_jobs: int = -1) -> pd.Series:
    """
    병렬 apply (대용량 데이터용)

    Note: joblib 필요 시 사용
    """
    try:
        from joblib import Parallel, delayed
        results = Parallel(n_jobs=n_jobs)(
            delayed(func)(row) for row in df.itertuples()
        )
        return pd.Series(results, index=df.index)
    except ImportError:
        # joblib 없으면 일반 apply 사용
        return df.apply(func, axis=1)


if __name__ == '__main__':
    # 테스트 코드
    print("Performance Utils Test")
    print("=" * 40)

    # 테스트 데이터
    df = pd.DataFrame({
        'name': ['Alice', 'Bob', 'Charlie'] * 1000,
        'age': [25, 30, 35] * 1000,
        'dept': ['IT', 'HR', 'IT'] * 1000
    })

    monitor = PerformanceMonitor()

    # iterrows vs itertuples 비교
    with monitor.measure('iterrows'):
        for idx, row in df.iterrows():
            _ = row['name']

    with monitor.measure('itertuples'):
        for row in df.itertuples():
            _ = row.name

    with monitor.measure('to_dict_records'):
        for record in df.to_dict('records'):
            _ = record['name']

    # 문자열 연결 비교
    items = ['item'] * 1000

    with monitor.measure('string_+='):
        result = ''
        for item in items:
            result += f'<li>{item}</li>'

    with monitor.measure('list_join'):
        parts = [f'<li>{item}</li>' for item in items]
        result = ''.join(parts)

    with monitor.measure('FastStringBuilder'):
        builder = FastStringBuilder()
        for item in items:
            builder.append(f'<li>{item}</li>')
        result = builder.build()

    monitor.report()
