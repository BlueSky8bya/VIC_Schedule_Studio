# 빅타민 자동 귀가 정지·패널 크롬·눈 비율

Status: UI/liveness deployed and verified; eye scope awaiting visual feedback. [PLAN-099](../plans/PLAN-20261018-099-companion-liveness-and-chrome.md).

## 정지 재현과 변경

사용자가 실제 방송 중 약1분간 표정과 위치가 정지했다고 제보했다. OBS 때문이라고 단정하지 않고098 production build `fc6HvZP6arEt2hj4_7hje`에서 실제 입력으로 재현했다.1920×480 viewer, document focus=true·visible 유지, RNG/시계/기하/hasFocus JS 재정의 없이 P명령 승인 속성과 실제 클릭으로 바닥에 둔 뒤65초 관찰했다.469표본 중 마지막37,236.8ms 동안 위치·표정·pose transform이 같았고 자동 귀가 속성이 남았으며 CSS animation도 없었다. 숨김0·페이지 오류0·쓰기0. OBS는 실행하지 않았다. 후속 조사에서 Playwright 자체가 Chromium focus emulation을 기본 활성화함을 로컬 설치 소스에서 확인했다. 따라서 이 before는 active-document 앱 정지 재현이며 genuine OS focus/blur 증거는 아니다. 원본과 준비실패 로그는 `.scratch-pw/companion-099` 및 `sealed-before`에 보존했다. 방송 장비의 GPU/합성/인코딩 원인을 규명한 결과가 아니다.

자동 구조 귀가가 막히면 `waitForHomeGeometry`가 한 번 재검증 후 active 스케줄러를 무기한 멈추던 경로였다. 이제 실제 기하를 한 번 확인한 뒤 여전히 막힌 자발적 귀가만 취소하고30초 active-time 재시도 간격을 두며 일반 행동으로 돌아간다. 직접 소파를 누른 명령은 유지한다. 조용한 명령 대기는 compositor의 작은 시선/몸 움직임을 사용하며 실제 blur의 유한 rest/yawn→parked 수면 경로는 계속 끝낸다. 수면은 호흡·작은 움찔·zzZ를 CSS로 표현한다. 새 상시 layout polling·타이머 재시도·모델/서버 호출은 없다. 숨김 탭·자연 숨기·offscreen 집·reduced/OFF·모바일 제외는 기존 계약을 유지한다.

독립 읽기 검토에서 명령 대기 중 happy 입력을 즉시 look으로 덮는 P2를 발견했다. 귀가 대기 표식과 CSS 대기 포즈 표식을 분리하고 쓰다듬기·touch 감쇠·입력 lease·유한 이동이 끝난 뒤에만 정지한다. quiet 품질의 입력도 이 대기 경로에 한해 기존 스케줄러의 유한 꼬리를 재개한다. 독립 재검토 추가 blocking0. scoped20단위·ESLint 통과는 소스 검토/실물 증거와 구분한다.

## 공유 패널과 작은 집

태그 필터·계절 배경·집의 card 배경/선/그림자와 제목 줄 높이를 공유 토큰으로 맞춘다. studio zoom은 같은 가시 크기로 보정하고 기존 선택 색은 유지한다. header 집 버튼도 같은44px 제어 토큰/간격을 쓰며 기존 측정 기반 header 압축 단계에서 글자만 숨기고 접근성 이름을 유지한다. pointer focus의 잔류 outline만 제거하고 keyboard focus-visible은 유지한다.

작은 집은 title/X만 사용하고 저장된 패널 접힘과 무관하게 실내 전체를 보여준다. 진짜 rail 집은 접힘과 저장을 계속 사용한다.098의 compact 제목 접힘 조항만 최신 사용자 지시로 대체한다. body portal/한 주민·소파·음식·132px 실내/달력 BCR·scroll 비예약은 유지한다. 열기 후 focus는 제거된 fold 대신 X로 이동한다. 서버 DTO·역할·언락·KST·DB·의존성 변경0.

## 눈 비율과 사용자 선택

첫099 native7묶음은 각각 builtin 편집1회로 만들었으나 기본/감정 기준 눈 선형 실측 약0.69~0.78로 기존의90% 목표보다 작았다. 수치 미달과 원본·영수증·초안은 `art-src/빅타민/동행/작업회차/20261018-눈비율균형`에 보존했다. 이 미달을90% PASS로 표현하거나 얼굴을 수작업 합성하지 않았다.

최신 사용자는 비교 contact의 오른쪽 위 기본 초안 눈 크기를 선택하고 아래 감정 눈을 그 기준으로 맞추라고 지시했다. 따라서 과거90% 목표를 해당 시각 선택으로 대체한다. `20261018-선택눈크기통일`에서 기본은 같은 SHA로 보존하고 다른6묶음 각각1회 교정했다. 기준과 감정0은 몸폭 정규화 양눈 지름이 약3% 차이지만 play0/play32는 약20~29%, audience0은 약17% 크게 남았다. 전체512+16 패킹·재현·alpha·후계·footprint·3이미지/2decode 제한은 통과했으나, 이를 눈 통일 완료라고 표현하지 않는다. v3는 로컬 검증용이며 전체 적용 여부/미달 묶음 추가 수정에 대한 사용자 응답 대기다. 현재6회 교정 turn에서 추가 자동 생성·눈 합성은 하지 않았다. 사용자 선택은 기본 눈 크기 범위에 한하며 새 교정 전부의 시각 승인/전문 검수 PASS로 확대하지 않는다.

