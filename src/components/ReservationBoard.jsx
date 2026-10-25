import { useEffect, useMemo, useRef, useState } from "react";
import { ALL_SITES } from "../constants/sites.js";
import { PLATFORM_COLOR } from "../constants/platforms.js";
import { dateStr, getWeekDates, toDate } from "../utils/dateUtils.js";
import { calcWeekStats, filterActive } from "../utils/reservationUtils.js";
import ReservationGrid from "./ReservationGrid.jsx";
import { downloadFile } from "../utils/exportUtils.js";
export default function ReservationBoard({
  reservations,
  today,
  selectedDate = "",
  onDateChange,
  captureRequest = 0,
  canWrite,
  onOpen,
  onAdd,
}) {
  const [error, setError] = useState(""),
    [captureMessage, setCaptureMessage] = useState("");
  const capture = useRef(null),
    captureBusy = useRef(false);
  const weekDays = useMemo(
    () => getWeekDates(0, selectedDate || today),
    [selectedDate, today],
  );
  const active = useMemo(() => filterActive(reservations), [reservations]);
  const stats = useMemo(
    () => calcWeekStats(active, weekDays, ALL_SITES.length),
    [active, weekDays],
  );
  const weekLabel = `${dateStr(weekDays[0]).replaceAll("-", ".")} – ${dateStr(weekDays[6]).slice(5).replace("-", ".")}`;
  function move(offset) {
    const d = toDate(dateStr(weekDays[0]));
    d.setDate(d.getDate() + offset * 7);
    onDateChange(dateStr(d));
  }
  async function saveImage() {
    if (captureBusy.current) return;
    captureBusy.current = true;
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
          target.querySelector(".compact-week-nav").style.display = "block";
          target
            .querySelectorAll(".grid-header,.chart-sticky-heading")
            .forEach((element) => (element.style.position = "static"));
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
      setCaptureMessage("이미지를 만들었습니다. 다운로드 목록을 확인하세요.");
    } catch (e) {
      setError("이미지 저장 실패: " + e.message);
    } finally {
      captureBusy.current = false;
    }
  }
  useEffect(() => {
    if (captureRequest) void saveImage();
  }, [captureRequest]);
  useEffect(() => {
    if (!captureMessage) return;
    const timer = setTimeout(() => setCaptureMessage(""), 3500);
    return () => clearTimeout(timer);
  }, [captureMessage]);
  return (
    <>
      <div ref={capture} id="captureArea" className="capture-area">
        <div className="chart-sticky-heading">
          <div className="compact-week-nav">
            <button
              aria-label="이전 주"
              title="이전 주"
              data-html2canvas-ignore
              onClick={() => move(-1)}
            >
              ‹
            </button>
            <h2 className="week-label">
              <button
                className="week-current"
                aria-label="이번 주"
                title="이번 주로 돌아가기"
                onClick={() => onDateChange("")}
              >
                {weekLabel}
              </button>
            </h2>
            <button
              aria-label="다음 주"
              title="다음 주"
              data-html2canvas-ignore
              onClick={() => move(1)}
            >
              ›
            </button>
          </div>
          <ul className="platform-legend" aria-label="예약 플랫폼 색상 범례">
            {Object.entries(PLATFORM_COLOR).map(([platform, color]) => (
              <li key={platform}>
                <span
                  className="legend-swatch"
                  style={{ background: color }}
                  aria-hidden="true"
                />
                {platform}
              </li>
            ))}
          </ul>
        </div>
        <ReservationGrid
          weekDays={weekDays}
          activeReservations={active}
          dailyCounts={stats.dailyCounts}
          onSlotClick={canWrite ? onAdd : null}
          onBarClick={onOpen}
        />
        <div className="stats-row">
          <div className="stat-chip">
            예약 <span>{stats.weekRes}</span>건
          </div>
          <div className="stat-chip">
            점유율 <span>{stats.occupancy}%</span>
          </div>
          {stats.duplicateCount > 0 && (
            <div className="stat-chip stat-warn">
              중복 {stats.duplicateCount}건 · 겹침 {stats.dupPairs}쌍
            </div>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="app-toast warning">
          {error}
        </p>
      )}
      {captureMessage && (
        <p role="status" className="app-toast">
          {captureMessage}
        </p>
      )}
    </>
  );
}
