import { beforeEach, describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { reservation as r } from "./fixtures.js";
const mock = vi.hoisted(() => ({
  db: {},
  listeners: {},
  stops: [],
  push: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("../src/firebase/firebaseClient.js", () => ({
  get db() {
    return mock.db;
  },
  initializationError: null,
}));
vi.mock("firebase/database", () => ({
  ref: (_, path) => path,
  push: (...args) => mock.push(...args),
  runTransaction: (...args) => mock.transaction(...args),
  onValue: (path, next, error) => {
    mock.listeners[path] = { next, error };
    const stop = vi.fn();
    mock.stops.push(stop);
    return stop;
  },
}));
import { useReservations } from "../src/hooks/useReservations.js";
beforeEach(() => {
  mock.db = {};
  mock.listeners = {};
  mock.stops = [];
  let id = 0;
  mock.push.mockReset().mockImplementation(() => ({ key: "key" + ++id }));
  mock.transaction.mockReset();
});
const ready = () =>
  act(() => {
    mock.listeners.reservations.next({ val: () => ({}) });
    mock.listeners[".info/connected"].next({ val: () => true });
  });
describe("Firebase store contract (mocked SDK)", () => {
  it("blocks writes before initial data and while disconnected", async () => {
    const { result } = renderHook(() => useReservations());
    await expect(
      result.current.commit([{ type: "add", data: r() }]),
    ).rejects.toThrow(/불러오고/);
    act(() => mock.listeners.reservations.next({ val: () => ({}) }));
    expect(result.current.canWrite).toBe(false);
    ready();
    expect(result.current.canWrite).toBe(true);
    act(() => mock.listeners[".info/connected"].next({ val: () => false }));
    await expect(
      result.current.commit([{ type: "add", data: r() }]),
    ).rejects.toThrow();
    expect(mock.transaction).not.toHaveBeenCalled();
  });
  it("rejects missing configuration instead of reporting success", async () => {
    mock.db = null;
    const { result } = renderHook(() => useReservations());
    await expect(
      result.current.commit([{ type: "add", data: r() }]),
    ).rejects.toThrow();
    expect(result.current.loaded).toBe(false);
  });
  it("serializes clicks and waits for server acknowledgement", async () => {
    const { result } = renderHook(() => useReservations());
    ready();
    let finish;
    mock.transaction.mockImplementation((path, reducer, options) => {
      expect(path).toBe("reservations");
      expect(options.applyLocally).toBe(false);
      const next = reducer({});
      return new Promise((resolve) => {
        finish = () =>
          resolve({ committed: true, snapshot: { val: () => next } });
      });
    });
    let pending;
    act(() => {
      pending = result.current.commit([{ type: "add", data: r() }]);
    });
    expect(result.current.saving).toBe(true);
    expect(result.current.message).toBe("");
    await expect(
      result.current.commit([{ type: "add", data: r() }]),
    ).rejects.toThrow(/저장 중/);
    await act(async () => {
      finish();
      await pending;
    });
    expect(mock.transaction).toHaveBeenCalledTimes(1);
    expect(result.current.message).toContain("저장 완료");
  });
  it("reuses IDs across transaction retries and retains concurrent unrelated writes", async () => {
    const { result } = renderHook(() => useReservations());
    ready();
    mock.transaction.mockImplementation(async (_, reducer) => {
      const initial = reducer({});
      const key = Object.keys(initial)[0];
      const retried = reducer({
        other: r({ reservationId: "OTHER", site: "B1" }),
      });
      expect(retried[key]).toEqual(initial[key]);
      expect(retried.other).toBeDefined();
      return { committed: true, snapshot: { val: () => retried } };
    });
    await act(async () => {
      await result.current.commit([{ type: "add", data: r() }]);
    });
  });
  it("aborts when a concurrent identical reservation appears on retry", async () => {
    const { result } = renderHook(() => useReservations());
    ready();
    mock.transaction.mockImplementation(async (_, reducer) => {
      expect(reducer({})).toBeDefined();
      expect(reducer({ concurrent: r() })).toBeUndefined();
      return { committed: false };
    });
    await act(async () => {
      await expect(
        result.current.commit([{ type: "add", data: r() }]),
      ).rejects.toThrow(/予約|예약번호/);
    });
    expect(result.current.message).toContain("저장 실패");
    expect(result.current.saving).toBe(false);
  });
  it("clears busy state on network rejection so an explicit retry can succeed", async () => {
    const { result } = renderHook(() => useReservations());
    ready();
    mock.transaction.mockRejectedValueOnce(new Error("network"));
    await act(async () => {
      await expect(
        result.current.commit([{ type: "add", data: r() }]),
      ).rejects.toThrow("network");
    });
    expect(result.current.saving).toBe(false);
    mock.transaction.mockImplementation(async (_, reducer) => ({
      committed: true,
      snapshot: { val: () => reducer({}) },
    }));
    await act(async () => {
      await result.current.commit([{ type: "add", data: r() }]);
    });
    expect(result.current.message).toContain("완료");
  });
  it("reports malformed root data and cleans up both subscriptions", () => {
    const { result, unmount } = renderHook(() => useReservations());
    act(() => mock.listeners.reservations.next({ val: () => "bad" }));
    expect(result.current.error.message).toContain("형식");
    expect(result.current.canWrite).toBe(false);
    unmount();
    expect(mock.stops.every((stop) => stop.mock.calls.length === 1)).toBe(true);
  });
});
