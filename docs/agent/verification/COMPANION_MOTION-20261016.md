# 빅타민 전체 동작 리듬 검토 — 2026-10-16

대상: [PLAN-071](../plans/PLAN-20261016-071-companion-motion-review.md). 편집실·시청자·미리보기의 같은 로컬 companion runtime. 아래 진단의 `file:line`은 변경 전 `931d690d` 기준이며 개정 수치는 공유 `lib/ui/viewer-companion/timing.ts`에 모은다. 32개는 논리 clip 수다. 새 그림 32개 또는 수백 개의 연속 원화를 만들었다는 뜻이 아니다. 이번 리듬 수정에서 기존 원본·패킹·귀 교정 이미지는 변경하지 않는다.

## 원인과 설계 기준

짧은 클릭도 전체 3,200ms를 사용했고(`components/poster/viewer-companion/viewer-companion.tsx:1499`), 충격 18%→감정 60%→회복 22%의 같은 비율을 배분했다(`lib/ui/viewer-companion/play.ts:13`). 따라서 ‘콩’ 동작부터 576ms, 울먹임 진입과 유지에 1,920ms, 회복에 704ms가 걸렸다. 울먹임은 실제 3개 native key를 16개 슬롯에 반복한 packet이다(`scripts/prepare-companion-play.mjs:29`, `:116`). 고해상도와 표시 FPS를 높여도 사건 리듬 자체는 느린 상태였다.

개정은 빠른 접촉→표정 인지→짧은 회복을 행동별 절대 길이로 나눈다. 울먹임은 충격 100ms→울먹임 900ms(180ms 안에 읽을 표정 도착)→회복 280ms, 총 1,280ms다. 표정 유지 중 작은 유한 훌쩍임만 더하고 얼굴을 흐리게 섞지 않는다. 쓰다듬기·들기 입력은 도중에도 즉시 우선한다.

