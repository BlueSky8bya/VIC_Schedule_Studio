# 편집 태그 순서 배지 다크 대비 — 2026-10-16

Status: Implemented / local verification complete

`.tp-order`의 배경은 `--ink`인데 글자와 테두리는 흰색 리터럴이었다. 다크모드에서 배경이 밝은 `#ece9e2`로 바뀌어 대비가1.21:1로 떨어졌다. 공유 다크 보정 파일 `app/dark.css`에서 글자·테두리를 기존 `--surface`(`#26241f`)로 맞춘다. 계산 대비12.79:1. 순서/태그 색·18px 배지 기하·라이트 팔레트는 변경하지 않는다.

같은 TagPicker를 쓰는 편집실 PC 팝오버·모바일 편집 시트에 적용한다. 주제만의 작은 표시 수정이므로 CURRENT_STATE/ACTIVE_PLAN은 바꾸지 않고 이 기록으로 추적한다. 라우트·공개 DTO·서버 권한/언락·KST·저장 경로 변경 없음. 운영 DB 쓰기나 새 아트/의존성/동작은 없다. 사용자 미커밋 제작기록/이미지는 보존한다.

## 검증

- 독립 원인/수정안 검토 완료. `npm run build`, `npm run lint`, 빌드 뒤 `npm run typecheck` 모두 exit0. 빌드 `y20_Evo2j5tK-tIvBGCeW`.
- editor-model/태그 표시·다크 팔레트·재정렬 단위4파일47개 PASS. 문서·세션18개 PASS. harness는 기존 RULE_MIGRATION inventory 불일치2건 유지(PASS 아님).
- 생산 빌드 fixture의 PC1920/모바일390×다크/라이트4개 PASS(7.0초, 재시도/skip0). 실제 편집 창에서3개 선택→중간 해제→재선택 순번을 확인했다. 서버 mutation/브라우저 오류0, 저장 없음.
- 계산된 실제 대비는 다크12.7868:1, 라이트15.7479:1. PC와 모바일 모두 다크/라이트 사이 배지 기하가 같다. 원본18px 크기·top−5px/left−3px 유지. PC의 기존 zoom.9에서는 BCR16.1875px, 모바일은18px다. 태그 영역/페이지 overflow0. PC 편집창 전체의 기존8px scroll extent는 두 테마에서 같으며 이번 대비 수정으로 바뀌지 않았다.
- 초기 검사의 크기/영역 전제는 PC zoom·tp-pop 진행 중 실측·컨테이너 border를 고려하지 않았다. 이를 기존 CSS 크기와 실제 태그 영역 기준으로 바로잡고 최종4개를 다시 실행했다. 대비4.5:1 및 순번 단언은 유지했고 제품 코드는 검사 사이 바꾸지 않았다. 초기 보고서도 보존했다.
- PC/모바일의 다크/라이트 태그 캡처4장을 직접 확인했다. fixture 증거를 실제 운영 로그인 계정·RLS 검증으로 확대하지 않는다.

증거는 ignored `.scratch-pw/companion-073-tag-order-report.json`, 화면별 JSON/`*-group.png`. 검사 빌드/커밋 소스 일치는 `companion-073-tag-order-{source-proof,committed-source-proof}.json`, 승인된 main push의 운영 SHA/Vercel success와 HTTP200/정적 CSS는 `companion-073-tag-order-{production-deploy,deployed-resources}.json`에 별도 남긴다.
