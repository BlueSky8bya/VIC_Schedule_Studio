import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { guardCompanionQa } from './helpers/companion-qa';
import { openCompanionHome } from './helpers/companion-home';
import { settlePanelLayout } from './helpers/panel-layout';
import { companionTraceMode } from './helpers/companion-evidence-policy';
import { ART_DIR, ART_SLOTS, slotFiles } from '@/components/shared/ambient/art/manifest';

test.use({ serviceWorkers: 'block', video: 'on', trace: companionTraceMode() });
const backgroundArtPaths = new Set(ART_SLOTS.flatMap(slotFiles).filter(file => !existsSync(resolve('public/ambient/art', file))).map(file => `${ART_DIR}/${file}`));
async function guard(page: Page, context: Parameters<typeof guardCompanionQa>[1], base: string) {
  const proof = await guardCompanionQa(page, context, base);
  // These declared optional slots do not exist in this fixture snapshot. Their
  // documented procedural fallback is enough for settings/input QA; no art
  // coverage or new asset download is claimed. Other paths keep the guard.
  await context.route('**/ambient/art/**', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === base && request.method() === 'GET' && backgroundArtPaths.has(url.pathname)) {
      proof.syntheticReads.push('optional-background-art-404');
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Optional fixture art unavailable; procedural fallback.' });
    }
    return route.fallback();
  });
  await context.route('**/studio/**', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === base && request.method() === 'GET' && ['/studio/ambient-art', '/studio/search-dictionary', '/studio/timelines'].includes(url.pathname)) {
      proof.syntheticReads.push('excluded-settings-destination-get'); return route.fulfill({ status: 404, body: 'Excluded developer destination.' });
    }
    return route.fallback();
  });
  return proof;
}
type Config = { surface: 'viewer' | 'owner' | 'developer' | 'preview'; width: number; dark: boolean; mode: 'full' | 'lite' | 'soft' };
const configs: Config[] = [
  { surface: 'viewer', width: 1440, dark: false, mode: 'full' },
  { surface: 'owner', width: 1440, dark: false, mode: 'lite' },
  { surface: 'developer', width: 1920, dark: true, mode: 'soft' },
  { surface: 'preview', width: 1920, dark: true, mode: 'full' },
];
const settings = (page: Page) => page.getByRole('dialog', { name: '설정', exact: true });
const autoLabel = (mode: Config['mode']) => mode === 'full' ? '자동 · 풍부하게' : mode === 'lite' ? '자동 · 가볍게' : '자동 · 효과 쉬기';
async function seed(page: Page, config: Pick<Config, 'width' | 'dark' | 'mode'> & { companion?: boolean }) {
  await page.setViewportSize({ width: config.width, height: 1000 });
  await page.addInitScript(({ dark, mode, companion }) => {
    localStorage.setItem('vic.settingsEpoch', '2026-09-04');
    localStorage.setItem('vic.viewerCompanion', JSON.stringify({ version: 1, enabled: Boolean(companion) }));
    localStorage.setItem('vic.sound', 'off'); localStorage.setItem('vic.ambient', 'on'); localStorage.setItem('vic.gfxPref', 'auto');
    localStorage.setItem('vic.gfx', JSON.stringify({ mode, at: Date.now(), v: 3 }));
    localStorage.setItem('vic.dark', dark ? 'on' : 'off');
  }, config);
}
async function openSettings(page: Page) {
  let trigger = page.getByRole('button', { name: '설정', exact: true }).filter({ visible: true }).first();
  const fold = page.getByRole('button', { name: '패널 펼치기', exact: true });
  await expect.poll(async () => await trigger.count() + await fold.count(), { timeout: 15000 }).toBeGreaterThan(0);
  await settlePanelLayout(page);
  const box = await trigger.count() ? await trigger.boundingBox() : null;
  if (!box || box.x + box.width <= 0) { await page.getByRole('button', { name: '패널 펼치기', exact: true }).click(); await settlePanelLayout(page); trigger = page.getByRole('button', { name: '설정', exact: true }).filter({ visible: true }).first(); }
  await trigger.click(); await expect(settings(page)).toBeVisible(); await settlePanelLayout(page); return settings(page);
}
async function finish(page: Page, info: TestInfo, proof: Awaited<ReturnType<typeof guardCompanionQa>>, facts: unknown) {
  await Promise.all(proof.pending); expect(proof.errors).toEqual([]); expect(proof.rejected).toEqual([]); expect(proof.mutations).toEqual([]); expect(proof.liveReads).toEqual([]);
  expect(proof.chunks.length).toBeGreaterThan(0); expect(proof.chunks.every(c => c.served === c.local)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await info.attach('final-ui', { body: await page.screenshot(), contentType: 'image/png' });
  await info.attach('observation', { body: JSON.stringify({ facts, syntheticFixture: true, cachedGraphicsCondition: true, operatingWrites: 0, realOsIme: false, fullCertification: false, proof: { ...proof, pending: undefined } }), contentType: 'application/json' });
}

for (const config of configs) test(`Accepted settings ${config.surface} ${config.width}: section memory and ${config.mode} quality`, async ({ page, context, baseURL }, info) => {
  const proof = await guard(page, context, baseURL!); await seed(page, config);
  await page.goto(config.surface === 'viewer' ? '/visual-fixture/poster?y=2026&m=6' : `/visual-fixture/studio?y=2026&m=6&role=${config.surface === 'developer' ? 'developer' : 'owner'}${config.surface === 'preview' ? '&viewer=1' : ''}`);
  let dialog = await openSettings(page); const start = await dialog.boundingBox();
  await dialog.getByRole('tab', { name: '배경', exact: true }).click();
  const quality = page.locator('[data-act="gfx-pref-select"]'); await expect(quality).toHaveText(autoLabel(config.mode));
  await quality.click(); await page.getByRole('option', { name: '항상 최대', exact: true }).click(); await expect(quality).toHaveText('항상 최대');
  await quality.click(); await page.getByRole('option', { name: autoLabel(config.mode), exact: true }).click(); await expect(quality).toHaveText(autoLabel(config.mode));
  // The incoming auto decision is synthetic; this does not measure GPU speed.
  await page.evaluate(() => { localStorage.setItem('vic.gfx', JSON.stringify({ mode: 'lite', at: Date.now(), v: 3 })); document.documentElement.setAttribute('data-gfx', 'lite'); window.dispatchEvent(new CustomEvent('vic:gfx-auto', { detail: { mode: 'lite' } })); });
  await expect(quality).toHaveText('자동 · 가볍게');
  const ambient = dialog.getByRole('radiogroup', { name: '계절 배경 상태 고르기', exact: true });
  await ambient.getByRole('radio', { name: '끄기', exact: true }).click(); await expect(quality).toBeDisabled(); await expect(quality).toHaveText('끄기');
  await ambient.getByRole('radio', { name: '켜기', exact: true }).click(); await expect(quality).toBeEnabled(); await expect(quality).toHaveText('자동 · 가볍게');
  await info.attach('quality-current', { body: await page.screenshot(), contentType: 'image/png' });
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  dialog = await openSettings(page); await expect(dialog.getByRole('tab', { name: '배경', exact: true })).toHaveAttribute('aria-selected', 'true');
  await settlePanelLayout(page); const reopened = await dialog.boundingBox(); expect(Math.abs(reopened!.height - start!.height)).toBeLessThan(2);
  await info.attach('section-restored', { body: await page.screenshot(), contentType: 'image/png' });
  await page.reload(); dialog = await openSettings(page); await expect(dialog.getByRole('tab', { name: '글자', exact: true })).toHaveAttribute('aria-selected', 'true');
  await finish(page, info, proof, { config, automaticLabel: autoLabel(config.mode), syntheticIncomingDecision: 'lite', fixedPreferenceAndOffPreserved: true, lastSectionRestored: true, reloadDefaultsToText: true, noPersistentSectionStorage: true, start, reopened });
});

test('Accepted settings PC resize: hidden remembered section and notebook override remain safe', async ({ page, context, baseURL }, info) => {
  const proof = await guard(page, context, baseURL!); await seed(page, { width: 1440, dark: false, mode: 'full', companion: true });
  await page.goto('/visual-fixture/studio?y=2026&m=6'); let dialog = await openSettings(page);
  await dialog.getByRole('tab', { name: '배경', exact: true }).click(); await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 }); dialog = await openSettings(page); await expect(dialog.getByRole('tab', { name: '글자', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.locator('[role="tabpanel"]:visible')).toHaveCount(1); await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 1000 }); dialog = await openSettings(page); await dialog.getByRole('tab', { name: '소리', exact: true }).click(); await page.keyboard.press('Escape');
  // Explicit notebook entry is a separate host intent, never a remembered tab.
  const home = await openCompanionHome(page); await home.locator('[data-home-action="book"]').click();
  await expect(page.getByRole('dialog', { name: '빅타민 수첩', exact: true })).toBeVisible(); await page.keyboard.press('Escape');
  dialog = await openSettings(page); await expect(dialog.getByRole('tab', { name: '소리', exact: true })).toHaveAttribute('aria-selected', 'true');
  await finish(page, info, proof, { hiddenSectionFallback: true, explicitNotebookEntryObserved: true, singlePanel: true });
});

