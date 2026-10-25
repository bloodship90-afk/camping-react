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
                  style={{ "--reservation-rows": maxRow + 1 }}
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
                        className={`res-bar${dups.has(key) ? " is-conflict" : ""}`}
                        style={{
                          left: `calc(${startIdx}/7*100% + var(--bar-inset))`,
                          width: `calc(${span}/7*100% - 2 * var(--bar-inset))`,
                          top: `calc(var(--bar-inset) + ${rowAssign[key] || 0} * var(--reservation-row-height))`,
                          background: PLATFORM_COLOR[r.platform] || "#526677",
                          borderRadius: `${checkin >= weekDays[0] ? 5 : 0}px ${checkout <= addDays(weekDays[6], 1) ? 5 : 0}px ${checkout <= addDays(weekDays[6], 1) ? 5 : 0}px ${checkin >= weekDays[0] ? 5 : 0}px`,
                        }}
                        onClick={() => onBarClick(key)}
                        title={`${dups.has(key) ? "중복 예약 · " : ""}${r.name} · ${r.platform || "미지정"} · ${r.checkin} · ${r.nights}박`}
                        aria-label={`${dups.has(key) ? "중복 예약 " : ""}${r.name} ${r.platform || "미지정"} ${site} ${r.checkin} ${r.nights}박 상세`}
                      >
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
