import { Bars, Donut, CamperDialog } from "./AnalyticsCharts.jsx";
import { PLATFORM_COLOR, PLATFORMS } from "../constants/platforms.js";
import { fields } from "../utils/reservationModel.js";
import { useMemo, useState } from "react";
import { buildAnalytics, SEASONS } from "../utils/campingAnalytics.js";
import { dateStr, toDate } from "../utils/dateUtils.js";
import "../styles/analytics.css";
const n = (value) => Number(value || 0).toLocaleString("ko-KR");
const pct = (value) => `${n(Math.round(value * 10) / 10)}%`;
function Table({ title, headers, rows, expanded = false }) {
  return (
    <section className="analytics-panel">
      <details open={expanded}>
        <summary className="stats-table-toggle">
          {title}
          <small>상세 표 보기</small>
        </summary>
        <div
          className="analytics-table-scroll"
          tabIndex={0}
          role="region"
          aria-label={title}
        >
          <table>
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={headers.length}>집계할 기록이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
export default function AnalyticsPage({ rawReservations, today }) {
  const [period, setPeriod] = useState("all"),
    [year, setYear] = useState(today.slice(0, 4));
  const [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  const [mode, setMode] = useState("completed"),
    [search, setSearch] = useState("");
  const [excludedKeys, setExcludedKeys] = useState([]),
    [selected, setSelected] = useState("");
  const [category, setCategory] = useState("overview");
  const [sort, setSort] = useState("bookings");
  const [platform, setPlatform] = useState("all");
  const [bookingGroup, setBookingGroup] = useState("all");
  const [page, setPage] = useState(1);
  const range =
    period === "year"
      ? { start: `${year}-01-01`, end: `${year}-12-31` }
      : period === "month"
        ? {
            start: today.slice(0, 7) + "-01",
            end: dateStr(
              new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0),
            ),
          }
        : period === "custom"
          ? { start, end }
          : {};
  const invalid =
    period === "custom" &&
    (!dateStr(toDate(start)) || !dateStr(toDate(end)) || start > end);
  const data = useMemo(
    () =>
      buildAnalytics(rawReservations, { today, ...range, mode, excludedKeys }),
    [rawReservations, today, range.start, range.end, mode, excludedKeys],
  );
  const camper = data.campers.find((c) => c.identity === selected);
  const years = [
    ...new Set([
      today.slice(0, 4),
      ...Object.values(rawReservations || {})
        .map((r) =>
          typeof r?.checkin === "string" ? r.checkin.slice(0, 4) : "",
        )
        .filter((y) => /^\d{4}$/.test(y)),
    ]),
  ]
    .sort()
    .reverse();
  const bookingCount = (c) =>
    c.history.filter((r) => r.status !== "cancelled").length;
  const filtered = data.campers
    .filter((c) => {
      const count = bookingCount(c);
      return (
        (c.name.includes(search.trim()) ||
          (/\d/.test(search) &&
            c.phone.replace(/\D/g, "").includes(search.replace(/\D/g, "")))) &&
        (platform === "all" ||
          c.history.some(
            (r) => r.status !== "cancelled" && r.platform === platform,
          )) &&
        (bookingGroup === "all" ||
          (bookingGroup === "one" && count === 1) ||
          (bookingGroup === "few" && count >= 2 && count <= 4) ||
          (bookingGroup === "many" && count >= 5))
      );
    })
    .sort(
      (a, b) =>
        (sort === "bookings"
          ? bookingCount(b) - bookingCount(a)
          : sort === "visits"
            ? b.visits - a.visits
            : sort === "nights"
              ? b.nights - a.nights
              : sort === "latest"
                ? b.latest.localeCompare(a.latest)
                : a.name.localeCompare(b.name)) || a.name.localeCompare(b.name),
    );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 15));
  const currentPage = Math.min(page, pageCount);
  const visibleCampers = filtered.slice(
    (currentPage - 1) * 15,
    currentPage * 15,
  );
  const s = data.summary;
  const toggle = (key) =>
    setExcludedKeys((all) =>
      all.includes(key) ? all.filter((k) => k !== key) : [...all, key],
    );
  return (
    <div className="analytics-page">
      <header className="analytics-heading">
        <div>
          <p className="analytics-eyebrow">CAMPING INSIGHTS</p>
          <h2>운영 통계</h2>
          <p>예약 기록으로 살펴보는 캠퍼와 캠핑장의 이용 흐름</p>
        </div>
        <span className="analytics-badge">조회 전용 · 원본 보존</span>
      </header>
      <div className="analytics-filters">
        <label>
          집계 기간
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="all">전체 기록 기간</option>
            <option value="year">연도 선택</option>
            <option value="month">이번 달</option>
            <option value="custom">직접 선택</option>
          </select>
        </label>
        {period === "year" && (
          <label>
            연도
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
        )}
        {period === "custom" && (
          <>
            <label>
              시작일
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              종료일
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </>
        )}
        <label>
          예약 기준
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="completed">이용 완료 예약</option>
            <option value="all">전체 예약 · 진행·예정 포함</option>
          </select>
        </label>
      </div>
      <p className="analytics-caption">
        원본 {n(data.totalRecords)}건 중 집계 가능 {n(data.included)}건 · 제외{" "}
        {n(data.excluded.length)}건 · 최초 유효 입실 기록{" "}
        {data.sourceStart || "없음"}
      </p>
      <details className="analytics-method">
        <summary>집계 기준과 제외 데이터 확인</summary>
        <p>
          이름(앞뒤 공백 제외)과 전화번호(숫자 기준)가 모두 일치하는 기록만 같은
          캠퍼로 묶습니다. 같은 전화번호에 다른 이름이 있거나 플랫폼·예약번호가
          중복되면 해당 기록을 모두 제외합니다. 전화번호가 없거나 오류가 있는
          예약은 모든 통계에서 제외하며 원본은 유지합니다. 번호의 실제 소유자는
          확인할 수 없습니다.
        </p>
        <p>
          퇴실일이 오늘 이전이거나 오늘이면 이용 완료로 간주합니다. 예약
          건수·취소율은 입실일 기준, 박수·예약률은 기간 내 실제 숙박일 기준이며
          퇴실일은 점유하지 않습니다. 방문 횟수는 같은 캠퍼의 겹치거나 연속된
          이용 완료 예약을 한 방문으로 묶습니다. 이용 박수는 사이트·박, 캠퍼
          누적 박수는 같은 날을 한 박으로 계산합니다.
        </p>
        <p>
          모든 사이트를 매일 판매 가능한 것으로 가정합니다. 주말은 금·토 숙박,
          평일은 일~목입니다. 누락된 기록이나 휴장일은 알 수 없으므로 기록이
          없는 기간이 실제 미예약을 의미하지는 않습니다. 이용 완료 모드는 오늘
          이후 날짜를 분모에서 제외합니다. 화면의 제외 선택은 새로고침하면
          초기화됩니다.
        </p>
        <Table
          title="통계 제외 내역"
          headers={["캠퍼", "제외 사유", "처리"]}
          rows={data.excluded.map((r) => [
            r.name,
            r.reason,
            excludedKeys.includes(r.key) ? (
              <button onClick={() => toggle(r.key)}>집계 제외 해제</button>
            ) : (
              "원본 유지"
            ),
          ])}
        />
        <details>
          <summary>번외 예약을 이 화면의 통계에서 제외하기</summary>
          <p>
            체크한 기록은 이 화면에서만 제외합니다. 예약 데이터는 삭제·수정하지
            않습니다.
          </p>
          <div className="analytics-exclusions">
            {Object.entries(rawReservations || {}).map(([key, r]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={excludedKeys.includes(key)}
                  onChange={() => toggle(key)}
                />
                {fields(r).name || "이름 없음"} · {fields(r).site || "—"} ·{" "}
                {fields(r).checkin || "날짜 없음"} · #
                {fields(r).reservationId || key}
              </label>
            ))}
          </div>
        </details>
      </details>
      <nav className="stats-category-nav" aria-label="통계 항목">
        {[
          ["overview", "전체 요약"],
          ["monthly", "월별 현황"],
          ["platform", "플랫폼"],
          ["sites", "사이트·구역"],
          ["seasons", "계절 트렌드"],
          ["campers", "캠퍼 정보"],
          ["insights", "숙박·재방문"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={category === key}
            aria-controls={"stats-" + key}
            onClick={() => setCategory(category === key ? "" : key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {!category && (
        <p className="analytics-caption">
          위 버튼을 눌러 필요한 항목을 펼쳐보세요.
        </p>
      )}
      {invalid ? (
        <p role="alert" className="notice warning">
          유효한 시작일과 종료일을 순서대로 선택하세요.
        </p>
      ) : (
        <>
          <p className="analytics-caption">
            {data.calendar.total
              ? `${data.from} ~ ${data.to} · ${n(data.calendar.total)}일`
              : "선택 기간에 이용 완료 집계일이 없습니다."}{" "}
            · 선택 기간 기준
          </p>
          {category === "overview" && (
            <section id="stats-overview" aria-label="전체 요약">
              <div className="analytics-kpis">
                {[
                  ["입실 예약", `${n(s.bookings)}건`],
                  ["이용 박수", `${n(s.nights)}사이트·박`],
                  ["기간 이용 캠퍼", `${n(data.campers.length)}명`],
                  [
                    "재방문 경험 캠퍼",
                    `${n(data.repeat)}명 · ${pct(data.repeatRate)}`,
                  ],
                  ["평균 예약 숙박", `${n(s.average)}박`],
                  ["취소율", `${pct(s.cancelRate)} · ${n(s.cancelled)}건`],
                  ["사이트 예약률", pct(s.occupancy)],
                  [
                    "주말 / 평일 예약률",
                    `${pct(s.weekendRate)} / ${pct(s.weekdayRate)}`,
                  ],
                ].map(([label, value]) => (
                  <article className="analytics-kpi" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </article>
                ))}
              </div>
              {data.duplicateSlots > 0 && (
                <p className="notice warning">
                  중복 점유 {n(data.duplicateSlots)}사이트·박을 발견했습니다.
                  예약 박수는 원본 합계이며, 예약률은 같은 사이트·날짜를 한 번만
                  집계합니다.
                </p>
              )}
            </section>
          )}
          {category === "monthly" && (
            <section id="stats-monthly" aria-label="월별 현황">
              <div className="stats-chart-grid">
                <Bars
                  title="월별 입실 예약"
                  items={data.monthly.map((m) => ({
                    label: m.label,
                    value: m.bookings,
                  }))}
                />
                <Bars
                  title="월별 사이트 예약률"
                  unit="%"
                  max={100}
                  items={data.monthly.map((m) => ({
                    label: m.label,
                    value: m.occupancy,
                  }))}
                />
              </div>{" "}
              <Table
                title="월별 예약 현황"
                headers={[
                  "월",
                  "입실 예약",
                  "숙박 박수",
                  "입실 캠퍼",
                  "예약률",
                  "주말 / 평일",
                  "취소",
                  "전월 예약 증감",
                  "전년 동월 증감",
                ]}
                rows={data.monthly.map((m) => {
                  const y = Number(m.label.slice(0, 4)),
                    month = Number(m.label.slice(5));
                  const prevLabel =
                    month === 1
                      ? `${y - 1}-12`
                      : `${y}-${String(month - 1).padStart(2, "0")}`;
                  const prev = data.monthly.find((p) => p.label === prevLabel),
                    last = data.monthly.find(
                      (p) => p.label === `${y - 1}-${m.label.slice(5)}`,
                    );
                  const delta = (other) =>
                    other
                      ? `${m.bookings - other.bookings > 0 ? "+" : ""}${m.bookings - other.bookings}건`
                      : "비교 기록 없음";
                  return [
                    m.label,
                    `${m.bookings}건`,
                    `${m.nights}박`,
                    `${m.campers}명`,
                    pct(m.occupancy),
                    `${pct(m.weekendRate)} / ${pct(m.weekdayRate)}`,
                    `${m.cancelled}건`,
                    delta(prev),
                    delta(last),
                  ];
                })}
              />
              <p className="analytics-caption">
                월별 비교는 선택 범위 안의 기록으로 계산합니다. 부분 월 비교는
                기간 길이가 다를 수 있습니다. 기록이 있는 달만 표시합니다.
              </p>
            </section>
          )}
          {category === "platform" && (
            <section id="stats-platform" aria-label="플랫폼 통계">
              <div className="stats-chart-grid">
                <Donut
                  title="플랫폼별 예약 비중"
                  items={data.platforms.map((p) => ({
                    label: p.label,
                    value: p.bookings,
                    color: PLATFORM_COLOR[p.label],
                  }))}
                />
                <Bars
                  title="플랫폼별 이용 박수"
                  unit="박"
                  items={data.platforms.map((p) => ({
                    label: p.label,
                    value: p.nights,
                    color: PLATFORM_COLOR[p.label],
                  }))}
                />
              </div>{" "}
              <Table
                title="예약 플랫폼 분석"
                headers={[
                  "플랫폼",
                  "입실 예약",
                  "예약 비중",
                  "박수",
                  "평균 숙박",
                  "취소율",
                  "첫 입실 캠퍼 / 재방문",
                ]}
                rows={data.platforms.map((p) => [
                  p.label,
                  `${p.bookings}건`,
                  pct(s.bookings ? (p.bookings / s.bookings) * 100 : 0),
                  `${p.nights}박`,
                  `${p.average}박`,
                  `${pct(p.cancelRate)} (${p.cancelled}건)`,
                  `${p.newCampers}명 / ${p.returning}명`,
                ])}
              />
              <details className="analytics-method">
                <summary>월별 플랫폼 유입 확인</summary>
                <Table
                  title="월별 플랫폼 예약 건수"
                  headers={["월", ...data.platforms.map((p) => p.label)]}
                  rows={data.monthly.map((m) => [
                    m.label,
                    ...data.platforms.map(
                      (p) =>
                        data.campers
                          .flatMap((c) => c.history)
                          .filter(
                            (r) =>
                              r.status !== "cancelled" &&
                              r.platform === p.label &&
                              r.checkin.slice(0, 7) === m.label &&
                              r.checkin >= data.from &&
                              r.checkin <= data.to &&
                              (mode !== "completed" || r.checkout <= today),
                          ).length,
                    ),
                  ])}
                />
              </details>
            </section>
          )}
          {category === "sites" && (
            <section id="stats-sites" aria-label="사이트 통계">
              <div className="stats-chart-grid">
                <Bars
                  title="사이트별 예약률 순위"
                  unit="%"
                  max={100}
                  items={[...data.sites]
                    .sort((a, b) => b.occupancy - a.occupancy)
                    .map((s) => ({ label: s.label, value: s.occupancy }))}
                />
                <Bars
                  title="구역별 예약률"
                  unit="%"
                  max={100}
                  items={data.groups.map((s) => ({
                    label: s.label + "구역",
                    value: s.occupancy,
                  }))}
                />
              </div>{" "}
              <Table
                title="사이트별 예약률"
                headers={[
                  "사이트",
                  "입실 예약",
                  "박수",
                  "예약률",
                  "주말",
                  "평일",
                ]}
                rows={[...data.sites]
                  .sort(
                    (a, b) =>
                      b.occupancy - a.occupancy ||
                      a.label.localeCompare(b.label),
                  )
                  .map((site) => [
                    site.label,
                    `${site.bookings}건`,
                    `${site.nights}박`,
                    <span className="analytics-meter">
                      <span style={{ width: `${site.occupancy}%` }} />
                      {pct(site.occupancy)}
                    </span>,
                    pct(site.weekendRate),
                    pct(site.weekdayRate),
                  ])}
              />
              <Table
                title="구역별 예약률"
                headers={["구역", "입실 예약", "박수", "예약률"]}
                rows={data.groups.map((g) => [
                  g.label,
                  `${g.bookings}건`,
                  `${g.nights}박`,
                  pct(g.occupancy),
                ])}
              />
              <details className="analytics-method">
                <summary>사이트별 월·계절 추이</summary>
                <Table
                  title="사이트별 월별 예약률 · 점유 박수"
                  headers={["월", ...data.sites.map((s) => s.label)]}
                  rows={data.monthly.map((m) => [
                    m.label,
                    ...data.sites.map(
                      (s) =>
                        `${pct(m.days ? ([...m.slots].filter((slot) => slot.startsWith(`${s.label}|`)).length / m.days) * 100 : 0)} · ${[...m.slots].filter((slot) => slot.startsWith(`${s.label}|`)).length}박`,
                    ),
                  ])}
                />
                <Table
                  title="사이트별 계절 예약률 · 점유 박수"
                  headers={["계절", ...data.sites.map((s) => s.label)]}
                  rows={data.seasons.map((m) => [
                    m.label,
                    ...data.sites.map(
                      (s) =>
                        `${pct(data.seasonDays[m.label] ? ([...m.slots].filter((slot) => slot.startsWith(`${s.label}|`)).length / data.seasonDays[m.label]) * 100 : 0)} · ${[...m.slots].filter((slot) => slot.startsWith(`${s.label}|`)).length}박`,
                    ),
                  ])}
                />
              </details>
            </section>
          )}
          {category === "seasons" && (
            <section id="stats-seasons" aria-label="계절 트렌드">
              <div className="stats-chart-grid">
                <Donut
                  title="계절별 숙박 비중"
                  unit="박"
                  items={data.seasons.map((s) => ({
                    label: s.label,
                    value: s.nights,
                  }))}
                />
                <Bars
                  title="계절별 입실 예약"
                  items={data.seasons.map((s) => ({
                    label: s.label,
                    value: s.bookings,
                  }))}
                />
              </div>{" "}
              <Table
                title="계절별 이용 현황"
                headers={[
                  "계절",
                  "입실 예약",
                  "숙박 박수",
                  "입실 캠퍼",
                  "재방문 경험 캠퍼",
                ]}
                rows={data.seasons.map((s) => [
                  s.label,
                  `${s.bookings}건`,
                  `${s.nights}박`,
                  `${s.campers}명`,
                  `${data.campers.filter((c) => c.visits >= 2 && c.seasonVisits[s.label] > 0).length}명 (전체 이력)`,
                ])}
              />
              <p className="analytics-caption">
                봄 3~5월 · 여름 6~8월 · 가을 9~11월 · 겨울 12~2월. 재방문 경험은
                전체 이용 완료 이력 기준입니다.
              </p>
            </section>
          )}
          {category === "campers" && (
            <section id="stats-campers" aria-label="캠퍼 정보">
              {" "}
              <section className="analytics-panel">
                <h3>캠퍼별 예약 정보</h3>
                <label className="analytics-search">
                  캠퍼 검색
                  <input
                    type="search"
                    placeholder="이름 또는 전화번호"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <p className="analytics-caption">
                  표시 대상은 기간 내 숙박 캠퍼입니다. 방문·누적 박수·계절
                  성향은 전체 이용 완료 이력 기준입니다. 이름이 같아도 번호가
                  다르면 별도 캠퍼입니다.
                </p>
                <div className="camper-controls">
                  <div
                    className="stats-filter-group"
                    role="group"
                    aria-label="캠퍼 정렬"
                  >
                    {[
                      ["bookings", "예약 수순"],
                      ["visits", "방문 수순"],
                      ["nights", "누적 박수순"],
                      ["latest", "최근 방문순"],
                      ["name", "이름순"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        aria-pressed={sort === key}
                        onClick={() => {
                          setSort(key);
                          setPage(1);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div
                    className="stats-filter-group"
                    role="group"
                    aria-label="플랫폼별 캠퍼"
                  >
                    {["all", ...PLATFORMS].map((key) => (
                      <button
                        key={key}
                        aria-pressed={platform === key}
                        onClick={() => {
                          setPlatform(key);
                          setPage(1);
                        }}
                      >
                        {key === "all" ? "모든 플랫폼" : key}
                      </button>
                    ))}
                  </div>
                  <div
                    className="stats-filter-group"
                    role="group"
                    aria-label="예약 수별 캠퍼"
                  >
                    {[
                      ["all", "예약 수 전체"],
                      ["one", "1건"],
                      ["few", "2~4건"],
                      ["many", "5건 이상"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        aria-pressed={bookingGroup === key}
                        onClick={() => {
                          setBookingGroup(key);
                          setPage(1);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="analytics-caption">
                    분류·정렬은 전체 이력의 취소되지 않은 예약 수 기준입니다.
                    플랫폼 버튼은 해당 플랫폼 이용 이력이 있는 캠퍼를
                    표시합니다. 총 {filtered.length}명 · 이름을 누르면 상세
                    정보가 열립니다.
                  </p>
                </div>
                <Table
                  expanded
                  title="캠퍼 이용 목록"
                  headers={[
                    "캠퍼 / 전화번호",
                    "전체 예약 수",
                    "기간 입실 / 박수",
                    "누적 방문 / 박수",
                    "최근 퇴실",
                    "주 이용 플랫폼",
                    "선호 계절",
                    "진행·예정",
                  ]}
                  rows={visibleCampers.map((c) => [
                    <button
                      className="analytics-camper"
                      onClick={() =>
                        setSelected(selected === c.identity ? "" : c.identity)
                      }
                      aria-expanded={selected === c.identity}
                    >
                      {c.name}
                      <small>{c.phone}</small>
                    </button>,
                    `${bookingCount(c)}건`,
                    `${c.selectedBookings}건 / ${c.selectedNights}박`,
                    `${c.visits}회 / ${c.nights}박`,
                    c.latest || "—",
                    c.platforms,
                    c.preferred,
                    `${c.upcoming}건`,
                  ])}
                />
                <div className="camper-pagination">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    이전
                  </button>
                  <span role="status">
                    {currentPage} / {pageCount} 페이지 · 최대 15명씩
                  </span>
                  <button
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    다음
                  </button>
                </div>
                {camper && (
                  <CamperDialog
                    name={camper.name}
                    onClose={() => setSelected("")}
                  >
                    <p>
                      {camper.phone} · 전체 예약 {bookingCount(camper)}건 · 이용
                      완료 {camper.visits}회 / {camper.nights}박 · 진행·예정{" "}
                      {camper.upcoming}건
                    </p>
                    <Donut
                      title="캠퍼 계절별 방문 비중"
                      unit="회"
                      items={SEASONS.map((s) => ({
                        label: s,
                        value: camper.seasonVisits[s],
                      }))}
                    />
                    <h3>{camper.name} · 이용 상세</h3>

                    <p>
                      평균 방문 간격{" "}
                      {camper.gap === null
                        ? "계산할 방문 부족"
                        : `${camper.gap}일 (퇴실~다음 입실)`}{" "}
                      · 주말 {camper.weekendNights}박 / 평일{" "}
                      {camper.nights - camper.weekendNights}박 · 1회 방문당 평균{" "}
                      {camper.visits
                        ? Math.round((camper.nights / camper.visits) * 10) / 10
                        : 0}
                      박
                    </p>
                    <Table
                      title="계절별 방문 성향 · 전체 이력"
                      headers={["계절", "방문 횟수", "숙박 박수"]}
                      rows={SEASONS.map((s) => [
                        s,
                        `${camper.seasonVisits[s]}회`,
                        `${camper.seasonNights[s]}박`,
                      ])}
                    />
                    <Table
                      expanded
                      title="전체 예약 내역"
                      headers={[
                        "입실",
                        "퇴실",
                        "사이트",
                        "박수",
                        "플랫폼",
                        "상태",
                      ]}
                      rows={camper.history.map((r) => [
                        r.checkin,
                        r.checkout,
                        r.site,
                        `${r.nights}박`,
                        r.platform,
                        r.status === "cancelled"
                          ? "취소"
                          : r.checkout <= today
                            ? "이용 완료"
                            : r.checkin <= today
                              ? "이용 중"
                              : "예정",
                      ])}
                    />
                  </CamperDialog>
                )}
              </section>
            </section>
          )}
          {category === "insights" && (
            <section id="stats-insights" aria-label="숙박·재방문">
              <div className="stats-chart-grid">
                <Donut
                  title="숙박 길이 분포"
                  items={s.lengths.map((v, i) => ({
                    label: ["1박", "2박", "3박 이상"][i],
                    value: v,
                  }))}
                />
                <Bars
                  title="앞으로의 예약률 · 전체 기록"
                  unit="%"
                  max={100}
                  items={[
                    { label: "향후 30일", value: data.forward30 },
                    { label: "향후 60일", value: data.forward60 },
                  ]}
                />
              </div>{" "}
              <Table
                title="숙박 길이 분포 · 기간 내 입실"
                headers={["1박", "2박", "3박 이상"]}
                rows={[s.lengths.map((v) => `${v}건`)]}
              />
              <section className="analytics-panel">
                <h3>앞으로의 예약과 재방문 흐름 · 전체 기록 기준</h3>
                <p>
                  오늘부터 30일 예약률 <strong>{pct(data.forward30)}</strong> ·
                  60일 예약률 <strong>{pct(data.forward60)}</strong>
                </p>
                <p>
                  2회 이상 방문 후 180일 이상 방문하지 않았고 진행·예정 예약이
                  없는 캠퍼: {data.dormant.length}명
                </p>
                <p className="analytics-caption">
                  {data.dormant
                    .map(
                      (c) =>
                        `${c.name} (${c.visits}회 · 최근 퇴실 ${c.latest})`,
                    )
                    .join(" / ") || "해당 캠퍼 없음"}
                </p>
              </section>
            </section>
          )}{" "}
        </>
      )}
    </div>
  );
}
