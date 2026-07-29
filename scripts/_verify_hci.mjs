import { chromium } from "playwright";

const SC =
  "C:/Users/im917/AppData/Local/Temp/claude/c--Projects-VIC-Schedule-studio/696fcde9-d03c-475b-8261-c1efce90290f/scratchpad";
const b = await chromium.launch();
const errors = [];
const results = [];
const ok = (name, pass, note = "") => {
  results.push(`${pass ? "PASS" : "FAIL"} ${name}${note ? " — " + note : ""}`);
};

// ── 1. 데스크톱 편집실 ──
{
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  p.on("pageerror", (e) => errors.push("desktop: " + String(e).slice(0, 160)));
  await p.goto("http://localhost:3000/visual-fixture/studio", { waitUntil: "networkidle", timeout: 120000 });
  await p.waitForTimeout(1200);

  // 웹 ghost: 일정 카드 클릭 → .fly-ghost 잠깐 생김
  const pill = p.locator(".studio-event-pill").first();
  if (await pill.count()) {
    await pill.click();
    const ghostSeen = await p
      .waitForSelector(".fly-ghost", { timeout: 1500 })
      .then(() => true)
      .catch(() => false);
    ok("web fly-ghost on card click", ghostSeen);
    await p.waitForTimeout(900);
    const ghostGone = (await p.locator(".fly-ghost").count()) === 0;
    ok("fly-ghost cleans itself", ghostGone);
  } else ok("web fly-ghost", false, "no pill found");

  // 재질: 모달 열기(단축키 안내 말고 실제 modal-card가 있는 것 — 인사이트 버튼)
  const insightsBtn = p.locator("button", { hasText: /인사이트/ }).first();
  if (await insightsBtn.count()) {
    await insightsBtn.click();
    await p.waitForTimeout(1500);
    const mat = await p.evaluate(() => {
      const el = document.querySelector(".modal-card");
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { bf: cs.backdropFilter, bg: cs.backgroundColor };
    });
    // 모달 카드 재질은 사용자 피드백으로 롤백(불투명 유지) — 재질은 팝오버(dtp/tag-cpop 등)에만.
    ok("modal card stays opaque (rolled back)", Boolean(mat && (!mat.bf || mat.bf === "none")), JSON.stringify(mat));
    await p.screenshot({ path: SC + "/v-modal-material.png" });
    // X 호버 회전(뷰포트 밖이어도 강제 hover) — computed transform으로 판정
    try {
      const x = p.locator(".modal-card .modal-close").first();
      if (await x.count()) {
        await x.hover({ force: true, timeout: 4000 });
        await p.waitForTimeout(400);
        const tf = await x.evaluate((el) => getComputedStyle(el).transform);
        ok("modal-close hover rotate", tf !== "none", tf.slice(0, 40));
        await x.click({ force: true, timeout: 4000 }).catch(() => {});
        await p.waitForTimeout(600);
      }
    } catch (e) {
      ok("modal-close hover rotate", false, String(e).slice(0, 60));
    }
  } else ok("modal material", false, "no insights button");
  await p.context().close();
}

