import { SITES, ALL_SITES } from "../constants/sites.js";
import { PLATFORM_COLOR } from "../constants/platforms.js";
import { dateStr, DAY_KO, addDays } from "../utils/dateUtils.js";
import {
  detectDuplicates,
  buildBarList,
  inWeek,
} from "../utils/reservationUtils.js";
export default function ReservationGrid({
  weekDays,
  activeReservations,
  dailyCounts = [],
  onSlotClick,
  onBarClick,
}) {
  const today = dateStr(new Date());
  const bySite = Object.fromEntries(ALL_SITES.map((site) => [site, []]));
  Object.entries(activeReservations).forEach((entry) => {
    if (bySite[entry[1].site] && inWeek(entry[1], weekDays))
      bySite[entry[1].site].push(entry);
  });
  return (
    <div className="chart-scroll">
      <div className="chart-wrap" id="chartWrap">
        <div className="grid-header">
          <div className="site-header-cell">사이트</div>
          {weekDays.map((d, i) => (
            <div
              key={i}
              className={`grid-header-cell${i >= 5 ? " weekend" : ""}${dateStr(d) === today ? " today" : ""}`}
            >
              <span className="day-num">
                {d.getDate()} {DAY_KO[i]}
              </span>
              <span className="day-count">
                {dailyCounts[i] ?? 0}/{ALL_SITES.length}
              </span>
            </div>
          ))}
        </div>
        {Object.entries(SITES).flatMap(([zone, sites]) =>
          sites.map((site, si) => {
            const entries = bySite[site],
              { dups } = detectDuplicates(entries),
              { barList, rowAssign } = buildBarList(entries, weekDays);
            const maxRow = barList.length
              ? Math.max(...Object.values(rowAssign))
              : 0;
            return (
              <div
                key={site}
                className={`site-row zone-${zone.toLowerCase()}${si === sites.length - 1 ? " zone-sep" : ""}`}
              >
                <div className="site-label">{site}</div>
                <div
                  className="days-area"
                  style={{ minHeight: Math.max(44, (maxRow + 1) * 36 + 4) }}
                >
                  {weekDays.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`day-slot${i >= 5 ? " weekend" : ""}${dateStr(d) === today ? " today" : ""}`}
                      disabled={!onSlotClick}
                      aria-label={`${site} ${dateStr(d)} 예약 추가`}
                      onClick={() => onSlotClick?.(site, dateStr(d))}
                    />
                  ))}
                  {barList.map(
                    ({ key, r, startIdx, span, checkin, checkout }) => (
                      <button
                        key={key}
                        type="button"
                        className="res-bar"
                        style={{
                          left: `calc(${startIdx}/7*100% + 3px)`,
                          width: `calc(${span}/7*100% - 6px)`,
                          top: 4 + (rowAssign[key] || 0) * 36,
                          height: 32,
                          background: dups.has(key)
                            ? "#b62e30"
                            : PLATFORM_COLOR[r.platform] || "#526677",
                          borderRadius: `${checkin >= weekDays[0] ? 7 : 0}px ${checkout <= addDays(weekDays[6], 1) ? 7 : 0}px`,
                        }}
                        onClick={() => onBarClick(key)}
                        title={`${r.name} · ${r.checkin} · ${r.nights}박`}
                        aria-label={`${dups.has(key) ? "중복 예약 " : ""}${r.name} ${site} ${r.checkin} ${r.nights}박 상세`}
                      >
                        {dups.has(key) ? "⚠ " : ""}
                        {(r.platform || "미지정").replace("캠핑", "")}-
                        {r.name || "이름 없음"}
                      </button>
                    ),
                  )}
                </div>
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
