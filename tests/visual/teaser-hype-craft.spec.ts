import { expect, test } from "@playwright/test";

// 최초공개 하이프 4차(장인 항목) 회귀 — 라벨 기하 · 시트 온도 · 리더선 합성 · 공개 스태거.
// (설계: docs/ux/motion/hype-craft-plan.ko.md)
//
// 3차와 같은 원칙: 실제 떡밥을 DB에 만들지 않는다(시청자 화면 오염 금지). fixture DOM에
// 구조와 CSS 변수를 주입해 '규칙이 지켜지는지'만 본다.

test.describe("teaser hype 4차 — 장인 항목", () => {
  test("카운트다운 라벨이 링과 겹치지 않는다(웹·모바일 전 구간)", async ({ page }) => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      // 모바일 폭에선 fixture가 아젠다로 바뀌어 export surface가 없다 — 여기서 필요한 건
      // '스타일시트가 적용된 문서'뿐이므로 load 완료 + 폰트 준비만 기다린다.
      await page.goto("/visual-fixture/poster", { waitUntil: "load" });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      const rows = await page.evaluate(() => {
        const host = document.createElement("div");
        host.className = "agenda-detail-sheet is-hype is-teaser";
        host.innerHTML =
          '<div class="dt-count"><div class="dt-count-ringbox">' +
          '<svg class="dt-ring" viewBox="0 0 100 100">' +
          '<circle class="dt-ring-track" cx="50" cy="50" r="44"></circle></svg>' +
          '<div class="dt-count-core"><strong>10</strong><span>초</span></div>' +
          '</div><p class="dt-count-label">최초공개까지</p></div>';
        document.body.appendChild(host);
        const ringbox = host.querySelector<HTMLElement>(".dt-count-ringbox")!;
        const label = host.querySelector<HTMLElement>(".dt-count-label")!;
        const core = host.querySelector<HTMLElement>(".dt-count-core")!;
        const strong = core.querySelector("strong")!;
        const out: { num: string; ringBottom: number; labelTop: number; coreW: number }[] = [];
        const samples: [string, string][] = [
          ["1.050", "60"],
          ["1.266", "30"],
          ["1.611", "10"],
          ["1.824", "1"]
        ];
        for (const [num, text] of samples) {
          host.style.setProperty("--hy-num", num);
          strong.textContent = text;
          const rb = ringbox.getBoundingClientRect();
          const lb = label.getBoundingClientRect();
          out.push({
            num,
            ringBottom: Math.round(rb.bottom),
            labelTop: Math.round(lb.top),
            coreW: Math.round(core.getBoundingClientRect().width)
          });
        }
        host.remove();
        return out;
      });
      for (const r of rows) {
        // 라벨은 링 박스 '아래' 독립 행이다 — 원 안 좁은 현에 놓여 stroke와 겹치던 버그의 가드.
        expect(
          r.labelTop,
          `${width}px / --hy-num=${r.num}에서 라벨이 링 안으로 들어갔다`
        ).toBeGreaterThanOrEqual(r.ringBottom);
      }
      // 숫자 슬롯 폭은 자릿수·강도와 무관하게 고정 → '초'가 좌우로 밀리지 않는다.
      const widths = rows.map((r) => r.coreW);
      expect(Math.max(...widths) - Math.min(...widths)).toBe(0);
    }
  });

  test("떡밥 시트는 강도에 따라 연속으로 데워지고 유리 재질을 끈다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/visual-fixture/poster");
    await page.locator("[data-export-surface]").first().waitFor({ state: "visible" });
    const res = await page.evaluate(() => {
      const back = document.createElement("div");
      back.className = "agenda-detail-backdrop is-pop";
      const sheet = document.createElement("div");
      sheet.className = "agenda-detail-sheet is-teaser";
      back.appendChild(sheet);
      document.body.appendChild(back);
      const out: { warm: string; bg: string; backdrop: string }[] = [];
      for (const warm of ["0", "0.25", "0.5", "0.75", "1"]) {
        sheet.style.setProperty("--hy-sheet-warm", warm);
        const cs = getComputedStyle(sheet);
        out.push({
          warm,
          bg: cs.backgroundColor,
          backdrop:
            cs.backdropFilter ||
            (cs as unknown as Record<string, string>).webkitBackdropFilter ||
            "none"
        });
      }
      back.remove();
      return out;
    });
    // ⚠ 특이도 함정: 유리 재질은 `.agenda-detail-backdrop.is-pop .agenda-detail-sheet`(0,3,0)에
    // 걸려 있어 `.agenda-detail-sheet.is-teaser`(0,2,0)로는 못 이긴다. 실제로 꺼졌는지 본다.
    for (const r of res) {
      expect(r.backdrop, `warm=${r.warm}에서 유리 재질이 안 꺼졌다`).toBe("none");
      expect(r.bg, `warm=${r.warm} 배경이 반투명이다`).not.toContain("rgba");
    }
    expect(new Set(res.map((r) => r.bg)).size, "강도가 달라도 배경색이 안 변한다").toBe(res.length);
  });

  test("리더선은 stroke가 아니라 transform/opacity로 박동한다", async ({ page }) => {
    await page.goto("/visual-fixture/poster");
    await page.locator("[data-export-surface]").first().waitFor({ state: "visible" });
    const res = await page.evaluate(() => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "detail-anchor-link is-hype");
      svg.innerHTML =
        '<g transform="translate(10 10) rotate(20)"><g><g class="detail-anchor-flow">' +
        '<line class="detail-anchor-base" x1="-11" y1="0" x2="111" y2="0"></line>' +
        '<line class="detail-anchor-pulse" x1="-11" y1="0" x2="111" y2="0"></line>' +
        "</g></g></g>" +
        '<circle class="detail-anchor-dot" cx="10" cy="10" r="5"></circle>';
      document.body.appendChild(svg);
      const g = (sel: string) => getComputedStyle(svg.querySelector(sel)!);
      const out = {
        flow: g(".detail-anchor-flow").animationName,
        pulse: g(".detail-anchor-pulse").animationName,
        dot: g(".detail-anchor-dot").animationName,
        pulseWidth: g(".detail-anchor-pulse").strokeWidth,
        baseDash: g(".detail-anchor-base").strokeDasharray
      };
      svg.remove();
      return out;
    });
    expect(res.flow).toBe("detail-link-flow");
    expect(res.pulse).toBe("hype-beat-opacity");
    expect(res.dot).toBe("hype-beat-dot");
    // 굵기·간격은 시간에 따라 변하지 않는다(변하면 매 프레임 SVG를 다시 칠한다).
    expect(res.pulseWidth).toBe("5px");
    expect(res.baseDash.replace(/px/g, "")).toBe("5, 6");
  });

  test("리더선 박동은 하이프 구간에서만 돈다(평범한 팝오버는 그대로)", async ({ page }) => {
    await page.goto("/visual-fixture/poster");
    await page.locator("[data-export-surface]").first().waitFor({ state: "visible" });
    const res = await page.evaluate(() => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "detail-anchor-link"); // is-hype 없음
      svg.innerHTML =
        '<g class="detail-anchor-flow"><line class="detail-anchor-pulse"></line></g>' +
        '<circle class="detail-anchor-dot"></circle>';
      document.body.appendChild(svg);
      const g = (sel: string) => getComputedStyle(svg.querySelector(sel)!);
      const out = {
        flow: g(".detail-anchor-flow").animationName,
        flowDur: g(".detail-anchor-flow").animationDuration,
        pulse: g(".detail-anchor-pulse").animationName,
        dot: g(".detail-anchor-dot").animationName
      };
      svg.remove();
      return out;
    });
    // 흐름은 예전과 똑같은 0.9s로 계속 흐르고, 박동만 없다.
    expect(res.flow).toBe("detail-link-flow");
    expect(res.flowDur).toBe("0.9s");
    expect(res.pulse).toBe("none");
    expect(res.dot).toBe("none");
  });

  test("공개 스태거는 지연만 다르고 레이아웃을 건드리지 않는다", async ({ page }) => {
    await page.goto("/visual-fixture/poster");
    await page.locator("[data-export-surface]").first().waitFor({ state: "visible" });
    const res = await page.evaluate(() => {
      const ul = document.createElement("ul");
      ul.className = "agenda-detail-subs";
      for (let i = 0; i < 3; i += 1) {
        const li = document.createElement("li");
        li.className = "reveal-secondary";
        li.style.setProperty("--reveal-delay", `${1020 + i * 70}ms`);
        li.textContent = `줄 ${i}`;
        ul.appendChild(li);
      }
      document.body.appendChild(ul);
      const lis = Array.from(ul.querySelectorAll<HTMLElement>("li"));
      const before = lis.map((li) => Math.round(li.getBoundingClientRect().height));
      const info = lis.map((li) => {
        const cs = getComputedStyle(li);
        return { name: cs.animationName, delay: cs.animationDelay, fill: cs.animationFillMode };
      });
      const after = lis.map((li) => Math.round(li.getBoundingClientRect().height));
      ul.remove();
      return { before, after, info };
    });
    expect(res.before).toEqual(res.after);
    expect(res.info.map((i) => i.delay)).toEqual(["1.02s", "1.09s", "1.16s"]);
    for (const i of res.info) {
      expect(i.name).toBe("reveal-secondary-rise");
      // 지연 동안 숨어 있다가 제 순서에 올라온다(base에 opacity:0을 두지 않는다).
      expect(i.fill).toBe("both");
    }
  });
});

