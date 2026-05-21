export function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function getWeekDates(offset = 0) {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export const DAY_KO = ["월", "화", "수", "목", "금", "토", "일"];
