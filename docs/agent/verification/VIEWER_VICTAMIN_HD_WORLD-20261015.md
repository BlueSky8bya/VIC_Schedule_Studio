# 빅타민 전체 HD·환경 목표·직접 생활 검증

2026-10-15 KST. [PLAN-052](../plans/PLAN-20261015-052-companion-unified-hd-and-living-world.md). 구현과 fixture 검증 완료. 실제 익명 화면·운영 확인은 아래 완료 표에 별도로 기록한다.

## 구현 계약

- 공유 시청자/비로그인/미리보기 한 runtime. 설정의 작게/보통 행을 없애고 이전 저장값도92px로 정규화한다. 기본OFF 유지. 창 여백 부족 때44px까지 표시 배율만 피하는 기존 안전 정책은 별개다.
- 기존 고해상도16키포즈와 새 감정16키포즈의 실제 상세 픽셀로304슬롯/20동작 전체를 오프라인 rig 파생한다. 예전256셀은 동작 폭·귀 위치 등의 기하 측정에만 쓰며 저해상도 RGB를 늘리지 않는다. 새304손그림·가중치 학습·원본256 표정의 정확한 복원으로 주장하지 않는다. 실제 눈·입·볼 영역은 함께 rigid로 보호한다. 원본은 byte 보존하며 새 생성은1회, 사용자 시각 승인은 아직 없다.
-192px 물리 셀,80px 논리 등록,1536×384 packet19개. 완료된 Image 강참조 LRU3/동시 decode2, 같은src 중복 제거·실패 유한 재시도2회. 동작 packet을 준비할 때 마지막HD를 유지하고 저해상도 fallback을 쓰지 않는다. 매 tick React/calendar 재렌더·원격 추론은 없다.
- 단발 utility 위에 환경 affordance→목표 유지→다단계 경로→매 단계 재검증/재계획→관찰/휴식 완료를 둔다. 목표 후보6/경로 검증2/기억12개의 유한 예산. 로컬 욕구·짧은 장소 결과만 읽고 자연어/일정 내용/인격·의식·모델 학습은 없다. [조사와 선택 근거](VIEWER_VICTAMIN_AUTONOMY_RESEARCH-20261015.md).
- 실제 하트에 막힘·목표 음식 소실은 짧은 실망, 반복된 별도 집기는 잠깐 삐짐. 한 번의 드래그는 매 프레임 감정을 쌓지 않는다. 교감/식사는 즉시 행복 우선이며 부재 벌점은 없다. 무드 기억은 세션만, 기존 care4필드 allowlist 저장은 그대로다.
- 일반 창 동안 같은 펫 DOM/세계 발판을 보존한다. 잠든 표시 좌표만 끌거나 두 번 누른 뒤 위치를 누를 수 있다. 모달 초점·조작 버튼은 유지한다. 이미 진행 중 행동만 유한 완료 후 CSS 숨쉬기/zzZ로 쉬며 새 자율 판단은 없다. blur/cancel도 안전 표시 자리를 재검증하고 닫을 때 현재 행렬→wake→FLIP→착지로 잇는다. 사용자가 수직으로 놓은 지원에는 걷기12px inset을 재적용하지 않는다.
- 수동 펫/과일 낙하는 같은x 아래 첫 유효 실제 카드 상단을 쓴다. 글자 위 안전 span은 자율 이동에 유지한다. 실제 버튼·화면 경계·집은 보호한다. 음식32/입력44×38과 펫92의 지지면을 같은 BCR 측정에서 따로 만든다. 음식은 제자리에 두고92가 같은 지지면에 설 수 있을 때만 먹이 접근 경로로 바꾼다. 너무 좁은 곳의 음식은 접근을 기다리며 임의 바닥 이동은 없다.
- 집의 음식은 실제 자판기 출구 상대 위치를 유지한다. 선택/비선택 모두 패널 접기·펼침·좌우·portal 재마운트를 따라가고, 추가 spawn/self-tap/pause만으로 떨어지지 않는다. 실제 드래그/방향키/바깥 배치로 분리된다.
- 쓰다듬기는 머리/귀의 넓은 좌표 영역과 첫 왕복(.10/900ms),4초 보상 예산. 기존 passive 포인터 센서를 재사용해 hitbox 확대에 의한 버튼 가로채기를 피한다. 기쁜HD 포즈/작은 손/분홍 하트는 기존 소리·햅틱 설정을 따른다. 보라색 일정 장난 하트와 실제 투표 수는 그대로 분리한다.
- 집은 정적 SVG의 도톰한 골지 테두리·움푹한 쿠션·접촉 그림자다. 안쪽 실제 접촉면에 펫을 놓고 패널 외곽/1840 포스터 기하는 유지한다. light/dark·PC/390에서 직접 열람한다.

