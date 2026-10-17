# 실제 로컬 OBS 녹화 검증

Status: Complete — 실제 로컬 녹화30분 완료. 실제 방송 PC/SOOP 송출은 별도 미검증. [PLAN-082](../plans/PLAN-20261017-082-provider-and-lifecycle-validation.md).

기존076/080의 브라우저 검사만으로 OBS 실측을 했다고 말할 수 없다. 이번에는 공식 OBS를 이 PC에서 실행해 실제 GPU 합성·NVENC 인코딩·로컬 MKV 기록을 측정한다. 토리님 방송 PC·SOOP 송출·실제 캡처 장면을 재현한 것은 아니다.

## 실제 환경·범위

- Windows, Ryzen5 7500F/6코어12스레드, RTX4060Ti. 기존 OBS가 없어 공식 [OBS32.2.2 portable](https://github.com/obsproject/obs-studio/releases/tag/32.2.2)을 ignored `.scratch-pw/obs-082/portable`에 풀었다. SHA256 `4d6e40e3ab155f56b30de517380566a206d74b63cdf5ad49aa596924768f97e1`, Authenticode 서명 Valid/OBS Project LLC를 확인했다. 생산 의존성·기존 방송 설정을 변경하지 않았다.
- 격리 profile/scene `VIC082`. 녹화 시작 전 자동으로 만들어진 기본 audio capture를 제거해 입력이 로컬 fixture BrowserSource1개뿐임을 확인했다. 마이크·사용자 desktop/window capture·송출 키·외부 방송을 사용하지 않는다. 초기 audio guard 중단과 재기동의 crash sentinel도 별도 setup 증거로 남겼다.
- 실제 `GetVideoSettings`:1920×1080/60fps. 실제 OBS 로그:NVENC H.264, CBR6000kbps,p5. AAC160kbps 트랙은 무음이며 audio capture는 없다. 단순 CLI 설정만 보고 인코더 사용을 추정하지 않았다.
- [OBS 공식 launch parameters](https://obsproject.com/kb/launch-parameters)로 별도 portable을 숨겨 실행한다. 자체 테스트용 인증 WebSocket과 `obs-websocket5.7.4`의 [GetStats/GetRecordStatus](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md)를 사용했다. 현재 계정의 서비스 자격증명을 OBS에 주지 않는다.
- 로컬3102 proxy는 고정 production fixture/정적 GET만3100에 전달하고, API/활동 요청은 로컬 stub으로 끝낸다. 개인 일정/로그인 session은 없다. 이 proxy의 `requests.external`은 증가 코드가 없는 초기값이므로 **CEF 전체 외부 요청0의 증거로 쓰지 않는다**. 서버 측/직접 외부 GET까지 전부 계측한 검사가 아니다.

## 측정 방법

12:19:43KST 실제 StartRecord→baseline GetStats 이후30초마다 main OBS 메모리/CPU/fps/render·output skipped/total, record active/paused/duration/bytes를 기록한다. fixture에만 추가한10초 probe는 page visibility/focus·rAF 누적·JS heap·DOM 수·빅타민/texture 수·상태/위치를 기록한다. 새 제품 loop가 아니다. 전체 원문/키는 커밋하지 않는다.

첫16분44초는 시청자 화면의 build `Zs5cIlJvmS3fdbVqFDS9u`를 이미 로드한 CEF다. 이후 같은 녹화를 끊지 않고12:36:27KST에 편집실 BrowserSource URL로 바꿨다. 편집실은 새 build `cD7GpusKUktHwYtvsBye4`다. 두 빌드 사이 제품 차이는 활동/로그아웃 경계이며 빅타민 표시 파이프라인은 같다. 각 source의 누적 rAF/heap은 새 문서에서 초기화되므로 두 페이지의 누적값을 직접 빼지 않는다.

동시에 build·lint·unit/PW 검사를 실행한 구간이 포함된다. 따라서 방송만 단독 실행한 일정한 환경이 아니다. GPU 순간 표본은 nvidia-smi에서 encoder 사용37%로 확인했지만 다른 프로세스의 GPU 사용과 분리한 연속 표본은 아니다.

## 결과

12:19:43.473→12:49:44.042KST StartRecord/StopRecord 응답의 wall time1,800.569초. 마지막 active recordStatus는30:00.149였고60개 sample 전부 active/unpaused였다. StopRecord의 파일 경로·실제 muxer 종료 로그와 끝 PNG까지 확인했다. 외부 stream은 시작/종료 모두 inactive였다.

| 지표 | 실제 결과 | 해석 |
|---|---|---|
| OBS 종료 로그 |output108,028frames, render108,046attempted/108,044drawn |StopRecord 전 GetStats와 종료 후 분모가 조금 다름 |
| 렌더/인코더 누락 |render2/108,046, encoding2/108,044, 각각 약0.00185% |두 수치를4개 고유 frame으로 더하지 않음. 네트워크 dropped 아님 |
| 직전 GetStats delta |baseline 이후 render108,034 중2, output108,025 중2 |최종 녹화 로그와 같은 종류의 관측을 서로 다른 시점에 읽음 |
| FPS/평균 render time |sample 전부60.0000024fps, 평균 render0.183–0.548ms |최악 단일 frame 시간이나 항상60fps 보장은 아님 |
| main OBS memoryUsage |baseline236.25,30초 sample309.08–381.57,final309.09 |GetStats 제공값. CEF 자식/GPU 전체 메모리 아님 |
| JS heap |viewer9.73–13.65MiB, studio9.18–10.90MiB |각 페이지 관측 범위.30분 이후 누수 부재 증명 아님 |
| 페이지 probe |viewer101/studio79, 모두 visible/focus true·pet1/texture1 |10초 표본이므로 모든 frame의 무깜빡임을 뜻하지 않음 |
| rAF50ms 초과 |viewer 첫8→끝8,studio 첫4→끝4 |각 첫 probe 뒤 추가0. 초기/전환 warm-up까지 전체0이라고 쓰지 않음 |

최초 viewer probe의 worst400ms/long8은 녹화 시작4.886초 전의 누적이고, studio의 worst199.9ms/long4는 새 source 첫10초 안에 이미 관측됐다. source별 누적값을 합산하거나 서로 빼지 않는다. 상태·위치가 바뀌며 걷기/점프/수면/숨기/등장 등을 실제 관측했다. DOM 수는 viewer650/studio709로 각 관측에서 일정했다.

누락이 처음 증가한 sample은 약7분/14분으로 둘 다 source 전환 전이다. 동시 build/검사나 특정 companion 행동이 단독 원인이라는 증거는 없다. 최종 후보 `RG5zhm6oK09zKo0-1ZaCq`는 활동 전송/로그아웃만 더 바뀌었고 companion renderer는 같지만, 이 녹화를 RG5 자체의 OBS 실측으로 부르지 않는다. 독립 검토도 위 분모·source/warm-up·계측 범위 구분을 확인했다.

## 보존·재현·한계

로컬 `obs-082/run.mjs`, `control.mjs`, `setup.mjs`, `measurements.json`, `control-studio.json`, 시작/편집실/끝 PNG와 recordings MKV에 실행 근거를 보관한다. 다운로드한 OBS·자체 설정/영상·원본 probe는 Git에서 제외한다. 기존 프로젝트의 Git/계정/로그와 섞지 않는다. 종료 로그 확인 후 실행 파일 경로를 대조해 이 격리 OBS만 종료했고, 자체 WebSocket을 비활성화하고 임시 암호도 제거했다. proxy와 fixture 서버도 종료했다. 사용자 기존 방송 설정은 건드리지 않았다.

30분 지속과 단일 source 자체의 메모리/캐릭터 동작 관측은 실제 broadcast 장비의60분·SOOP network/장면 합성·게임/VTuber/카메라 입력·Window/Display Capture·모든 focus 수면 복귀를 증명하지 않는다. 창 수면/복귀는 기존076·현재 복합 입력 증거와 구분한다. [OBS의 GPU/encoding 설명](https://obsproject.com/kb/encoding-performance-troubleshooting)에 따라 앱 rAF·OBS render·encoder·송출 network를 별도 원인으로 남긴다.
