# 최초공개 음악 라이브러리

2026-10-15 KST. 소유자: 음악 다양화·랜덤 재생·YouTube 최초공개 참고. 기존 커밋/푸시/배포 승인 적용.

## 설계

- 근거: [YouTube 공식 Countdown Themes](https://blog.youtube/news-and-events/grab-front-row-seat-next-premiere-2/)의 playful/dramatic 등 분위기별 선택과 기대 형성 목적, [Countdowns 아카이브](https://countdowns.youtube/), [공식 설정 안내](https://support.google.com/youtube/answer/10356739). 레퍼런스 음원 청취/음악 분석 완료를 주장하지 않음. 녹음·멜로디·샘플 복사 없이 새 악보/합성 음색 작성.
- 밝은 팝, 싱코페이션 펑크, 신스 질주, 영화적인 긴장 4곡. 각 곡의 조성·화성 진행·BPM·모티프·드럼 패턴을 다르게. 68→44초 기본 그루브, 44→26초 화음/멜로디 추가, 26→14초 촘촘한 리듬/필인, 14→10.5초 마무리 페이드. 마지막10초 완전 정적.
- 기존 AudioContext/master bus·음량·celebrate·autoplay·숨김·종료 정책 유지. 곡 선택은 무대 열림/대상 변경 때 한 번, 동일 세션의 음소거/숨김/gesture 재시도에는 유지. 직전 선택곡 제외 랜덤, DB/네트워크 요청 없음.
- 순수 악보와 Web Audio voice 분리. 공유100ms clock에서150ms 앞 음표를 AudioContext 시각에 예약해 리듬 지터 줄임. 과거 음표 몰아 재생 금지, 종료 시 예약된 소리도 폐기.
- 공개 데이터/권한/unlock/KST/포스터 기하 변경 없음. 공유 훅으로 viewer/preview/anonymous 동일.

## 검증 예정

악보 다양성/랜덤/음량·polyphony·경계 단위 검사, 실제 OfflineAudioContext 렌더의 peak/RMS/마지막 정적, 기존 음악 재생·음소거·숨김·autoplay·마지막10초 브라우저 회귀, type/lint/build, G21 독립 리뷰. 운영 fixture 응답과 POST 차단으로 확인 후 배포 기록. 전문 청음 평가나 실기기 검증으로 과장하지 않는다.

## 상태

구현·로컬 검증 완료, 배포 확인 중. [검증 기록](../verification/TEASER_MUSIC-20261015.md). 최대음량 출력 여유와 시계 점프 예약음 정리 보완 포함.
