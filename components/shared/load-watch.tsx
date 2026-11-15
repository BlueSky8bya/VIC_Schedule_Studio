import "./load-watch.css";

// 오래 걸리는 기다림이 '느린 것'인지 '실패한 것'인지 말해 주는 한 줄(2026-11-16 소유자: "오류가 난 건지 로딩 중인지
// 확실히 알게"). 모든 기다림 화면(뛰는 토리 — 편집실·일정표·문서·그림판)이 같은 한 벌을 쓴다(AGENTS G-18/UI-18).
// JS 없이 동작한다 — 시간 단계는 CSS 지연 애니메이션, 실패·끊김은 루트 레이아웃의 페인트 전 스크립트가 <html>에
// 다는 표시(data-load-failed: 화면 코드 파일을 못 받음, data-net-offline: 연결 끊김)로 바뀐다.
//   8초: "인터넷이 느려 조금 더 걸려요 · 멈춘 게 아니에요"  →  30초: "응답이 너무 늦어요" + 다시 불러오기
//   실패·끊김: 즉시 그 사실 + 다시 불러오기, '불러오는 중…' 문구와 토리는 멈춘다.
// '다시 불러오기'(data-load-reload)는 같은 스크립트의 클릭 위임이 새로고침한다 — 화면 코드가 안 와도 눌린다.
export const LOAD_SLOW_MS = 8000;
export const LOAD_STUCK_MS = 30000;

export function LoadWatch() {
  return (
    <div className="load-watch" data-load-watch="">
      <p className="load-watch-line load-watch-slow" role="status">
        인터넷이 느려 조금 더 걸리고 있어요 · 멈춘 게 아니에요
      </p>
      <p className="load-watch-line load-watch-stuck" role="status">
        응답이 너무 늦어요.
        <button className="load-watch-retry" data-load-reload="" type="button">
          다시 불러오기
        </button>
      </p>
      <p className="load-watch-line load-watch-failed" role="alert">
        화면을 불러오지 못했어요.
        <button className="load-watch-retry" data-load-reload="" type="button">
          다시 불러오기
        </button>
      </p>
      <p className="load-watch-line load-watch-offline" role="alert">
        인터넷 연결이 끊겼어요. 연결되면 다시 불러와 주세요.
        <button className="load-watch-retry" data-load-reload="" type="button">
          다시 불러오기
        </button>
      </p>
    </div>
  );
}
