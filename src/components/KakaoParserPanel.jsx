import { useRef, useState } from "react";
import { parseReservationMessages } from "../utils/kakaoParsers.js";
import { classifyImport, buildImportOperations } from "../utils/importPlan.js";
import { fingerprint } from "../utils/reservationModel.js";
import { findCancelKeys, conflictsFor } from "../utils/reservationUtils.js";
import ReservationFields from "./ReservationFields.jsx";
export default function KakaoParserPanel({
  reservations,
  rawReservations,
  canWrite,
  saving,
  onCommit,
}) {
  const [text, setText] = useState(""),
    [includePast, setIncludePast] = useState(false),
    [analysis, setAnalysis] = useState(null);
  const [rows, setRows] = useState([]),
    [cancels, setCancels] = useState([]),
    [allowOverlap, setAllowOverlap] = useState(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const mutex = useRef(false);
  const stale = !!analysis && analysis.version !== fingerprint(rawReservations);
  const invalidSelected =
    rows.some(
      (row) =>
        row.selected &&
        (classifyImport(rawReservations, row.item).errors.length ||
          !["add", "update"].includes(
            classifyImport(rawReservations, row.item).type,
          )),
    ) || cancels.some((c) => c.selected && !c.key);
  const selectedCount =
    rows.filter((r) => r.selected).length +
    cancels.filter((c) => c.selected).length;
  function invalidate() {
    setAnalysis(null);
    setRows([]);
    setCancels([]);
    setMessage("");
    setError("");
    setAllowOverlap(false);
  }
  function analyze(source = text, includeOlder = includePast) {
    const parsed = parseReservationMessages(source, {
      includePast: includeOlder,
    });
    setAnalysis({ ...parsed, version: fingerprint(rawReservations) });
    setMessage("");
    setError("");
    setAllowOverlap(false);
    setRows(
      parsed.newItems.map((item) => {
        const c = classifyImport(rawReservations, item);
        return { item, selected: c.type === "add" && !c.errors.length };
      }),
    );
    setCancels(
      parsed.cancelList.map((item) => {
        const match = findCancelKeys(rawReservations, item);
        const automatic = match.keys.length === 1 && !match.isFallback;
        return {
          item,
          selected: automatic,
          key: automatic ? match.keys[0] : "",
          ...match,
        };
      }),
    );
  }
  async function save() {
    if (mutex.current || !analysis || stale || saving) return;
    setError("");
    if (!canWrite) {
      setError("예약 정보를 불러오고 연결이 확인된 뒤 저장하세요.");
      return;
    }
    mutex.current = true;
    try {
      const ops = buildImportOperations(
        rawReservations,
        rows,
        cancels,
        allowOverlap,
      );
      if (!ops.length) throw new Error("처리할 예약을 선택하세요.");
      await onCommit(ops);
      setAnalysis(null);
      setRows([]);
      setCancels([]);
      setMessage(
        `선택한 ${ops.length}건을 저장했습니다. 원문은 확인을 위해 남겨 두었습니다.`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      mutex.current = false;
    }
  }
  return (
    <div className="parse-wrap">
      <h2>카톡 예약 가져오기</h2>
      <p>
        캠핏·땡큐캠핑 알림을 붙여 넣으면 바로 분석합니다. 신규·변경·취소 내용을
        확인한 뒤 선택한 항목만 저장합니다.
      </p>
      <label htmlFor="kakao-input">예약 메시지 원문</label>
      <textarea
        id="kakao-input"
        className="parse-textarea"
        value={text}
        disabled={saving}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          invalidate();
          if (next.trim()) analyze(next);
        }}
        placeholder="카카오톡 예약 알림을 붙여 넣으세요"
      />
      <label className="check-label">
        <input
          type="checkbox"
          checked={includePast}
          disabled={saving}
          onChange={(e) => {
            const next = e.target.checked;
            setIncludePast(next);
            invalidate();
            if (text.trim()) analyze(text, next);
          }}
        />
        30일 이전 입실 알림도 포함
      </label>
      {!canWrite && !saving && (
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
      {analysis && (
        <div className="import-result">
          <h3>분석 결과 · 알림 {analysis.stats.found}건</h3>
          <p className="muted">
            정상 인식 {analysis.stats.ready} · 확인 필요{" "}
            {analysis.stats.invalid} · 날짜 제외 {analysis.stats.excluded} ·
            충돌 {analysis.stats.conflicts} · 반복 알림{" "}
            {analysis.stats.repeated}
          </p>
          {stale && (
            <p role="alert" className="notice warning">
              예약 데이터가 변경되었습니다. 메시지를 다시 분석해 최신 내용을
              확인하세요.
              <button
                className="parse-btn"
                disabled={saving}
                onClick={() => analyze()}
              >
                최신 내용으로 다시 분석
              </button>
            </p>
          )}
          {analysis.warnings.map((w) => (
            <p key={w} className="notice warning">
              {w}
            </p>
          ))}
          {rows.map((row, i) => {
            const c = classifyImport(rawReservations, row.item),
              blocked = ["blocked", "duplicate"].includes(c.type);
            const conflicts = conflictsFor(reservations, row.item, c.key);
            return (
              <article className="import-card" key={i}>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    disabled={saving || blocked || stale}
                    onChange={(e) =>
                      setRows((all) =>
                        all.map((r, j) =>
                          j === i ? { ...r, selected: e.target.checked } : r,
                        ),
                      )
                    }
                  />
                  <strong>
                    {row.item.platform} #{row.item.reservationId || "번호 확인"}{" "}
                    · {c.reason}
                  </strong>
                </label>
                <p>
                  {row.item.name || "이름 확인"} ·{" "}
                  {row.item.site || "사이트 확인"} ·{" "}
                  {row.item.checkin || "날짜 확인"} · {row.item.nights}박 ·{" "}
                  {row.item.phone}
                </p>
                {c.type === "update" && (
                  <p className="notice">
                    기존: {c.old.name} · {c.old.site} · {c.old.checkin} ·{" "}
                    {c.old.nights}박 · {c.old.phone}
                  </p>
                )}
                {c.errors.length > 0 && (
                  <p className="notice warning">{c.errors.join(" ")}</p>
                )}
                {conflicts.length > 0 && (
                  <p className="notice warning">
                    겹치는 예약:{" "}
                    {conflicts
                      .map(([, r]) => r.name + " " + r.checkin)
                      .join(", ")}
                  </p>
                )}
                <details>
                  <summary>인식한 내용 수정</summary>
                  <ReservationFields
                    value={row.item}
                    disabled={saving || stale}
                    lockIdentity={c.type === "update"}
                    onChange={(item) => {
                      const next = classifyImport(rawReservations, item);
                      setRows((all) =>
                        all.map((r, j) =>
                          j === i
                            ? {
                                ...r,
                                item,
                                selected:
                                  r.selected &&
                                  ["add", "update"].includes(next.type),
                              }
                            : r,
                        ),
                      );
                      setAllowOverlap(false);
                    }}
                  />
                </details>
              </article>
            );
          })}
          {cancels.map((c, i) => (
            <article className="import-card" key={"cancel-" + i}>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={c.selected}
                  disabled={saving || stale || !c.key}
                  onChange={(e) =>
                    setCancels((all) =>
                      all.map((r, j) =>
                        j === i ? { ...r, selected: e.target.checked } : r,
                      ),
                    )
                  }
                />
                <strong>
                  취소 · {c.item.platform} #
                  {c.item.reservationId || "번호 없음"}
                </strong>
              </label>
              <p>
                {c.item.name} · {c.item.checkin} · {c.item.phone}
              </p>
              {c.keys.length ? (
                <label>
                  취소할 예약 선택{" "}
                  {c.isFallback && "· 보조 매칭, 직접 확인 필요"}
                  <select
                    aria-label={`취소 대상 ${c.item.reservationId}`}
                    disabled={saving || stale}
                    value={c.key}
                    onChange={(e) =>
                      setCancels((all) =>
                        all.map((r, j) =>
                          j === i
                            ? {
                                ...r,
                                key: e.target.value,
                                selected: !!e.target.value,
                              }
                            : r,
                        ),
                      )
                    }
                  >
                    <option value="">처리하지 않음 / 대상 선택</option>
                    {c.keys.map((key) => (
                      <option key={key} value={key}>
                        {reservations[key]?.name} · {reservations[key]?.site} ·{" "}
                        {reservations[key]?.checkin} · #
                        {reservations[key]?.reservationId || "직접예약"}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="notice warning">
                  활성 예약 중 취소 대상을 찾지 못했습니다. 취소 목록과 원문을
                  확인하세요.
                </p>
              )}
            </article>
          ))}
          <label className="check-label">
            <input
              type="checkbox"
              checked={allowOverlap}
              disabled={saving || stale}
              onChange={(e) => setAllowOverlap(e.target.checked)}
            />
            겹치는 예약을 확인했으며 중복 예약도 함께 기록합니다
          </label>
          <button
            className="parse-confirm-btn"
            disabled={!canWrite || stale || invalidSelected || !selectedCount}
            onClick={save}
          >
            {saving ? "서버 저장 확인 중…" : `선택한 ${selectedCount}건 저장`}
          </button>
          <details className="diagnostics">
            <summary>인식 결과와 원문 전체 확인</summary>
            {analysis.diagnostics.map((d) => (
              <article key={d.id}>
                <strong>
                  {d.platform} ·{" "}
                  {
                    {
                      ready: "정상 인식",
                      invalid: "확인 필요",
                      excluded: "날짜 제외",
                      conflict: "내용 충돌",
                      repeated: "반복 알림",
                    }[d.status]
                  }
                </strong>
                <p>{d.errors.join(" ")}</p>
                <pre>{d.raw}</pre>
              </article>
            ))}
          </details>
        </div>
      )}
    </div>
  );
}