## 비용과 검증 한계

DB/서버 모델 요청/새 생산 의존성0. packet당 RGBA2.25MiB, 완료 강참조3개6.75MiB와 동시 decode2개4.5MiB는 구분한다. CSS 현재/이전 이미지·브라우저 decoded/GPU 캐시·transition 복사 비용은 별도이므로 총 메모리 상한으로 주장하지 않는다. 모든19개를 디코드하면42.75MiB다. 전체 압축 파일19개의 합은3,170,328bytes이며 필요한 동작만 지연 로드한다. OFF 초기 이미지 요청0을 검사한다.

실제 OBS 송출 동시 FPS/물리 모바일·GPU·OS throttle은 미검증이다. 자동 검사는 Chromium의 본인 display cadence·DOM/Range 작업·상호작용 근거이며 모든 장치60fps 보장이 아니다. 사용자의 미술/손맛 선호 승인도 기능 PASS와 별개다.

## 완료 표

| 항목 | 결과 |
|---|---|
| 타입/전체 lint/배포 빌드 | v3 production fixture build·후속 typecheck·전체 lint PASS |
| 단위·원본/전체304 밀도/face 보호/packet 재현 | 관련26파일275/275 PASS. HD 자산8검사와 오프라인 `--check` 재현 PASS. 원본3개 hash 보존, 전체304셀별 RGB hash·alpha 및 얼굴 rigid 보호 검증 |
| production fixture PC·터치·창 복귀·수면 조작·첫 충돌·집 추종 | 최종 제품의 고유47건 PASS: 일반42건+모션4건+수면 두 번 누르기1건으로 나눠 실행 |
| 문서/harness | rule-migration25/25 PASS. harness 본 검사는 기존 rule inventory 불일치2건 FAIL 유지 |
| 익명 실제 `/` 과거2025-09·기본OFF→설정ON·창/접기 | 최종 실행 중 |
| 운영 SHA/PC·터치 확인 | 커밋/배포 후 확인 |

모든 UI 검사는 fixture/합성 응답 또는 과거 달 읽기이며 모든POST를 가로챈다. 실제 DB 시험 쓰기/현재·미래 시험 일정0. public DTO/서버 권한/unlock/KST 경로 변경0. 독립 검토에서 상세창 outside-close, 수동 지원 숨김·inset,32px 입력 경계·먹이 접근 매핑, drag중blur 안전 자리 복구를 확인하고 수정했다. 스크롤 직후 첫 rAF가 누락되던 음식 추종의 시각 기준도 수정했다. full/lite의 fixture 상대 위치 갱신은60/29Hz였고, PC 음식 추종 오차 p95 약0.00081px·최대2px였다. 이는 실제 OBS 성능 보장이 아니다.

일정 클릭 시 브라우저의 기본 초점 스크롤16px는 발판과 펫이 함께 이동하는 정상 동작이었다. 수면 두 번 누르기 검사는 같은 DOM 발판과 문서 좌표로 비교하도록 수정했다. 원래 오차 문턱3px는 유지했고 독립3회 측정의 최대 문서 좌표 오차는0.078px였다. 잠든 상태350ms의 runtime DOM 쓰기0·CSS zzZ 진행, PC/네이티브 CDP 터치 이동, 창 닫기 전후 동일 DOM/행렬, LRU 퇴출 뒤 실제 재디코드도 검사했다.

전체 저장소 단위 검사는157파일1381건 중1372 PASS/9 FAIL이다. 기존 실패는 HEAD36fba2b1을 별도 source archive로 실행해 분리했다. 변경 전7파일9실패가 동일하게 재현됐다: activity-labels(기존 settings-companion-tab), ambient-codex2, centering-vs-animation(month-picker), public-cache-revalidate, scroll-position-wiring, timeline-route, vod-chat-recovery2. 해당7파일의 기준판 재실행은82 PASS/9 FAIL이며 이번 범위 검사를 약화하거나 관련 없는 제품을 수정하지 않았다. 기존 harness inventory2실패도 그대로다. 전체 검사 PASS로 보고하지 않는다.

로컬 재현 로그(ignored): `.scratch-pw/companion-052-scoped-v3.log`, `companion-052-visual-v3.log`, `companion-052-motion-v3.log`, `companion-052-two-tap-final.log`, `companion-052-unit-final.log`, `companion-052-baseline-compare.md`. 최종 metadata SHA256: `a13f6f106cc67e82e8fc1e7f29f5452e4612cd5775fa1b0c921c93fb901259e7`.
