# Calendar instrument score rhythm — 2026-10-18 (112)

## Change and boundary

The old interval-variation/CV test accepted fast, evenly repeated clicks as good playing. Shared viewer/studio instruments now compare actually admitted user onsets with the existing arrangement's notated attack clock: fixed quarter tempo, subdivisions, dotted notes, sustained notes and rests. Existing pitches/chords and verse counts are unchanged. No microphone, network model, new audio asset or frame-loop work was introduced.

The data contains notation timing facts, not recordings/engraving/MIDI assets. `null` explicitly breaks confidence where the existing arrangement cannot be verified against the consulted edition. Automatic fanfares and unknown scores may evoke a mood response but never grade the user's rhythm. The two entirely unverified arrangements are **뻐꾸기** and **윌리엄 텔 서곡**; the latter's consulted flute arrangement did not match the existing pitches. There is no generic equal-gap fallback. This is a coverage limit, not a claim that all34 arrangements are fully verified.

## Source and matching

32 entries comprise30 source-matched arrangements plus authored birthday/scale. The source-matched subset verifies1,675 of1,788 attack-to-next-attack transitions;113 remain unknown. Complete repeated verses share a score clock; partial arrangements start a new finite segment after each unknown transition.

Research parsed PPQ/onset/tempo from publisher MIDI or MusicXML, matching at least4 consecutive existing pitches with a constant transposition. Chop Waltz requires exact simultaneous chord pitches. Equally long matching phrases must agree on timing. Tempo-change excerpts are rejected. Loop bridges require a verified next first pitch within4 quarter notes; a source interlude cannot become an invented bridge. Existing pitches are never replaced to improve coverage.

Hänschen klein and the official Korean anthem were visually transcribed and passed through the same exact-pitch matcher. Their sheets have no numeric metronome mark:112BPM is the project's explicit fixed interpretation. Chop Waltz uses its publisher's explicit editorial160BPM, distinguished from the1877 original's absent numeric mark. Other entries retain source MIDI quarter tempo. Tempo is never fitted to the user's clicks.

