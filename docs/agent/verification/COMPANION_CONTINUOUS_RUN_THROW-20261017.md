# 빅타민 목표 주행·관성 투척

[PLAN-096](../plans/PLAN-20261017-096-companion-continuous-run-and-throw.md). 구현·배포 범위 검증 완료. 실제 viewer 포커스 회귀1건은 [미검증](OPEN_CHECKS.md#companion-096-focus--실제-viewer-창-전환)으로 남긴다. 이전 실패와 미실행은 PASS로 합산하지 않는다.

## 원인과 변경

- 이전 일반 이동은180px·긴 run은520px 상한으로 구간마다 새 목표를 고르고 정지했다. 식사 접근도180px 상한으로 계속 잘렸다. 선택한 유한 목표/보폭/실제 속도를 intention에 보존하고, 일반 scoot은 최대12초 거리 안에서85% 진행 끝·나머지는 의미 있는45–75% 관찰 지점을 택한다. 일반 탐색 leg의12초 제한과 explore12/급식32 예산은 구분한다. 식사 장면의 보행 시간은 실제 거리/종별 속도로 정하며 기존24단계/32급식 예산을 유지한다. 같은 목표의 다음 구간에는220ms 대기를 넣지 않는다. 원래 음식을 향하는 조심스러운 보행과 실제 근접 사고는 정상 분기로 남긴다.
- 안전 run-up은 이륙점/속도와 실제 비행시간을 먼저 증명하고 최종 목표64px 전에 착지해 역행하지 않는다. 식사 bound는 음식112px 전 착지하며, 조건부 bound-slip 사고가 실제 발생하면 구름56px→남은56px 재접근으로 잇는다. 현재 예산만 다음 반응/도약에 전달하며 입력/창/blur/설정 변경 시 brain과 action의 후속 탐색을 함께 취소한다.
- 기존 놓기는 수평 속도를 버리고 수직 낙하만 했다. 실제 clamp된 몸체 표본의 최근80ms 속도를 한 번 소비한다. 최소24ms/120px/s·stale80ms·표본64·속도 상한과 동일 시각/역행 시각/정지 꼬리 방어가 있다. 중력1100과 기존 tick에서 해석적 첫 하강 교차를 계산해 좁은 실제 발판도 지나치지 않는다. 벽/천장에 닿은 시각과 남은 시간을 처리하며 실제 발판 없는 바닥은 착지로 꾸미지 않는다. 최대3초 뒤 기존 안전 수직 복구로 넘긴다. 새 상시 loop/서버 요청은 없다.
- 실제 착지는 기존180ms row6으로 이어진다. 어지러운 눈은 비행/착지까지 보존하고 기존 회복을 잇는다. 재집기/명시적 배치/Esc는 옛 비행을 폐기한다. 독립 리뷰에서 일반 창 뒤 재집기의 비행 잔존, settle의 옛 sidecar 잔존, 일반 착지 실수의 목표 carrier 누락3건을 발견해 고쳤다. 실제 native 검사에서 첫21ms 잡힌 그림 잔존도 확인해 실제 drag 중 같은 bounded decoder에 다음 비행 packet을 계속 요청한다.

## 새 공중 그림

원본 REF016/017을 실제 열고 VIC 제작 헌법·imagegen 스킬의 builtin 도구를 현재 사용자 회차에서1회 사용했다. 발사/상승/정점/하강4개 원화를16 hold 슬롯으로 패킹했다. 수백 장 생성·사용자 승인·전문 미술 PASS 주장은 없다. native는1288×1221의 비균등2×2여서 실제 투명 가로 여백 y580에서 기계적으로 분리했다. 귀/몸을 다시 그리거나 붙이지 않았고 추가 생성은 하지 않았다. 원본·실제 프롬프트·도구 입력·단일 회차 계약·관찰/등록은 [제작기록](../../../art-src/빅타민/동행/작업회차/20261017-관성비행/제작기록.md)에 보존한다.

새 `/companion/hd/victamin-play-32-throw.webp`144392B는 논리 row32/global496–511에만 추가한다. 이전32논리 행/12놀이 packet·원화·귀 교정/회복 교체 이력을 보존한다. exact decoded Image 채택·동시 decode2/보유3 한도와 JS/그림 지연 로딩은 그대로다. 새 packer `--check`는 source SHA·전체 몸체 crop/등록·alpha 보존·결정적 파생 일치를 검사하고, 단위 검사는 이전 prefix 보존을 별도로 검사한다. WebP는 Q95 RGB/alpha100이며 무손실 RGB 인코딩으로 부르지 않는다.

## 검증 이력

이전095 fixture `D-ZzcCVTFZfLb_aHTwa7y`에서 실제 native fling1건은 놓은 뒤 수평 이동0px로 FAIL했다. 원본5자료를 SHA 봉인했다. 최종 검사는 벽/천장 간섭을 피하도록 유한한20×32px/최소40ms 입력으로 바뀌었으므로 같은 입력의 before/after라고 주장하지 않는다.

초기 전체 unit은2085PASS/1FAIL이었다. 실패는 이전 귀 교정 검사가 그 후의 append까지 금지하던 역사적 rows 전체 동일 단언이다. 원래12행/192프레임/원본 SHA 검사는 유지하고 새 행 하나의 정확한192–207 append를 분리했다. 명시 flight phase의 첫 진입/동일 시각 변경 검사도 추가했다. 초반 scoped 실행1건은0tests/exit1로, 실행된 검사로 세지 않는다.

첫 fixture `j48n2uNzRDKJpWQycGGcz`: native3PASS/7FAIL. 초기 그림 채택 지연3건, 실제 카드 발판을 누락한 검사3건,100.8ms 관측 공백1건이다. 두 번째 `NNvB9gp4V333ija0mzLJp`:5PASS/5FAIL이며 첫 그림 문제는 해결됐다. 남은4건은 카드 발판 검사,1건은129ms 관측 공백이었다. 보고서/모든 raw·PNG/context를 각각28/26자료 SHA 봉인했다.

발판 누락의 근본 원인은 검사 도구가 소수 CSS 좌표의 마지막 안전 span을 flush하지 않은 것이다. 실제 DOM은7개 public card였으며 agenda 추가만으로 해결되지 않았다. 마지막 소수 edge까지 flush하고 실제 조상 clip/visible·quiet/cancel의 수평 불변 검사도 보강했다. 긴 주행 검사는150ms마다 누적 수천 표본을 전체 직렬화하던 관측 부하를 제거하고 같은20초를 한 번 기다린 뒤 읽는다. 실제 전체 목표/100ms 공백/2.5초·300px/목표40px 내 도달 단언은 유지한다. RNG/시계/위치/행동 주입이나 재로드로 좋은 분기를 고르지 않는다.

## 최종 로컬 검사

제품은 fixture `NNvB9gp4V333ija0mzLJp` 이후 변경하지 않았다. 검사 원천만 위 수정과 새 shaken fling/Esc 사례·명시적인 수직 배치의120ms 정지 꼬리를 보강했다. 입력 검사 작성자의 SHA 봉인과 독립 소스/원시 감사는 구분한다.

| 검사 | 실제 결과와 범위 |
|---|---|
| 일반 투척·quiet·취소·재집기·어지럼·Esc | 서로 다른10case의 최신 개별 실행 PASS. 독립 원시 감사273단언·3,469표본·trusted 입력396개. 실제 비행5개의 수평176–547px/상승92–140px, 독립 포물선 잔차 최대0.01823px, 첫 실측 하강 발판 접촉 오차 최대0.341px/17ms. 일반4개는 row32의4원화 전부 실제 채택했다. quiet/cancel/regrab/Esc 뒤 수평 이동0px. 어지러운 경우 실제 pose336/row22 texture가 비행~첫 지상129표본 유지되고 찡그림3키→중립367로 회복했다. 첫 recovery 표본의 시작 차이가 있어 이 probe로 정확560ms를 단정하지 않는다. |
| 목표까지 주행 | 서로 다른2case의 최종 고정20초 관측 PASS. 독립 감사60단언/목표 주행 전체2,909·중간2,146표본, 실제 음식 목표1,730px/13.4017초·예산29, 일반 탐색1,763px/10.95초·예산10. 중간은 전부 실제 decoded walk/row20이며 목표·음식ID·선택 변형·유한 예산을 보존했다. 최대 표본 공백17.7/18.4ms,120ms 전진 최소5.32/6.65px. viewer/full/dog/lively/jumpOFF의 각 첫 목표1개 범위이며 다음 미완료 목표·자율 사고/도약은 완주로 세지 않는다. |
| 기존 동작 회귀 | 흔들기11·식사6·plush2·소파 접촉3=22case 초회21PASS/1FAIL. viewer-refocus 실패는 의도한 창 전환 전에 실제 trusted blur3회가 발생해 approach 준비에 진입하지 못한 건이다. 변경 없는 격리 재검은 음식 drag 중 실제 blur로 준비 실패했고, 다른 명령을 멈춘 단일 실행도 approach 전 반복 blur로 실패했다.3번 모두 의도한 focusTransfer/식사에 도달하지 못해 이1case는 미검증이다. 외부 발생 주체/정확한 OS 원인은 모른다. 오래된 meal PNG는 제외하고 각 raw/final PNG/report/error-context/attachment5자료를 SHA 봉인했다. 같은 공유 구현의 studio-refocus는 PASS했으며 viewer 결과를 대신하지 않는다. |
| main 검증 | 전체 unit2,087/2,087·production build·생성 경로 typecheck·full lint·최종 native spec lint·packer2종 `--check`·harness252 PASS. 미실행 검사나 실패 시도를 이 수치에 합산하지 않는다. |
| 통합·보안 범위 | 정확40개 소유 파일의 main/fixture SHA 불일치0. 별도857개 추적 코드/설정은94개 CRLF/LF 차이 외 내용 불일치0. 독립 text38/binary2/art15 검토에서 비밀·private identity/content 노출과 이미지 text/EXIF/XMP0, 차단0. 전체 저장소/과거 노출을 보증하는 검사가 아니다. |

최신 개별 native 결과는 서로 다른33case PASS/실제 viewer-focus1case 미검증이다. 공개 DTO·역할·언락·KST·DB·의존성·모바일 제외·저장 선택은 변경하지 않는다. 실제 OBS 장비/모든 난수·기기/RLS/과금 절감은 별도다.

## 배포 확인

`e65b7c086dac9752a20de4652fcc33fee6a868a8` main push 완료. [원격 quality39042467183](https://github.com/BlueSky8bya/VIC_Schedule_Studio/actions/runs/39042467183)의13단계 전부와 Vercel success를 확인했다. 운영 `/api/soop-live` 전체 SHA 일치, clock200/no-store·warm204·익명 developer401/error-only/no-store·fixture 비노출(스트리밍404)을 확인했다. 새 throw packet은 HTTP200·144392B·SHA256 `53A28EDDE66F22BF8E18226EDECFDA019A32087088839A1C31125768FB18232E`로 로컬과 바이트 일치한다.

새 agent 전용 Chrome 탭의 실제 개발자 편집실에서 버전 `e65b7c0`, 집1개·visible supported HD/sharp92px 펫1개·완전히 로드된1536×384 texture를 읽기 전용 AX/DOM으로 확인했다. 운영 일정/설정을 수정하거나 실제 운영에서 던지기·난수 분기를 강제로 재현하지 않았다. 해당 입력 증거는 위 production fixture다. 사용자 원래 탭·미관련 아트는 보존했고 자체 loopback 서버는 종료했다. 배포 후 상태 메타데이터는 로컬만 갱신해 문서 전용 재배포를 만들지 않는다.
