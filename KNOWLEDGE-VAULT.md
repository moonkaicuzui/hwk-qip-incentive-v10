# Knowledge Vault Cross-Reference — HWK QIP INCENTIVE SYSTEM V10

이 프로젝트의 도메인·데이터 지식은 `/Users/ksmoon/knowledge/` Obsidian vault에 정리되어 있다.

## 📍 정찰 (raw)
- `/Users/ksmoon/knowledge/10-raw/2026-05-01-hwk-qip-incentive-스캔.md`

## 🏛 도메인 (필수 참조)
- `/Users/ksmoon/knowledge/20-refined/domain/business-rules/임계값-시작점-운영-철학.md` ⭐⭐ — 인센티브 10개 조건 임계값 + AQL 검사원 특화 (Level-A 지속도, CFA 700K, 클레임 방지 300-900K)
- `/Users/ksmoon/knowledge/20-refined/concepts/json-driven-config.md` ⭐⭐ — **이 프로젝트가 모범 사례** (`position_condition_matrix.json`, `aql_inspector_incentive_config.json`)
- `/Users/ksmoon/knowledge/20-refined/concepts/두-종류-검사원-구분.md` ⭐ — AQL 검사원과 QIP 스티커 인센티브 풀 분리

## 📊 데이터 사전
- `/Users/ksmoon/knowledge/20-refined/domain/data-dictionary/임계값-audit-매트릭스.md`

## 🧩 적용된 코드 지식
- `/Users/ksmoon/knowledge/20-refined/recipes/append-only-감사-컬렉션-구축.md` ⭐ — `threshold_history` 모범
- `/Users/ksmoon/knowledge/20-refined/recipes/firebase-admin-초기화-3단-폴백.md` ⭐ — **이 프로젝트의 `firebase_common.py` 가 모범 사례** (Python)
- `/Users/ksmoon/knowledge/20-refined/concepts/qos-contract-크로스-프로젝트-표준.md` — `system_feedback` ↔ QOS feedbackCollector
- `/Users/ksmoon/knowledge/20-refined/concepts/predeploy-qos-유지보수-락.md` — predeploy/postdeploy maintenance-toggle 호출
- `/Users/ksmoon/knowledge/20-refined/recipes/hsvina-smtp-이메일-발송.md` — 3개 언어 피드백 알림

## 🔄 Vault 갱신 의무

도메인 영향 변경 시 vault 노트도 함께 갱신:
1. **인센티브 10개 조건 변경** → json-driven-config 노트 + 임계값-시작점 철학 사례 갱신
2. **`thresholds/{monthYear}` 변경** → `threshold_history` 자동 audit
3. **`position_condition_matrix.json` 변경 (직책별 정책)** → json-driven-config 노트의 사례 갱신
4. **AQL 검사원 인센티브 룰 변경** (`aql_inspector_incentive_config.json`) → 두-종류-검사원-구분의 인센티브 풀 분리 갱신
5. **GitHub Actions 파이프라인 변경** → 데이터-아키텍처-MOC 갱신
6. **`system_feedback` 컬렉션명·필드 변경 금지** (QOS_CONTRACT 위반)

상세 절차: `/Users/ksmoon/knowledge/20-refined/recipes/vault-자동-갱신-시스템.md`
