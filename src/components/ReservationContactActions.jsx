import { contactLinks } from "../utils/contactLinks.js";
import "./ReservationContactActions.css";

export default function ReservationContactActions({ phone, disabled = false }) {
  const links = contactLinks(phone);
  return (
    <div className="reservation-contact-actions" aria-label="예약자 연락">
      {[
        { key: "call", label: "전화하기", icon: "📞" },
        { key: "sms", label: "문자 보내기", icon: "💬" },
      ].map(({ key, label, icon }) =>
        links && !disabled ? (
          <a key={key} className="reservation-contact-action" href={links[key]}>
            <span aria-hidden="true">{icon}</span>
            {label}
          </a>
        ) : (
          <button
            key={key}
            className="reservation-contact-action"
            type="button"
            disabled
            title={
              disabled
                ? "저장 중에는 사용할 수 없습니다."
                : "사용할 수 있는 전화번호가 없습니다."
            }
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </button>
        ),
      )}
    </div>
  );
}
