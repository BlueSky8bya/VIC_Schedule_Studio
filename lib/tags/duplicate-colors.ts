// 같은 종류(콘텐츠/형식) 안에서 '화면에 보이는 실제 색'이 겹치는지 — 태그 전체 저장(saveTagsAction) 검증용.
// 직접 고른 색(bgHex)이 있으면 그 색, 없으면 팔레트 색(새로 만드는 색은 bgColor). 내부 팔레트 번호(colorKey)만
// 비교하면, 직접 고른 색이 전혀 다른 두 태그(휴뱅 gray · 기타 gray+#d8d0c2)가 같은 색으로 판정돼 저장이 통째로
// 거절됐다(2026-11-17 소유자).
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export type DupCheckTag = {
  colorKey: string;
  bgHex?: string | null;
  bgColor?: string;
  kind?: string | null;
};

export function visibleTagColor(t: DupCheckTag, paletteBg: Map<string, string>): string {
  const hex = t.bgHex && HEX_RE.test(t.bgHex) ? t.bgHex : (t.bgColor ?? paletteBg.get(t.colorKey) ?? "");
  return hex ? hex.trim().toLowerCase() : `key:${t.colorKey}`;
}

export function hasDuplicateVisibleColor(tops: DupCheckTag[], paletteBg: Map<string, string>): boolean {
  const seen = new Map<string, Set<string>>();
  for (const t of tops) {
    const kind = t.kind === "modifier" ? "modifier" : "content";
    const set = seen.get(kind) ?? new Set<string>();
    const c = visibleTagColor(t, paletteBg);
    if (set.has(c)) return true;
    set.add(c);
    seen.set(kind, set);
  }
  return false;
}
