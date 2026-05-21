import { useEffect, useState } from "react";
import { ALL_SITES } from "../constants/sites.js";
import { PLATFORMS, PLATFORM_LABEL } from "../constants/platforms.js";

const EMPTY = {
  name: "",
  site: ALL_SITES[0],
  checkin: "",
  nights: 1,
  phone: "",
  platform: "직접예약",
};

export default function ReservationModal({
  open,
  editingKey,
  initial,
  onClose,
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    if (editingKey && initial) {
      setForm({
        name: initial.name || "",
        site: initial.site || ALL_SITES[0],
        checkin: initial.checkin || "",
        nights: initial.nights || 1,
        phone: initial.phone || "",
        platform: initial.platform || "직접예약",
      });
    } else if (initial) {
      setForm({ ...EMPTY, ...initial });
    } else {
      setForm(EMPTY);
    }
  }, [open, editingKey, initial]);

  if (!open) return null;

  const onChange = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!form.name.trim() || !form.checkin) {
      alert("이름과 체크인 날짜는 필수입니다.");
      return;
    }
    onSave({
      name: form.name.trim(),
      site: form.site,
      checkin: form.checkin,
      nights: parseInt(form.nights),
      phone: form.phone.trim(),
      platform: form.platform,
      status: "active",
    });
  };

  const handleCancel = () => {
    if (!editingKey) return;
    if (!confirm("이 예약을 취소 처리하시겠습니까?")) return;
    onCancel(editingKey);
  };

  return (
    <div
      className="modal-overlay show"
      onClick={(e) => {
        if (e.target.classList.contains("modal-overlay")) onClose();
      }}
    >
      <div className="modal">
        <h3>{editingKey ? "예약 수정" : "예약 추가"}</h3>

        <label>예약자 이름</label>
        <input
          type="text"
          value={form.name}
          onChange={onChange("name")}
          placeholder="홍길동"
        />

        <label>사이트</label>
        <select value={form.site} onChange={onChange("site")}>
          {ALL_SITES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label>체크인 날짜</label>
        <input type="date" value={form.checkin} onChange={onChange("checkin")} />

        <label>박 수</label>
        <select value={form.nights} onChange={onChange("nights")}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>
              {n}박 ({n}일)
            </option>
          ))}
        </select>

        <label>전화번호</label>
        <input
          type="tel"
          value={form.phone}
          onChange={onChange("phone")}
          placeholder="010-0000-0000"
        />

        <label>플랫폼</label>
        <select value={form.platform} onChange={onChange("platform")}>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABEL[p]}
            </option>
          ))}
        </select>

        <div className="modal-btns">
          <button className="btn-cancel" onClick={onClose}>
            취소
          </button>
          {editingKey && (
            <button className="btn-delete" onClick={handleCancel}>
              삭제
            </button>
          )}
          <button className="btn-save" onClick={handleSave}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
