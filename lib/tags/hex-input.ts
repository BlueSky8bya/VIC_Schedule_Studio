export type HexInputResult =
  | { state: "complete"; hex: string }
  | { state: "incomplete" }
  | { state: "invalid" };

/** Accept exactly six RGB digits; partial input remains editable without conversion. */
export function parseHexInput(text: string): HexInputResult {
  const digits = text.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(digits)) return { state: "complete", hex: `#${digits.toLowerCase()}` };
  if (/^[0-9a-f]{0,5}$/i.test(digits)) return { state: "incomplete" };
  return { state: "invalid" };
}
