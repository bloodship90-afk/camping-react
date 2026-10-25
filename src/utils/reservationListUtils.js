import { toDate, dateStr, getCheckoutDate, getWeekDates } from "./dateUtils.js";
import { ALL_SITES } from "../constants/sites.js";
import { normPhone, text } from "./reservationModel.js";
export function toListArray(reservations) {
  return Object.entries(reservations || {}).map(([key, r]) => ({
    ...r,
    _key: key,
  }));
}
export const getCheckout = (r) => dateStr(getCheckoutDate(r));
export function getThisWeekRange(today = new Date()) {
  const days = getWeekDates(0, today);
  return { start: dateStr(days[0]), end: dateStr(days[6]) };
}
export function getThisMonthRange(today = new Date()) {
  const d = typeof today === "string" ? toDate(today) : today;
  return {
    start: dateStr(new Date(d.getFullYear(), d.getMonth(), 1)),
    end: dateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}
export function getNextMonthRange(today = new Date()) {
  const d = typeof today === "string" ? toDate(today) : today;
  return {
    start: dateStr(new Date(d.getFullYear(), d.getMonth() + 1, 1)),
    end: dateStr(new Date(d.getFullYear(), d.getMonth() + 2, 0)),
  };
}
const customerKey = (r) =>
  text(r.name) && normPhone(r.phone).length >= 8
    ? text(r.name) + "|" + normPhone(r.phone)
    : "";
export function buildVisitCountMap(allList, today = dateStr(new Date())) {
  const map = {};
  allList.forEach((r) => {
    const key = customerKey(r),
      checkout = getCheckout(r);
    if (key && r.status !== "cancelled" && checkout && checkout < today)
      map[key] = (map[key] || 0) + 1;
  });
  return map;
}
export const getVisitCount = (map, r) => map[customerKey(r)] || 0;
export function applyFilters(
  list,
  filters,
  showPast = false,
  today = dateStr(new Date()),
) {
  const {
    name,
    phone,
    platform,
    status,
    checkinDate,
    rangeStart,
    rangeEnd,
    rangeMode = "stay",
  } = filters;
  return list.filter((r) => {
    const checkout = getCheckout(r);
    if (status === "issues" && !r._issues?.length) return false;
    if (!showPast && checkout && checkout < today) return false;
    if (name && !text(r.name).toLowerCase().includes(name.trim().toLowerCase()))
      return false;
    if (phone && !normPhone(r.phone).includes(normPhone(phone))) return false;
    if (
      platform !== undefined &&
      platform !== "전체" &&
      r.platform !== platform
    )
      return false;
    if (status === "active" && r.status === "cancelled") return false;
    if (status === "cancelled" && r.status !== "cancelled") return false;
    if (checkinDate && r.checkin !== checkinDate) return false;
    if (
      rangeStart &&
      (rangeMode === "stay"
        ? !checkout || checkout <= rangeStart
        : r.checkin < rangeStart)
    )
      return false;
    if (rangeEnd && (!r.checkin || r.checkin > rangeEnd)) return false;
    return true;
  });
}
const rank = (site) => {
  const n = ALL_SITES.indexOf(site);
  return n < 0 ? 999 : n;
};
export function applySort(list, sortKey) {
  return [...list].sort((a, b) => {
    if (sortKey === "name_asc")
      return text(a.name).localeCompare(text(b.name), "ko");
    if (sortKey === "platform_asc")
      return text(a.platform).localeCompare(text(b.platform), "ko");
    if (sortKey === "site_asc") return rank(a.site) - rank(b.site);
    const date =
      text(a.checkin).localeCompare(text(b.checkin)) *
      (sortKey === "checkin_desc" ? -1 : 1);
    return (
      date ||
      rank(a.site) - rank(b.site) ||
      text(a.name).localeCompare(text(b.name), "ko")
    );
  });
}
