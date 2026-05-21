import { SITES } from "../constants/sites.js";
import { PLATFORM_COLOR } from "../constants/platforms.js";
import { dateStr, DAY_KO } from "../utils/dateUtils.js";
import {
  detectDuplicates,
  buildBarList,
} from "../utils/reservationUtils.js";

export default function ReservationGrid({
  weekDays,
  activeReservations,
  dailyCounts = [],
  onSlotClick,
  onBarClick,
}) {
  const today = dateStr(new Date());

  return (
    <div className="chart-wrap" id="chartWrap">
      {/* 헤더 */}
      <div className="grid-header">
        <div className="site-header-cell">사이트</div>
        {weekDays.map((d, i) => {
          const isWeekend = i >= 5;
          const isToday = dateStr(d) === today;
          const count = dailyCounts[i] ?? 0;
          return (
            <div
              key={i}
              className={`grid-header-cell${isWeekend ? " weekend" : ""}${isToday ? " today" : ""}`}
            >
              <span className="day-num">{d.getDate()} {DAY_KO[i]}</span>
              <span className="day-count">{count}/15</span>
            </div>
          );
        })}
      </div>

      {/* 사이트별 행 */}
      <div>
        {Object.entries(SITES).map(([zone, sites]) =>
          sites.map((site, si) => {
            const isLast = si === sites.length - 1;
            const zoneClass = `zone-${zone.toLowerCase()}`;
            const sepClass = isLast ? " zone-sep" : "";

            const siteRes = Object.entries(activeReservations).filter(
              ([, r]) => r.site === site
            );

            const { dups } = detectDuplicates(siteRes);
            const { barList, rowAssign } = buildBarList(siteRes, weekDays);

            const maxRow =
              barList.length > 0
                ? Math.max(...barList.map((b) => rowAssign[b.key]))
                : 0;
            const barH = 24;
            const barGap = 4;
            const totalH = Math.max(36, (maxRow + 1) * (barH + barGap) + barGap);

            const weekStart = weekDays[0];
            const weekEnd = new Date(weekDays[6]);
            weekEnd.setDate(weekEnd.getDate() + 1);

            return (
              <div key={site} className={`site-row ${zoneClass}${sepClass}`}>
                <div className="site-label">{site}</div>
                <div
                  className="days-area"
                  style={{ minHeight: `${totalH}px` }}
                >
                  {weekDays.map((d, i) => {
                    const isWeekend = i >= 5;
                    const isToday = dateStr(d) === today;
                    return (
                      <div
                        key={i}
                        className={`day-slot${isWeekend ? " weekend" : ""}${isToday ? " today" : ""}`}
                        onClick={() => onSlotClick(site, dateStr(d))}
                      />
                    );
                  })}

                  {barList.map(({ key, r, startIdx, endIdx, span, checkin, checkout }) => {
                    const isDup = dups.has(key);
                    const color = isDup
                      ? "#c0392b"
                      : PLATFORM_COLOR[r.platform] || "#666";
                    const isStart = checkin >= weekStart;
                    const isEnd = checkout <= weekEnd;
                    const br = `${isStart ? "7px" : "0"} ${isEnd ? "7px" : "0"} ${isEnd ? "7px" : "0"} ${isStart ? "7px" : "0"}`;
                    const row = rowAssign[key] || 0;
                    const topPx = barGap + row * (barH + barGap);
                    return (
                      <div
                        key={key}
                        className="res-bar"
                        style={{
                          left: `calc(${startIdx}/7*100% + 3px)`,
                          width: `calc(${span}/7*100% - 6px)`,
                          top: `${topPx}px`,
                          height: `${barH}px`,
                          background: color,
                          borderRadius: br,
                          boxShadow: isDup
                            ? "0 0 0 2px #ff6b6b,0 2px 10px rgba(192,57,43,0.5)"
                            : undefined,
                        }}
                        title={`${isDup ? "⚠️ 중복! " : ""}${r.name} | ${r.phone || ""} | ${r.nights}박 | ${r.platform} | 체크인:${r.checkin}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onBarClick(key);
                        }}
                      >
                        {isDup ? "⚠️ " : ""}
                        {r.platform.replace("캠핑", "")}-{r.name}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
