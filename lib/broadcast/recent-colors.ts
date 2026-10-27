/** Confirmed board-session colors only; never browser/server storage. */
export function rememberCustomColor(previous: readonly string[], value: string): string[] {
  if (!/^#[0-9a-f]{6}$/i.test(value)) return [...previous];
  const color = value.toLowerCase();
  return [color, ...previous.map(item => item.toLowerCase()).filter(item => item !== color)].slice(0, 5);
}
