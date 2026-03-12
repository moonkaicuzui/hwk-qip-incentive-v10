#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Stale month detector — compares Google Drive file modification times
(from config files) against Firestore dashboard_summary.data_updated_at.

If Google Drive data is newer than Firestore (or Firestore has no data),
the month is marked as stale.

Usage:
    python scripts/detect_stale_months.py

Output (stdout):
    Space-separated list: "month_name:year:config_path ..."
    Empty if nothing is stale.

Exit code: always 0.
"""

import os
import sys
import json
import glob
import re
from datetime import datetime, timezone, timedelta

# Add project root to path for utils import
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)


def log(msg):
    """Print diagnostic info to stderr."""
    print(msg, file=sys.stderr)


def parse_datetime(value):
    """Parse a datetime from various formats.

    Handles:
      - ISO format strings (with or without Z, with or without timezone)
      - Firestore Timestamp objects (.isoformat() or DatetimeWithNanoseconds)
      - None / missing → returns None

    Always returns a timezone-aware UTC datetime or None.
    """
    if value is None:
        return None

    # Firestore Timestamp / DatetimeWithNanoseconds objects
    if hasattr(value, "timestamp"):
        # Already a datetime-like object
        dt = value
        if hasattr(dt, "tzinfo") and dt.tzinfo is not None:
            return dt.astimezone(timezone.utc)
        # Assume UTC if naive
        return dt.replace(tzinfo=timezone.utc)

    if not isinstance(value, str):
        return None

    value = value.strip()
    if not value:
        return None

    # Normalize: replace trailing Z with +00:00
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"

    # Try parsing with timezone info
    for fmt in (
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S.%f%z",
        "%Y-%m-%d %H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
    ):
        try:
            dt = datetime.strptime(value, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except ValueError:
            continue

    log(f"  WARNING: Cannot parse datetime: {value!r}")
    return None


def get_latest_gdrive_time(config):
    """Get the latest file modification time from config's files_modified_times."""
    modified_times = config.get("files_modified_times")
    if not modified_times or not isinstance(modified_times, dict):
        return None

    latest = None
    for key, ts_str in modified_times.items():
        dt = parse_datetime(ts_str)
        if dt is not None and (latest is None or dt > latest):
            latest = dt

    return latest


def main():
    config_pattern = os.path.join(PROJECT_ROOT, "config_files", "config_*_*.json")
    config_files = sorted(glob.glob(config_pattern))

    if not config_files:
        log("No config files found matching config_*_*.json")
        sys.exit(0)

    log(f"Found {len(config_files)} config file(s)")

    # Collect candidates: configs that have file_paths (data was downloaded)
    candidates = []
    for config_path in config_files:
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            log(f"  SKIP {os.path.basename(config_path)}: {e}")
            continue

        file_paths = config.get("file_paths")
        if not file_paths:
            log(f"  SKIP {os.path.basename(config_path)}: no file_paths")
            continue

        month = config.get("month")
        year = config.get("year")
        if not month or not year:
            log(f"  SKIP {os.path.basename(config_path)}: missing month/year")
            continue

        # Only consider months within last 4 months (skip old historical data)
        months_map = {'january':1,'february':2,'march':3,'april':4,'may':5,'june':6,
                      'july':7,'august':8,'september':9,'october':10,'november':11,'december':12}
        month_num = months_map.get(month.lower(), 0)
        if month_num:
            month_date = datetime(int(year), month_num, 1, tzinfo=timezone.utc)
            cutoff = datetime.now(timezone.utc) - timedelta(days=120)
            if month_date < cutoff:
                log(f"  SKIP {os.path.basename(config_path)}: too old ({month} {year})")
                continue

        gdrive_time = get_latest_gdrive_time(config)
        if gdrive_time is None:
            log(f"  SKIP {os.path.basename(config_path)}: no files_modified_times")
            continue

        # Use relative config path for GitHub Actions compatibility
        rel_config_path = os.path.relpath(config_path, PROJECT_ROOT)

        candidates.append({
            "month": month,
            "year": year,
            "config_path": rel_config_path,
            "gdrive_time": gdrive_time,
        })

    if not candidates:
        log("No candidate months with downloaded data")
        sys.exit(0)

    log(f"Checking {len(candidates)} month(s) against Firestore...")

    # Initialize Firestore
    try:
        from scripts.utils.firebase_common import init_firestore
        db = init_firestore()
    except Exception as e:
        log(f"ERROR: Firestore init failed: {e}")
        # If Firestore is unavailable, treat all months as stale
        stale = []
        for c in candidates:
            stale.append(f"{c['month']}:{c['year']}:{c['config_path']}")
            log(f"  STALE (no Firestore): {c['month']}_{c['year']}")
        print(" ".join(stale))
        sys.exit(0)

    stale = []
    for c in candidates:
        month_year = f"{c['month']}_{c['year']}"
        gdrive_time = c["gdrive_time"]

        try:
            doc_ref = db.collection("dashboard_summary").document(month_year)
            doc = doc_ref.get()
        except Exception as e:
            log(f"  ERROR reading Firestore {month_year}: {e}")
            # Treat as stale if we can't read
            stale.append(f"{c['month']}:{c['year']}:{c['config_path']}")
            log(f"  STALE (read error): {month_year}")
            continue

        if not doc.exists:
            stale.append(f"{c['month']}:{c['year']}:{c['config_path']}")
            log(f"  STALE (no Firestore doc): {month_year}")
            continue

        data = doc.to_dict()
        firestore_time = parse_datetime(
            data.get("data_updated_at") or data.get("calculated_at")
        )

        if firestore_time is None:
            stale.append(f"{c['month']}:{c['year']}:{c['config_path']}")
            log(f"  STALE (no timestamp in Firestore): {month_year}")
            continue

        log(f"  {month_year}: gdrive={gdrive_time.isoformat()} firestore={firestore_time.isoformat()}")

        if gdrive_time > firestore_time:
            stale.append(f"{c['month']}:{c['year']}:{c['config_path']}")
            log(f"  STALE: {month_year} (gdrive is newer)")
        else:
            log(f"  OK: {month_year} (firestore is up to date)")

    if stale:
        print(" ".join(stale))
    # else: print nothing (empty stdout)

    sys.exit(0)


if __name__ == "__main__":
    main()
