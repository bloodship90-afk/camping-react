import { useMemo, useRef, useState } from "react";
import { ALL_SITES } from "../constants/sites.js";
import { dateStr, getWeekDates, toDate } from "../utils/dateUtils.js";
import { calcWeekStats, filterActive } from "../utils/reservationUtils.js";
import ReservationGrid from "./ReservationGrid.jsx";
import { downloadFile } from "../utils/exportUtils.js";
export default function ReservationBoard({
  reservations,
  today,
  editable,
  canWrite,
  onOpen,
  onAdd,
}) {
  const [selectedDate, setSelectedDate] = useState("");
  const [capturing, setCapturing] = useState(false),
    [error, setError] = useState("");
  const [captureMessage, setCaptureMessage] = useState("");
  const capture = useRef(null);
  const weekDays = useMemo(
    () => getWeekDates(0, selectedDate || today),
    [selectedDate, today],
  );
  const active = useMemo(() => filterActive(reservations), [reservations]);
  const stats = useMemo(
    () => calcWeekStats(active, weekDays, ALL_SITES.length),
    [active, weekDays],
  );
  function move(offset) {
    const d = toDate(dateStr(weekDays[0]));
    d.setDate(d.getDate() + offset * 7);
    setSelectedDate(dateStr(d));
  }
  async function saveImage() {
    if (capturing) return;
    setCapturing(true);
    setError("");
    setCaptureMessage("");
    try {
      await document.fonts?.ready;
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(capture.current, {
        backgroundColor: "#0f1923",
        scale: 2,
        windowWidth: Math.max(1000, document.documentElement.clientWidth),
        onclone: (doc) => {
          const target = doc.getElementById("captureArea");
          target.style.width = "1000px";
          const header = target.querySelector(".grid-header");
          header.style.position = "static";
          const wrap = target.querySelector(".chart-scroll");
          wrap.style.overflow = "visible";
        },
      });
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("이미지 파일을 만들 수 없습니다.");
      downloadFile(
        blob,
        `캠핑장예약_${dateStr(weekDays[0])}_${dateStr(weekDays[6])}.png`,
        "image/png",
      );
      setCaptureMessage(
        "이미지를 만들었습니다. 브라우저의 다운로드 목록을 확인하세요.",
      );
    } catch (e) {
      setError("이미지 저장 실패: " + e.message);
    } finally {
      setCapturing(false);
    }
  }
  return (
    <>
      <div className="board-toolbar">
        <button onClick={() => move(-1)}>◀ 이전 주</button>
        <button onClick={() => setSelectedDate("")}>이번 주</button>
        <button onClick={() => move(1)}>다음 주 ▶</button>
        <label>
          날짜로 이동{" "}
          <input
            type="date"
            value={selectedDate || today}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </label>
      </div>
      <div ref={capture} id="captureArea" className="capture-area">
        <h2 className="week-label">
          {dateStr(weekDays[0])} ~ {dateStr(weekDays[6])}
        </h2>
        <ReservationGrid
          weekDays={weekDays}
          activeReservations={active}
          dailyCounts={stats.dailyCounts}
          onSlotClick={editable && canWrite ? onAdd : null}
          onBarClick={onOpen}
        />
        <div className="stats-row">
          <div className="stat-chip">
            선택 주 예약 <span>{stats.weekRes}</span>건
          </div>
          <div className="stat-chip">
            사이트 점유율 <span>{stats.occupancy}%</span>
          </div>
          {stats.duplicateCount > 0 && (
            <div className="stat-chip stat-warn">
              중복 예약 {stats.duplicateCount}건 · 겹침 {stats.dupPairs}쌍
            </div>
          )}
        </div>
      </div>
      <p className="muted board-help">
        예약을 누르면 상세 정보를 확인할 수 있습니다. 작은 화면에서는 표를
        좌우로 움직여 보세요.
      </p>
      {editable && (
        <button
          className="add-btn"
          disabled={!canWrite}
          onClick={() => onAdd("A1", today)}
        >
          + 예약 추가
        </button>
      )}
      <button className="shot-btn" disabled={capturing} onClick={saveImage}>
        {capturing ? "이미지 만드는 중…" : "📷 선택 주 이미지 저장"}
      </button>
      {error && (
        <p role="alert" className="notice warning">
          {error}
        </p>
      )}
      {captureMessage && (
        <p role="status" className="notice">
          {captureMessage}
        </p>
      )}
    </>
  );
}
