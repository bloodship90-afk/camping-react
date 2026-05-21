export default function TabNav({ tab, onChange }) {
  return (
    <div className="tab-nav">
      <button
        className={`tab-btn ${tab === "chart" ? "active" : ""}`}
        onClick={() => onChange("chart")}
      >
        📅 예약 현황판
      </button>
      <button
        className={`tab-btn ${tab === "parse" ? "active" : ""}`}
        onClick={() => onChange("parse")}
      >
        📋 카톡 예약 입력
      </button>
    </div>
  );
}
