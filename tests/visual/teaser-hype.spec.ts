import { expect, test } from "@playwright/test";

// 최초공개 긴장 곡선(연속) 회귀 — 계획서 검증 체크리스트의 '시점별' 항목을 자동화한다.
// (설계: docs/ux/motion/continuous-hype-curve-plan.ko.md)
//
// 실제 떡밥 데이터를 DB에 만들지 않는다(시청자 화면 오염 금지). 대신 곡선 계산은 단위
// 테스트(tests/unit/hype-curve.test.ts)가 보장하고, 여기서는 '그 값이 DOM에 꽂혔을 때'
// 레이아웃·시각 채널이 규칙대로 반응하는지만 본다.
//   - 카드 박스와 클릭 타깃은 전 구간 불변(움직이면 누르기 어려움)
//   - 링 3겹은 단계적으로 스며든다(DOM 추가·삭제로 인한 이산 경계 없음)
//   - 숫자 슬롯 폭은 10→9, 09→08에서 흔들리지 않는다
const SAMPLES = [61, 60, 58, 55, 45, 30, 15, 8, 3, 1] as const;

// 페이지 안에서 곡선을 재현한다(모듈 import 없이 — 단위 테스트가 수식의 정본).
const CURVE = `
  (s) => {
    if (s >= 60) return 0;
    if (s <= 0) return 1;
    if (s > 55) { const x = (60 - s) / 5; return 0.08 * (x*x*x*(x*(x*6-15)+10)); }
    const u = (55 - s) / 55;
    return 0.08 + 0.92 * Math.pow(u, 1.7);
  }
`;
const CHANNELS = `
  (i) => ({
    "--hype-i": String(i),
    "--hy-ring-dur": (1/(1/2.4 + (1/0.55 - 1/2.4) * Math.pow(i, 0.85))).toFixed(3) + "s",
    "--hy-ring1": (0.72 * Math.pow(i, 0.9)).toFixed(3),
    "--hy-ring2": (0.48 * (i <= 0.35 ? 0 : Math.pow((i-0.35)/0.65, 1.4))).toFixed(3),
    "--hy-ring3": (0.28 * (i <= 0.70 ? 0 : Math.pow((i-0.70)/0.30, 1.6))).toFixed(3),
    "--hy-shake-x": (1.2 * Math.pow(i, 2.4)).toFixed(2) + "px",
    "--hy-shake-dur": (1/(1/1.4 + (1/0.45 - 1/1.4) * Math.pow(i, 1.6))).toFixed(3) + "s",
    "--hy-gold": (0.78 * Math.pow(i, 2.2)).toFixed(3),
    "--hy-glow": (0.22 * Math.pow(i, 4)).toFixed(3),
    "--hy-num": (1.05 + 0.8 * Math.pow(i, 1.15)).toFixed(3)
  })
`;

