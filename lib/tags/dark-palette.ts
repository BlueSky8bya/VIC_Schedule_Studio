import { hexToOklch, oklchToHex } from "@/lib/tags/color-tone";

/** Versioned public visual metadata. DB generated columns use the same OKLCH
 * contract (0121); source colors remain editable and are never overwritten. */
export type DarkTagColors = {
  version: 1;
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
    version: 1, source: hex,
    bgColor: oklchToHex(0.34 + L * 0.10, Math.min(0.065, C * 0.45), h),
    borderColor: oklchToHex(0.55 + L * 0.04, Math.min(0.075, C * 0.55), h),
    textColor: "#f1ede6",
    accentColor: oklchToHex(0.72 + L * 0.06, Math.min(0.12, C * 0.75), h)
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
    if (v.version === 1 && v.source === source.toLowerCase() &&
      [v.bgColor, v.borderColor, v.textColor, v.accentColor].every(c => typeof c === "string" && HEX.test(c))) {
      return { version: 1, source: v.source, bgColor: v.bgColor!, borderColor: v.borderColor!, textColor: v.textColor!, accentColor: v.accentColor! };
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
