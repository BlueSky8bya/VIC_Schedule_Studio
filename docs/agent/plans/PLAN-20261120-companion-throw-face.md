# 직접 던져진 빅타민의 비행 표정

2026-11-20 사용자 직접 요청: 관성으로 날아갈 때 편안한 얼굴 대신 관련 이모티콘을 참고한 어울리는 표정으로 개선한다. 변경 전 main은9e346ecc이며 앞선 final face admission1a02e77b를 포함한다. 이전 교정의 CI/실배포 확인은 별도 Hub 증거로 끝까지 유지한다.

## 방향과 범위

Unicode의😱 놀람·😬 긴장·😵‍💫 어지러움 의미를 비교했다. 일반 던지기는 기존 `relief`(놀랐다가 안심) 프로필의 놀란 앞부분을 실제 관성 비행 내내 유지하고, 실제 첫 접지 뒤 기존180ms landing 동안만 안심으로 풀어준다. 편안한 쓰담·직전 일반 표정이 비행 얼굴을 덮지 않게 한다. 기존 강한 흔들기의 승인 나선눈과 착지 후 어지러움/회복은 우선한다. 새 원화·그림 패킷·눈 크기 변경 없이 공통 painter와36개 표정 체계를 재사용한다.

같은 `flight`/`travel=-6`의 실제 소유권·진행을 사용한다. 새 상태 타이머/rAF·물리 궤도/속도·잡기/재잡기/취소·권한/서버/DB/KST 변경은 없다. viewer/studio/preview 공통 구현이며 reduced/off/soft·조용한 overlay·최초공개·미해독 source는 기존 규칙을 따른다. 부분 놀람만 보인 것을 완전한 `relief` 수집 완료로 기록하지 않는다. G22의 기존 사람 `companion-throw` target/집계는 그대로, 새 자율 표정 사건이나 상세 속도 metadata는 만들지 않는다.

## 검증과 전달

같은 production-build 고정 fixture·1920×1100·밝은 테마·실제 native pointer의 관성 던지기로 전/후를 남긴다. 변경 전9e346ecc의 비행과 같은 조건으로 viewer/studio/preview의 열린 입·놀란 표정, 실제 비행·접지, 강한 흔들기 나선 우선·감소/OFF·재잡기/취소를 확인한다. 원화 alpha/보호 픽셀의 최종 admission은 유지한다. dummy 환경과 API/쓰기/외부 fetch 차단 fixture만 사용한다.

관련 unit/typecheck/lint/build/harness와 독립 비작성자 검수 뒤 전후 그림·실패·정확한 검증 범위를 Hub에 보존한다. 실제기기/RLS/자연생활36 인증으로 확대하지 않는다. 이전 작업의 실패·미인증 범위도 지우지 않는다.

참고: https://www.unicode.org/emoji/charts/full-emoji-list.html (의미·표정 방향 참고, vendor 그림 복제 없음).

## 현재 교정·검증

최초 후보는 sampler와 공통 controller2파일이었다. 아래 최신 사용자 지적을 받아 painter까지 제품3파일로 교정했다. 실제 `flight` 또는 실제 접지의 `travel=-6`에서 표시 전용 `relief` 앞부분을 사용한다. ambient expression director는 이 소유권 동안 quiet로 두어 가린 표정의 수집 기록을 만들지 않는다. 일반 점프 제외·승인 나선눈 우선·기존 G22 target/metadata 유지. 최초 unit5파일86개와 production build exit0은 그 후보의 역사적 근거이며 최신 결과는 아래에 구분한다.

최초 after는 viewer/preview 통과·studio 실패(2/3)였다. 같은 pose509가 성공·실패를 반복해 고정 mask/alias와 다르고, painter가 기준 눈 Image를 매번 요구하는 동안 낙하06 선읽기와 기준 Image가3-image LRU를 다투는 경로와 일치했다. 정확한 다른 connected owner 점유는 관측하지 못했으므로 추론으로 구분한다. 일반 던지기의 낙하06 선읽기만 실제 접지로 미뤘고, 승인 나선눈과 soft는 기존 선읽기를 유지한다. 이미지3개/동시decode2 한도·물리는 그대로다.

