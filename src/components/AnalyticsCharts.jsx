import { useEffect, useRef, useId } from "react";
const colors = ["#00d4aa", "#5e9eff", "#ffbe6b", "#b796ff", "#f286aa"];
const num = (v) =>
  Number(v || 0).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
export function Bars({ title, items, unit = "건", max }) {
  const scale = max || Math.max(1, ...items.map((i) => i.value));
  return (
    <figure className="stats-chart" aria-label={title}>
      <figcaption>{title}</figcaption>
      {items.length ? (
        <div className="stats-bars">
          {items.map((item, i) => (
            <div className="stats-bar-row" key={item.label}>
              <span>{item.label}</span>
              <div className="stats-bar-track">
                <span
                  style={{
                    width: `${Math.min(100, (Math.max(0, item.value) / scale) * 100)}%`,
                    background: item.color || colors[i % colors.length],
                  }}
                />
              </div>
              <strong>
                {num(item.value)}
                {unit}
              </strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="analytics-caption">집계할 기록이 없습니다.</p>
      )}
    </figure>
  );
}
export function Donut({ title, items, unit = "건" }) {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  let offset = 0;
  const slices = items.map((item, i) => {
    const begin = offset;
    offset += total ? (item.value / total) * 100 : 0;
    return `${item.color || colors[i % colors.length]} ${begin}% ${offset}%`;
  });
  return (
    <figure className="stats-chart" aria-label={title}>
      <figcaption>{title}</figcaption>
      <div className="stats-donut-layout">
        <div
          className="stats-donut"
          role="img"
          aria-label={`${title}: ${items.map((i) => `${i.label} ${num(i.value)}${unit}`).join(", ")}`}
          style={{
            background: total
              ? `conic-gradient(${slices.join(",")})`
              : "var(--border)",
          }}
        >
          <div>
            <strong>{num(total)}</strong>
            <small>{unit}</small>
          </div>
        </div>
        <ul className="stats-legend">
          {items.map((item, i) => (
            <li key={item.label}>
              <i
                style={{ background: item.color || colors[i % colors.length] }}
              />
              <span>{item.label}</span>
              <strong>
                {num(item.value)}
                {unit}{" "}
                <small>{total ? num((item.value / total) * 100) : 0}%</small>
              </strong>
            </li>
          ))}
        </ul>
      </div>
      {!total && <p className="analytics-caption">집계할 기록이 없습니다.</p>}
    </figure>
  );
}
export function CamperDialog({ name, onClose, children }) {
  const ref = useRef(null),
    title = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => {
      dialog.close?.();
      previous?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="camper-dialog"
      aria-modal="true"
      aria-labelledby={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="camper-dialog-content">
        <header>
          <div>
            <small>CAMPER PROFILE</small>
            <h2 id={title}>{name} · 캠퍼 상세</h2>
          </div>
          <button autoFocus onClick={onClose} aria-label="캠퍼 상세 닫기">
            닫기 ×
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
