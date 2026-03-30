# CLAUDE.md — HWK QIP INCENTIVE SYSTEM Version 10

## 대화 시작 시 필수: 로컬/원격 동기화 확인 (절대 원칙)

이 프로젝트는 **GitHub Actions 파이프라인이 매시간 코드를 갱신하고 commit/push**합니다.
로컬 repo는 항상 원격보다 뒤처져 있을 수 있으므로, **대화 시작 시 반드시 아래를 실행**합니다:

```bash
git fetch origin && git diff HEAD origin/main --stat
```

- 차이가 있으면 사용자에게 알리고 동기화 수행: `git stash && git pull --rebase origin main && git stash pop`
- **로컬 파일만 읽고 "값이 이상하다", "업데이트가 안 된다"고 결론 내리지 말 것**
- 특히 `config_files/`는 파이프라인이 매 실행마다 갱신하므로, 로컬 값 ≠ 프로덕션 값
- 원격 값 확인이 필요하면: `git show origin/main:파일경로`

> **배경**: 2026-03-27 config_march의 working_days가 로컬(13)과 원격(22)이 달라서 잘못된 분석을 한 사례 발생

---

## QOS 생태계 행동 규칙 (절대 원칙)

이 프로젝트는 **HWK Quality OS 생태계** (12개 프로젝트)의 일부입니다.
모든 작업은 QOS 중앙 허브와의 연동을 고려해야 합니다.

### 크로스 프로젝트 확인 의무
아래 주제를 분석·수정할 때는 **반드시 QOS 중앙 허브를 먼저 확인**합니다:

| 주제 | QOS 확인 대상 | 경로 |
|------|-------------|------|
| 이메일 설정 | QOS EmailManagement + settingsSync | `/Users/ksmoon/Coding/quality-os/` |
| 불량 표준 | QOS defectStandards (362개) | QOS Firestore |
| SMTP 설정 | QOS config/smtp_settings | QOS가 push — 읽기 전용 |
| 공급업체 | QOS config/suppliers | QOS가 push — 읽기 전용 |
| 공장/라인 | QOS config/factory_lines | QOS가 push — 읽기 전용 |
| 시스템 이슈 | QOS feedbackCollector | 컬렉션명 변경 금지 |

### 에이전트 팀 프로토콜
- **보스**: 사용자 (최종 의사결정자)
- **팀장**: 경서 (@agent-orchestrator) — "경서야"로 호출 시 활성화
- **이 프로젝트 Liaison**: @agent-liaison-support
- **QOS 팀 정의**: `/Users/ksmoon/Coding/quality-os/AGENTS.md`
- 크로스 프로젝트 영향이 있는 변경 시 → QOS CLAUDE.md의 연동 아키텍처 참조

### 3-Point Sync (변경 후 필수)
프로젝트 변경 완료 시 → 이 CLAUDE.md 갱신 → QOS AGENTS.md 갱신 → QOS CLAUDE.md 갱신

---

## 프로젝트 개요

**HWK QIP Incentive Dashboard V10** — Firestore 기반 인센티브 관리 대시보드.
직원 인센티브 조건 충족 현황, 출결, 품질 지표를 모니터링하는 웹 애플리케이션.

| 속성 | 값 |
|------|-----|
| **프로젝트명** | hwk-qip-incentive-dashboard |
| **주요 기능** | 10개 인센티브 조건 관리, TYPE별 현황, 출결 추적, 품질 지표, 피드백 시스템 |
| **배포 URL** | https://moonkaicuzui.github.io/hwk-qip-incentive-v10/ |
| **GitHub Repo** | moonkaicuzui/hwk-qip-incentive-v10 |
| **Firebase Project** | hwk-qip-incentive-dashboard |
| **Firestore Region** | asia-northeast3 |
| **Functions Region** | asia-northeast3 |

> **Note**: Firebase Project ID (`hwk-qip-incentive-dashboard`)와 GitHub repo name (`hwk-qip-incentive-v10`)이 다릅니다.

