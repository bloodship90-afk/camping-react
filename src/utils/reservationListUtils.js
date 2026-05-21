import { toDate, dateStr } from "./dateUtils.js";
import { ALL_SITES } from "../constants/sites.js";

// Firebase {key: {...}} 객체를 배열로 변환 (각 항목에 _key 포함)
export function toListArray(reservations) {
  return Object.entries(reservations || {}).map(([key, r]) => ({ ...r, _key: key }));
}

// 퇴실일 계산
export function getCheckout(r) {
  if (!r.checkin || !r.nights) return "";
  const d = toDate(r.checkin);
  d.setDate(d.getDate() + Number(r.nights));
  return dateStr(d);
}

// 이번 주 (월~일) 범위
export function getThisWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: dateStr(monday), end: dateStr(sunday) };
}

// 이번 달 범위
export function getThisMonthRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { start: dateStr(start), end: dateStr(end) };
}

// 다음 달 범위
export function getNextMonthRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  return { start: dateStr(start), end: dateStr(end) };
}

// 전화번호 정규화 (숫자만)
function normPhone(p) {
  return (p || "").replace(/\D/g, "");
}

// 고객 식별 키 (name + 정규화 전화번호)
function customerKey(r) {
  return (r.name || "") + "|" + normPhone(r.phone);
}

// 방문 횟수 맵 계산: cancelled 제외, allList 전체 기준
// 반환: { "이름|전화번호(숫자)": 횟수 }
export function buildVisitCountMap(allList) {
  const map = {};
  allList.forEach((r) => {
    if (r.status === "cancelled") return;
    const key = customerKey(r);
    map[key] = (map[key] || 0) + 1;
  });
  return map;
}

// 특정 예약의 방문 횟수 조회
export function getVisitCount(visitCountMap, r) {
  return visitCountMap[customerKey(r)] || 0;
}

// 필터 적용
// showPast: false(기본) = 퇴실일 < 오늘인 지난 예약 숨김, true = 전체 표시
export function applyFilters(list, filters, showPast = false) {
  const { name, phone, platform, status, checkinDate, rangeStart, rangeEnd } = filters;
  const todayStr = dateStr(new Date());

  return list.filter((r) => {
    // 지난 예약 숨김: checkout < today (오늘 퇴실은 포함)
    if (!showPast) {
      const checkout = getCheckout(r);
      if (checkout && checkout < todayStr) return false;
    }

    if (name && !(r.name || "").toLowerCase().includes(name.toLowerCase())) return false;
    if (phone) {
      const normInput = normPhone(phone);
      const normStored = normPhone(r.phone);
      if (normInput && !normStored.includes(normInput)) return false;
    }
    if (platform && platform !== "전체" && r.platform !== platform) return false;
    if (status === "active" && r.status === "cancelled") return false;
    if (status === "cancelled" && r.status !== "cancelled") return false;
    if (checkinDate && r.checkin !== checkinDate) return false;
    if (rangeStart && (r.checkin || "") < rangeStart) return false;
    if (rangeEnd && (r.checkin || "") > rangeEnd) return false;
    return true;
  });
}

// 사이트 정렬 순위 (A1=0 ~ C7=14, 미등록 사이트는 맨 뒤)
function siteRank(site) {
  const idx = ALL_SITES.indexOf(site || "");
  return idx === -1 ? 999 : idx;
}

// 정렬 적용
export function applySort(list, sortKey) {
  const sorted = [...list];
  switch (sortKey) {
    // 입실일 빠른순 → 같은 날은 사이트순(A1~C7) → 이름순
    case "checkin_asc":
      return sorted.sort((a, b) => {
        const dateCmp = (a.checkin || "").localeCompare(b.checkin || "");
        if (dateCmp !== 0) return dateCmp;
        const siteCmp = siteRank(a.site) - siteRank(b.site);
        if (siteCmp !== 0) return siteCmp;
        return (a.name || "").localeCompare(b.name || "", "ko");
      });
    case "checkin_desc":
      return sorted.sort((a, b) => (b.checkin || "").localeCompare(a.checkin || ""));
    case "name_asc":
      return sorted.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ko"));
    case "platform_asc":
      return sorted.sort((a, b) => (a.platform || "").localeCompare(b.platform || "", "ko"));
    case "site_asc":
      return sorted.sort((a, b) => siteRank(a.site) - siteRank(b.site));
    default:
      return sorted;
  }
}
