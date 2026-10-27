import { dateStr, toDate } from "./dateUtils.js";

// Read labelled information rather than depending on one notification sentence.
const key = (value) => value.replace(/[^가-힣a-z]/gi, "").toLowerCase();
export function field(block, labels) {
  const wanted = new Set(labels.split("|").map(key));
  const lines = block.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^([^:：=]+)[:：=](.*)$/);
    if (match && wanted.has(key(match[1]))) {
      if (match[2].trim()) return match[2].trim();
      const next = lines.slice(i + 1).find((line) => line.trim()) || "";
      return isMetadata(next) ? "" : next.trim();
    }
    if (!match && wanted.has(key(lines[i]))) {
      const next = lines.slice(i + 1).find((line) => line.trim()) || "";
      return isMetadata(next) ? "" : next.trim();
    }
  }
  return "";
}
export const LABELS = {
  id: "예약번호|예약코드|예약ID",
  customer: "고객정보|예약자정보|예약자|고객",
  name: "예약자명|예약자이름|예약자성함|고객명|성함|이름",
  phone: "전화번호|연락처|예약자연락처|휴대폰번호|휴대전화|휴대폰",
  site: "캠핑존|사이트명|예약사이트|사이트|구역|객실명",
  checkin: "입실일자|입실일|예약일자|예약기간|이용기간|체크인|이용시작일",
  checkout: "퇴실일자|퇴실일|체크아웃|이용종료일",
  nights: "박수|숙박기간",
  status: "예약상태|처리상태|상태",
};
const metadataKeys = new Set(
  Object.values(LABELS).flatMap((labels) => labels.split("|").map(key)),
);
const isMetadata = (line) => {
  const label = line.split(/[:：=]/)[0];
  return metadataKeys.has(key(label));
};
const oldHeader =
  /(?:\[\s*땡큐캠핑\s*\]\s*예약\s*(?:확정|신청|취소|변경)\s*안내|신규\s*예약이\s*성사되었습니다[.。]?|예약\s*(?:취소|변경)\s*알림)/;
const brand = /캠\s*핏|camfit|땡큐\s*캠핑/i;
const bookingTitle =
  /예약.{0,15}(?:접수|확정|성사|취소|변경|신청)|(?:신규|취소|변경).{0,5}예약/;
export function notificationHeading(raw) {
  const lines = raw.split("\n"),
    firstField = lines.findIndex(isMetadata);
  return lines.slice(0, firstField < 0 ? lines.length : firstField).join("\n");
}
export function splitNotifications(text) {
  const starts = [];
  let offset = 0;
  for (const line of text.split("\n")) {
    const header =
      !isMetadata(line) &&
      (oldHeader.test(line) ||
        (brand.test(line) &&
          (bookingTitle.test(line) || /^\s*\[.*\]\s*$/.test(line))) ||
        /^\s*(?:[\[【].*?[\]】]\s*)?예약\s*(?:접수|확정|취소|변경|신청)\s*(?:안내|알림|완료|되었습니다|됐)/.test(
          line,
        ));
    if (header) {
      const previous = starts.at(-1);
      if (
        previous === undefined ||
        text.slice(previous, offset).split("\n").some(isMetadata)
      )
        starts.push(offset);
    }
    offset += line.length + 1;
  }
  if (
    !starts.length &&
    (field(text, LABELS.id) ||
      [LABELS.customer, LABELS.checkin, LABELS.site].filter((labels) =>
        field(text, labels),
      ).length >= 2)
  )
    starts.push(0);
  return starts.map((start, index) =>
    text.slice(start, starts[index + 1] ?? text.length).trim(),
  );
}
export function dateValues(value) {
  return [
    ...value.matchAll(
      /(\d{4})\s*(?:[\/.-]|년)\s*(\d{1,2})\s*(?:[\/.-]|월)\s*(\d{1,2})(?:\s*일)?/g,
    ),
  ].map((m) => `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`);
}
export function siteValue(value) {
  const sites = [
    ...value
      .toUpperCase()
      .matchAll(
        /(?:^|[^A-Z])([A-C])\s*(?:존|구역|사이트)?\s*(?:[-\/]\s*)*0*(\d+)(?!\d)/g,
      ),
  ].map((m) => m[1] + Number(m[2]));
  const unique = [...new Set(sites)];
  return unique.length === 1 ? unique[0] : "";
}
export function nightsValue(dateLine, siteLine, explicit, checkoutLine) {
  const match = (dateLine + " " + siteLine + " " + explicit).match(
    /(\d+)\s*박/,
  );
  if (match) return Number(match[1]);
  if (/^\d+$/.test(explicit)) return Number(explicit);
  const dates = dateValues(dateLine),
    checkout = dateValues(checkoutLine)[0] || dates[1];
  const checkin = dates[0];
  if (!dateStr(toDate(checkin)) || !dateStr(toDate(checkout))) return 0;
  return (
    (Date.parse(checkout + "T00:00:00Z") - Date.parse(checkin + "T00:00:00Z")) /
    86400000
  );
}
export function reservationNumberCount(raw) {
  return raw.split("\n").filter((line) =>
    LABELS.id
      .split("|")
      .map(key)
      .includes(key(line.split(/[:：=]/)[0])),
  ).length;
}
