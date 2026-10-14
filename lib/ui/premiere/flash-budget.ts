export function createFlashBudget() {
  let last = -Infinity;
  return { request(now: number) { if (now - last < 1500) return false; last = now; return true; } };
}