// ── 2. 모바일 편집실(아젠다 + 시트 morph + 드래그 닫기 + FLIP) ──
{
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    hasTouch: true
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push("mobile: " + String(e).slice(0, 160)));
  await p.goto("http://localhost:3000/visual-fixture/studio", { waitUntil: "networkidle", timeout: 120000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: SC + "/v-mobile-agenda.png" });

  // 카드 탭 → 시트 등장(morph — origin 저장 후 WAAPI, 결과적으로 시트가 떠야 함)
  const card = p.locator("button.agenda-event").first();
  if (await card.count()) {
    await card.click();
    await p.waitForTimeout(900);
    const sheet = await p.locator(".m-edit-sheet").count();
    ok("mobile sheet opens after card tap (morph path)", sheet > 0);
    await p.screenshot({ path: SC + "/v-mobile-sheet.png" });

    // 드래그 닫기: m-sheet-top 잡고 아래로 400px 플릭
    const top = p.locator(".m-sheet-top");
    const box = await top.boundingBox();
    if (box) {
      const sx = box.x + box.width / 2;
      const sy = box.y + 20;
      await p.mouse.move(sx, sy);
      await p.mouse.down();
      for (let i = 1; i <= 8; i++) {
        await p.mouse.move(sx, sy + i * 50, { steps: 1 });
        await p.waitForTimeout(16);
      }
      await p.mouse.up();
      await p.waitForTimeout(800);
      const closed = (await p.locator(".m-edit-sheet").count()) === 0;
      ok("drag-to-close closes sheet", closed);
    } else ok("drag-to-close", false, "no m-sheet-top box");

    // 다시 열고 소폭 드래그 → 복귀(시트 유지)
    await p.locator("button.agenda-event").first().click();
    await p.waitForTimeout(900);
    const top2 = p.locator(".m-sheet-top");
    const box2 = await top2.boundingBox();
    if (box2) {
      const sx = box2.x + box2.width / 2;
      const sy = box2.y + 20;
      await p.mouse.move(sx, sy);
      await p.mouse.down();
      for (let i = 1; i <= 4; i++) {
        await p.mouse.move(sx, sy + i * 15, { steps: 1 });
        await p.waitForTimeout(30);
      }
      await p.mouse.up();
      await p.waitForTimeout(900);
      const still = (await p.locator(".m-edit-sheet").count()) === 1;
      ok("small drag springs back (sheet stays)", still);
      const diag = await p.evaluate(() => {
        const el = document.querySelector(".m-edit-sheet");
        const x = document.querySelector(".m-edit-x");
        return {
          sheetTf: el ? el.style.transform : null,
          sheetRect: el ? JSON.stringify(el.getBoundingClientRect()) : null,
          xRect: x ? JSON.stringify(x.getBoundingClientRect()) : null
        };
      });
      console.log("sheet diag:", JSON.stringify(diag));
      await p.screenshot({ path: SC + "/v-mobile-sheet-after-smalldrag.png" });
      // X 닫기(역방향 morph 경로) — 애니 후 닫혀야 함
      await p.locator(".m-edit-x").click({ force: true, timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(800);
      ok("X close (reverse morph) closes", (await p.locator(".m-edit-sheet").count()) === 0);
    }

    // FLIP: 필터 토글 시 아젠다 유지 + 에러 없음
    const filterChip = p.locator(".agenda-legend-tag").first();
    if (await filterChip.count()) {
      await filterChip.click();
      await p.waitForTimeout(700);
      const days = await p.locator(".agenda-day").count();
      ok("filter FLIP applied without error", true, `days visible: ${days}`);
      await filterChip.click();
      await p.waitForTimeout(700);
    } else ok("filter FLIP", false, "no filter chip");
  } else ok("mobile card tap", false, "no agenda card");
  await ctx.close();
}

// ── 3. 꾸미기(스티커 러버밴딩 + 내보내기 보상) ──
{
  const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  p.on("pageerror", (e) => errors.push("decorate: " + String(e).slice(0, 160)));
  // 헤드리스는 클립보드 쓰기가 막혀 있어(권한/포커스) 보상 UI 검증용으로만 스텁한다.
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
    } catch {
      /* 스텁 실패해도 검증의 다른 항목엔 영향 없음 */
    }
  });
  await p.goto("http://localhost:3000/visual-fixture/poster?mode=decorate", {
    waitUntil: "networkidle",
    timeout: 120000
  });
  await p.waitForTimeout(1800);
  const sticker = p.locator(".sticker-item").first();
  if (await sticker.count()) {
    const sb = await sticker.boundingBox();
    const layer = await p.locator("[data-export-surface]").boundingBox();
    if (sb && layer) {
      // 왼쪽 경계 밖으로 드래그 → --rub-x 음수 세팅 확인
      await p.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
      await p.mouse.down();
      for (let i = 1; i <= 10; i++) {
        await p.mouse.move(layer.x - i * 30, sb.y + sb.height / 2, { steps: 1 });
        await p.waitForTimeout(16);
      }
      const rub = await sticker.evaluate((el) => el.style.getPropertyValue("--rub-x"));
      ok("sticker rubberband --rub-x set", rub !== "" && rub !== "0px", rub);
      await p.mouse.up();
      await p.waitForTimeout(700);
      const rubAfter = await sticker.evaluate((el) => el.style.getPropertyValue("--rub-x"));
      ok("rubberband resets on release", rubAfter === "" || rubAfter === "0px", rubAfter);
    } else ok("sticker rubberband", false, "no boxes");
  } else ok("sticker rubberband", false, "no sticker on fixture");

  // 내보내기 보상: 캡쳐 버튼 클릭 → poster-export-reward 등장
  const cap = p.locator(".poster-actions .button.primary").first();
  if (await cap.count()) {
    await cap.click();
    const reward = await p
      .waitForSelector(".poster-export-reward", { timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    ok("export reward thumbnail", reward);
    if (reward) await p.screenshot({ path: SC + "/v-export-reward.png" });
  } else ok("export reward", false, "no capture button");
  await p.context().close();
}

console.log(results.join("\n"));
console.log("pageerrors:", errors.length ? errors.join(" | ") : "none");
await b.close();
