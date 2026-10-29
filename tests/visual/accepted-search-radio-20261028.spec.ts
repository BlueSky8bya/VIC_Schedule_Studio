import { test, expect, type Page, type BrowserContext, type CDPSession } from '@playwright/test';
import { setup, finish } from './helpers/typography-harmony';
import { settlePanelLayout } from './helpers/panel-layout';
import { companionTraceMode } from './helpers/companion-evidence-policy';
import { COMPANION_RADIO_TRACKS } from '@/lib/ui/viewer-companion/radio-catalog';

test.use({ serviceWorkers: 'block', video: 'on', trace: companionTraceMode(), actionTimeout: 15000 });

const hits = [
  { kind: 'event', eventId: 'evt-001', title: '합성 공개 일정', snippet: '로컬 검증', startTime: '20:00' },
  { kind: 'vod', titleNo: 90000001, title: '합성 다시보기', snippet: '', durationMs: 3600000 },
  { kind: 'chapter', titleNo: 90000001, sec: 120, title: '합성 타임라인', snippet: '로컬 검증', matchedOn: 'timeline', durationMs: 3600000 },
  { kind: 'chapter', titleNo: 90000001, sec: 180, title: '합성 채팅', snippet: '로컬 검증', matchedOn: 'chat', durationMs: 3600000 }
].map(hit => ({ dateKey: '2026-06-16', score: 1, exact: true, popularity: .5, ...hit }));

async function searchFixture(context: BrowserContext, base: string, proof: Awaited<ReturnType<typeof setup>>) {
  const requests: { method: string; sequence: number }[] = [];
  await context.route('**/api/public/*/search**', route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== 'GET' || url.origin !== base) return route.fallback();
    if (url.pathname.endsWith('/search/trending')) { proof.syntheticReads.push('exact-search-trending-empty'); return route.fulfill({ json: { trends: [] } }); }
    if (url.pathname.endsWith('/search/suggest')) { proof.syntheticReads.push('exact-search-suggest-empty'); return route.fulfill({ json: { items: [] } }); }
    if (!/^\/api\/public\/[^/]+\/search$/.test(url.pathname)) return route.fallback();
    requests.push({ method: request.method(), sequence: requests.length + 1 }); proof.syntheticReads.push('exact-submitted-search-local-response');
    return route.fulfill({ json: { query: url.searchParams.get('q'), hits } });
  });
  return requests;
}

async function openTool(page: Page, name: string) {
  let button = page.getByRole('button', { name, exact: true }).filter({ visible: true }).first();
  if (!await button.count() || !await button.isVisible()) { await page.getByRole('button', { name: '패널 펼치기', exact: true }).click(); await settlePanelLayout(page); button = page.getByRole('button', { name, exact: true }).filter({ visible: true }).first(); }
  await button.click(); return button;
}

