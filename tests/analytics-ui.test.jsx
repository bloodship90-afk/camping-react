import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { CampingApp } from "../src/App.jsx";
import AnalyticsPage from "../src/components/AnalyticsPage.jsx";
import { reservation as r } from "./fixtures.js";
it("opens analytics without invoking writes and keeps missing-phone reservations in original view", () => {
  const commit = vi.fn(),
    raw = {
      a: r({ checkin: "2025-04-01" }),
      missing: r({ reservationId: "M", phone: "" }),
    };
  const before = JSON.stringify(raw);
  render(
    <CampingApp
      store={{
        reservations: raw,
        loaded: true,
        connected: true,
        isDemo: true,
        canWrite: true,
        commit,
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "운영 통계" }));
  expect(screen.getByText(/원본 2건 중 집계 가능 1건/)).toBeDefined();
  fireEvent.click(
    screen.getByRole("button", { name: "캠퍼 정보", exact: true }),
  );
  fireEvent.click(screen.getByRole("button", { name: /홍길동.*010/ }));
  expect(screen.getByRole("region", { name: "전체 예약 내역" })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "예약 목록" }));
  expect(commit).not.toHaveBeenCalled();
  expect(JSON.stringify(raw)).toBe(before);
});
it("supports period validation, search, and reversible exclusions without write callbacks", () => {
  render(
    <AnalyticsPage
      rawReservations={{ a: r({ checkin: "2025-04-01" }) }}
      today="2026-11-04"
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "캠퍼 정보", exact: true }),
  );
  fireEvent.change(screen.getByLabelText("캠퍼 검색"), {
    target: { value: "없는 캠퍼" },
  });
  expect(
    within(screen.getByRole("region", { name: "캠퍼 이용 목록" })).getByText(
      "집계할 기록이 없습니다.",
    ),
  ).toBeDefined();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByText(/원본 1건 중 집계 가능 0건/)).toBeDefined();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByText(/원본 1건 중 집계 가능 1건/)).toBeDefined();
  fireEvent.change(screen.getByLabelText("집계 기간"), {
    target: { value: "custom" },
  });
  expect(screen.getByRole("alert").textContent).toContain("유효한 시작일");
});

it("shows one category at a time, toggles it closed, and renders charts without dropping detail tables", () => {
  render(
    <AnalyticsPage
      rawReservations={{ a: r({ checkin: "2025-04-01" }) }}
      today="2026-11-04"
    />,
  );
  expect(screen.queryByRole("region", { name: "월별 예약 현황" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "플랫폼", exact: true }));
  expect(
    screen
      .getByRole("img", { name: /플랫폼별 예약 비중/ })
      .getAttribute("aria-label"),
  ).toContain("캠핏 1건");
  expect(
    screen.queryByText("입실 예약", { selector: ".analytics-kpi span" }),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "월별 현황", exact: true }),
  );
  expect(screen.queryByRole("img", { name: /플랫폼별 예약 비중/ })).toBeNull();
  expect(
    screen.getByRole("figure", { name: "월별 입실 예약" }).textContent,
  ).toContain("1건");
  fireEvent.click(
    screen.getByRole("button", { name: "월별 현황", exact: true }),
  );
  expect(screen.queryByRole("figure", { name: "월별 입실 예약" })).toBeNull();
});
it("paginates campers, sorts by total reservations, filters platform and count, and opens complete history", () => {
  const raw = Object.fromEntries(
    Array.from({ length: 17 }, (_, i) => [
      `c${i}`,
      r({
        reservationId: `R${i}`,
        name: `캠퍼${String(i).padStart(2, "0")}`,
        phone: `010-5555-${String(i).padStart(4, "0")}`,
        checkin: "2025-04-01",
      }),
    ]),
  );
  raw.vip1 = r({
    reservationId: "V1",
    name: "단골",
    phone: "010-9999-9876",
    checkin: "2025-03-01",
    platform: "직접예약",
  });
  raw.vip2 = {
    ...raw.vip1,
    reservationId: "V2",
    checkin: "2025-09-01",
    platform: "땡큐캠핑",
  };
  const before = JSON.stringify(raw);
  render(<AnalyticsPage rawReservations={raw} today="2026-11-04" />);
  fireEvent.click(
    screen.getByRole("button", { name: "캠퍼 정보", exact: true }),
  );
  const list = () => screen.getByRole("region", { name: "캠퍼 이용 목록" });
  expect(within(list()).getAllByRole("button")).toHaveLength(15);
  expect(within(list()).getAllByRole("button")[0].textContent).toContain(
    "단골",
  );
  fireEvent.click(screen.getByRole("button", { name: "다음", exact: true }));
  expect(within(list()).getAllByRole("button")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "이름순", exact: true }));
  expect(screen.getByRole("status").textContent).toContain("1 / 2");
  fireEvent.click(
    screen.getByRole("button", { name: "직접예약", exact: true }),
  );
  expect(within(list()).getAllByRole("button")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: /단골.*010/ }));
  const dialog = screen.getByRole("dialog", { name: "단골 · 캠퍼 상세" });
  expect(
    within(dialog).getByRole("region", { name: "전체 예약 내역" }).textContent,
  ).toContain("땡큐캠핑");
  expect(
    within(dialog).getByRole("region", { name: "전체 예약 내역" }).textContent,
  ).toContain("직접예약");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "캠퍼 상세 닫기" }),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "1건", exact: true }));
  expect(within(list()).getByText("집계할 기록이 없습니다.")).toBeDefined();
  expect(JSON.stringify(raw)).toBe(before);
});
it("opens all charts for empty data without NaN and keeps details accessible", () => {
  render(<AnalyticsPage rawReservations={{}} today="2026-11-04" />);
  for (const name of [
    "월별 현황",
    "플랫폼",
    "사이트·구역",
    "계절 트렌드",
    "숙박·재방문",
  ]) {
    fireEvent.click(screen.getByRole("button", { name, exact: true }));
    expect(document.querySelector(".analytics-page").textContent).not.toContain(
      "NaN",
    );
  }
  expect(screen.getByRole("img", { name: /숙박 길이 분포/ })).toBeDefined();
});
