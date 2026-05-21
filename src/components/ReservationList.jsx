import { useState, useMemo } from "react";
import { PLATFORMS, PLATFORM_COLOR } from "../constants/platforms.js";
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

// TODO: ReservationModal 연동
// 클릭 시 기존 ReservationModal을 열어 수정/취소할 수 있도록 구현 예정.
// App.jsx에서 updateReservation / cancelReservation 콜백을 함께 props로 전달해야 함.
// 기존 ReservationBoard와 모달 공유 구조 설계 후 추가 구현.

const SORT_OPTIONS = [
  { value: "checkin_asc", label: "입실일 빠른순" },
  { value: "checkin_desc", label: "입실일 늦은순" },
  { value: "name_asc", label: "이름순" },
  { value: "platform_asc", label: "플랫폼순" },
  { value: "site_asc", label: "사이트순" },
];

const EMPTY_FILTERS = {
  name: "",
  phone: "",
  platform: "전체",
  status: "전체",
  checkinDate: "",
  rangeStart: "",
  rangeEnd: "",
};

function fmtCancelledAt(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function ReservationList({ reservations, loading }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState("checkin_asc");
  // showPast: 필터 초기화와 독립적으로 유지 (뷰 모드 설정)
  const [showPast, setShowPast] = useState(false);

  const allList = useMemo(() => toListArray(reservations), [reservations]);

  // 방문 횟수 맵: 필터와 무관하게 전체 데이터 기준으로 계산
  const visitCountMap = useMemo(() => buildVisitCountMap(allList), [allList]);

  const filtered = useMemo(
    () => applySort(applyFilters(allList, filters, showPast), sortKey),
    [allList, filters, showPast, sortKey]
  );

  function setFilter(key, val) {
    setFilters((prev) => ({ ...prev, [key]: val }));
  }

  function applyQuickRange({ start, end }) {
    setFilters((prev) => ({ ...prev, checkinDate: "", rangeStart: start, rangeEnd: end }));
  }

  // clearAll은 showPast를 건드리지 않음 (뷰 모드는 유지)
  function clearAll() {
    setFilters(EMPTY_FILTERS);
  }

  const hasFilter =
    filters.name ||
    filters.phone ||
    filters.platform !== "전체" ||
    filters.status !== "전체" ||
    filters.checkinDate ||
    filters.rangeStart ||
    filters.rangeEnd;

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
        로딩 중...
      </div>
    );
  }

  return (
    <div className="rl-wrap">
      {/* 필터 패널 */}
      <div className="rl-filter-panel">
        {/* 행 1: 텍스트 검색 + 셀렉트 필터 */}
        <div className="rl-filter-row">
          <input
            className="rl-input"
            type="text"
            placeholder="🔍 이름 검색"
            value={filters.name}
            onChange={(e) => setFilter("name", e.target.value)}
          />
          <input
            className="rl-input"
            type="text"
            placeholder="📞 전화번호 검색"
            value={filters.phone}
            onChange={(e) => setFilter("phone", e.target.value)}
          />
          <select
            className="rl-select"
            value={filters.platform}
            onChange={(e) => setFilter("platform", e.target.value)}
          >
            <option value="전체">전체 플랫폼</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            className="rl-select"
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}
          >
            <option value="전체">전체 상태</option>
            <option value="active">예약중만</option>
            <option value="cancelled">취소만</option>
          </select>
        </div>

        {/* 행 2: 날짜 필터 */}
        <div className="rl-filter-row rl-filter-row--dates">
          <div className="rl-date-group">
            <span className="rl-date-label">입실일</span>
            <input
              className="rl-input rl-input--date"
              type="date"
              value={filters.checkinDate}
              onChange={(e) => setFilter("checkinDate", e.target.value)}
            />
          </div>
          <div className="rl-date-group">
            <span className="rl-date-label">기간</span>
            <input
              className="rl-input rl-input--date"
              type="date"
              value={filters.rangeStart}
              onChange={(e) => setFilter("rangeStart", e.target.value)}
            />
            <span className="rl-date-sep">~</span>
            <input
              className="rl-input rl-input--date"
              type="date"
              value={filters.rangeEnd}
              onChange={(e) => setFilter("rangeEnd", e.target.value)}
            />
          </div>
        </div>

        {/* 행 3: 빠른 필터 + 지난 예약 토글 + 정렬 */}
        <div className="rl-filter-row rl-filter-row--actions">
          <div className="rl-quick-btns">
            <button className="rl-quick-btn" onClick={() => applyQuickRange(getThisWeekRange())}>
              이번 주
            </button>
            <button className="rl-quick-btn" onClick={() => applyQuickRange(getThisMonthRange())}>
              이번 달
            </button>
            <button className="rl-quick-btn" onClick={() => applyQuickRange(getNextMonthRange())}>
              다음 달
            </button>
            <button className="rl-quick-btn rl-quick-btn--all" onClick={clearAll}>
              전체 기간
            </button>
          </div>

          <label className="rl-toggle-label">
            <input
              type="checkbox"
              checked={showPast}
              onChange={(e) => setShowPast(e.target.checked)}
            />
            지난 예약 보기
          </label>

          <div className="rl-sort-group">
            <span className="rl-date-label">정렬</span>
            <select
              className="rl-select rl-select--sort"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {hasFilter && (
            <button className="rl-reset-btn" onClick={clearAll}>
              ✕ 필터 초기화
            </button>
          )}
        </div>

        {/* 건수 요약 */}
        <div className="rl-count">
          총 예약 <strong>{allList.length}</strong>건&nbsp;&nbsp;/&nbsp;&nbsp;현재 표시{" "}
          <strong className={filtered.length !== allList.length ? "rl-count-filtered" : ""}>
            {filtered.length}
          </strong>
          건
          {(hasFilter || !showPast) && filtered.length !== allList.length && (
            <span className="rl-count-hint">
              {!showPast && !hasFilter ? " (지난 예약 숨김)" : " (필터 적용중)"}
            </span>
          )}
        </div>
      </div>

      {/* 예약 테이블 */}
      <div className="rl-table-wrap">
        <table className="rl-table">
          <thead>
            <tr>
              <th>플랫폼</th>
              <th>사이트</th>
              <th>예약자</th>
              <th>방문</th>
              <th>전화번호</th>
              <th>입실일</th>
              <th>박수</th>
              <th>퇴실일</th>
              <th>상태</th>
              <th>예약번호</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="rl-empty">
                  {!showPast && !hasFilter
                    ? "앞으로의 예약이 없습니다. '지난 예약 보기'를 켜면 과거 예약을 확인할 수 있습니다."
                    : "조건에 맞는 예약이 없습니다."}
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const cancelled = r.status === "cancelled";
                const platformColor = PLATFORM_COLOR[r.platform] || "#7a9ab5";
                const visitCount = getVisitCount(visitCountMap, r);
                return (
                  <tr key={r._key} className={`rl-row${cancelled ? " rl-row--cancelled" : ""}`}>
                    <td>
                      <span
                        className="rl-platform-badge"
                        style={{
                          background: platformColor + "22",
                          color: platformColor,
                          borderColor: platformColor + "55",
                        }}
                      >
                        {r.platform || "—"}
                      </span>
                    </td>
                    <td className="rl-cell-site">{r.site || "—"}</td>
                    <td className="rl-cell-name">{r.name || "—"}</td>
                    <td>
                      {visitCount > 0 ? (
                        <span
                          className={`rl-visit-badge${visitCount >= 2 ? " rl-visit-badge--repeat" : ""}`}
                        >
                          {visitCount}회
                        </span>
                      ) : (
                        <span className="rl-cell-muted">—</span>
                      )}
                    </td>
                    <td className="rl-cell-phone">{r.phone || "—"}</td>
                    <td className="rl-cell-date">{r.checkin || "—"}</td>
                    <td className="rl-cell-nights">{r.nights ? `${r.nights}박` : "—"}</td>
                    <td className="rl-cell-date">{getCheckout(r) || "—"}</td>
                    <td>
                      <span
                        className={`rl-status-badge ${
                          cancelled ? "rl-status-badge--cancelled" : "rl-status-badge--active"
                        }`}
                      >
                        {cancelled ? "취소됨" : "예약중"}
                      </span>
                      {cancelled && r.cancelledAt && (
                        <div className="rl-cancelled-at">{fmtCancelledAt(r.cancelledAt)}</div>
                      )}
                    </td>
                    <td className="rl-cell-id" title={r.reservationId || ""}>
                      {r.reservationId || "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
