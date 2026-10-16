# 모바일 헤더 좌우 배치·다크 경계 정정

2026-10-16 KST. 최신 소유자 요청이063/064/066의 설정 위치만 대체한다. 설정은 시청자 로그인/익명/미리보기 헤더 왼쪽, 편집실 월 이동 줄 왼쪽이다. 계정 동작은 양쪽 헤더 오른쪽1행이다. CSS 배치 정정(L1), 새 기능·서버·DB·권한·공개 DTO·KST·자산 변경은 없다.

## 원인과 변경

- 시청자 설정은 오른쪽1행, 계정 버튼은 오른쪽2행이었으나 좁은 화면·로그인 상태에서 같은 오른쪽 영역을 차지했다. 같은 grid에서 설정을 왼쪽, 계정을 오른쪽1행으로 분리하고 중앙 제목은 같은 폭의 양옆 track으로 유지한다. 작은 화면에서는 기존 제목 장식을 먼저 숨긴다.
- 편집실의 같은 설정 버튼은 가운데 월 이동 그룹 왼쪽으로 옮긴다. 로그인/로그아웃은 헤더 오른쪽에 유지한다. 기존44px·safe-area·설정 창/X·뒤로가기/opener focus 구현은 공유한다.
- 다크 헤더의 `glass-head / 96%`와 편집실 외층의 별도 `--surface`가 달력 `--paper`와 달라 색 띠를 만들었다. sticky 외층은 실제 종이색을 쓰고 내부 Studio 헤더만 투명하게 하며 경계선/blur/shadow를 제거한다. 스크롤 글자를 가리는 기존 sticky 역할은 유지한다.

변경 파일: `components/poster/public-poster.css`, `components/studio/studio-shell.css`, `app/dark.css`. 렌더 검증: `tests/visual/mobile-settings-header.spec.ts`. PC poster1840·모바일 빅타민 제외·인증 form/handler는 변경하지 않는다. 사용자 미술 작업과 과거 결과물은 보존한다.

## 검증 상태

로컬 최종 빌드 `Nkungp4UPThbx5yG57aBG`에서 아래 검증을 완료했다. 운영 배포 확인은 별도로 수행한다. CSS 담당과 다크 담당의 상호 독립 소스 검토는 차단 문제0이며, 렌더 결과를 대신하지 않는다.320px 메타 padding 보완도 재검토했다.

첫 렌더4개 중390px/coarse1120px2개는 통과했고320/360px2개는 Studio 고정28px 제목과 로그아웃 BCR 겹침(각1227.875/347.875px²)을 잡았다. Studio 별도 제목 override를 제거해 같은 viewer 반응형 규칙을 쓴다. 두 번째 빌드 `09gyV5WzmeKWitsyELeCw`의 확장 검사는3통과/1실패였고,320px 저장 상태 캡슐과 제목이2.25px 겹쳤다.360px 이하 메타 양옆 여백만 기존 `--space-1`로 줄였다.44px 조작 표적과 글자 크기는 더 줄이지 않는다. 이 실패 raw/PNG는 `.scratch-pw/mobile-header-20261016-*`, `mobile-header-20261016-v2-*`에 보존한다.

빌드와 별도 typecheck를 동시에 시작한 첫 실행은 Next가 `.next/types`를 다시 만드는 동안 TS6053을 냈다. 빌드 성공 뒤 순차 재실행한 `npm run typecheck`는 exit0이다. 첫 실행을 PASS로 계산하지 않는다.

| 최종 검사 | 결과·범위 |
| --- | --- |
| `npm run build` / 순차 `npm run typecheck` / `npm run lint` | 모두 exit0. 빌드 중 기존 public loader error 표시는 정적 생성의 인증 없는 환경 로그이며 빌드는 성공했다. |
| 관련 unit4파일 |34/34: 다크 태그 팔레트, 인증 next-path, 모바일 capability, 패널 접기 설정. |
| 문서/harness unit2파일 |43/43: agent-memory, rule-migration. |
| production-build Playwright |12/12, 실패/재시도/skip0. 헤더4개 + 기존 모바일 제외/PC복귀8개. |
| 헤더 상세 | 익명·로그인·owner Studio·실제 Studio 미리보기 ×390 light/1120 coarse dark/320 dark/360 light=16개. 다크8개는 실제 wheel 뒤 scroll>24px에서 같은 검사를 반복했다. 왼쪽 설정/오른쪽 계정·중앙 제목/월·meta/title/account 겹침0·44px gear/계정/월 화살표·native hit·수평 넘침0을 확인했다. |
| 설정 창 왕복 |16개 화면에서 native tap→X, 재열기→브라우저 Back, opener focus/aria-expanded 및 창 focus trap, 모바일을 써도 기존 PC master ON 보존. |
| 다크 재질 | 외층 background가 실제 body paper `rgb(26, 25, 22)`와 같고 내부 Studio는 투명하다. gradient/visible border/blur/filter/shadow0, 실제 스크롤 중에도 동일하다. |
| 부수 회귀 | 공개 시청자/Studio/preview의 모바일 pet/집/음식/최초공개 관객/설정 탭 미마운트와 자산 요청0, PC→모바일→PC 저장 선택 복구. |

최종 raw는 `.scratch-pw/mobile-header-20261016-v3-report.json`, 기하/PNG는 같은 prefix의16개 top/8개 scrolled, 소스 SHA256/빌드 연결은 `mobile-header-20261016-final-source.json`에 둔다. 이전066 증거는 덮어쓰지 않았다. POST는 정확한 기존 공개 preview read-action만 로컬 public fixture로 응답하고, 모든 다른 POST는 차단했다. 실제 일정 쓰기0·현재/미래 달 시험 데이터0이다.

`npm run harness:verify`는 기존 rule inventory 불일치2건으로 exit1이다: `Active rule IDs changed; update RULE_MIGRATION inventory and mappings`, `RULE_MIGRATION inventory table differs from live rule IDs`. 이번 CSS/문서 위치 정정으로 rule ID를 추가/삭제하지 않았으며 이 별도 기존 불일치를 PASS로 표시하지 않는다.

인증 form/handler·서버 경계·역할/KST는 소스 변화0이다. Fixture owner와 익명/로그인 표시는 실제 OAuth/RLS 감사를 대신하지 않는다. iOS 실기기 notch·시스템 확대·사용자 정의 모든 글꼴 조합은 미검증이다. 이번에는 빅타민 프레임 처리나 실제 OBS/SOOP encoder 품질을 변경/재측정하지 않았다. 그 범위는 [066 기록](COMPANION_FRAME_PIPELINE-20261016.md)을 따른다.
