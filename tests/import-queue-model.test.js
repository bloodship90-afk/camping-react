import { describe, it, expect } from "vitest";
import { intakeMessages, reviewQueue } from "../src/utils/importQueue.js";
import { buildImportOperations } from "../src/utils/importPlan.js";
import { applyOperations } from "../src/utils/reservationMutations.js";
import { reservation as r, camfit, cancellation } from "./fixtures.js";
const card = (item, kind = "reservation") => ({ kind, item, confirmed: true });
it("deduplicates semantically identical cards despite different source formatting", () => {
  const review = reviewQueue([card(r()), card(r())], {});
  expect(review.map((c) => c.type)).toEqual(["add", "duplicate"]);
});
it("blocks two different updates to the same reservation", () => {
  const review = reviewQueue(
    [card(r({ site: "B1" })), card(r({ site: "C1" }))],
    { a: r() },
  );
  expect(review.every((c) => c.errors.length > 0)).toBe(true);
});
it("checks overlaps against final state after cancelling and replacing a booking", () => {
  const raw = { old: r() };
  const review = reviewQueue(
    [card(r(), "cancel"), card(r({ reservationId: "NEW" }))],
    raw,
  );
  expect(review.some((c) => c.errors.length || c.overlap)).toBe(false);
  const ops = buildImportOperations(
    raw,
    [{ selected: true, item: review[1].card.item }],
    [{ selected: true, key: review[0].key, item: review[0].card.item }],
  );
  const result = applyOperations(
    raw,
    ops.map((op, i) => ({ ...op, key: op.key || `new-${i}` })),
    { operationId: "test", at: 123 },
  );
  expect(result.old.status).toBe("cancelled");
  expect(result["new-1"].status).toBe("active");
});
it("preserves excluded and malformed cancellation sources instead of silently dropping them", () => {
  const source = camfit().replace("2026/11/10", "2020/01/01");
  const [excluded] = intakeMessages(source);
  expect(excluded).toMatchObject({
    kind: "issue",
    excluded: true,
    raw: source,
  });
  expect(intakeMessages(source, true)[0].kind).toBe("reservation");
  expect(intakeMessages(cancellation(""))[0].kind).toBe("issue");
});
it("does not automatically cancel already cancelled records or ambiguous matches", () => {
  expect(
    reviewQueue([card(r(), "cancel")], { a: r({ status: "cancelled" }) })[0]
      .errors.length,
  ).toBeGreaterThan(0);
  expect(reviewQueue([card(r(), "cancel")], { a: r(), b: r() })[0].key).toBe(
    "",
  );
});
