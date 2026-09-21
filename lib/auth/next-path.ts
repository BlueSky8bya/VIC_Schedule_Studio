// OAuth may only return to this application's own path. WHATWG URL parsing treats
// backslashes as slashes and strips some controls, so reject both before parsing.
export function sanitizeNextPath(value: string): string {
  const unsafe = [...value].some((char) => char === "\\" || char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127);
  if (!value.startsWith("/") || value.startsWith("//") || unsafe) return "/";
  try {
    const base = "https://same-origin.invalid";
    const url = new URL(value, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}
