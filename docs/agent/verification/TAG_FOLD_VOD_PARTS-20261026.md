# 상세 태그·다시보기 부 선택 검증

상태: 구현·로컬 검증 완료. 독립 검수 및 실제 배포의 최종 증명은 local pipeline run `C:/Users/im917/.codex/vic-pipeline/runs/20261026-tag-fold-vod-parts`의 `independent-review.json`·`release-confirmation.json`과 primary daily state에서 대조한다. 문서만으로 미실행 단계의 PASS/배포를 주장하지 않는다.

사용자가 채택한 두 범위만 수행한다. 원 metadata-balance 완료는 별도 보존. synthetic 긴 태그13개/긴 이름과 최대12영상은 레이아웃 스트레스 자료이며 실제 사용자 통계가 아니다.

실행: type/lint/unit98/build/harness 통과. 선택 고유30건 유효: 마지막 실행12 fresh+같은 불변 빌드18검증 재사용, 실패/미실행0. BUILD_ID `9l_AljcchLacRziH40Z7_`. 원영수증 `.scratch-pw/site-daily/native/2026-10-26-1793016925531-f67a595f/result.json`, SHA256 `ba953e6af57277dc163967baf71203b83b5de1a6227239a4595d4bdb9c1bd163`.

한 줄 접기와 pointer/Enter/Space 펼침, 인기도 분리, viewer/preview·320/390/1440/1920·밝음/어두움, Google·닫기·경계 회귀를 실제 실행했다. 같은 상세 DOM의390→320→390 resize에서 넘침 제어 생성/제거와 전체 원문을 확인했다. 다시보기 현재/전체 수·제목 한 번·native 선택·키보드·구독/업로드·단일/12영상·페이지/모달·합방·native 팝업 Esc 취소, 기존 시각 링크/타임라인/도움말도 확인했다. 원본 영상과53PNG/관측JSON은 QA 및 run/native-verified.json에 연결했다.

원 실패 보존: 첫 높이 완전일치 검사는 spring57.98→58px의 미세 차이를 실패로 셌다.0.5px 허용으로 행 추가를 잡는 기준을 유지했다. 별도 resize fixture의 topology/이름 길이 가정도 실제 조건으로 바로잡았다. 첫 결과의 global maxFailures 오류 때문에 그 PASS는 재사용하지 않았으며 수정 전후 result/trace/영상을 덮지 않았다. 제품 입력이 바뀐 host/access 배치 보강에는 새 빌드를 사용했고 이후 검사만 바꾼 시도는 검증된 그 빌드를 재사용했다. 전체200 재시작은 없었다.

제한: credential-free fixture/Chromium viewport; 실제 Google 계정 저장·SOOP 미디어 재생·RLS·물리 기기 검증이 아니다. 생활AI/normal36/full200 관측으로 세지 않는다.

PC↔아젠다 전환으로 기존 studio preview가 재마운트되어 열린 상세가 닫히는 경로는 이번 같은 DOM resize 증거가 아니다. 범위를 섞거나 별도 수명 동작을 변경하지 않았다. G22는 고정 target의 실제 collector→두 developer 표시와 수동 select 기록 중복 방지로 검증했으며 영상 ID/제목/부 수를 수집하지 않는다.
