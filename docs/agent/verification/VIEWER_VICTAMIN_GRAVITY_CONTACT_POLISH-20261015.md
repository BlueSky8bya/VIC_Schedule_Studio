# 빅타민 중력·교감·패널·화질 검증

2026-10-15 KST. [PLAN-050](../plans/PLAN-20261015-050-victamin-gravity-contact-and-polish.md). 현재 상태: `23fe0259` main push·운영 배포 및 PC/터치 확인 완료. 아래 연구의 결과와 제품에 적용한 판단을 구별한다.

## 원자료와 적용 근거

| 1차 자료 | 직접 확인한 내용 | 우리 제품의 적용 판단 |
|---|---|---|
| [Nintendo 공식 Nintendogs + Cats 매뉴얼](https://cdn02.nintendo-europe.com/media/downloads/games_8/quick_start_guide/QuickStartGuide_3DS_NintendogsAndCats_EN.pdf), p5 | 강아지를 부르고 쓰다듬으며 새 환경에 적응·진정시키는 실제 게임 조작 | 버튼의 결과만 재생하기보다 손길에 캐릭터가 표정·몸으로 응답하게 한다. 이 자료가 마우스 제스처의 정확한 문턱값을 정해 주지는 않는다. |
| [Apple, Designing Fluid Interfaces](https://developer.apple.com/videos/play/wwdc2018/803/) | 입력 도중의 연속 피드백, 즉시 중단·방향 전환, 의도가 정해지면 경쟁 제스처를 취소하는 설계 | 첫 유효 이동의 접촉 반응과 왕복 후 보상을 분리한다. 집기가 시작되면 쓰다듬기 반응을 중단하며 월드 발판 좌표는 움직이지 않는다. |
| [Hosoi et al., Voluminous Fur Stroking Experience, 원논문](https://arxiv.org/html/2406.19746v1) | 실험2는 VR·초음파 햅틱 환경의 21명 연구. 입력에 반응하는 시각 모델은 부드러움·편안함·즐거움에서 유의한 효과를 보였고 햅틱 요인은 편안함·즐거움에서 유의하지 않았다. | 먼저 입력과 동기인 작은 시각 반응을 개선한다. 웹 펫의 애착·치유·즐거움 효과를 이 논문으로 인증하지 않는다. 장비·3D 털 모델을 복제하지 않는다. |
| [Apple, Designing Audio-Haptic Experiences](https://developer.apple.com/videos/play/wwdc2019/810/) | 시각·소리·햅틱을 같은 사건과 원인/결과에 맞추는 설계 | 실제 보상 순간만 기존 피드백 버스를 사용한다. 포인터 이동마다 소리·진동을 발생시키지 않는다. |
| [W3C, Dragging Movements 이해 문서](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | 드래그 조작에는 드래그하지 않는 단일 포인터 대안이 필요하다. 키보드 대안만으로 이를 대체하지 않는다. | 탭·선택 후 클릭 배치와 키보드 조작을 함께 유지한다. 손길은 drag-only 기능이 아니다. |

왕복 2회, 보상 4초 간격, 접촉 크기·감쇠 시간은 이 서비스의 방해·오인식·보상 남용을 줄이기 위한 설계값이다. 논문에서 검증된 최적 수치라는 주장은 하지 않는다.

## 제품 결정과 연결 지점

### 과일: 놓은 자리에서 유한하게 낙하

[`food.ts`](../../../lib/ui/viewer-companion/food.ts)에서 실제 놓은 점 아래의 기존 안전 발판을 고른다. 같은 x를 우선하며 수평 22px 안의 가까운 가장자리까지만 허용한다. 위쪽·먼 달력 칸으로 순간 이동하는 대체 발판을 만들지 않는다. 놓을 때 최대 200개 기존 발판 좌표를 실제 DOM 원점으로 한 번 보정하고 같은 요소의 rect 읽기는 합친다.

[`food-gravity.ts`](../../../lib/ui/viewer-companion/food-gravity.ts)는 가속 낙하와 작은 눌림·한 번의 바운스를 계산한다. 낙하 90~1200ms + 착지 240ms 뒤 끝나며 상시 물리 루프가 아니다. [`CompanionFood`](../../../components/poster/viewer-companion/companion-food.tsx)는 최대 과일 3개와 해당 DOM/document attachment를 유지한다. 유한 낙하 중 실측하는 retained source는 최대 3개이며 움직이는 목표를 따라가도 낙하 시계를 다시 시작하지 않는다. 낙하 중 음식은 뇌의 먹이 목록에서 제외한다.

회귀 검증에서 DOM Range 발판 `680.2326049804688`과 실제 놓은 발 위치 `680.2329711914062`의 차이0.000366px 때문에 같은 발판이 제외되고 다음 날짜의 선으로140.93px 내려가는 원인을 확인했다. 같은 접촉의 반올림 오차만0.5px 허용한다. 단위 검증은0.49px에서 같은 발판,0.51px에서 아래 발판을 구별한다. 기존 음식 검사의 고정550ms 대기는 실제 낙하 완료(`data-falling` 해제) 대기로 바꿨고, 별도의 공중 재집기 검사는 유지한다.

취소 후 휴지통 재드래그 검사의 별도 native trace에서는 음식 중심과 휴지통 목적지가 정확히 같았다. PC는dx/dy0, 모바일은 같은 좌표 touchMove가 pointermove조차 만들지 않아 새 드래그의6px 문턱을 넘지 못했다. 캡처 취득·해제와 휴지통 rect는 정상이었다. 이 검사는 집은 뒤12px(모바일16px) 실제 이동하고 다시 휴지통으로 오는 조작으로 교정했다. 취소·잘못된 pointer·capture·click-through·유한 제거 단언은 유지했다. 제품의 취소 위치나 드래그 문턱을 검사에 맞춰 바꾸지 않았다.

음식 회귀 재실행 중 PC의 별도 펫 공유발판 준비 단계도1회 실패했다. 음식 attachment는1rAF에 복원되지만 기존 펫 전체 발판 스캔은120ms+rAF로 묶이는 차이와 일치한다. 독립 소스 리뷰 후 해당 준비에만 기존 정책과 같은180ms 안정화를 추가했다. 실패 회차의 정확한 elapsed는 측정하지 않았으므로 원인 시각을 단정하지 않는다. 이후 실제 scroll40→즉시 release·p95·같은 DOM source 단언은 대기나 완화 없이 유지했고 마지막 해당1개가 통과했다. 제품 geometry/P 배치 코드는 변경하지 않았다.

집기·다시 집기·키보드·먹기·쓰레기통은 같은 좌표/클릭 소유권을 쓴다. 다시 집으면 현재 presentation 좌표에서 이어받고 낙하를 취소한다. hidden/일반 창/기능 OFF·월 변경·blur의 기존 정리 경로를 유지한다. 감소동작·gfx OFF에서는 정해진 실제 착지점에 바로 놓으며, 착지 후 스크롤은 같은 attachment를 따른다.

### 쓰다듬기: 첫 손길과 보상 분리

[`petting.ts`](../../../lib/ui/viewer-companion/petting.ts)의 contact 모델은 머리 위 첫 실제 이동부터 방향·위치·속도에 맞는 미세 눌림/기울기를 준다. 정지 호버는 접촉 압력을 만들지 않는다. 힘은 420ms 안에 해석적으로 감쇠하고 자체 타이머를 만들지 않는다. 보상 모델은 정규화된 몸 폭의 16% 이상 움직임과 방향 전환 2회를 구별하며 최대 4초에 한 번만 애정을 올린다.

[`viewer-companion.tsx`](../../../components/poster/viewer-companion/viewer-companion.tsx)와 [CSS](../../../components/poster/viewer-companion/viewer-companion.css)는 24px의 작은 장갑과 기존 행복 포즈를 쓴다. 손끝은 실제 포인터 위치를 따르며 반응은 별도 `vc-contact` local transform에만 적용한다. 논리 x/y·발판·이동 방향·달력 기하를 변경하지 않는다. 집기·일반 창·숨김과 충돌하면 접촉 상태를 해제한다. 감소동작/gfx OFF에서는 반응 크기를 줄이고 수평 이동·기울기를 제거한다.

허용된 교감 보상에서만 기존 `hapticSuccess()`와 `playSfx("hope")`를 호출한다. 기존 마스터·분류·음량·숨김 탭 잠금을 우회하는 오디오나 진동 루프는 없다. 탭·Enter 교감과 클릭/키보드 배치 대안을 보존한다.

의도 없는 미세 포인터 떨림이 손 표시를 계속 연장하지 않게 했다. 실제 이동이나 남은 접촉 압력에서만 손 표시를 주고, 압력이 끝나면 기존 의도 판정과 독립적으로 지운다. 최신 반올림·표시 종료 수정은 독립 읽기 전용 리뷰에서도 추가 차단 없음으로 확인했다.

### 패널 기억·모바일 재질·다크 제목

[`panel-section-preferences.ts`](../../../lib/ui/panel-section-preferences.ts)의 `vic.panelSections` v1은 `tag-filter`/`season`/`companion-home` boolean 3개만 기기 로컬에 저장한다. 계정·일정 데이터는 저장하지 않는다. 엄격한 allowlist와 기본 열림, 차단/실패 저장소의 메모리 상태, 같은 탭·다른 탭 갱신을 사용한다. [루트 layout](../../../app/layout.tsx)의 prepaint marker와 [`PanelSection`](../../../components/shared/panel-section.tsx)의 SSR/hydration이 같은 상태를 표현한다. 편집실의 접기 없는 제목/본문은 계속 열린다.

모바일 집 열기는 기존 `.button`을 함께 쓰고 44px 조작 높이·공유 라운드를 유지한다. 기록 버튼과 반대쪽 배치를 유지해 겹침을 되돌리지 않는다. 아젠다 제목의 기존 `.agenda-header h1 span`은 모든 중첩 제목 span까지 고정 검정 rgba로 물들이는 실제 selector 문제였다. [포스터 CSS](../../../components/poster/public-poster.css)는 `h1 > span` 보조줄로 한정하고 `var(--muted)`를 사용한다. 다크 모드·좁은/가로 터치의 실제 대비·가림은 브라우저 검증 대상이다.

### 큰 그림: 원본 디테일과 압축 개선 분리

기존 원본·runtime·receipt를 덮지 않고 [`prepare-viewer-companion-sharp.mjs`](../../../scripts/prepare-viewer-companion-sharp.mjs)로 별도 파생했다. 전체 provenance와 16개 셀 측정은 [새 회차 파생기록](../../../art-src/빅타민/동행/작업회차/20261015-큰그림선명도/파생기록.json)에 있다. 포맷 옵션은 [Sharp 공식 WebP 문서](https://sharp.pixelplumbing.com/api-output/#webp)를 따른다.

| 파일 | 실제 크기·SHA-256 | 의미 |
|---|---|---|
| `vitamin-fluid-q95.webp` | 1280×1360, 1,107,594B; `daa9251b37ccb9cf6dbf174c74341711f6eb3e1bc604ad2dd360201fd57712ff` | 기존 무손실 272셀 archive의 Q95/alpha100 인코딩. 기존 Q90 대비 RGB 압축 완화이며 새 픽셀 디테일/동작 생성이 아니다. |
| `vitamin-keyposes-2x.webp` | 640×640, 132,352B; `8035b61f31b12e0d5f143ab2ce40044288bb4c73ea70721bad09758ca86f5972` | 보존된 1254²/4×4 키포즈 native를 472²로 한 번 다운샘플. 118px 셀을 160px로 패딩한 실제 고해상도 입력 재사용이다. |
| `keypose-sprite.json` | 16개 frame; `d5b1be3c562be547e6a32f04d5226e17dc35e6eee1e5d1e8e70dd248fbd3db94` | 물리 셀160/논리80. largest 8-connected alpha>160 몸의 중심40·발80, clip 여백2 논리단위. |

두 WebP 모두 인코딩 전후 decoded alpha 전 픽셀 변화0, 등록 중심/발 오차0을 검사했다. 원본 native2개·기존 public·기존 receipt/metadata는 SHA 비교로 보존 확인했다. 키포즈 native SHA는 `d303c111b3671dffe1b7bcd529c900f63c4d54f178c4bbd097ab2f8c8603ef47`, fluid native SHA는 `96c56a8437d20029020159ace7109dc94ff826cc38cfa4409ccb68ecc6999f68`다.

[`sprite-quality.ts`](../../../lib/ui/viewer-companion/sprite-quality.ts)는 큰 크기의 idle/look, 교감과 기존 keypose fallback에 준비된 고해상도 16포즈를 선택한다. 이동은 기존 연속 clip을 유지한다. decode 성공 전에는 기존 그림을 유지하고 OFF에서는 새 자산 준비를 시작하지 않는다. 16키포즈는 16개의 서로 다른 기존 포즈이며 새 연속 프레임 인증이 아니다. fluid native 자체는 78~79px 셀이므로 Q95로 실제 고해상도 디테일이 생기지 않는다. 원본 셀 경계 흔적·CSSclip 한계와 미술 시각 승인 상태도 바꾸지 않았다.

활성 fluid+keypose의 decoded RGBA 합은 8,601,600B(8.203125MiB), 추가 keypose는 1,638,400B(1.5625MiB)다. 이는 실제 프로세스/GPU 최고 메모리 측정이 아니다. 기존 Q90과 새 Q95가 교체 중 함께 cache되면 두 fluid+keypose의 RGBA만도 약14.84MiB가 될 수 있으며 브라우저 decode/업로드 버퍼 등은 별도다.

## 검증 상태와 남은 범위

| 검사 | 현재 근거/상태 |
|---|---|
| Typecheck·lint·production fixture build | 통합 담당 root 실행 결과 PASS. 이 문서 담당자가 별도 재빌드한 결과는 아니다. |
| 관련 정적 단위 | root 통합 실행 271개 PASS. 브라우저 조작/실제 장치 검증과 구별한다. |
| 새 자산 재현 | `node scripts/prepare-viewer-companion-sharp.mjs --check` 직접 실행 PASS. 입력 불변·두 output/metadata/receipt 재현·alpha/등록 검사 포함. scoped script lint 및16개 metadata finite/clip 검사 PASS. |
| 자산 시각 확인 | ignored PNG `.scratch-pw/companion-keyposes-2x-050.png`, `.scratch-pw/companion-fluid-q95-050.png` 직접 열람. 기존 표정·선과 보존된 경계 흔적 확인; 독립 미술 승인/새 연속모션 PASS가 아니다. |
| production fixture 브라우저 | 고유23항목 PASS: 신규 polish6 + contact6 + food-direct9 + overlays2. 동일 최종 상품 build에서23항목 실행21PASS, 하네스 교정 뒤 food9실행8PASS, 남은 PC 준비만 교정해 해당1PASS를 합산한 범위다. 한 번의23전체 실행이 모두 통과했다는 뜻은 아니다. 실제 낙하·공중 재집기·스크롤 attachment·중단·쓰레기통·첫 pass/보상·master OFF·감소동작·패널 이동/reload/prepaint·큰 decode/fallback·일반 창 표시 유지 확인. POST attempt0/forward0, 실제 DB 시험 쓰기0. |
| 실제 익명 `/` 로컬 | 1920 PC/390 native touch 두 화면 PASS. 기본 OFF에서 기존/신규 atlas 요청0, 설정 ON·크게·sharp, 동일 DOM으로 설정/검색/기록 창에서 표시·inert·입력 통과, 접기 reload·다크·export 내 pet0·pageerror0. 각 화면 bootstrap POST2를 전부 차단, 전달0. 과거2025-09 cookie 사용. |
| 배포·운영 | `23fe0259` main push, GitHub/Vercel success 및 운영 `/api/soop-live` build SHA 일치. [운영 사이트](https://vic-schedule-studio.vercel.app)의 실제 익명 `/`에서1920 PC/390 touch 두 화면 PASS: 기본OFF 모든 atlas 요청0, 설정ON·크게·sharp, 일반 창3종 동일 DOM·inert·입력 통과, 접힘 reload·다크·export내 pet0·pageerror0. 각 bootstrap POST2 전부 차단·전달0. 두 신규 WebP의 운영 bytes/전체 SHA가 커밋과 일치했다. |

낙하 중간60프레임에서 초기 기울기0.498→후기1.383px/ms로 가속했고 실제 발판y1030에 착지했다. PC/390의 스크롤50프레임 p95 오차0/max3px, quiet Range/rect/style write0, 큰 그림 decode 뒤 정지 write0을 확인했다. 실제390×844/900×600 coarse에서 제목 대비11.90:1, 집/기록 공통 높이44px·라운드12px였다. fixture export 폭1840을 유지했다. 직접 열람한 PNG는 큰 contact·다크390/900·착지·prepaint 접힘과 익명 설정/기록 화면이며, prepaint PNG는 JS 보류 시 접힘 근거로만 쓴다.

재현 범위: `npm run test -- viewer-companion ambient-pause panel-section-preferences agent-memory rule-migration`, `npm run typecheck`, `npm run lint`, `VISUAL_TEST_FIXTURE=1 npm run build`, visual config의 위4spec. 하네스/메모리43단위 포함, `npm run harness:verify`는 기존 inventory2개 오류만 남았다. 세부 회차 로그·원본 이벤트 trace·PNG·실제 익명 smoke JSON은 ignored `.scratch-pw`의 `companion-050-qa-summary.json`, `companion-trash-trace.json`, `companion-polish-public-local.json` 등에 보관하며 커밋하지 않는다.

공용 viewer/anonymous/미리보기 한 구현, default OFF·로컬 전용을 유지한다. 서버 DTO·권한/unlock·KST·실제 달력 데이터·1840 export 기하·원화 생성 변경0. 기존 harness 2개 오류(UI-38~44 rule inventory SHA/table 누락)는 이번 기능 PASS로 상쇄하지 않는다. touch는 Chromium의 실제 터치 입력 경로/에뮬레이션 검증이며 물리 휴대폰 검증은 아니다. 실제 OBS 장비·물리 햅틱·주관적 교감 만족도는 미검증이다. 운영 증거도 ignored `companion-polish-production-deploy.json`, `companion-polish-public-production.json`, `companion-polish-production-assets.json`에 남겼다. 독립 리뷰에서 연구·자산·QA 합산 범위의 추가 차단은 없었다.