test.describe("teaser hype — 연속 곡선 회귀", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("vic.reduceMotion", "on"); // 결정성(모션 정지)
      } catch {
        /* noop */
      }
    });
  });

  test("카드 박스는 전 구간 고정, 링은 단계적으로 스며든다", async ({ page }) => {
    await page.goto("/visual-fixture/poster");
    await page.locator("[data-export-surface]").first().waitFor({ state: "visible" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const result = await page.evaluate(
      ({ samples, curveSrc, chanSrc }) => {
        const curve = eval(curveSrc) as (s: number) => number;
        const chan = eval(chanSrc) as (i: number) => Record<string, string>;
        const card = document.querySelector<HTMLElement>(".public-event");
        if (!card) return null;
        card.classList.add("teaser", "hype-live");
        if (!card.querySelector(".teaser-ring")) {
          const ring = document.createElement("span");
          ring.className = "teaser-ring";
          card.prepend(ring);
        }
        const out: {
          s: number;
          i: number;
          box: { x: number; y: number; w: number; h: number };
          rings: number[];
        }[] = [];
        for (const s of samples) {
          const i = curve(s);
          const vars = chan(i);
          for (const [k, v] of Object.entries(vars)) card.style.setProperty(k, v);
          const b = card.getBoundingClientRect();
          out.push({
            s,
            i,
            box: {
              x: Math.round(b.left),
              y: Math.round(b.top),
              w: Math.round(b.width),
              h: Math.round(b.height)
            },
            rings: [
              Number(card.style.getPropertyValue("--hy-ring1")),
              Number(card.style.getPropertyValue("--hy-ring2")),
              Number(card.style.getPropertyValue("--hy-ring3"))
            ]
          });
        }
        return out;
      },
      { samples: SAMPLES, curveSrc: CURVE, chanSrc: CHANNELS }
    );

    expect(result).not.toBeNull();
    const rows = result!;

    // 1) 카드 박스·클릭 타깃 불변 — 강도가 올라도 위치·크기가 절대 안 변한다.
    const first = rows[0].box;
    for (const r of rows) {
      expect(r.box, `s=${r.s}에서 카드 박스가 움직였다`).toEqual(first);
    }

    // 2) 강도는 단조 증가(역행·점프 없음), 60초 경계는 사실상 0.
    expect(rows.find((r) => r.s === 61)!.i).toBe(0);
    expect(rows.find((r) => r.s === 60)!.i).toBeLessThan(0.005);
    for (let k = 1; k < rows.length; k += 1) {
      expect(rows[k].i, `s=${rows[k].s}에서 강도가 역행했다`).toBeGreaterThanOrEqual(rows[k - 1].i);
    }

    // 3) 링 3겹이 순서대로 스며든다(2번은 중반, 3번은 후반부터).
    const at45 = rows.find((r) => r.s === 45)!;
    const at15 = rows.find((r) => r.s === 15)!;
    const at3 = rows.find((r) => r.s === 3)!;
    expect(at45.rings[0]).toBeGreaterThan(0);
    expect(at45.rings[1]).toBe(0);
    expect(at15.rings[1]).toBeGreaterThan(0);
    expect(at15.rings[2]).toBe(0);
    expect(at3.rings[2]).toBeGreaterThan(0);
  });

  test("동작 줄이기에서는 하이프 애니메이션이 모두 정지한다(export 결정성)", async ({ page }) => {
    await page.goto("/visual-fixture/poster");
    await page.locator("[data-export-surface]").first().waitFor({ state: "visible" });

    const anims = await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>(".public-event");
      if (!card) return null;
      card.classList.add("teaser", "hype-live");
      const ring = document.createElement("span");
      ring.className = "teaser-ring";
      card.prepend(ring);
      const main = card.querySelector<HTMLElement>(".event-main");
      const names = [
        getComputedStyle(card).animationName,
        getComputedStyle(card, "::before").animationName,
        getComputedStyle(card, "::after").animationName,
        getComputedStyle(ring).animationName,
        main ? getComputedStyle(main).animationName : "none"
      ];
      return names;
    });

    expect(anims).not.toBeNull();
    for (const name of anims!) {
      expect(name, `동작 줄이기인데 애니메이션이 남아 있다: ${name}`).toBe("none");
    }
  });

  test("카운트다운 숫자 슬롯은 자릿수가 바뀌어도 폭이 흔들리지 않는다", async ({ page }) => {
    await page.goto("/visual-fixture/poster");
    await page.locator("[data-export-surface]").first().waitFor({ state: "visible" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const widths = await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>(".public-event");
      if (!card) return null;
      const host = document.createElement("span");
      host.className = "teaser-count is-live hype";
      host.style.setProperty("--hy-num", "1.5");
      const b = document.createElement("b");
      host.appendChild(b);
      card.appendChild(host);
      const out: number[] = [];
      for (const text of ["10", "9", "08", "3"]) {
        b.textContent = text;
        out.push(Math.round(host.getBoundingClientRect().width));
      }
      return out;
    });

    expect(widths).not.toBeNull();
    // tabular-nums + min-width라 한 자리/두 자리 사이 폭 차이가 작아야 한다(레이아웃 튐 방지).
    const max = Math.max(...widths!);
    const min = Math.min(...widths!);
    expect(max - min, `숫자 슬롯 폭이 ${min}~${max}px로 흔들린다`).toBeLessThanOrEqual(12);
  });
});
