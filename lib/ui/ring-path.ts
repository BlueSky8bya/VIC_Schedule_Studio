// 편집 팝오버 점선 링 — "카드 ∪ 옆에 붙은 탭"의 **바깥 윤곽 한 줄**(2026-09-17 소유자: 탭을 카드에 붙이고, 겹친 안쪽엔
// 선을 그리지 않는다). 좌표계는 SVG 자체(카드 바깥 offset만큼 여유를 둔 상자). 모든 모서리는 둥근 꺾임.
//
//   card: 카드 상자(SVG 좌표), pad: 카드에서 링까지 거리(4), cr: 링 모서리 반지름(카드 16 + pad),
//   bump: 탭이 카드 옆으로 나온 폭(0이면 그냥 둥근 사각형), tabTop/tabH: 탭의 세로 자리(카드 좌표), side: 탭이 붙은 쪽.
export type RingSpec = {
  card: { x: number; y: number; w: number; h: number };
  pad: number;
  cr: number;
  side: "left" | "right";
  bump: number;
  tabTop: number;
  tabH: number;
  bumpR?: number; // 볼록 바깥 모서리 반지름
  fillet?: number; // 카드 옆면 ↔ 볼록이 만나는 오목 모서리 반지름
};

export function ringPath(s: RingSpec): string {
  const L = s.card.x - s.pad;
  const T = s.card.y - s.pad;
  const R = s.card.x + s.card.w + s.pad;
  const B = s.card.y + s.card.h + s.pad;
  const cr = Math.min(s.cr, (R - L) / 2, (B - T) / 2);
  const bump = Math.max(0, s.bump);
  // 볼록이 부풀고 접히는 동안 모서리 반지름은 볼록 폭을 넘지 못한다 — 넘으면 제어점이 볼록 밖으로 나가 점선이
  // 카드 위/아래로 삐져나왔다(2026-09-17 소유자: "숨을 때 점선이 팝오버 위쪽으로 침투"). 폭과 같이 줄어 함께 사라진다.
  const f = Math.min(s.fillet ?? 6, bump);
  const r = Math.min(s.bumpR ?? 10, bump);
  // 볼록 구간(링 좌표): 탭 위아래로 pad만큼 넓힌다. 카드 모서리 호와 겹치지 않게 안쪽으로 밀어 넣는다.
  let y1 = s.card.y + s.tabTop - s.pad;
  let y2 = y1 + s.tabH + s.pad * 2;
  const minY = T + cr + f;
  const maxY = B - cr - f;
  if (y1 < minY) {
    y2 += minY - y1;
    y1 = minY;
  }
  if (y2 > maxY) {
    y1 -= y2 - maxY;
    y2 = maxY;
  }
  const hasBump = bump > 0.5 && y2 - y1 > 2 * r + 2;
  // 볼록 구간 세로 범위는 링 안쪽(모서리 호 밖)에 있어야 한다 — 위/아래 모서리를 침범하면 선이 겹친다.
  const p: string[] = [];
  // 시계 방향: 윗변 → 오른변 → 아랫변 → 왼변.
  p.push(`M ${L + cr} ${T}`);
  p.push(`H ${R - cr}`);
  p.push(`Q ${R} ${T} ${R} ${T + cr}`);
  if (hasBump && s.side === "right") {
    const X = R + bump;
    p.push(`V ${y1 - f}`);
    p.push(`Q ${R} ${y1} ${R + f} ${y1}`); // 오목 꺾임(밖으로)
    p.push(`H ${X - r}`);
    p.push(`Q ${X} ${y1} ${X} ${y1 + r}`);
    p.push(`V ${y2 - r}`);
    p.push(`Q ${X} ${y2} ${X - r} ${y2}`);
    p.push(`H ${R + f}`);
    p.push(`Q ${R} ${y2} ${R} ${y2 + f}`); // 오목 꺾임(안으로)
  }
  p.push(`V ${B - cr}`);
  p.push(`Q ${R} ${B} ${R - cr} ${B}`);
  p.push(`H ${L + cr}`);
  p.push(`Q ${L} ${B} ${L} ${B - cr}`);
  if (hasBump && s.side === "left") {
    const X = L - bump;
    p.push(`V ${y2 + f}`);
    p.push(`Q ${L} ${y2} ${L - f} ${y2}`);
    p.push(`H ${X + r}`);
    p.push(`Q ${X} ${y2} ${X} ${y2 - r}`);
    p.push(`V ${y1 + r}`);
    p.push(`Q ${X} ${y1} ${X + r} ${y1}`);
    p.push(`H ${L - f}`);
    p.push(`Q ${L} ${y1} ${L} ${y1 - f}`);
  }
  p.push(`V ${T + cr}`);
  p.push(`Q ${L} ${T} ${L + cr} ${T}`);
  p.push("Z");
  return p.join(" ");
}

// 작은 스프링(프레임마다 한 스텝) — 살짝 넘쳤다 자리 잡는 애플식 감촉. k 클수록 빠르고, damp 작을수록 덜 튄다.
export function ringSpring(x: number, v: number, target: number, k = 0.16, damp = 0.72): [number, number] {
  const nv = (v + (target - x) * k) * damp;
  return [x + nv, nv];
}
