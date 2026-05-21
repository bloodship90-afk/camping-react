export default function WeekNavigator({ weekDays, onPrev, onNext }) {
  const label = `${weekDays[0].getMonth() + 1}월 ${weekDays[0].getDate()}일 (월) ~ ${weekDays[6].getMonth() + 1}월 ${weekDays[6].getDate()}일 (일)`;
  return (
    <div className="week-nav">
      <button onClick={onPrev}>◀ 이전 주</button>
      <div className="week-label">{label}</div>
      <button onClick={onNext}>다음 주 ▶</button>
    </div>
  );
}