for (const config of [{ width: 1440, dark: false, role: 'owner' }, { width: 1920, dark: true, role: 'developer' }]) test(`Accepted premiere ${config.width}: numeric input KST boundary and nested Escape`, async ({ page, context, baseURL }, info) => {
  const proof = await guard(page, context, baseURL!); await seed(page, { ...config, mode: 'full' });
  await page.goto(`/visual-fixture/studio?y=2026&m=6&role=${config.role}`); await page.locator('[data-act="calendar-cell"]').nth(18).dblclick();
  const content = page.getByRole('textbox', { name: '내용', exact: true }).filter({ visible: true }); await content.fill('공개 시각 합성 검증\n입력은 운영에 저장하지 않음');
  await page.locator('[data-act="fold-head"]').click(); await page.locator('.opt-chip.teaser').click(); const trigger = page.locator('[data-act="dtp-trigger"]'); await trigger.click();
  const picker = page.getByRole('dialog', { name: '공개 시각 선택', exact: true }), hour = page.getByRole('spinbutton', { name: '공개 시 (24시간)', exact: true }), minute = page.getByRole('spinbutton', { name: '공개 분', exact: true });
  await expect(hour).toHaveValue('21'); await hour.fill('21'); await hour.press('Enter'); await expect(trigger).toContainText('오후 9:00'); await hour.fill('23'); await hour.press('Enter'); await minute.fill('37'); await minute.press('Enter');
  await expect(page.locator('.dtp-wheel').last().locator('.on')).toHaveText('37'); await expect(content).toBeVisible(); await expect(picker).toBeVisible();
  await minute.fill('99'); await expect(minute).toHaveAttribute('aria-invalid', 'true'); await minute.press('Enter'); await expect(minute).toHaveValue('37');
  await minute.fill(''); await minute.press('Tab'); await expect(minute).toHaveValue('37');
  await minute.fill('38'); await minute.press('Tab'); await expect(page.locator('.dtp-wheel').last().locator('.on')).toHaveText('38'); await expect(trigger).toContainText(':38');
  await minute.fill('37'); await minute.press('Enter');
  await minute.focus(); await minute.press('End'); await expect(minute).toHaveValue('59'); await minute.press('ArrowUp'); await expect(minute).toHaveValue('59');
  await hour.focus(); await hour.press('ArrowUp'); await expect(hour).toHaveValue('23'); await hour.press('Home'); await expect(hour).toHaveValue('00'); await hour.press('End');
  const title = page.locator('.dtp-title');
  for (let count = 0; count < 12 && await title.innerText() !== '2026년 12월'; count++) await picker.getByRole('button', { name: '다음 달', exact: true }).click();
  await expect(title).toHaveText('2026년 12월'); await picker.locator('button.dtp-cell').filter({ hasText: /^31$/ }).click();
  await minute.fill('11'); await minute.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, keyCode: 229, bubbles: true }); await expect(page.locator('.dtp-wheel').last().locator('.on')).toHaveText('59');
  await minute.dispatchEvent('keydown', { key: 'Escape', code: 'Escape', isComposing: true, keyCode: 229, bubbles: true }); await expect(picker).toBeVisible(); await expect(content).toBeVisible();
  await minute.fill('59'); await minute.press('Control+Enter'); await expect(picker).toBeVisible(); await expect(content).toBeVisible();
  await info.attach('numeric-desktop', { body: await page.screenshot(), contentType: 'image/png' });
  await minute.fill('12'); await minute.press('Escape'); await expect(picker).toHaveCount(0); await expect(trigger).toBeFocused(); await expect(trigger).toContainText('2026.12.31'); await expect(trigger).toContainText('11:59'); await expect(content).toBeVisible();
  await trigger.click(); await picker.getByRole('button', { name: '다음 달', exact: true }).click(); await picker.locator('button.dtp-cell').filter({ hasText: /^1$/ }).click(); await hour.fill('0'); await hour.press('Enter'); await minute.fill('0'); await minute.press('Enter');
  await picker.getByRole('button', { name: '확인', exact: true }).click(); await expect(trigger).toContainText('2027.01.01'); await expect(trigger).toContainText('오전 12:00');
  await trigger.click(); await page.locator('.dtp-wheel').last().getByRole('button', { name: '01', exact: true }).click(); await expect(minute).toHaveValue('01');
  await minute.press('ArrowUp'); await expect(minute).toHaveValue('02'); await minute.press('Tab'); await page.waitForTimeout(250); await expect(minute).toHaveValue('02');
  await picker.getByRole('button', { name: '확인', exact: true }).click();
  await finish(page, info, proof, { config, invalidAndEmptyRestored: true, boundary: '2026-12-31T23:59 -> 2027-01-01T00:02 KST', syntheticComposingGuard: true, controlEnterDidNotSaveParent: true, escapeDiscardedUncommittedDraft: true, pointerWheelAndDirectFieldCoherent: true });
});

