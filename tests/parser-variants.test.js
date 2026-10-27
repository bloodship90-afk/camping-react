import { describe, it, expect } from "vitest";
import { parseReservationMessages } from "../src/utils/kakaoParsers.js";
import { camfit } from "./fixtures.js";

// Synthetic personal fields; retain the reported punctuation and line structure.
export const splitSiteNotice = `테스트 캠핑장 신규 예약이 성사되었습니다.

예약번호 : TEST-CAMFIT-01
캠핑존 : NO KIDS-A  / -02
입실일자 : 2026/12/25 ~ 2026/12/26 (1박)
고객정보 : 예시예약자 / 01000000000
결제정보 : 80,000원 / 온라인결제
인원정보 : 성인 - 2명 / 청소년 - 0명 / 미취학 아동 - 0명`;
const parse = (text) => parseReservationMessages(text, { today: "2026-10-27" });
describe("variable notification formats", () => {
  it("recognizes A2 in the reported split zone / number format", () => {
    const result = parse(splitSiteNotice);
    expect(result.stats).toMatchObject({ found: 1, ready: 1, invalid: 0 });
    expect(result.newItems[0]).toMatchObject({
      platform: "캠핏",
      site: "A2",
      checkin: "2026-12-25",
      nights: 1,
      name: "예시예약자",
      phone: "010-0000-0000",
    });
  });
  it.each([
    ["NO KIDS-A / -02", "A2"],
    ["A-02", "A2"],
    ["A / 02", "A2"],
    ["A 02", "A2"],
    ["B존 / -04", "B4"],
    ["C구역 7번", "C7"],
  ])(
    "handles separators in %s without guessing an unlisted site",
    (site, expected) => {
      expect(parse(camfit("TEST", { site })).newItems[0].site).toBe(expected);
    },
  );
  it("recognizes changed headings, spaced labels and Korean dates without an explicit nights value", () => {
    const result = parse(`[캠핏]
새로운 예약이 접수되었어요
예약 번호 = TEST-02
예약자 이름 : 예시예약자
연락처 : 010-0000-0000
사이트 : B / -03
체크인 : 2026년 12월 25일
체크아웃 : 2026년 12월 27일`);
    expect(result.newItems).toHaveLength(1);
    expect(result.newItems[0]).toMatchObject({
      reservationId: "TEST-02",
      site: "B3",
      nights: 2,
      platform: "캠핏",
    });
    expect(result.stats.invalid).toBe(0);
  });
  it("can read the labelled reservation details even when the greeting is absent", () => {
    expect(
      parse(camfit().split("\n").slice(1).join("\n")).newItems[0].platform,
    ).toBe("캠핏");
  });
  it("supports values on the line following the label", () => {
    const result = parse(
      splitSiteNotice.replace(
        "캠핑존 : NO KIDS-A  / -02",
        "캠핑존\nNO KIDS-A  / -02",
      ),
    );
    expect(result.newItems[0].site).toBe("A2");
  });
  it("leaves an unknown platform blank for explicit review", () => {
    const result = parse(`예약번호: TEST-UNKNOWN
예약자명: 예시예약자
사이트명: A1
입실일: 2026/12/25 (1박)`);
    expect(result.newItems[0].platform).toBe("");
    expect(result.stats.invalid).toBe(1);
  });
  it("does not silently choose the first of two site codes", () => {
    expect(parse(camfit("TEST", { site: "A1 / B2" })).newItems[0].site).toBe(
      "",
    );
  });
  it("does not silently discard a second reservation in an unsplit block", () => {
    const result = parse(
      camfit("ONE") + "\n" + camfit("TWO").split("\n").slice(1).join("\n"),
    );
    expect(result.newItems).toHaveLength(0);
    expect(result.stats.invalid).toBe(1);
    expect(result.diagnostics[0].errors.join(" ")).toContain("여러 개");
  });
  it("does not turn a cancellation request into a completed cancellation", () => {
    const result = parse("[캠핏] 예약 취소 요청 안내\n예약번호: TEST-CANCEL");
    expect(result.cancelList).toHaveLength(0);
    expect(result.newItems).toHaveLength(0);
    expect(result.stats.invalid).toBe(1);
  });
  it("does not treat cancellation instructions in the footer as a cancelled booking", () => {
    const result = parse(splitSiteNotice + "\n취소는 앱에서 신청해 주세요.");
    expect(result.cancelList).toHaveLength(0);
    expect(result.newItems).toHaveLength(1);
  });
  it("prioritizes the named platform over shared cancellation wording", () => {
    const result = parse("[땡큐캠핑] 예약 취소 알림\n예약번호: TEST-CANCEL");
    expect(result.cancelList[0]).toMatchObject({ platform: "땡큐캠핑" });
  });
  it.each(["예약상태: 취소 대기", "예약상태: 취소 실패"])(
    "does not import an unresolved cancellation status: %s",
    (state) => {
      const result = parse(splitSiteNotice + "\n" + state);
      expect(result.newItems).toHaveLength(0);
      expect(result.cancelList).toHaveLength(0);
      expect(result.stats.invalid).toBe(1);
    },
  );
});
