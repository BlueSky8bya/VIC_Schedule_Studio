# PLAN-080 — 클라이언트 요청·팝오버·빅타민 회귀

Date:2026-10-17 KST. Scope:audit08/09/18. 제품 변경·단위·production fixture·후속 client build 팝오버 검증 완료. 전체 최종 검사와 운영 배포 확인은 중앙 작업에서 이어간다.

## 변경

- `lib/ui/foreground-poll.ts:10`: shared visible/online scheduler. 한 요청 체인만 실행, 숨김/오프라인에서 abort·타이머 해제, 빠른 복귀는 이전 체인 종료 후 재개. `components/poster/use-soop-live.ts:20`은 구독·유효60초 응답을 공유하며 마지막 구독 해제 시 중단. 요청 deadline8초, 실패 시 이전 값 보존.
- `lib/ui/synced-clock.ts:72`: 실제 유효 calibration만 로컬60초 monotonic TTL로 재사용. HTTP clock은 계속 `no-store`, credentials omit,3표본 single-flight. 숨김/오프라인 중단·실패5초 retry floor. DB offset·기존 slew·DB 공개 판정 보존.
- `lib/ui/premiere/use-teaser-premiere.ts:176`: discovery→최대32missing-ID 조회까지 같은 foreground signal 적용. 숨김 뒤 응답/후속 조회를 적용하지 않음.15초 discovery/공개5분 이내1초, 무대OFF·다른 달의 시각 변경 발견 유지. 유효 clock의 재보정은 discovery를 기다리게 하지 않는다.
- `public/sw.js:40`, `components/pwa/sw-register.tsx:36`: 공개 snapshot single-flight·visible/online gate·60초 freshness 메타데이터·event waitUntil. worker 재시작·OS 시계 후퇴·빠른 숨김/복귀 대응. 계정 전환은 worker가 old writer 종료→캐시 삭제→요청된 공개 refill을 순서대로 소유. 일반 clear는 빈 캐시 유지. credentials 없이 받은 `/`과 immutable chunks만 저장. HTML 이후 chunk 중단은 저장 HTML에서 재개, asset 동시4개. quota 실패가 정상 live asset 응답을 버리지 않음.
- `lib/ui/popover-layout.ts:11`: 시청자·편집실 공통800ms 유한 위치 추적. 작은 ancestor ResizeObserver·scroll/resize/input·기존 FLIP·card-play 이벤트로 갱신. descendant counter/pet transition은 lease 연장 안 함. `public-poster.tsx:1304`/`studio-shell.tsx:3215`의 상시 RAF 제거. 기존 좌표계·수동 위치·native drag는 유지. 편집실 실제 pill/support도 관측한다.

## 실행한 검사

### Offline unit

Vitest4.1.11, 관련6파일 **24/24 PASS**:

```text
tests/unit/foreground-poll.test.ts
tests/unit/client-poll-lifecycle.test.ts
tests/unit/synced-clock.test.ts
tests/unit/offline-worker.test.ts
tests/unit/popover-layout.test.ts
tests/unit/flip-motion.test.ts
```

- 실제 live hook effect 호출:2구독→요청1, fresh 재마운트→추가0, offline abort 후 late response 무시.
- 실제 premiere network effect: React state/effect 포트만 mock. 무대OFF discovery·missing-ID chain 도중 hide→추가 조회/late apply 없음.
- 실제 `sw.js`를 NodeVM에서 실행: CacheStorage/client/fetch만 mock. 동시 navigation·waitUntil, restart TTL, 실패 재시도, rollback, pause, clear/late writer, rapid resume, identity clear→refill, max4assets·중단 asset 재개.
- 실제 clock 함수: skew/OS jump,3표본 single-flight, calibration TTL, no-store, hide abort, 실패 retry. 공개/비공개 권한을 시계로 대체하지 않음.
- 실제 layout helper: fake RAF/ResizeObserver에서 quiet callback0, scroll/resize/flipSpring 재개·hidden/unmount 해제. 실제 createCompanionCardPlay의 bump·6.5초 후 restore 구간만 추적하고 중간 고정 각도는 유휴.

Scoped ESLint PASS. 이 lane 직접 typecheck는 초기 구현에서 PASS; 이후 전체 typecheck/build는 중앙 실행 결과를 따른다.

### 첫 production fixture

Build_ID:`vhiSnmf5BROp-qUx_H2rZ`. 실제 Next production server3100, Chromium, native 입력·실제 시간. **28/28 PASS**, skipped/flaky/unexpected0,4.0분. `.scratch-pw/platform-080-ui-report.json`.

| 범위 | 검사수 | 관측 |
|---|---:|---|
| 시청자/편집실 팝오버 |2| 실제 selected card/panel BCR 정착 후0, native scroll/resize 때 재개, grip drag 좌표 유지 |
| 모바일 제외·desktop 복귀 |8| public/studio/preview,390/coarse1120, 저장ON 유지·모바일 개체/asset 제외 |
| 편집실 schedule/support/period drag |3| 같은 개체 유지·경쟁 입력 gate |
| 편집실 숨바꼭질 |1| 실제 planner 숨기기→내용칸에서 발견·잠들기→밖으로 native drag, editor 유지 |
| frame pipeline/음식 |4| 양쪽 실제 card scroll support·긴 frame, full/lite 전환, 음식8개 tray/첫 floor |
| moving house/FLIP/modal |6| 양쪽 outside/floor/cushion, lite/reduced parked quiet, FLIP80ms 내 search |
| 일반 overlays |1| detail/search/records/settings에서도 같은 개체·같은 위치, window 뒤 quiet |
| 소파 경계·깊이 |3| native held side/crest, studio exit, floor→cushion recall; grip 오차 최대0.001px 미만 |