---

## 아키텍처

```
V9 (보안 이슈): Dashboard HTML (6.8MB) = UI + 직원 데이터 인라인 → GitHub PUBLIC
V10 (보안):     Dashboard HTML (~500KB) = UI Shell만 → Auth → Firestore 로드
```

### 데이터 흐름
```
Google Drive → GitHub Actions → Python 계산 (10개 조건) → Firestore Upload
                                                              ↓
                                                        Dashboard (web)
                                                        Firestore에서 로드
```

---

## 핵심 원칙

1. **No Fake Data** — 0, 빈값, "데이터 없음" 표시. 가짜 데이터 생성 금지
2. **100% 조건 충족** — 인센티브는 100% 조건 통과율에만 지급
3. **JSON-Driven Config** — 비즈니스 로직은 JSON, 하드코딩 금지
4. **Google Drive = Single Source of Truth** (입력 데이터)
5. **Firestore = Single Source of Truth** (계산 결과)
6. **보안** — 비밀번호, API 키, 서비스 계정 커밋 금지

---

## 기술 스택

| 항목 | 기술 |
|------|------|
| Frontend | Vanilla JS + Bootstrap 5.3 + Chart.js (CDN) |
| Build | None (정적 HTML/CSS/JS, GitHub Pages) |
| Auth | Firebase Auth (email/password) |
| Database | Firestore (asia-northeast3) |
| Functions | Cloud Functions v2 (Node.js 22, asia-northeast3) |
| Email | Nodemailer (한비로 SMTP mail.hsvina.com:465 SSL) |
| Pipeline | Python (pandas, firebase-admin) |
| CI/CD | GitHub Actions |

---

## 디렉토리 구조

```
/
├── .github/workflows/
│   ├── auto-update.yml            # CI/CD 파이프라인 (Google Drive → 계산 → Firestore)
│   └── weekly-email-report.yml    # 주간 이메일 리포트 자동 발송
├── src/                           # Python 계산 엔진
│   ├── step0_create_monthly_config.py   # 월별 설정 생성
│   ├── step1_인센티브_계산.py            # 메인 계산 엔진 (10개 조건, 419KB)
│   ├── convert_attendance_data.py       # 출결 데이터 변환
│   └── update_continuous_fail.py        # AQL 연속 불합격 추적
├── scripts/                       # 유틸리티 스크립트
│   ├── upload_to_firestore.py     # CSV → Firestore 업로드
│   ├── sync_thresholds.py         # Firestore 임계값 → 설정 동기화
│   ├── download_from_gdrive.py    # Google Drive 동기화
│   ├── sendEmail.js               # Node.js 범용 이메일 발송 (CLI + 모듈)
│   ├── send_report_email.py       # Python 주간 리포트 발송
│   ├── send_feedback_email.py     # Python 피드백 알림 발송
│   ├── setup_email_config.py      # Firestore 이메일 설정 초기화
│   └── utils/firebase_common.py   # Firebase 공통 유틸리티
├── web/                           # Frontend (GitHub Pages root)
│   ├── index.html                 # → auth.html 리다이렉트
│   ├── auth.html                  # Firebase 로그인
│   ├── selector.html              # 월/년 선택 + 관리자 링크
│   ├── dashboard.html             # 메인 대시보드 (UI Shell, 데이터 없음)
│   ├── admin.html                 # 관리자 패널 (임계값/설정 관리)
│   ├── feedback.html              # 시스템 피드백 (이슈/개선 요청)
│   ├── css/dashboard.css          # 전체 스타일
│   └── js/ (9개 모듈)
│       ├── firebase-config.js     # Firebase SDK 초기화
│       ├── auth.js                # 인증 + RBAC + 세션
│       ├── dashboard-data.js      # Firestore 데이터 로딩 + 캐싱
│       ├── dashboard-charts.js    # Chart.js 차트 + KPI 카드 (2600줄)
│       ├── dashboard-modals.js    # 직원 상세 모달 (2743줄)
│       ├── dashboard-filters.js   # 검색/필터/정렬/페이지네이션 (1525줄)
│       ├── dashboard-i18n.js      # 다국어 ko/en/vi (1192줄)
│       ├── admin.js               # 관리자 페이지 로직
│       └── admin-configs.js       # 설정 관리 탭 (1297줄)
├── functions/                     # Cloud Functions (Node.js 22)
│   ├── index.js                   # 3 Cloud Functions (피드백 알림 자동화)
│   ├── services/emailService.js   # Nodemailer SMTP (재시도 + 로깅)
│   └── templates/feedbackEmail.js # 이메일 템플릿 (3개 언어)
├── config_files/                  # JSON 설정 파일
├── input_files/                   # Google Drive 입력 (gitignored)
├── output_files/                  # 계산 결과 (gitignored)
├── firestore.rules                # Firestore 보안 규칙
├── firebase.json                  # Firebase 설정
├── .firebaserc                    # Firebase 프로젝트 매핑
├── AGENTS.md                      # 에이전트 팀 구성
└── CLAUDE.md                      # 이 파일
```