첫 실제 화면은3/3 PASS였다. 공중80ms 이후 놀람 표정 누락0, 실제 contact에서 row6 첫 관측 지연0ms·몸체 가시성 유지다. 창별 표면 분기는 없다. 나선눈·재잡기·감소·OFF는 각1PASS. Escape1건은 FAIL 보존: throw phase는 바로 지워지지만 resetAt뒤1ms/17ms 두 관측에 이전 relief가 남고 다음 paint에서 사라졌다. 원인은 key handler가 lastPaint를 현재시각으로 재설정한 뒤 제한 paint를 기다리는 가시적 취소 공백이었다. 이제 실제 throw/contact의 Escape에서만 기존 수직 복구 paint를 즉시 실행한다. 물리·scheduler·일반 Escape는 바꾸지 않았다. 원실패와 수정 후 실행은 별개 증거다.

QA 입력의 앞선 실패도 보존한다. 40ms 대기+protocol 지연이 기존80ms velocity history를 넘겨 실제 momentum0이 된 입력을, 실제10ms 간격의6개 native 이동으로 고쳤다. 물리/난수/시계/앱 callback은 바꾸지 않았다. 초기 footer RSC/실제 grab 조건도 fail-closed로 보강했다. 착지의 가시성 검사에서 실제 expression-face canvas 평면을 누락했던3실패는 보존하고, 세 실제 평면을 관측한 fresh 실행만3PASS로 기록했다. 동적 CLI output 인자 오류로5개 guard가 아예 실행되지 않은 결과도 NOT RUN으로 남겼으며 올바른 인자의 새 실행과 구분한다. 예전 run-throw guard5FAIL은 구 atlas가 아닌 실제 composite/face 평면과 새 발판을 관측하지 못하는 legacy 증거로 남기고 통과로 승격하지 않았다. 그 파일의 우리 임시 변경은 SHA/HEAD 확인 후 원복했다.

증거는 `.scratch-pw/throw-face-20261120/`, 요약은 `current-results.json`. 전9e346ecc와 후의 실제1920×1100 화면·원본 canvas PNG·모든 실패를 보존했다. 새 표정은 아직 커밋·push·배포하지 않았다.

## 최신 사용자 지적 — 눈 주변 잔상 교정

사용자는 최초 후보 pose500의 눈 주변에 이전 그림이 겹쳐 지저분하다고 지적했다. 최초 시각 무지적 판단은 철회하며, 숫자 PASS를 사용자 시각 승인으로 바꾸지 않는다. `user-eye-residue-20261120.png`는 실제 최초 후보와 동일한384×384 원본이다. 이 후보의 배포는 보류했다.

같은 immutable source를 단계별로 관측한 `eye-before/detail.png`에서 harmonic 배경 복원은 구눈을 지웠지만, 마지막 admission이 pre-bake 좌표의 좁은 fallback 밖 구눈 끝을 다시 복원하고 새 오른눈썹도 잘랐다. 실제 baked squeeze는 reference 폭5를 쓰는데 구 bound 폭은4.1667이었다. 넓은 사각형은 우상단 실제 실루엣의 alpha236–244 때문에 정상 거절됐다. 따라서 alpha 기준을 낮추거나 넓은 사각형 전체를 허용하는 수정은 하지 않았다.

실제 throw 표시 옵션·정확한 source/pose·squeeze 상태에 한해서만 기존 native bake와 공유하는 닫힌 눈 곡선과1 raster-pixel AA guard, 그리고 실제 새 eye/brow ink의 footprint를 같은 유한 eye corridor 안에서 추가 admission 근거로 사용한다. 마지막 admission·source alpha245·볼 보호는 유지한다. 불투명 윤곽과 연결된 실제 source 갈색 성분도 별도로 RGB 동일성을 확인했다. 원화/패킷/좌표/물리/이미지3·동시decode2 한도는 그대로다. 새 이미지·별도 cache·rAF는 없고 기존 source scratch를 재사용한다. 일반 표정과 수면의 기존 admission oracle은 수정하지 않았다.

최신 검증:

