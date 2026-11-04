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