---

## 페이지 네비게이션

```
index.html → auth.html (Firebase 로그인)
  → selector.html (월/년 선택)
    → dashboard.html?month={month}&year={year}
      → 탭: 요약, 직급별, 개인별, 인센티브 기준, 조직도, 검증
    → admin.html (관리자 전용)
    → feedback.html (시스템 피드백)
```

---

## Firestore 컬렉션

| 컬렉션 | 설명 | 접근 |
|--------|------|------|
| `employees/{monthYear}/all_data/data` | 직원 + 인센티브 전체 (~270KB) | Auth: 읽기, Admin: 쓰기 |
| `dashboard_summary/{monthYear}` | KPI 요약 통계 | Auth: 읽기, Admin: 쓰기 |
| `thresholds/{monthYear}` | 6개 임계값 | Auth: 읽기, Admin: 쓰기 |
| `threshold_history/{autoId}` | 불변 감사추적 | Auth: 읽기, Admin: 생성만 |
| `system/config` | 시스템 설정 (admin_emails) | Auth: 읽기, 지정 Admin: 쓰기 |
| `system_feedback/{autoId}` | 시스템 피드백 | Auth: 읽기/생성, Admin: 수정/삭제 |
| `configs/{document}` | 설정 (position mapping) | Auth: 읽기, Admin: 쓰기 |
| `config/email` | SMTP 자격증명 | Admin만 |
| `email_logs/{autoId}` | 이메일 발송 로그 | Admin만 |
| `pendingNotifications/{autoId}` | 이메일 알림 큐 | Auth: 생성, Admin: 읽기/수정 |

---

## 인증 & RBAC

- **Admin**: ksmoon@hsvina.com (동적: `system/config.admin_emails`에서 로드)
- **일반 사용자**: 읽기 전용 + 피드백 생성
- **Auth**: Firebase Email/Password
- **세션**: sessionStorage

---

## 10개 인센티브 조건

| # | 조건 | 설명 |
|---|------|------|
| 1 | 출근율 (Attendance Rate) | 최소 출근율 충족 |
| 2 | AQL 검사 합격률 | AQL 품질 검사 통과 |
| 3 | 5PRS 통과율 | 5PRS 기준 충족 |
| 4 | 연속 불합격 횟수 | AQL 연속 불합격 제한 |
| 5 | 근속 기간 (Tenure) | 최소 근무 기간 |
| 6 | 징계 이력 | 징계 기록 없음 |
| 7 | 무단 결근 | 무단 결근 제한 |
| 8 | 지각 횟수 | 지각 횟수 제한 |
| 9 | 조기 퇴근 | 조기 퇴근 제한 |
| 10 | 특별 감점 | 특별 감점 없음 |