기존 spec 본문은 보존한 scratch copy로 실행했다. route.continue만 fallback으로 바꿔 마지막 안전 gate를 거치며 외부 URL·모든 미처리 mutation·미처리 API read 차단. teaser/live GET은 stub, public preview read는 기존 manifest 기반 mock. 실제 운영 DB/외부 API 호출 없음. 실행 config/copier:`.scratch-pw/platform-080-ui.config.ts`, `platform-080-ui-prepare.mjs`.

PNG6개를 직접 열어 두 팝오버·편집 내용칸 guest·소파 cushion/held 경계·390편집실 제외를 확인했다. 주요 원본:

- `.scratch-pw/platform-080-platform-080-popover-viewer.png`
- `.scratch-pw/platform-080-platform-080-popover-studio.png`
- `.scratch-pw/platform-080-companion-063-studio-editor-doze.png`
- `.scratch-pw/platform-080-companion-067-house-flip-studio-cushion.png`
- `.scratch-pw/platform-080-companion-064-sofa-floor-side-held.png`
- `.scratch-pw/platform-080-companion-064-disabled-studio-native390.png`

## 경계·남은 확인

### 후속 client build 팝오버 재확인

Build_ID:`KajseOEke8jVPoFqlncHp`. card-play 이벤트·실제 studio pill 관측·register clear/refill 정렬을 포함한 production client에서 guarded 팝오버 **2/2 PASS**(18.7초). `.scratch-pw/platform-080-popup-final-report.json`. 양쪽 native 열기→정착 BCR0→scroll→재정착0→resize→native grip drag→정착0을 다시 확인했다. PNG2개도 다시 열어 확인. `.scratch-pw/platform-080-final-popover-viewer.png`, `platform-080-final-popover-studio.png`. 이후 서버/DB 경로만 바뀌는 빌드는 중앙 기록을 따른다.

### 실제 Chromium service worker 별도 검사

`tests/visual/offline-worker-browser.spec.ts`, **3/3 PASS**(3.4초), `.scratch-pw/platform-080-sw-browser-report.json`. 랜덤127.0.0.1 포트의 Node 서버가 합성 공개 HTML·정적 JS·현재 `public/sw.js`만 제공한다. Next3100·앱 환경변수·DB와 독립이고 외부 URL은 차단한다.

1. 합성 cookie canary가 일반 navigation에는 전달되는 양성대조를 먼저 확인. 실제 worker의 anonymous snapshot 요청에는 cookie가 없었다. 실제 CacheStorage의 HTML/chunk2개 저장 후 CDP `stopWorker`로 중단하고 native postMessage로 다시 시작.1초 관측 창에 추가 snapshot SSR0, 저장 HTML 유지: worker 메모리와 별개인 freshness 재사용 확인.
2. native 일반 clear 후 빈 CacheStorage 유지. `refresh:true` clear protocol은 삭제 후 새 합성 공개 HTML을 cookie 없이 받아 저장. 실제 React 계정 전환 UI를 실행했다는 뜻은 아니다.
3. 응답을 보류한 실제 HTTP snapshot 중 native clear/refill 요청. 이전 socket abort1회 관측 후 새 공개 HTML 저장. 이전 서버 응답을 늦게 끝내도 새 cache를 덮지 못했다.

request 증거에는 path/navigation/cookie존재 boolean만 저장한다. 실제 cookie 값·사용자 신원은 수집하지 않는다. 이 세 검사는 VM 결과와 별개의 실제 browser lifecycle 근거다. 모든 브라우저·실계정·장시간 offline 사용을 포괄하지 않는다.

- 첫28개는 첫 fixture build 결과, 후속 client 변경은 위 재빌드 팝오버2개와 실제 SW3개·unit24개로 구분한다. 팝오버 자동 card-play 양 구간 자체의 근거는 실제 card-play 함수를 실행한 unit이고, native planner가 열린 팝오버 앞에서 우연히 그 행동을 완료했다는 주장은 하지 않는다.
- 위 Next UI28개는 service worker를 차단했다. 별도 Chromium3개는 실제 worker의 restart/clear/refill/HTTP abort만 검증했다. 실제 계정 전환 UI·인증·RLS·기존 유출 여부를 증명하지 않는다.
- 실제 OBS/SOOP 송출PC·GPU·동시 인코딩에서 무끊김을 보증하지 않는다. 이번 근거는 요청/geometry/asset 파이프라인 회귀와 headless production fixture다. 소유자 방송환경 관측은 별도다.
- 빅타민 공유 엔진/포즈/공개 DTO/실제 하트/92px·모바일 제외 정책은 변경하지 않았다. 이 lane의 운영 요청·DB변경·설치·commit/push는0.
