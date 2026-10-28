import {test, expect, type Page} from '@playwright/test';
import {setup, finish, openSettings} from './helpers/typography-harmony';
import {settlePanelLayout} from './helpers/panel-layout';
import {companionTraceMode} from './helpers/companion-evidence-policy';

type TouchRecord = {type: string; act: string | null; at: number; prevented: boolean; preventedAfter?: boolean};
declare global {interface Window {settingsTouchProbe: TouchRecord[]}}
test.use({serviceWorkers: 'block', video: 'on', trace: companionTraceMode(), hasTouch: true, isMobile: true, actionTimeout: 15000});
async function within(page: Page, selector: string) {
  return page.locator(selector).first().evaluate(e => {
    const b = e.getBoundingClientRect(), p = e.closest('.rhh-panes')!.getBoundingClientRect();
    return b.top >= p.top && b.bottom <= p.bottom;
  });
}
async function scrollRest(page: Page) {
  return page.locator('.rhh-panes').evaluate(e => new Promise<{top: number; quietMs: number}>((resolve, reject) => {
    let previous = e.scrollTop, changed = performance.now();
    const started = changed;
    function sample() {
      const now = performance.now();
      if (Math.abs(e.scrollTop - previous) > .1) {previous = e.scrollTop; changed = now;}
      if (now - changed >= 400) return resolve({top: e.scrollTop, quietMs: now - changed});
      if (now - started > 5000) return reject(new Error('native scroll did not settle'));
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }));
}
test('Settings mobile320 real vertical scroll after30px', async ({page, context, baseURL}, info) => {
  test.setTimeout(120000);
  const proof = await setup(page, context, baseURL!, 320);
  await page.setViewportSize({width: 320, height: 640});
  await page.goto('/visual-fixture/poster?supportUX=cozy');
  await settlePanelLayout(page);
  await openSettings(page);
  await page.evaluate(() => {
    window.settingsTouchProbe = [];
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'touchend', 'mouseover', 'mousedown', 'mouseup', 'click']) {
      document.addEventListener(type, e => {
        const record: TouchRecord = {type, act: (e.target as Element | null)?.closest?.('[data-act]')?.getAttribute('data-act') ?? null, at: performance.now(), prevented: e.defaultPrevented};
        window.settingsTouchProbe.push(record);
        queueMicrotask(() => {record.preventedAfter = e.defaultPrevented;});
      }, true);
    }
  });
  const slider = page.getByRole('slider', {name: '달력 글씨 크기(px)', exact: true});
  await slider.focus();
  await slider.press('End');
  await expect(slider).toHaveValue('30');
  await settlePanelLayout(page);
  const pane = page.locator('.rhh-panes'), cdp = await context.newCDPSession(page), scrolls: number[] = [];
  async function swipe(up: boolean) {
    const b = (await pane.boundingBox())!, x = b.x + b.width * .75;
    const start = up ? b.y + b.height - 30 : b.y + 30, end = up ? b.y + 30 : b.y + b.height - 30;
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y: start}]});
    for (let i = 1; i <= 18; i++) {
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x, y: start + (end - start) * i / 18}]});
      await page.waitForTimeout(12);
    }
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await page.waitForTimeout(120);
    scrolls.push(await pane.evaluate(e => e.scrollTop));
  }
  try {
    for (let i = 0; i < 10 && !await within(page, '[data-act="text-weight-select"][data-act-opt="bold"]'); i++) await swipe(true);
    expect(scrolls.some(n => n > 0)).toBe(true);
    const downRest = await scrollRest(page), bold = page.locator('[data-act="text-weight-select"][data-act-opt="bold"]');
    await expect(bold).toBeInViewport({ratio: .9});
    await bold.tap();
    await expect(bold).toHaveAttribute('aria-checked', 'true');
    await info.attach('font-controls-reached-by-touch', {body: await page.screenshot(), contentType: 'image/png'});
    for (let i = 0; i < 10 && !await within(page, '[data-act="text-size"]'); i++) await swipe(false);
    const upRest = await scrollRest(page);
    await expect(slider).toBeInViewport({ratio: 1});
    const reset = page.getByRole('button', {name: '글자 설정 기본으로', exact: true});
    await expect(reset).toBeInViewport({ratio: 1});
    const resetBox = (await reset.boundingBox())!, resetPoint = {x: resetBox.x + resetBox.width / 2, y: resetBox.y + resetBox.height / 2};
    expect(await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.closest('[data-act]')?.getAttribute('data-act'), resetPoint)).toBe('text-style-reset');
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [resetPoint]});
    await page.waitForTimeout(80);
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await expect(slider).toHaveValue('14');
    const events = await page.evaluate(() => window.settingsTouchProbe);
    expect(events.filter(e => e.type === 'click' && e.act === 'text-style-reset')).toHaveLength(1);
    await finish(page, info, proof, {width: 320, height: 640, actualVerticalTouchSwipes: true, scrolls, downRest, upRest, events,
      weightControlReached: true, resetReached: true, resetSingleTap: true, resetTapDurationMs: 80, physicalDevice: false,
      source: 'native Chromium touch dispatch; measured scroll rest before single tap; no scrollTop setter', fullCertification: false});
  } finally {
    await info.attach('actual-touch-event-delivery', {body: JSON.stringify(await page.evaluate(() => window.settingsTouchProbe)), contentType: 'application/json'});
    await cdp.detach();
  }
});