- `eye-fix-build.log` production build exit0. `final-typecheck.log` exit0, `final-lint.log` exit0. 첫 typecheck의 Playwright `reducedMotion` 잘못된 위치 오류1건은 별도 보존하고 `contextOptions`로 수정했다.
- `final-unit.log`: 관련10파일149개 PASS. G22는 기존 `companion-throw` 고정 target·사람 직접 조작만 유지하며, 타임라인/적게 쓰인 기능 label·capture·중복 방지 계약 unit을 포함했다. 새 자율 표정 사건·개인 취향/속도 metadata 없음.
- `strict-existing/after-strict.json`: 기존 oracle 그대로986/986, 보호 RGB·범위 밖 RGB·alpha 변화0. `sleep-regression/proof.json`:18수면셀×5단계90건, 눈·mouth 밖·alpha 변화0.
- `eye-all/proof.json`: 비행16·착지16셀의96 유한 단계, weight0 endpoint16건은 의도대로 숨김, 실제 painted80건에서 alpha/독립 geometry 밖 보호 RGB/실제 contour RGB 변화0. 이것은 fixture/canvas 검사 범위이며 사람 시각 승인이나 모든 기기 인증이 아니다.
- 실제 source pose500의 구눈 끝2픽셀과 잘렸던 눈썹1픽셀을 mask와 독립적으로 관측하는 회귀 검사를 추가했다. 이전 후보 G=[113,114,235]는 실패, 교정본 G=[235,227,70]는 통과한다. 검사 기준을 완화하지 않았다.
- `eye-final-runtime.json` viewer/studio/preview3/3 PASS, 실제 비행 내내 놀람·접지에서 복귀·원화 body 가시성 및 pose500 실제 픽셀 확인. `eye-final-{shaken,escape,regrab,reduced,off}-runtime.json` 각1PASS. Escape는 취소 뒤 phase/relief가 모두 없고 가시성이 유지된다.
- 첫 eye-fixed viewer/studio는2PASS지만 preview는 던지기 전에 정상 정지 sniff를 허용하지 않던 setup 조건에서1FAIL이었다. sniff는 같은 정지 지지면 상태로 명시하고 fresh3PASS를 별도로 남겼다. 이 실패는 눈 픽셀 실패와 구분한다.

Hub `C:/Projects/context-hub/out/vic/20261120-contact-sleep-01a1f30e/runs/20261120-throw-face/`에 같은 실제1920×1100 화면 before/after-THROW.png, 같은 source192×192 before/after-EYE-RESIDUE.png, 사용자384×384와 fresh native384×384 before/after-USER.png를 별도 제공한다. 확대 그림은 QA 설명용이며 canonical PNG는 그대로다. G14와 최신 시안 보류를 따라 교정본의 시각·커밋/push/배포 확인을 요청했으며, 답 전 제품을 출시하거나 미커밋 worktree를 지우지 않는다. 실제 기기/RLS/자연생활36 미인증은 유지한다.

## 후속 사용자 지적 — 입 주변 분리된 점

사용자는 위 눈 교정본을 보고 눈은 괜찮지만 입 주변에도 점처럼 지저분한 조각이 있다고 정정했다. **눈 범위의 부분 시각 확인으로만 기록하며, 입이나 출시 승인으로 확대하지 않는다.** 승인된 눈은 그대로 보존한다.

source pose500의 원래 빨간 입에는 가운데17픽셀 core와 각각1픽셀인 두 분리 core가 있었다. mouth landmark가 null인 이 source에서는 새 입이 그려지지 않으므로, 이 점들은 overlay 잔상이 아닌 실제 원본의 분리된 조각이었다. 원본 패킷은 바꾸지 않고 실제 throw500–507에 한해 측정된 입 ROI 안의4-connected 빨간 성분을 분리한다. 가운데 입은 보존하고1–2픽셀 분리 core 및1 raster-pixel AA 중 점에 더 가까운 픽셀만 복원한다. 거리가 같으면 가운데 입을 보존한다. source alpha245·cream corner·main 최소4·작은 성분 최대2·총 성분 최대3으로 fail closed하며 실제 눈 ink 픽셀은 절대 수정하지 않는다. pixel별 mouth admission을 마지막 guard에 전달하므로 사각 영역 전체나 원래 볼을 새로 허용하지 않는다.

전수 비교 중504 source의 오른쪽 corner139,128이 구눈 위에 있어 복원이 거절되는 점을 찾았다. 최초 '8셀 모두10픽셀' 단언의 FAIL은 보존했다. 실제 immutable source는500–503에 두 점,504–507에는 한 점이며, ROI 오른쪽을139→138로 **좁혀** 구눈을 제외했다. alpha/색 기준은 완화하지 않았다. fresh80 PNG를 이전 눈 교정 PNG와 직접 비교한 `mouth-approved-eyes-proof.json`에서500–503은 각9픽셀,504–507은 각5픽셀만 바뀌고 그 밖의 모든 RGBA(승인 눈·가운데 입·몸·귀·볼 포함)가 exact 동일하다. 실제 분리 core도 모두 피부색으로 복원됐다. `mouth-all-v2/proof.json`의96관측/80painted는 alpha·보호 RGB·source contour 변화0이다.

입 core 원좌표2개 및 가운데 입 G83 보존을 실제 native spec에 추가했다. 이전 mouth-final의3+5 PASS는 v1 ROI의 증거이며 v2로 바꾸지 않는다. 입 전후 보고는 Hub `runs/20261120-throw-mouth/`에 분리하고 눈 교정본/실패/이전 보고를 보존한다. 아직 커밋·push·배포 승인 답이 없으며 현재 교정본은 미출시다.

