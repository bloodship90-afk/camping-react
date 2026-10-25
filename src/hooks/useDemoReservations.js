import { useRef, useState } from "react";
import { applyOperations } from "../utils/reservationMutations.js";
import { addDays, dateStr, getWeekDates } from "../utils/dateUtils.js";
export function demoReservations() {
  const monday = getWeekDates()[0],
    day = (n) => dateStr(addDays(monday, n));
  const r = {
    name: "예시 예약자",
    site: "A1",
    checkin: day(4),
    nights: 2,
    phone: "010-0000-0000",
    platform: "캠핏",
    status: "active",
  };
  return {
    demo1: { ...r, reservationId: "DEMO-01" },
    demo2: {
      ...r,
      name: "예시 가족",
      site: "B2",
      checkin: day(2),
      nights: 3,
      platform: "직접예약",
    },
    demo3: {
      ...r,
      name: "취소 예시",
      site: "C3",
      status: "cancelled",
      cancelledAt: Date.now(),
      reservationId: "DEMO-03",
    },
    demo4: {
      ...r,
      name: "확인 필요 예시",
      site: "",
      platform: "",
      reservationId: "DEMO-04",
    },
  };
}
export function useDemoReservations() {
  const [reservations, setReservations] = useState(demoReservations),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  const current = useRef(reservations),
    busy = useRef(false);
  async function commit(operations) {
    if (busy.current) throw new Error("저장 중입니다.");
    busy.current = true;
    setSaving(true);
    try {
      const prepared = operations.map((op) => ({
        ...op,
        key: op.key || "demo-" + crypto.randomUUID(),
      }));
      const next = applyOperations(current.current, prepared, {
        operationId: crypto.randomUUID(),
        at: Date.now(),
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      current.current = next;
      setReservations(next);
      setMessage(operations.length + "건 저장 완료 (체험용)");
      return next;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return {
    reservations,
    loading: false,
    loaded: true,
    error: null,
    connected: true,
    lastReceived: Date.now(),
    saving,
    message,
    commit,
    canWrite: !saving,
    isDemo: true,
  };
}
