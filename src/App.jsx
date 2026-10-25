import { useMemo, useState } from "react";
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
    [editable, setEditable] = useState(false),
    [modal, setModal] = useState(null),
    [listMode, setListMode] = useState(false);
  const records = useMemo(
    () => inspectReservations(store.reservations),
    [store.reservations],
  );
  const issues = Object.values(records).filter((r) => r._issues.length).length;
  const canWrite = editable && store.canWrite;
  function open(key) {
    setModal({ key, initial: records[key], raw: store.reservations[key] });
  }
  function add(site, checkin) {
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
  return (
    <Layout>
      {store.isDemo && (
        <p className="notice">
          체험 모드 · 예시 데이터로 동작하며 새로고침하면 초기화됩니다.
        </p>
      )}
      <div className="app-toolbar">
        <div className="connection" role="status">
          {store.saving
            ? store.connected
              ? "서버 저장 확인 중…"
              : "연결 끊김 · 저장 대기 중, 창을 닫지 마세요"
            : store.loading
              ? "예약 불러오는 중…"
              : store.connected
                ? "● 연결됨"
                : "○ 연결 확인 필요"}
          {store.lastReceived && (
            <small>
              마지막 데이터 수신{" "}
              {new Date(store.lastReceived).toLocaleTimeString("ko-KR")}
            </small>
          )}
        </div>
        <button
          disabled={store.saving}
          className={editable ? "mode-button editing" : "mode-button"}
          onClick={() => setEditable((v) => !v)}
        >
          {editable ? "편집 모드 · 보기로 전환" : "보기 모드 · 편집하기"}
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
      </div>
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
      {store.message && (
        <p role="status" className="notice">
          {store.message}
        </p>
      )}
      {issues > 0 && (
        <p className="notice warning">
          확인할 예약 {issues}건이 있습니다.{" "}
          <button
            onClick={() => {
              setListMode(true);
              setTab("list");
            }}
          >
            문제 항목 보기
          </button>
        </p>
      )}
      <nav className="tab-nav" aria-label="주요 화면">
        {[
          ["chart", "📅 예약 현황판"],
          ["list", "📋 예약 목록"],
          ...(editable ? [["parse", "💬 카톡 가져오기"]] : []),
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
      {!editable && tab === "parse" && (
        <p className="notice">
          보기 모드입니다.{" "}
          <button onClick={() => setTab("chart")}>현황판으로 이동</button>
        </p>
      )}
      <section hidden={tab !== "chart"} aria-label="예약 현황판">
        {store.loaded ? (
          <ReservationBoard
            reservations={records}
            today={today}
            editable={editable}
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
      <section hidden={tab !== "parse" || !editable} aria-label="카톡 가져오기">
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
          editable={editable}
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
