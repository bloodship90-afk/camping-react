import { addDays, dateStr, toDate } from "./dateUtils.js";
import { fields, fmtPhone, validateReservation } from "./reservationModel.js";
export { fmtPhone };
const marker =
  /(?:\[\s*땡큐캠핑\s*\]\s*예약\s*(?:확정|신청|취소|변경)\s*안내|신규\s*예약이\s*성사되었습니다[.。]?|예약\s*(?:취소|변경)\s*알림)/g;
const field = (block, label) =>
  block
    .match(
      new RegExp(
        "(?:^|\\n)\\s*[-•]?\\s*(?:" + label + ")\\s*[:：]\\s*([^\\n]+)",
      ),
    )?.[1]
    ?.trim() || "";
const dateValue = (value) => {
  const m = value.match(/(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : "";
};
const siteValue = (value) => {
  const m = value
    .toUpperCase()
    .match(/(?:^|[^A-Z])([A-C])\s*[-\/]?\s*0?(\d+)(?!\d)/);
  return m ? m[1] + Number(m[2]) : "";
};
export function detectPlatform(text = "") {
  const thanku = /\[\s*땡큐캠핑\s*\]/.test(text),
    camfit = /신규\s*예약이\s*성사|예약\s*(취소|변경)\s*알림/.test(text);
  return thanku && camfit
    ? "혼합"
    : thanku
      ? "땡큐캠핑"
      : camfit
        ? "캠핏"
        : null;
}
export function parseReservationMessages(
  input,
  { includePast = false, today = dateStr(new Date()) } = {},
) {
  const text = String(input || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ");
  const starts = [...text.matchAll(marker)];
  const diagnostics = [],
    newMap = new Map(),
    cancelMap = new Map(),
    conflictKeys = new Set(),
    warnings = [];
  const cutoff = dateStr(addDays(today, -30));
  for (let i = 0; i < starts.length; i++) {
    const raw = text
      .slice(starts[i].index, starts[i + 1]?.index ?? text.length)
      .trim();
    const platform = raw.startsWith("[") ? "땡큐캠핑" : "캠핏";
    const cancel = /예약\s*취소/.test(starts[i][0]);
    const customer = field(raw, "고객정보").match(
      /^(.*?)\s*\/\s*([+\d][\d()\s-]*)$/,
    );
    const dateLine = field(raw, "입실일자|예약일자");
    const siteLine = field(raw, "캠핑존|사이트명");
    const r = fields({
      reservationId: field(raw, "예약번호").split(/\s/)[0],
      name: platform === "캠핏" ? customer?.[1] : field(raw, "예약자명"),
      phone: platform === "캠핏" ? customer?.[2] : field(raw, "전화번호"),
      site: siteValue(siteLine),
      checkin: dateValue(dateLine),
      nights: Number((dateLine + " " + siteLine).match(/(\d+)\s*박/)?.[1] || 0),
      platform,
      status: "active",
    });
    const errors = cancel
      ? !r.reservationId && !(r.name && r.phone && dateStr(toDate(r.checkin)))
        ? ["예약번호 또는 이름·전화번호·입실일이 필요합니다."]
        : []
      : [
          ...(!r.reservationId ? ["예약번호를 확인하세요."] : []),
          ...validateReservation(r),
        ];
    const diagnostic = {
      id: i,
      raw,
      platform,
      type: cancel ? "cancel" : "reservation",
      status: errors.length ? "invalid" : "ready",
      errors,
    };
    diagnostics.push(diagnostic);
    if (
      !cancel &&
      !includePast &&
      r.checkin &&
      dateStr(toDate(r.checkin)) &&
      r.checkin < cutoff
    ) {
      diagnostic.status = "excluded";
      diagnostic.errors = [
        "30일 이전 입실: 과거 알림 포함을 켜면 확인할 수 있습니다.",
      ];
      continue;
    }
    const key = platform + "|" + (r.reservationId || "missing-" + i);
    r._source = i;
    if (cancel) {
      if (errors.length) continue;
      if (cancelMap.has(key)) diagnostic.status = "repeated";
      else cancelMap.set(key, r);
    } else if (newMap.has(key)) {
      const previous = newMap.get(key);
      const same =
        JSON.stringify(fields(previous)) === JSON.stringify(fields(r));
      diagnostic.status = same ? "repeated" : "conflict";
      if (!same) {
        conflictKeys.add(key);
        diagnostic.errors = [
          "같은 번호에 서로 다른 신규·변경 내용이 있습니다.",
        ];
      }
    } else newMap.set(key, r);
    if (/예약\s*신청/.test(starts[i][0]))
      warnings.push(
        "예약 신청 알림이 있습니다. 확정 여부를 확인한 뒤 선택해 주세요.",
      );
  }
  for (const key of newMap.keys())
    if (cancelMap.has(key)) {
      conflictKeys.add(key);
      warnings.push(
        `#${newMap.get(key).reservationId}: 신규·취소가 함께 있어 신규 저장을 제외했습니다. 취소 대상을 확인하세요.`,
      );
    }
  for (const key of conflictKeys) {
    const r = newMap.get(key);
    if (r) {
      diagnostics[r._source].status = "conflict";
      diagnostics[r._source].errors.push(
        "동일 번호의 알림이 충돌합니다. 원문을 확인해 별도로 처리하세요.",
      );
    }
    newMap.delete(key);
  }
  if (text.trim() && !starts.length)
    warnings.push(
      "예약 알림을 찾지 못했습니다. 인식하지 못한 원문을 확인하세요.",
    );
  if (diagnostics.some((d) => d.status === "invalid"))
    warnings.push(
      "인식하지 못한 항목이 있습니다. 내용을 수정한 뒤 저장하세요.",
    );
  const stats = {
    found: starts.length,
    ready: diagnostics.filter((d) => d.status === "ready").length,
    invalid: diagnostics.filter((d) => d.status === "invalid").length,
    excluded: diagnostics.filter((d) => d.status === "excluded").length,
    conflicts: diagnostics.filter((d) => d.status === "conflict").length,
    repeated: diagnostics.filter((d) => d.status === "repeated").length,
  };
  return {
    platform: detectPlatform(text),
    newItems: [...newMap.values()],
    cancelList: [...cancelMap.values()],
    warnings: [...new Set(warnings)],
    diagnostics,
    stats,
  };
}
