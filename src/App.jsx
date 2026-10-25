import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "./components/Layout.jsx";
import ReservationBoard from "./components/ReservationBoard.jsx";
import ReservationList from "./components/ReservationList.jsx";
import KakaoParserPanel from "./components/KakaoParserPanel.jsx";
import ReservationModal from "./components/ReservationModal.jsx";
import { useReservations } from "./hooks/useReservations.js";
import { useDemoReservations } from "./hooks/useDemoReservations.js";
import { useToday } from "./hooks/useToday.js";
import { inspectReservations } from "./utils/reservationModel.js";
import {
  backupJSON,
  reservationsCSV,
  downloadFile,
} from "./utils/exportUtils.js";
import {
  missingFirebaseKeys,
  isFirebaseConfigured,
  initializationError,
} from "./firebase/firebaseClient.js";
const demo = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === "true";
const useStore = demo ? useDemoReservations : useReservations;
export function CampingApp({ store }) {
  const today = useToday();
  const [tab, setTab] = useState("chart"),
    [modal, setModal] = useState(null),
    [listMode, setListMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState(""),
    [captureRequest, setCaptureRequest] = useState(0);
  const [showMessage, setShowMessage] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef(null);
  const records = useMemo(
    () => inspectReservations(store.reservations),
    [store.reservations],
  );
  const issues = Object.values(records).filter((r) => r._issues.length).length;
  const canWrite = store.canWrite;
  useEffect(() => {
    setShowMessage(!!store.message);
    if (!store.message) return;
    const timer = setTimeout(() => setShowMessage(false), 3500);
    return () => clearTimeout(timer);
  }, [store.message]);
  useEffect(() => {
    const closeOutside = (event) => {
      if (menu.current && !menu.current.contains(event.target))
        setMenuOpen(false);
    };
    const escape = (event) => {
      if (
        event.key === "Escape" &&
        menu.current?.querySelector("button")?.getAttribute("aria-expanded") ===
          "true"
      ) {
        setMenuOpen(false);
        menu.current.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const closeMenu = () => {
    setMenuOpen(false);
  };
  function open(key) {
    setModal({ key, initial: records[key], raw: store.reservations[key] });
  }
  function add(site, checkin) {
    closeMenu();
    setModal({
      key: null,
      initial: {
        name: "",
        site,
        checkin,
        nights: 1,
        platform: "직접예약",
        status: "active",
      },
    });
  }
  function exportData(kind) {
    closeMenu();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadFile(
      kind === "json"
        ? backupJSON(store.reservations)
        : reservationsCSV(store.reservations),
      `캠핑장예약_${stamp}.${kind}`,
      kind === "json"
        ? "application/json;charset=utf-8"
        : "text/csv;charset=utf-8",
    );
  }
  const connectionLabel = store.saving
    ? store.connected
      ? "서버 저장 확인 중…"
      : "연결 끊김 · 저장 대기 중, 창을 닫지 마세요"
    : store.loading
      ? "예약 불러오는 중…"
      : store.connected
        ? "연결됨"
        : "연결 확인 필요";
  const tools = (
    <>
      <span
        className={`connection-dot ${store.connected ? "online" : "offline"}`}
        role="status"
        aria-label={connectionLabel}
        title={
          connectionLabel +
          (store.lastReceived
            ? " · 마지막 수신 " +
              new Date(store.lastReceived).toLocaleTimeString("ko-KR")
            : "")
        }
      />
      <div className="utility-menu" ref={menu}>
        <button
          className="utility-toggle"
          aria-label="관리 메뉴"
          title="관리 메뉴"
          aria-expanded={menuOpen}
          aria-controls="utility-actions"
          onClick={() => setMenuOpen((value) => !value)}
        >
          ⋯
        </button>
        <div
          className="utility-popover"
          id="utility-actions"
          hidden={!menuOpen}
        >
          <label>
            날짜로 이동
            <input
              type="date"
              value={selectedDate || today}
              onChange={(event) => {
                setSelectedDate(event.target.value);
                setTab("chart");
              }}
            />
          </label>
          <button
            disabled={!canWrite}
            onClick={() => add("A1", selectedDate || today)}
          >
            + 예약 추가
          </button>
          <button
            disabled={!store.loaded}
            onClick={() => {
              closeMenu();
              setTab("chart");
              setCaptureRequest((n) => n + 1);
            }}
          >
            선택 주 이미지 저장
          </button>
          <button
            disabled={!store.loaded || store.saving}
            onClick={() => exportData("json")}
          >
            JSON 백업
          </button>
          <button
            disabled={!store.loaded || store.saving}
            onClick={() => exportData("csv")}
          >
            CSV 내보내기
          </button>
          {issues > 0 && (
            <button
              onClick={() => {
                closeMenu();
                setListMode(true);
                setTab("list");
              }}
            >
              확인할 예약 {issues}건
            </button>
          )}
        </div>
      </div>
    </>
  );
  return (
    <Layout tools={tools}>
      {store.isDemo && (
        <p className="demo-note">체험 모드 · 새로고침하면 초기화됩니다.</p>
      )}
      {!store.isDemo && !isFirebaseConfigured && (
        <div role="alert" className="notice warning">
          <strong>Firebase 설정을 확인하세요.</strong>
          <p>
            {initializationError?.message ||
              ".env.local에 설정을 넣고 개발 서버를 다시 시작하세요."}
          </p>
          <p className="config-keys">{missingFirebaseKeys.join(", ")}</p>
        </div>
      )}
      {store.error && (
        <p role="alert" className="notice warning">
          데이터 연결 오류: {store.error.message}{" "}
          <button onClick={() => window.location.reload()}>다시 연결</button>
        </p>
      )}
      {!store.error && store.loaded && !store.connected && (
        <p role="alert" className="notice warning">
          {connectionLabel}. 연결이 복구되면 저장할 수 있습니다.
        </p>
      )}
      {store.saving && (
        <p role="status" className="app-toast">
          {connectionLabel}
        </p>
      )}
      {!store.saving && showMessage && (
        <p role="status" className="app-toast">
          {store.message}
        </p>
      )}
      <nav className="tab-nav" aria-label="주요 화면">
        {[
          ["chart", "예약 현황"],
          ["list", "예약 목록"],
          ["parse", "카톡 가져오기"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-current={tab === key ? "page" : undefined}
            className={`tab-btn ${tab === key ? "active" : ""}`}
            onClick={() => {
              setTab(key);
              if (key === "list") setListMode(false);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <section hidden={tab !== "chart"} aria-label="예약 현황판">
        {store.loaded ? (
          <ReservationBoard
            reservations={records}
            today={today}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            captureRequest={captureRequest}
            canWrite={canWrite}
            onOpen={open}
            onAdd={add}
          />
        ) : (
          <p className="empty-state">
            {store.loading
              ? "예약 정보를 불러오고 있습니다."
              : "연결 후 예약 현황을 확인할 수 있습니다."}
          </p>
        )}
      </section>
      <section hidden={tab !== "list"} aria-label="예약 목록">
        {store.loaded ? (
          <ReservationList
            key={String(listMode)}
            issuesOnly={listMode}
            reservations={records}
            today={today}
            onOpen={open}
          />
        ) : (
          <p className="empty-state">
            예약 정보를 불러온 뒤 목록을 표시합니다.
          </p>
        )}
      </section>
      <section hidden={tab !== "parse"} aria-label="카톡 가져오기">
        <KakaoParserPanel
          reservations={records}
          rawReservations={store.reservations}
          canWrite={canWrite}
          saving={store.saving}
          onCommit={store.commit}
        />
      </section>
      {modal && (
        <ReservationModal
          key={modal.key || "new"}
          recordKey={modal.key}
          initial={modal.initial}
          raw={modal.raw}
          records={records}
          editable
          canWrite={canWrite}
          saving={store.saving}
          onCommit={store.commit}
          onClose={() => setModal(null)}
        />
      )}
    </Layout>
  );
}
export default function App() {
  const store = useStore();
  return <CampingApp store={store} />;
}