이 수치는 프로젝트의 디자인 선택이며 Apple이 정한 권장 밀리초가 아니다. Apple의 [Designing Fluid Interfaces](https://developer.apple.com/videos/play/wwdc2018/803/)에서 직접 반응·중단 가능한 동작·공간 일관성·움직임의 속도/연속성을 참고했다. [Motion HIG](https://developer.apple.com/design/human-interface-guidelines/motion)는 행동에 정확히 대응하는 짧은 피드백을 강조한다. [Understanding user interface responsiveness](https://developer.apple.com/documentation/xcode/understanding-user-interface-responsiveness)는 원인과 결과의 연결 및 애니메이션/스크롤이 멈췄다가 건너뛰는 문제를 구분한다. 주관적인 귀여움·캐릭터 완성도를 이 자료나 단위검사로 승인했다고 주장하지 않는다.

## 논리 clip 0–31 전수 조사

| 행 | 사용·native/slot 경로 | 변경 전 시간·문제 | 이번 리듬·판정 |
|---|---|---|---|
| 0 | 대기·깜빡임, HD rig 16슬롯/기본 표정 2개 | `motion.ts:36` 6Hz, 한 바퀴 2.67초·눈감음 2슬롯 333ms | 8Hz/2초, 눈감음 250ms. 대기의 전체 몸체는 기존 잔잔한 rig 유지 |
| 1 | 살피기/냄새, HD rig 16슬롯 | `brain.ts:340` 700–1,300ms×종/걸음, 냄새 고양이800·강아지1,100ms. 반응도 긴 편 | 살피기550–950ms×기존 profile, 냄새 고양이650·강아지800ms. 고양이의 긴 관찰 가중치 유지 |
| 2 | 걷기·먹이 접근, HD rig 16슬롯/실제 걷기 key 2개 | `motion.ts:149` 거리80px당 순환·14Hz상한, 이동은 quintic | 거리 소유 유지. 휴식·속도 선택을 일괄 배속하지 않음 |
| 3 | 도약 준비, HD rig 16슬롯 | `viewer-companion.tsx:927` 모든 보통 도약 준비180ms | 준비120ms. 실제 충돌/발판/탄도는 보존 |
| 4 | 상승, HD rig 16슬롯 | `viewer-companion.tsx:929` 실제 탄도 정점 전 phase, 특수 복귀는 구간 비율 | 실제 상승 구간을 소유하는 탄도 유지. 일괄 시계 배속 금지 |
| 5 | 낙하, HD rig 16슬롯 | 같은 파일`:924`–`:933` 낙하/놓기/월 전환의 실제 좌표와 연동 | 중력·첫 발판 착지 유지. 물체의 이동을 표정 시간에 억지로 맞추지 않음 |
| 6 | 착지, HD rig 16슬롯 | 같은 파일`:934` 보통 착지260ms, 특수 착지 별도 비율 | 보통180ms. 눌림→복원은 짧고 발판 좌표 보존 |
| 7 | 과거 held/정리용 rig, 현재 미사용 | native 매핑 흔적만 존재(`prepare-viewer-companion-hd.mjs:111`) | 미사용 명시. 행을 지우거나 다른 행동에 재해석하지 않음 |
| 8 | 손에 들림·귀/몸통 grip, HD rig 16슬롯 | `motion.ts:157` 12Hz, 180ms 중력 늘어남, 좌우/상하 유한 관성 | 12Hz·실제 grip pivot·지속 중력·100ms release mixer 유지. 이미 입력 추종에 적합 |
| 9 | 쓰다듬기·식사 중 행복, HD rig 16슬롯 | `motion.ts:36` phase와 독립인8Hz. 손길 1,500ms/문구phase950ms가 별도 존재 | native8Hz 유지. 쓰다듬기 보상1,100ms, 입력 주기800ms를 공유 값으로 정리. 식사의 씹기는 기존 별도 작은 연속 변형 |
| 10 | 하품, 깨끗한 단일 native hold | `viewer-companion.tsx:936` 잠들기1,000ms; presence는900ms | 잠들기/비활성 presence 모두700ms. 없는 연속 하품 프레임을 만든 것처럼 주장하지 않음 |
| 11 | 수면, 단일 native hold+CSS 호흡·zzZ | `viewer-companion.css:75` zzZ3.6초·호흡4.8초; 기존 호흡은 parked에만 적용 | 호흡4.8초를 실제 수면(data-dreaming)에도 공유. 자발 낮잠도 숨 쉬며, parked JS시계 정지 유지. reduced/off는 정적 표시 |
| 12 | 기상, clean→HD phase16슬롯 | `viewer-companion.tsx:937` 자발기상1,100ms·presence800ms | 두 경로650ms. 외부 창 전환 시 행동 마무리→휴식700ms→하품700ms 정책 유지 |
| 13 | 보라 하트/패널 발끝 누르기, HD rig 16슬롯 | `brain.ts:390` 하트2,200ms·패널1,550ms; 하트 y의 양수 sine가 아래로 눌림(`viewer-companion.tsx:943`) | 하트1,300ms·패널1,100ms. 뛰는 시각적 위상과 실제 impact를 맞추며 인간 투표/실제 일정 데이터는 변경하지 않음 |
| 14 | 숨기·최초공개 카드 진입, HD rig 16슬롯 | `hide-seek.ts:1` 숨기700ms, 최초공개 별도73→69초 실제 카드 진입 | 숨기700ms·실제 카드 목적지 유지. 공개 전 정보를 모션에 사용하지 않음 |
| 15 | 다시 나오기·발견, 단일 clean native hold | `hide-seek.ts:2` 발견1,000ms·자율등장700ms; 최초공개 귀환800ms | 유지. actual 축소/이동/선택 창으로의 소유권 연결이 메시지이며 슬롯 수를 늘려 해결할 문제가 아님 |
| 16 | 기지개, HD rig 8선택슬롯 | `brain.ts:341` 1,150–1,600ms | 850–1,150ms. 폼폼 몸체의 작은 유한 신장 유지 |
| 17 | 털기/정신 차리기, HD rig 7선택슬롯 | `brain.ts:342` 750–1,100ms | 450–650ms. 상시 진동을 만들지 않음 |
| 18 | 일반 실망·하트 막힘, 8native→16슬롯 | `viewer-companion.tsx:1009` 전역%1,800ms 중간 진입/반복; 막힌 하트는 후반부만 | 감정 전환 진입점에서 읽히는 짧은 유한 phase로 연결. 울먹임27과 혼동하지 않음 |
| 19 | 일반 삐짐, 8native→16슬롯 | 같은 전역1,800ms phase | 감정 진입을 기준으로 유한 진행. 반복 집기 후 감정 임계값/친밀도는 보존 |
| 20 | 달리기, 6native→ping-pong10key→16슬롯 | `motion.ts:150` 거리54px 순환/14Hz상한, 실제 scoot 선택은 종/걸음 profile | 거리·방향 소유 유지. 달린 뒤 실수의 계기를 별도 점검 |
| 21 | 구르기, 6native→16슬롯 | `play.ts:24` 전체2.8–4.3초 중42%=1.18–1.81초에서2바퀴. 지나치게 긴 일괄 사고 리듬 | 620ms에2회 회전→어지럼300→눈치440→회복400, 전체1,760ms. 실제 뒷면 key를 사용 |
| 22 | 어지럼, 2native→16슬롯 | 같은 전체의18%=504–774ms | 구르기 뒤300ms·충돌 뒤180ms. ±3도 유한 흔들림 유지 |
| 23 | 회복, 4native→16슬롯 | 사고 후504–774ms; 클릭 후704ms | 행동별280–400ms. 최종 정상 key까지 정방향 재생 |
| 24 | 미끄러짐, 2native→16슬롯 | 사고의42%=1.18–1.81초, 빠른 ‘삐끗’도 슬로모션 | 미끄러짐220→눈물560→눈치440→회복320, 전체1,540ms |
| 25 | 충돌/콩, 2native→16슬롯 | 클릭576ms, 자율사고1.18–1.81초 | 클릭100/110ms·충돌120ms. 울먹임/시무룩 전에 실제 접촉을 빠르게 읽힘 |
| 26 | 두리번·눈치, 3native→ping-pong4key→16슬롯 | 사고의22%=616–946ms | 구르기/미끄러짐440ms, 충돌760ms. 같은 global 비율 대신 상황별 읽을 시간 |
| 27 | 울먹임, 3native→16슬롯, 일부 귀 교정v2 | 클릭1,920ms의 느린 phase, 미끄럼504–774ms | 클릭900ms 중180ms 안에 표현 도착·나머지 작은 훌쩍임. 미끄럼560ms. 기존 귀2개 packet 보존 |
| 28 | 만화식 시무룩, 2native→16슬롯, 귀 교정v2 | 클릭1,920ms, 충분한 접촉/회복 구분 없음 | 충격110→시무룩1,030→회복280, 전체1,420ms. 반복 집기 감정19와 구분 |
| 29 | 강아지 놀이 인사, 2native→16슬롯 | `play.ts:21` sine phase가 중간부터 원화를 역재생. 전체2,800ms | 280ms에 고개 숙임 도착·초대 자세 유지→회복280, 전체1,340ms |
| 30 | 고양이 몸단장, 2native→16슬롯 | 전체3,000ms에 sine 왕복, 손질과 되감기가 섞임 | 520ms의 정방향 손질3회→회복320, 전체1,880ms |
| 31 | 덮치기·기뻐 뛰기, 2native→16슬롯 | 덮치기2,800·기쁨3,000ms 모두 sine phase 되감김 | 덮치기820→회복300=1,120ms. 기쁨550ms도약2회→회복280=1,380ms. 위치/유효 발판 보존 |

## 상황·프레임 경로 조사

- 직접 조작: `viewer-companion.tsx:1393` 이하 실제 pointer capture·드래그·짧은 클릭 분리를 보존한다. hover 쓰다듬기와 Enter 위로는 같은 보상 경로다. canceled/drag/긴 hold를 콩 클릭으로 바꾸지 않는다.
- 표시: `viewer-companion.tsx:569`, `:1027`의 연속 행동은 full60/lite30Hz, 고요한 native loop는14Hz다. `motion.ts:149`의 걷기·달리기 stride 상한과 `:200`의100ms scalar mixer를 유지한다. 이번 울먹임 문제는 OBS 이미지 크기나 FPS 축소로 고칠 문제가 아니다.
- cold packet: `viewer-companion.tsx:428`에서 현재 행만 요청하고 packet준비 전에는`:437`이 마지막 그림을 유지했다. 행동 시작에 현재/다음 두 행만 먼저 준비하도록 연결한다. 기존 decode 동시2개·strong LRU3개(`sprite-quality.ts:47`)를 확대하거나 전체32행을 미리 받지 않는다.
- 집·쇼파·스크롤: `support-motion.ts:4`의900ms 유한 반응과 `held-inertia.ts:6`의1,500ms 관성 tail, `sofa-pose.ts`의 실제 전체 몸체 깊이는 변경 대상이 아니다. 펫 세계 좌표와 레이어를 애니메이션 리듬 변경에 끼워 넣지 않는다.
- 창/숨김 탭: 현재 행동 마무리 뒤 쉬고 잠드는 presence 순서를 유지한다. parked는 JS반복없이 CSS호흡/zzZ만 보이고, 실제 hidden은 시계를 멈춘다. 일반 팝오버는 펫을 밀지 않고 가린다.
- 최초공개: `lib/ui/premiere/company.ts:4`의 관객 개별 seed·박자·휴지·돌아보기/좌석화와 `viewer-companion/premiere-travel.ts:6`의 실제 일정 진입/귀환은 이미 목적에 맞는 경로다. 최종10초 숫자 집중,5→2초 관객 fade,1초완전제거를 유지한다. 모바일 빅타민은 계속 제외한다.

## 검증 상태

전수 조사는 소스·패킹 계보·선택 row·실행 시계의 연결을 대상으로 한다. 실제 모든 OS·OBS 조합의 주관적 움직임 검수를 대신하지 않는다. 최종 통합 빌드/실물 입력/배포 결과는 메인 검증 뒤 아래에 기록한다.

## 일정 장난의 실제 연결

- 기존: 달리기·구르기·어지럼·눈치·회복 clip, 음식 유한 튀김, 일정 ±2.2° 장식 회전과 클릭/6.5초 복원은 구현돼 있었다. 사고는 연속 이동 뒤 다음 idle 결정에서 뽑는 제자리 공연이어서 실제 점프 착지/달리기 도착과 구분되지 않았다.
- 개정: 실제 일반 공개 일정 발판에 도착한 이동 완료에서 한 번 판정한다. 달리기는 48px 이상 scoot와 충분한 안전 구간이 필요하며, 실제 일정 외곽 24px 안쪽 도착은 콩, 안쪽 도착은 구르기로 연결한다. 일반 점프 착지는 미끄러짐으로 연결한다. 발판 폭은 몸 전체 텍스트 회피가 이미 검증된 중심 이동 구간이다. 수평 이동 없는 착지 반응은 좁은 안전 구간도 허용한다.
- 기존 동물/걸음별 실수 확률과 20초 play cooldown을 재사용한다. 바닥의 달리기 뒤 덤벙거림은 유지하며, 일정 위의 같은 사고를 idle 결정에서 다시 추첨하지 않는다.
- 수동 낙하·위치 옮기기·집 이동·최초공개 이동·먹이 경로·편집 드래그·창/비활성/감소 동작에서는 이 자동 사고를 추가하지 않는다. 일반 공개 일정 여부를 다시 확인하며 떡밥·필터·선택/직접선택·드래그·연결 중인 일정은 보호한다.
- `cardPrank`는 기존 기울임을 보존하는 기본 ON이다. 설정 → 빅타민 → 장난 → 일정 기울이기에서 독립 OFF/저장 가능. OFF는 기존 회전/marker/유한 복원 타이머도 정리하며 캐릭터 자체의 구르기·실수 연기는 유지한다.
- 일정 데이터·정렬·하트는 바꾸지 않는 로컬 표시 효과다. 새 토글은 `companion-card-prank#on/off`만 기존 이용기록에 남긴다. 자율 사고를 사람의 기능 사용으로 기록하지 않는다.

## 통합 검사

- `npm run typecheck`, `npm run lint`, `npm run build`: exit0. 최종 fixture 빌드 `Zp-snduoA4gKnSV6VOM-n`.
- 관련 단위검사 58파일 578개 PASS. 문서/세션 검사 18개 PASS. `harness:verify`는 기존 RULE_MIGRATION inventory 불일치 2건 유지(PASS 아님).
- 독립 리뷰: 타이밍·도착 계기·공개/편집 보호·토글 복원·수동/먹이 경로 제외·추가 상시 루프/네트워크/RNG 없음 확인. 몸체가 이미 안전한 중심 구간의 좁은 착지와 실제 카드 외곽 계산도 별도 확인.
- Native 리듬/토글/실제 착지 연결 8개 PASS(48.1초, 재시도 0), 이용기록 6개 PASS(28.9초). 같은 최종 fixture 빌드를 사용했다. 울먹임 표정 진입은 시청자132.3ms·편집실121.4ms, 전체 반응 종료는1,281.8/1,287.5ms였다. 실제 점프→미끄러짐 연결은16.9–18.7ms였다.
- 위 8개 중 자동 카드 접촉 검사는 날짜 숫자만 CSS로 숨겨 경쟁 발판을 줄인 집중 fixture다. 카드·geometry·뇌·충돌·시계·native 조작은 실제 구현이다. 전체 달력의 무작위 탐색으로도 두 surface 접촉을 관찰했지만 한 회차의 안정적인 전수 통과로 주장하지 않는다. 실패한 탐색 기록도 보존했다.
- 관찰1,106프레임 모두 같은 펫 DOM이 계속 표시됐고, 일정 기울이기 ON에서 회전1개/OFF에서0개·클릭 복원·설정 재진입/새로고침 저장을 확인했다. 서버 쓰기와 페이지 오류0. 최종 테스트 작성 뒤 typecheck/ESLint도 exit0.
- 증거: `.scratch-pw/companion-071-rhythm-final-v4-report.json`, `companion-071-rhythm-measurements.json`, `companion-071-activity-report.json` 및 surface별 screenshot. 운영 DB 시험 쓰기 없이 fixture의 mutation을 가로챘다. 실제 OBS 송출 실측을 했다는 뜻은 아니다.
- 기존 스크롤/프레임 지연·음식 첫 발판/집 이동·소파 전체 몸체 접촉·팝오버 뒤 가림·편집 입력칸 숨기/추출·모바일 제외 회귀18개 PASS(128.2초, 재시도/skip0). `companion-071-regression-report.json`. 소파 검사에서도 서버 쓰기/페이지 오류0.
- 최종 문서/세션 검사18개 PASS. harness는 위 기존 inventory 불일치2건을 다시 확인했으며 PASS가 아니다.

## 운영 배포

- 제품 커밋 `2a65aeadd577f6c0a16ecd78a8ff042fbb34e1c2`를 main에 push했고 2026-10-16 21:08 KST에 Vercel success와 운영 `/api/soop-live`의 정확한 build SHA를 확인했다. 공개 화면 HTTP200, 정적 script24개 정상 응답, `companion-card-prank`와 기존 설정/조작 marker를 확인했다.
- 검사한 fixture build의 제품 소스12개와 커밋 소스가 일치한다. `presence.ts`의 마지막 빈 줄1개 제거만 별도로 입증했다. 코드 의미 변경은 없다. `.scratch-pw/companion-071-committed-source-proof.json`, `companion-071-production-deploy.json`, `companion-071-deployed-resources.json`.
- 실제 운영 로그인 계정의 전 기능 검사나 OBS 방송 장비 실측을 수행한 것으로 확대하지 않는다. 두 surface의 native 동작 검사는 위 fixture 증거에 한정한다. 승인된 아트 및 사용자의 미커밋 제작기록/이미지는 포함하거나 변경하지 않았다.
