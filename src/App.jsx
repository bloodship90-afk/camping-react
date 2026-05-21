import { useState } from "react";
import Layout from "./components/Layout.jsx";
import TabNav from "./components/TabNav.jsx";
import ReservationBoard from "./components/ReservationBoard.jsx";
import KakaoParserPanel from "./components/KakaoParserPanel.jsx";
import { useReservations } from "./hooks/useReservations.js";
import {
  isFirebaseConfigured,
  missingFirebaseKeys,
} from "./firebase/firebaseClient.js";

export default function App() {
  const [tab, setTab] = useState("chart");
  const {
    reservations,
    loading,
    error,
    addReservation,
    updateReservation,
    cancelReservation,
  } = useReservations();

  return (
    <Layout>
      <TabNav tab={tab} onChange={setTab} />

      {!isFirebaseConfigured && (
        <div
          style={{
            maxWidth: 700,
            margin: "0 auto 16px",
            padding: "14px 16px",
            background: "rgba(230,126,34,.12)",
            border: "1px solid rgba(230,126,34,.4)",
            borderRadius: 10,
            color: "#ffce9e",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          ⚙️ <strong>Firebase 설정이 필요합니다.</strong>
          <br />
          프로젝트 루트에 <code>.env.local</code> 파일을 만들고 아래 키를 채운 뒤
          개발 서버를 다시 시작하세요.
          <br />
          누락된 키: <strong>{missingFirebaseKeys.join(", ")}</strong>
          <br />
          <span style={{ color: "var(--text-muted)" }}>
            (값은 <code>.env.example</code> / Firebase 콘솔 → 프로젝트 설정 →
            웹 앱 에서 확인)
          </span>
        </div>
      )}

      {isFirebaseConfigured && error && (
        <div
          style={{
            maxWidth: 700,
            margin: "0 auto 16px",
            padding: "10px 14px",
            background: "rgba(192,57,43,.12)",
            border: "1px solid rgba(192,57,43,.4)",
            borderRadius: 8,
            color: "#ff8a80",
            fontSize: 13,
          }}
        >
          Firebase 연결 오류: {error.message}
        </div>
      )}

      <div
        className={`tab-content ${tab === "chart" ? "active" : ""}`}
        id="tab-chart"
      >
        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: "var(--text-muted)",
            }}
          >
            로딩 중...
          </div>
        ) : (
          <ReservationBoard
            reservations={reservations}
            addReservation={addReservation}
            updateReservation={updateReservation}
            cancelReservation={cancelReservation}
          />
        )}
      </div>

      <div
        className={`tab-content ${tab === "parse" ? "active" : ""}`}
        id="tab-parse"
      >
        <KakaoParserPanel reservations={reservations} />
      </div>
    </Layout>
  );
}
