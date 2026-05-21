export default function Layout({ children }) {
  return (
    <>
      <div className="page-header">
        <h1>🏕️ 캠핑장 예약 현황판</h1>
        <p>사이트별 예약 현황을 한눈에 확인하세요</p>
      </div>
      {children}
    </>
  );
}