최종 v2는 production build/typecheck exit0, 관련10파일152 unit PASS다. 기존 oracle 수정 없이986/986·보호 RGB/alpha 변화0, 수면90회귀 눈/범위 밖/alpha 변화0이다. `mouth-v2-runtime.json` 세 표면3PASS와 `mouth-v2-{shaken,escape,regrab,reduced,off}-runtime.json` 각1PASS를 새로 확보했다. 실제 pose500 입 G=[236,237,83]은 두 점이 피부로 복원되고 가운데 입이 exact 유지된 근거다. 눈 픽셀 G=[235,227,70]도 승인본 그대로다. 보존된 실패와 상위 v1 결과는 덮어쓰지 않았다.

문서 harness의 첫 brief8308/8192 FAIL도 보존했다. CURRENT_STATE/ACTIVE_PLAN에는 짧은 Review/Visual-release 상태만 남기고 상세 근거는 이 dated plan으로 옮겨457문서/brief8184byte로 통과했다. 실제 화면/원본 캔버스 전후·실제 관측 GIF·검증과 전체 실패 보존본을 Hub 보고 옆에서 연결한다. 커밋·출시 확인까지 기존 worktree의 미커밋을 보존한다.

최종 lint exit0, harness457문서/8184byte exit0. 비작성 독립 검수는 product4파일의 SHA와 build `SIv613N2ZGj7JW4ySuEZx`, 실제 로컬 chunk265개 일치, 세 표면+guards8PASS·오류/거절/실행쓰기0을 확인해 코드 지적0으로 기록했다. 검수 JSON은 `mouth-v2-independent-review.json`이며 사용자 입 시각·출시 승인과 구분한다. 보고 HTML은1440/390에서 이미지7개 모두 로드되고 가로 넘침/오류0을 확인했다. Hub의 `throw-face-candidate.json`과 보고 옆 `verification.json`이 미출시 후보의 정본이며, 앞선 완료 작업의 `release.json`은 변경하지 않는다.

## 출시 승인

2026-11-20 현재 채팅에서 사용자가 교정 전후를 본 뒤 직접 `배포해`라고 승인했다. 이 던지기·눈 잔상·입 주변 점 교정본의 커밋/push/Cloudflare Workers Builds 출시와 실제 배포 확인을 진행한다. 이전 후보 대기 기록은 당시 상태로 보존하며, 이 승인이 현재 상태를 대체한다. 원프로젝트의 dirty main과 다른 작업은 건드리지 않는다. 최신 원격 main을 정상 통합한 같은 worktree에서 필요한 검사를 마친 뒤 force 없이 push하고 운영 확인 결과는 별도 Hub 출시 기록에 남긴다.

## 운영 첫 로드 후속 교정

교정78ab3505와 원격06b35bc3을 정상 통합한0f3bd5c8은 로컬 build/typecheck/lint·178unit·harness·실제3+5·독립 통합 검수 후 main에 push했다. Workers build327ca22c 성공, Worker7a9664d2 100%를 확인했다. 운영에서도 build0f3bd5c와 승인 눈/입 픽셀 및 공개 패킷3개 SHA가 일치했다. 그러나 첫 운영 probe는 FAIL 보존한다: composite가 얼굴을 포함할 때 숨겨진 expression-face plane 자체의 visibility를 요구한 관측 오류와 별개로, 최초 reference 로딩 동안7개 비행 관측에서 표정이 없었고, 실제180ms 착지 구간 전체에 landing packet이 늦어 이전 몸체가 남았다. 이전 로컬 검사의 위치 선택→정지 대기는 착지 패킷을 이미 데운 상태여서 이 cold 경로를 확인하지 못했다.

이 지연까지 마무리하고 출시한다. painter가 이미 추출한 두 작은 eye glyph canvas와 cell 크기만 자신의 수명 동안 보존하고 원본 reference Image는 붙들지 않는다. 직접 잡고 있는 동안 기존 decoder로 reference를 준비하며, 실제 비행 몸체가 채택된 뒤 기존 세 번째 image 슬롯으로 landing 패킷을 미리 읽는다. 이미지3개/동시decode2, 원화·눈/입/alpha·마스크·물리·별도 루프 없음은 유지한다. 나선/soft는 기존 선읽기 경로다. 실제 cold 입력과 reference Image 제거 후에도 같은 RGBA를 그리는 별도 painter 검증을 추가한다. 최초 FAIL은 `release/production-first-fail-0f3bd5c8/`에 보존하고, 수정한 observer/후속 제품의 실행을 새 결과로 구분한다. 이 설명은0f3 운영 결과를 전부 PASS로 승격하지 않는다.

