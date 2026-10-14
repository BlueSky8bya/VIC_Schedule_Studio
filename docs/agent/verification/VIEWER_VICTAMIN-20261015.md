# 시청자 빅타민 검증 · 2026-10-15 KST

[PLAN-041](../plans/PLAN-20261015-041-viewer-victamin-companion.md), [ADR-0031](../decisions/ADR-0031-viewer-victamin-local-companion.md). 소유자 동행 캐릭터/전용 설정 요청과 기존 커밋·푸시·배포 승인 범위.

## 결과

- 설정 최상위 `빅타민`, 하위 `움직임·장난·교감·성격`. 전체OFF 기본, 세부선호 유지. 돌아다니기/점프/잠/하트콩/배경숨기/집기/쓰다듬기, 속도3·크기3·성향3. 공용 설정 훅/리스트로 익명·viewer·studio viewer preview 한 구현.
- 선택한 기본OFF에서 별도 UI 동적 import·atlas 요청·observer/프레임 루프 없음. ON 한 마리, visible geometry만 읽는 로컬 Utility AI. 실제 제목/본문/eventid를 뇌로 전달하지 않고 DB/추론/모델 요청0.
- 카드 윗면/빈 날짜/바닥 탐험, 탄도 점프/착지, 집기·버둥/쓰다듬기/잠/깨기/희귀장난/숨기·복귀. off/변경/모달/최초공개 중 정리, 같은 달의 일시중단은 위치 보존. reduced는 제자리 반응, 낮은gfx는12fps, full30fps.
- 숨바꼭질용 임시 배경 lease는20초 상한, 저장된 ambient값 무변경. 실제 사용자 선호 변경/숨김/모바일/gfxoffsoft/showcase/pause에 취소. 모바일/agenda는 캔버스를 추가하지 않음. 실제 하트/기대 투표는 자동으로 누르지 않음.
- 실제 builtin 이미지1회, 원본1254²·256개의 비어있지 않고 byte-distinct한 셀. 파생1280²losslessWebP1,332,324bytes. 재현/원본/SHA/생성문/관찰은 [제작기록](../../../art-src/빅타민/동행/작업회차/20261015-달력탐험/제작기록.md). 생성자 관찰과 사용자 미술 승인은 구별.

## 실행한 검사

- typecheck, full lint, 최종 fixture production build 통과. 이후 테스트 수정은 scoped lint/typecheck 통과. 의도적 화면 기준선 교체 없음, 새 UI는 실제 캡처/좌표/상호작용으로 확인.
- 관련 단위65/65: brain13, preferences13, ambient lease11, premiere26, publicDTO2. 발판 한계·쿨다운·선호OFF·쓰기 quota복구·다른탭설정·lease수명/정리 포함.
- 설정 렌더3/3: 기본OFF·세부선호 보존/reload·4-subtab 방향키/Home/End·월 불변·모바일fit. PC1440×1000/모바일390×844 네 화면 검토. `.scratch-pw/companion-settings-*-{motion,pranks}.png`, `companion-settings-capture.json`: 가로overflowfalse, 해당 캡처POST0.
- 동행 렌더9/9: 기본OFF atlas0→공유ON/OFF, PC/mobile 쓰다듬기/drag, 키보드/메뉴배치/낮잠, 설정pause/resume, reduced고정위치, 자율이동, 최초공개20s에서hidden/exit/resume, visibility/showcase 중단과위치복귀, export표면에동행0. 관측 POST0, 전POST차단.
- 첫 동행 실행6통과/1실패: fixture가 서버 하트 action prop을 주지 않아 `.event-heart` DOM이없었음. 제품 실패로 숨기지 않고 하네스에 합성 로컬 하트 button sentinel을 추가. native click spy로 짧은 배치/1.2초 hold 후release 모두click0/aria상태불변/POST0 확인. 운영 투표/RLS 검증으로 주장하지 않음.
- 실제 로컬 `/` PC1440/모바일390: fresh context 기본OFF atlas0, ON이후 실제atlas1280decode, 쓰다듬기, 설정창pause, 장난토글변경/전체OFF/선호보존, pageerror0. 각 context POST1차단/실제서버쓰기0. 과거달 조회만, 시험데이터 생성0. `.scratch-pw/companion-root-local.json`, `companion-local-{1440,390}.png`.
- G21 독립 코드 리뷰: placement의 독립click 누수/긴press 만료, 방향키 월이동, 화면밖 메뉴/초점복귀, 변경된발판·삭제목표/상단사이즈경계, quota선호회귀를 수정. 최종 확정 차단 없음. 전문 미술 검수 아님.
- harness 기존2실패(active-rule inventory/RULE_MIGRATION mapping) 유지. 새ADRindex 상태 첫불일치는 선행소개링크가 parser첫일치에잡힌 문서문제였고 행하나로정리해해결.

## 한계

실제 신경망/초파리뇌·LLM학습·의식/인격 인증 없음. 리듬/표정/욕구 기반 게임 AI다. headless Chromium 검증이며 실기기Safari/장시간 배터리/HCI사용자연구/256포즈별 전문미술승인 아님. 성격·계절장난의 희귀도는 실제 사용자 피드백으로 조정한다. 원본/반려이력·다른사용자작업은 보존했다. 공개DTO/DB/권한/unlock/KST/1840기하 변경 없음.

## 운영 배포

- 제품 `b4b6c52a8266750f007c7f3c1f1843be1ddc7a96` [Vercel success](https://vercel.com/bluesky-s-project3/vic-schedule-studio/9U11v23Sc8kQGthXdseSQZ5rAV5K), live build SHA 일치.
- 운영 sprite HTTP200/1,332,324bytes, SHA256 `535d67d02bac975e0f2c41b3d34dadcb393b9ba1cfab3d87187a5017a9d5d24f` 로컬과 일치.
- 운영 실제 `/` PC1440/모바일390: 기본OFF atlas0, opt-in decode1280, 쓰다듬기, 설정창pause, 장난토글/전체OFF/선호보존, pageerror0. 각 context POST1차단/실제쓰기0. 과거달 조회, 시험데이터 생성0. `.scratch-pw/companion-root-production.json`, `companion-production-{1440,390}.png`.
