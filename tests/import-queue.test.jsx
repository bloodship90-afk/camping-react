import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import KakaoParserPanel from "../src/components/KakaoParserPanel.jsx";
import { camfit, reservation as r, cancellation } from "./fixtures.js";
const panel = (props = {}) => (
  <KakaoParserPanel
    rawReservations={{}}
    canWrite
    saving={false}
    onCommit={vi.fn()}
    {...props}
  />
);
const paste = (text = camfit()) =>
  fireEvent.paste(screen.getByLabelText("예약 메시지 원문"), {
    clipboardData: { getData: () => text },
  });
const save = () => screen.getByRole("button", { name: /^전체 저장/ });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-25T12:00:00+09:00"));
});
describe("accumulated message import", () => {
  it("clears and focuses input, accumulates cards, then saves all and clears queue", async () => {
    const commit = vi.fn().mockResolvedValue({});
    render(panel({ onCommit: commit }));
    paste();
    paste(camfit("NEW", { site: "B1" }));
    expect(screen.getByLabelText("예약 메시지 원문").value).toBe("");
    expect(document.activeElement).toBe(
      screen.getByLabelText("예약 메시지 원문"),
    );
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(save().disabled).toBe(false);
    await act(async () => fireEvent.click(save()));
    expect(commit.mock.calls[0][0].map((op) => op.data.reservationId)).toEqual([
      "R1",
      "NEW",
    ]);
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.getByRole("status").textContent).toContain(
      "총 2건 저장 완료",
    );
  });
  it("deduplicates repeated pastes and keeps original text on the card", () => {
    render(panel());
    paste();
    paste();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toContain(
      "반복된 원문은 제외",
    );
    expect(
      screen.getByText(
        (_, el) => el.tagName === "PRE" && el.textContent === camfit(),
      ),
    ).toBeDefined();
  });
  it("blocks unknown input until deleted without removing prior cards", () => {
    const commit = vi.fn();
    render(panel({ onCommit: commit }));
    paste();
    paste("알 수 없는 메시지");
    expect(save().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "대기 항목 삭제 2" }));
    expect(save().disabled).toBe(false);
    expect(commit).not.toHaveBeenCalled();
  });
  it("blocks saving while remote data loads", () => {
    render(panel({ canWrite: false }));
    paste();
    expect(save().disabled).toBe(true);
  });
  it("requires refreshed review after remote changes and excludes existing records", () => {
    const view = render(panel());
    paste();
    view.rerender(panel({ rawReservations: { a: r() } }));
    expect(screen.getByRole("alert").textContent).toContain("변경되었습니다");
    expect(save().disabled).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "최신 내용으로 다시 확인" }),
    );
    expect(screen.getByText("이미 등록됨")).toBeDefined();
    expect(save().disabled).toBe(true);
  });
  it("preserves cards and source after failure and retries", async () => {
    const commit = vi
      .fn()
      .mockRejectedValueOnce(new Error("연결 실패"))
      .mockResolvedValue({});
    render(panel({ onCommit: commit }));
    paste();
    await act(async () => fireEvent.click(save()));
    expect(screen.getByRole("alert").textContent).toContain("연결 실패");
    expect(
      screen.getByText(
        (_, el) => el.tagName === "PRE" && el.textContent === camfit(),
      ),
    ).toBeDefined();
    await act(async () => fireEvent.click(save()));
    expect(commit).toHaveBeenCalledTimes(2);
  });
  it("blocks double save and new intake during pending write", async () => {
    let finish;
    const commit = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(panel({ onCommit: commit }));
    paste();
    const button = save();
    fireEvent.click(button);
    fireEvent.click(button);
    paste(camfit("OTHER"));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    await act(async () => finish());
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });
  it("splits batch paste and checks pending overlaps", () => {
    render(panel());
    paste(camfit() + "\n" + camfit("OTHER"));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(save().disabled).toBe(true);
    fireEvent.click(
      screen.getByLabelText(
        "겹치는 예약을 확인했으며 중복 예약도 함께 기록합니다",
      ),
    );
    expect(save().disabled).toBe(false);
  });
  it("blocks contradictory new/cancel cards until one is removed", () => {
    render(panel({ rawReservations: { a: r() } }));
    paste();
    paste(cancellation());
    expect(save().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "대기 항목 삭제 1" }));
    expect(save().disabled).toBe(false);
    expect(save().textContent).toContain("취소 1건");
  });
  it("requires confirmation before updating an existing record", () => {
    render(panel({ rawReservations: { a: r() } }));
    paste(camfit("R1", { site: "B1" }));
    expect(save().disabled).toBe(true);
    fireEvent.click(
      screen.getByLabelText("기존 예약 변경 내용을 확인했습니다"),
    );
    expect(save().disabled).toBe(false);
  });
  it("requires manual fallback cancellation choice and saves correct target", async () => {
    const commit = vi.fn().mockResolvedValue({});
    render(
      panel({
        rawReservations: { a: r({ reservationId: "OLD" }) },
        onCommit: commit,
      }),
    );
    paste(
      "예약 취소 알림\n예약번호: NEW\n고객정보: 홍길동 / 010-1234-5678\n입실일자: 2026/11/10",
    );
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("취소 대상 1"), {
      target: { value: "a" },
    });
    await act(async () => fireEvent.click(save()));
    expect(commit.mock.calls[0][0][0]).toMatchObject({
      type: "cancel",
      key: "a",
    });
  });
  it("supports manually entering text and correcting parsed fields", () => {
    render(panel());
    fireEvent.change(screen.getByLabelText("예약 메시지 원문"), {
      target: { value: camfit("R1", { site: "D1" }) },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "입력 내용 분석·추가" }),
    );
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("사이트"), {
      target: { value: "A1" },
    });
    expect(save().disabled).toBe(false);
  });
});
