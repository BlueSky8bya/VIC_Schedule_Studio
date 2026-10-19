# 수동 성격 기억·책139

2026-10-20 KST. 상태: 구현·로컬·실제 배포 확인 완료. 최신 사용자139: 집 책만 조금 확대, 직접 성격을 고르면 전체 새로고침 후에도 유지하고 직접 고르지 않았으면 매 문서 무작위.138의 수동 선택이 다음 새로고침에서 풀리는 조항만 대체한다.

공용 viewer/studio/preview의 기존 version1 로컬 record에 유효한 수동 성격 출처를 저장하고 다른 설정만 저장할 때 무작위 결과를 수동으로 오인하지 않는다. 출처가 없는 이전 record는 추정으로 고정하지 않는다. 기존 master/OFF·저장 실패 복구·서버 경계·KST·자동 인간 활동 제외를 보존한다. 현재 무작위 값과 같은 radio도 실제 클릭/Enter/Space/Home/End로 확인하면 수동 선택으로 기억하며 기존 G22 고정 target·단일 기록을 쓴다. 다른 SettingsSegment는 기존 동작 그대로다.

책 그림42→48px와 표지 인쇄 비율/실제 조작 너비를 함께 조정한다. 창문·가구 원본은 그대로다. 단위·타입·lint·production fixture build·실제 새로고침/수동 재선택·책 배치/hover/클릭·양쪽 개발자 활동 표시를 검사하고 독립 경계/UX/QA 검토한다. 운영 DB 테스트/쓰기는 없다.138 보호 사용자 제작기록은 수정/스테이징하지 않는다.

## 구현·검증

저장 v1에만 personalitySource:'manual'을 넣고 유효한 own personality patch에서만 고정한다. getter/normalize/event/brain key는 기존 허용 필드 그대로다. 출처 없는 저장은 다른 설정을 바꿔도 무작위 유지. 유효한 수동 선택은 새 문서/모듈·다른 탭에 동기화하고 reset에서 해제한다. quota/denied에서도 현재 문서 수동/OFF를 보존하고 저장 복구 시 함께 복구한다. 현재 radio를 다시 누르는 opt-in onReselect는 성격만 쓰며 기존 공용 SettingsSegment의 다른 호출부는 그대로다.

독립 제품 역할/경계/UX/G22/QA 검토에서 차단0. 리뷰에서 fixture 기본 OFF 저장소와 조건부 seed 충돌을 발견해 새139/기존138 spec에 빈 storageState·SW block을 직접 선언했다. 요청 가로채기는 알려진 preview read만 synthetic으로 응답하고 다른 writes/API/외부를 차단한다. 제품에 시계/RNG/brain/geometry를 주입하지 않는다.

관련271단위·소유파일 lint PASS. 첫 full unit은 기존 AST 활동 사전 검사1개가5000ms 제한을5333ms로 넘어3475 PASS/1 timeout; 검사를 느슨하게 바꾸지 않고 전체를 maxWorkers4로 다시 실행해3476/303 PASS(27.07초). 첫 새 native spec의 배열 닫힘 구문 오류도 실제 typecheck에서 교정했고 최종 typecheck PASS. fixture production build(type/lint 포함)·별도 full lint PASS·metadata111 변경0·harness339 PASS.

Native1은11 PASS/3 FAIL/1 interrupt. 새139의 studio1920은 CSS zoom.9에서 계산된48px가47.9861px여서 exact equality가 실패했다. .05px 미만 근사로 교정해42px 이전 크기는 여전히 실패하게 했고 모든44px hit·그림 포함·가구 간격·hover 검사는 보존했다. 기존136 studio1100/1920은 실제 초기 배우가 TV를 가려90초 timeout; 기존 native placement로 실제 배우를 비우고 정상 pointer TV click/실제 화면 decode는 보존했다. 제품은 이 회차 사이 바꾸지 않았다. native2 같은 빌드4/4 PASS로 최종 고유15개 모두PASS. 실패 JSON/영상/trace는 `.scratch-pw/companion-139/native-1/`, 재검증은 native-2로 분리 보존했다.

viewer1440·studio1100/1920·실제 preview1920에서 6회 무선택 문서의 성격은 각각4/6/5/5종, pointer로 현재 값 확인·Enter로 다른 값·Home 동일 값 확인·Space 현재 값 확인 후 각3회 reload 모두 선택값 유지. 기존138은8회 무선택 random→native 수동 사고뭉치→실제 preview→3회 reload pin을 추가 확인했다. 책48px(배율 오차 .014px 이내)·44px 이상 target·배치/hover와 선반/소파/TV 주변 검사를 확인하고 실제 화면 직접 검수했다. G22 viewer/studio의 현재 값 pointer/Enter·Home 재확인 각각 기존 고정 target 한 번씩, 개발자 timeline/least-used 양쪽 표시PASS. 자동추첨과 로컬 출처는 분석 payload에 넣지 않는다. 마지막 변경 테스트4파일 scoped lint·typecheck도PASS. 독립 후속 검토 차단0. 운영은 빈 익명 context/40자리 실제배포 SHA+chunk digest·6회선택전 random→native 선택→3회 pin·책48로 확인할 예정이며 모든 writes와 실제 live-state GET을 차단한다.

## 출시 확인

140 검수 중 사후 확인: 원격 quality39281249552도 completed/success로 종료됐다. 아래 출시 직후 대기 기록은 당시 상태이며 현재 실패/미완료를 뜻하지 않는다.

제품 `a0e7d07e813bbb307b6b33f0dcc6dd06fa209c54` main push/Vercel success.2026-10-20 00:55~00:56 KST 실제 공개 HTML/정적 chunk의40자리 SHA와 브라우저가 받은10개 chunk digest 일치PASS. 빈 익명 cookies/origins/localStorage에서 선택 전6문서 성격은 애교쟁이/탐험둥이/사고뭉치/먹보/애교쟁이/잠꾸러기(5종). 실제 radio로 재롱둥이를 고른 뒤3회 reload 모두 재롱둥이, 책 CSS48×48px, 실제 대표 동작 decode·전등 기억·TV 수동 우선·다크 요일 cal-head 일치PASS. 실제 책/방 캡처 직접 검수. 오류0/예상 밖 요청0/운영 mutation0/live-state GET0/private manifest0; 알려진 익명 저장하트 read POST10회도 차단. at-run checker/JSON/캡처는 `.scratch-pw/companion-139/production/a0e7d07e813bbb307b6b33f0dcc6dd06fa209c54/`에 보존했다. 원격 quality39281249552는 queued/진행 대기로 성공이라고 기록하지 않는다. 제품은 배포 확인됐고 사후 증거·현재상태 문서만 로컬에서 마감했다. 실로그인/RLS/OBS/전문 아트 판정은 이 범위가 아니다. 보호 제작기록 원래 SHA256 유지.