for (const scenario of [
  { surface: 'viewer', width: 1440, url: '/visual-fixture/poster?y=2026&m=6' },
  { surface: 'studio', width: 1920, url: '/visual-fixture/studio?role=owner&y=2026&m=6' },
  { surface: 'preview', width: 1440, url: '/visual-fixture/studio?role=developer&viewer=1&y=2026&m=6' },
  { surface: 'viewer-mobile', width: 390, url: '/visual-fixture/poster?y=2026&m=6' }
]) test(`Accepted search submit ${scenario.surface} ${scenario.width} preserves native activation and filters`, async ({ page, context, baseURL }, info) => {
  const proof = await setup(page, context, baseURL!, scenario.width), requests = await searchFixture(context, baseURL!, proof);
  await page.goto(scenario.url); await settlePanelLayout(page);
  const opener = await openTool(page, '검색'), dialog = page.getByRole('dialog', { name: '검색', exact: true }), input = dialog.getByRole('searchbox', { name: '검색어', exact: true }), submit = dialog.locator('[data-act="search-submit"]');
  await expect(submit).toHaveAttribute('aria-label', '검색 실행'); await expect(submit).toBeDisabled(); await expect(input).toHaveValue('');
  await input.fill('합성 연결'); await expect(submit).toBeEnabled(); await page.waitForTimeout(180); expect(requests).toHaveLength(0);
  const activations: string[] = [];
  for (const mode of ['pointer', 'Enter', 'Space', 'input-Enter'] as const) {
    if (mode === 'pointer') await submit.click();
    else if (mode === 'input-Enter') { await input.focus(); await input.press('Enter'); }
    else { await submit.focus(); await submit.press(mode); }
    activations.push(mode); await expect.poll(() => requests.length).toBe(activations.length);
    await expect(dialog.locator('[data-act="search-hit-event"]')).toHaveCount(1);
    await expect(dialog.locator('[data-act="search-hit-vod"]')).toHaveCount(1);
    await expect(dialog.locator('[data-act="search-hit-chapter"]')).toHaveCount(2);
    await page.waitForTimeout(140); expect(requests).toHaveLength(activations.length);
  }
  const kinds = dialog.getByRole('group', { name: '검색 결과 종류', exact: true });
  await kinds.locator('[data-act-opt="event"]').click(); await expect(kinds.locator('[data-act-opt="event"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.locator('[data-act="search-hit-event"]')).toHaveCount(1); await expect(dialog.locator('[data-act="search-hit-vod"]')).toHaveCount(0); await expect(dialog.locator('[data-act="search-hit-chapter"]')).toHaveCount(0);
  await kinds.locator('[data-act-opt="all"]').click(); await expect(dialog.locator('[data-act="search-hit-chapter"]')).toHaveCount(2); expect(requests).toHaveLength(4);
  const geometry = await submit.evaluate(button => { const input = button.parentElement!.querySelector('input')!, b = button.getBoundingClientRect(), i = input.getBoundingClientRect(); return { button: b.toJSON(), input: i.toJSON(), overlapsInput: b.right > i.left + 1 }; });
  expect(geometry.overlapsInput).toBe(false); expect(geometry.button.x).toBeGreaterThanOrEqual(0); expect(geometry.button.right).toBeLessThanOrEqual(scenario.width);
  await info.attach('accepted-search-results', { body: await page.screenshot(), contentType: 'image/png' });
  await dialog.getByRole('button', { name: '닫기', exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
  await opener.click(); await expect(dialog).toBeVisible(); await dialog.getByRole('button', { name: '지우기', exact: true }).click(); await expect(input).toHaveValue(''); await expect(submit).toBeDisabled(); expect(requests).toHaveLength(4); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await finish(page, info, proof, { adoptedKey: 'search:mouse-submit-existing-magnifier', ...scenario, inputOnlyFullSearchRequests: 0, requests, activations, oneGetPerActivation: true, kindFilterNoNewRequest: true, fixedLabel: '검색 실행', geometry, closeReturnsToOpener: true, syntheticQueriesOnly: true, operatingSearchReads: 0 });
});

async function radioSetup(page: Page, context: BrowserContext, base: string, width: number, surface: 'viewer' | 'owner') {
  const proof = await setup(page, context, base, width);
  await page.addInitScript(() => {
    localStorage.setItem('vic.viewerCompanion', JSON.stringify({ version: 1, enabled: true, sound: true, soundVolume: 60 }));
    localStorage.setItem('vic.companionRadio.v1', JSON.stringify({ enabled: true, volume: 35, react: false, excludedIds: [] })); localStorage.setItem('vic.sound', 'on');
  });
  await page.goto(surface === 'viewer' ? '/visual-fixture/poster?y=2026&m=6' : '/visual-fixture/studio?role=owner&y=2026&m=6'); await settlePanelLayout(page);
  return proof;
}
async function openRadio(page: Page) {
  // Settings deliberately remembers its last section. Reopening directly into
  // Companion is valid; do not require the unrelated text-size slider first.
  const dialog = page.getByRole('dialog', { name: '설정', exact: true });
  if (!await dialog.isVisible()) await openTool(page, '설정');
  await expect(dialog).toBeVisible(); await dialog.locator('[data-tab="companion"]:visible').click(); await dialog.locator('[data-profile-page="settings"]:visible').click(); await dialog.locator('[data-companion-tab="sound"]:visible').click();
  const radio = dialog.locator('.rhh-companion-radio:visible'); await expect(radio).toBeVisible(); return radio;
}
type NativeAudio = { src: string; currentSrc: string; readyState: number; paused: boolean; currentTime: number; duration: number | null; error: number | null };
/** Read existing native audio instances through Chromium's object inspector.
 * No Audio/play/clock override, controller call or synthetic success event. */
async function nativeAudioReader(context: BrowserContext, page: Page) {
  const session: CDPSession = await context.newCDPSession(page), group = 'accepted-radio-native-observation';
  const prototype = await session.send('Runtime.evaluate', { expression: 'HTMLAudioElement.prototype', objectGroup: group });
  const read = async (): Promise<NativeAudio[]> => {
    const objects = await session.send('Runtime.queryObjects', { prototypeObjectId: prototype.result.objectId!, objectGroup: group });
    try { const response = await session.send('Runtime.callFunctionOn', { objectId: objects.objects.objectId!, functionDeclaration: 'function(){return Array.from(this).filter(a=>a instanceof HTMLAudioElement).map(a=>({src:a.getAttribute("src")||"",currentSrc:a.currentSrc,readyState:a.readyState,paused:a.paused,currentTime:a.currentTime,duration:Number.isFinite(a.duration)?a.duration:null,error:a.error?.code??null}));}', returnByValue: true }); return response.result.value as NativeAudio[]; }
    finally { await session.send('Runtime.releaseObject', { objectId: objects.objects.objectId! }); }
  };
  return { read, close: async () => { await session.send('Runtime.releaseObjectGroup', { objectGroup: group }); await session.detach(); } };
}

for (const scenario of [{ width: 1440, surface: 'owner' }, { width: 1920, surface: 'viewer' }] as const) test(`Accepted radio ${scenario.surface} ${scenario.width} reports failure and plays the existing local asset on retry`, async ({ page, context, baseURL }, info) => {
  const proof = await radioSetup(page, context, baseURL!, scenario.width, scenario.surface); let invalid = 0, normal = 0;
  await context.route('**/companion/audio/radio/*.ogg', route => {
    const request = route.request(), url = new URL(request.url()); if (request.method() !== 'GET' || url.origin !== baseURL) return route.fallback();
    if (!invalid) { invalid++; proof.syntheticReads.push('one-local-invalid-radio-response'); return route.fulfill({ status: 200, contentType: 'audio/ogg', body: Buffer.from('invalid local fixture audio') }); }
    normal++; return route.fallback();
  });
  const radio = await openRadio(page), play = radio.locator('.rhh-radio-actions [data-act="companion-radio-play"]'), stop = radio.locator('[data-act="companion-radio-stop"]'), now = radio.locator('.rhh-radio-now p'), media = await nativeAudioReader(context, page);
  try {
    await expect(radio.locator('.rhh-radio-playlist summary')).toContainText(`${COMPANION_RADIO_TRACKS.length}/${COMPANION_RADIO_TRACKS.length}`); await expect(radio.locator('.rhh-radio-actions button')).toHaveCount(3);
    await expect(now).toHaveText('재생 대기'); await play.click(); await expect(now).toHaveText('재생하지 못했어요'); await expect(play).toBeEnabled(); await expect(play).toHaveText('재생');
    expect(invalid).toBe(1); expect(normal).toBe(0); await expect(now).toHaveAttribute('aria-live', 'polite');
    await info.attach('radio-visible-failure', { body: await page.screenshot(), contentType: 'image/png' });
    await play.click(); await expect.poll(() => normal).toBeGreaterThan(0);
    await expect.poll(async () => { const title = await now.innerText(); return COMPANION_RADIO_TRACKS.some(track => track.title === title); }).toBe(true);
    await expect.poll(async () => (await media.read()).some(audio => audio.currentSrc.startsWith(baseURL! + '/companion/audio/radio/') && audio.readyState >= 2 && !audio.paused && audio.currentTime > .1 && Number.isFinite(audio.duration) && audio.duration! > 0 && audio.error === null)).toBe(true);
    const nativePlaying = await media.read(), title = await now.innerText(), selected = COMPANION_RADIO_TRACKS.find(track => track.title === title)!;
    await expect(radio.locator('.rhh-radio-attribution [data-act="companion-radio-source"]')).toHaveAttribute('href', selected.sourceUrl); await expect(radio.locator('[data-act="companion-radio-license"]')).toHaveAttribute('href', selected.licenseUrl);
    await expect(play).toBeDisabled(); await expect(stop).toBeEnabled(); await info.attach('radio-native-local-playback', { body: await page.screenshot(), contentType: 'image/png' });
    await stop.click(); await expect(now).toHaveText('재생 대기'); await expect(play).toBeEnabled(); await expect.poll(async () => (await media.read()).every(audio => audio.paused)).toBe(true);
    await page.getByRole('dialog', { name: '설정', exact: true }).getByRole('button', { name: '닫기', exact: true }).click(); await expect(page.getByRole('dialog', { name: '설정', exact: true })).toHaveCount(0);
    await finish(page, info, proof, { adoptedKey: 'companion-radio:visible-playback-failure-state', ...scenario, invalidResponses: invalid, actualLocalAssetRequests: normal, nativePlaying, selectedPublicTrackId: selected.id, selectedTitleVisible: title, existingPlaylistSize: COMPANION_RADIO_TRACKS.length, stoppedByActualPointer: true, actualBrowserDecodeAndPlayback: true, physicalSpeakerAudibilityNotClaimed: true, noNewAssetOrDownload: true });
  } finally { await media.close(); }
});

test('Adopted radio positive master volume preserves pending failure', async ({page,context,baseURL},info)=>{
  const proof=await radioSetup(page,context,baseURL!,1440,'owner');let release!:()=>void,requests=0;
  const held=new Promise<void>(resolve=>{release=resolve;});
  await context.route('**/companion/audio/radio/*.ogg',async route=>{const q=route.request();if(q.method()!=='GET'||new URL(q.url()).origin!==baseURL)return route.fallback();requests++;proof.syntheticReads.push('held-invalid-media-for-positive-volume-regression');await held;await route.fulfill({status:200,contentType:'audio/ogg',body:Buffer.from('invalid synthetic audio')});});
  try{
    const radio=await openRadio(page),status=radio.locator('.rhh-radio-now p');await radio.locator('.rhh-radio-actions [data-act="companion-radio-play"]').click();await expect.poll(()=>requests).toBe(1);await expect(status).toHaveText('준비 중');
    // Controlled preference notification keeps the same mounted radio. Switching
    // settings tabs would unmount it and intentionally discard local pending state.
    await page.evaluate(()=>{const before=Number(localStorage.getItem('vic.soundVol')??60);localStorage.setItem('vic.soundVol',String(before+5));window.dispatchEvent(new Event('vic:sound'));});
    await expect(status).toHaveText('준비 중');release();await expect(status).toHaveText('재생하지 못했어요');
    await finish(page,info,proof,{positiveVolumeChangeDuringPending:true,preferenceChangeIsSyntheticNotification:true,requests,failurePreserved:true,noOperatingMedia:true});
  }finally{release();}
});

test('Accepted radio pending stop and unmount ignore late invalid media responses', async ({ page, context, baseURL }, info) => {
  const proof = await radioSetup(page, context, baseURL!, 1440, 'owner');
  const held: { release: () => void; done: Promise<void> }[] = [], lateResponses: { result: string; failure?: string }[] = []; let requests = 0;
  await context.route('**/companion/audio/radio/*.ogg', async route => {
    const request = route.request(), url = new URL(request.url()); if (request.method() !== 'GET' || url.origin !== baseURL) return route.fallback();
    requests++; let release!: () => void, done!: () => void; const ready = new Promise<void>(resolve => { release = resolve; }), completed = new Promise<void>(resolve => { done = resolve; }); held.push({ release, done: completed });
    proof.syntheticReads.push('held-local-invalid-media-' + requests); await ready;
    try { await route.fulfill({ status: 200, contentType: 'audio/ogg', body: Buffer.from('late invalid local fixture audio') }); lateResponses.push({ result: 'invalid-response-delivered-or-request-already-canceled' }); }
    catch { const failure = request.failure()?.errorText; expect(failure, 'only this natively canceled held request may fail fulfillment').toMatch(/ERR_ABORTED|aborted|cancelled|canceled/i); lateResponses.push({ result: 'native-request-canceled', failure }); } finally { done(); }
  });
  let radio = await openRadio(page); const now = () => radio.locator('.rhh-radio-now p'), play = () => radio.locator('.rhh-radio-actions [data-act="companion-radio-play"]');
  await play().click(); await expect.poll(() => held.length).toBe(1); await expect(now()).toHaveText('준비 중');
  await radio.locator('[data-act="companion-radio-stop"]').click(); await expect(now()).toHaveText('재생 대기'); held[0].release(); await held[0].done;
  await page.waitForTimeout(180); await expect(now()).toHaveText('재생 대기'); await expect(play()).toBeEnabled();
  await play().click(); await expect.poll(() => held.length).toBe(2); await expect(now()).toHaveText('준비 중');
  await page.getByRole('dialog', { name: '설정', exact: true }).getByRole('button', { name: '닫기', exact: true }).click(); await expect(page.getByRole('dialog', { name: '설정', exact: true })).toHaveCount(0); held[1].release(); await held[1].done;
  radio = await openRadio(page); await expect(now()).toHaveText('재생 대기'); await expect(play()).toBeEnabled(); await page.waitForTimeout(180); expect(requests).toBe(2); await expect(now()).not.toHaveText('재생하지 못했어요');
  await finish(page, info, proof, { adoptedKey: 'companion-radio:visible-playback-failure-state', surface: 'owner', width: 1440, heldRequests: requests, lateResponses, actualPointerStopBeforeLateFailure: true, actualSettingsUnmountBeforeLateFailure: true, staleFailureNotApplied: true, mediaRequestCanceledOrInvalidResponsePreserved: true, operatingMediaRequests: 0 });
});

test('Accepted radio actual desktop mobile desktop resize cancels pending playback without stale failure', async ({ page, context, baseURL }, info) => {
  const proof = await radioSetup(page, context, baseURL!, 1440, 'owner'); let release!: () => void, completed!: () => void, requests = 0;
  const held = new Promise<void>(resolve => { release = resolve; }), done = new Promise<void>(resolve => { completed = resolve; }), lateResponses: { result: string; failure?: string }[] = [];
  await context.route('**/companion/audio/radio/*.ogg', async route => {
    const request = route.request(), url = new URL(request.url()); if (request.method() !== 'GET' || url.origin !== baseURL) return route.fallback();
    requests++; proof.syntheticReads.push('real-resize-held-local-invalid-media'); await held;
    try { await route.fulfill({ status: 200, contentType: 'audio/ogg', body: Buffer.from('late invalid local fixture audio after actual viewport resize') }); lateResponses.push({ result: 'invalid-response-delivered-or-request-already-canceled' }); }
    catch { const failure = request.failure()?.errorText; expect(failure, 'only this natively canceled held request may fail fulfillment').toMatch(/ERR_ABORTED|aborted|cancelled|canceled/i); lateResponses.push({ result: 'native-request-canceled', failure }); } finally { completed(); }
  });
  let radio = await openRadio(page); const media = await nativeAudioReader(context, page);
  try {
    await radio.locator('.rhh-radio-actions [data-act="companion-radio-play"]').click(); await expect.poll(() => requests).toBe(1); await expect(radio.locator('.rhh-radio-now p')).toHaveText('준비 중');
    const nativePending = await media.read();
    expect(nativePending.some(audio => audio.src.startsWith('/companion/audio/radio/') || audio.currentSrc.startsWith(baseURL! + '/companion/audio/radio/'))).toBe(true);
    await page.setViewportSize({ width: 390, height: 1000 }); await expect.poll(() => page.evaluate(() => innerWidth)).toBe(390); await settlePanelLayout(page);
    await expect.poll(async () => (await media.read()).every(audio => audio.paused && audio.src === '')).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 }); await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1440); await settlePanelLayout(page);
    radio = await openRadio(page); await expect(radio.locator('.rhh-radio-now p')).toHaveText('재생 대기'); await expect(radio.locator('.rhh-radio-actions [data-act="companion-radio-play"]')).toBeEnabled();
    release(); await done; await page.waitForTimeout(180);
    await expect(radio.locator('.rhh-radio-now p')).toHaveText('재생 대기'); await expect(radio.locator('.rhh-radio-actions [data-act="companion-radio-play"]')).toBeEnabled(); expect(requests).toBe(1);
    const nativeAfterResize = await media.read(); expect(nativeAfterResize.length).toBeGreaterThan(0); expect(nativeAfterResize.every(audio => audio.paused && audio.src === '')).toBe(true);
    await finish(page, info, proof, { adoptedKey: 'companion-radio:visible-playback-failure-state', surface: 'owner', actualViewportSteps: [1440, 390, 1440], requests, lateResponses, nativePending, nativeAfterResize, pendingCanceledByRealResize: true, oldFailureIgnoredAfterReturningToDesktop: true, noHiddenStateOrAudioOverrides: true, operatingMediaRequests: 0 });
  } finally { release(); await media.close(); }
});
