import { toDate, dateStr } from "./dateUtils.js";

// status === "cancelled" 제외
export function filterActive(reservations) {
  return Object.fromEntries(
    Object.entries(reservations).filter(([, r]) => r.status !== "cancelled")
  );
}

// 같은 사이트 내 날짜 범위 겹침 검출 → 중복 key Set 과 pair 개수
export function detectDuplicates(siteReservations) {
  const dups = new Set();
  let dupPairs = 0;
  for (let a = 0; a < siteReservations.length; a++) {
    for (let b = a + 1; b < siteReservations.length; b++) {
      const [ka, ra] = siteReservations[a];
      const [kb, rb] = siteReservations[b];
      const aS = toDate(ra.checkin);
      const aE = new Date(aS);
      aE.setDate(aE.getDate() + ra.nights);
      const bS = toDate(rb.checkin);
      const bE = new Date(bS);
      bE.setDate(bE.getDate() + rb.nights);
      if (aS < bE && bS < aE) {
        dups.add(ka);
        dups.add(kb);
        dupPairs++;
      }
    }
  }
  return { dups, dupPairs };
}

// 한 사이트의 예약 바를 주차에 맞춰 배치 (start/end index, 행 배정 포함)
export function buildBarList(siteReservations, weekDays) {
  const weekStart = weekDays[0];
  const weekEnd = new Date(weekDays[6]);
  weekEnd.setDate(weekEnd.getDate() + 1);
  const weekStrs = weekDays.map((d) => dateStr(d));

  const barList = [];
  siteReservations.forEach(([key, r]) => {
    const checkin = toDate(r.checkin);
    const checkout = new Date(checkin);
    checkout.setDate(checkout.getDate() + r.nights);
    if (checkout <= weekStart || checkin >= weekEnd) return;

    let startIdx = weekStrs.findIndex((s) => s === dateStr(checkin));
    if (startIdx < 0) startIdx = checkin < weekStart ? 0 : 7;
    let endIdx = weekStrs.findIndex((s) => s === dateStr(checkout));
    if (endIdx < 0) endIdx = checkout > weekDays[6] ? 7 : 0;

    startIdx = Math.max(0, startIdx);
    endIdx = Math.min(7, endIdx);
    const span = endIdx - startIdx;
    if (span <= 0) return;
    barList.push({ key, r, startIdx, endIdx, span, checkin, checkout });
  });

  // 같은 행에서 겹치지 않게 행 배정
  const rowAssign = {};
  barList.forEach((b, i) => {
    let row = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const conflict = barList.slice(0, i).some(
        (prev) =>
          rowAssign[prev.key] === row &&
          b.startIdx < prev.endIdx &&
          prev.startIdx < b.endIdx
      );
      if (!conflict) break;
      row++;
    }
    rowAssign[b.key] = row;
  });

  return { barList, rowAssign };
}

// 주간 점유율 계산
export function calcOccupancy(activeReservations, weekDays, totalSites) {
  const totalSlots = totalSites * 7;
  let usedSlots = 0;
  const start = weekDays[0];
  const end = weekDays[6];
  Object.values(activeReservations).forEach((r) => {
    const s = toDate(r.checkin);
    for (let i = 0; i < r.nights; i++) {
      const d = new Date(s);
      d.setDate(d.getDate() + i);
      if (d >= start && d <= end) usedSlots++;
    }
  });
  return {
    occupancy: Math.round((usedSlots / totalSlots) * 100),
    usedSlots,
    totalSlots,
  };
}

// reservationId 기준 중복 저장 방지 — index.html 의 isDuplicate 와 동치
export function isDuplicateReservation(reservations, reservationId) {
  if (!reservationId) return false;
  return Object.values(reservations).some(
    (r) => r.reservationId === reservationId && r.status !== "cancelled"
  );
}

// 취소 매칭: reservationId 우선, 실패 시 name+phone+checkin fallback
export function findCancelKeys(reservations, cancelItem) {
  const normPhone = (p) => (p || "").replace(/\D/g, "");
  const byId = [];
  const byFallback = [];
  Object.entries(reservations).forEach(([k, r]) => {
    if (r.status === "cancelled") return;
    if (cancelItem.reservationId && r.reservationId === cancelItem.reservationId) {
      byId.push(k);
    } else if (
      r.name === cancelItem.name &&
      normPhone(r.phone) === normPhone(cancelItem.phone) &&
      r.checkin === cancelItem.checkin
    ) {
      byFallback.push(k);
    }
  });
  const matched = byId.length > 0 ? byId : byFallback;
  return { keys: matched, isFallback: byId.length === 0 && byFallback.length > 0 };
}