**핵심**: 100% 조건 통과율에만 인센티브 지급

---

## Cloud Functions

### 배포
```bash
cd functions && npm install
firebase deploy --only functions --force
```

### 함수 목록 (Region: asia-northeast3, Runtime: Node.js 22)

| 함수 | 트리거 | 설명 |
|------|--------|------|
| `onSystemFeedbackCreated` | `system_feedback/{docId}` 생성 | 관리자에게 새 피드백 알림 이메일 (3개 언어) |
| `onFeedbackStatusUpdated` | `system_feedback/{docId}` 수정 | 작성자에게 상태 변경 알림 이메일 |
| `sendFeedbackReply` | onCall (관리자 전용) | 피드백 답변 이메일 + 문서 업데이트 |

### SMTP 설정 (한비로 그룹웨어)
```
호스트: mail.hsvina.com
포트: 465 (SSL) — 폴백: 587 (STARTTLS)
인증: AUTH LOGIN
TLS: rejectUnauthorized: false (자체서명 인증서)
자격증명 로드: 환경변수 SMTP_USER/SMTP_PASSWORD → Firestore config/email
재시도: 최대 2회 + exponential backoff (인증 오류 시 즉시 중단)
```

---

## 이메일 시스템

### 규칙
- Gmail MCP 사용 금지 — Nodemailer SMTP만 사용
- 발신자: `ksmoon@hsvina.com`
- 인증 정보: `scripts/.env` 파일 (`.gitignore`에 포함, 커밋 금지)
- sendEmail.js: 경로 탐색 방지 (프로젝트 디렉토리 내 파일만 허용)

### 이메일 스크립트

| 스크립트 | 언어 | 용도 |
|---------|------|------|
| `scripts/sendEmail.js` | Node.js | 범용 이메일 발송 (CLI + 모듈) |
| `scripts/send_report_email.py` | Python | Firestore 기반 주간 리포트 |
| `scripts/send_feedback_email.py` | Python | 피드백 알림 발송 |
| `scripts/setup_email_config.py` | Python | Firestore 이메일 설정 초기화 |
| `functions/services/emailService.js` | Node.js | Cloud Functions용 SMTP 서비스 |
| `functions/templates/feedbackEmail.js` | Node.js | 피드백 이메일 템플릿 (ko/en/vi) |

### 사용법
```bash
cd scripts && npm install
node scripts/sendEmail.js --to "user@hsvina.com" --subject "제목" --body "본문"
node scripts/sendEmail.js --to "user@hsvina.com" --subject "제목" --html "<h1>HTML</h1>"
node scripts/sendEmail.js --to "user@hsvina.com" --subject "제목" --html-file "output_files/report.html" --attachment "output_files/file.pdf"
```

---

## 시스템 피드백

### Firestore: `system_feedback`

| 필드 | 타입 | 설명 |
|------|------|------|
| type | string | BUG, IMPROVEMENT, NEW_FEATURE, UI_UX, DATA, OTHER |
| status | string | SUBMITTED, REVIEWING, IN_PROGRESS, COMPLETED, REJECTED |
| priority | string | low, medium, high, critical |
| title | string | 제목 (max 100자) |
| description | string | 상세 설명 (max 2000자) |
| reporterEmail | string | 보고자 이메일 |
| attachments | array | 이미지 첨부 (base64, max 3개) |
| createdBy | object | { uid, email, displayName } |
| adminReply | string | 관리자 답변 |

### 상태 흐름
```
SUBMITTED → REVIEWING → IN_PROGRESS → COMPLETED
               ↓                         ↓
            REJECTED              (Reopen → SUBMITTED)
```

### 자동 알림 (Cloud Functions)
- 피드백 생성 → 관리자 이메일 알림
- 상태 변경 → 작성자 이메일 알림
- 관리자 답변 → 작성자 이메일 알림

---

## 코딩 패턴

