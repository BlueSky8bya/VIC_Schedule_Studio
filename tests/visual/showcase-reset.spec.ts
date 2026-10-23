import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";

const fonts=new Set([...readFileSync('app/fonts.css','utf8').matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(m=>m[1]));
test.beforeEach(async({page,context,baseURL})=>{
  const origin=new URL(baseURL!).origin;
  await context.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url());
    if(request.method()==='GET'&&request.resourceType()==='font'&&fonts.has(url.href))return fulfillReadOnlyFont(route,fonts,[]);
    if(url.origin!==origin||!['GET','HEAD'].includes(request.method()))return route.abort();
    if(url.pathname.startsWith('/api/'))return route.fulfill({status:404,body:'Credential-free showcase fixture'});
    return route.continue();
  });
  await page.addInitScript(({epoch,key})=>{localStorage.setItem(key,epoch);localStorage.setItem('vic.gfxPref','max');localStorage.setItem('vic.gfx',JSON.stringify({mode:'full',v:3,at:Date.now()}));localStorage.setItem('vic.sound','off');},{epoch:SETTINGS_EPOCH,key:SETTINGS_EPOCH_KEY});
});

async function showcaseTrigger(page: Page) {
  await page.waitForFunction(() => Boolean(window.__vicAmbient));
  const section = page.locator('[data-panel-section-toggle="season"]:visible').first();
  if (await section.getAttribute('aria-expanded') === 'false') await section.click();
  return page.locator('[data-act="ambient-showcase"]:visible').first();
}

test("showcase background clicks cannot activate hidden studio controls", async ({page}) => {
  await page.addInitScript(() => localStorage.setItem("vic.ambient", "on"));
  await page.route("**/api/studio-write", route => route.fulfill({json:{ok:true}}));
  await page.goto("/visual-fixture/studio?role=developer&y=2026&m=3");
  await page.waitForFunction(() => Boolean(window.__vicAmbient));
  const tags=page.locator('[data-panel-section-toggle="tag-filter"]:visible').first();
  if(await tags.getAttribute('aria-expanded')==='false')await tags.click();
  const hiddenButton=page.locator('.tag-legend-filter').first();
  await expect(hiddenButton).toBeVisible();
  await hiddenButton.evaluate(el=>{
    el.setAttribute('data-test-clicks','0');
    el.addEventListener('click',()=>el.setAttribute('data-test-clicks',String(Number(el.getAttribute('data-test-clicks'))+1)));
  });
  await page.evaluate(()=>{
    const preserved=document.createElement('div');preserved.id='already-inert';preserved.inert=true;document.body.append(preserved);
  });
  const trigger=await showcaseTrigger(page);
  await trigger.click();
  await page.evaluate(()=>{
    const portal=document.createElement('button');portal.id='late-background-portal';portal.textContent='background portal';document.body.append(portal);
  });
  await expect(page.locator('#late-background-portal')).toHaveAttribute('inert','');
  const box=await hiddenButton.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x+box!.width/2,box!.y+box!.height/2);
  await expect(hiddenButton).toHaveAttribute('data-test-clicks','0');
  // Releasing after Escape must not activate the button revealed underneath.
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
  await page.mouse.down();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(hiddenButton).toHaveAttribute('data-test-clicks','0');
  await expect(trigger).toBeFocused();
  await expect(page.locator('#late-background-portal')).not.toHaveAttribute('inert','');
  await expect(page.locator('#already-inert')).toHaveAttribute('inert','');
  await hiddenButton.click();
  await expect(hiddenButton).toHaveAttribute('data-test-clicks','1');
});

test("showcase experiments end on exit; calendar months control seasons again", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("vic.ambient", "on"));
  await page.route("**/api/studio-write", route => route.fulfill({ json: { ok: true } }));
  await page.goto("/visual-fixture/studio?role=developer&y=2026&m=3");
  await page.waitForFunction(() => window.__vicAmbient?.season === "spring");
  await (await showcaseTrigger(page)).click();
  await page.getByRole("button", { name: "배경 설정", exact: true }).click();
  await page.getByRole("radiogroup", { name: "방향", exact: true }).getByRole("radio", { name: "북", exact: true }).click();
  await page.getByRole("button", { name: "다음 날", exact: true }).click();
  await page.getByRole("slider", { name: "하루 시각" }).focus();
  await page.keyboard.press("Home");
  await page.locator(".sc-set-more summary").click();
  await page.getByRole("radiogroup", { name: "계절", exact: true }).getByRole("radio", { name: "겨울", exact: true }).click();
  await page.waitForFunction(() => window.__vicAmbient?.season === "winter");
  await page.keyboard.press("Escape");
  await expect(page.locator("html[data-showcase]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-showcase") && window.__vicAmbient?.season === "spring");
  const restored = await page.evaluate(() => window.__vicAmbient!.world());
  expect(restored.skyBearing).toBe("south");
  expect(restored.date).toMatch(/^2026-3-/);
  const kst = new Date(Date.now()+9*3600000);
  expect(Math.abs(restored.hour-(kst.getUTCHours()+kst.getUTCMinutes()/60))).toBeLessThan(.05);
  for (let month = 4; month <= 12; month++) {
    await page.locator('[data-act="month-next"]:visible').first().click();
    await page.waitForFunction(m => window.__vicAmbient?.world().date.startsWith(`2026-${m}-`), month);
    expect(await page.evaluate(() => window.__vicAmbient!.season)).toBe(month <= 5 ? "spring" : month <= 8 ? "summer" : month <= 11 ? "autumn" : "winter");
  }
});

