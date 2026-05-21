export default function StatsRow({ totalRes, occupancy, dupPairs }) {
  return (
    <div className="stats-row">
      <div className="stat-chip">
        총 예약 <span>{totalRes}</span>건
      </div>
      <div className="stat-chip">
        점유율 <span>{occupancy}%</span>
      </div>
      {dupPairs > 0 && (
        <div className="stat-chip stat-warn">
          ⚠️ 중복 <span>{dupPairs}</span>건
        </div>
      )}
    </div>
  );
}
