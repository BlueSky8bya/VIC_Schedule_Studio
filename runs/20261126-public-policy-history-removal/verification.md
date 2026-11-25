# 공개 방침 변경 이력 제거 — 검증

2026-11-26 KST. 최신 직접 사용자 지시로 ‘처리방침 변경’ 목차·본문·접기·비교표·날짜별 이력을 공개 정적 페이지에서 전부 제거했다. 약관의 이력 안내와 폐기된 링크도 제거했다. 실제 developer 전용 설정/서버 권한 검사는 유지했다. 시청자·관리자는 동일한 공개 정적 문서를 받으므로 CSS 숨김이나 클라이언트 역할 분기가 아니다.

변경 전은 실제 익명 배포 페이지, 기준 origin/main f9104830의 legal 소스와 동일한 f3fa2efc 배포다. 변경 후는 실제 Next 생산 빌드의 HTML/RSC/JS/CSS를 오프라인 Chromium에서 렌더했다. 1440/390 두 폭의 privacy/terms 모두 오류·가로넘침 없음. ‘처리방침 변경’ 목차·본문·비교표와 약관 링크가 HTML/RSC에도 없다. 현재 처리 목적·보관 기간·권리/연락처는 보존했다.

독립 비작성 검토 No issues. 생산 빌드 exit0, 제품679파일 전후 hash 동일. typecheck/lint exit0, 전체 단위490파일·7,495 PASS·1skip, harness463문서 PASS. 기존 actual-authority 단위는 익명/viewer/owner/불확실developer 거부와 실제 역할을 모의한 developer 허용을 검사한다. 실제 Google 로그인/RLS 인증은 아니다.

첫 관련 검사에서 retired 라벨 표시 누락 1건을 발견해 고쳤다. 이후 전체 검사에 포함해 통과했다. G-22: 기존 legal-policy-info를 retired 처리하여 활동 타임라인의 옛 이름은 읽히고 적게 쓰인 기능의 현역 후보에서는 빠진다. 새 수집/DB 변경 없음. React 품질 체크: 새 hook·fetch·역할 분기·목차 복제 없음, 기존 공용 정적 section 목록을 사용한다.

후속 배포 결과와 작업 폴더 정리 결과는 Hub 최종 release.json에 기록한다. 기존 개인화 작업 폴더는 git 등록 제거 후 Windows 잔여 폴더 삭제가 자동 승인 검토에서 거절되어 남았다. 강제·대체 삭제를 시도하지 않았다.
