import { describe, expect, it } from "vitest";
import {
  HYPE_WINDOW_S,
  STATIC_MOTION_FRAME,
  beatPeriodAt,
  beatWave,
  clamp01,
  hypeCalm,
  hypeEmerge,
  hypeChannels,
  hypeCssVars,
  hypeIntensity,
  hypeMotionCssVars,
  hypeMotionFrame
} from "@/lib/ui/hype-curve";

const S = (sec: number) => sec * 1000;

describe("hypeIntensity — 연속 강도 곡선", () => {
  it("하이프 창(60초) 밖은 0, 공개 시각 이후는 1", () => {
    expect(hypeIntensity(S(120))).toBe(0);
    expect(hypeIntensity(S(HYPE_WINDOW_S))).toBe(0);
    expect(hypeIntensity(0)).toBe(1);
    expect(hypeIntensity(S(-3))).toBe(1);
  });

  it("계획서 기준점과 일치한다(60/55/45/30/15/8/3/1초)", () => {
    expect(hypeIntensity(S(60))).toBeCloseTo(0, 3);
    expect(hypeIntensity(S(55))).toBeCloseTo(0.08, 3);
    expect(hypeIntensity(S(45))).toBeCloseTo(0.131, 2);
    expect(hypeIntensity(S(30))).toBeCloseTo(0.321, 2);
    expect(hypeIntensity(S(15))).toBeCloseTo(0.615, 2);
    expect(hypeIntensity(S(8))).toBeCloseTo(0.784, 2);
    expect(hypeIntensity(S(3))).toBeCloseTo(0.916, 2);
    expect(hypeIntensity(S(1))).toBeCloseTo(0.972, 2);
  });

  it("남은 시간이 줄수록 단조 증가한다(역행 없음)", () => {
    let prev = -1;
    for (let sec = 61; sec >= 0; sec -= 0.25) {
      const i = hypeIntensity(S(sec));
      expect(i).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = i;
    }
  });

  it("60초 경계에서 점프가 없다(진입이 '켜짐'으로 보이면 안 됨)", () => {
    const before = hypeIntensity(S(60.5));
    const at = hypeIntensity(S(60));
    const after = hypeIntensity(S(59.5));
    expect(Math.abs(at - before)).toBeLessThan(0.005);
    expect(Math.abs(after - at)).toBeLessThan(0.005);
  });

  it("전 구간에서 인접 샘플 차이가 작다(이산 단계 경계 없음)", () => {
    let prev = hypeIntensity(S(61));
    for (let sec = 61; sec >= 0; sec -= 0.1) {
      const cur = hypeIntensity(S(sec));
      expect(cur - prev).toBeLessThan(0.02); // 0.1초당 2% 미만
      prev = cur;
    }
  });

  it("잘못된 입력은 0으로 막는다", () => {
    expect(hypeIntensity(Number.NaN)).toBe(0);
    expect(hypeIntensity(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("hypeChannels — 채널 매핑", () => {
  it("모든 채널이 범위 안이고 단조적이다", () => {
    const at0 = hypeChannels(0);
    const at1 = hypeChannels(1);
    expect(at0.ring1).toBe(0);
    expect(at0.shakePx).toBe(0);
    expect(at0.goldMix).toBe(0);
    expect(at1.ring1).toBeGreaterThan(at0.ring1);
    expect(at1.shakePx).toBeGreaterThan(at0.shakePx);
    expect(at1.goldMix).toBeGreaterThan(at0.goldMix);
    // 주기는 빈도 보간 → 강도가 오를수록 짧아진다
    expect(at1.ringDurationS).toBeLessThan(at0.ringDurationS);
    expect(at1.shakeDurationS).toBeLessThan(at0.shakeDurationS);
    expect(at1.dashDurationS).toBeLessThan(at0.dashDurationS);
  });

  it("2·3번 링은 중반·후반부터 스며든다(초반엔 없음)", () => {
    expect(hypeChannels(0.2).ring2).toBe(0);
    expect(hypeChannels(0.5).ring2).toBeGreaterThan(0);
    expect(hypeChannels(0.5).ring3).toBe(0);
    expect(hypeChannels(0.9).ring3).toBeGreaterThan(0);
  });

  it("clamp01이 범위를 벗어난 입력을 막는다", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(9)).toBe(1);
    expect(hypeChannels(5).intensity).toBe(1);
  });

  it("CSS 변수는 숫자·단위 형식이 유효하다", () => {
    const vars = hypeCssVars(hypeChannels(0.5));
    expect(vars["--hype-i"]).toMatch(/^\d\.\d{3}$/);
    expect(vars["--hy-ring-dur"]).toMatch(/^\d+\.\d{3}s$/);
    expect(vars["--hy-shake-x"]).toMatch(/^\d+\.\d{2}px$/);
  });
});

// ── 4차: 시트 온도 · 마스터 박동 위상 · 점멸 예산 ────────────────────────────
describe("sheetWarm — 팝오버 표면 온도", () => {
  it("I^1.35로 0→1 단조 증가하고, 금빛(I^2.2)보다 항상 이르다", () => {
    expect(hypeChannels(0).sheetWarm).toBe(0);
    expect(hypeChannels(1).sheetWarm).toBeCloseTo(1, 6);
    let prev = -1;
    for (let i = 0; i <= 1.0001; i += 0.05) {
      const w = hypeChannels(Math.min(1, i)).sheetWarm;
      expect(w).toBeGreaterThanOrEqual(prev);
      prev = w;
    }
    // 넓은 저채도 면은 감지가 늦으므로 중반에 이미 온도가 있어야 한다.
    for (const i of [0.25, 0.5, 0.75]) {
      expect(hypeChannels(i).sheetWarm).toBeGreaterThan(hypeChannels(i).goldMix);
    }
  });
});

describe("dash 주기 — 새 endpoint", () => {
  it("빈도 공간에서 2.2초 → 0.52초로 감소한다", () => {
    expect(hypeChannels(0).dashDurationS).toBeCloseTo(2.2, 6);
    expect(hypeChannels(1).dashDurationS).toBeCloseTo(0.52, 6);
  });
  it("시점별 기준값이 명세와 일치한다(60/30/10/3/1초)", () => {
    const at = (sec: number) => hypeChannels(hypeIntensity(S(sec))).dashDurationS;
    expect(at(60)).toBeCloseTo(2.2, 2);
    expect(at(30)).toBeCloseTo(1.174, 2);
    expect(at(10)).toBeCloseTo(0.674, 2);
    expect(at(3)).toBeCloseTo(0.561, 2);
    expect(at(1)).toBeCloseTo(0.533, 2);
  });
});

describe("beatWave — 마스터 박동 파형", () => {
  it("한 주기에 국소 최대가 정확히 하나이고 20% 지점에서 1이다", () => {
    expect(beatWave(0)).toBeCloseTo(0, 6);
    expect(beatWave(0.2)).toBeCloseTo(1, 6);
    expect(beatWave(0.55)).toBeCloseTo(0, 6);
    expect(beatWave(0.9)).toBe(0);
    let peaks = 0;
    for (let q = 0.005; q < 1; q += 0.005) {
      const a = beatWave(q - 0.005);
      const b = beatWave(q);
      const c = beatWave(q + 0.005);
      if (b > a && b >= c) peaks += 1;
    }
    expect(peaks).toBe(1);
  });
  it("수축(20%)이 이완(35%)보다 빠른 비대칭이다", () => {
    expect(beatWave(0.1)).toBeCloseTo(0.5, 1); // 상승 중간
    expect(beatWave(0.375)).toBeCloseTo(0.5, 1); // 하강 중간
  });
  it("주기 밖 위상도 감싸서(fract) 같은 값을 낸다", () => {
    expect(beatWave(1.2)).toBeCloseTo(beatWave(0.2), 6);
  });
});

describe("점멸 예산(WCAG 2.3.1)", () => {
  it("최대 강도에서도 박동 빈도가 초당 3회 한계에 여유를 남긴다", () => {
    const minPeriod = hypeChannels(1).ringDurationS;
    expect(minPeriod).toBeCloseTo(0.62, 6);
    const hz = 1 / minPeriod;
    expect(hz).toBeLessThan(1.7); // 임의 1초 창 peak 최대 2회 + 공개 단발 1회 = 3회(초과 아님)
  });
});

describe("흔들림은 고요 이전 구간에서 실제로 보인다", () => {
  // 지수가 2.4일 때 진폭이 곡선 맨 끝에 몰렸는데, 정작 그 끝(10초)에서 고요가 0으로
  // 꺼버려 60~10초 내내 1px도 안 움직였다. 팝오버가 안 흔들린다는 신고의 실제 원인.
  const shakeAt = (sec: number) =>
    hypeChannels(hypeIntensity(S(sec)), hypeCalm(S(sec))).shakePx;

  it("고요가 시작되기 직전(12초)에 카드 기준 1px 이상 흔들린다", () => {
    expect(shakeAt(12)).toBeGreaterThan(1);
  });

  it("고요 구간(11.8→10초)에서 흔들림이 계단 없이 잦아들어 0이 된다", () => {
    const start = shakeAt(11.8);
    expect(start).toBeGreaterThan(1);
    let prev = start;
    let peak = start;
    for (let sec = 11.8; sec >= 10; sec -= 0.05) {
      const cur = shakeAt(sec);
      // 뚝 끊기지 않는다 — 인접 0.05초 사이 변화가 작다.
      expect(Math.abs(cur - prev)).toBeLessThan(0.09);
      peak = Math.max(peak, cur);
      prev = cur;
    }
    // 감쇠가 붙기 전 아주 잠깐 부풀 수는 있다(폭풍 직전의 고조) — 다만 미미해야 한다.
    expect(peak).toBeLessThan(start * 1.05);
    expect(prev).toBeLessThan(0.01); // 루프 종점(≈10초)에서 사실상 멎어 있고
    expect(shakeAt(10)).toBe(0); // 10초에는 정확히 0이다
  });

  it("중반(30초)에도 감지 가능한 크기다", () => {
    expect(shakeAt(30)).toBeGreaterThan(0.3);
  });

  it("팝오버는 배율 1.8배라 넓은 표면에서도 보인다", () => {
    expect(shakeAt(15) * 1.8).toBeGreaterThan(1.5);
  });

  it("고요에 들어가면 정확히 0이 된다", () => {
    expect(shakeAt(9)).toBe(0);
    expect(shakeAt(1)).toBe(0);
  });
});

describe("hypeEmerge — 타이머 등장(66→58초)", () => {
  it("66초부터 스며들어 58초에 완성된다(60초에 툭 나타나지 않는다)", () => {
    expect(hypeEmerge(S(70))).toBe(0);
    expect(hypeEmerge(S(66))).toBe(0);
    expect(hypeEmerge(S(62))).toBeGreaterThan(0);
    expect(hypeEmerge(S(62))).toBeLessThan(1);
    expect(hypeEmerge(S(58))).toBe(1);
    expect(hypeEmerge(S(30))).toBe(1);
  });

  it("60초 경계에 계단이 없다 — 이미 절반 이상 나와 있다", () => {
    expect(hypeEmerge(S(60))).toBeGreaterThan(0.5);
    expect(Math.abs(hypeEmerge(S(60.1)) - hypeEmerge(S(59.9)))).toBeLessThan(0.03);
  });

  it("시작·끝의 기울기가 0이라 켜짐/멈춤이 안 보인다", () => {
    expect(hypeEmerge(S(65.9))).toBeLessThan(0.002);
    expect(1 - hypeEmerge(S(58.1))).toBeLessThan(0.002);
  });

  it("전 구간 단조 증가하고 인접 0.05초 변화가 작다", () => {
    let prev = 0;
    for (let sec = 67; sec >= 57; sec -= 0.05) {
      const cur = hypeEmerge(S(sec));
      expect(cur).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(cur - prev).toBeLessThan(0.02);
      prev = cur;
    }
    expect(prev).toBe(1);
  });
});

describe("hypeCalm — 폭풍의 눈(마지막 10초)", () => {
  it("11.8초부터 잦아들어 10초에 완성된다(숫자 '10'은 이미 조용한 자리에 떨어진다)", () => {
    expect(hypeCalm(S(12))).toBe(0);
    expect(hypeCalm(S(11.8))).toBe(0);
    expect(hypeCalm(S(11))).toBeGreaterThan(0);
    expect(hypeCalm(S(11))).toBeLessThan(1);
    expect(hypeCalm(S(10))).toBe(1);
    expect(hypeCalm(S(1))).toBe(1);
  });

  it("전이가 연속이다 — 인접 0.05초 사이에 튀지 않는다(확 바뀌는 느낌 금지)", () => {
    let prev = hypeCalm(S(12.5));
    for (let sec = 12.5; sec >= 9; sec -= 0.05) {
      const cur = hypeCalm(S(sec));
      expect(cur - prev).toBeLessThan(0.06);
      expect(cur).toBeGreaterThanOrEqual(prev - 1e-9); // 역행 없음
      prev = cur;
    }
  });

  it("동요는 재우고(흔들림 0) 박동은 1초로 늘린다", () => {
    const before = hypeChannels(hypeIntensity(S(13)), hypeCalm(S(13)));
    const after = hypeChannels(hypeIntensity(S(9)), hypeCalm(S(9)));
    expect(before.shakePx).toBeGreaterThan(0);
    expect(after.shakePx).toBe(0); // 갑자기 고요해진다
    expect(after.ringDurationS).toBeCloseTo(1, 6); // 박자가 곧 시계가 된다
    expect(after.ringDurationS).toBeGreaterThan(before.ringDurationS); // 느려진다
  });

  it("크기·빛·색은 고요와 무관하게 계속 오른다(조용해지되 더 커진다)", () => {
    const at11 = hypeChannels(hypeIntensity(S(11)), hypeCalm(S(11)));
    const at3 = hypeChannels(hypeIntensity(S(3)), hypeCalm(S(3)));
    expect(at3.numberScale).toBeGreaterThan(at11.numberScale);
    expect(at3.glow).toBeGreaterThan(at11.glow);
    expect(at3.goldMix).toBeGreaterThan(at11.goldMix);
    expect(at3.sheetWarm).toBeGreaterThan(at11.sheetWarm);
  });

  it("고요 구간에서 박동은 느려지는 대신 깊어진다", () => {
    const fast = hypeMotionFrame(S(11), hypeIntensity(S(11)));
    const calm = hypeMotionFrame(S(9), hypeIntensity(S(9)));
    expect(calm.beatDurationS).toBeGreaterThan(fast.beatDurationS);
    expect(calm.dotPeak).toBeGreaterThan(fast.dotPeak);
    // 느려졌으니 점멸 예산은 더 안전해진다.
    expect(1 / calm.beatDurationS).toBeLessThan(1 / fast.beatDurationS);
  });
});

describe("hypeMotionFrame — 절대 위상", () => {
  it("같은 remainMs면 mount 시점과 무관하게 같은 위상을 낸다", () => {
    const a = hypeMotionFrame(S(12), hypeIntensity(S(12)));
    const b = hypeMotionFrame(S(12), hypeIntensity(S(12)));
    expect(a.beatPhase).toBe(b.beatPhase);
    expect(a.dashPhase).toBe(b.dashPhase);
  });
  it("위상은 0~1 안에 있고, 주기가 변해도 인접 샘플에서 튀지 않는다", () => {
    let prev: number | null = null;
    for (let sec = 60; sec >= 0; sec -= 0.1) {
      const f = hypeMotionFrame(S(sec), hypeIntensity(S(sec)));
      expect(f.beatPhase).toBeGreaterThanOrEqual(0);
      expect(f.beatPhase).toBeLessThan(1);
      if (prev !== null) {
        // 되감김(1→0)을 제외하면 인접 0.1초 사이 위상 변화가 한 주기를 넘지 않는다.
        const d = f.beatPhase - prev;
        expect(d > 0 ? d : d + 1).toBeLessThan(0.5);
      }
      prev = f.beatPhase;
    }
  });
  it("20ms LUT 위상이 1ms 기준 적분과 0.005 사이클 이내다", () => {
    // 독립 재계산(정본과 같은 수식, 훨씬 촘촘한 step)
    let acc = 0;
    let prevF = 1 / beatPeriodAt(S(60));
    let checked = 0;
    for (let k = 1; k <= 60_000; k += 1) {
      const remain = S(60) - k;
      const f = 1 / beatPeriodAt(remain);
      acc += ((prevF + f) / 2) * 0.001;
      prevF = f;
      if (k % 5_000 === 0) {
        const lut = hypeMotionFrame(remain, hypeIntensity(remain));
        const diff = Math.abs((acc % 1) - lut.beatPhase);
        expect(Math.min(diff, 1 - diff)).toBeLessThan(0.005);
        checked += 1;
      }
    }
    expect(checked).toBe(12);
  });
  it("정적 프레임은 진폭이 0이라 파형이 곱해져도 안 움직인다", () => {
    expect(STATIC_MOTION_FRAME.leaderPeak).toBe(0);
    expect(STATIC_MOTION_FRAME.hopePeak).toBe(0);
    expect(STATIC_MOTION_FRAME.dotPeak).toBe(0);
  });
  it("진폭 상한이 명세대로다(리더 0.70 · 기대돼요 1.08배 · 도트 1.45배)", () => {
    // 고요 구간 밖(15초)에서 잰다 — 마지막 10초는 일부러 더 깊게 뛴다(deep 계수).
    const f = hypeMotionFrame(S(15), 1);
    expect(f.leaderPeak).toBeCloseTo(0.7, 6);
    expect(f.hopePeak).toBeCloseTo(0.08, 6);
    expect(f.dotPeak).toBeCloseTo(0.45, 6);
  });
  it("모션 CSS 변수는 음수 delay 형식으로 직렬화된다", () => {
    const vars = hypeMotionCssVars(hypeMotionFrame(S(5), hypeIntensity(S(5))));
    expect(vars["--hy-beat-delay"]).toMatch(/^-?\d+\.\d{4}s$/);
    expect(vars["--hy-dash-delay"]).toMatch(/^-?\d+\.\d{4}s$/);
    expect(vars["--hy-hope-peak"]).toMatch(/^\d\.\d{4}$/);
  });
});

// ── 시트 배경 대비(WCAG AA) ─────────────────────────────────────────────────
// 배경이 강도에 따라 데워지므로 '어느 순간에도' 본문이 읽혀야 한다. 계획서 표를 믿지 않고
// 실제 CSS에 박힌 색으로 다시 계산한다(색이 바뀌면 이 테스트가 먼저 깨진다).
const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16)
];
// color-mix(in srgb, …)는 감마 인코딩된 sRGB 성분을 그대로 선형 보간한다.
const mixSrgb = (a: string, b: string, t: number): [number, number, number] => {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return [ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t];
};
const relLuminance = ([r, g, b]: [number, number, number]): number => {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (fg: [number, number, number], bg: [number, number, number]): number => {
  const l1 = relLuminance(fg);
  const l2 = relLuminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

describe("떡밥 시트 배경 대비", () => {
  // public-poster.css의 실제 값.
  const COOL = "#fffdf6";
  const HOT = "#fff0d2";
  const TITLE = "#2b2415"; // .agenda-detail-title (웹 팝오버)
  const SUB = "#6f6754"; // .agenda-detail-subs li (웹 팝오버) — 가장 밝은 본문색
  const GOLD_NUM = "#9a5800"; // .dt-count-core strong 금빛 끝점
  const EYE_COOL = "#fffbef";
  const EYE_HOT = "#ffefcb";

  it("강도 전 구간에서 제목·부제목이 AA(4.5:1)를 넘는다", () => {
    for (const i of [0, 0.25, 0.5, 0.75, 1]) {
      const warm = hypeChannels(i).sheetWarm;
      const bg = mixSrgb(COOL, HOT, warm);
      expect(contrast(hexToRgb(TITLE), bg), `제목 대비 미달 @I=${i}`).toBeGreaterThanOrEqual(4.7);
      expect(contrast(hexToRgb(SUB), bg), `부제목 대비 미달 @I=${i}`).toBeGreaterThanOrEqual(4.7);
    }
  });

  it("눈 편한 테마 입력 팔레트에서도 AA를 넘는다(전역 filter 전 기준)", () => {
    for (const i of [0, 0.5, 1]) {
      const bg = mixSrgb(EYE_COOL, EYE_HOT, hypeChannels(i).sheetWarm);
      expect(contrast(hexToRgb(TITLE), bg)).toBeGreaterThanOrEqual(4.7);
      expect(contrast(hexToRgb(SUB), bg)).toBeGreaterThanOrEqual(4.7);
    }
  });

  it("금빛 카운트다운 숫자는 가장 뜨거운 배경에서도 AA를 넘는다", () => {
    expect(contrast(hexToRgb(GOLD_NUM), hexToRgb(HOT))).toBeGreaterThanOrEqual(4.7);
    expect(contrast(hexToRgb(GOLD_NUM), hexToRgb(EYE_HOT))).toBeGreaterThanOrEqual(4.7);
  });
});