test("calendar stays interactive while backdrop images are pending", async ({page}) => {
  await page.addInitScript(() => localStorage.setItem("vic.ambient", "on"));
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let requested = 0;
  await page.route("**/ambient/art/backdrop-meadow-*.png", async route => {
    requested++;
    await pending;
    await route.continue();
  });
  try {
    await page.goto("/visual-fixture/studio?role=developer&y=2026&m=3", {waitUntil:"domcontentloaded"});
    await expect.poll(() => requested).toBeGreaterThan(0);
    for(let i=0;i<3;i++)await page.locator('[data-act="month-next"]:visible').first().click();
    await page.waitForFunction(() => window.__vicAmbient?.season === "summer");
    await (await showcaseTrigger(page)).click();
    await page.getByRole("button", {name:"배경 설정",exact:true}).click();
    await expect(page.getByRole("dialog",{name:"배경 설정",exact:true})).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(page.locator("html[data-showcase]")).toHaveCount(0);
  } finally { release(); }
  await page.waitForFunction(() => window.__vicAmbient?.pending() === 0);
  expect(await page.evaluate(() => window.__vicAmbient?.season)).toBe("summer");
});

for (const entry of ["mouse", "keyboard"] as const) {
  test(`single meadow consumes arrows after ${entry} entry and restores focus`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("vic.ambient", "on"));
    await page.goto("/visual-fixture/studio?role=developer&y=2026&m=3");
    await page.waitForFunction(() => window.__vicAmbient?.biome() === "meadow");
    const trigger = await showcaseTrigger(page);
    if (entry === "mouse") await trigger.click();
    else { await trigger.focus(); await page.keyboard.press("Enter"); }
    await expect(page.getByRole("region", { name: "배경 감상", exact: true })).toBeFocused();
    // The old directional shortcuts must not move to a retired map or change the calendar.
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".biome-map, .biome-chev, .biome-pill")).toHaveCount(0);
    expect(await page.evaluate(() => window.__vicAmbient!.biome())).toBe("meadow");
    await page.getByRole("button", { name: "배경 설정", exact: true }).click();
    const slider = page.getByRole("slider", { name: "하루 시각" });
    await slider.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(slider).toBeFocused();
    expect(await page.evaluate(() => window.__vicAmbient!.biome())).toBe("meadow");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(page.locator("html[data-showcase]")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}


for (const surface of ["viewer", "owner", "preview"] as const) {
  test(`single meadow opens for ${surface}; environment choices are local to viewing`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("vic.ambient", "dim"));
    await page.route("**/api/studio-write", route => route.fulfill({ json: { ok: true } }));
    const target = surface === "viewer" ? "/visual-fixture/poster?ambient=summer"
      : `/visual-fixture/studio?role=owner&y=2026&m=6${surface === "preview" ? "&viewer=1" : ""}`;
    await page.goto(target);
    await page.waitForFunction(() => window.__vicAmbient?.season === "summer");
    const trigger = await showcaseTrigger(page);
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.locator(".biome-map, .biome-chev, .biome-pill")).toHaveCount(0);
    const gear = page.getByRole("button", { name: "배경 설정", exact: true });
    await expect(gear).toBeVisible();
    const controls = await page.locator(".showcase-exit, .showcase-gear").evaluateAll(elements => elements.map(element => Number(getComputedStyle(element).opacity)));
    expect(controls).toHaveLength(2);
    expect(controls.every(opacity => opacity > 0 && opacity < 1)).toBe(true);
    await gear.click();
    await page.locator(".sc-set-more summary").click();
    await page.getByRole("radiogroup", { name: "계절", exact: true }).getByRole("radio", { name: "겨울", exact: true }).click();
    await page.waitForFunction(() => window.__vicAmbient?.season === "winter");
    await page.keyboard.press("Escape");
    await expect(page.locator("html[data-showcase]")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-showcase") && window.__vicAmbient?.season === "summer");
    await expect(trigger).toBeFocused();
    await expect(page.locator("html")).toHaveAttribute("data-ambient", "dim");
    // A fresh viewing session starts from the outside calendar, not the last experiment.
    await trigger.click();
    await gear.click();
    await page.locator(".sc-set-more summary").click();
    await expect(page.getByRole("radiogroup", { name: "계절", exact: true }).getByRole("radio", { name: "겨울", exact: true })).toHaveAttribute("aria-checked", "false");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.locator('[data-act="ambient-toggle-viewer"][data-mode="off"]').first().click();
    await expect(trigger).toHaveCount(0);
  });
}
