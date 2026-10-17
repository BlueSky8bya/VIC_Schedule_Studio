# 원형 흔들기·회복 표정·식사 재개·소파 피드백

[PLAN-095](../plans/PLAN-20261017-095-companion-shake-recovery-and-sofa.md). 배포 검증 완료. 미실행/이전 실패는 PASS로 합산하지 않는다.

## 원인과 변경

- `held-shake.ts`는 횡방향에서 축이 바뀌면 반전 기록을 지워 원형을 놓쳤다. 기존 자유 축에 유한 X/Y 투영 채널을 더하고, 실제16ms 표본·30px/300px/s·반전2회/세 번째 stroke·최소280ms·1200ms 창·1초 latch·consume/reset을 유지했다. 멈춰 시간을 채우는 짧은 burst도 실제 마지막 이동 시각으로 배제한다. 새 입력 소유권/타이머/loop/서버 요청은 없다.
- 이전094 production fixture `XmSLc3XjlOzkGSpiqElOx`에서 실제 마우스3회 원운동을 수행했다. native1건은 예상한 `data-held-dizzy` 부재에서 FAIL했고 raw458표본의 dizzy는0이었다. 원본/report/build ID는 격리 `.scratch-pw/095-held-shake-before/`에 보존한다. 수정본 PASS로 합산하지 않는다.
- 기존 row23 그림 자체에 웃는 입이 있었다. 원본 REF016/017을 실제 열고 VIC 제작 헌법과 imagegen 스킬의 단일 회차로4키를 생성했다. 처음3키는 찡그린 눈·물결 입, 마지막은 차분한 눈·일자 입이다. 생성 도구에서 전체 결과를 표시했으며 자동 전문 미술검수·추가 생성·사용자 승인 주장은 없다. 새147436B packet은 row23만 대체하고 이전 파일/회차는 보존한다.4키를16 hold 슬롯으로 패킹했으며16개 새 원화로 부르지 않는다. 전체 atlas/행/decoder2 in-flight·3 retained 개수는 같다.
- `play.ts`가 회복 중심/좌/우 키를 기존520ms·3왕복 고개 털기에 맞추고560ms 뒤 중립으로 연결한다. 다른 outro는 중립으로 곧장 간다. 독립 리뷰에서 첫 행 진입이 무조건 col0이어서 찡그림 한 프레임이 끼는 P2를 발견했고 `motion.ts`의 row23/play 명시 phase 선택과 quiet의 끝 중립 키로 보완했다. 실제 등록/선택기 단위 검사가 첫 진입·zero-delta·curated 슬롯·reduced/facing/mixer를 확인한다.
- 정상 mishap은 원래도 음식ID를 보존했다. 실제 맥락 단절은 음식이 있어도 경로/먹기 cooldown이 일시 불가하면 episode 없는 look으로 바꾸던 fallback이다. 현재 유효 meal ID만 재계산하고300ms 유한 대기에 같은 ID/phase/intention을 실어 기존24/32 예산을 정상 차감한다. 더 가까운 다른 음식/배회로 바꾸지 않으며 실제 제거·사용자 입력 취소·설정/포만·예산 소진과 실제 소비 후 마무리는 유지한다. 독립 리뷰에서 발견한 잘못된 목표 발판의0/음수/NaN 폭에 대한 offset NaN도 유한 가드로 보완했다.
- 소파의094 사각 배경/집 배지를 제거했다. root SVG/버튼/2px 좌석은 고정하고 같은 내부 paint group을 로컬/portal에 두어 CSS 상태만으로1→1.03 hover→공유 press `.95`→spring 복귀를 맞춘다. reduced/off/soft는 정지+정적 봉제선 명암, 키보드 포커스는 유지한다. 새 hover listener/geometry scan/tick은 없다. 새 resident 테스트의 sleep:false seed와 sleep 기대가 충돌하던 P2는 실행 전에 발견해 해당1case만 sleep:true로 정합화했다.

## 검증 상태

독립 기술 source 리뷰에서 위 P2들을 수정하고 차단0을 확인했다. 그림 제작자의 관찰과 기술 리뷰는 사용자 시각 승인/전문 미술 PASS와 다르다. packet 재생성 `--check`·관련 scoped unit/lint PASS. 최종 production build exit0, 생성 경로 typecheck exit0.

