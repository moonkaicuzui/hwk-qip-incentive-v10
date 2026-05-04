/**
 * AQL Reject PO Allowance — 영향 직원 산출 서비스
 *
 * Cloud Function `computeAqlPoImpact`가 사용.
 * 입력 PO 번호들을 가상으로 PASS 처리하여 c5~c8 재계산.
 *
 * 의존:
 *   - aql_records/{monthYear} (또는 aql_records/{monthYear}/chunks/*)
 *   - employees/{monthYear}/all_data/data
 *   - configs/auditor_trainer_area_mapping (선택)
 *   - thresholds/{monthYear}
 */

const { getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");

const db = () => getFirestore();

// ─── AQL 레코드 로드 (단일 문서 + 청크 모두 지원) ───────────────────

async function loadAqlRecords(monthYear) {
  const ref = db().collection("aql_records").doc(monthYear);
  const doc = await ref.get();
  if (!doc.exists) {
    throw new Error(`AQL records not found for ${monthYear}`);
  }
  const data = doc.data();
  if (Array.isArray(data.records)) {
    return data.records;
  }
  // 청크 모드
  if (data.chunk_count && data.chunk_count > 0) {
    const chunkSnap = await ref.collection("chunks").orderBy("index").get();
    const records = [];
    chunkSnap.forEach((c) => {
      const chunk = c.data();
      if (Array.isArray(chunk.records)) records.push(...chunk.records);
    });
    return records;
  }
  return [];
}

// ─── 직원 데이터 로드 ─────────────────────────────────────────────

async function loadEmployees(monthYear) {
  const ref = db().collection("employees").doc(monthYear).collection("all_data").doc("data");
  const doc = await ref.get();
  if (!doc.exists) throw new Error(`Employees not found for ${monthYear}`);
  return doc.data().employees || [];
}

// ─── 임계값 로드 ─────────────────────────────────────────────────

async function loadThresholds(monthYear) {
  try {
    const doc = await db().collection("thresholds").doc(monthYear).get();
    if (doc.exists) return doc.data();
  } catch (e) {
    logger.warn(`thresholds load failed: ${e.message}`);
  }
  // Fallback defaults
  return { area_reject_rate: 3.0 };
}

// ─── 직원 emp_no 정규화 (9자리 zero-padding) ─────────────────────

function normEmpNo(raw) {
  if (raw === undefined || raw === null) return "";
  let s = String(raw).split(".")[0].trim();
  if (!s) return "";
  return s.padStart(9, "0");
}

// ─── PO 매칭 ────────────────────────────────────────────────────

function isPoMatched(record, poSet) {
  return poSet.has(record.p1) || poSet.has(record.p2);
}

// ─── c5 재계산: 직원별 NORMAL PO에서 FAIL 건수 ───────────────────

function computeC5(records, exemptPoSet) {
  // 직원별 FAIL 카운트 (PO 면제 적용 후)
  const failCount = {};
  for (const r of records) {
    if (r.rp && r.rp !== "" && r.rp.toLowerCase() !== "normal po") {
      // REPACKING PO는 c5/c8 계산에서 제외 (기존 로직)
      // 단, 빈 값/"NORMAL PO"는 모두 NORMAL로 간주
    }
    // 사용자 결정: PO 면제 시 그 PO의 모든 행을 PASS로 간주
    if (isPoMatched(r, exemptPoSet)) continue; // 면제 → 카운트 제외

    if (r.r === "FAIL") {
      failCount[r.e] = (failCount[r.e] || 0) + 1;
    }
  }
  return failCount;
}

// ─── c6 재계산 (등록된 월에만 적용 — 사용자 결정사항) ─────────────
// 등록된 월의 FAIL이 모두 사라지면 Continuous_FAIL을 'NO'로 처리.
// 과거 월 데이터는 건드리지 않음.

function computeC6Override(employees, c5FailCountAfter, exemptPoSet) {
  // 각 직원에 대해, 이번 달 FAIL이 0이 되었으면 c6도 PASS 처리 후보
  // 단, 과거 월의 연속 실패 누적은 보존 (Continuous_FAIL 값 자체는 변경 안 함)
  // → 단순화: 이번 달 c5가 PASS면 c6도 PASS 후보로 표시
  // (정확한 의미: 이 월의 FAIL이 사라졌으므로 이 월 기여분은 0)
  // 보수적 해석: c6은 과거 의존이라, 이번 달만으로 PASS 단정 어려움.
  // 사용자 결정 "등록된 월에만 적용" → 이번 달 FAIL이 0이 되면 c6 면제 가능으로 표시.
  const c6Override = {}; // emp_no → bool (true = c6 면제 가능)
  for (const emp of employees) {
    const empNo = normEmpNo(emp.emp_no || emp["Employee No"] || "");
    if (!empNo) continue;
    const wasC5Fail = String(emp.conditions?.c5 || "").toUpperCase() === "NO";
    const wasC6Fail = String(emp.conditions?.c6 || "").toUpperCase() === "NO";
    const newC5Fails = c5FailCountAfter[empNo] || 0;
    // c5가 원래 NO였는데 이번 면제로 0이 되면, c6도 면제 처리 가능
    if (wasC6Fail && wasC5Fail && newC5Fails === 0) {
      c6Override[empNo] = true;
    }
  }
  return c6Override;
}

// ─── c8 재계산: Building/Area별 reject율 ─────────────────────────

function computeBuildingRejectRates(records, exemptPoSet) {
  // building → { total, fails, rate }
  const rates = {};
  let allTotal = 0;
  let allFails = 0;

  for (const r of records) {
    // REPACKING PO 제외 (NORMAL PO만 카운트)
    const isNormal = !r.rp || r.rp === "" || r.rp.toLowerCase() === "normal po";
    if (!isNormal) continue;

    const b = r.b || "_unknown";
    if (!rates[b]) rates[b] = { total: 0, fails: 0 };
    rates[b].total += 1;
    allTotal += 1;

    let isFail = r.r === "FAIL";
    if (isPoMatched(r, exemptPoSet)) isFail = false; // 면제 → PASS 처리

    if (isFail) {
      rates[b].fails += 1;
      allFails += 1;
    }
  }

  for (const b in rates) {
    const v = rates[b];
    v.rate = v.total > 0 ? (v.fails / v.total) * 100 : 0;
  }
  const allRate = allTotal > 0 ? (allFails / allTotal) * 100 : 0;
  return { byBuilding: rates, allArea: { total: allTotal, fails: allFails, rate: allRate } };
}

// ─── c7/c8 직원별 적용 ─────────────────────────────────────────

function applyC7C8Override(emp, c6Override, buildingRates, threshold) {
  const empNo = normEmpNo(emp.emp_no || emp["Employee No"] || "");
  const result = { c7: null, c8: null };

  const wasC7Fail = String(emp.conditions?.c7 || "").toUpperCase() === "NO";
  const wasC8Fail = String(emp.conditions?.c8 || "").toUpperCase() === "NO";

  // c7: LINE LEADER / AUDIT/TRAINING 본인 + 부하 c6에 의존
  // 단순화: 기존 c7=NO인데 본인 c6이 면제 가능해진 경우만 면제 후보로 표시
  // (정확한 c7 재계산은 부하 직원 매핑 필요 → 단계 1에서 단순화, 단계 2에서 정밀화)
  if (wasC7Fail && c6Override[empNo]) {
    result.c7 = "YES";
  }

  // c8: 직원의 building reject율이 threshold 미만이 되면 면제
  if (wasC8Fail) {
    const empBuilding = emp.building || "";
    const position = String(emp.position || emp["QIP POSITION 1ST  NAME"] || "").toUpperCase();
    let newRate = 0;
    if (position.includes("MODEL") && position.includes("MASTER")) {
      newRate = buildingRates.allArea.rate;
    } else if (empBuilding && buildingRates.byBuilding[empBuilding]) {
      newRate = buildingRates.byBuilding[empBuilding].rate;
    } else {
      // building 정보 없으면 전체 reject율 사용
      newRate = buildingRates.allArea.rate;
    }
    if (newRate < threshold) {
      result.c8 = "YES";
    }
  }

  return result;
}

// ─── 인센티브 재계산 (TYPE-1 progressive table + TYPE-2 multipliers) ────

const PROGRESSIVE_TABLE_DEFAULT = [
  0, 150000, 250000, 300000, 350000, 400000, 450000, 500000,
  650000, 750000, 850000, 950000, 1000000, 1000000, 1000000, 1000000,
];

function calcIncentive(emp, allEmployees) {
  const empType = String(emp.type || "").toUpperCase();
  let cont = parseInt(emp.continuous_months || 0, 10);
  if (cont <= 0) {
    // 이전 인센티브 기반 역산
    const prevCont = parseInt(emp.previous_continuous_months || 0, 10);
    if (prevCont > 0) cont = Math.min(prevCont + 1, 15);
    else {
      const prevInc = parseFloat(emp.previous_incentive || 0) || 0;
      if (prevInc > 0) {
        let closest = 1;
        let minDiff = Infinity;
        for (let i = 1; i < PROGRESSIVE_TABLE_DEFAULT.length; i++) {
          const d = Math.abs(prevInc - PROGRESSIVE_TABLE_DEFAULT[i]);
          if (d < minDiff) { minDiff = d; closest = i; }
        }
        cont = Math.min(closest + 1, 15);
      } else {
        cont = 1;
      }
    }
  }

  if (empType === "TYPE-1" || empType === "1" || empType === "TYPE 1") {
    const idx = Math.min(Math.max(cont, 0), PROGRESSIVE_TABLE_DEFAULT.length - 1);
    return PROGRESSIVE_TABLE_DEFAULT[idx] || 0;
  }

  if (empType === "TYPE-2" || empType === "2" || empType === "TYPE 2") {
    const position = String(emp.position || "").toUpperCase();
    // TYPE-1 LINE LEADER 평균
    const llIncentives = [];
    for (const e of allEmployees) {
      if (String(e.type || "").toUpperCase() === "TYPE-1" &&
          String(e.position || "").toUpperCase() === "LINE LEADER" &&
          parseFloat(e.current_incentive || 0) > 0) {
        llIncentives.push(parseFloat(e.current_incentive));
      }
    }
    if (llIncentives.length === 0) return 0;
    const avg = llIncentives.reduce((a, b) => a + b, 0) / llIncentives.length;

    if (position.includes("S.MANAGER") || position.includes("SENIOR MANAGER")) return Math.round(avg * 4.0);
    if (position.includes("A.MANAGER") || position.includes("ASSISTANT MANAGER")) return Math.round(avg * 3.0);
    if (position.includes("SUPERVISOR")) return Math.round(avg * 2.5);
    if (position.includes("LINE") && position.includes("LEADER")) return Math.round(avg);
    if (position.includes("GROUP") && position.includes("LEADER")) {
      const llType2 = [];
      for (const e of allEmployees) {
        if (String(e.type || "").toUpperCase() === "TYPE-2" &&
            String(e.position || "").toUpperCase().includes("LINE LEADER") &&
            parseFloat(e.current_incentive || 0) > 0) {
          llType2.push(parseFloat(e.current_incentive));
        }
      }
      if (llType2.length > 0) {
        const avgLL2 = llType2.reduce((a, b) => a + b, 0) / llType2.length;
        return Math.round(avgLL2 * 2);
      }
      return Math.round(avg * 2);
    }
    return Math.round(avg);
  }

  return 0;
}

// ─── 메인: PO 영향 시뮬레이션 ───────────────────────────────────

async function computeAqlPoImpact({ monthYear, poNumbers, exemptConditions }) {
  if (!monthYear) throw new Error("monthYear required");
  if (!Array.isArray(poNumbers) || poNumbers.length === 0) {
    throw new Error("poNumbers required");
  }
  if (!Array.isArray(exemptConditions)) exemptConditions = ["c5", "c6", "c7", "c8"];

  const t0 = Date.now();

  // 1. 데이터 로드 (병렬)
  const [records, employees, thresholds] = await Promise.all([
    loadAqlRecords(monthYear),
    loadEmployees(monthYear),
    loadThresholds(monthYear),
  ]);
  logger.info(`[computeAqlPoImpact] loaded: records=${records.length}, employees=${employees.length}`);

  // 2. PO 정규화 (양쪽 .strip)
  const poSet = new Set(poNumbers.map((p) => String(p).trim()).filter(Boolean));

  // 3. 매칭된 행 통계
  const matchedRows = records.filter((r) => isPoMatched(r, poSet));
  if (matchedRows.length === 0) {
    return {
      success: true,
      message: "No matching AQL records for the given PO numbers",
      autoComputed: {
        models: [],
        buildings: [],
        lines: [],
        totalRejectQty: 0,
        matchedRowCount: 0,
        affectedEmployees: [],
      },
      meta: { elapsedMs: Date.now() - t0 },
    };
  }

  const models = [...new Set(matchedRows.map((r) => r.m).filter(Boolean))];
  const buildings = [...new Set(matchedRows.map((r) => r.b).filter(Boolean))];
  const lines = [...new Set(matchedRows.map((r) => r.l).filter(Boolean))];
  const totalRejectQty = matchedRows
    .filter((r) => r.r === "FAIL")
    .reduce((sum, r) => sum + (parseInt(r.q, 10) || 0), 0);

  // 4. c5/c8 재계산 (PO 면제 후)
  const c5FailAfter = computeC5(records, poSet);
  const c6Override = computeC6Override(employees, c5FailAfter, poSet);
  const buildingRates = computeBuildingRejectRates(records, poSet);
  const c8Threshold = parseFloat(thresholds.area_reject_rate || 3.0);

  // 5. 영향 직원 산출
  const affected = [];
  for (const emp of employees) {
    const empNo = normEmpNo(emp.emp_no || emp["Employee No"] || "");
    if (!empNo) continue;

    const conditions = emp.conditions || {};
    const empType = String(emp.type || "").toUpperCase();
    const isType1 = empType === "TYPE-1" || empType === "1" || empType === "TYPE 1";

    // 원본 조건
    const origConds = {};
    const newConds = {};
    let totalApplicable = 0;
    let origPassed = 0;

    for (let i = 1; i <= 10; i++) {
      const k = `c${i}`;
      const v = String(conditions[k] || "N/A").toUpperCase();
      // TYPE-2는 c5~c10 N/A
      if (!isType1 && i >= 5) {
        origConds[k] = "N/A";
        newConds[k] = "N/A";
        continue;
      }
      origConds[k] = v;
      newConds[k] = v;
      if (v !== "N/A") {
        totalApplicable += 1;
        if (v === "YES") origPassed += 1;
      }
    }

    // 면제 조건 적용
    let changedAny = false;
    if (exemptConditions.includes("c5") && origConds.c5 === "NO") {
      const newFails = c5FailAfter[empNo] || 0;
      if (newFails === 0) {
        newConds.c5 = "YES";
        changedAny = true;
      }
    }
    if (exemptConditions.includes("c6") && origConds.c6 === "NO" && c6Override[empNo]) {
      newConds.c6 = "YES";
      changedAny = true;
    }
    if (exemptConditions.includes("c7") || exemptConditions.includes("c8")) {
      const r = applyC7C8Override(emp, c6Override, buildingRates, c8Threshold);
      if (exemptConditions.includes("c7") && r.c7 === "YES" && origConds.c7 === "NO") {
        newConds.c7 = "YES";
        changedAny = true;
      }
      if (exemptConditions.includes("c8") && r.c8 === "YES" && origConds.c8 === "NO") {
        newConds.c8 = "YES";
        changedAny = true;
      }
    }

    if (!changedAny) continue;

    let newPassed = 0;
    for (let i = 1; i <= 10; i++) {
      const v = newConds[`c${i}`];
      if (v === "YES") newPassed += 1;
    }
    const origPassRate = totalApplicable > 0 ? (origPassed / totalApplicable) * 100 : 0;
    const newPassRate = totalApplicable > 0 ? (newPassed / totalApplicable) * 100 : 0;

    const origIncentive = parseFloat(emp.current_incentive || 0) || 0;
    let newIncentive = origIncentive;
    if (newPassRate >= 100 && origPassRate < 100) {
      // 100% 충족 달성 → 인센티브 재계산
      const tempEmp = Object.assign({}, emp, { conditions_pass_rate: newPassRate });
      newIncentive = calcIncentive(tempEmp, employees);
    }

    affected.push({
      empNo: empNo,
      name: emp.full_name || emp.name || "",
      position: emp.position || "",
      type: emp.type || "",
      building: emp.building || "",
      line: emp.line || "",
      originalConditions: origConds,
      overriddenConditions: newConds,
      originalPassed: origPassed,
      overriddenPassed: newPassed,
      conditionsApplicable: totalApplicable,
      originalPassRate: Math.round(origPassRate * 10) / 10,
      overriddenPassRate: Math.round(newPassRate * 10) / 10,
      originalIncentive: origIncentive,
      overriddenIncentive: newIncentive,
    });
  }

  return {
    success: true,
    autoComputed: {
      models: models,
      buildings: buildings,
      lines: lines,
      totalRejectQty: totalRejectQty,
      matchedRowCount: matchedRows.length,
      matchedFailCount: matchedRows.filter((r) => r.r === "FAIL").length,
      affectedEmployees: affected,
    },
    meta: {
      elapsedMs: Date.now() - t0,
      poCount: poSet.size,
      exemptConditions: exemptConditions,
      thresholds: { area_reject_rate: c8Threshold },
    },
  };
}

module.exports = {
  computeAqlPoImpact,
  // 테스트용 export
  _internal: {
    loadAqlRecords,
    computeC5,
    computeBuildingRejectRates,
    calcIncentive,
    normEmpNo,
  },
};
