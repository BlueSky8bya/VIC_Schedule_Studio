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
          '<div class="dt-count-core"><strong>10</strong></div>' +
          '</div><p class="dt-count-label">최초공개까지</p>' +
          '<p class="dt-count-when">10월 1일 (수) 오후 9시</p></div>';
        document.body.appendChild(host);
        const ringbox = host.querySelector<HTMLElement>(".dt-count-ringbox")!;
        const label = host.querySelector<HTMLElement>(".dt-count-label")!;
        const core = host.querySelector<HTMLElement>(".dt-count-core")!;
        const strong = core.querySelector("strong")!;
        const out: {
          num: string;
          ringBottom: number;
          labelTop: number;
          coreCx: number;
          ringCx: number;
        }[] = [];
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
          const cb = core.getBoundingClientRect();
          out.push({
            num,
            ringBottom: Math.round(rb.bottom),
            labelTop: Math.round(lb.top),
            coreCx: Math.round(cb.left + cb.width / 2),
            ringCx: Math.round(rb.left + rb.width / 2)
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
      // 숫자는 자릿수가 줄어도 항상 원 중심에 다시 모인다(고정 슬롯 없이 동적 가운데 정렬).
      for (const r of rows) {
        expect(
          Math.abs(r.coreCx - r.ringCx),
          `${width}px / --hy-num=${r.num}에서 숫자가 원 중심에서 벗어났다`
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  test("눈금은 숫자가 아니라 원형 바 쪽에 붙어 있다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/visual-fixture/poster", { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const res = await page.evaluate(() => {
      // viewBox 좌표 기준: 링 반지름 44, stroke 7 → 안쪽 면 40.5. 눈금은 그 바로 안쪽에
      // 붙어야 하고, 숫자(최대 반지름 약 22)와는 한참 떨어져 있어야 한다.
      const host = document.createElement("div");
      host.className = "agenda-detail-sheet is-hype is-teaser";
      host.innerHTML =
        '<div class="dt-count"><div class="dt-count-ringbox">' +
        '<svg class="dt-ring" viewBox="0 0 100 100">' +
        '<g class="dt-ring-ticks"><line x1="91.8" x2="96.2" y1="50" y2="50"></line></g>' +
        '<circle class="dt-ring-track" cx="50" cy="50" r="44"></circle></svg>' +
        '<div class="dt-count-core"><strong>10</strong></div></div></div>';
      document.body.appendChild(host);
      host.style.setProperty("--hy-num", "1.824"); // 숫자가 가장 클 때
      const svg = host.querySelector("svg")!;
      const line = host.querySelector<SVGLineElement>(".dt-ring-ticks line")!;
      const strong = host.querySelector<HTMLElement>(".dt-count-core strong")!;
      const cs = getComputedStyle(line);
      const half = parseFloat(cs.strokeWidth) / 2;
      // ⚠ x는 반지름이 아니라 좌표다(중심 50). 이걸 반지름으로 착각해 눈금 12개가 숫자
      // 한가운데 뭉쳐 있었다 — 그래서 속성이 아니라 '실제로 그려진 거리'로 잰다.
      const box = svg.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const lb = line.getBoundingClientRect();
      const scale = box.width / 100;
      const dists = [
        Math.hypot(lb.left - cx, lb.top - cy),
        Math.hypot(lb.right - cx, lb.bottom - cy)
      ].map((d) => d / scale);
      const inner = Math.min(...dists);
      const outer = Math.max(...dists);
      // 화면 좌표에서 숫자 상자를 viewBox 단위로 환산한다.
      const nb = strong.getBoundingClientRect();
      // 숫자는 축 정렬 사각형이다 — 대각선 반경으로 재면 글자가 닿지도 않는 모서리까지
      // 세어 과하게 크게 나온다. 눈금 12개의 '안쪽 끝점'이 그 사각형 밖인지 직접 본다.
      const halfW = nb.width / 2 / scale;
      const halfH = nb.height / 2 / scale;
      const clearances = Array.from({ length: 12 }, (_, k) => {
        const rad = (k * 30 * Math.PI) / 180;
        const x = Math.abs(inner * Math.cos(rad));
        const y = Math.abs(inner * Math.sin(rad));
        // 사각형 밖으로 얼마나 벗어났는지(둘 중 큰 여유)
        return Math.max(x - halfW, y - halfH);
      });
      const cap = cs.strokeLinecap;
      host.remove();
      return { inner, outer, half, halfW, halfH, cap, minClearance: Math.min(...clearances) };
    });
    // 눈금은 바 stroke 폭(반지름 40.5~47.5) '안'에 새겨진다 — 안쪽에 두면 링박스 후광
    // 경계와 겹쳐 숫자에 묻힌다. butt 캡이라 바 밖으로 삐져나오지도 않는다.
    expect(res.cap).toBe("butt");
    expect(res.inner).toBeGreaterThanOrEqual(40.5);
    expect(res.outer).toBeLessThanOrEqual(47.5);
    // 숫자가 최대(--hy-num 1.824)일 때조차 어느 눈금도 숫자 상자에 닿지 않는다.
    expect(
      res.minClearance,
      `눈금이 숫자 상자(${res.halfW.toFixed(1)}×${res.halfH.toFixed(1)})를 침범한다`
    ).toBeGreaterThan(3);
  });

  test("고요에서 숫자는 링 바깥까지 자라되 라벨·팝오버 폭은 침범하지 않는다", async ({ page }) => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/visual-fixture/poster", { waitUntil: "load" });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      const res = await page.evaluate(() => {
        const host = document.createElement("div");
        host.className = "agenda-detail-sheet is-hype is-teaser";
        host.innerHTML =
          '<div class="dt-count is-final"><div class="dt-count-ringbox">' +
          '<svg class="dt-ring" viewBox="0 0 100 100">' +
          '<circle class="dt-ring-track" cx="50" cy="50" r="44"></circle></svg>' +
          '<div class="dt-count-core"><strong>10</strong></div></div></div>';
        document.body.appendChild(host);
        // 마지막 1초: 강도 곡선 값 + 마지막 축 최대.
        host.style.setProperty("--hy-num", "2.01");
        host.style.setProperty("--hy-final", "1");
        host.style.setProperty("--hy-emerge", "1");
        host.querySelector<HTMLElement>(".dt-count-core strong")!.textContent = "1";
        // 매초 애니메이션의 첫 프레임(scale 1.09)이 아니라 '정착 상태'를 잰다.
        host.querySelector<HTMLElement>(".dt-count-core strong")!.style.animation = "none";
        const ringbox = host.querySelector<HTMLElement>(".dt-count-ringbox")!;
        const strong = host.querySelector<HTMLElement>(".dt-count-core strong")!;
        const rb = ringbox.getBoundingClientRect();
        const nb = strong.getBoundingClientRect();
        // 링의 '실제로 그려진' 크기(마지막 구간에는 축소가 걸려 있다).
        const track = host.querySelector<SVGCircleElement>(".dt-ring-track")!;
        const tb = track.getBoundingClientRect();
        const sw = parseFloat(getComputedStyle(track).strokeWidth);
        const font = parseFloat(getComputedStyle(strong).fontSize);
        // 트랙 bbox는 stroke 바깥까지 포함한다 → 안쪽 지름 = bbox − stroke(양쪽).
        const svgScale = host.querySelector("svg")!.getBoundingClientRect().width / 100;
        const innerD = tb.width - sw * svgScale;
        host.remove();
        return {
          innerD,
          textW: nb.width,
          inkH: font * 0.72,
          lineH: nb.height,
          ringboxH: rb.height,
          font
        };
      });
      // 마지막엔 링이 물러나고 숫자가 그 자리를 넘어간다 — 글자 잉크가 링 안쪽 지름보다 크다.
      expect(
        res.inkH,
        `${width}px에서 숫자(잉크 ${res.inkH.toFixed(0)}px)가 링 안쪽 지름 ${res.innerD.toFixed(0)}px을 못 넘는다`
      ).toBeGreaterThan(res.innerD);
      // 그래도 라벨과는 안 겹친다 — 줄 상자가 링박스(고정 높이) 안에 들어와야 한다.
      expect(
        res.lineH,
        `${width}px에서 숫자 줄 상자(${res.lineH.toFixed(0)}px)가 링박스(${res.ringboxH}px)를 넘어 라벨과 겹친다`
      ).toBeLessThan(res.ringboxH - 6);
      // 팝오버 안쪽 폭(데스크톱 344 − 좌우 20씩)도 넘지 않는다.
      expect(res.textW).toBeLessThan(width > 640 ? 304 : 300);
    }
  });

  test("별이 진행 호의 끝에 정확히 붙어 있다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/visual-fixture/poster", { waitUntil: "load" });
    const res = await page.evaluate(() => {
      // 진행 호는 SVG 원 경로의 시작점(로컬 3시)에서 시계방향으로 길이 p만큼 그려진다.
      // 별을 12시에서 출발시키면 정확히 90° 어긋난다 — 그 회귀를 막는다.
      const host = document.createElement("div");
      host.innerHTML =
        '<svg class="dt-ring" viewBox="0 0 100 100" style="width:132px;height:132px">' +
        '<circle class="dt-ring-progress" cx="50" cy="50" r="44"></circle>' +
        '<circle class="dt-ring-spark" cx="94" cy="50" r="3.2"></circle></svg>';
      document.body.appendChild(host);
      const prog = host.querySelector<SVGCircleElement>(".dt-ring-progress")!;
      const spark = host.querySelector<SVGCircleElement>(".dt-ring-spark")!;
      const svg = host.querySelector("svg")!;
      // 실제 화면에선 1Hz 갱신 사이를 0.95s transition으로 이어 붙이지만, 여기서는 각
      // 시점의 '최종 위치'를 재야 하므로 보간을 끈다(안 끄면 직전 각도가 잡힌다).
      spark.style.transition = "none";
      const out: { p: number; gap: number }[] = [];
      for (const p of [1, 0.95, 0.6, 0.25, 0.05]) {
        prog.setAttribute("pathLength", "1");
        prog.style.strokeDasharray = "1";
        prog.style.strokeDashoffset = String(1 - p);
        spark.style.transform = `rotate(${360 * p}deg)`;
        spark.style.transformOrigin = "50px 50px";
        // 호의 끝점은 경로에서 직접 읽고(getPointAtLength) 화면 좌표로 옮긴다. 별은
        // 실제로 그려진 위치(bounding rect 중심)를 쓴다 — CSS transform이 반영된 값.
        const len = prog.getTotalLength();
        const end = prog.getPointAtLength(len * p);
        const pt = svg.createSVGPoint();
        pt.x = end.x;
        pt.y = end.y;
        const endScreen = pt.matrixTransform(svg.getScreenCTM()!);
        const sb = spark.getBoundingClientRect();
        out.push({
          p,
          gap: Math.hypot(sb.left + sb.width / 2 - endScreen.x, sb.top + sb.height / 2 - endScreen.y)
        });
      }
      host.remove();
      return out;
    });
    for (const r of res) {
      // 화면 픽셀 기준(132px 링, viewBox 100 → 배율 1.32). 3px 이내면 육안으로 붙어 있다.
      expect(r.gap, `p=${r.p}에서 별이 호 끝과 ${r.gap.toFixed(2)}px 떨어져 있다`).toBeLessThan(3);
    }
  });

  test("공개 연출이 카드 레이아웃 높이를 바꾸지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/visual-fixture/poster", { waitUntil: "load" });
    await page.locator("[data-export-surface]").first().waitFor({ state: "visible" });
    const res = await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>(".public-event");
      if (!card) return null;
      const cell = card.parentElement as HTMLElement;
      const base = { card: card.offsetHeight, cell: cell.offsetHeight };
      // 공개 연출 클래스 + 충격파를 얹는다. 전부 absolute/transform이어야 하므로
      // 레이아웃 높이는 1px도 변하면 안 된다(예전 tj-pop은 크기로 때려 깜빡임처럼 읽혔다).
      const shock = document.createElement("span");
      shock.className = "reveal-shock";
      card.prepend(shock);
      card.classList.add("just-revealed");
      const after = { card: card.offsetHeight, cell: cell.offsetHeight };
      const cs = getComputedStyle(card);
      const peak = cs.animationName;
      card.classList.remove("just-revealed");
      shock.remove();
      return { base, after, peak };
    });
    expect(res).not.toBeNull();
    expect(res!.after.card).toBe(res!.base.card);
    expect(res!.after.cell).toBe(res!.base.cell);
    expect(res!.peak).toBe("tj-pop");
  });

  test("1분 안쪽이면 팝오버 내용이 떨리되 시트 박스는 고정이다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/visual-fixture/poster", { waitUntil: "load" });
    const res = await page.evaluate(() => {
      const back = document.createElement("div");
      back.className = "agenda-detail-backdrop is-pop";
      const sheet = document.createElement("div");
      sheet.className = "agenda-detail-sheet is-hype is-teaser";
      sheet.style.setProperty("--hy-shake-x", "1.2px");
      sheet.innerHTML =
        '<div class="detail-grab"><span></span></div>' +
        '<p class="agenda-detail-title">제목</p>' +
        '<div class="detail-teaser"><button class="dt-hope">기대돼요</button></div>';
      back.appendChild(sheet);
      document.body.appendChild(back);
      const box = sheet.getBoundingClientRect();
      const out = {
        sheet: getComputedStyle(sheet).animationName,
        title: getComputedStyle(sheet.querySelector(".agenda-detail-title")!).animationName,
        teaser: getComputedStyle(sheet.querySelector(".detail-teaser")!).animationName,
        grab: getComputedStyle(sheet.querySelector(".detail-grab")!).animationName,
        k: getComputedStyle(sheet.querySelector(".agenda-detail-title")!).getPropertyValue(
          "--hy-shake-k"
        ),
        // 큰 몸은 느리게 — 카드보다 주기가 길어야 한 덩어리로 안 보인다.
        dur: getComputedStyle(sheet.querySelector(".agenda-detail-title")!).animationDuration,
        // 조각마다 위상이 어긋나야 '판때기'가 아니라 '술렁임'으로 읽힌다.
        delays: Array.from(sheet.children).map((c) => getComputedStyle(c).animationDelay),
        boxW: Math.round(box.width),
        boxH: Math.round(box.height)
      };
      back.remove();
      return out;
    });
    // 내용은 떨고, 시트 자신은 안 떤다(닫기·기대돼요 히트 타깃이 움직이면 누르기 어렵다).
    // 그리고 카드(hype-shake)와 '다른' 어휘여야 한다 — 똑같으면 한 덩어리처럼 보인다.
    expect(res.title).toBe("hype-sway");
    expect(res.teaser).toBe("hype-sway");
    expect(res.sheet).not.toBe("hype-sway");
    expect(res.sheet).not.toBe("hype-shake");
    // 드래그 손잡이는 예외 — 조준이 어긋난다.
    expect(res.grab).toBe("none");
    expect(res.k.trim()).toBe("1.8");
    // 기본 흔들림 주기(1.4s)보다 확실히 느리다.
    expect(parseFloat(res.dur)).toBeGreaterThan(1.4);
    expect(new Set(res.delays).size, "조각들이 같은 위상으로 통째로 움직인다").toBeGreaterThan(1);
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

