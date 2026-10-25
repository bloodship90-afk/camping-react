import { useEffect, useRef, useState } from "react";
import {
  fields,
  fingerprint,
  text,
  validateReservation,
} from "../utils/reservationModel.js";
import { dateStr, getCheckoutDate } from "../utils/dateUtils.js";
import { conflictsFor } from "../utils/reservationUtils.js";
import ReservationFields from "./ReservationFields.jsx";
const empty = {
  name: "",
  site: "A1",
  checkin: "",
  nights: 1,
  phone: "",
  platform: "직접예약",
  reservationId: "",
  status: "active",
};
export default function ReservationModal({
  initial,
  recordKey,
  raw,
  records,
  editable,
  canWrite,
  saving,
  onClose,
  onCommit,
}) {
  const [form, setForm] = useState(() => ({
    ...empty,
    ...fields(initial || empty),
  }));
  const [editing, setEditing] = useState(!recordKey && editable);
  const [error, setError] = useState(""),
    [allowOverlap, setAllowOverlap] = useState(false);
  const dialog = useRef(null),
    mutex = useRef(false);
  const cancelled = initial?.status === "cancelled";
  const expected = useRef(fingerprint(raw));
  const conflicts = conflictsFor(records, form, recordKey);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus();
    return () => previous?.focus?.();
  }, []);
  const close = () => {
    if (!saving && !mutex.current) onClose();
  };
  const keyboard = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
    if (e.key === "Tab") {
      const focusable = [
        ...dialog.current.querySelectorAll(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],summary",
        ),
      ];
      if (!focusable.length) {
        e.preventDefault();
        return;
      }
      const first = focusable[0],
        last = focusable.at(-1);
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  async function submit(type) {
    if (mutex.current) return;
    setError("");
    if (!canWrite) {
      setError("연결과 저장 상태를 확인하세요.");
      return;
    }
    if (type === "add" || type === "update") {
      const errors = validateReservation(form);
      if (errors.length) {
        setError(errors.join(" "));
        return;
      }
    }
    if (
      type === "cancel" &&
      !window.confirm(
        `${form.name} · ${form.site} · ${form.checkin} 예약을 취소할까요?`,
      )
    )
      return;
    if (type === "restore" && !window.confirm("이 취소 예약을 복구할까요?"))
      return;
    mutex.current = true;
    try {
      await onCommit([
        {
          type,
          key: recordKey,
          data: form,
          expected: expected.current,
          allowOverlap,
        },
      ]);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      mutex.current = false;
    }
  }
  const history = Object.values(raw?._history || {})
    .filter((event) => event && typeof event === "object")
    .map((event) => ({
      action: text(event.action),
      at: Number(event.at) || 0,
      before: event.before ? fields(event.before) : null,
      after: fields(event.after),
    }))
    .sort((a, b) => b.at - a.at);
  const actions = {
    add: "예약 추가",
    update: "정보 수정",
    cancel: "예약 취소",
    restore: "예약 복구",
  };
  return (
    <div
      className="modal-overlay show"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-title"
        tabIndex={-1}
        className="modal"
        onKeyDown={keyboard}
      >
        <h2 id="reservation-title">
          {recordKey ? (editing ? "예약 정보 수정" : "예약 상세") : "예약 추가"}
        </h2>
        <p className="muted">
          {cancelled ? "취소된 예약" : "예약중"} · 퇴실일{" "}
          {dateStr(getCheckoutDate(form)) || "—"}
        </p>
        {initial?._issues?.length > 0 && (
          <p className="notice warning">
            확인 필요: {initial._issues.join(" ")}
          </p>
        )}
        {editing ? (
          <ReservationFields
            value={form}
            onChange={(value) => {
              setForm(value);
              setAllowOverlap(false);
            }}
            disabled={saving}
          />
        ) : (
          <dl className="details-grid">
            {[
              ["예약자", form.name],
              ["사이트", form.site],
              ["입실", form.checkin],
              ["박수", form.nights + "박"],
              ["전화번호", form.phone || "—"],
              ["플랫폼", form.platform || "미지정"],
              ["예약번호", form.reservationId || "직접 입력"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {editable && conflicts.length > 0 && (
          <div className="notice warning">
            <p>
              같은 사이트의 예약과 겹칩니다:{" "}
              {conflicts.map(([, r]) => r.name + " " + r.checkin).join(", ")}
            </p>
            <label>
              <input
                type="checkbox"
                checked={allowOverlap}
                disabled={saving}
                onChange={(e) => setAllowOverlap(e.target.checked)}
              />{" "}
              중복 내용을 확인했으며 함께 기록합니다
            </label>
          </div>
        )}
        {error && (
          <p role="alert" className="notice warning">
            {error}
          </p>
        )}
        <div className="modal-btns">
          <button className="btn-cancel" disabled={saving} onClick={close}>
            닫기
          </button>
          {editable && !editing && (
            <button
              className="btn-save"
              disabled={!canWrite}
              onClick={() => setEditing(true)}
            >
              수정
            </button>
          )}
          {editable && editing && (
            <button
              className="btn-save"
              disabled={!canWrite}
              onClick={() => submit(recordKey ? "update" : "add")}
            >
              {saving ? "저장 중…" : "저장"}
            </button>
          )}
          {editable && recordKey && (
            <button
              className={cancelled ? "btn-save" : "btn-delete"}
              disabled={!canWrite}
              onClick={() => submit(cancelled ? "restore" : "cancel")}
            >
              {cancelled ? "취소 복구" : "예약 취소"}
            </button>
          )}
        </div>
        {history.length > 0 && (
          <details className="history">
            <summary>변경 이력 {history.length}건</summary>
            {history.map((event, i) => (
              <article key={i}>
                <strong>{actions[event.action] || event.action}</strong> ·{" "}
                {new Date(event.at).toLocaleString("ko-KR")}
                <div className="history-values">
                  {event.before && (
                    <p>
                      이전: {event.before.name} / {event.before.site} /{" "}
                      {event.before.checkin} / {event.before.nights}박 /{" "}
                      {event.before.phone} / {event.before.platform} /{" "}
                      {event.before.reservationId} / {event.before.status}
                    </p>
                  )}
                  <p>
                    변경: {event.after?.name} / {event.after?.site} /{" "}
                    {event.after?.checkin} / {event.after?.nights}박 /{" "}
                    {event.after?.phone} / {event.after?.platform} /{" "}
                    {event.after?.reservationId} / {event.after?.status}
                  </p>
                </div>
              </article>
            ))}
          </details>
        )}
      </section>
    </div>
  );
}
