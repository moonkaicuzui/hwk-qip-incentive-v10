# HWK QIP Incentive V10 Agent Team — AGENTS.md v3.0

## 프로젝트 개요

| 항목 | 값 |
|------|-----|
| Firebase | hwk-qip-incentive-dashboard |
| URL | https://moonkaicuzui.github.io/hwk-qip-incentive-v10/ |
| Director | @director-support |
| 스택 | Vanilla JS + Bootstrap 5.3 + Chart.js + Firebase (Auth/Firestore/Functions) + Python 계산엔진 |
| 배포 | GitHub Pages (프론트) + Firebase (Functions/Firestore) |
| Admin | ksmoon@hsvina.com (동적: system/config.admin_emails) |

## Worker

### @dev — 코드 작성

**담당**: 프론트엔드 9개 JS 모듈 + Cloud Functions 3개 + Python 인센티브 계산엔진 (9,354줄)

**핵심 파일**:
- `web/js/` — dashboard-charts (2,600줄), dashboard-modals (2,743줄), dashboard-filters (1,525줄), dashboard-i18n (1,192줄), admin.js, admin-configs.js, dashboard-data.js, auth.js, firebase-config.js
- `src/step1_인센티브_계산.py` — 메인 계산엔진 (8,332줄, 10개 조건)
- `src/step0_create_monthly_config.py` — 월별 설정 생성
- `scripts/upload_to_firestore.py` — CSV -> Firestore 업로드
- `functions/index.js` — onSystemFeedbackCreated, onFeedbackStatusUpdated, sendFeedbackReply

**필수 규칙**:
1. **10개 인센티브 조건**: 출근율 / AQL 합격률 / 5PRS 통과율 / 연속 불합격 / 근속 기간 / 징계 이력 / 무단 결근 / 지각 횟수 / 조기 퇴근 / 특별 감점
2. **100% 조건 충족**: 인센티브는 100% 조건 통과율에만 지급
3. TYPE 분류: strict equality (`===`) 사용 — `indexOf` 금지 (TYPE-10 -> TYPE-1 오분류 방지)
4. `escapeHtml()` 없이 innerHTML 사용 금지
5. i18n: `DashboardI18n.t(key)` 사용, 하드코딩 텍스트 금지
6. Python safe_float/safe_int 변환 실패 시 로깅 필수

### @qa — 검증

**담당**: 10개 인센티브 조건 교차 검증 + Firestore 데이터 무결성 + 보안 + i18n(ko/en/vi)

**검증 체크리스트**:
1. 10개 인센티브 조건 모두 정확히 계산되는가? (100% 통과율 검증)
2. TYPE-1/2/3 분류가 정확한가? (TYPE-10 오분류 없는가? strict equality 확인)
3. employees 데이터 vs dashboard_summary KPI 수치가 일치하는가?
4. 임계값 변경 시 threshold_history에 불변 감사추적이 생성되는가?
5. 피드백 상태 워크플로우: SUBMITTED -> REVIEWING -> IN_PROGRESS -> COMPLETED/REJECTED
6. 3개 언어 전환 시 인센티브 조건명 포함 번역키 누락 없는가?
7. 빈 데이터/NaN 입력 시 크래시 없는가? (No Fake Data 원칙)
8. sendEmail.js 경로 탐색 방지가 작동하는가?

### @ops — 운영

**담당**: GitHub Pages 배포 + Firebase Functions 배포 + Python 파이프라인 실행 + GitHub Actions CI/CD

**배포**:
```bash
# GitHub Pages (프론트엔드)
git push origin main  # GitHub Actions auto-deploy

# Firebase Functions (개별 배포)
firebase deploy --only functions:onSystemFeedbackCreated,functions:onFeedbackStatusUpdated,functions:sendFeedbackReply

# Firestore 규칙
firebase deploy --only firestore:rules
```

**파이프라인 실행**:
```bash
# 전체 파이프라인
./action.sh

# 개별 실행
python scripts/upload_to_firestore.py --month march --year 2026
python scripts/sync_thresholds.py --month march --year 2026
```

**운영 규칙**:
1. SMTP: mail.hsvina.com:465 (SSL), `rejectUnauthorized: false`
2. SMTP 인증 오류(EAUTH, 535) 시 재시도 중단 — 일반 오류만 재시도 (MAX_RETRIES=2)
3. GitHub Actions workflows: auto-update.yml, weekly-email-report.yml, workflow-watchdog.yml
4. Google Drive 동기화: download_from_gdrive.py (Service Account)
5. `.env`, 서비스 계정 JSON 커밋 금지
6. pandas UTF-8-BOM 인코딩 처리 필수

## 프로젝트 고유 규칙

1. **듀얼 배포**: 프론트엔드는 GitHub Pages, 백엔드(Functions/Firestore)는 Firebase
2. **Python 계산엔진** (9,354줄): step0 설정 생성 -> step1 인센티브 계산 -> upload_to_firestore
3. **Firestore 단일 문서 패턴**: employees/{monthYear}/all_data/data (~270KB)
4. **admin 동적 관리**: system/config.admin_emails에서 런타임 로드 (firestore.rules에는 하드코딩 admin 별도 존재)
5. **No Fake Data**: 0, 빈값, "데이터 없음" 표시 — 가짜 데이터 생성 금지

---
*HWK QIP Incentive V10 Agent Team v3.0 | 2026-04-11 | 3 workers*