첫 전체 unit은2038PASS/2FAIL이었다. 실패는 이전 귀 두 개 교정 검사가 그 후의 row23 교체까지 금지하던 두 역사적 범위 단언이었다. 과거 receipt/12개 원본 파일/기존 귀 교정4packet은 그대로 검사하고, 후속095 recipe의 원본 SHA·4키/16슬롯·row23 atlas/등록만 별도로 정확히 연결했다. 해당5검사와 최종 전체2,040검사 PASS. 실패 report도 별도로 보존한다.

| 검사 | 실제 결과와 범위 |
|---|---|
| 원형/다방향 입력·낙하·회복 | fixture `iRfmfFFo_meL71ko7ICvK`, native11/11 PASS. 양성6(횡방향 full/lite·양쪽 화면·CW/CCW3회전·180×110 타원)과 음성5(단일 fling·reduced·OFF·capture loss·touch cancel). 독립 raw 감사2,613프레임, grip 최대0.00054px, 첫 지지면 착지/회복 위치오차0px, 낙하 나선 row22 유지. 새 recovery texture의352/357/362→367과564.5–581.2ms 중립 전환·6교대 극값·최종 tilt0/scale1을 확인했다. 원시 자료에 없는 isTrusted/buildId는 원시 측정으로 부르지 않으며 설정/fixture 식별은 실행·assert 기록과 구분한다. |
| 실제 음식 사고·소비·중단 | 같은 fixture에서 초회5PASS/1FAIL 뒤 변경 없는 studio-refocus 개별1PASS: 최종 서로 다른6case 전부 확인. 첫 실패는 의도한 창 전환 전에 실제 trusted blur가 발생해 식사 접근을 못 시작한 준비 단계였다. 원인 입력 주체는 모른다. 실패 원본18개와 보고서를 봉인하고 합산 PASS로 바꾸지 않았다. |
| 음식 raw 독립 감사 | 6case 총5,029표본, 실제 eat/remove 각6·case별 보상1·종료·설정 불변·captured writes/pageerror0. viewer/studio 각각 실제 bound-slip138표본·단조 roll56px·food jostle26표본 뒤 같은 음식ID로 소비했다. 회복 끝에 이미 식사 거리 안이어서 별도 walk/jump 재보행은 관측되지 않았다. 경로/쿨다운 소실 뒤 같은 ID를 재접근하는 경우는 단위 검사로 따로 증명한다. 실제 hold/refocus 중단2종씩은 기존 문맥 취소와 같은 음식의 일반 식사를 검증했다. |
| 소파 첫 표시·피드백 | 최종 CSS fixture `D-ZzcCVTFZfLb_aHTwa7y`, production build/typecheck PASS. native6/6 PASS: 양쪽 화면 light/dark, reduced/OFF, 각 entry/reload CSS1초 지연, 실제 pointer/Space/Tab·고정 기하. 독립 감사2,209가시 CSS표본/경고0·12gate(1003–1015ms)·trusted 입력66/cue click12·설정 보존·captured writes/errors0. 거주 cue9상태의 배율 차이0, 고정 기하0px·가시 portal 경계 최대0.000252px. 첫 unhide부터26표본 모두1.03으로 순간1배율은 관측되지 않았다. 이 최초 노출은 viewer/light/normal1case로, 미관측 프레임·soft·전 장치까지 보증하지 않는다. |
| 소파·정상 식사 회귀 | 같은 최종 fixture에서 plush2·접촉2 초회 PASS, 준비 단계 수정 뒤 studio 접촉1 개별 PASS(231표본·seat/front/clear·rim67·grip 최대0.00055px·실제 첫 카드 착지). 최종 서로 다른5case를 확인했다. 별도 일반 식사 native1 PASS: 실제 집바닥으로 낙하한 음식을 접근해 소비했고 식사 보상을 확인했다. |

