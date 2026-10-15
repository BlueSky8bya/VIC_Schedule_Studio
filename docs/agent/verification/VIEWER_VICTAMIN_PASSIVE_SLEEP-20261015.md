# 빅타민 작은 그림·비활성 창 수면·하트

2026-10-15 KST. [PLAN-045](../plans/PLAN-20261015-045-victamin-clean-art-and-passive-sleep.md). 현재 사용자 요청에 따른 변경. 기존 집/돌봄은 PLAN-044를 계승한다.

## 근거와 선택

- [Chrome Page Lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api): visible+unfocused(passive)와 hidden은 별개다. 다른 창 클릭은 캐릭터를 지우는 조건으로 쓰지 않는다. 강한 차단(모달·최초공개·감상·hidden)은 기존 즉시 중단을 유지한다.
- [web.dev 애니메이션 성능](https://web.dev/articles/animations-guide): 이동·호흡·꿈은 transform/opacity, 전역 filter 없음. 실제 pose 교체에 필요한 작은 paint와 연속 위치 이동을 분리한다. 작은 키포즈 텍스처로 메모리/프레임 소음을 줄인다.
- [CDP Performance](https://chromedevtools.github.io/devtools-protocol/tot/Performance/): 누적 renderer metrics의 시간 차이로 OFF/활동/수면을 비교한다. 측정 구간에는 별도 rAF 샘플러·DOM 관찰·poll을 넣지 않는다.
- [W3C Long Animation Frames](https://www.w3.org/TR/long-animation-frames/): 50ms 이상 프레임만으로 더 짧은 끊김을 판정할 수 없다. 이동 연속성은 별도 프레임 표본 검사로 확인한다.
- [OBS 성능 안내](https://obsproject.com/kb/encoding-performance-troubleshooting): 브라우저와 OBS의 렌더 자원 경쟁을 고려한다. 브라우저 headless 결과는 실제 송출 장비·GPU·인코더 측정이 아니다.

## 동작 계약

보라 하트 첫 클릭은 로컬 저장/표시만 제거하고 실제 핸들러 전에 그 클릭을 소비한다. 다음 클릭은 기존 인간 하트 동작이다. 빨간 하트는 어떤 복제 카드에 있든 우선한다. pause 중에도 클릭·storage 경로는 남기고 변이 관측만 정지한다. 투표/API/count/aria-pressed는 빅타민이 수정하지 않는다.

초점 상실: 현재 유한 행동을 끝낸다. 새 자율 행동이나 먹이 추적의 다음 행동을 시작하지 않는다. 잡고 있기/옮길 곳 고르기는 끝이 없으므로 해제 후 짧게 안착한다. 행동 후700ms 휴식과900ms 하품 뒤 수면에 들어간다. 그 뒤 빅타민 rAF/타이머/욕구·care 갱신/기하 관측/하트 MutationObserver는 정지하고 작은 CSS 호흡/zzz만 남긴다. 이것은 컴퓨터 전체 사용량0이라는 뜻이 아니다.

복귀 시 관측을 새로 연결해 최신 발판을 확인하고800ms 기상한다. 잠든 경과시간을 욕구 벌점·한 번의 긴 이동에 더하지 않는다. 빠른 복귀는 휴식을 취소한다. 처음부터 비포커스인 OBS Browser Source도 이벤트 없이 수면으로 간다. sleep 설정은 자율 낮잠 선택이며 비포커스 절전 정책은 별개다.

수면 중 resize/scroll/집 위치 이벤트가 오면120ms로 모아 한 번만 새 기하를 읽고 안전 발판으로 다시 놓은 뒤 관측을 끊는다. hidden→크기 변경→비포커스 복귀도 최신 한 번 측정 후 그린다. 일반 내용 변이는 다음 초점 복귀 시 재측정한다. 발판0이면 보이지 않은 채 절전에 도달한다. 보이지 않는 탭/차단 모달은 즉시 숨김과 안전 중단을 우선한다. 한 runtime/공개 데이터/기기 로컬 care/defaultOFF/1840 export기하/KST·권한/unlock/실제DB 무변경.

## 그림

VIC 헌법/imagegen builtin을 사용해 원본 REF-016/017을 실제 열람하고 단일4×4 키포즈를 제작했다. 두 귀·무사지·사각층·주황 네모 볼은 유지하고 넓은 면/따뜻한 외곽선으로 단순화했다. 과거256셀 native와 atlas는 보존한다. 생성자 전체 관찰이며 사용자 시각 승인/전문 미술 PASS가 아니다. 파생은 crop/공통 비례 축소/무손실WebP와 등록 metadata만 사용한다. 배경의 미세 alpha 색과 동작선은 실제 불투명 화면에서 확인한다.

실제 native1254², 공개 atlas512²/164,524bytes. 기존1280²/1,332,324bytes 대비 전송87.65% 감소, 단순 RGBA 텍스처 면적84% 감소(6.25→1MiB, 실제GPU메모리 측정 아님). 동일 Lanczos3 비례 축소·패딩, bbox 중심40/발80 metadata와 최대55×55.625/80단위로 기존 .76 충돌 범위 유지. `node scripts/prepare-viewer-companion-clean.mjs --check` 재현 통과. [공개 그림](../../../public/companion/victamin-clean.webp), [실제 builtin 생성문](../../../art-src/빅타민/동행/작업회차/20261015-깔끔한키포즈/생성요청.json), [제작 기록](../../../art-src/빅타민/동행/작업회차/20261015-깔끔한키포즈/제작기록.md). 원본/파생 SHA는 같은 회차의 `파생기록.json`에 있다.

## 검증

제품 최종 B4 production fixture build/typecheck/lint 통과. 관련 단위106/106(10파일), 문서/규칙43/43 통과. 렌더 범위는 아래와 같다.

| 범위 | 결과 | 증거 범위 |
|---|---|---|
| care/home/presence/interruptions/settings/basic | 33개 최종 통과 | B4 최초31통과/2실패 후 아래 두 검사 보정·재실행2통과 |
| 이동/방향/외부 하트 관찰 | B4 4/4 | full 위치60Hz, lite29.51Hz; 실제좌표는 연속·그림은1초에2회 교체. 반대 이동/UI 반사 오류 없음 |
| passive | B4 6/6 | 진행 중 착지/식사 완료, 휴식/하품, DOM쓰기·Range0, focus 재측정, 빠른복귀, 발판0, hidden중 resize, 모바일 터치/reduced |
| isolated heart adapter | 7/7 | 실제 소스 기반 pointer/Enter 첫 제거와 다음 인간 핸들러, 실제2페이지 storage/pause 빨강 우선 |
| Next heart runtime | B4 4/4 | pet 추가/제거·reload, 인간 빨강 보호, pointer/Enter clear-only; 실제POST0 |

B4 최초 실패는 제품 오류로 숨기지 않았다. 집 검사는 resize 직후 이전 inline집을 보고 새 compact 진입점 클릭을 생략하던 경합이었다. 새 진입점이 실제 보인 후 열도록 보정했다. overlay 복귀 검사는 옛6Hz sprite-column 변화를 생존 증거로 삼았으므로 새 정지 포즈에 맞춰 실제 클릭의 손길 응답을 검사한다. 이동·타이머 생존 검증은 별도 실제 프레임·행동 검사로 유지한다.

독립 코드 검토에서 idle 동일셀 재쓰기와 빈 발판에서도 수면 paint가 재노출하는 두 문제를 찾아 수정했다. CSSOM의 transform 문자열 정규화 때문에 같은 transform이 반복 쓰이는 문제도 desired값 캐시로 막았다. 추가로 parked 상태의 resize/hidden 복귀에서 오래된 발판을 쓰지 않도록 이벤트당 한 번 재측정을 넣고 회귀 검사했다. 수정 후 추가 확정 차단 없음. 미술 전문검수는 요청하지 않았으며 이 코드 검토로 대체하지 않는다.

캡처/지표는 ignored `.scratch-pw/companion-clean-*`, `companion-passive-*`, `companion-motion-{max,lite}.json`에 보존. 실제 루트 local PC1920×1080/mobile390×844 두뷰도 통과했다. 과거2025-09/전POST차단, 기본OFF atlas0→ON1, 집/compact, tap/실제 Chromium touch hold-drag, SVG 음식 배치/섭취, 쿠션, resize 동일개체/care, 집 조작 접근, OFF 제거/export밖을 확인했다. 각뷰 오류0·루트POST1차단·서버송신0. 운영 배포는 아직 진행 전이다. 기존 `harness:verify` rule inventory/RULE_MIGRATION2실패를 재확인했다. 별도 brief 예산 문제는 이 기능과 별개로 유지한다.

## 절전 비용 측정

최종 B4, Windows/Chromium148 headless, 각5초×3회 교차 순서의 총9표본. fixture·음악/배경OFF·roam/jump/foodOFF로 **깨어서 정지**와 parked를 비교했다. POST0, Layout0. 측정 창에는 브라우저 rAF 샘플러·poll·DOM spy를 넣지 않았다.

| 중앙값 | OFF | 깨어서 정지 | parked |
|---|---:|---:|---:|
| renderer task wall-time 비율 | 0.205% | 0.478% | 0.316% |
| Script ms/s | 0.954 | 1.700 | 1.037 |
| Layout ms/s | 0 | 0 | 0 |
| Style ms/s | 0.091 | 0.636 | 0.410 |

parked의 CSS 호흡/꿈과 사이트 기본 작업은 남는다. 따라서 ‘CPU0’·‘OBS 향상율’로 부르지 않는다. Task 표본 범위는 OFF .201–.222%, 정지 .467–.554%, parked .309–.331%였다. 신뢰구간/고급GPU/배터리 인증이 아니다. 걷기60Hz 최대비용도 이 정지 실험에 포함되지 않는다. 별도 이동 프레임 검사는 위 표 참조.

재현: 이미 띄운 로컬 production fixture에 `node scripts/measure-viewer-companion.mjs`. 스크립트는 새 서버를 만들지 않으며 모든POST를 차단한다. raw 결과는 `.scratch-pw/companion-passive-metrics.json`에만 쓰며 실제 일정 내용이나 계정 식별자는 수집하지 않는다.

한계: 실제 OBS 동시송출/장비별GPU·encoder, Safari, 실제 스크린리더, 배터리는 미검증. 테스트에서는 fixture/과거 월과 모든POST 차단을 사용하며 실제DB 쓰기 없음.
