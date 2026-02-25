# HWK QIP INCENTIVE SYSTEM - Version 10

Firestore-based secure QIP Incentive Dashboard with Firebase Authentication.

## Architecture

```
Dashboard HTML (~500KB) = UI Shell only (NO employee data)
     |
GitHub PUBLIC repo -> Only UI code exposed (SAFE)
     |
Auth -> Firestore data load -> Browser rendering
```

## Key Security Improvement

- **Before (V9)**: 6.8MB HTML with inline employee data in public repo
- **After (V10)**: ~500KB UI shell, data in Firestore with security rules

## Tech Stack

- **Backend**: Python (pandas, openpyxl, firebase-admin)
- **Frontend**: HTML5, Bootstrap 5, Chart.js, D3.js
- **Database**: Firebase Firestore (free Spark plan)
- **Auth**: Firebase Authentication (email/password)
- **CI/CD**: GitHub Actions (30-min auto-update)
- **Hosting**: GitHub Pages (static UI shell)

## Quick Start

```bash
# Full pipeline
./action.sh

# Local dashboard preview
cd web/ && python -m http.server 8080
```

## Data Flow

```
Google Drive -> GitHub Actions -> Calculate -> Firestore Upload
                                                    |
                                              Dashboard (web)
                                              loads from Firestore
```

## Cost

$0/month - All services on free tiers.
