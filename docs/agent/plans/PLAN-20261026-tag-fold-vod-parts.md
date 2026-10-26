# 상세 태그 접기·다시보기 부 선택

2026-10-26 사용자 채택. 원 요청과 실행 제어: local pipeline run `20261026-tag-fold-vod-parts`.

- 상세 정보 띠의 태그는 기본 한 줄, 긴 이름은 말줄임. 실제 넘침에만 펼침/접기를 제공하고 펼치면 원문 전체를 보인다. 인기도 오른쪽·본문·Google·공개/최초공개·지원 경계를 유지한다. 원 metadata-balance 완료 기록은 보존한다.
- 날짜 옆 현재 부/전체 부 선택기와 기존 제목 한 번. 많은 부도 별도 탭 줄 없이 같은 상단 높이. 네이티브 선택 목록에는 제목·길이·기존 권한 구분을 제공한다. 업로드는 다시보기 부와 별도 영상 번호를 쓴다.
- 공유 DayVodWindow/public-poster만 변경. 모바일 상단은 폭 구조상 두 줄 grid를 쓰고 PC는 같은 기존 flex 행을 유지한다. 동일 제어/글자 토큰을 쓴다. 재생·이어보기·외부 시각 주소·Shift 이동·닫기를 유지한다.
- G22: detail-tags-toggle 고정 target, 선택 확정에만 vod-part-select 한 번. 제목/부 수/영상 ID를 활동에 넣지 않는다. 과거 vod-tab은 철수 이력으로 보존한다.

구현과 로컬 검증 완료. type/lint/unit98/build/harness, credential-free Chromium 고유30건 유효(마지막 실행12 fresh+같은 빌드18검증 재사용), 실패/미실행0. 외부 미디어 재생·실로그인·물리 기기는 별도 미검증이다. 새 의존성/추적/운영 DB 쓰기/다른 제안 구현은 없다. 독립 검수·정확한 원격CI/provider/public SHA의 최종 상태는 아래 실행 기록으로 구분하며 파일 자체를 배포 완료 증명으로 쓰지 않는다.

기존 subscriber-seek/dark-mode 검사는 없어진 탭 대신 동일 native 선택을 사용하도록 의미를 유지해 조정한다. 새 fixture의 수·권한 혼합은 합성 스트레스이며 실제 이용 통계가 아니다. 원 실패/영상/영수증을 보존한다. fullCertification=false.

검증 결과: [기록](../verification/TAG_FOLD_VOD_PARTS-20261026.md).
