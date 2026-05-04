#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
AQL 사전 집계 데이터만 Firestore에 적재 (Cloud Function용)

pandas 의존성 없이 표준 csv 모듈만 사용. 전체 파이프라인 실행 없이
AQL CSV만 변환하여 aql_records/{month_year}에 업로드.

Usage:
    python scripts/upload_aql_records_only.py --month february --year 2026
    python scripts/upload_aql_records_only.py --all  # input_files/AQL history/ 내 모든 월 적재
"""

import os
import sys
import re
import csv
import json
import argparse
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.utils.firebase_common import init_firestore

AQL_DIR = "input_files/AQL history"


def discover_aql_months():
    """input_files/AQL history/에서 (month, year, filepath) 리스트 추출"""
    if not os.path.isdir(AQL_DIR):
        return []
    pat = re.compile(r"-([A-Z]+)\.(\d{4})\.csv$", re.IGNORECASE)
    out = []
    for fname in os.listdir(AQL_DIR):
        m = pat.search(fname)
        if m:
            month = m.group(1).lower()
            year = int(m.group(2))
            out.append((month, year, os.path.join(AQL_DIR, fname)))
    return sorted(out, key=lambda x: (x[1], x[0]))


def find_aql_file(month, year):
    """주어진 월/년의 AQL CSV 경로 찾기"""
    if not os.path.isdir(AQL_DIR):
        return None
    suffix = f"-{month.upper()}.{year}.csv"
    for fname in os.listdir(AQL_DIR):
        if fname.upper().endswith(suffix.upper()):
            return os.path.join(AQL_DIR, fname)
    return None


def safe_str(v, default=""):
    if v is None:
        return default
    s = str(v).strip()
    if not s or s.lower() == "nan":
        return default
    return s


def safe_int(v, default=0):
    s = safe_str(v)
    if not s:
        return default
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return default


def col(row, *names, default=""):
    """row dict에서 여러 후보 키 중 첫 매칭 반환"""
    for n in names:
        if n in row:
            v = safe_str(row[n])
            if v:
                return v
    return default


def csv_to_records(csv_path):
    """AQL CSV → records 리스트"""
    records = []
    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            emp_no = col(row, "EMPLOYEE NO", "Employee No")
            if not emp_no:
                continue
            try:
                emp_no = emp_no.split(".")[0].zfill(9)
            except Exception:
                pass

            result = col(row, "RESULT").upper()
            if result not in ("PASS", "FAIL"):
                continue

            records.append({
                "e": emp_no,
                "p1": col(row, "PO NO 1.", "PO NO 1"),
                "p2": col(row, "PO NO 2.", "PO NO 2"),
                "r": result,
                "b": col(row, "BUILDING"),
                "l": col(row, "LINE"),
                "m": col(row, "MODEL"),
                "q": safe_int(row.get("QTY", 0)),
                "d": col(row, "DATE"),
                "rp": col(row, "REPACKING ", "REPACKING") or "",
            })
    return records


def upload_for_month(db, month, year, csv_path):
    print(f"\n📥 {month} {year}")
    print(f"   파일: {os.path.basename(csv_path)}")

    records = csv_to_records(csv_path)
    print(f"   변환 완료: {len(records)}건")

    month_year = f"{month}_{year}"
    base_doc = {
        "month": month,
        "year": year,
        "total_rows": len(records),
        "generated_at": datetime.now(timezone.utc).isoformat() + "Z",
    }

    full_doc = dict(base_doc, records=records)
    size_estimate = len(json.dumps(full_doc, ensure_ascii=False).encode("utf-8"))
    print(f"   문서 크기 추정: {size_estimate / 1024:.1f} KB")

    try:
        if size_estimate > 900_000:
            chunk_size = 2000
            chunks = [records[i:i + chunk_size] for i in range(0, len(records), chunk_size)]
            base_ref = db.collection("aql_records").document(month_year)
            base_ref.set(dict(base_doc, chunk_count=len(chunks)))
            for i, chunk in enumerate(chunks):
                base_ref.collection("chunks").document(f"chunk_{i:03d}").set({
                    "index": i,
                    "records": chunk,
                })
            print(f"   ✅ aql_records/{month_year} 청크 {len(chunks)}개 업로드 완료")
        else:
            db.collection("aql_records").document(month_year).set(full_doc)
            print(f"   ✅ aql_records/{month_year} 업로드 완료 ({len(records)}건)")
    except Exception as e:
        print(f"   ❌ 업로드 실패: {e}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--month", help="월 이름 lowercase (예: february)")
    parser.add_argument("--year", type=int, help="연도 (예: 2026)")
    parser.add_argument("--all", action="store_true", help="모든 월 적재")
    args = parser.parse_args()

    db = init_firestore()

    if args.all:
        months = discover_aql_months()
        if not months:
            print("❌ AQL 파일을 찾을 수 없습니다.")
            sys.exit(1)
        print(f"📋 적재 대상: {len(months)}개 월")
        for m, y, path in months:
            upload_for_month(db, m, y, path)
    else:
        if not args.month or not args.year:
            parser.error("--month --year 또는 --all 옵션이 필요합니다.")
        path = find_aql_file(args.month.lower(), args.year)
        if not path:
            print(f"❌ {args.month} {args.year} AQL 파일이 없습니다.")
            sys.exit(1)
        upload_for_month(db, args.month.lower(), args.year, path)

    print("\n✅ 완료")


if __name__ == "__main__":
    main()
