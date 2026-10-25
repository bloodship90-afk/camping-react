import { useMemo, useState } from "react";
import { PLATFORMS } from "../constants/platforms.js";
import {
  toListArray,
  getCheckout,
  applyFilters,
  applySort,
  buildVisitCountMap,
  getVisitCount,
  getThisWeekRange,
  getThisMonthRange,
  getNextMonthRange,
} from "../utils/reservationListUtils.js";
const EMPTY = {
  name: "",
  phone: "",
  platform: "전체",
  status: "전체",
  checkinDate: "",
  rangeStart: "",
  rangeEnd: "",
  rangeMode: "stay",
};
export default function ReservationList({
  reservations,
  today,
  onOpen,
  issuesOnly = false,
}) {
  const [filters, setFilters] = useState({
    ...EMPTY,
    status: issuesOnly ? "issues" : "전체",
  });
  const [sort, setSort] = useState("checkin_asc"),
    [showPast, setShowPast] = useState(issuesOnly);
  const all = useMemo(() => toListArray(reservations), [reservations]);
  const visits = useMemo(() => buildVisitCountMap(all, today), [all, today]);
  const shown = useMemo(
    () => applySort(applyFilters(all, filters, showPast, today), sort),
    [all, filters, showPast, today, sort],
  );
  const change = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const range = (value) => {
    setFilters((f) => ({
      ...f,
      checkinDate: "",
      rangeStart: value.start,
      rangeEnd: value.end,
    }));
    setShowPast(true);
  };
  return (
    <div className="rl-wrap">
      <div className="rl-filter-panel">
        <div className="rl-filter-row">
          <label>
            이름 검색
            <input
              className="rl-input"
              value={filters.name}
              onChange={(e) => change("name", e.target.value)}
            />
          </label>
          <label>
            전화번호 검색
            <input
              className="rl-input"
              value={filters.phone}
              onChange={(e) => change("phone", e.target.value)}
            />
          </label>
          <label>
            플랫폼
            <select
              className="rl-select"
              value={filters.platform}
              onChange={(e) => change("platform", e.target.value)}
            >
              <option value="전체">전체 플랫폼</option>
              {PLATFORMS.map((p) => (
                <option key={p}>{p}</option>
              ))}
              <option value="">미지정</option>
            </select>
          </label>
          <label>
            상태
            <select
              className="rl-select"
              value={filters.status}
              onChange={(e) => {
                change("status", e.target.value);
                if (["issues", "cancelled"].includes(e.target.value))
                  setShowPast(true);
              }}
            >
              <option value="전체">전체 상태</option>
              <option value="active">예약중</option>
              <option value="cancelled">취소됨</option>
              <option value="issues">확인 필요</option>
            </select>
          </label>
        </div>
        <div className="rl-filter-row">
          <label>
            입실일
            <input
              type="date"
              className="rl-input"
              value={filters.checkinDate}
              onChange={(e) => change("checkinDate", e.target.value)}
            />
          </label>
          <label>
            기간 기준
            <select
              className="rl-select"
              value={filters.rangeMode}
              onChange={(e) => change("rangeMode", e.target.value)}
            >
              <option value="stay">기간 중 숙박</option>
              <option value="checkin">기간 중 입실</option>
            </select>
          </label>
          <label>
            시작일
            <input
              type="date"
              className="rl-input"
              value={filters.rangeStart}
              onChange={(e) => change("rangeStart", e.target.value)}
            />
          </label>
          <label>
            종료일
            <input
              type="date"
              className="rl-input"
              value={filters.rangeEnd}
              onChange={(e) => change("rangeEnd", e.target.value)}
            />
          </label>
        </div>
        {filters.rangeStart &&
          filters.rangeEnd &&
          filters.rangeStart > filters.rangeEnd && (
            <p role="alert" className="notice warning">
              시작일이 종료일보다 늦습니다.
            </p>
          )}
        <div className="rl-filter-row">
          <button onClick={() => range(getThisWeekRange(today))}>
            이번 주
          </button>
          <button onClick={() => range(getThisMonthRange(today))}>
            이번 달
          </button>
          <button onClick={() => range(getNextMonthRange(today))}>
            다음 달
          </button>
          <button
            onClick={() => {
              setFilters((f) => ({
                ...f,
                checkinDate: "",
                rangeStart: "",
                rangeEnd: "",
              }));
              setShowPast(true);
            }}
          >
            전체 기간
          </button>
          <button
            onClick={() => {
              setFilters(EMPTY);
              setShowPast(false);
            }}
          >
            전체 필터 초기화
          </button>
        </div>
        <div className="rl-filter-row">
          <label className="check-label">
            <input
              type="checkbox"
              checked={showPast}
              onChange={(e) => setShowPast(e.target.checked)}
            />
            지난 예약 포함 (오늘 퇴실은 항상 포함)
          </label>
          <label>
            정렬
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="checkin_asc">입실 빠른순</option>
              <option value="checkin_desc">입실 늦은순</option>
              <option value="name_asc">이름순</option>
              <option value="site_asc">사이트순</option>
              <option value="platform_asc">플랫폼순</option>
            </select>
          </label>
        </div>
        <p>
          전체 {all.length}건 · 표시 {shown.length}건
        </p>
        <p className="muted">
          지난 숙박은 오늘 이전에 퇴실한 예약 건수입니다. 미래 예약·취소 예약은
          제외하며 실제 방문 확인 기록과는 다를 수 있습니다.
        </p>
      </div>
      <div className="rl-table-wrap">
        <table className="rl-table">
          <thead>
            <tr>
              {[
                "사이트",
                "예약자 / 상세",
                "입실 → 퇴실",
                "박수",
                "전화번호",
                "플랫폼",
                "지난 숙박",
                "상태",
                "예약번호",
              ].map((t) => (
                <th key={t}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!shown.length && (
              <tr>
                <td colSpan={9} className="rl-empty">
                  조건에 맞는 예약이 없습니다.
                </td>
              </tr>
            )}
            {shown.map((r) => (
              <tr
                key={r._key}
                className={r.status === "cancelled" ? "rl-row--cancelled" : ""}
              >
                <td>{r.site || "미지정"}</td>
                <td>
                  <button
                    className="text-button"
                    onClick={() => onOpen(r._key)}
                  >
                    {r.name || "이름 없음"}
                  </button>
                  {r._issues?.length > 0 && (
                    <p className="issue-label">확인 필요</p>
                  )}
                </td>
                <td className="rl-cell-date">
                  {r.checkin || "미지정"}
                  <br />→ {getCheckout(r) || "확인 필요"}
                </td>
                <td>{r.nights}박</td>
                <td className="rl-cell-phone">{r.phone || "—"}</td>
                <td>{r.platform || "미지정"}</td>
                <td>{getVisitCount(visits, r)}건</td>
                <td>{r.status === "cancelled" ? "취소됨" : "예약중"}</td>
                <td>{r.reservationId || "직접 입력"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
