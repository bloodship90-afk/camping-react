import { describe, it, expect } from "vitest";
import { reservation as r } from "./fixtures.js";
import {
  dateStr,
  toDate,
  getWeekDates,
  getCheckoutDate,
  addDays,
} from "../src/utils/dateUtils.js";
import {
  fields,
  inspectReservations,
  fingerprint,
  validateReservation,
} from "../src/utils/reservationModel.js";
import {
  buildBarList,
  calcWeekStats,
  findCancelKeys,
  overlaps,
} from "../src/utils/reservationUtils.js";
import { applyOperations } from "../src/utils/reservationMutations.js";
import {
  applyFilters,
  buildVisitCountMap,
  getVisitCount,
} from "../src/utils/reservationListUtils.js";
import { backupJSON, reservationsCSV } from "../src/utils/exportUtils.js";
const apply = (raw, ops, id = "test") =>
  applyOperations(raw, ops, { operationId: id, at: 123456 });
const update = (raw, patch = {}) => ({
  type: "update",
  key: "a",
  expected: fingerprint(raw.a),
  data: r(patch),
});
describe("dates and occupancy", () => {
  it("rejects impossible dates and accepts leap days", () => {
    expect(dateStr(toDate("2026-11-31"))).toBe("");
    expect(dateStr(toDate("2024-02-29"))).toBe("2024-02-29");
    expect(dateStr(toDate("2026-02-29"))).toBe("");
  });
  it("normalizes string nights and agrees with chart checkout", () => {
    const week = getWeekDates(0, "2026-11-10");
    expect(dateStr(getCheckoutDate(r({ nights: "2" })))).toBe("2026-11-12");
    expect(
      buildBarList([["a", r({ nights: "2" })]], week).barList[0].span,
    ).toBe(2);
  });
  it("normalizes midnight and excludes next Monday", () => {
    const week = getWeekDates(0, new Date(2026, 10, 10, 12, 30));
    expect(week[0].getHours()).toBe(0);
    expect(
      calcWeekStats({ a: r({ checkin: dateStr(addDays(week[6], 1)) }) }, week)
        .weekRes,
    ).toBe(0);
  });
  it("counts unique occupied sites and only this week's duplicates", () => {
    const data = Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [
        i,
        r({ checkin: "2026-11-09", nights: 7 }),
      ]),
    );
    const stats = calcWeekStats(data, getWeekDates(0, "2026-11-10"));
    expect(stats.occupancy).toBe(7);
    expect(stats.dailyCounts).toEqual(Array(7).fill(1));
    expect(stats.duplicateCount).toBe(16);
    expect(
      calcWeekStats(data, getWeekDates(2, "2026-11-10")).duplicateCount,
    ).toBe(0);
  });
  it("uses half-open stays; checkout and checkin can share a day", () => {
    expect(overlaps(r(), r({ checkin: "2026-11-12" }))).toBe(false);
    expect(overlaps(r(), r({ checkin: "2026-11-11" }))).toBe(true);
  });
  it("keeps malformed legacy items visible for repair without chart errors", () => {
    const normalized = inspectReservations({
      bad: "oops",
      partial: { nights: "2" },
      unknown: r({ platform: "", site: "A99" }),
    });
    expect(Object.values(normalized).every((x) => x._issues.length)).toBe(true);
    expect(() => calcWeekStats(normalized, getWeekDates())).not.toThrow();
    expect(calcWeekStats(normalized, getWeekDates()).weekRes).toBe(0);
  });
  it.each([0, -1, 1.5, 366, Infinity])(
    "rejects invalid nights %s",
    (nights) => {
      expect(validateReservation(r({ nights })).length).toBeGreaterThan(0);
    },
  );
});
describe("atomic writes, cancellations and recovery", () => {
  it("does not revive a cancelled reservation when replaying a new notice", () => {
    expect(() =>
      apply({ a: r({ status: "cancelled" }) }, [
        { type: "add", key: "b", data: r() },
      ]),
    ).toThrow(/예약번호/);
  });
  it("namespaces IDs by platform and protects unknown legacy platforms", () => {
    expect(() =>
      apply({ a: r() }, [
        {
          type: "add",
          key: "b",
          data: r({ platform: "땡큐캠핑", site: "B1" }),
        },
      ]),
    ).not.toThrow();
    expect(() =>
      apply({ a: r({ platform: "" }) }, [
        { type: "add", key: "b", data: r({ site: "B1" }) },
      ]),
    ).toThrow();
  });
  it("rejects stale edits and changes none of the input", () => {
    const raw = { a: r(), other: r({ reservationId: "other", site: "B1" }) };
    const before = fingerprint(raw);
    expect(() =>
      apply(raw, [
        { ...update(raw), expected: fingerprint(r({ name: "old" })) },
      ]),
    ).toThrow(/변경/);
    expect(fingerprint(raw)).toBe(before);
  });
  it("keeps unknown fields and unrelated records on edit", () => {
    const raw = {
      a: { ...r(), legacyNote: "보존", unknown: { a: 1 } },
      other: { old: true },
    };
    const next = apply(raw, [update(raw, { name: "수정" })]);
    expect(next.a.legacyNote).toBe("보존");
    expect(next.a.unknown).toEqual({ a: 1 });
    expect(next.other).toEqual(raw.other);
    expect(next.a._history["test-0"].before.name).toBe("홍길동");
  });
  it("is idempotent when an acknowledged request repeats", () => {
    const ops = [{ type: "add", key: "a", data: r() }];
    const first = apply(null, ops);
    expect(apply(first, ops)).toEqual(first);
  });
  it("rejects an entire batch when any operation is invalid", () => {
    const raw = {};
    expect(() =>
      apply(raw, [
        { type: "add", key: "a", data: r() },
        { type: "add", key: "b", data: r({ site: "A99" }) },
      ]),
    ).toThrow();
    expect(raw).toEqual({});
  });
  it("checks overlap against the final batch including cancellations", () => {
    const raw = { a: r() };
    expect(() =>
      apply(raw, [{ type: "add", key: "b", data: r({ reservationId: "R2" }) }]),
    ).toThrow(/겹칩니다/);
    const ops = [
      { type: "add", key: "b", data: r({ reservationId: "R2" }) },
      { type: "cancel", key: "a", expected: fingerprint(raw.a) },
    ];
    expect(apply(raw, ops).b.status).toBe("active");
  });
  it("requires explicit overlap acknowledgement", () => {
    expect(
      apply({ a: r() }, [
        {
          type: "add",
          key: "b",
          data: r({ reservationId: "R2" }),
          allowOverlap: true,
        },
      ]).b.name,
    ).toBe("홍길동");
  });
  it("soft cancels, restores, and retains complete action history", () => {
    const raw = { a: r() };
    const cancelled = apply(raw, [
      { type: "cancel", key: "a", expected: fingerprint(raw.a) },
    ]);
    expect(cancelled.a.cancelledAt).toBe(123456);
    const restored = apply(
      cancelled,
      [{ type: "restore", key: "a", expected: fingerprint(cancelled.a) }],
      "restore",
    );
    expect(restored.a.status).toBe("active");
    expect(restored.a.cancelledAt).toBeUndefined();
    expect(Object.values(restored.a._history).map((e) => e.action)).toEqual([
      "cancel",
      "restore",
    ]);
  });
  it("does not restore into a conflicting stay without confirmation", () => {
    const raw = {
      a: r({ status: "cancelled" }),
      b: r({ reservationId: "R2" }),
    };
    expect(() =>
      apply(raw, [{ type: "restore", key: "a", expected: fingerprint(raw.a) }]),
    ).toThrow(/겹칩니다/);
  });
  it("repairs malformed legacy data explicitly while retaining its old value", () => {
    const raw = { a: "broken" };
    expect(apply(raw, [update(raw)]).a._legacyValue).toBe("broken");
  });
  it.each(["a.b", "a/b", "a#b", "a[b]"])(
    "rejects invalid Firebase key %s",
    (key) => {
      expect(() => apply({}, [{ type: "add", key, data: r() }])).toThrow(/키/);
    },
  );
  it("reports ambiguous cancellation candidates instead of silently resolving them", () => {
    const raw = { a: r(), b: r({ reservationId: "R2" }) };
    expect(findCancelKeys(raw, r({ reservationId: "not-found" }))).toEqual({
      keys: ["a", "b"],
      isFallback: true,
    });
    expect(
      findCancelKeys(raw, { name: "홍길동", phone: "01012345678" }).keys,
    ).toEqual([]);
    expect(
      findCancelKeys({ a: r(), b: r({ platform: "땡큐캠핑" }) }, r()).keys,
    ).toEqual(["a"]);
  });
});
describe("list filtering and backups", () => {
  it("includes stays that began before the period and separates checkin mode", () => {
    const list = [r({ checkin: "2026-11-08", nights: 3 })];
    const filters = { rangeStart: "2026-11-09", rangeEnd: "2026-11-15" };
    expect(applyFilters(list, filters, true)).toHaveLength(1);
    expect(
      applyFilters(list, { ...filters, rangeMode: "checkin" }, true),
    ).toHaveLength(0);
  });
  it("counts only completed past stays with a usable customer identity", () => {
    const rows = [
      r({ checkin: "2026-10-01" }),
      r(),
      r({ checkin: "2026-10-02", status: "cancelled" }),
      r({ phone: "" }),
    ];
    expect(getVisitCount(buildVisitCountMap(rows, "2026-10-25"), r())).toBe(1);
  });
  it("filters unspecified platforms and retains today's checkouts", () => {
    expect(
      applyFilters([r(), r({ platform: "" })], { platform: "" }, true),
    ).toHaveLength(1);
    expect(
      applyFilters([r({ checkin: "2026-10-23" })], {}, false, "2026-10-25"),
    ).toHaveLength(1);
  });
  it("exports every raw value in JSON and safely escapes CSV formulas and quotes", () => {
    const raw = {
      legacy: "odd",
      a: r({ name: "=SUM(1,2)", phone: "010-1234-5678" }),
    };
    expect(JSON.parse(backupJSON(raw)).reservations).toEqual(raw);
    expect(reservationsCSV(raw)).toContain("'=SUM(1,2)");
    expect(fields(r({ phone: "010-1234-5678" })).phone).toBe("010-1234-5678");
  });
});
