import { useMemo, useRef, useState } from "react";
import { push, ref, update } from "firebase/database";
import { db } from "../firebase/firebaseClient.js";
// 참고: 파싱(parseReservationMessages)은 DB 없이도 동작합니다. 저장 시에만 db 필요.
import { parseReservationMessages } from "../utils/kakaoParsers.js";
import {
  findCancelKeys,
  isDuplicateReservation,
} from "../utils/reservationUtils.js";

// debounce
function useDebouncedCallback(fn, ms) {
  const t = useRef(null);
  return (...args) => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => fn(...args), ms);
  };
}

export default function KakaoParserPanel({ reservations }) {
  const [text, setText] = useState("");
  const [parseState, setParseState] = useState({
    visible: false,
    platform: null,
    parsedItems: [],
    pendingCancels: [],
    skippedCount: 0,
    unmatchedCancels: [],
    totalFound: 0,
    warnings: [],
  });
  const [saving, setSaving] = useState(false);
  const [logMsg, setLogMsg] = useState("");
  const [doneMsg, setDoneMsg] = useState("");

  const doParse = (val) => {
    const input = (val ?? text).trim();
    if (!input) {
      setParseState((s) => ({ ...s, visible: false }));
      return;
    }
    const { platform, newItems, cancelList, warnings } =
      parseReservationMessages(input);

    if (!platform) {
      setParseState({
        visible: true,
        platform: null,
        parsedItems: [],
        pendingCancels: [],
        skippedCount: 0,
        unmatchedCancels: [],
        totalFound: 0,
        warnings,
      });
      return;
    }

    const parsedItems = newItems.filter(
      (r) => !isDuplicateReservation(reservations, r.reservationId)
    );
    const skippedCount = newItems.length - parsedItems.length;

    const pendingCancels = cancelList
      .map((c) => {
        const { keys, isFallback } = findCancelKeys(reservations, c);
        return { ...c, keys, isFallback };
      })
      .filter((c) => c.keys.length > 0);

    const unmatchedCancels = cancelList.filter(
      (c) => !pendingCancels.some((p) => p.reservationId === c.reservationId)
    );

    setParseState({
      visible: true,
      platform,
      parsedItems,
      pendingCancels,
      skippedCount,
      unmatchedCancels,
      totalFound: newItems.length + cancelList.length,
      warnings,
    });
  };

  const debouncedParse = useDebouncedCallback(doParse, 500);

  const onChangeText = (e) => {
    const v = e.target.value;
    setText(v);
    debouncedParse(v);
  };

  const confirmDisabled =
    saving ||
    (parseState.parsedItems.length === 0 &&
      parseState.pendingCancels.length === 0);

  const confirmLabel = useMemo(() => {
    if (saving) return "저장 중...";
    if (doneMsg) return doneMsg;
    const parts = [];
    if (parseState.parsedItems.length > 0)
      parts.push(`신규 ${parseState.parsedItems.length}건 저장`);
    if (parseState.pendingCancels.length > 0)
      parts.push(`취소 ${parseState.pendingCancels.length}건 처리`);
    return parts.length > 0 ? `📥 ${parts.join(" + ")}` : "처리할 내용 없음";
  }, [saving, doneMsg, parseState]);

  const doSave = async () => {
    if (confirmDisabled) return;
    if (!db) {
      alert("Firebase 가 설정되지 않아 저장할 수 없습니다. .env.local 을 확인하세요.");
      return;
    }
    setSaving(true);
    setLogMsg("");
    setDoneMsg("");
    let savedOk = 0;
    let cancelledOk = 0;

    try {
      for (const r of parseState.parsedItems) {
        if (isDuplicateReservation(reservations, r.reservationId)) {
          setLogMsg(`#${r.reservationId} 중복 스킵`);
          continue;
        }
        await push(ref(db, "reservations"), r);
        savedOk++;
        setLogMsg(`저장 중... ${savedOk}건`);
      }
      for (const c of parseState.pendingCancels) {
        for (const key of c.keys) {
          await update(ref(db, `reservations/${key}`), {
            status: "cancelled",
            cancelledAt: Date.now(),
          });
          cancelledOk++;
        }
      }
      const parts = [];
      if (savedOk > 0) parts.push(`${savedOk}건 저장`);
      if (cancelledOk > 0) parts.push(`${cancelledOk}건 취소`);
      const done = `✅ ${parts.join(" + ")} 완료!`;
      setDoneMsg(done);
      setLogMsg(`완료! ${parts.join(", ")}되었습니다.`);
      setParseState({
        visible: false,
        platform: null,
        parsedItems: [],
        pendingCancels: [],
        skippedCount: 0,
        unmatchedCancels: [],
        totalFound: 0,
        warnings: [],
      });
      setText("");
      setTimeout(() => setDoneMsg(""), 3000);
    } catch (e) {
      console.error("[doSave] failed", e);
      alert("저장 실패: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const badgeStyle = parseState.platform
    ? {
        background: "rgba(0,212,170,.15)",
        color: "var(--accent)",
        borderColor: "rgba(0,212,170,.3)",
      }
    : {
        background: "rgba(192,57,43,.15)",
        color: "#ff6b6b",
        borderColor: "rgba(192,57,43,.3)",
      };

  return (
    <div className="parse-wrap">
      <h2>📋 카톡 예약 메시지 입력</h2>
      <p>
        캠핏 또는 땡큐캠핑 카톡 메시지를 붙여넣으면 <strong>플랫폼을 자동 감지</strong>
        하여 예약을 등록하거나 <strong style={{ color: "#ff9999" }}>취소 처리</strong>
        합니다.
      </p>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 10,
          alignItems: "center",
        }}
      >
        {parseState.visible && (
          <span
            className="detected-badge"
            style={{ display: "inline-block", ...badgeStyle }}
          >
            {parseState.platform
              ? `감지: ${parseState.platform}`
              : "⚠️ 플랫폼 감지 실패"}
          </span>
        )}
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          카톡 내용 전체를 붙여넣어 주세요
        </span>
      </div>

      <textarea
        className="parse-textarea"
        value={text}
        onChange={onChangeText}
        placeholder="카카오톡 대화 내용을 여기에 붙여넣으세요..."
      />

      <div style={{ marginTop: 10 }}>
        <button className="parse-btn" onClick={() => doParse()}>
          🔍 파싱하기
        </button>
      </div>

      {parseState.visible && (
        <div className="parse-result" style={{ display: "block" }}>
          <h3>
            파싱 결과 — 신규 <span>{parseState.parsedItems.length}</span>건
          </h3>

          <div>
            {!parseState.platform && (
              <div className="parse-warn-box">
                ⚠️ 메시지 형식이 변경되었을 가능성이 있습니다.
                <br />
                캠핏 또는 땡큐캠핑 메시지인지 확인해주세요.
              </div>
            )}

            {parseState.platform && parseState.totalFound === 0 && (
              <div className="parse-warn-box">
                ⚠️ 메시지 형식이 변경되었을 가능성이 있습니다.
                <br />
                신규 예약도 취소도 인식되지 않았습니다.
              </div>
            )}

            {parseState.parsedItems.length > 0 ? (
              <>
                <div className="parse-section-label">
                  📥 신규 예약 {parseState.parsedItems.length}건
                </div>
                {[...parseState.parsedItems]
                  .sort((a, b) => a.checkin.localeCompare(b.checkin))
                  .map((r, i) => {
                    const warns = [];
                    if (!r.reservationId)
                      warns.push(
                        <span key="rid" className="parse-warn-tag">
                          ⚠️ 예약번호 없음
                        </span>
                      );
                    if (!r.site)
                      warns.push(
                        <span key="site" className="parse-warn-tag">
                          ⚠️ 사이트 인식 실패
                        </span>
                      );
                    return (
                      <div
                        key={i}
                        className={`parse-item${warns.length ? " parse-item-warn" : ""}`}
                      >
                        <span
                          className={`parse-badge badge-${r.platform === "캠핏" ? "camfit" : "thanku"}`}
                        >
                          {r.platform}
                        </span>
                        <strong>{r.checkin}</strong>
                        <span
                          style={{
                            color: "var(--accent)",
                            fontWeight: 700,
                          }}
                        >
                          {r.site || "?"}
                        </span>
                        {r.name} · {r.phone} · {r.nights}박
                        <span
                          style={{
                            color: "var(--text-muted)",
                            fontSize: 11,
                          }}
                        >
                          #{r.reservationId || "없음"}
                        </span>
                        {warns}
                      </div>
                    );
                  })}
              </>
            ) : parseState.totalFound > 0 ? (
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: 13,
                  marginBottom: 4,
                }}
              >
                신규 예약 없음
              </div>
            ) : null}

            {parseState.skippedCount > 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginTop: 6,
                }}
              >
                ⚠️ 이미 등록된 예약 {parseState.skippedCount}건 스킵
              </div>
            )}

            {(parseState.pendingCancels.length > 0 ||
              parseState.unmatchedCancels.length > 0) && (
              <>
                <div
                  className="parse-section-label"
                  style={{
                    color: "#ff7b7b",
                    borderTop: "1px solid var(--border)",
                    paddingTop: 12,
                    marginTop: 14,
                  }}
                >
                  🗑️ 취소 {parseState.pendingCancels.length}건 처리 예정
                </div>

                {parseState.pendingCancels.length === 0 ? (
                  <div className="parse-warn-box">
                    ⚠️ 취소 대상 없음 — 수동 확인 필요
                    <br />
                    현황판에 일치하는 예약이 없습니다.
                  </div>
                ) : (
                  parseState.pendingCancels.map((c, i) => (
                    <div
                      key={i}
                      className="parse-item"
                      style={{
                        borderLeft: "3px solid #c0392b",
                        paddingLeft: 8,
                      }}
                    >
                      <span
                        className="parse-badge"
                        style={{
                          background: "#c0392b22",
                          color: "#ff6b6b",
                        }}
                      >
                        취소
                      </span>
                      <strong>{c.checkin}</strong>
                      {c.name} · {c.phone}
                      <span
                        style={{
                          color: "var(--text-muted)",
                          fontSize: 11,
                        }}
                      >
                        #{c.reservationId}
                      </span>
                      <span style={{ color: "#ff6b6b", fontSize: 11 }}>
                        ({c.keys.length}건)
                      </span>
                      {c.isFallback && (
                        <span
                          className="parse-warn-tag"
                          style={{
                            background: "rgba(230,126,34,.15)",
                            color: "#e67e22",
                            borderColor: "rgba(230,126,34,.3)",
                          }}
                        >
                          보조 매칭
                        </span>
                      )}
                    </div>
                  ))
                )}

                {parseState.unmatchedCancels.map((c, i) => (
                  <div key={`u${i}`} className="parse-item parse-item-warn">
                    <span
                      className="parse-badge"
                      style={{
                        background: "#c0392b22",
                        color: "#ff6b6b",
                      }}
                    >
                      취소
                    </span>
                    <strong>{c.checkin || "날짜 없음"}</strong>
                    {c.name || "이름 없음"}
                    <span
                      style={{
                        color: "var(--text-muted)",
                        fontSize: 11,
                      }}
                    >
                      #{c.reservationId}
                    </span>
                    <span className="parse-warn-tag">
                      ⚠️ 취소 대상 없음 — 수동 확인 필요
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

          <button
            className="parse-confirm-btn"
            disabled={confirmDisabled}
            onClick={doSave}
          >
            {confirmLabel}
          </button>
          <div className="parse-log">{logMsg}</div>
        </div>
      )}
    </div>
  );
}
