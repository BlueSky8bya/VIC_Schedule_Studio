// 태그 색 생성 — 기존 색들과 색조(hue)·무늬가 충분히 다른 연한 파스텔을 만든다.
// 서버(tag-actions)와 클라이언트(TagLegendEditor 드래프트 추가) 양쪽에서 쓰려고 분리했다.
// ("use server"가 아닌 순수 모듈이라 클라이언트에서도 import 가능.)

export type GeneratedColor = {
  key: string;
  name: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
};

type Pat = "plain" | "diag" | "dots" | "grid" | "cross" | "dash";
// 생성에 쓰는 무늬 종류(민무늬 제외).
const DECO_PATS: Pat[] = ["diag", "dots", "grid", "cross", "dash"];
const FAMILY = 38; // 같은 색상 계열로 보는 hue 거리(°)

// hex(#rrggbb) → HSL hue(0~360). 파싱 실패 시 null.
function hexToHue(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return (h + 360) % 360;
}

// 색 key로 무늬 종류를 추정한다(생성색 gen-* 접두사 + 기본색 중 무늬 있는 것).
function patternOf(key: string): Pat {
  if (key.startsWith("gen-diag-")) return "diag";
  if (key.startsWith("gen-dots-")) return "dots";
  if (key.startsWith("gen-grid-")) return "grid";
  if (key.startsWith("gen-cross-")) return "cross";
  if (key.startsWith("gen-dash-")) return "dash";
  if (key === "indigo" || key === "mint") return "diag";
  if (key === "sky") return "dots";
  return "plain";
}

// 두 hue의 원형 거리(0~180).
function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

function pickFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 새 색의 (hue, 무늬)를 고른다. 같은 계열엔 [민무늬 1] + [무늬 1]까지만 둔다.
function pickColorSlot(existing: { hue: number; pat: Pat }[]): { hue: number; pat: Pat } {
  const decoPats = DECO_PATS;

  const valid: { hue: number; plain: boolean }[] = [];
  for (let h = 0; h < 360; h += 5) {
    for (const plain of [true, false]) {
      const clash = existing.some(
        (e) => hueDist(h, e.hue) < FAMILY && (e.pat === "plain") === plain
      );
      if (!clash) {
        valid.push({ hue: h, plain });
      }
    }
  }

  let hue: number;
  let plain: boolean;
  if (valid.length > 0) {
    const pick = pickFrom(valid);
    hue = pick.hue;
    plain = pick.plain;
  } else {
    let best = { hue: Math.floor(Math.random() * 360), plain: true, sep: -1 };
    for (let h = 0; h < 360; h += 5) {
      for (const p of [true, false]) {
        const same = existing.filter((e) => (e.pat === "plain") === p).map((e) => e.hue);
        const sep = same.length ? Math.min(...same.map((u) => hueDist(h, u))) : 360;
        if (sep > best.sep) {
          best = { hue: h, plain: p, sep };
        }
      }
    }
    hue = best.hue;
    plain = best.plain;
  }

  let pat: Pat = "plain";
  if (!plain) {
    const near = new Set(
      existing
        .filter((e) => e.pat !== "plain" && hueDist(hue, e.hue) < FAMILY * 2)
        .map((e) => e.pat)
    );
    const count = (p: Pat) => existing.filter((e) => e.pat === p).length;
    const notNear = decoPats.filter((p) => !near.has(p));
    const candidates = notNear.length > 0 ? notNear : decoPats;
    const min = Math.min(...candidates.map(count));
    pat = pickFrom(candidates.filter((p) => count(p) === min));
  }
  const jitter = Math.floor(Math.random() * 7) - 3; // ±3° 미세 흔들기
  return { hue: (hue + jitter + 360) % 360, pat };
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

// 기존 팔레트(키 + 배경색)를 받아 겹치지 않는 새 색을 하나 만든다.
export function generateTagColor(existing: { key: string; bgColor: string }[]): GeneratedColor {
  const slots = existing
    .map((p) => ({ hue: hexToHue(p.bgColor), pat: patternOf(p.key ?? "") }))
    .filter((e): e is { hue: number; pat: Pat } => e.hue !== null);
  const { hue, pat } = pickColorSlot(slots);
  const bgColor = hslToHex(hue, 62, 86); // 연한 배경
  const borderColor = hslToHex(hue, 52, 68);
  const textColor = hslToHex(hue, 55, 28); // 같은 hue의 어두운 글씨
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `gen-${pat}-${rand}`;
  return { key, name: "새 색", bgColor, textColor, borderColor };
}
