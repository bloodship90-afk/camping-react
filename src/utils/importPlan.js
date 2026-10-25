import {
  fields,
  fingerprint,
  identityMatches,
  validateReservation,
} from "./reservationModel.js";
import { findCancelKeys } from "./reservationUtils.js";
export function classifyImport(raw, candidate) {
  const errors = [
    ...(!candidate.reservationId ? ["예약번호를 입력하세요."] : []),
    ...validateReservation(candidate),
  ];
  const matches = identityMatches(raw, candidate);
  if (matches.length > 1)
    return {
      type: "blocked",
      reason: "같은 번호의 예약이 여러 건입니다. 목록에서 확인하세요.",
      errors,
    };
  if (matches.length === 1) {
    const [key, old] = matches[0];
    if (old.status === "cancelled")
      return {
        type: "blocked",
        reason: "취소 이력이 있습니다. 예약 목록에서 명시적으로 복구하세요.",
        errors,
      };
    if (!old.platform)
      return {
        type: "blocked",
        reason: "기존 예약의 플랫폼이 없습니다. 목록에서 먼저 확인하세요.",
        errors,
      };
    const same =
      JSON.stringify(fields(old)) === JSON.stringify(fields(candidate));
    return {
      type: same ? "duplicate" : "update",
      key,
      expected: fingerprint(old),
      old: fields(old),
      errors,
      reason: same ? "이미 등록됨" : "변경 후보 · 기존 값과 비교 후 선택",
    };
  }
  return { type: "add", errors, reason: errors.length ? "수정 필요" : "신규" };
}
export function buildImportOperations(
  raw,
  rows,
  cancels,
  allowOverlap = false,
) {
  const operations = [],
    keys = new Set();
  for (const c of cancels.filter((c) => c.selected)) {
    const current = findCancelKeys(raw, c.item);
    if (!c.key || !current.keys.includes(c.key))
      throw new Error("취소 대상을 다시 선택하세요.");
    if (keys.has(c.key)) continue;
    keys.add(c.key);
    operations.push({
      type: "cancel",
      key: c.key,
      expected: fingerprint(raw[c.key]),
    });
  }
  for (const row of rows.filter((r) => r.selected)) {
    const classification = classifyImport(raw, row.item);
    if (classification.errors.length)
      throw new Error(classification.errors.join(" "));
    if (!["add", "update"].includes(classification.type))
      throw new Error(classification.reason);
    operations.push({
      type: classification.type,
      key: classification.key,
      expected: classification.expected,
      data: fields(row.item),
      allowOverlap,
    });
  }
  return operations;
}
