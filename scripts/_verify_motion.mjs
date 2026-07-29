// P1-MOTION-1 검증: OS reduce × 인앱 설정 4조합 → html[data-reduce-motion] 유무.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch();

const cases = [
  { os: "reduce", app: null, expect: true, name: "OS reduce · 인앱 미설정" },
  { os: "reduce", app: "off", expect: false, name: "OS reduce · 인앱 off(사용자 우선)" },
  { os: "no-preference", app: null, expect: false, name: "OS 일반 · 인앱 미설정" },
  { os: "no-preference", app: "on", expect: true, name: "OS 일반 · 인앱 on" }
];

for (const c of cases) {
  const ctx = await browser.newContext({ reducedMotion: c.os });
  const page = await ctx.newPage();
  if (c.app) {
    await page.addInitScript((v) => localStorage.setItem("vic.reduceMotion", v), c.app);
  }
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const has = await page.evaluate(() => document.documentElement.hasAttribute("data-reduce-motion"));
  console.log(`${c.name}: data-reduce-motion=${has} (기대 ${c.expect}) ${has === c.expect ? "PASS" : "FAIL"}`);
  await ctx.close();
}
await browser.close();
