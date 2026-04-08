# Quality OS Integration Checklist
# 품질 OS 연동 체크리스트

> **모든 프로젝트 개선 작업 시 반드시 확인해야 합니다.**
> This checklist MUST be verified before any project improvement deployment.

---

## MUST (필수 — 위반 시 QOS 동기화 장애)

### 1. 컬렉션명 변경 금지
- [ ] 시스템 이슈 컬렉션명이 `QOS_CONTRACT.json`에 정의된 이름과 일치하는지 확인
- [ ] 컬렉션명 변경이 필요한 경우, **반드시 QOS feedbackCollector SOURCE_CONFIGS도 함께 수정**

| 프로젝트 | 컬렉션명 | 변경 금지 |
|---------|---------|----------|
| OSC | `systemIssues` | X |
| AQL | `systemFeedback` | X |
| Q-Train | `system_feedback` | X |
| HR | `hr_system_issues` | X |
| B-Grade | `system_feedback` | X |
| LoadPlan | `system_issues` | X |
| Incentive | `system_feedback` | X |
| TSRG | `system_issues` | X |

### 2. 이슈 상태값 표준 준수
- [ ] 상태값은 반드시 `open`, `in_progress`, `resolved`, `closed` 4개만 사용
- [ ] 신규 이슈 생성 시 기본 상태: `open`
- [ ] 상태 변경 흐름: `open` → `in_progress` → `resolved` → `closed`

### 3. 필수 필드 유지
- [ ] 이슈 문서에 아래 필드가 반드시 포함:
  - `title` (string, 필수)
  - `status` (string, 필수)
  - `category` (string: bug/feature/question/data_issue/other)
  - `priority` (string: low/medium/high/critical)
  - `createdBy` (string, 작성자)
  - `createdAt` (timestamp, 생성 시간)
  - `updatedAt` (timestamp, 수정 시간)

### 4. 동기화 메타데이터 보존
- [ ] QOS에서 push한 문서의 `_syncOrigin` 필드를 삭제/변경하지 않음
- [ ] `_syncTimestamp`, `_syncVersion` 필드를 삭제/변경하지 않음
- [ ] 문서 업데이트 시 `updatedAt` 필드를 항상 갱신

### 5. 설정 경로 변경 금지
- [ ] `config/email` 또는 `config/emailSettings` (LoadPlan) 경로 유지
- [ ] `config/smtp_settings` — **읽기 전용** (QOS에서만 변경)
- [ ] `config/suppliers` — **읽기 전용** (QOS에서만 변경)
- [ ] `config/factory_lines` — **읽기 전용** (QOS에서만 변경)

---

## SHOULD (권장 — 위반 시 데이터 불일치 위험)

### 6. 신규 필드 추가 시 QOS 타입 확인
- [ ] QOS `functions/src/types/index.ts`의 관련 타입에 새 필드가 반영되었는지
- [ ] QOS `feedbackCollector.ts`의 `normalizeFeedback()`에서 새 필드가 매핑되는지

### 7. Cloud Function에서 공유 컬렉션 쓰기 시
- [ ] `_syncOrigin` 메타데이터를 반드시 포함하여 QOS 루프 방지
- [ ] 형식: `{ _syncOrigin: "프로젝트ID", _syncTimestamp: new Date().toISOString() }`

### 8. 로컬 설정 변경 시 QOS 덮어쓰기 인지
- [ ] SMTP, 공급사, 공장라인을 로컬에서 변경해도 다음 QOS push 시 원복됨을 인지
- [ ] 이메일 수신자는 QOS와 양방향이므로 로컬 변경 가능

---

## 배포 전 최종 확인

### 9. QOS 연동 테스트
- [ ] 이슈 등록 → QOS 개선과제 페이지에서 15분 내 표시 확인
- [ ] 상태 변경 → QOS에서 상태 반영 확인
- [ ] QOS에서 상태 변경 → 프로젝트에서 상태 반영 확인

### 10. 배포 후 모니터링
- [ ] QOS 홈페이지 "데이터 수집 현황"에서 해당 프로젝트 수집 시간 확인
- [ ] 수집 실패 시 Firebase Console에서 `scheduledDataCollection` 로그 확인

---

## 문의
- Quality OS 관리자: ksmoon@hsvina.com
- QOS 중앙 허브: https://hwk-quality-os.web.app
- 변경 이력 등록: https://hwk-quality-os.web.app/changelog

---

*이 체크리스트는 Quality OS v2.0 기준입니다. 최신 버전은 QOS 운영 매뉴얼 페이지에서 확인하세요.*
