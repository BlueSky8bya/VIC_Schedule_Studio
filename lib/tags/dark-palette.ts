import { hexToOklch, oklchToHex } from "@/lib/tags/color-tone";

/** Versioned public visual metadata. DB generated columns use the same OKLCH
 * contract (0122); source colors remain editable and are never overwritten. */
export type DarkTagColors = {
  version: 2;
  source: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  accentColor: string;
};

const HEX = /^#[0-9a-f]{6}$/i;
const cache = new Map<string, DarkTagColors>();
export function deriveDarkTagColors(source: string): DarkTagColors {
  const hex = HEX.test(source) ? source.toLowerCase() : "#b8b3aa";
  const cached = cache.get(hex);
  if (cached) return cached;
  const { L, C, h } = hexToOklch(hex);
  const colors: DarkTagColors = {
    version: 2, source: hex,
    // Lift pastel chroma without tinting neutral grays. Dark surfaces need hue
    // separation, not the near-gray compression of v1.
    bgColor: oklchToHex(0.35 + L * 0.12, Math.min(0.14, C * 0.95 + Math.min(C / 0.04, 1) * 0.035), h),
    borderColor: oklchToHex(0.60 + L * 0.05, Math.min(0.16, C * 1.05 + Math.min(C / 0.04, 1) * 0.035), h),
    textColor: "#f1ede6",
    accentColor: oklchToHex(0.74 + L * 0.06, Math.min(0.16, C + Math.min(C / 0.04, 1) * 0.025), h)
  };
  // Color-picker dragging can produce unlimited transient colors.
  if (cache.size >= 512) cache.clear();
  cache.set(hex, colors);
  return colors;
}

/** Explicit DTO construction; stale optimistic metadata must not survive a
 * source-color edit. No opaque database JSON crosses the public boundary. */
export function readDarkTagColors(value: unknown, source: string): DarkTagColors {
  if (value && typeof value === "object") {
    const v = value as Partial<DarkTagColors>;
    if (v.version === 2 && v.source === source.toLowerCase() &&
      [v.bgColor, v.borderColor, v.textColor, v.accentColor].every(c => typeof c === "string" && HEX.test(c))) {
      return { version: 2, source: v.source, bgColor: v.bgColor!, borderColor: v.borderColor!, textColor: v.textColor!, accentColor: v.accentColor! };
    }
  }
  return deriveDarkTagColors(source);
}

/** CSS resolves both colors before first paint and on the existing theme switch.
 * No per-component theme hooks, root filters or hydration color flashes. */
export function themeColor(light: string, dark: string): string {
  return `light-dark(${light}, ${dark})`;
}
export function tagColor(source: string, role: "bgColor" | "borderColor" | "accentColor" = "accentColor", stored?: DarkTagColors, light = source): string {
  return themeColor(light, readDarkTagColors(stored, source)[role]);
}
