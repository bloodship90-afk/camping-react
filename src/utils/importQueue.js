import { parseReservationMessages } from "./kakaoParsers.js";
import { splitNotifications } from "./reservationMessageFields.js";
import { classifyImport } from "./importPlan.js";
import { fields, fingerprint, identityMatches } from "./reservationModel.js";
import { findCancelKeys, overlaps } from "./reservationUtils.js";

export function intakeMessages(source, includePast = false) {
  const blocks = splitNotifications(source);
  return (blocks.length ? blocks : [source.trim()])
    .filter(Boolean)
    .map((raw) => {
      const parsed = parseReservationMessages(raw, { includePast });
      const item = parsed.newItems[0] || parsed.cancelList[0];
      const diagnostic = parsed.diagnostics[0];
      return {
        raw,
        signature: raw.replace(/\r\n?/g, "\n").trim(),
        kind: parsed.cancelList.length
          ? "cancel"
          : item
            ? "reservation"
            : "issue",
        item,
        issue:
          diagnostic?.errors.join(" ") ||
          parsed.warnings.join(" ") ||
          "예약 알림을 인식하지 못했습니다. 원문을 확인하거나 삭제하세요.",
        excluded: diagnostic?.status === "excluded",
        warnings: parsed.warnings,
        confirmed: false,
        target: undefined,
      };
    });
}

export function reviewQueue(queue, raw) {
  const reviews = queue.map((card) => {
    if (card.kind === "issue")
      return { card, errors: [card.issue], label: "확인 필요" };
    if (card.kind === "cancel") {
      const match = findCancelKeys(raw, card.item);
      const key =
        card.target === undefined &&
        match.keys.length === 1 &&
        !match.isFallback
          ? match.keys[0]
          : card.target;
      const valid = key && match.keys.includes(key);
      return {
        card,
        match,
        key: valid ? key : "",
        type: "cancel",
        label: valid ? "취소 대상 일치" : "취소 대상 확인 필요",
        errors: valid
          ? []
          : [
              match.keys.length
                ? "취소할 예약을 직접 선택하세요."
                : "활성 예약 중 취소 대상을 찾지 못했습니다. 원문과 취소 목록을 확인하세요.",
            ],
      };
    }
    const c = classifyImport(raw, card.item);
    return {
      card,
      ...c,
      label: c.type === "add" ? "신규 등록 가능" : c.reason,
    };
  });
  for (let i = 0; i < reviews.length; i++) {
    for (let j = i + 1; j < reviews.length; j++) {
      const a = reviews[i],
        b = reviews[j];
      if (!a.card.item || !b.card.item) continue;
      const same =
        identityMatches({ a: a.card.item }, b.card.item).length ||
        (a.key && a.key === b.key);
      if (!same) continue;
      const repeated =
        a.card.kind === b.card.kind &&
        fingerprint(fields(a.card.item)) === fingerprint(fields(b.card.item));
      if (repeated) {
        b.type = "duplicate";
        b.label = "대기 목록에 이미 있음";
        b.errors = [];
      } else {
        for (const r of [a, b]) {
          r.errors = [
            ...r.errors,
            "같은 예약의 서로 다른 알림이 있습니다. 원문을 비교하고 남길 카드만 선택해 나머지는 삭제하세요.",
          ];
        }
      }
    }
  }
  const cancelled = new Set(
    reviews
      .filter((r) => r.type === "cancel" && !r.errors.length)
      .map((r) => r.key),
  );
  const changed = new Set(
    reviews
      .filter((r) => r.type === "update" && !r.errors.length)
      .map((r) => r.key),
  );
  const pending = reviews.filter(
    (r) => ["add", "update"].includes(r.type) && !r.errors.length,
  );
  for (const r of pending) {
    r.overlap =
      Object.entries(raw).some(
        ([key, old]) =>
          key !== r.key &&
          !cancelled.has(key) &&
          !changed.has(key) &&
          old?.status !== "cancelled" &&
          overlaps(old, r.card.item),
      ) ||
      pending.some(
        (other) => other !== r && overlaps(other.card.item, r.card.item),
      );
  }
  return reviews;
}
