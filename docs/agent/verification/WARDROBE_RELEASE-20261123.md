# 옷장 마감·울음 교정 PC/OBS 검증

2026-11-23 사용자 “최소한의 PC/OBS 환경에서 확인하고 배포해보자”에 따른 최소검증. 승인된19종마감/8종유지와bonk-tears표정우선권만출시한다. 원본227파일·왕관·토리인쇄·몸/귀/표정자산은그대로다.

## Windows PC

Windows11의설치된Chrome(headful)에서production fixture의실제포인터입력5회귀를최종단독실행하여5passed(1.1분). viewer/studio가벼운접촉중울음유지·의도적왕복위로·짧은클릭/회복·드래그중단·낙하중클릭을확인했다. 최초병렬부하중2건의장면정착/짧은checking박자시간초과는보존했고제품코드/테스트를완화하지않았다. 단독재현2건, 마지막전체5건통과를구분한다.

최신상류d7aa262e통합후typecheck/lint/486files·7451unit/build각exit0. 실제옷장viewer/studio/preview·감소동작·soft/off6조건×27=162의선택/장착/해제/재열기최종검사도모두통과했다. 원래의준비LRU15·전체포즈28080·귀레이어/화풍독립검수는현재동일companion SHA에연결된근거다. 전체포즈숫자는canvas경계검사이며모든귀가림시각인증이아니다.

## 실제 OBS

공식OBS33.0.3 Windows x64 portable을격리폴더에서준비했다. 공식release asset의SHA256 `18a68c325adbda6f6082d5281021a8d1e35a6432842800618e8690b71925c107`과OBS Project서명Valid확인. 사용자기존OBS설정·방송키·마이크·화면/창캡처를사용하지않았다. 입력은로컬합성fixture BrowserSource1개, 실제NVENC H.264녹화이며송출은시작/끝모두inactive다.

1920×1080/60fps, 녹화파일100.885초·H.264·60/1. viewer6/studio6/preview2=14장면에서왕관/프로펠러/안경/토리안대/주머니/신사모자를실제CEF로표시하고GPU합성PNG14장을저장했다. API측정baseline→끝5999render/output frames에각skipped0. 종료로그는별도분모output6054/drawn6071이며두표본을같은분모처럼합치지않는다.

초기OBS33 독립프로필준비중녹화가시작되지않았던실패와user.ini/녹화설정수정·재시작기록을보존했다. 실제완성영상의존재/ffprobe와OBS종료로그확인뒤에만녹화통과로판정했다. OBS측정build는5d2170ab이며마지막상류통합은달력/안내변경이고companion관련소스/승인asset SHA는동일하다. 이PC최소검증은실제방송인PC/SOOP송출·게임/VTuber/카메라복합부하·장시간안정성을인증하지않는다.

## 출시·보존

새최신사용자권한이이작업의이전commit/push/deploy미허가조항을대체한다. 주저장소사용자dirty8파일은변경하지않는다. 배포는main push→Cloudflare Workers Builds만사용한다. 로컬cf:deploy는실행하지않는다.

실제운영판은 `https://victory-broadcast.com/api/soop-live`의build와2개finish-v2 SVG응답SHA를확인한다. 배포완료여부·실제익명화면확인은별도production-receipt에남긴다. 기존문서하네스rule inventory불일치2건은여전히FAIL이며제품/OBS검증PASS로덮지않는다. 경계/역할/KST/G22·SVG외부참조의독립통합검토차단결함0.

반려/native/직전판/전후·현재선택과전체검증·실제OBS영상은로컬 `C:/Projects/context-hub/out/vic-wardrobe-20261123/runs/20261123-wardrobe-style/`에보존한다. rawOBS로그/임시제어암호/개인설정은Git에싣지않는다. 공개API/권한/DB/분석수집변경없음.
