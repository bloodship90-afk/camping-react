export default function Layout({ children, tools }) {
  return (
    <>
      <header className="page-header">
        <h1>🏕️ 캠핑장 예약 현황판</h1>
        <div className="header-tools">{tools}</div>
      </header>
      {children}
    </>
  );
}
