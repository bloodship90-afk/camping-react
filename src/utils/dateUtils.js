export function dateStr(d) {
  if (!(d instanceof Date) || !Number.isFinite(d.getTime())) return "";
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
export function toDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return new Date(NaN);
  const [y, m, d] = value.split("-").map(Number);
  const result = new Date(0);
  result.setFullYear(y, m - 1, d);
  result.setHours(0, 0, 0, 0);
  return y >= 1900 && y <= 9999 && dateStr(result) === value
    ? result
    : new Date(NaN);
}
export function addDays(value, days) {
  const d = typeof value === "string" ? toDate(value) : toDate(dateStr(value));
  d.setDate(d.getDate() + Number(days));
  return d;
}
export function getCheckoutDate(r) {
  const n = Number(r?.nights);
  return Number.isInteger(n) && n > 0 && n <= 365
    ? addDays(r?.checkin, n)
    : new Date(NaN);
}
export function getWeekDates(offset = 0, base = new Date()) {
  const day = typeof base === "string" ? toDate(base) : toDate(dateStr(base));
  const monday = addDays(
    day,
    -(day.getDay() === 0 ? 6 : day.getDay() - 1) + offset * 7,
  );
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
export const DAY_KO = ["월", "화", "수", "목", "금", "토", "일"];
