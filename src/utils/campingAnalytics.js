import { ALL_SITES } from "../constants/sites.js";
import { PLATFORMS } from "../constants/platforms.js";
import { fields, normPhone, validateReservation } from "./reservationModel.js";
import { addDays, dateStr, getCheckoutDate, toDate } from "./dateUtils.js";

export const SEASONS = ["봄", "여름", "가을", "겨울"];
export const seasonOf = (day) => {
  const m = Number(day.slice(5, 7));
  return m >= 3 && m <= 5
    ? "봄"
    : m >= 6 && m <= 8
      ? "여름"
      : m >= 9 && m <= 11
        ? "가을"
        : "겨울";
};
const dayNumber = (value) => {
  const d = toDate(value);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
};
const daysBetween = (a, b) => dayNumber(b) - dayNumber(a);
const percent = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const isWeekend = (day) => [5, 6].includes(toDate(day).getDay()); // Fri/Sat nights
function calendarDays(start, end) {
  const total = Math.max(0, daysBetween(start, end) + 1);
  let weekend = Math.floor(total / 7) * 2;
  for (let i = Math.floor(total / 7) * 7; i < total; i++)
    if (isWeekend(dateStr(addDays(start, i)))) weekend++;
  return { total, weekend, weekday: total - weekend };
}
const bucket = (label) => ({
  label,
  bookings: 0,
  nights: 0,
  bookedNights: 0,
  cancelled: 0,
  campers: new Set(),
  slots: new Set(),
  weekend: new Set(),
  weekday: new Set(),
  lengths: [0, 0, 0],
  newCampers: new Set(),
  returning: new Set(),
});
function visitsFor(records) {
  const visits = [];
  for (const r of [...records].sort(
    (a, b) =>
      a.checkin.localeCompare(b.checkin) ||
      a.checkout.localeCompare(b.checkout),
  )) {
    const prev = visits.at(-1);
    if (prev && r.checkin <= prev.checkout) {
      prev.checkout = prev.checkout > r.checkout ? prev.checkout : r.checkout;
      prev.records.push(r);
    } else
      visits.push({ checkin: r.checkin, checkout: r.checkout, records: [r] });
  }
  return visits;
}
// Read-only projection. Never normalizes, writes, deletes, or migrates source records.
export function buildAnalytics(
  raw,
  { today, start = "", end = "", mode = "completed", excludedKeys = [] },
) {
  const excluded = [],
    candidates = [],
    excludedSet = new Set(excludedKeys);
  for (const [key, value] of Object.entries(raw || {})) {
    let reason = "";
    if (excludedSet.has(key)) reason = "화면에서 제외";
    else if (!value || typeof value !== "object" || Array.isArray(value))
      reason = "레코드 형식 오류";
    else if (typeof value.name !== "string" || !value.name.trim())
      reason = "이름 누락";
    else if (!value.phone) reason = "전화번호 누락";
    else if (
      !/^[+\d\s().-]+$/.test(String(value.phone)) ||
      !/^\d{8,15}$/.test(normPhone(value.phone)) ||
      /^0+$/.test(normPhone(value.phone))
    )
      reason = "전화번호 형식 확인 필요";
    else if (
      validateReservation(value).length ||
      (value.status && !["active", "cancelled"].includes(value.status))
    )
      reason = "예약 필드 오류";
    const r = fields(value);
    if (!reason && !dateStr(toDate(dateStr(getCheckoutDate(r)))))
      reason = "퇴실일 범위 오류";
    if (reason) excluded.push({ key, name: r.name || "이름 없음", reason });
    else
      candidates.push({
        ...r,
        key,
        checkout: dateStr(getCheckoutDate(r)),
        identity: JSON.stringify([r.name, normPhone(r.phone)]),
      });
  }
  const phoneNames = new Map(),
    ids = new Map();
  for (const r of candidates) {
    const phone = normPhone(r.phone);
    if (!phoneNames.has(phone)) phoneNames.set(phone, new Set());
    phoneNames.get(phone).add(r.name);
    if (r.reservationId) {
      const id = JSON.stringify([r.platform, r.reservationId]);
      ids.set(id, (ids.get(id) || 0) + 1);
    }
  }
  const records = candidates.filter((r) => {
    const reason =
      phoneNames.get(normPhone(r.phone)).size > 1
        ? "같은 전화번호에 다른 이름 · 매칭 확인 필요"
        : r.reservationId &&
            ids.get(JSON.stringify([r.platform, r.reservationId])) > 1
          ? "플랫폼·예약번호 중복 · 확인 필요"
          : "";
    if (reason) excluded.push({ key: r.key, name: r.name, reason });
    return !reason;
  });
  const active = records.filter((r) => r.status !== "cancelled");
  const completed = active.filter((r) => r.checkout <= today);
  const eligible = mode === "completed" ? completed : active;
  const sourceStart = records.map((r) => r.checkin).sort()[0] || "";
  const rangeRecords =
    mode === "completed" ? records.filter((r) => r.checkout <= today) : records;
  const from = start || rangeRecords.map((r) => r.checkin).sort()[0] || today;
  let to =
    end ||
    rangeRecords
      .map((r) => dateStr(addDays(r.checkout, -1)))
      .sort()
      .at(-1) ||
    today;
  if (mode === "completed" && to >= today) to = dateStr(addDays(today, -1));
  const calendar = calendarDays(from, to);
  const platforms = Object.fromEntries(PLATFORMS.map((p) => [p, bucket(p)]));
  const sites = Object.fromEntries(ALL_SITES.map((s) => [s, bucket(s)]));
  const seasons = Object.fromEntries(SEASONS.map((s) => [s, bucket(s)]));
  const months = {},
    summary = bucket("전체"),
    campers = new Map();
  const monthBucket = (month) => (months[month] ||= bucket(month));
  const inRange = (r) =>
    calendar.total > 0 && r.checkin >= from && r.checkin <= to;
  const intersects = (r) =>
    calendar.total > 0 && r.checkin <= to && r.checkout > from;
  for (const r of records.filter(
    (r) => r.status === "cancelled" && inRange(r),
  )) {
    for (const b of [
      summary,
      platforms[r.platform],
      sites[r.site],
      seasons[seasonOf(r.checkin)],
      monthBucket(r.checkin.slice(0, 7)),
    ])
      b.cancelled++;
  }
  const allCamperRecords = new Map();
  for (const r of active) {
    if (!allCamperRecords.has(r.identity)) allCamperRecords.set(r.identity, []);
    allCamperRecords.get(r.identity).push(r);
  }
  for (const [identity, all] of allCamperRecords) {
    const history = all.filter((r) => r.checkout <= today);
    const visits = visitsFor(history);
    const selected = eligible.filter(
      (r) => r.identity === identity && intersects(r),
    );
    if (!selected.length) continue;
    const seasonVisits = Object.fromEntries(SEASONS.map((s) => [s, 0]));
    const seasonNights = { ...seasonVisits };
    for (const v of visits) seasonVisits[seasonOf(v.checkin)]++;
    const occupied = new Set();
    for (const r of history)
      for (let i = 0; i < r.nights; i++) {
        const day = dateStr(addDays(r.checkin, i));
        occupied.add(day);
      }
    for (const day of occupied) seasonNights[seasonOf(day)]++;
    const platformCounts = Object.fromEntries(
      PLATFORMS.map((p) => [p, history.filter((r) => r.platform === p).length]),
    );
    const max = Math.max(...Object.values(seasonVisits));
    const preferred = max
      ? SEASONS.filter((s) => seasonVisits[s] === max).join("·")
      : "아직 이용 완료 없음";
    const gaps = visits
      .slice(1)
      .map((v, i) => daysBetween(visits[i].checkout, v.checkin));
    campers.set(identity, {
      identity,
      name: all[0].name,
      phone: all[0].phone,
      visits: visits.length,
      nights: occupied.size,
      selectedBookings: selected.filter(inRange).length,
      selectedNights: 0,
      seasonVisits,
      seasonNights,
      preferred,
      latest: visits.at(-1)?.checkout || "",
      gap: gaps.length
        ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
        : null,
      upcoming: all.filter((r) => r.checkout > today).length,
      platforms:
        PLATFORMS.filter(
          (p) =>
            platformCounts[p] > 0 &&
            platformCounts[p] === Math.max(...Object.values(platformCounts)),
        ).join("·") || "—",
      history: records
        .filter((r) => r.identity === identity)
        .sort((a, b) => b.checkin.localeCompare(a.checkin)),
      weekendNights: [...occupied].filter(isWeekend).length,
    });
  }
  let duplicateSlots = 0;
  for (const r of eligible.filter(intersects)) {
    const camper = campers.get(r.identity);
    const first = allCamperRecords
      .get(r.identity)
      .map((r) => r.checkin)
      .sort()[0];
    if (inRange(r)) {
      for (const b of [
        summary,
        platforms[r.platform],
        sites[r.site],
        seasons[seasonOf(r.checkin)],
        monthBucket(r.checkin.slice(0, 7)),
      ]) {
        b.bookings++;
        b.bookedNights += r.nights;
        b.campers.add(r.identity);
        b.lengths[Math.min(r.nights, 3) - 1]++;
        (r.checkin === first ? b.newCampers : b.returning).add(r.identity);
      }
    }
    for (let i = 0; i < r.nights; i++) {
      const day = dateStr(addDays(r.checkin, i));
      if (day < from || day > to) continue;
      const slot = `${r.site}|${day}`;
      if (summary.slots.has(slot)) duplicateSlots++;
      camper.selectedNights++;
      for (const b of [
        summary,
        platforms[r.platform],
        sites[r.site],
        seasons[seasonOf(day)],
        monthBucket(day.slice(0, 7)),
      ]) {
        b.nights++;
        b.slots.add(slot);
        (isWeekend(day) ? b.weekend : b.weekday).add(slot);
      }
    }
  }
  const finish = (b, capacity = ALL_SITES.length, period = calendar) => ({
    days: period.total,
    ...b,
    campers: b.campers.size,
    newCampers: b.newCampers.size,
    returning: b.returning.size,
    occupied: b.slots.size,
    occupancy: percent(b.slots.size, period.total * capacity),
    weekendRate: percent(b.weekend.size, period.weekend * capacity),
    weekdayRate: percent(b.weekday.size, period.weekday * capacity),
    average: b.bookings
      ? Math.round((b.bookedNights / b.bookings) * 10) / 10
      : 0,
    cancelRate: percent(b.cancelled, b.bookings + b.cancelled),
  });
  const selectedCampers = [...campers.values()].sort(
    (a, b) => b.nights - a.nights || a.name.localeCompare(b.name),
  );
  const monthly = Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, b]) => {
      const monthStart = `${month}-01`,
        monthEnd = dateStr(
          addDays(
            new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 1),
            -1,
          ),
        );
      return finish(
        b,
        ALL_SITES.length,
        calendarDays(
          from > monthStart ? from : monthStart,
          to < monthEnd ? to : monthEnd,
        ),
      );
    });
  function forward(days) {
    const slots = new Set();
    const last = dateStr(addDays(today, days));
    for (const r of active)
      for (let i = 0; i < r.nights; i++) {
        const day = dateStr(addDays(r.checkin, i));
        if (day >= today && day < last) slots.add(`${r.site}|${day}`);
      }
    return percent(slots.size, days * ALL_SITES.length);
  }
  const seasonDays = Object.fromEntries(SEASONS.map((s) => [s, 0]));
  if (calendar.total > 0) {
    let cursor = from.slice(0, 7) + "-01";
    while (cursor <= to) {
      const next = new Date(
        Number(cursor.slice(0, 4)),
        Number(cursor.slice(5, 7)),
        1,
      );
      const last = dateStr(addDays(next, -1));
      seasonDays[seasonOf(cursor)] += calendarDays(
        from > cursor ? from : cursor,
        to < last ? to : last,
      ).total;
      if (last >= to) break;
      cursor = dateStr(next);
    }
  }
  return {
    seasonDays,
    from,
    to,
    calendar,
    sourceStart,
    totalRecords: Object.keys(raw || {}).length,
    included: records.length,
    excluded,
    summary: finish(summary),
    platforms: Object.values(platforms).map((b) => finish(b)),
    sites: Object.values(sites).map((b) => finish(b, 1)),
    groups: ["A", "B", "C"].map((group) => {
      const b = bucket(group);
      for (const site of ALL_SITES.filter((s) => s.startsWith(group))) {
        const s = sites[site];
        b.bookings += s.bookings;
        b.nights += s.nights;
        b.cancelled += s.cancelled;
        for (const key of ["slots", "weekend", "weekday"])
          for (const value of s[key]) b[key].add(value);
      }
      return finish(b, ALL_SITES.filter((s) => s.startsWith(group)).length);
    }),
    seasons: Object.values(seasons).map((b) => finish(b)),
    monthly,
    campers: selectedCampers,
    repeat: selectedCampers.filter((c) => c.visits >= 2).length,
    repeatRate: percent(
      selectedCampers.filter((c) => c.visits >= 2).length,
      selectedCampers.length,
    ),
    duplicateSlots,
    forward30: forward(30),
    forward60: forward(60),
    dormant: [...allCamperRecords]
      .map(([identity]) => {
        const history = completed.filter((r) => r.identity === identity);
        const visits = visitsFor(history);
        return {
          name: history[0]?.name,
          visits: visits.length,
          latest: visits.at(-1)?.checkout,
          upcoming: active.some(
            (r) => r.identity === identity && r.checkout > today,
          ),
        };
      })
      .filter(
        (c) =>
          c.visits >= 2 && !c.upcoming && daysBetween(c.latest, today) >= 180,
      ),
  };
}
