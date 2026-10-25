import { useId } from "react";
import { ALL_SITES } from "../constants/sites.js";
import { PLATFORMS } from "../constants/platforms.js";
export default function ReservationFields({
  value,
  onChange,
  disabled = false,
  lockIdentity = false,
}) {
  const id = useId();
  const field = (key, label, type = "text", extra = {}) => (
    <label htmlFor={id + key}>
      {label}
      <input
        id={id + key}
        type={type}
        value={value[key] ?? ""}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        disabled={disabled || (lockIdentity && key === "reservationId")}
        {...extra}
      />
    </label>
  );
  return (
    <div className="reservation-fields">
      {field("name", "예약자 이름")}
      <label htmlFor={id + "site"}>
        사이트
        <select
          id={id + "site"}
          value={value.site || ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, site: e.target.value })}
        >
          <option value="">사이트 선택</option>
          {ALL_SITES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      {field("checkin", "입실일", "date")}
      {field("nights", "박수", "number", { min: 1, max: 365, step: 1 })}
      {field("phone", "전화번호", "tel")}
      <label htmlFor={id + "platform"}>
        플랫폼
        <select
          id={id + "platform"}
          value={value.platform || ""}
          disabled={disabled || lockIdentity}
          onChange={(e) => onChange({ ...value, platform: e.target.value })}
        >
          <option value="">플랫폼 선택</option>
          {PLATFORMS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      {field("reservationId", "예약번호 (직접예약은 선택)")}
    </div>
  );
}
