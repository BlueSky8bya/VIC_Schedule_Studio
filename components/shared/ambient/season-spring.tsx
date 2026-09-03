// 봄(입춘~입하) — "물가의 초목". 쨍한 햇빛(火)이 아니라 나뭇잎 그림자(木)가 물 위에 어른거리는 느낌:
// 연둣빛 큰 얼룩 셋이 너울처럼 느리게 흐르고(translate — 물결 스웰과 같은 문법), 아래쪽엔 풀빛 필름이
// 옅게. 이슬은 흰 점 몇 개가 아주 천천히 숨쉰다(opacity). 전부 transform/opacity, blur 없음(그라데이션
// 자체가 흐릿하다).

// 나무 그늘(1차 실측 뒤 추가): 얼룩만으론 '초록 물'로 읽혔다 — 큰 나뭇잎 실루엣이 물 위에서 어른거려야
// '물가의 초목'. 가을 잎과 같은 형태, 훨씬 크고 옅은 청록 그림자, 더 느린 흔들림.
const LEAF = "M0,-18 C10,-14 14,-4 12,6 C10,14 4,18 0,18 C-4,18 -10,14 -12,6 C-14,-4 -10,-14 0,-18 Z";
const SHADE: readonly { x: string; y: string; s: number; a: number; t: number; r: number; d: number; dx: number; dy: number }[] = [
  { x: "2%", y: "8%", s: 150, a: -40, t: 80, r: 44, d: -10, dx: 70, dy: 30 },
  { x: "9%", y: "58%", s: 130, a: 25, t: 92, r: 38, d: -35, dx: -60, dy: 24 },
  { x: "38%", y: "84%", s: 120, a: 70, t: 86, r: 40, d: -20, dx: 80, dy: -20 },
  { x: "70%", y: "82%", s: 160, a: -15, t: 96, r: 46, d: -50, dx: -70, dy: 22 },
  { x: "90%", y: "30%", s: 140, a: 55, t: 84, r: 42, d: -28, dx: 60, dy: 34 },
  { x: "58%", y: "12%", s: 110, a: -70, t: 90, r: 36, d: -42, dx: -50, dy: 26 }
];

const DEW: readonly { x: string; y: string; d: number }[] = [
  { x: "12%", y: "34%", d: -1 },
  { x: "31%", y: "81%", d: -4 },
  { x: "57%", y: "22%", d: -2.5 },
  { x: "73%", y: "66%", d: -6 },
  { x: "88%", y: "40%", d: -3.5 },
  { x: "44%", y: "56%", d: -5 }
];

export function SeasonSpring() {
  return (
    <div className="gs-season gs-season-spring" data-season="spring" aria-hidden="true">
      <div className="gs-dapple gs-dapple-a" />
      <div className="gs-dapple gs-dapple-b" />
      <div className="gs-dapple gs-dapple-c" />
      <div className="gs-grass" />
      {SHADE.map((l, i) => (
        <span
          className="gs-leaf gs-shade"
          key={`s${i}`}
          style={
            {
              "--x": l.x,
              "--y": l.y,
              "--s": `${l.s}px`,
              "--a": `${l.a}deg`,
              "--t": `${l.t}s`,
              "--r": `${l.r}s`,
              "--d": `${l.d}s`,
              "--dx": `${l.dx}px`,
              "--dy": `${l.dy}px`
            } as React.CSSProperties
          }
        >
          <svg viewBox="-20 -22 40 44" focusable="false">
            <path d={LEAF} fill="#2f5a3c" />
          </svg>
        </span>
      ))}
      {DEW.map((p, i) => (
        <i className="gs-dew" key={i} style={{ "--x": p.x, "--y": p.y, "--d": `${p.d}s` } as React.CSSProperties} />
      ))}
    </div>
  );
}
