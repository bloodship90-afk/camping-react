import { useRef, useState } from "react";
import { intakeMessages, reviewQueue } from "../utils/importQueue.js";
import { buildImportOperations } from "../utils/importPlan.js";
import { fingerprint } from "../utils/reservationModel.js";
import ReservationFields from "./ReservationFields.jsx";

export default function KakaoParserPanel({
  rawReservations,
  canWrite,
  saving,
  onCommit,
}) {
  const [text, setText] = useState("");
  const [queue, setQueue] = useState([]);
  const [includePast, setIncludePast] = useState(false);
  const [version, setVersion] = useState(null);
  const [allowOverlap, setAllowOverlap] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef(null),
    mutex = useRef(false),
    sequence = useRef(0);
  const locked = saving || busy;
  const stale = queue.length > 0 && version !== fingerprint(rawReservations);
  const reviews = reviewQueue(queue, rawReservations);
  const actionable = reviews.filter((r) =>
    ["add", "update", "cancel"].includes(r.type),
  );
  const counts = Object.fromEntries(
    ["add", "update", "cancel"].map((type) => [
      type,
      actionable.filter((r) => r.type === type).length,
    ]),
  );
  const blocked = reviews.some(
    (r) =>
      r.errors.length ||
      r.type === "blocked" ||
      (r.type === "update" && !r.card.confirmed),
  );
  const overlap = reviews.some((r) => r.overlap);
  function change(id, patch) {
    setQueue((all) =>
      all.map((card) => (card.id === id ? { ...card, ...patch } : card)),
    );
    setAllowOverlap(false);
    setError("");
  }
  function append(source) {
    if (mutex.current || locked || !source.trim()) return;
    const added = intakeMessages(source, includePast);
    const signatures = new Set(queue.map((card) => card.signature));
    const fresh = added
      .filter((card) => {
        if (signatures.has(card.signature)) return false;
        signatures.add(card.signature);
        return true;
      })
      .map((card) => ({ ...card, id: ++sequence.current }));
    if (!queue.length) setVersion(fingerprint(rawReservations));
    setQueue((all) => [...all, ...fresh]);
    setText("");
    setAllowOverlap(false);
    setError("");
    setMessage(
      `${fresh.length}건을 대기 목록에 추가했습니다.${fresh.length < added.length ? " 반복된 원문은 제외했습니다." : ""}`,
    );
    input.current?.focus({ preventScroll: true });
  }
  async function save() {
    if (
      mutex.current ||
      locked ||
      stale ||
      blocked ||
      !canWrite ||
      !actionable.length ||
      (overlap && !allowOverlap)
    )
      return;
    mutex.current = true;
    setBusy(true);
    setError("");
    try {
      const rows = actionable
        .filter((r) => r.type !== "cancel")
        .map((r) => ({ item: r.card.item, selected: true }));
      const cancels = actionable
        .filter((r) => r.type === "cancel")
        .map((r) => ({ item: r.card.item, key: r.key, selected: true }));
      const ops = buildImportOperations(
        rawReservations,
        rows,
        cancels,
        allowOverlap,
      );
      await onCommit(ops);
      setQueue([]);
      setVersion(null);
      setAllowOverlap(false);
      setMessage(
        `총 ${ops.length}건 저장 완료 · 신규 ${counts.add}건 / 변경 ${counts.update}건 / 취소 ${counts.cancel}건`,
      );
      input.current?.focus({ preventScroll: true });
    } catch (e) {
      setError(e.message);
    } finally {
      mutex.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="parse-wrap">
      <h2>카톡 예약 가져오기</h2>
      <p>알림을 붙여넣을 때마다 아래에 쌓입니다. 확인하고 전체 저장하세요.</p>
      <label htmlFor="kakao-input">예약 메시지 원문</label>
      <textarea
        id="kakao-input"
        ref={input}
        className="parse-textarea"
        value={text}
        disabled={locked}
        onPaste={(e) => {
          const source = e.clipboardData.getData("text");
          if (source.trim()) {
            e.preventDefault();
            append(source);
          }
        }}
        onChange={(e) => setText(e.target.value)}
        placeholder="여기에 예약 알림을 계속 붙여넣으세요"
      />
      {text.trim() && (
        <button
          className="parse-btn"
          disabled={locked}
          onClick={() => append(text)}
        >
          입력 내용 분석·추가
        </button>
      )}
      <label className="check-label">
        <input
          type="checkbox"
          checked={includePast}
          disabled={locked}
          onChange={(e) => {
            const enabled = e.target.checked;
            setIncludePast(enabled);
            if (enabled)
              setQueue((all) =>
                all.map((card) =>
                  card.excluded
                    ? { ...intakeMessages(card.raw, true)[0], id: card.id }
                    : card,
                ),
              );
          }}
        />
        30일 이전 입실 알림도 포함 (다음 입력에 적용)
      </label>
      {!canWrite && (
        <p className="notice">
          연결 확인과 예약 정보 로딩이 끝나면 저장할 수 있습니다. 분석은 먼저 할
          수 있습니다.
        </p>
      )}
      {message && (
        <p role="status" className="notice success">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="notice warning">
          {error}
        </p>
      )}
      {queue.length > 0 && (
        <section className="import-result" aria-label="예약 대기 목록">
          <h3>분석 결과 · 대기 {queue.length}건</h3>
          {stale && (
            <p role="alert" className="notice warning">
              예약 데이터가 변경되었습니다. 최신 내용으로 다시 확인하세요.
              <button
                className="parse-btn"
                disabled={locked}
                onClick={() => {
                  setVersion(fingerprint(rawReservations));
                  setQueue((all) =>
                    all.map((card) => ({
                      ...card,
                      confirmed: false,
                      target: undefined,
                    })),
                  );
                  setAllowOverlap(false);
                }}
              >
                최신 내용으로 다시 확인
              </button>
            </p>
          )}
          {reviews.map((r) => (
            <article
              className="import-card"
              key={r.card.id}
              aria-label={`대기 예약 ${r.card.item?.reservationId || r.card.id}`}
            >
              <div className="import-card-heading">
                <strong>
                  {r.card.kind === "cancel"
                    ? "취소"
                    : r.type === "update"
                      ? "변경"
                      : "예약"}{" "}
                  · {r.card.item?.platform} #
                  {r.card.item?.reservationId || "번호 확인"}
                </strong>
                <button
                  type="button"
                  className="import-remove"
                  disabled={locked}
                  aria-label={`대기 항목 삭제 ${r.card.id}`}
                  onClick={() => {
                    setQueue((all) =>
                      all.filter((card) => card.id !== r.card.id),
                    );
                    setAllowOverlap(false);
                    setError("");
                  }}
                >
                  삭제
                </button>
              </div>
              <p className="import-state">
                {r.label}
                {r.overlap ? " · 기간 겹침" : ""}
              </p>
              {r.card.item && (
                <p>
                  {r.card.item.name || "이름 확인"} ·{" "}
                  {r.card.item.site || "사이트 미상"} ·{" "}
                  {r.card.item.checkin || "입실일 미상"} ·{" "}
                  {r.card.item.nights || "?"}박 · {r.card.item.phone}
                </p>
              )}
              {r.errors.map((error, i) => (
                <p key={i} className="notice warning">
                  {error}
                </p>
              ))}
              {r.card.warnings?.map((w) => (
                <p key={w} className="notice warning">
                  {w}
                </p>
              ))}
              {r.overlap && (
                <p className="notice warning">
                  기존 예약 또는 대기 예약과 같은 사이트의 숙박 기간이 겹칩니다.
                </p>
              )}
              {r.type === "update" && (
                <>
                  <p className="notice">
                    기존: {r.old.name} · {r.old.site} · {r.old.checkin} ·{" "}
                    {r.old.nights}박 · {r.old.phone}
                  </p>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={r.card.confirmed}
                      disabled={locked || stale}
                      onChange={(e) =>
                        change(r.card.id, { confirmed: e.target.checked })
                      }
                    />
                    기존 예약 변경 내용을 확인했습니다
                  </label>
                </>
              )}
              {r.card.kind === "cancel" && r.match.keys.length > 0 && (
                <label>
                  취소할 예약 선택{" "}
                  {r.match.isFallback && "· 보조 매칭, 직접 확인 필요"}
                  <select
                    aria-label={`취소 대상 ${r.card.id}`}
                    value={r.key}
                    disabled={locked || stale}
                    onChange={(e) =>
                      change(r.card.id, { target: e.target.value })
                    }
                  >
                    <option value="">처리하지 않음 / 대상 선택</option>
                    {r.match.keys.map((key) => (
                      <option key={key} value={key}>
                        {rawReservations[key]?.name} ·{" "}
                        {rawReservations[key]?.site} ·{" "}
                        {rawReservations[key]?.checkin} · #
                        {rawReservations[key]?.reservationId}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {r.card.kind === "reservation" && (
                <details>
                  <summary>인식한 내용 수정</summary>
                  <ReservationFields
                    value={r.card.item}
                    disabled={locked || stale}
                    lockIdentity={r.type === "update"}
                    onChange={(item) =>
                      change(r.card.id, { item, confirmed: false })
                    }
                  />
                </details>
              )}
              <details>
                <summary>원문 보기</summary>
                <pre className="import-source">{r.card.raw}</pre>
              </details>
            </article>
          ))}
          <div className="import-save-bar">
            {overlap && (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={allowOverlap}
                  disabled={locked || stale}
                  onChange={(e) => setAllowOverlap(e.target.checked)}
                />
                겹치는 예약을 확인했으며 중복 예약도 함께 기록합니다
              </label>
            )}
            {blocked && (
              <p className="notice warning">
                확인 필요 항목을 수정·확인하거나 삭제한 뒤 저장하세요.
              </p>
            )}
            <button
              className="parse-confirm-btn"
              disabled={
                locked ||
                !canWrite ||
                stale ||
                blocked ||
                !actionable.length ||
                (overlap && !allowOverlap)
              }
              onClick={save}
            >
              {locked
                ? "서버 저장 확인 중…"
                : `전체 저장 · 신규 ${counts.add}건 / 변경 ${counts.update}건 / 취소 ${counts.cancel}건`}
            </button>
            <p className="muted">
              이미 등록된 항목은 저장에서 제외합니다. 삭제는 대기 목록에만
              적용됩니다.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
