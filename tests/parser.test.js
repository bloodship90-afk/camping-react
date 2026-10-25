import { describe, it, expect } from "vitest";
import { camfit, thanku, cancellation, reservation as r } from "./fixtures.js";
import { parseReservationMessages } from "../src/utils/kakaoParsers.js";
import {
  classifyImport,
  buildImportOperations,
} from "../src/utils/importPlan.js";
const parse = (input) =>
  parseReservationMessages(input, { today: "2026-10-25" });
describe("message parsing and import planning", () => {
  it("parses mixed services with complete hyphenated phone numbers", () => {
    const result = parse(camfit() + "\n" + thanku());
    expect(result.newItems).toHaveLength(2);
    expect(result.platform).toBe("혼합");
    expect(result.newItems[0].phone).toBe("010-1234-5678");
    expect(result.newItems[1].site).toBe("B1");
  });
  it("accepts varied colon spacing and general site names", () => {
    expect(parse(camfit().replaceAll(" : ", ":")).newItems).toHaveLength(1);
    expect(
      parse(camfit("R1", { site: "일반 A1 사이트" })).newItems[0].site,
    ).toBe("A1");
  });
  it("keeps invalid items with diagnostics instead of silently dropping them", () => {
    const result = parse(
      camfit("good") +
        "\n" +
        camfit("bad", { site: "A99", date: "2026/11/31", nights: 0 }),
    );
    expect(result.newItems).toHaveLength(2);
    expect(result.stats.invalid).toBe(1);
    expect(result.diagnostics[1].errors.length).toBeGreaterThanOrEqual(3);
  });
  it("includes the 30 day boundary and reports excluded older messages", () => {
    expect(parse(camfit("edge", { date: "2026/09/25" })).newItems).toHaveLength(
      1,
    );
    const input = camfit("old", { date: "2026/09/24" });
    expect(parse(input).stats.excluded).toBe(1);
    expect(
      parseReservationMessages(input, {
        today: "2026-10-25",
        includePast: true,
      }).newItems,
    ).toHaveLength(1);
  });
  it("does not recreate a booking when new and cancel notices appear together", () => {
    const result = parse(camfit() + "\n" + cancellation());
    expect(result.newItems).toHaveLength(0);
    expect(result.cancelList).toHaveLength(1);
    expect(result.stats.conflicts).toBe(1);
  });
  it("distinguishes identical repeats from conflicting changes", () => {
    expect(parse(camfit() + "\n" + camfit()).stats.repeated).toBe(1);
    expect(
      parse(camfit() + "\n" + camfit("R1", { site: "B1" })).newItems,
    ).toHaveLength(0);
  });
  it("reports unsupported text and leaves the source available", () => {
    expect(parse("알 수 없는 내용").warnings).toHaveLength(1);
    expect(parse(camfit()).diagnostics[0].raw).toBe(camfit());
  });
  it("offers an explicit update for changed data, blocks replay of cancelled data", () => {
    expect(classifyImport({ a: r() }, r({ site: "B1" })).type).toBe("update");
    expect(classifyImport({ a: r() }, r()).type).toBe("duplicate");
    expect(classifyImport({ a: r({ status: "cancelled" }) }, r()).type).toBe(
      "blocked",
    );
  });
  it("requires exactly one chosen cancellation target for an ambiguous match", () => {
    const raw = { a: r(), b: r({ reservationId: "R2" }) },
      item = r({ reservationId: "missing" });
    expect(() =>
      buildImportOperations(raw, [], [{ item, selected: true, key: "" }]),
    ).toThrow(/대상/);
    const ops = buildImportOperations(
      raw,
      [],
      [{ item, selected: true, key: "b" }],
    );
    expect(ops).toHaveLength(1);
    expect(ops[0].key).toBe("b");
  });
});