소파 검사에서는 숨긴 SVG의 `transform-origin` 백분율/픽셀 표기와 display:none 하위의 미계산 matrix를 실제 표시 기하와 같다고 가정한 검사를 바로잡았다. 실패 시도1(1PASS/5FAIL)·2(2PASS/4FAIL)·3(3PASS/3FAIL)의 원시 자료/보고서·해시를 각각 보존한다. 보이는 거주 전경의 모든 관측 표본은 계속 실제 matrix·고정 SVG 경계·pivot을 비교한다. 숨김은 target/pivot/구조를 검사하고, 실제 native 귀가로 최초 노출되는 순간부터 별도로 기록한다. studio 키보드 윤곽선도 공통 CSS zoom의 실제 화면 폭/색·focus-visible을 기록하며 임의2px 환산 가정만 제거한다.

추가 소파 접촉 회귀는 초회4PASS/1FAIL이었다. 실패1은 임의 date-42 시작점에서 소파 도착을 기다리던 준비 단계로, 접촉 probe 시작 전이었다. 정확한 해당 경로 원인은 미관측이며 CSS 회귀로 단정하지 않는다. 다른 두 접촉 사례와 같은 실제 집바닥 배치→귀가 준비로 정합화하고 기존5초·몸체/경계/첫 착지 단언은 유지한다. 보고서/현존15자료는 해시 보존했지만 원래 error-context는 후속 runner가 출력 디렉터리를 재사용하면서 남지 않아 full report의 오류/call log와 구분한다. 임의 date-42 전체 귀가 경로가 이 검사로 검증됐다고 주장하지 않는다. 기존 plush 검사의 focus 고정 helper와 이번 실제 focus/입력 검사는 범위를 구분한다.

최종 통합은 main/격리 fixture의 관련64파일 SHA256 불일치0이다. 별도893개 추적 코드/설정 비교에서95개의 CRLF/LF 차이를 제외하면 내용 불일치0이며, 추가34개 통합 파일은 위 정확 해시에 포함한다. native 흔들기/음식의 `iRfm…` 뒤 제품 변경은 소파 CSS의 숨긴 전경 transition 정지뿐이며, 그 이후 CSS는 `D-Zzc…`에서 별도로 검증했다. 식사 추가 단언/소파 준비·표시 검사는 테스트 변경이다. 최종 main 전체 unit2,040·typecheck/lint·packet `--check`·harness250 PASS. native는 재검증을 포함해 서로 다른29종을 확인했고 실패 이력과 준비 단계 한계는 위에 남긴다. 독립 보안/범위 검토는41개 소유 파일(text39·아트15)에서 차단0, PNG/WebP EXIF/XMP/text metadata0이며 과거 노출/전체 저장소 무결성을 보증하지 않는다.

## 배포 확인

`dbf153bba949569518f55ca595f8febb18c20eab` main push 완료. [원격 quality39038690988](https://github.com/BlueSky8bya/VIC_Schedule_Studio/actions/runs/39038690988)의 전체13단계(단위·격리 SQL·harness·production build·생성 경로 typecheck·lint 포함)와 Vercel success를 확인했다. 운영 `/api/soop-live`의 전체 SHA 일치, clock200/no-store·warm204·익명 developer401/error-only/no-store·fixture 비노출(스트리밍404)을 확인했다. 새 recovery packet은 운영 HTTP200·147436B·SHA256 `C1E9C5F2FF08389777A86FF3FC798E807EDEC56A45B747554A78DA23BCC73B46`로 로컬과 바이트 일치한다.

새 agent 전용 Chrome 탭의 실제 개발자 편집실에서 배포 버전 `dbf153b`, 채색된 집·소파 paint group2/옛 cue0·투명 버튼 배경·한 visible HD/sharp pet·완전히 로드된1536×384 texture를 읽기 전용 AX/DOM와 집 화면으로 확인했다. 운영 설정/일정 조작은 하지 않았다. 실제 운영에서 원형/사고를 강제로 재현한 것은 아니며 해당 입력 검증은 위 production fixture다. 사용자 원래 탭·미관련 아트는 보존했고 자체 loopback server만 종료했다. 배포 후 상태 메타데이터는 로컬만 갱신하여 문서 전용 재배포를 만들지 않는다.

공개 DTO/권한/언락/KST/1840 기하·모바일 제외·저장 선택·운영 DB/의존성은 변경하지 않는다. 실제 OBS 장비/모든 난수/모든 장치/RLS/쿼터 개선을 이 검사로 보증하지 않는다.