test('Accepted premiere mobile390: existing wheels and nested Escape remain intact', async ({ page, context, baseURL }, info) => {
  const proof = await guard(page, context, baseURL!); await seed(page, { width: 390, dark: false, mode: 'full' });
  await page.goto('/visual-fixture/studio?role=owner&y=2026&m=6'); await page.locator('[data-act="agenda-event"]').first().click();
  await page.locator('[data-act="me-fold-head"]').click(); await page.locator('.opt-chip.teaser:visible').click(); const trigger = page.locator('[data-act="dtp-trigger"]:visible'); await trigger.click();
  const picker = page.getByRole('dialog', { name: '공개 시각 선택', exact: true }); await expect(picker).toBeVisible(); await expect(picker.getByRole('spinbutton')).toHaveCount(0); await expect(picker.locator('.dtp-wheel button')).toHaveCount(84);
  await page.locator('.dtp-wheel').last().getByRole('button', { name: '01', exact: true }).click(); await expect(page.locator('.dtp-readout')).toContainText(':01');
  await page.keyboard.press('Escape'); await expect(picker).toHaveCount(0); await expect(page.locator('.m-edit-sheet')).toBeVisible(); await expect(trigger).toBeFocused();
  await finish(page, info, proof, { width: 390, unchangedMobileWheels: 84, noNewNumericFields: true, nestedEscapeKeepsEditor: true, physicalDevice: false });
});
