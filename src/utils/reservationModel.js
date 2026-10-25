import { ALL_SITES } from "../constants/sites.js";
import { PLATFORMS } from "../constants/platforms.js";
import { dateStr, toDate } from "./dateUtils.js";

export const text = (value) =>
  typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
export const normPhone = (value) => text(value).replace(/\D/g, "");
export function fmtPhone(value) {
  const p = normPhone(value);
  if (p.length === 11) return `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}`;
  if (p.length === 10) return `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`;
  return p;
}
export function fields(raw = {}) {
  return {
    reservationId: text(raw?.reservationId),
    name: text(raw?.name),
    site: text(raw?.site).toUpperCase(),
    checkin: text(raw?.checkin),
    nights: Number(raw?.nights) || 0,
    phone: fmtPhone(raw?.phone),
    platform: text(raw?.platform),
    status: raw?.status === "cancelled" ? "cancelled" : "active",
  };
}
export function validateReservation(raw) {
  const r = fields(raw),
    errors = [];
  if (!r.name) errors.push("예약자 이름을 입력하세요.");
  if (!ALL_SITES.includes(r.site)) errors.push("등록된 사이트를 선택하세요.");
  if (!dateStr(toDate(r.checkin))) errors.push("유효한 입실일을 입력하세요.");
  if (!Number.isInteger(r.nights) || r.nights < 1 || r.nights > 365)
    errors.push("박수는 1~365 사이의 정수여야 합니다.");
  if (!PLATFORMS.includes(r.platform)) errors.push("예약 플랫폼을 선택하세요.");
  if (
    r.phone &&
    (r.phone.replace(/\D/g, "").length < 8 ||
      r.phone.replace(/\D/g, "").length > 15)
  )
    errors.push("전화번호를 확인하세요.");
  if (raw?.status && !["active", "cancelled"].includes(raw.status))
    errors.push("예약 상태를 확인하세요.");
  return errors;
}
export function inspectReservations(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      {
        ...fields(value),
        cancelledAt: value?.cancelledAt || null,
        updatedAt: value?.updatedAt || null,
        _issues: validateReservation(value),
      },
    ]),
  );
}
export function fingerprint(raw) {
  // Object key order is irrelevant, but unknown legacy fields also participate.
  const stable = (value) =>
    value && typeof value === "object"
      ? Array.isArray(value)
        ? value.map(stable)
        : Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((k) => [k, stable(value[k])]),
          )
      : value;
  return JSON.stringify(stable(raw ?? null));
}
export function identityMatches(reservations, candidate, excludeKey) {
  if (!text(candidate.reservationId)) return [];
  return Object.entries(reservations || {}).filter(
    ([key, r]) =>
      key !== excludeKey &&
      text(r?.reservationId) === text(candidate.reservationId) &&
      (!text(r?.platform) || text(r.platform) === text(candidate.platform)),
  );
}
