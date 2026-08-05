// 일정 그림판 '색 채우기'(페인트 통)의 순수 알고리즘 — DOM/캔버스 API를 모른다(vitest로 검증).
//
// 판서 엔진은 stroke '명령'만 저장하고 리사이즈·되돌리기 때마다 재생한다(stroke-engine 주석).
// 채우기도 같은 규약을 따른다: 찍은 점 하나를 stroke로 남기고, 재생할 때 그 시점의 픽셀 위에
// 다시 부어진다 — 그래야 되돌리기·창 크기 변경 뒤에도 결과가 같다.

export type PixelBuffer = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type FillRgba = { r: number; g: number; b: number; a: number };

/** #rgb·#rrggbb → RGBA(불투명). 못 읽으면 null(색이 이상하면 칠하지 않는다). */
export function parseHexColor(hex: string): FillRgba | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1];
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    a: 255
  };
}

function colorDistance(
  data: Uint8ClampedArray,
  i: number,
  r: number,
  g: number,
  b: number,
  a: number
): number {
  // 알파 차이를 같은 무게로 본다 — 투명한 빈 칸과 흰 획을 구분해야 선 밖으로 새지 않는다.
  return (
    Math.abs(data[i] - r) +
    Math.abs(data[i + 1] - g) +
    Math.abs(data[i + 2] - b) +
    Math.abs(data[i + 3] - a)
  );
}

/**
 * 찍은 점과 '같은 색' 영역을 색으로 채운다(4방향 스캔라인 flood fill).
 *
 * - 경계는 색이 다른 픽셀 = 사용자가 그린 선. 선이 끊겨 있으면 밖으로 샌다(그림판 공통 성질).
 * - 반투명 경계(안티앨리어싱)는 tolerance로 다 못 먹어 1px 테두리가 남는다 → 채운 영역
 *   바깥쪽으로 한 겹, **반투명 픽셀 밑에 색을 깔아** 흰 실선처럼 보이던 이음매를 없앤다.
 * - 반환값 = 실제로 칠한 픽셀 수(0이면 아무 일도 안 일어났다는 뜻 — 호출부가 기록을 남길지 정한다).
 */
export function floodFill(
  img: PixelBuffer,
  seedX: number,
  seedY: number,
  color: FillRgba,
  tolerance = 48
): number {
  const { data, width, height } = img;
  const x0 = Math.round(seedX);
  const y0 = Math.round(seedY);
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return 0;

  const start = (y0 * width + x0) * 4;
  const sr = data[start];
  const sg = data[start + 1];
  const sb = data[start + 2];
  const sa = data[start + 3];
  // 이미 그 색이면 할 일이 없다(무한 재귀 방지도 겸한다).
  if (sr === color.r && sg === color.g && sb === color.b && sa === color.a) return 0;

  const filled = new Uint8Array(width * height);
  const stack: number[] = [x0, y0];
  let count = 0;

  const matches = (px: number, py: number): boolean => {
    const idx = py * width + px;
    if (filled[idx]) return false;
    return colorDistance(data, idx * 4, sr, sg, sb, sa) <= tolerance;
  };
  const paint = (px: number, py: number) => {
    const idx = py * width + px;
    const i = idx * 4;
    data[i] = color.r;
    data[i + 1] = color.g;
    data[i + 2] = color.b;
    data[i + 3] = color.a;
    filled[idx] = 1;
    count += 1;
  };

  while (stack.length > 0) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;
    if (!matches(x, y)) continue;
    // 이 줄에서 좌우로 끝까지 뻗는다(스캔라인 — 픽셀마다 스택에 넣는 방식보다 훨씬 적게 쌓인다).
    let left = x;
    while (left - 1 >= 0 && matches(left - 1, y)) left -= 1;
    let right = x;
    while (right + 1 < width && matches(right + 1, y)) right += 1;
    for (let px = left; px <= right; px += 1) {
      paint(px, y);
      // 위·아래 줄은 '칠할 수 있는 첫 픽셀'만 넣는다.
      if (y > 0 && matches(px, y - 1)) stack.push(px, y - 1);
      if (y < height - 1 && matches(px, y + 1)) stack.push(px, y + 1);
    }
  }
  if (count === 0) return 0;

  // 안티앨리어싱 이음매 메우기 — 채운 영역에 닿은 반투명 픽셀 '밑'에 색을 깐다(source-over의
  // 아래쪽에 두는 것과 같다). 선 자체는 그대로 남고, 선과 채움 사이의 흰 실선만 사라진다.
  const seam: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      if (filled[idx]) continue;
      const a = data[idx * 4 + 3];
      if (a === 0 || a === 255) continue; // 완전 투명·완전 불투명은 이음매가 아니다
      const touching =
        (x > 0 && filled[idx - 1]) ||
        (x < width - 1 && filled[idx + 1]) ||
        (y > 0 && filled[idx - width]) ||
        (y < height - 1 && filled[idx + width]);
      if (touching) seam.push(idx);
    }
  }
  for (const idx of seam) {
    const i = idx * 4;
    const af = data[i + 3] / 255; // 위에 남을 원래 픽셀의 불투명도
    const ab = color.a / 255;
    const outA = af + ab * (1 - af);
    if (outA <= 0) continue;
    for (let c = 0; c < 3; c += 1) {
      const fg = data[i + c];
      const bg = c === 0 ? color.r : c === 1 ? color.g : color.b;
      data[i + c] = Math.round((fg * af + bg * ab * (1 - af)) / outA);
    }
    data[i + 3] = Math.round(outA * 255);
  }
  return count;
}