test.describe("등장 구간 레이아웃 연속성", () => {
  test("66→58초 내내 총 높이가 계단 없이 이어진다(기대돼요 버튼이 안 튄다)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/visual-fixture/poster", { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const heights = await page.evaluate(() => {
      const EM = (s: number) => {
        if (s >= 66) return 0;
        if (s <= 58) return 1;
        const x = (66 - s) / 8;
        return x * x * x * (x * (x * 6 - 15) + 10);
      };
      const host = document.createElement("div");
      host.className = "agenda-detail-sheet is-teaser";
      host.style.cssText = "position:fixed;left:0;top:0;width:344px;padding:0 20px";
      document.body.appendChild(host);
      const out: { s: number; h: number }[] = [];
      // 실제 렌더와 같은 마운트 규칙: 링은 s<=66, 알약은 s>58.
      for (let s = 68; s >= 56; s -= 0.1) {
        const e = EM(s);
        const ring =
          s <= 66
            ? '<div class="dt-count"><div class="dt-count-ringbox"></div>' +
              '<p class="dt-count-label">최초공개까지</p>' +
              '<p class="dt-count-when">오전 2시</p></div>'
            : "";
        const pill = s > 58 ? '<p class="dt-when"><b>오전 2시</b></p>' : "";
        host.innerHTML = `<div class="detail-teaser">${ring}${pill}<button class="dt-hope">기대돼요</button></div>`;
        const teaser = host.querySelector<HTMLElement>(".detail-teaser")!;
        teaser.style.setProperty("--hy-emerge", String(e));
        out.push({ s, h: teaser.getBoundingClientRect().height });
      }
      host.remove();
      return out;
    });
    // 마운트/언마운트 경계(66, 58)를 포함해 인접 0.1초 사이 높이 변화가 작아야 한다.
    for (let k = 1; k < heights.length; k += 1) {
      const d = Math.abs(heights[k].h - heights[k - 1].h);
      expect(
        d,
        `${heights[k].s}초에서 높이가 ${d.toFixed(1)}px 튀었다(${heights[k - 1].h.toFixed(1)} → ${heights[k].h.toFixed(1)})`
      ).toBeLessThan(6);
    }
  });
});

