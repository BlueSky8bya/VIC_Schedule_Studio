/** Bounded native mouse cursor: no frame loop or change to captured ink. */
export function mousePenFootprint(width: number, pressure = 0.8): number {
  const p = Number.isFinite(pressure) ? Math.max(0, Math.min(1, pressure)) : 0.8;
  // Same pressure scale as drawPenIncremental; quarter-pixel cursor cache steps.
  return Math.round(width * (0.45 + p * 0.85) * 4) / 4;
}
export function mouseInkCursor(tool: 'pen' | 'hl', width: number, color: string): string {
  const diameter = Math.min(96, Math.max(1, Number.isFinite(width) ? width : 1));
  const center = Math.max(22, Math.ceil(diameter / 2) + 2);
  const size = center * 2;
  const ink = /^#[0-9a-f]{6}$/i.test(color) ? color : '#4b4468';
  const glyph = tool === 'hl' ? 'M4 20l2-6L16 4l4 4L10 18l-6 2z' : 'M4 20l1.5-5L17 3.5a2.1 2.1 0 0 1 3 3L8.5 18z';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><circle cx='${center}' cy='${center}' r='${diameter / 2}' fill='none' stroke='white' stroke-width='2.5'/><circle cx='${center}' cy='${center}' r='${diameter / 2}' fill='${ink}' fill-opacity='.08' stroke='#4b4468' stroke-width='1'/><path transform='translate(${center - 4} ${center - 20})' d='${glyph}' fill='${tool === 'hl' ? '#fbbf24' : '#4b4468'}' stroke='white' stroke-width='1.6'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${center} ${center}, crosshair`;
}