## 현재 검증과 남은 일

첫099 build `qAw4A7zXBJMKoFSso2I2T`에서 전체 단위2,125·typecheck·ESLint·build 통과. 첫 liveness3검사는 경로 전제2 FAIL/창 blur 전제1 FAIL이었다. 이후 local Playwright 설치 소스의 강제 focus emulation을 확인하고 새 liveness spec에서 `Emulation.setFocusEmulationEnabled(false)`로 기본 강제를 해제했다. 테스트 자체도 headed를 명시한다. 실제 별도 창 활성화 뒤 원래 document focus=false/visible을 관측했으며 parked 호흡·zzZ 변화와5.2초 DOM mutation0, 재활성 시 위치 유지가 통과했다. DOM 변경0은 JS 실행/CPU 전체0 인증이 아니다.

두 번째 같은 제품 빌드에서는 studio65초469표본·숨김0·focus/visible 유지·귀가/대기 속성8변경을 실제 관측해 막힌 자동 귀가가12.2ms/13.2ms 재검증 후 일반 행동으로 복귀함을 확인했다.120ms 샘플만으로는 이 짧은 상태를 놓쳐 attributeOldValue 관측을 추가했다. viewer는 날짜 발판으로 먼저 진행해 자동 귀가 경로 전제가 발생하지 않았으며 계속 움직였다. 이를 viewer blocked-path PASS로 바꾸지 않는다. 무작위 선택을 조작하는 대신 최종 native 검사는65초 표시 연속성·실제 focus/visible·최대 정지6초 미만을 공통 필수로 하고 분기 발생 trace를 별도 증거로 남긴다. 실패 report/frame/PNG/context는 attempt1/attempt2-sealed에 보존했다.

패널/작은 집22 native는 qAw 빌드에서 통과했으나 생성자 스냅샷 열람이 익명 로그인에 덮인 기존 금속 스킨을 추가 발견했다. desktop header만 utility skin에서 제외하고 normal/hover/visible label 잉크까지 공통 토큰으로 정정했다. 후보 build `04EC2FHtgeRYQ4lYhFD5C` 전체 단위2,126·typecheck·lint·build, 강화한 panel-chrome10 native 통과. 실제 header 버튼의 동일 배경/글자/모서리/44px, 세 패널의 동일 material·제목 중앙·reload 저장, 작은 집 title/X 및 rail fold 복원과 모바일 제외를 확인했다. 나머지41 native 회귀는 진행 중이다.

후속 후보41 native는40 PASS/1 FAIL이었다. 실패는1480px compact에 남겨둔 옛 접기 버튼 전제의 locator timeout이다. 실제 rail1920px에서 같은 숨김·설정창·주민 identity 단언을 유지하도록 교정해1/1 PASS, 함께 compact X focus·과일/rail 접기2개도 통과했다. 기존 다른 fold 위치를 검색해 이미 실제 rail인 것은 유지했고, 이번 변경과 무관한 과거 mobile-positive/studio-no-fold harness는 현재 계약의 증거로 쓰지 않았다. 후보 build에서 서로 다른53 native 경로가 확인됐으며 viewer/studio65초는 각각470표본·숨김0·최장 불변139.1/278.9ms다. studio blocked trace는 발생했고 viewer는 자연스럽게 다른 발판으로 진행했다. failed core report/context는 core-candidate-sealed에 보존했다.

눈 추가 수정 질문은 아직 응답 대기이므로 UI/정지 변경만 먼저 출시한다. 아트 전용11 tracked 파일은 먼저 byte/SHA 백업한 뒤 HEAD098과 같은 bytes로 되돌렸다. 기존 metadata·응원 URL·해당 asset tests를 유지하며 신규2회차 원본/영수증/비교·v2/v3 공개 파생 파일은 로컬 보존·staging 제외다. 현재 눈이 통일됐거나 새 교정본이 배포됐다고 표현하지 않는다.

UI-only build `qdkdXh1FMiq__mERbbfSI`에서 전체 단위2,125·typecheck·lint·build·harness258 통과. 같은 빌드 핵심 native16/16 통과했다. viewer471표본·studio469표본 모두 실제 focus/visible·숨김0·페이지 오류0·쓰기0이며 최장 불변140/139.1ms, 양쪽 모두 blocked trace가 발생했다. 실제 별도 창 blur 검사도36표본으로 CSS 호흡·zzZ와 DOM mutation0·제자리 복귀를 재확인했다. report는 `.scratch-pw/companion-099/ui-release-native.json`에 보존했다.

