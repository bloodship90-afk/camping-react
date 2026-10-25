import { toDate, dateStr, addDays, getCheckoutDate } from "./dateUtils.js";
import { ALL_SITES } from "../constants/sites.js";
import { identityMatches, normPhone, text } from "./reservationModel.js";

export function isSchedulable(r) {
  return (
    r &&
    ALL_SITES.includes(r.site) &&
    !!dateStr(toDate(r.checkin)) &&
    !!dateStr(getCheckoutDate(r))
  );
}
export function filterActive(reservations) {
  return Object.fromEntries(
    Object.entries(reservations || {}).filter(
      ([, r]) => r?.status !== "cancelled" && isSchedulable(r),
    ),
  );
}
export function overlaps(a, b) {
  return (
    isSchedulable(a) &&
    isSchedulable(b) &&
    a.site === b.site &&
    toDate(a.checkin) < getCheckoutDate(b) &&
    toDate(b.checkin) < getCheckoutDate(a)
  );
}
export function conflictsFor(reservations, candidate, exceptKey) {
  return Object.entries(filterActive(reservations)).filter(
    ([k, r]) => k !== exceptKey && overlaps(r, candidate),
  );
}
export function inWeek(r, weekDays) {
  return (
    isSchedulable(r) &&
    toDate(r.checkin) < addDays(weekDays[6], 1) &&
    getCheckoutDate(r) > weekDays[0]
  );
}
export function detectDuplicates(siteReservations) {
  const dups = new Set();
  let dupPairs = 0;
  for (let a = 0; a < siteReservations.length; a++)
    for (let b = a + 1; b < siteReservations.length; b++) {
      if (overlaps(siteReservations[a][1], siteReservations[b][1])) {
        dups.add(siteReservations[a][0]);
        dups.add(siteReservations[b][0]);
        dupPairs++;
      }
    }
  return { dups, dupPairs };
}
export function buildBarList(siteReservations, weekDays) {
  const barList = siteReservations
    .filter(([, r]) => inWeek(r, weekDays))
    .map(([key, r]) => {
      const checkin = toDate(r.checkin),
        checkout = getCheckoutDate(r);
      const startIdx = weekDays.findIndex((d) => d >= checkin);
      const endIdx = weekDays.findIndex((d) => d >= checkout);
      const start = Math.max(0, startIdx),
        end = endIdx < 0 ? 7 : endIdx;
      return {
        key,
        r,
        startIdx: start,
        endIdx: end,
        span: end - start,
        checkin,
        checkout,
      };
    })
    .filter((b) => b.span > 0)
    .sort(
      (a, b) =>
        a.startIdx - b.startIdx ||
        b.span - a.span ||
        a.key.localeCompare(b.key),
    );
  const rowAssign = {};
  barList.forEach((bar, i) => {
    let row = 0;
    while (
      barList
        .slice(0, i)
        .some(
          (prev) =>
            rowAssign[prev.key] === row &&
            bar.startIdx < prev.endIdx &&
            prev.startIdx < bar.endIdx,
        )
    )
      row++;
    rowAssign[bar.key] = row;
  });
  return { barList, rowAssign };
}
export function calcWeekStats(
  reservations,
  weekDays,
  totalSites = ALL_SITES.length,
) {
  const entries = Object.entries(filterActive(reservations)).filter(([, r]) =>
    inWeek(r, weekDays),
  );
  const occupied = weekDays.map(() => new Set()),
    reservationCounts = weekDays.map(() => 0);
  entries.forEach(([, r]) =>
    weekDays.forEach((d, i) => {
      if (toDate(r.checkin) <= d && d < getCheckoutDate(r)) {
        occupied[i].add(r.site);
        reservationCounts[i]++;
      }
    }),
  );
  const dailyCounts = occupied.map((s) => s.size);
  const usedSlots = dailyCounts.reduce((a, b) => a + b, 0),
    totalSlots = totalSites * 7;
  let dupPairs = 0;
  const duplicates = new Set();
  ALL_SITES.forEach((site) => {
    const result = detectDuplicates(entries.filter(([, r]) => r.site === site));
    dupPairs += result.dupPairs;
    result.dups.forEach((k) => duplicates.add(k));
  });
  return {
    weekRes: entries.length,
    dailyCounts,
    reservationCounts,
    usedSlots,
    totalSlots,
    occupancy: totalSlots ? Math.round((100 * usedSlots) / totalSlots) : 0,
    dupPairs,
    duplicateCount: duplicates.size,
    excessNights: reservationCounts.reduce(
      (n, c, i) => n + c - dailyCounts[i],
      0,
    ),
  };
}
export const calcOccupancy = calcWeekStats;
export function isDuplicateReservation(reservations, reservationId, platform) {
  return Object.values(reservations || {}).some(
    (r) =>
      text(r?.reservationId) === text(reservationId) &&
      !!text(reservationId) &&
      (!platform || !r?.platform || r.platform === platform),
  );
}
export function findCancelKeys(reservations, cancelItem) {
  const active = Object.fromEntries(
    Object.entries(reservations || {}).filter(
      ([, r]) => r?.status !== "cancelled",
    ),
  );
  const byId = identityMatches(active, cancelItem);
  if (byId.length)
    return {
      keys: byId.map(([k]) => k),
      isFallback: byId.some(([, r]) => !r.platform),
    };
  if (
    !text(cancelItem.name) ||
    !normPhone(cancelItem.phone) ||
    !dateStr(toDate(cancelItem.checkin))
  )
    return { keys: [], isFallback: false };
  const candidates = Object.entries(active).filter(
    ([, r]) =>
      (!r?.platform || r.platform === cancelItem.platform) &&
      text(r?.name) === text(cancelItem.name) &&
      normPhone(r?.phone) === normPhone(cancelItem.phone) &&
      r?.checkin === cancelItem.checkin &&
      (!cancelItem.site || r?.site === cancelItem.site),
  );
  return {
    keys: candidates.map(([k]) => k),
    isFallback: candidates.length > 0,
  };
}
