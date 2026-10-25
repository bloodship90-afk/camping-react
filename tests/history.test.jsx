import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ReservationModal from "../src/components/ReservationModal.jsx";
import { reservation } from "./fixtures.js";

it("shows valid history despite malformed legacy entries and keeps history keyboard-accessible", () => {
  const raw = {
    ...reservation(),
    _history: {
      broken: null,
      odd: { action: { bad: true } },
      valid: { action: "add", at: 1, after: reservation() },
    },
  };
  render(
    <ReservationModal
      recordKey="a"
      initial={reservation()}
      raw={raw}
      records={{}}
      editable
      canWrite
      onClose={vi.fn()}
      onCommit={vi.fn()}
    />,
  );
  const summary = screen.getByText(/변경 이력/).closest("summary");
  summary.focus();
  fireEvent.keyDown(summary, { key: "Tab" });
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "닫기" }),
  );
  expect(summary.textContent).toContain("2건");
});
