# 최초공개 응원단 · 2026-10-14

[PLAN-036](../plans/PLAN-20261014-036-premiere-living-audience.md). 사용자 요청 및 기존 커밋/푸시/배포 승인에 따른 구현. 토리님 표정 국소 시안은 로컬 미적용을 유지한다.

## 변경

- 기대 버튼과 캐릭터를 겹치던 절대 배치 대신 스크린 안 관객 전용 행. PC6/agenda3/lite감축, 짧은 가로 화면은 숫자·기대 버튼 좌우와 하단 관객 행. 음악/응원봉 전용 버튼 제거.
- 안정된 native 빅타민 버튼,44px 이상 입력영역·이름·Enter/Space·포커스 유지. 응원은 로컬이며 기대 상태/서버 쓰기를 변경하지 않는다. 공유 clock/입력 시각으로 아틀라스의 실제 여러 그림을 선택한다. 이미지의 transform 이동·셀 clip 사용, 별도 타이머/AudioContext/DB 요청 없음.
- 12.5→10.5초 착석 후 마지막10초 낮은 대비의 정지 관객. 보조 입력 inert/AT숨김, 기존 포커스는 나가기 버튼으로 이동. host/문구 퇴장·무음·단일 숫자 시계 유지.
- 음악 기본 자동 시작, master/category/volume 모두 반영. 차단 시 한 번 시도하고 실제 입력 대기, 반복키/수정키/이탈 입력 제외. 숨김·음소거·종료·재편성에서 이전 세션 정리. visible 복귀/새 대상/마스터 재활성화는 최신 요청대로 기본 시작을 다시 허용한다.
- card→screen 완료 때 morph를 해제하면 기본 fade가 재시작되던 근접 결함 수정. 완료 표시로 이미 펼쳐진 창의 재등장 방지.
- [미술 원본/관찰](../../../art-src/최초공개/응원단/작업회차/20261014-움직이는응원단/시안설명.md):16셀 중 귀 배색이 뒤집힌2셀은 제외. 원본/프롬프트/입력SHA/파생 과정 보존. WebP324,218bytes, 공유 캐시1개, decoded1024². 생성자 관찰과 기능 검사 결과는 미술 승인/독립 미술 PASS가 아니다.

## 검증

- 타입·전체 lint·fixture production build 통과. 관련 단위/공개DTO/clock/FLIP/메모리119개 통과.
- 최종 production build의 Playwright75개 통과(7.5분):company13/entry8/focus8/kairos9/premiere24/reading6/resume7. 기본 음악·마스터25% gain 확인·mute/zero/category·숨김/목표 변경·차단된 autoplay 재시도 한도·키 반복·종료·키보드 포커스·마지막10초 정지/무음·다중/재가림·1840기하·공개지연·삭제/즉시공개·읽기/복귀 검증.
- 앞선 revision의 fluid20개 통과 후 kairos 검사에서 진입 후 fade 재시작을 발견했다. 수정한 최종 revision에서는 위75개(진입8개 포함)를 실행했고, 해당 kairos와4개 시각 기준선도 통과했다. 앞선20개를 최종 revision에서 다시 돌린 것으로 기록하지 않는다.
- 실제 `/` 경로 PC1440/agenda390:공개 전 숨김,기대와 독립된 직접응원,자동음악/숨김복귀,최종 정지/무음,공개 제목/태그/들여쓰기,7.5초 후에도 수동종료 유지·복원 통과. 콘솔 예외0/서버 전송 POST0(각 context에서 가로챈1건), 운영 DB 시험 데이터0.
- 실제 production 렌더:1440×1000/단일(screen774px),390×844/단일(611px),390×1000/동시5개(892px),844×390/동시3개(288px). 각 스크린 내부 추가 scroll0, 가로 넘침0, 콘솔 예외0. 버튼/관객 가림 없음. 짧은 가로의 실제 viewport 포함도 검증. 수정한4개 시각 기준선은 같은 커밋에서 갱신한다.
- G-21 독립 코드 검토: entry 최초 inert/반복키 재시도 지적 수정 후 재검토, 미해결 확정 결함 없음. reviewer는 미술 평가를 하지 않았다.
- 모든 브라우저 POST 차단/합성 과거 달. 실제 로그인·RLS·실기기 Safari/오디오 음질·음량 청감·미술 만족은 이 검사로 인증하지 않는다. DTO·DB·권한·unlock·KST·1840px export 기하 무수정.

## 기존 실패와 한계

전체 단위1091통과/8실패(1099),6파일. 실패는 미변경 경로: ambient-codex2(종/차수),month-picker toast 정렬1,public-cache-revalidate1,scroll-position-wiring1,timeline-route cache1,vod-chat-recovery2. 해당 실패 입력 경로는 HEAD와 diff0을 확인했다. 관련119개 통과를 전체 단위 통과로 바꾸어 보고하지 않는다.

전역 harness 실패2: active rule ID inventory 및 RULE_MIGRATION mapping 불일치. 이번 문서 외 기존 규칙 재고 문제를 임의 수정하지 않았다.

## 배포

최종 회귀 완료. 커밋/푸시/운영 SHA 확인 대기. 실제 결과로 갱신한다.