독립 UI 최종 검토에서 넓은 coarse-pointer 화면의 제목36px 셀렉터가 기존44px 규칙을 덮는 P2를 발견했다. 좁은 모바일 agenda는 제외되어 이 문제의 대상이 아니다. 같은 특이도의 coarse44px와 studio44÷zoom 규칙을 복구했고 독립 재검토 blocking0이다. 실제 hasTouch=true·coarse/fine media query·maxTouchPoints를 선행 확인하는1920 viewer/preview·1920 studio zoom.9·2560 studio zoom.8 네 경로와 기존 fine36px 단언을 추가했다. 실제 태블릿 하드웨어 검증은 아니다.

099 범위의 새 이미지 기준선12개는 익명·studio × light/dark의 접힌 집 카드·compact 진입 버튼군·제목/X만 캡처한다. 기존 전체화면 기준선은 관련 없는 과거 UI까지 담아 변경하지 않았다. 동적 달력·캐릭터를 대상에 넣지 않고 studio build badge만 마스크한다. 최종 coarse 수정 build `IXfC0DLqqVnJVlAf3IkLi` build/typecheck/lint 통과. 기준선 생성4 native와 별도 재실행20/20 native가 통과했고,12개 기준선을 직접 열어 확인했다. 네 coarse 경우 제목은 실제44px, 기존 fine 경우36px를 유지했다. viewer471/studio469표본 숨김0·최장 불변139.4/279.1ms, studio blocked trace 발생·viewer는 자연스럽게 다른 경로 진행이었다. blur36표본·DOM mutation0·제자리 복귀, 실제 접힌 집/설정창 주민 복원·3과일/쓰레기·compact keyboard focus도 통과했다. 증거는 `ui-chrome-baseline.json`, `ui-final-native.json`과 build별 raw JSON/PNG다. 첫 기준선 명령은 project 접두사를 고려하지 않은 grep의 시작 anchor 때문에0 tests였으며 anchor를 제거한 실제4/20 실행만 PASS로 기록한다. 원격 CI·배포 full SHA/UI 확인은 아직 진행 중이다.

이전098 PASS를 현재 제품 검증으로 대체하지 않는다. 실제 방송 PC 장시간 OBS·096 음식 창 전환 focus·진짜 권한/RLS·공급자 한도는 별도 미해결 범위다.

최종 소스 재실행 단위208파일/2,125개 전부 통과(`unit-ui-final.json`), build 이후 typecheck·lint 및 harness258도 통과했다. 제품 변경은 UI/동행 런타임에 한정하고 공개 API·권한·서버 DTO·KST·DB·의존성과 원본098 아트 경로를 변경하지 않았다. 새 기준선12개를 포함한 승인 범위만 커밋하며 사용자 기존 아트·로컬 설정·새 눈 초안은 제외한다. 실제 배포 검증은 다음 운영 확인 결과로 구분한다.

## 운영 확인

`cf00f2b4924813d39ee2b4b60c44a1e837e002e2`를 main에 일반 push했다. [Remote quality39056897644](https://github.com/BlueSky8bya/VIC_Schedule_Studio/actions/runs/39056897644) job117466603340의13단계가 전부 success, Vercel deployment `D9wnSf5uHcg7Ucsja5c4k2tmqRdN` success다. 운영 `/api/soop-live`가 같은 full SHA를 반환했고 clock200/no-store·warm204·익명 developer401/error-only/no-store·fixture 미노출이 통과했다. fixture는 streamed HTTP200 안의404 fallback으로 거절되므로 HTTP404였다고 표현하지 않는다. 로컬 `remote-release.json`, `deployed-canaries.json` 및 HTTP 원본은 `.scratch-pw/companion-099`에 보존했다.

열려 있던 실제 개발자 편집실을 reload해 cf00f2b badge·저장됨·한 pet/home을 확인했다. 로딩 직후 아직 hydration 전인0pet/1panel 표본을 완료 상태로 판정하지 않고 실제 집 mount를 기다린 뒤 검증했다. 실제 세 패널 배경rgb(253,246,228)·선rgb(231,220,198)·동일 그림자·중앙 제목을 확인했다. 실제 시청자 미리보기에서도 같은 material·접힘 저장·한 pet/home을 확인했다. 양쪽에서 패널을 접어 header 집을 열고 compact marker·접기/chevron0·X1·실내132px·버튼44px를 확인했다. 미리보기에서는 X 닫기/키보드 Enter 열기/X focus도 직접 확인했다. normal header의 설정/집/검색/기록이 같은 rgba(255,255,255,.72)·ink·pill44px를 사용했다. 직전 click의 hover 배경 표본은 normal 비교와 구별했다.

실제 UI 스냅샷을 열람했으며 일정 편집/저장/하트 변경은 하지 않았다. 끝나고 실제 개발자 편집실·오른쪽 패널·태그/계절 접힘·집 펼침의 원래 상태로 복귀했고 pet/home1을 확인했다. 새 탭은 만들지 않았고 fixture 서버는 종료했다. 운영 장시간 OBS 하드웨어 성능까지 검증한 것은 아니다. 새 눈 초안은 배포되지 않았으며 pending 시각 선택 뒤에만 후속 범위를 진행한다. 이 배포 후 문서 결과는 문서만을 위한 재배포를 피하려고 로컬에 남긴다.
