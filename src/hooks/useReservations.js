import { useCallback, useEffect, useRef, useState } from "react";
import { ref, onValue, push, runTransaction } from "firebase/database";
import { db, initializationError } from "../firebase/firebaseClient.js";
import { applyOperations } from "../utils/reservationMutations.js";

export function useReservations() {
  const [reservations, setReservations] = useState({});
  const [loading, setLoading] = useState(!!db),
    [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(initializationError),
    [connected, setConnected] = useState(false);
  const [lastReceived, setLastReceived] = useState(null),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  const ready = useRef(false),
    connectedRef = useRef(false),
    busy = useRef(false);
  useEffect(() => {
    if (!db) return;
    const timeout = setTimeout(() => {
      if (!ready.current)
        setError(
          new Error(
            "예약 정보를 불러오는 데 시간이 걸립니다. 연결을 확인하세요.",
          ),
        );
    }, 15000);
    const unsubscribe = onValue(
      ref(db, "reservations"),
      (snap) => {
        const value = snap.val();
        if (
          value !== null &&
          (typeof value !== "object" || Array.isArray(value))
        ) {
          ready.current = false;
          setLoaded(false);
          setLoading(false);
          setError(new Error("예약 데이터 형식이 올바르지 않습니다."));
          return;
        }
        ready.current = true;
        setReservations(value || {});
        setLoaded(true);
        setLoading(false);
        setError(null);
        setLastReceived(Date.now());
        clearTimeout(timeout);
      },
      (err) => {
        ready.current = false;
        setLoaded(false);
        setLoading(false);
        setError(err);
        clearTimeout(timeout);
      },
    );
    const disconnect = onValue(
      ref(db, ".info/connected"),
      (snap) => {
        connectedRef.current = snap.val() === true;
        setConnected(connectedRef.current);
      },
      () => {
        connectedRef.current = false;
        setConnected(false);
      },
    );
    return () => {
      unsubscribe();
      disconnect();
      clearTimeout(timeout);
      ready.current = false;
    };
  }, []);
  useEffect(() => {
    if (!saving) return;
    const prevent = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [saving]);
  const commit = useCallback(async (operations) => {
    if (busy.current)
      throw new Error("저장 중입니다. 완료될 때까지 기다려 주세요.");
    if (!db || !ready.current || !connectedRef.current)
      throw new Error(
        "예약 정보를 불러오고 연결이 확인된 후 저장할 수 있습니다.",
      );
    if (!operations.length) throw new Error("선택된 작업이 없습니다.");
    busy.current = true;
    setSaving(true);
    setMessage("");
    // Stable keys and request id across Firebase transaction retries.
    let conflict;
    try {
      const prepared = operations.map((op) => ({
        ...op,
        key: op.key || push(ref(db, "reservations")).key,
      }));
      const operationId = push(ref(db, "reservations")).key,
        at = Date.now();
      const result = await runTransaction(
        ref(db, "reservations"),
        (current) => {
          try {
            const next = applyOperations(current, prepared, {
              operationId,
              at,
            });
            conflict = null;
            return next;
          } catch (e) {
            conflict = e;
            return undefined;
          }
        },
        { applyLocally: false },
      );
      if (!result.committed)
        throw conflict || new Error("저장되지 않았습니다. 다시 확인하세요.");
      setMessage(`${operations.length}건 저장 완료`);
      return result.snapshot.val();
    } catch (e) {
      setMessage("저장 실패: " + e.message);
      throw e;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }, []);
  return {
    reservations,
    loading,
    loaded,
    error,
    connected,
    lastReceived,
    saving,
    message,
    commit,
    canWrite: !!db && loaded && connected && !error && !saving,
  };
}
