# CLAUDE.md - HWK QIP INCENTIVE SYSTEM Version 10

## Project Overview

QIP Incentive Dashboard V10 - **Firestore-based secure architecture**.
Employee data stored in Firebase Firestore (NOT in HTML/GitHub).
Dashboard is a lightweight UI shell (~500KB) that loads data dynamically after authentication.

## Architecture

### Before (V9 - Security Issue)
```
Dashboard HTML (6.8MB) = UI + employee data inline
GitHub PUBLIC repo -> Anyone can access employee data
```

### After (V10 - Secure)
```
Dashboard HTML (~500KB) = UI Shell only (no data)
GitHub PUBLIC repo -> Only UI code (safe)
Auth -> Firestore data load -> Browser rendering
```

### Data Flow
```
Google Drive -> GitHub Actions -> Calculate (Python) -> Firestore Upload
                                                            |
                                                      Dashboard (web)
                                                      loads from Firestore
```

## Core Principles (inherited from V9)

1. **No Fake Data** - Display 0, empty, or "no data" instead of generated values
2. **100% Condition Fulfillment** - Incentives only for 100% condition pass rate
3. **JSON-Driven Config** - Business logic in JSON, not hardcoded
4. **Google Drive = Single Source of Truth** for input data
5. **Firestore = Single Source of Truth** for calculated results
6. **Documentation Security** - Never commit passwords, API keys, or service account data

## Project Structure

```
/
├── .github/workflows/auto-update.yml  # CI/CD pipeline
├── src/
│   ├── step1_인센티브_계산.py          # Calculation engine (from V9)
│   ├── convert_attendance_data.py      # Attendance converter (from V9)
│   └── update_continuous_fail.py       # AQL consecutive fail (from V9)
├── scripts/
│   ├── download_from_gdrive.py         # Google Drive sync (from V9)
│   ├── enhanced_download.py            # Enhanced download (from V9)
│   ├── upload_to_firestore.py          # CSV -> Firestore upload (NEW)
│   └── sync_thresholds.py              # Firestore threshold -> config (NEW)
├── web/                                # GitHub Pages root
│   ├── index.html                      # -> auth.html redirect
│   ├── auth.html                       # Firebase login
│   ├── selector.html                   # Month selector + admin link
│   ├── dashboard.html                  # UI Shell (NO DATA)
│   ├── admin.html                      # Admin panel
│   ├── css/dashboard.css               # Styles
│   └── js/
│       ├── firebase-config.js          # Firebase init
│       ├── auth.js                     # Auth module
│       ├── dashboard-data.js           # Firestore data loading
│       ├── dashboard-charts.js         # Chart.js charts
│       ├── dashboard-modals.js         # Modal system
│       ├── dashboard-filters.js        # Search/filter/sort
│       ├── dashboard-i18n.js           # KO/EN/VN translations
│       └── admin.js                    # Admin page logic
├── config_files/                       # JSON configs
├── input_files/                        # Google Drive downloads (gitignored)
├── output_files/                       # Calc results (gitignored)
├── firestore.rules                     # Security rules
├── action.sh                           # Local run script
└── CLAUDE.md                           # This file
```

## Key Commands

```bash
# Full pipeline (local)
./action.sh

# Upload to Firestore
python scripts/upload_to_firestore.py --month february --year 2026

# Sync thresholds from Firestore to config
python scripts/sync_thresholds.py --month february --year 2026

# Local preview
cd web/ && python -m http.server 8080
```

## Firestore Schema

```
employees/{month_year}/all_data     # Single doc with all employees array (~270KB)
dashboard_summary/{month_year}      # KPI summary stats
thresholds/{month_year}             # 6 threshold values
threshold_history/{auto_id}         # Immutable change audit trail
system/config                       # System settings
```

## Firebase Project
- Project: `hwk-qip-incentive-dashboard` (existing)
- Auth: Email/Password
- Firestore: asia-northeast3
- Admin email: ksmoon@hsvina.com

## Dependencies
```
Python 3.9+
pandas>=1.3.0
numpy>=1.21.0
openpyxl>=3.0.9
firebase-admin>=6.0.0
google-auth>=2.0.0
gspread>=5.7.0
```
