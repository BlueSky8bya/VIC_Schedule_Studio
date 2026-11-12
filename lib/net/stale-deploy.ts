// 새 배포가 올라가면 이미 열려 있던 탭의 Server Action id가 서버에 없다 → Next가 UnrecognizedActionError
// ("Server Action … was not found on the server")를 던져 하트·저장이 실패로 보였다(2026-11-13 소유자 실측,
// 새로고침하면 정상). 자동 새로고침은 하지 않는다 — 쓰던 일정 글·그림판이 날아간다(소유자 지적). 안내만 띄우고
// 새로고침은 사용자가 고른다(StaleDeployGuard).
export const STALE_DEPLOY_EVENT = "vic:stale-deploy";

export function isStaleDeploymentError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: unknown; message?: unknown };
  if (e.name === "UnrecognizedActionError") return true;
  return typeof e.message === "string" && e.message.includes("was not found on the server");
}

// 오류를 직접 잡는 곳(하트 등)이 부른다. 옛 배포 오류면 안내를 띄우고 true.
export function announceIfStaleDeployment(error: unknown): boolean {
  if (!isStaleDeploymentError(error)) return false;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(STALE_DEPLOY_EVENT));
  return true;
}
