// 개발자 화면 게이트 — 실제 역할이 developer이거나, **로컬 비주얼 fixture**(VISUAL_TEST_FIXTURE=1)일 때만 통과.
// fixture 플래그는 프로덕션에 없고(없으면 fixture 페이지가 404) NODE_ENV=production에서는 무시하므로,
// 배포본에서는 role 검사만 남는다. 목적: 이용 기록·인사이트 패널을 fixture 계정으로 실물 렌더해 스크린샷으로
// 검수하기(2026-09-27). 로컬 테스트 비밀번호(PRIVATE_LAYER_TEST_PASSCODE)와 같은 결의 우회.
export function isDeveloperOrFixture(actor: { role: string }): boolean {
  if (actor.role === "developer") return true;
  return process.env.VISUAL_TEST_FIXTURE === "1" && process.env.NODE_ENV !== "production";
}