The existing compositions are traditional/public-domain repertoire. Publisher engraving, MIDI performances and recordings have separate rights: none of those research assets are shipped or copied into public assets. Only basic notation timing facts matched to the already-present melodies are stored. The Korean official page's restricted KBS recordings were neither downloaded nor used. Liederkiste's sheet remains local research, not a republished edition. Sources: [Flutetunes FAQ](https://www.flutetunes.com/faq.php), [official anthem](https://www.mois.go.kr/frt/sub/a06/b08/nationalIcon_3/screen.do), [Hänschen klein](https://www.liederkiste.com/index.php?e=haenschen-klein&l=de), [Chop Waltz original edition](https://commons.wikimedia.org/wiki/File:The_Celebrated_Chop_Waltz_(Solo),_1877,_p.1.png), [editorial160BPM/MusicXML publisher](https://piano.org/songs/easy/chopsticks/).

Local receipts: `.scratch-pw/companion-112/rhythm/score-matching-receipts.json`. Each records source URL, research-file SHA256, existing pitch-array SHA256, PPQ, source track/tick/target-index matches, explicit gaps and manual-source notes. Parser scripts and source files remain in the ignored research folder. The following hashes identify inputs without redistributing those files.

| Arrangement | Verified / total | Primary source | Input SHA256 |
|---|---:|---|---|
| 어메이징 그레이스 | 35/35 | [score](https://www.flutetunes.com/tunes.php?id=7) | `fcbd5cbfc8010e1942b7ccd1c914ad655e3804b5c1da69ce77faa32e6fdea281` |
| 반짝반짝 작은 별 | 40/42 | [score](https://www.flutetunes.com/tunes.php?id=18) | `993ff407d30c384a0612aa79df83e3264ebf1fc67759a8c1f63b08f871d00f5d` |
| 자크 형제 | 32/32 | [score](https://www.flutetunes.com/tunes.php?id=162) | `7e359de4127b8d8ac3bf39e9737511604fd2ec68276b2cfabf60b11f1257d2db` |
| 런던 다리 | 24/24 | [score](https://www.flutetunes.com/tunes.php?id=126) | `8439eda2e01ca43e0ee51a2fc5e3325a6ff5f6f9dc05209a628b30f124965598` |
| 올드 맥도날드 | 58/59 | [score](https://www.flutetunes.com/tunes.php?id=12) | `8fdbd6e340d942cf257a1dd9d173f983c9d893418ac0e1147d60e01fae903225` |
| 노를 저어라 | 27/27 | [score](https://www.flutetunes.com/tunes.php?id=128) | `45d640a11720c8bdf85c9cea2a5055ec954c913bfafea3604ceee7b8ec69ed36` |
| 징글벨 | 99/100 | [score](https://www.flutetunes.com/tunes.php?id=239) | `ff7710a6481b6f042c0f8f862eea134cfc97a6a66ece8ccddec72a84b4508417` |
| 양키 두들 | 57/57 | [score](https://www.flutetunes.com/tunes.php?id=24) | `b329cb97f411406d7b750bdfad380f01c51fcc1fee780304b3a37629a3910d30` |
| 오! 수재나 | 84/85 | [score](https://www.flutetunes.com/tunes.php?id=177) | `7d2e9e2461cab226d4b498908958f3c68dff338c14840a7500ad620118713619` |
| 미뉴에트 | 59/64 | [score](https://www.flutetunes.com/tunes.php?id=17) | `3c682f688365165e49a8cb01e06a8d638a2a60228e06fcd38f4f462fdb6b0d87` |
| 클레멘타인 | 58/60 | [score](https://www.flutetunes.com/tunes.php?id=27) | `4b2e8d6f19349b85797a8d227a0b04da4991fee206d36713bf30f021bfd5104d` |
| 산왕의 궁전에서 | 71/76 | [score](https://www.flutetunes.com/tunes.php?id=91) | `da522c54e05b0c7325a9897aa910589de5de80a72f75cbb9f1dac65b2a02f29e` |
| 석별의 정 | 54/56 | [score](https://www.flutetunes.com/tunes.php?id=240) | `748ac84419b48f6260b1ed855cdd7bc78b757fff99752ad350f35b3f34170a77` |
| 결혼 행진곡 | 37/38 | [score](https://www.flutetunes.com/tunes.php?id=41) | `9bd7f2b1f8208757002456db9ff4a18c88b2c13234aefc82bc062c1e5079840b` |
| 엔터테이너 | 77/77 | [score](https://www.flutetunes.com/tunes.php?id=181) | `88838449a9de037e078771ae144145c7d9cfc3f4ebb5d3c2eade62b161e28657` |
| 비발디 '봄' | 97/100 | [score](https://www.flutetunes.com/tunes.php?id=250) | `b44efa47ea3ab431ce36f6aafd542680d37127abdf2dd720cf2e60806fd3fbac` |
| 고요한 밤 | 45/46 | [score](https://www.flutetunes.com/tunes.php?id=187) | `639edd344bc020afe21daf928fbbe627a8f26f328198d389054f34b2eba5353a` |
| 그린슬리브스 | 69/70 | [score](https://www.flutetunes.com/tunes.php?id=1) | `49f759f3fb22258cfe63014808b8aa116fea356af9b0d438f6089973ea821184` |
| 캐논 | 45/49 | [score](https://www.flutetunes.com/tunes.php?id=131) | `7225ced65cbebb906913ff5dac5fded27905b253fbef38c92b08ced34ab1b94c` |
| 떴다 떴다 비행기 | 24/25 | [score](https://www.flutetunes.com/tunes.php?id=3) | `dd968a78ec7fc178f14f3d6d5c32cbb368ddaf4e15c616a4d5741cbebf531212` |
| 엘리제를 위하여 | 69/70 | [score](https://www.flutetunes.com/tunes.php?id=156) | `f38a92bcc36cd94e0e2f2373a92c940b396bbe4448f2cb846b721ad7363cd639` |
| 터키 행진곡 | 104/110 | [score](https://www.flutetunes.com/tunes.php?id=112) | `731ec3a698ac32125a0c957f5fc89c9668805f55fd850502be39c3f1949ed685` |
| 브람스 자장가 | 48/52 | [score](https://www.flutetunes.com/tunes.php?id=54) | `c8c3d9292a9a6e7e6bcb42671dd2d22bfdd5a641986a7cdf99ab54514d058d47` |
| 아리랑 | 51/60 | [score](https://www.flutetunes.com/tunes.php?id=305) | `4924cde5c6b492773e7c6892e7c32fb5f42daedcc1618c1713e3294981151a59` |
| 족제비 뿅 | 23/27 | [score](https://www.flutetunes.com/tunes.php?id=477) | `ebf0f687e63de21bdee88a080d4c99100f0d608c2b5b9736fc13c53d03149e4b` |
| 캉캉 | 92/94 | [score](https://www.flutetunes.com/tunes.php?id=69) | `8d9d7ad77ffad1f069540468aada0ddec652685d41312d85aabd60a0b07ee68d` |
| 환희의 송가 | 59/62 | [score](https://www.flutetunes.com/tunes.php?id=74) | `098544a36065076a80fc11290c618538eee65f1797cf60963464e15003edc878` |
| 나비야 | 45/54 | [score](https://www.liederkiste.com/index.php?e=haenschen-klein&l=de) | `051cf0e2f05ef85b10d94a0c0d402fb31196c97aa2974728fa307b8db9ba9287` |
| 애국가 | 42/57 | [score](https://www.mois.go.kr/frt/sub/a06/b08/nationalIcon_3/screen.do) | `e26d0b1aa1dc80816f1ac77973ecb5e7ddb572beaddc4c4a084b78e6f26e2ddc` |
| 젓가락 행진곡 | 50/80 | [score](https://piano.org/songs/easy/chopsticks/) | `594e1b8e35a2336a0533ce8f90f1534ec44970ccd96ff5cc2c00ff32c321944c` |

Authored score: 도레미 계단 uses16 quarter-note attacks at112BPM. 생일 축하합니다 uses the existing270ms quarter and `.75,.25,1…` pickup. No external notation asset is involved.

## Phase, latency and lifetime

- The first actually admitted tap anchors phase. Consecutive index/sequence/segment are required. A new song, missing/blocked note, long pause, blur/owned input or sound gate resets confidence.
- Later input times compare with cumulative score onsets at that fixed tempo. Rapid regular taps cannot select their own tempo. At least3 subsequent intervals are required for a grade.
- Actual rendering runs only after Web Audio is running and the synth onset is admitted. [AudioContext.getOutputTimestamp](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp) maps output to performance time, with [base/output latency](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/outputLatency) fallback. Stable rendering/device delay is compensated. Rendering queues above120ms and output-clock changes above80ms discard confidence rather than penalize the player.
- Phase tolerance is22% of the smaller adjacent notated gap, clamped45–110ms. At most6 errors remain. Latest error above2.5 tolerances or at least50% outside tolerance means uneven; no more than20% outside plus the latest in tolerance means steady. Intermediate cases remain unknown.
- Local ephemeral events carry only numeric sequence/index/segment/onset/gap/input/output timestamps and existing mood/BPM/duration. No date/title/body/song identifier/personality or rhythm history reaches analytics, storage or APIs. Timing feedback mutates no learned trait/stat. Automatic fanfares have no performed index.
- G22: no new human action/control or analytics field. Existing fixed calendar-instrument semantic action remains valid. No additional timeline or least-used key is necessary.

## Verification

Scoped units25/25 PASS20:41:55KST: `companion-instrument-rhythm.test.ts`, `companion-instrument-music.test.ts`, `companion-living-111.test.ts`. Cases include actual dotted pickup, Amazing Grace1/2/.5-note pattern, arbitrary initial phase, regular150/250/1000ms wrong-tempo clicks, long notes, stable/changed output delay, dropped onset/new sequence, verified repeats, partial-edition uncertainty, automatic/no-score unknown, numeric/no-name payload, mute/category/suspended actual synth gates.

Owned ESLint and full TypeScript typecheck exit0 after final source data. Independent source review found no blocker across phase/lifetime/uncertainty/no-name gates; this is not an independent musical audit of every notation input.

Final shared B2 `Ry8cH7jsX3SrOxdQIpy_7`, localhost3117: native1/1 PASS12.9s (runner13.5s). Real elapsed waits and pointer events only; no fake clock/RNG/pose or injected interaction event. Six actual100BPM Amazing Grace attacks have elapsed gaps615.7/1197.4/296.2/295.7/1215.9ms, cumulative phase error0–20.9ms: shared grade steady and actual pet `calm`. After a genuine streak pause, same song's six fast clicks have161.5–207.1ms gaps: grade uneven and actual pet `encourage`. Source index sequence resets to0–5 for the second attempt. Actual render-input delay0.2–1.4ms and estimated output delay44.1–52.4ms were recorded. These are Web Audio admission/timestamp measurements, not a speaker recording or actual OBS listening measurement.

Another real fixture page's volume slider was pressed Home to0. The genuine storage event removed the active response; the next actual calendar tap emitted no additional synth onset. Forbidden writes0; page errors0. Test-owned browser/context closed normally, exit0. Both full-page PNGs were opened and visually inspected; pet/notes stay visible without disturbing the calendar layout.

Evidence: `.scratch-pw/companion-112/rhythm/native-b2-Ry8/{actual-onsets.json,score-onsets-before-assert.json,rapid-onsets-before-assert.json,score-steady.png,rapid-uneven.png}` and `report-b2-Ry8-score-native.json`. An earlier B1 attempt reached only `ERR_CONNECTION_REFUSED` during the root server replacement; its failed report remains intact and establishes no product result. Actual OBS hardware/listening remains outside this fixture proof.
