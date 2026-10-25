import {
  fields,
  fingerprint,
  identityMatches,
  validateReservation,
} from "./reservationModel.js";
import { conflictsFor } from "./reservationUtils.js";

const fail = (message) => {
  throw new Error(message);
};
const snapshot = (raw) =>
  Object.fromEntries(
    [
      "reservationId",
      "name",
      "site",
      "checkin",
      "nights",
      "phone",
      "platform",
      "status",
      "cancelledAt",
    ].map((k) => [k, raw?.[k] ?? null]),
  );
// Pure transaction reducer. Keeps every unrelated key and legacy field intact.
export function applyOperations(current, operations, { operationId, at }) {
  if (
    current !== null &&
    current !== undefined &&
    (typeof current !== "object" || Array.isArray(current))
  )
    fail("예약 데이터 형식을 확인하세요.");
  const next = { ...(current || {}) };
  const touched = new Set();
  const activeChanges = [];
  for (const [index, op] of operations.entries()) {
    if (!op.key || /[.#$\[\]/]/.test(op.key))
      fail("예약 키가 올바르지 않습니다.");
    if (touched.has(op.key))
      fail("한 작업에서 같은 예약을 두 번 변경할 수 없습니다.");
    touched.add(op.key);
    const old = next[op.key];
    const eventKey = `${operationId}-${index}`;
    if (old?._history?.[eventKey]) continue; // Same acknowledged request may be retried safely.
    if (op.type === "add") {
      if (old !== undefined && old !== null)
        fail("이미 저장된 예약입니다. 새로고침 후 확인하세요.");
    } else {
      if (old === undefined || old === null)
        fail("예약이 없어졌습니다. 다시 확인하세요.");
      if (op.expected !== fingerprint(old))
        fail("확인 후 예약 내용이 변경되었습니다. 다시 열어 확인하세요.");
    }
    if (!["add", "update", "cancel", "restore"].includes(op.type))
      fail("지원하지 않는 작업입니다.");
    let data =
      old && (typeof old !== "object" || Array.isArray(old))
        ? { _legacyValue: old }
        : { ...old };
    if (op.type === "add" || op.type === "update") {
      const clean = fields(op.data);
      clean.status =
        op.type === "add"
          ? "active"
          : old?.status === "cancelled"
            ? "cancelled"
            : "active";
      const errors = validateReservation(clean);
      if (errors.length) fail(errors.join(" "));
      // A cancelled identity is deliberately included: only explicit restore can revive it.
      if (identityMatches(next, clean, op.key).length)
        fail("같은 플랫폼과 예약번호가 이미 있습니다. 기존 예약을 확인하세요.");
      data = { ...data, ...clean };
    }
    if (op.type === "cancel") {
      if (old.status === "cancelled") fail("이미 취소된 예약입니다.");
      data.status = "cancelled";
      data.cancelledAt = at;
    }
    if (op.type === "restore") {
      if (old.status !== "cancelled") fail("취소된 예약만 복구할 수 있습니다.");
      data = { ...data, ...fields(old), status: "active" };
      const errors = validateReservation(data);
      if (errors.length)
        fail("예약 정보를 먼저 수정하세요. " + errors.join(" "));
      if (
        identityMatches(next, data, op.key).some(
          ([, r]) => r.status !== "cancelled",
        )
      )
        fail("같은 번호의 활성 예약이 이미 있습니다.");
      delete data.cancelledAt;
    }
    if (data.status !== "cancelled" && !op.allowOverlap)
      activeChanges.push(op.key);
    if (op.type === "add") data.createdAt = at;
    data.updatedAt = at;
    data._history = {
      ...(old?._history || {}),
      [eventKey]: {
        action: op.type,
        at,
        before: old ? snapshot(old) : null,
        after: snapshot(data),
      },
    };
    next[op.key] = data;
  }
  for (const key of activeChanges)
    if (conflictsFor(next, next[key], key).length) {
      fail(
        `${next[key].site} ${next[key].checkin}: 같은 사이트의 예약 기간이 겹칩니다. 중복 내용을 확인하세요.`,
      );
    }
  return next;
}
