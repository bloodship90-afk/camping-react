import { addDays, dateStr, toDate } from "./dateUtils.js";
import { fields, fmtPhone, validateReservation } from "./reservationModel.js";
import {
  field,
  LABELS,
  dateValues,
  siteValue,
  nightsValue,
  splitNotifications,
  notificationHeading,
  reservationNumberCount,
} from "./reservationMessageFields.js";
export { fmtPhone };
export function detectPlatform(text = "") {
  const thanku = /땡큐\s*캠핑/i.test(text);
  const camfit = /캠\s*핏|camfit/i.test(text);
  if (thanku && camfit) return "혼합";
  if (thanku) return "땡큐캠핑";
  if (
    camfit ||
    /신규\s*예약이\s*성사|예약\s*(취소|변경)\s*알림/.test(text) ||
    (field(text, "고객정보") && field(text, "캠핑존"))
  )
    return "캠핏";
  return null;
}
export function parseReservationMessages(
  input,
  { includePast = false, today = dateStr(new Date()) } = {},
) {
  const text = String(input || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ");
  const blocks = splitNotifications(text);
  const diagnostics = [],
    newMap = new Map(),
    cancelMap = new Map(),
    conflictKeys = new Set(),
    warnings = [];
  const cutoff = dateStr(addDays(today, -30));
  for (let i = 0; i < blocks.length; i++) {
    const raw = blocks[i],
      heading = notificationHeading(raw);
    const detected = detectPlatform(raw);
    const platform = detected === "혼합" ? "" : detected || "";
    const state = field(raw, LABELS.status).replace(/\s/g, "");
    const cancel =
      /예약\s*(?:이|이\s*)?취소|취소.{0,5}예약/.test(heading) ||
      /^취소(?:됨|완료)?$/.test(state);
    const customerLine = field(raw, LABELS.customer);
    const customer = customerLine.match(/^(.*?)\s*\/\s*([+\d][\d()\s-]*)$/);
    const dateLine = field(raw, LABELS.checkin);
    const siteLine = field(raw, LABELS.site);
    const r = fields({
      reservationId: field(raw, LABELS.id).split(/\s/)[0],
      name:
        field(raw, LABELS.name) ||
        customer?.[1] ||
        (!customerLine.includes("/") ? customerLine : ""),
      phone: field(raw, LABELS.phone) || customer?.[2],
      site: siteValue(siteLine),
      checkin: dateValues(dateLine)[0] || "",
      nights: nightsValue(
        dateLine,
        siteLine,
        field(raw, LABELS.nights),
        field(raw, LABELS.checkout),
      ),
      platform,
      status: "active",
    });
    const multipleReservations = reservationNumberCount(raw) > 1;
    const action = heading + "\n" + state;
    const uncertainCancellation =
      /취소.{0,8}(?:요청|신청|예정|대기|불가|실패|규정|정책|수수료|방법)|취소되지/.test(
        action,
      );
    const errors = cancel
      ? !r.reservationId && !(r.name && r.phone && dateStr(toDate(r.checkin)))
        ? ["예약번호 또는 이름·전화번호·입실일이 필요합니다."]
        : []
      : [
          ...(!r.reservationId ? ["예약번호를 확인하세요."] : []),
          ...validateReservation(r),
        ];
    if (!platform) errors.push("예약 플랫폼을 확인하세요.");
    if (multipleReservations)
      errors.push(
        "한 알림에 예약번호가 여러 개입니다. 메시지를 나눠서 확인하세요.",
      );
    if (uncertainCancellation)
      errors.push(
        "취소 요청·실패·대기 알림은 자동 취소하지 않습니다. 원문을 확인하세요.",
      );
    const diagnostic = {
      id: i,
      raw,
      platform,
      type: cancel ? "cancel" : "reservation",
      status: errors.length ? "invalid" : "ready",
      errors,
    };
    diagnostics.push(diagnostic);
    if (multipleReservations || uncertainCancellation) continue;
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
    if (/예약\s*신청/.test(heading))
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
  if (text.trim() && !blocks.length)
    warnings.push(
      "예약 알림을 찾지 못했습니다. 인식하지 못한 원문을 확인하세요.",
    );
  if (diagnostics.some((d) => d.status === "invalid"))
    warnings.push(
      "인식하지 못한 항목이 있습니다. 내용을 수정한 뒤 저장하세요.",
    );
  const stats = {
    found: blocks.length,
    ready: diagnostics.filter((d) => d.status === "ready").length,
    invalid: diagnostics.filter((d) => d.status === "invalid").length,
    excluded: diagnostics.filter((d) => d.status === "excluded").length,
    conflicts: diagnostics.filter((d) => d.status === "conflict").length,
    repeated: diagnostics.filter((d) => d.status === "repeated").length,
  };
  return {
    platform: (() => {
      const platforms = [
        ...new Set(diagnostics.map((d) => d.platform).filter(Boolean)),
      ];
      return platforms.length > 1
        ? "혼합"
        : platforms[0] || detectPlatform(text);
    })(),
    newItems: [...newMap.values()],
    cancelList: [...cancelMap.values()],
    warnings: [...new Set(warnings)],
    diagnostics,
    stats,
  };
}
