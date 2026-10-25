export const reservation = (changes = {}) => ({
  reservationId: "R1",
  name: "홍길동",
  site: "A1",
  checkin: "2026-11-10",
  nights: 2,
  phone: "010-1234-5678",
  platform: "캠핏",
  status: "active",
  ...changes,
});
export const camfit = (id = "R1", changes = {}) => `신규 예약이 성사되었습니다.
예약번호 : ${id}
고객정보 : ${changes.name || "홍길동"} / ${changes.phone || "010-1234-5678"}
입실일자 : ${changes.date || "2026/11/10"} (${changes.nights ?? 2}박)
캠핑존 : ${changes.site || "NO KIDS - A1"}`;
export const thanku = (id = "T1") => `[땡큐캠핑] 예약 확정 안내
예약번호: ${id}
예약자명: 김가족
전화번호: 010-9876-5432
예약일자: 2026.11.12
사이트명: B1 (1박)`;
export const cancellation = (id = "R1") => `예약 취소 알림
예약번호 : ${id}`;
