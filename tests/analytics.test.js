import { describe, it, expect } from "vitest";
import { buildAnalytics, seasonOf } from "../src/utils/campingAnalytics.js";
import { reservation as fixture } from "./fixtures.js";
const r = (changes) => fixture({ checkin: "2026-03-01", ...changes });
const options = { today: "2026-11-04", start: "2026-03-01", end: "2026-03-31" };
const stats = (raw, opts = {}) => buildAnalytics(raw, { ...options, ...opts });
describe("read-only camping analytics", () => {
  it("never mutates or drops original records, including unknown legacy fields", () => {
    const raw = {
      a: { ...r(), extra: { history: [1, 2] } },
      missing: r({ phone: "" }),
      malformed: "legacy",
      nil: null,
    };
    const before = JSON.stringify(raw);
    Object.freeze(raw.a.extra.history);
    Object.freeze(raw.a.extra);
    Object.freeze(raw.a);
    Object.freeze(raw);
    const s = stats(raw);
    expect(JSON.stringify(raw)).toBe(before);
    expect(s.included + s.excluded.length).toBe(4);
    expect(s.excluded).toHaveLength(3);
    expect(s.summary.bookings).toBe(1);
  });
  it("uses exact name and normalized phone pairs, never names alone", () => {
    const s = stats({
      a: r(),
      b: r({
        reservationId: "R2",
        checkin: "2026-03-10",
        phone: "01012345678",
      }),
      c: r({ reservationId: "R3", phone: "010-9999-1111" }),
      d: r({ reservationId: "R4", phone: "" }),
    });
    expect(s.campers).toHaveLength(2);
    expect(s.campers.find((c) => c.visits === 2).nights).toBe(4);
    expect(s.excluded).toHaveLength(1);
  });
  it("excludes ambiguous identities, duplicate reservation identities, masked phones and bad fields", () => {
    const s = stats({
      a: r(),
      b: r({ name: "다른 이름", reservationId: "R2" }),
      c: r({ reservationId: "R3", phone: "010-****-2222" }),
      d: r({ reservationId: "R4", phone: "010-2222-3333" }),
      e: r({ reservationId: "R4", phone: "010-2222-3333" }),
      f: r({ phone: "010-8888-3333", site: "D1" }),
    });
    expect(s.included).toBe(0);
    expect(s.excluded).toHaveLength(6);
  });
  it("merges contiguous stays into visits and counts camper nights once", () => {
    const s = stats(
      {
        a: r(),
        b: r({ reservationId: "R2", checkin: "2026-03-03" }),
        c: r({ reservationId: "R3", checkin: "2026-03-02", site: "B1" }),
        d: r({ reservationId: "R4", checkin: "2026-04-01" }),
      },
      { end: "2026-04-30" },
    );
    expect(s.campers[0].visits).toBe(2);
    expect(s.campers[0].nights).toBe(6);
    expect(s.summary.nights).toBe(8);
  });
  it("splits nights at month boundaries and excludes checkout day", () => {
    const s = stats(
      { a: r({ checkin: "2026-03-31", nights: 3 }) },
      { end: "2026-04-30" },
    );
    expect(s.monthly.map((m) => [m.label, m.bookings, m.nights])).toEqual([
      ["2026-03", 1, 1],
      ["2026-04", 0, 2],
    ]);
    expect(s.sites.find((s) => s.label === "A1").occupied).toBe(3);
    expect(s.summary.average).toBe(3);
  });
  it("caps site occupancy at 100 despite overlapping records and excludes cancellations", () => {
    const s = stats(
      {
        a: r(),
        b: r({ reservationId: "R2" }),
        c: r({ reservationId: "R3", status: "cancelled" }),
      },
      { end: "2026-03-02" },
    );
    expect(s.sites[0].occupancy).toBe(100);
    expect(s.summary.nights).toBe(4);
    expect(s.duplicateSlots).toBe(2);
    expect(s.summary.cancelled).toBe(1);
    expect(s.summary.cancelRate).toBe(33.3);
  });
  it("separates completed from future records, including checkout today", () => {
    const raw = {
      a: r({ checkin: "2026-11-02" }),
      b: r({ reservationId: "R2", checkin: "2026-11-04" }),
    };
    expect(
      stats(raw, { start: "2026-11-01", end: "2026-11-30" }).summary.bookings,
    ).toBe(1);
    const all = stats(raw, {
      start: "2026-11-01",
      end: "2026-11-30",
      mode: "all",
    });
    expect(all.summary.bookings).toBe(2);
    expect(all.campers[0].upcoming).toBe(1);
    expect(all.forward30).toBeGreaterThan(0);
  });
  it("classifies seasons across year boundaries and handles ties", () => {
    expect(
      [
        "2026-03-01",
        "2026-06-01",
        "2026-09-01",
        "2026-12-01",
        "2026-01-01",
      ].map(seasonOf),
    ).toEqual(["봄", "여름", "가을", "겨울", "겨울"]);
    const s = stats(
      { a: r(), b: r({ reservationId: "R2", checkin: "2026-09-01" }) },
      { end: "2026-10-31" },
    );
    expect(s.campers[0].preferred).toBe("봄·가을");
    expect(s.repeat).toBe(1);
  });
  it("manual exclusions affect only projection and can be reversed", () => {
    const raw = { a: r() };
    expect(stats(raw, { excludedKeys: ["a"] }).summary.bookings).toBe(0);
    expect(stats(raw).summary.bookings).toBe(1);
    expect(raw.a).toEqual(r());
  });
  it("uses Fri/Sat weekends and correct daily denominators including leap day", () => {
    const s = stats(
      { a: r({ checkin: "2024-02-29", nights: 3 }) },
      { start: "2024-02-29", end: "2024-03-02" },
    );
    expect(s.calendar).toEqual({ total: 3, weekend: 2, weekday: 1 });
    expect(s.sites[0].weekendRate).toBe(100);
    expect(s.sites[0].weekdayRate).toBe(100);
  });
  it("handles empty and fully excluded datasets without NaN or crashes", () => {
    for (const raw of [{}, { a: null, b: r({ phone: "" }) }]) {
      const s = stats(raw);
      expect(s.campers).toEqual([]);
      expect(s.summary.occupancy).toBe(0);
      expect(s.summary.average).toBe(0);
    }
  });
});

it("keeps cancelled-only historical records in the default full range", () => {
  const s = buildAnalytics(
    { cancelled: r({ status: "cancelled" }) },
    { today: "2026-11-04" },
  );
  expect(s.summary.cancelled).toBe(1);
  expect(s.summary.cancelRate).toBe(100);
  expect(s.summary.nights).toBe(0);
});
it("excludes checkout overflow rather than generating invalid calendar ranges", () => {
  const s = stats({ a: r({ checkin: "9999-12-31", nights: 2 }) });
  expect(s.included).toBe(0);
  expect(s.excluded[0].reason).toBe("퇴실일 범위 오류");
});
