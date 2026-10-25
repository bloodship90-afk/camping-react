import React from "react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import KakaoParserPanel from "../src/components/KakaoParserPanel.jsx";
import ReservationModal from "../src/components/ReservationModal.jsx";
import ReservationList from "../src/components/ReservationList.jsx";
import { CampingApp } from "../src/App.jsx";
import { inspectReservations } from "../src/utils/reservationModel.js";
import { camfit, reservation as r } from "./fixtures.js";
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-25T12:00:00+09:00"));
});
const panel = (props = {}) => (
  <KakaoParserPanel
    reservations={{}}
    rawReservations={{}}
    canWrite={true}
    saving={false}
    onCommit={vi.fn()}
    {...props}
  />
);
const analyze = () => {
  fireEvent.change(screen.getByLabelText("예약 메시지 원문"), {
    target: { value: camfit() },
  });
  fireEvent.click(screen.getByRole("button", { name: "메시지 분석" }));
};
describe("import review screen", () => {
  it("invalidates the old preview immediately when the source changes", () => {
    render(panel());
    analyze();
    expect(
      screen.getByRole("button", { name: "선택한 1건 저장" }).disabled,
    ).toBe(false);
    fireEvent.change(screen.getByLabelText("예약 메시지 원문"), {
      target: { value: camfit("NEW") },
    });
    expect(screen.queryByRole("button", { name: /건 저장/ })).toBeNull();
  });
  it("allows analysis but blocks saving while data is loading", () => {
    render(panel({ canWrite: false }));
    analyze();
    expect(
      screen.getByRole("button", { name: "선택한 1건 저장" }).disabled,
    ).toBe(true);
  });
  it("requires reanalysis if live reservation data changes", () => {
    const view = render(panel());
    analyze();
    view.rerender(panel({ rawReservations: { other: r() } }));
    expect(screen.getByRole("alert").textContent).toContain("변경되었습니다");
    expect(
      screen.getByRole("button", { name: "선택한 1건 저장" }).disabled,
    ).toBe(true);
  });
  it("preserves source and candidates after a failed save", async () => {
    const commit = vi.fn().mockRejectedValue(new Error("연결 실패"));
    render(panel({ onCommit: commit }));
    analyze();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "선택한 1건 저장" }));
    });
    expect(screen.getByRole("alert").textContent).toContain("연결 실패");
    expect(screen.getByLabelText("예약 메시지 원문").value).toBe(camfit());
    expect(
      screen.getByRole("button", { name: "선택한 1건 저장" }),
    ).toBeDefined();
  });
  it("blocks a second click even before a parent saving flag rerenders", async () => {
    let finish;
    const commit = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(panel({ onCommit: commit }));
    analyze();
    const save = screen.getByRole("button", { name: "선택한 1건 저장" });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(commit).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(screen.getByLabelText("예약 메시지 원문").value).toBe(camfit());
  });
});
describe("details, family view and list", () => {
  it("opens in view mode and exposes editing only after the mode switch", () => {
    render(
      <CampingApp
        store={{
          reservations: { a: r() },
          isDemo: true,
          loaded: true,
          loading: false,
          connected: true,
          canWrite: true,
          saving: false,
          commit: vi.fn(),
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: "+ 예약 추가" })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /보기 모드 · 편집하기/ }),
    );
    expect(screen.getByRole("button", { name: "+ 예약 추가" }).disabled).toBe(
      false,
    );
  });
  it("shows malformed items in the repair list and details safely", () => {
    const records = inspectReservations({
      a: { name: "불완전", nights: "broken" },
    });
    render(
      <ReservationList
        reservations={records}
        today="2026-10-25"
        issuesOnly
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "불완전" })).toBeDefined();
  });
  it("prevents double save, preserves a failed edit, and supports Escape", async () => {
    let fail;
    const close = vi.fn(),
      commit = vi.fn(
        () =>
          new Promise((_, reject) => {
            fail = reject;
          }),
      );
    render(
      <ReservationModal
        initial={r()}
        raw={r()}
        records={{}}
        editable
        canWrite
        onClose={close}
        onCommit={commit}
      />,
    );
    const save = screen.getByRole("button", { name: "저장" });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(commit).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(close).not.toHaveBeenCalled();
    await act(async () => fail(new Error("저장 실패")));
    expect(screen.getByLabelText("예약자 이름").value).toBe("홍길동");
    expect(screen.getByRole("alert").textContent).toBe("저장 실패");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
  });
  it("exposes explicit recovery for cancelled records and records the right action", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const commit = vi.fn().mockResolvedValue({});
    render(
      <ReservationModal
        recordKey="a"
        initial={r({ status: "cancelled" })}
        raw={r({ status: "cancelled" })}
        records={{}}
        editable
        canWrite
        onClose={vi.fn()}
        onCommit={commit}
      />,
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "취소 복구" })),
    );
    expect(commit.mock.calls[0][0][0].type).toBe("restore");
  });
  it("distinguishes whole-period selection from resetting all filters", () => {
    render(
      <ReservationList
        reservations={inspectReservations({ a: r() })}
        today="2026-10-25"
        onOpen={vi.fn()}
      />,
    );
    const name = screen.getByLabelText("이름 검색");
    fireEvent.change(name, { target: { value: "홍" } });
    fireEvent.click(screen.getByRole("button", { name: "전체 기간" }));
    expect(name.value).toBe("홍");
    fireEvent.click(screen.getByRole("button", { name: "전체 필터 초기화" }));
    expect(name.value).toBe("");
  });
});