### 프론트엔드
- XSS 방지: `escapeHtml()` 또는 `textContent` — innerHTML에 사용자 입력 금지
- TYPE 분류: strict equality 사용 (`===`), indexOf 금지 (TYPE-10→TYPE-1 오분류 방지)
- i18n: `DashboardI18n.t(key)` 사용, 하드코딩 텍스트 금지
- 에러 메시지: i18n 키 사용 (`error.loadAll`, `error.loadEmployees` 등)
- 디바운싱: 검색 입력 250ms

### 백엔드
- SMTP 인증 오류(`EAUTH`, `535`)는 재시도하지 않음
- 이메일 발송 시 `email_logs` 컬렉션에 감사 로깅
- 구조화된 로깅: `logger.info/warn/error` with context objects

### 보안
- PII sessionStorage 암호화 없이 저장 금지
- API 키 하드코딩 금지 — `.env` 또는 Secret Manager
- sendEmail.js: 파일 경로 프로젝트 디렉토리 내로 제한 (경로 탐색 방지)
- Firestore: `email_logs` 생성 admin 전용 (Cloud Functions는 서버사이드 우회)

---

## 배포

```bash
# 전체
firebase deploy

# Cloud Functions만
firebase deploy --only functions --force

# Firestore 규칙만
firebase deploy --only firestore:rules

# 로컬 미리보기
cd web/ && python -m http.server 8080

# 파이프라인
./action.sh
python scripts/upload_to_firestore.py --month february --year 2026
```

---

## 의존성

### Python (계산 엔진 + 데이터 파이프라인)
```
Python 3.9+, pandas>=1.3.0, numpy>=1.21.0, openpyxl>=3.0.9
firebase-admin>=6.0.0, google-auth>=2.0.0, gspread>=5.7.0
```

### Node.js (이메일 스크립트 — scripts/)
```
Node.js 18+, nodemailer>=6.9.16, dotenv>=16.4.7
```

### Node.js (Cloud Functions — functions/)
```
Node.js 22, firebase-admin>=13.0.0, firebase-functions>=6.3.0, nodemailer>=6.9.16
```

---

## 이슈 개선 노하우 참조 (QOS Know-How)

| 항목 | 값 |
|------|-----|
| **프로젝트 타입** | TYPE-MANAGEMENT |
| **노하우 경로** | `/Users/ksmoon/Coding/quality-os/knowhow/incentive/` |
| **필수 골든 룰** | DATA, LOGIC, CONFIG, INTEG |
| **담당 Liaison** | @agent-liaison-support |

### 에이전트 작업 전 필수 프로토콜

1. `knowhow/GOLDEN_RULES.md` 읽기 → 해당 카테고리 체크리스트 확인
2. `knowhow/incentive/` 디렉토리 읽기 → 프로젝트별 노하우 확인
3. `knowhow/INDEX.md` → TYPE-MANAGEMENT의 "공통 주의점" 확인
4. 이슈 해결 완료 시 → 4-Point Sync 실행 (노하우 작성 → GOLDEN_RULES → INDEX → CLAUDE.md)

---

## Quality OS 연동 규칙 (필수)

(상세 규칙은 상단 'QOS 생태계 행동 규칙' 참조)

이 프로젝트는 HWK Quality OS (hwk-quality-os)와 연동됩니다.
**모든 코드 변경 전에 반드시 `QOS_CHECKLIST.md`를 확인하세요.**

### 절대 규칙
1. 시스템 이슈 컬렉션명을 변경하지 마세요 — QOS feedbackCollector가 수집합니다
2. 이슈 상태값은 open/in_progress/resolved/closed만 사용하세요
3. config/smtp_settings, config/suppliers, config/factory_lines는 읽기 전용입니다 (QOS가 push)
4. _syncOrigin, _syncTimestamp 메타데이터 필드를 삭제하지 마세요
5. 변경 전 `QOS_CONTRACT.json`의 계약 내용을 확인하세요

