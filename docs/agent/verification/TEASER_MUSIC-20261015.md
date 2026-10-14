# 최초공개 음악4곡 · 2026-10-15 KST

[PLAN-040](../plans/PLAN-20261015-040-premiere-music-library.md). 순수 악보/합성/Web Audio 버스 재사용. 참조 음원 다운로드·복사·외부 에셋0, 음악용 DB 요청0.

## 구성

| 곡 | BPM | 성격 |
|---|---|---|
| 반짝이는 출발 | 120 | 4박 킥, 밝은 화음, 짧은 팝 멜로디 |
| 통통 튀는 응원 | 112 | 스윙·싱코페이션 베이스, 비는 박과 응답 |
| 빛을 향한 질주 | 132 | 둥글게 필터한 신스, 촘촘해지는 아르페지오 |
| 막이 오르는 순간 | 104 | 넓은 반박 드럼, 단조에서 쌓이는 화음 |

공통:68→44s 기본 그루브,44→26s 연주 증가,26→14s 필인·고밀도,14→10.5s 페이드. 기본음량 고정, 마스터 설정 반영. 무대 열림/대상 변경마다 직전 제외 랜덤. 숨김/음소거/자동재생 재시도에는 같은 곡 유지. Shared clock100ms→audio-time150ms lookahead, 시계 매핑250ms 초과 불연속이면 이전 예약/잔음 제거. 종료/숨김/quiet에는 모든 노드 종료.

## 검증

- typecheck/full lint 통과. 관련 unit35/35. 처음1실패는 싱코페이션의 쉼표 구간에도 매100ms 음표가 있어야 한다는 테스트 전제였으며300ms 재개 범위로 보완 후 통과.
- 1차 및 시계 매핑 수정 후 최종 fixture production build와 음악 브라우저6/6 통과: 열림 직전곡 제외, 자동시작, 마스터 음량25 반영·mute/zero/category/exit, 최종10초, 숨김복귀/공개시각변경, autoplay 재시도 제한.
- 최종 로컬 실제 `/` PC1100/모바일390: 직전과 다른 곡 재선택·마지막10초 정적 확인, pageerror0. 각 context POST1차단/실제쓰기0. `.scratch-pw/music-live-local.json`. 시험 일정은 과거 달 합성 응답에만 존재.
- G21 독립 리뷰 P2(시간보정 후 이전 예약음 겹침) 수정. 실제 Chromium AudioContext 검사:20→40초 보정 때 이전10/10소스 즉시 종료, 새8개;10.5초에서8/8종료·playing=false. 재리뷰 확정 차단 없음.
- 실제 OfflineAudioContext로 각68초 WAV 생성. runtime와 같은 악보·voice 및 공용 필터/압축기/음량60 계수, audition은 공용 랜덤 룸 리버브 생략. 소스 종료 후 남은 노드0. peak/RMS는 아래. `.scratch-pw/music-audition.json`, 같은 폴더의 각 id.wav. 청음·실기기 평가로 과장하지 않는다.

| id | peak | 초반 RMS | 고조 RMS | 마지막10초 RMS |
|---|---:|---:|---:|---:|
| spark-pop | .344 | .0253 | .0298 | 0 |
| velvet-bounce | .387 | .0214 | .0265 | 0 |
| neon-run | .357 | .0268 | .0307 | 0 |
| curtain-rise | .306 | .0168 | .0223 | 0 |

최대음량100 추가 검사에서 초안 velvet-bounce peak1.010 발견. 음악 버스 계수만 기존.8→.55로 낮춰 여유 확보(마스터 곡선/다른 효과음 무변경). 최종4곡을 기본60/최대100으로 각각 다시 렌더했고, 최대100 peak는 순서대로.730/.799/.752/.667, 마지막10초 RMS0/남은소스0. `.scratch-pw/music-audition-max.json`. 위 표와 기본 미리 듣기 WAV는 최종.55 버전.

최종.55 제품은 typecheck/scoped lint/production build 및 영향 브라우저2/2(마스터·음소거·카테고리·종료/최종10초) 재통과. 스냅샷·화면 레이아웃 변경 없음.

기존 harness2실패(active rule inventory/RULE_MIGRATION mapping) 재현, 이번 범위에서 수정하지 않음. 서버/DTO/권한/unlock/KST/포스터 기하 무변경. 기능 확인과 전문 음악 감상 평가는 구분.
