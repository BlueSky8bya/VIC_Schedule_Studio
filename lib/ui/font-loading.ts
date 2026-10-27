import type { FontOption } from './font-prefs';

const SAMPLE = '가나Aa';
const unquote = (s: string) => s.trim().replace(/^["']|["']$/g, '');
const recovered = new Map<string, FontFace[]>();

/** Retry only errored, already declared faces; do not add fonts or alter their URLs. */
async function retryDeclaredFaces(family: string, current: () => boolean) {
  // A prior UI timeout may have left the other requested weight in flight.
  // Wait its existing request, without starting unloaded unicode subsets.
  const loading = [...document.fonts].filter(f => unquote(f.family) === family && f.status === 'loading');
  await Promise.allSettled(loading.map(f => f.loaded));
  if (!current()) throw Error('font-request-obsolete');
  const failed = [...document.fonts].filter(f => unquote(f.family) === family && f.status === 'error');
  const rules: CSSFontFaceRule[] = [];
  const collect = (items: CSSRuleList) => {
    for (const rule of items) {
      if (rule instanceof CSSFontFaceRule && unquote(rule.style.fontFamily) === family) rules.push(rule);
      else if ('cssRules' in rule) collect((rule as CSSGroupingRule).cssRules);
    }
  };
  for (const sheet of document.styleSheets) { try { collect(sheet.cssRules); } catch { /* Cross-origin styles are not readable. */ } }
  const replacements = failed.map(face => {
    const rule = rules.find(r => (r.style.getPropertyValue('font-weight') || 'normal') === face.weight && (r.style.getPropertyValue('unicode-range') || 'U+0-10FFFF').toUpperCase() === face.unicodeRange.toUpperCase());
    if (!rule) throw Error('declared-font-source-unavailable');
    return new FontFace(family, rule.style.getPropertyValue('src'), { weight: face.weight, style: face.style, stretch: face.stretch, unicodeRange: face.unicodeRange, display: face.display });
  });
  await Promise.all(replacements.map(f => f.load()));
  if (!current()) throw Error('font-request-obsolete');
  for (const face of replacements) document.fonts.add(face);
  return replacements;
}

export async function loadUiFont(option: FontOption, { retry = false, isCurrent = () => true, timeoutMs = 8000 }: { retry?: boolean; isCurrent?: () => boolean; timeoutMs?: number } = {}): Promise<void> {
  if (!option.stack) return;
  const css = getComputedStyle(document.documentElement);
  const resolved = option.stack.replace(/var\((--[\w-]+)\)/g, (_m, v: string) => css.getPropertyValue(v).trim());
  const family = unquote(resolved.split(',')[0]);
  if (!family) throw Error('font-family-unavailable');
  let expired = false, timer: ReturnType<typeof setTimeout> | undefined;
  const current = () => !expired && isCurrent();
  const operation = async () => {
    const cached = recovered.get(family);
    if (cached?.length && cached.every(f => f.status === 'loaded' && document.fonts.has(f))) {
      if (!current()) throw Error('font-request-obsolete');
      return;
    }
    if (retry) {
      const faces = await retryDeclaredFaces(family, current);
      if (faces.length) {
        // Original CSS-connected error faces remain in the set. load()/check() would
        // reject them forever, even when these verified replacement faces render.
        recovered.set(family, faces); return;
      }
    }
    const results = await Promise.allSettled([400, 700].map(w => document.fonts.load(`${w} 24px "${family}"`, SAMPLE)));
    const failed = results.find(r => r.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    const groups = results.map(r => (r as PromiseFulfilledResult<FontFace[]>).value);
    if (!current() || groups.some(faces => !faces.some(f => unquote(f.family) === family && f.status === 'loaded'))) throw Error('font-not-loaded');
  };
  try {
    await Promise.race([operation(), new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { expired = true; reject(Error('font-load-timeout')); }, timeoutMs); })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