test.describe("teaser hype 4차 — 동작 줄이기", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("vic.reduceMotion", "on");
      } catch {
        /* noop */
      }
    });
  });

  test("4차 연출도 모두 정지한다(export 결정성)", async ({ page }) => {
    await page.goto("/visual-fixture/poster");
    await page.locator("[data-export-surface]").first().waitFor({ state: "visible" });
    const names = await page.evaluate(() => {
      const li = document.createElement("li");
      li.className = "reveal-secondary";
      document.body.appendChild(li);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "detail-anchor-link is-hype");
      svg.innerHTML =
        '<g class="detail-anchor-flow"><line class="detail-anchor-pulse"></line></g>' +
        '<circle class="detail-anchor-dot"></circle>';
      document.body.appendChild(svg);
      const out = [
        getComputedStyle(li).animationName,
        getComputedStyle(svg.querySelector(".detail-anchor-flow")!).animationName,
        getComputedStyle(svg.querySelector(".detail-anchor-pulse")!).animationName,
        getComputedStyle(svg.querySelector(".detail-anchor-dot")!).animationName
      ];
      li.remove();
      svg.remove();
      return out;
    });
    for (const n of names) expect(n, `동작 줄이기인데 애니메이션이 남아 있다: ${n}`).toBe("none");
  });
});
