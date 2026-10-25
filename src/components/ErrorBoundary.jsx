import { Component } from "react";
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="notice warning" role="alert">
          <h1>화면을 표시하지 못했습니다</h1>
          <p>
            예약 데이터는 그대로 보관됩니다. 화면을 다시 불러오고 문제가
            계속되면 내보낸 백업과 함께 확인해 주세요.
          </p>
          <button onClick={() => window.location.reload()}>
            다시 불러오기
          </button>
        </main>
      );
    return this.props.children;
  }
}