수정본은 승인80PNG의 RGBA exact 동일, reference 공급 제거 뒤 hide로 강제 새 raster를 그려도 mismatch0/추가 reference read0이다. 기존 strict986/986·수면90 그대로, build/typecheck/lint/harness와15파일195unit PASS. 첫 실행은 warm3+cold3 및 guard 중10PASS/1FAIL이며, 동시 isolated browser rig가 실행되던 재잡기에서 실제 비행0으로 실패했다. 시간·판정을 바꾸지 않은 단독 재실행1PASS를 별도로 보존한다. 동시 입력/창 초점 영향은 추론으로 한정하며 첫 실패는 유지한다. 비작성 독립 검수는 새 코드/메모리·승인 RGBA·399chunk/새11case 근거와 이 구분을 확인해 지적0을 기록했다. 모든 네트워크 속도에서80ms를 보장한다는 뜻은 아니다. 운영 수정본의 새 cold 검증은 출시 후 별도로 확인한다.

## 후속 통합 출시 검증

cold 수정d12ebda5와 원격4cc48e31의 창 뒤 놀기 설정을 정상 통합한1491df28에서 build/typecheck/lint/harness exit0, direct Node Vitest `--maxWorkers 1`로17파일224개 PASS다. 실제 native 입력을 단독·순차 실행한 warm3+cold-first3+guards6은12PASS/0FAIL이며 실제 일정 상세 창을 열어 behind 상태·tabindex/pointer 차단·공중 놀람 지속까지 확인했다. 독립 검수 `release/1491-integration-review.json`은 지적0, 실제399chunk 일치와 소스/QA SHA를 기록한다. 앞선 병렬 unit timeout·native 입력 누락·설정 창 외부 font 거절 실패는 별도 보존하고 이 새 결과로 덮지 않는다. 승인80PNG RGBA exact와 기존3Image/2decode 제한은 유지한다. QA spec의 실제 창 guard와 이 기록만 후속 커밋하며, 운영 cold 확인은 정상 push 후 정확한 출시 SHA로 별도 수행한다.

## 운영 후속 확인 — 완료

GitHub quality44592490519는1129747f의13단계 모두 SUCCESS다. 완료 문서 정리 뒤 harness458문서/brief8093byte exit0도 확인했다. 아래 운영 검증과 동일한 제품 소스이며 후속 문서 커밋은 Markdown만 바꾼다.

2026-11-20 KST, QA 기록1129747f15549d6a3470e12f522b5478eace7608을 main에 정상 push했다. Workers Builds26c1cd70 성공, Worker6ba178fa-d631-45e9-bf58-c3100157b725가 deployment3f59c50a에서100% 적용됐다. 운영 console의 정확한 build1129747을 확인한 새 익명 context에서 실제 pointer로 첫 던지기를 수행했다. 실제 비행 몸체 첫 채택은 release229.6ms 뒤이며, 채택된43개 공중 관측 모두 가시성·놀람이 유지됐다. 실제 landing11관측의 첫 그림 채택 지연0ms, pose500의25관측에서 승인 눈G=[235,227,70]·입G=[236,237,83]이 일치했다. 공개31/06/reference 패킷 모두 HTTP200·로컬SHA exact, page error0이다. 모든 API는 브라우저에서 stub하고 쓰기1시도를 차단해 실제쓰기0이며 운영 soop-live GET은 실행하지 않았다. 관측 기준은 실제 비행 몸체 채택 이후이며 네트워크 지연0을 주장하지 않는다.

정본은 Hub `out/vic/20261120-contact-sleep-01a1f30e/throw-face-release.json`과 `evidence/final-01a1f526/`에 보존한다. 첫0f3bd5c8의 cold 실패와 이전 병렬 timeout·입력 실패는 유지한다. 전후 보고의 승인 그림은 그대로이며 후속 cache 수정80PNG RGBA exact다. 원본 contact-sleep raw3파일은 Hub에 복사하지 않고 사용자 제한 경로에 해시 대조 보존한다. 이 결과는 실제 기기·진짜 로그인/RLS·자연생활36 인증이 아니다. 후속 문서 전용 커밋이 새 Worker를 만들면 같은 제품 소스라는 근거와 그 실제 출시 확인을 Hub에 별도로 기록한다.
