import { chromium } from "playwright";

const SC =
  "C:/Users/im917/AppData/Local/Temp/claude/c--Projects-VIC-Schedule-studio/696fcde9-d03c-475b-8261-c1efce90290f/scratchpad";
const b = await chromium.launch();
const out = [];
const ok = (n, p, note = "") => out.push(`${p ? "PASS" : "FAIL"} ${n}${note ? " — " + note : ""}`);

// 1) 캡쳐 안정성: 5회 연속 캡쳐 → 캔버스 평균 밝기 편차 확인 + 진행점이 버튼 안인지
{
  const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  await p.addInitScript(() => {
    try {
      Object.defineProperty(navigator, "clipboard", {
        value: { write: () => Promise.resolve() },
        configurable: true
      });
      window.ClipboardItem = class {
        constructor(x) {
          this.x = x;
        }
      };
      // 캡쳐 결과 밝기 측정용 후킹 — toBlob 직전 캔버스 평균 밝기 기록
      window.__lums = [];
      const orig = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (...args) {
        try {
          if (this.width > 2000) {
            const s = document.createElement("canvas");
            s.width = 64;
            s.height = 64;
            const c = s.getContext("2d");
            c.drawImage(this, 0, 0, 64, 64);
            const d = c.getImageData(0, 0, 64, 64).data;
            let sum = 0;
            for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
            window.__lums.push(sum / (d.length / 4));
          }
        } catch (e) {}
        return orig.apply(this, args);
      };
    } catch (e) {}
  });
  await p.goto("http://localhost:3000/visual-fixture/poster?mode=decorate", {
    waitUntil: "networkidle",
    timeout: 120000
  });
  await p.waitForTimeout(1500);
  const btn = p.locator(".poster-actions .button.primary").first();
  for (let i = 0; i < 5; i++) {
    await btn.click();
    // 진행점이 버튼 '안'에 있는지(첫 회만 확인)
    if (i === 0) {
      await p.waitForTimeout(300);
      const inBtn = await p.evaluate(() => {
        const d = document.querySelector(".poster-export-progress");
        return d ? Boolean(d.closest("button")) : null;
      });
      ok("progress dots inside button", inBtn === true, String(inBtn));
    }
    await p.waitForSelector(".poster-export-reward", { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2600); // reward 사라질 때까지
  }
  const lums = await p.evaluate(() => window.__lums);
  const min = Math.min(...lums);
  const max = Math.max(...lums);
  ok(
    "capture brightness stable x5",
    lums.length >= 5 && max - min < 2,
    `lums=${lums.map((v) => v.toFixed(1)).join(",")}`
  );
  await p.context().close();
}

// 2) 편집실 인사이트 모달: 배경 롤백(불투명) + X 회전 transition 적용
{
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto("http://localhost:3000/visual-fixture/studio", {
    waitUntil: "networkidle",
    timeout: 120000
  });
  await p.waitForTimeout(1200);
  const btnIns = p.locator("button", { hasText: /인사이트/ }).first();
  await btnIns.click();
  await p.waitForTimeout(1200);
  const modal = await p.evaluate(() => {
    const el = document.querySelector(".modal-card");
    if (!el) return null;
    const cs = getComputedStyle(el);
    const x = el.querySelector(".modal-close");
    return {
      bf: cs.backdropFilter,
      bg: cs.backgroundColor,
      xTransition: x ? getComputedStyle(x).transitionProperty : null
    };
  });
  ok(
    "modal material rolled back (opaque)",
    Boolean(modal && (modal.bf === "none" || !modal.bf)),
    JSON.stringify(modal)
  );
  ok(
    "modal-close has transform transition",
    Boolean(modal && modal.xTransition && modal.xTransition.includes("transform")),
    modal?.xTransition ?? ""
  );
  const x = p.locator(".modal-card .modal-close").first();
  await x.hover({ force: true });
  await p.waitForTimeout(150);
  const midTf = await x.evaluate((el) => getComputedStyle(el).transform);
  ok("modal-close rotates smoothly (mid-transition)", midTf !== "none", midTf.slice(0, 44));
  await p.context().close();
}

// 3) fly-ghost: 0.4초 시점에도 아직 또렷하게 보이는지
{
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto("http://localhost:3000/visual-fixture/studio", {
    waitUntil: "networkidle",
    timeout: 120000
  });
  await p.waitForTimeout(1200);
  await p.locator(".studio-event-pill").first().click();
  await p.waitForTimeout(400);
  const mid = await p.evaluate(() => {
    const g = document.querySelector(".fly-ghost");
    return g ? Number(getComputedStyle(g).opacity) : null;
  });
  ok("fly-ghost still visible at 400ms", mid !== null && mid > 0.5, `opacity=${mid}`);
  await p.waitForTimeout(800);
  ok("fly-ghost cleaned", (await p.locator(".fly-ghost").count()) === 0);
  await p.context().close();
}

console.log(out.join("\n"));
await b.close();
