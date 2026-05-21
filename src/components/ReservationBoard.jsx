import { useMemo, useState } from "react";
import { ALL_SITES } from "../constants/sites.js";
import { getWeekDates } from "../utils/dateUtils.js";
import {
  filterActive,
  detectDuplicates,
  calcOccupancy,
} from "../utils/reservationUtils.js";
import WeekNavigator from "./WeekNavigator.jsx";
import ReservationGrid from "./ReservationGrid.jsx";
import StatsRow from "./StatsRow.jsx";
import ReservationModal from "./ReservationModal.jsx";

export default function ReservationBoard({
  reservations,
  addReservation,
  updateReservation,
  cancelReservation,
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [modal, setModal] = useState({
    open: false,
    editingKey: null,
    initial: null,
  });

  const weekDays = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const activeReservations = useMemo(
    () => filterActive(reservations),
    [reservations]
  );

  // 통계 — 전체 사이트 기준 중복 개수 합산
  const stats = useMemo(() => {
    let totalRes = 0;
    let dupPairs = 0;
    ALL_SITES.forEach((site) => {
      const siteRes = Object.entries(activeReservations).filter(
        ([, r]) => r.site === site
      );
      totalRes += siteRes.length;
      const { dupPairs: dp } = detectDuplicates(siteRes);
      dupPairs += dp;
    });
    const { occupancy } = calcOccupancy(
      activeReservations,
      weekDays,
      ALL_SITES.length
    );
    return { totalRes, dupPairs, occupancy };
  }, [activeReservations, weekDays]);

  const openAdd = (site, date) =>
    setModal({
      open: true,
      editingKey: null,
      initial: site || date ? { site, checkin: date } : null,
    });

  const openEdit = (key) =>
    setModal({
      open: true,
      editingKey: key,
      initial: reservations[key] || null,
    });

  const closeModal = () =>
    setModal({ open: false, editingKey: null, initial: null });

  const handleSave = async (data) => {
    try {
      if (modal.editingKey) {
        await updateReservation(modal.editingKey, data);
      } else {
        await addReservation(data);
      }
      closeModal();
    } catch {
      // alert 은 훅에서 처리
    }
  };

  const handleCancel = async (key) => {
    try {
      await cancelReservation(key);
      closeModal();
    } catch {
      /* alert in hook */
    }
  };

  // TODO(이미지 저장): html2canvas 동적 import 로 복원 가능.
  // 현재는 빌드 안정성 우선 — 추후 별도 컴포넌트로 분리 예정.
  const saveImage = async () => {
    try {
      const mod = await import("html2canvas");
      const html2canvas = mod.default;
      const target = document.getElementById("chartWrap");
      if (!target) return;
      const canvas = await html2canvas(target, {
        backgroundColor: "#16232f",
        scale: 2,
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `캠핑장예약_${new Date().toLocaleDateString("ko-KR")}.png`;
      a.click();
    } catch (e) {
      alert(
        "이미지 저장은 추후 활성화됩니다. (html2canvas 패키지 설치 필요)\n" +
          e.message
      );
    }
  };

  return (
    <>
      <WeekNavigator
        weekDays={weekDays}
        onPrev={() => setWeekOffset((o) => o - 1)}
        onNext={() => setWeekOffset((o) => o + 1)}
      />
      <ReservationGrid
        weekDays={weekDays}
        activeReservations={activeReservations}
        onSlotClick={openAdd}
        onBarClick={openEdit}
      />
      <StatsRow
        totalRes={stats.totalRes}
        occupancy={stats.occupancy}
        dupPairs={stats.dupPairs}
      />
      <button className="add-btn" onClick={() => openAdd()}>
        + 예약 추가
      </button>
      <button className="shot-btn" onClick={saveImage}>
        📷 이미지 저장
      </button>

      <ReservationModal
        open={modal.open}
        editingKey={modal.editingKey}
        initial={modal.initial}
        onClose={closeModal}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </>
  );
}