test.describe("업 도움 띠 — 확대해도 날짜와 안 겹친다", () => {
  test("100/125/150% 어디서도 띠가 날짜 머리글 아래에 있다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/visual-fixture/poster", { waitUntil: "load" });
    await page.locator("[data-export-surface]").first().waitFor({ state: "visible" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const rows = await page.evaluate(() => {
      const day = document.querySelector<HTMLElement>(".public-day");
      if (!day) return null;
      const strip = day.querySelector<HTMLElement>(".day-strip")!;
      // fixture에 업 도움 띠가 없을 수 있으므로 실제와 같은 방식으로 하나 심는다.
      const bar = document.createElement("a");
      bar.className = "support-bar sb-head";
      bar.style.top = "calc(var(--day-head-h, 27px) - 1px + 0px)";
      bar.style.left = "-1px";
      bar.style.right = "-1px";
      day.appendChild(bar);
      const out: { zoom: string; stripBottom: number; barTop: number }[] = [];
      for (const z of ["1", "1.25", "1.5"]) {
        day.style.setProperty("--cal-zoom", z);
        out.push({
          zoom: z,
          stripBottom: strip.getBoundingClientRect().bottom,
          barTop: bar.getBoundingClientRect().top
        });
      }
      bar.remove();
      day.style.removeProperty("--cal-zoom");
      return out;
    });
    expect(rows).not.toBeNull();
    for (const r of rows!) {
      // 띠 윗변이 날짜 줄 밑선보다 위로 올라오면(2px 여유 초과) 날짜를 덮는다.
      expect(
        r.stripBottom - r.barTop,
        `확대 ${r.zoom}에서 띠가 날짜 머리글을 ${(r.stripBottom - r.barTop).toFixed(1)}px 침범한다`
      ).toBeLessThanOrEqual(2);
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
