import { useEffect, useState, useCallback } from "react";
import { ref, onValue, push, update } from "firebase/database";
import {
  db,
  isFirebaseConfigured,
  missingFirebaseKeys,
} from "../firebase/firebaseClient.js";

// reservations 실시간 구독 + CRUD
export function useReservations() {
  const [reservations, setReservations] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 빈 env: 백지 대신 안내 에러를 세팅하고 구독을 건너뜀
    if (!isFirebaseConfigured || !db) {
      setLoading(false);
      setError(
        new Error(
          ".env.local 에 Firebase 키를 설정하세요. 누락: " +
            missingFirebaseKeys.join(", ")
        )
      );
      return;
    }
    const r = ref(db, "reservations");
    const unsub = onValue(
      r,
      (snapshot) => {
        setReservations(snapshot.val() || {});
        setLoading(false);
      },
      (err) => {
        console.error("[useReservations] onValue error:", err);
        setError(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const addReservation = useCallback(async (data) => {
    if (!db) {
      alert("Firebase 가 설정되지 않아 저장할 수 없습니다. .env.local 을 확인하세요.");
      return;
    }
    try {
      await push(ref(db, "reservations"), data);
    } catch (e) {
      console.error("[addReservation] failed:", e);
      alert("저장 실패: " + e.message);
      throw e;
    }
  }, []);

  const updateReservation = useCallback(async (key, data) => {
    if (!db) {
      alert("Firebase 가 설정되지 않아 수정할 수 없습니다. .env.local 을 확인하세요.");
      return;
    }
    try {
      await update(ref(db, `reservations/${key}`), data);
    } catch (e) {
      console.error("[updateReservation] failed:", e);
      alert("수정 실패: " + e.message);
      throw e;
    }
  }, []);

  // soft delete — 기존 status: "cancelled" 방식 유지
  const cancelReservation = useCallback(async (key) => {
    if (!db) {
      alert("Firebase 가 설정되지 않아 취소할 수 없습니다. .env.local 을 확인하세요.");
      return;
    }
    try {
      await update(ref(db, `reservations/${key}`), {
        status: "cancelled",
        cancelledAt: Date.now(),
      });
    } catch (e) {
      console.error("[cancelReservation] failed:", e);
      alert("취소 실패: " + e.message);
      throw e;
    }
  }, []);

  return {
    reservations,
    loading,
    error,
    addReservation,
    updateReservation,
    cancelReservation,
  };
}
