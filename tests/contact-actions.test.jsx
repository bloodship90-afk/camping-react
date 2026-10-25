import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ReservationModal from "../src/components/ReservationModal.jsx";
import { reservation } from "./fixtures.js";

const show = (phone, extra = {}) => {
  const raw = reservation({ phone });
  return render(
    <ReservationModal
      recordKey="a"
      initial={raw}
      raw={raw}
      records={{}}
      editable
      canWrite={false}
      onClose={vi.fn()}
      onCommit={vi.fn()}
      {...extra}
    />,
  );
};
describe("reservation contact actions", () => {
  it.each([
    ["010-1234-5678", "01012345678"],
    ["02 123 4567", "021234567"],
    ["+82 (10) 1234-5678", "+821012345678"],
  ])(
    "opens native phone and SMS compose links for %s even when editing is unavailable",
    (phone, number) => {
      show(phone);
      expect(
        screen.getByRole("link", { name: "전화하기" }).getAttribute("href"),
      ).toBe("tel:" + number);
      expect(
        screen.getByRole("link", { name: "문자 보내기" }).getAttribute("href"),
      ).toBe("sms:" + number);
      expect(
        screen.getByRole("link", { name: "문자 보내기" }).getAttribute("href"),
      ).not.toContain("body");
    },
  );
  it.each(["", undefined, "   ", "010", "번호 없음"])(
    "disables both actions instead of creating an empty/invalid destination: %s",
    (phone) => {
      show(phone);
      expect(screen.queryAllByRole("link")).toHaveLength(0);
      expect(screen.getByRole("button", { name: "전화하기" }).disabled).toBe(
        true,
      );
      expect(screen.getByRole("button", { name: "문자 보내기" }).disabled).toBe(
        true,
      );
    },
  );
  it("prevents leaving for another app while a reservation write is pending", () => {
    show("010-1234-5678", { saving: true });
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "전화하기" }).disabled).toBe(
      true,
    );
  });
  it("does not expose contact actions on an unsaved reservation or during editing", () => {
    show("010-1234-5678", { recordKey: null });
    expect(screen.queryByRole("link", { name: "전화하기" })).toBeNull();
    expect(screen.queryByRole("button", { name: "문자 보내기" })).toBeNull();
  });
});
