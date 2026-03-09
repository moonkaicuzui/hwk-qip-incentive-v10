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
│   ├── sync_thresholds.py              # Firestore threshold -> config (NEW)
│   ├── sendEmail.js                    # Node.js 범용 이메일 발송 (Nodemailer)
│   ├── send_report_email.py            # Python 주간 리포트 발송
│   ├── send_feedback_email.py          # Python 피드백 알림 발송
│   ├── package.json                    # Node.js 의존성
│   └── .env.example                    # SMTP 환경변수 템플릿
├── web/                                # GitHub Pages root
│   ├── index.html                      # -> auth.html redirect
│   ├── auth.html                       # Firebase login
│   ├── selector.html                   # Month selector + admin link
│   ├── dashboard.html                  # UI Shell (NO DATA)
│   ├── admin.html                      # Admin panel
│   ├── feedback.html                   # System Feedback (이슈/개선 요청)
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
├── functions/                             # Cloud Functions (Node.js 22)
│   ├── index.js                          # 3 Cloud Functions (피드백 알림)
│   ├── services/emailService.js          # Nodemailer SMTP (mail.hsvina.com:465)
│   └── templates/feedbackEmail.js        # 이메일 템플릿 (3개 언어)
├── firestore.rules                       # Security rules
├── action.sh                             # Local run script
├── AGENTS.md                             # 10 에이전트 팀 구성
└── CLAUDE.md                             # This file
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
system/config                       # System settings (admin_emails 포함)
system_feedback/{auto_id}           # 시스템 피드백 (이슈/개선 요청)
pendingNotifications/{auto_id}      # 이메일 알림 큐
configs/{document}                  # 설정 (position mapping, etc.)
config/email                        # SMTP 자격증명 (gmailUser, gmailAppPassword)
email_logs/{auto_id}                # 이메일 발송 로그 (감사 추적)
```

## Firebase Project
- Firebase Project ID: `hwk-qip-incentive-dashboard` (Firebase console name)
- GitHub Repo: `moonkaicuzui/hwk-qip-incentive-v10`
- Production URL: `https://moonkaicuzui.github.io/hwk-qip-incentive-v10/`
- GitHub Pages Root: `/` (repo root, `index.html` redirects to `web/auth.html`)
- Auth: Email/Password
- Firestore: asia-northeast3
- Admin email: ksmoon@hsvina.com

> **Note**: Firebase Project ID (`hwk-qip-incentive-dashboard`)와 GitHub repo name (`hwk-qip-incentive-v10`)이 다릅니다. GitHub Pages URL은 repo name 기준입니다.

## Cloud Functions (Firebase)

### 배포
```bash
cd functions && npm install
firebase deploy --only functions
```

### 함수 목록 (Region: asia-northeast3, Runtime: Node.js 22)
| 함수 | 트리거 | 설명 |
|------|--------|------|
| `onSystemFeedbackCreated` | Firestore `system_feedback/{docId}` 생성 | 관리자에게 새 피드백 알림 이메일 |
| `onFeedbackStatusUpdated` | Firestore `system_feedback/{docId}` 수정 | 작성자에게 상태 변경 알림 이메일 |
| `sendFeedbackReply` | onCall (관리자 전용) | 피드백 답변 이메일 발송 + 문서 업데이트 |

### SMTP 설정
- 호스트: `mail.hsvina.com:465` (SSL, 자체서명 인증서)
- 자격증명: 환경변수 `SMTP_USER/SMTP_PASSWORD` → Firestore `config/email`
- 재시도: 최대 2회 + exponential backoff
- 이메일 템플릿: 3개 언어 (ko/en/vi)

## Dependencies
```
Python 3.9+
pandas>=1.3.0
numpy>=1.21.0
openpyxl>=3.0.9
firebase-admin>=6.0.0
google-auth>=2.0.0
gspread>=5.7.0

# Node.js (for email scripts - scripts/)
Node.js 18+
nodemailer>=6.9.16
dotenv>=16.4.7

# Node.js (for Cloud Functions - functions/)
Node.js 22
firebase-admin>=13.0.0
firebase-functions>=6.3.0
nodemailer>=6.9.16
```

---

## Email System

### EMAIL Agent Rules
- **Gmail MCP 사용 금지**: Gmail MCP (send 기능 없음) 사용하지 않음
- **Nodemailer SMTP만 사용**: `scripts/sendEmail.js` + `mail.hsvina.com:465`
- **발신자**: `ksmoon@hsvina.com` (QIP Incentive System)
- **SMTP 인증**: AUTH LOGIN (mail.hsvina.com 한비로 그룹웨어)
- **폴백**: 465 SSL 실패 시 587 STARTTLS 자동 전환
- **인증 정보**: `scripts/.env` 파일 (`.gitignore`에 포함, 커밋 금지)

### Email Scripts
| 스크립트 | 언어 | 용도 |
|---------|------|------|
| `scripts/sendEmail.js` | Node.js | 범용 이메일 발송 (CLI + 모듈) |
| `scripts/send_report_email.py` | Python | Firestore 데이터 기반 주간 리포트 발송 |
| `scripts/send_feedback_email.py` | Python | 피드백 개선 알림 발송 |
| `scripts/setup_email_config.py` | Python | Firestore 이메일 설정 초기화 |

### Email Script Usage
```bash
# Node.js 의존성 설치
cd scripts && npm install

# 기본 이메일 발송
node scripts/sendEmail.js --to "user@hsvina.com" --subject "제목" --body "본문"

# HTML 이메일
node scripts/sendEmail.js --to "user@hsvina.com" --subject "제목" --html "<h1>HTML</h1>"

# HTML 파일 + 첨부파일
node scripts/sendEmail.js --to "user@hsvina.com" --subject "제목" --html-file "report.html" --attachment "file.pdf"

# 복수 수신자
node scripts/sendEmail.js --to "a@hsvina.com,b@hsvina.com" --subject "제목" --body "본문"
```

---

## System Feedback

### Firestore Collection: `system_feedback`
| 필드 | 타입 | 설명 |
|------|------|------|
| type | string | BUG, IMPROVEMENT, NEW_FEATURE, UI_UX, DATA, OTHER |
| status | string | SUBMITTED, REVIEWING, IN_PROGRESS, COMPLETED, REJECTED |
| priority | string | low, medium, high, critical |
| title | string | 제목 (max 100자) |
| description | string | 상세 설명 (max 2000자) |
| reporterEmail | string | 보고자 이메일 |
| notificationEmails | array | 알림 수신자 목록 |
| attachments | array | 이미지 첨부 (base64, max 3개) |
| createdBy | object | { uid, email, displayName } |
| createdAt | timestamp | 생성 시각 |
| updatedAt | timestamp | 최종 수정 시각 |
| completionComment | string | 완료 코멘트 |
| rejectionComment | string | 거부 사유 |

### Status Flow
```
SUBMITTED → REVIEWING → IN_PROGRESS → COMPLETED
                ↓                         ↓
             REJECTED              (Reopen → SUBMITTED)
                ↓
         (Reopen → SUBMITTED)
```
