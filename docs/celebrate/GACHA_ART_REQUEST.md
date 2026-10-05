# 생일 캡슐 뽑기 기계 — 이미지 부품 생성 요청 (코덱스용)

> 이 문서만 읽고 작업할 수 있게 썼다. 코드는 고치지 않는다 — 이미지 파일만 만들어 정해진 자리에 둔다.
> 연결(코드)은 Claude Code 세션이 한다.

## 1. 상황

- 빅토리(버튜버 스트리머) 방송 일정 사이트에 **2월 19일 '토리님 생일'**을 누르면 뜨는 **캡슐 뽑기 기계(가샤폰)** 창이 있다.
  흐름: 동전 넣기 → 손잡이 한 바퀴 돌리기 → 캡슐이 출구로 굴러 나옴 → 캡슐 열기 → 그림 카드.
- 지금은 기계가 CSS 도형으로 그려져 밋밋하다. **부품별 이미지**로 바꿔, 손잡이 회전·캡슐 굴림/열림 같은 움직임은 코드가 그대로 붙인다.
  그래서 기계를 통짜 한 장이 아니라 **부품마다 따로** 만든다.
- 캡슐에서 나오는 카드 그림이 아래 화풍 참고와 같은 그림이라, 기계도 **같은 화풍**이어야 한다.

## 2. 화풍 기준 (반드시 첨부해서 보고 맞출 것)

- 참고 그림: `public/celebrate/victory-birthday.webp` (생일 파티 장면 — 해바라기, 토끼 마스코트, 노랑·주황 파스텔).
- 귀엽고 말랑한 애니 일러스트, 파스텔 **해바라기 노랑 · 복숭아 주황 · 연분홍**, 반질반질한 장난감 플라스틱 광택, 부드러운 왼쪽 위 조명.
- 토끼 귀(흰색 + 노랑/주황 안쪽) 장식 모티프를 기계에 살짝 쓴다(참고 그림의 토끼 마스코트와 같은 디자인 언어).

## 3. 만들 부품 (파일 이름 정확히)

저장 위치: `art-celebrate/가챠/원본/` (폴더가 없으면 만든다). 모두 **PNG, 투명 배경**(투명이 안 되면 순백 배경 — 배경 따기는 Claude가 한다), **정면 시점**, 가운데 정렬, 바닥 그림자 없음, 글자 없음.

| 파일 | 내용 | 크기(권장) |
|---|---|---|
| `기계-본체.png` | 가샤폰 기계 몸통 전체. **위쪽 둥근 유리 돔(안은 비움)** + 아래 파스텔 몸통(동전 투입구, 작은 출구 구멍) + 받침. **손잡이 자리는 비워 둔다**(동그란 오목한 자리만). 돔 위에 토끼 귀 장식 | 1600×2000 |
| `손잡이.png` | 손잡이만. 동그란 흰 노브 + 가로 손잡이 막대, 정면. 회전축이 정확히 그림 중심 | 800×800 |
| `캡슐-일반.png` | 닫힌 캡슐 하나 — 위 반쪽 반투명 **노랑**, 아래 반쪽 흰색 | 600×600 |
| `캡슐-레어.png` | 같은 모양, 위 반쪽 반투명 **분홍** | 600×600 |
| `캡슐-전설.png` | 같은 모양, 위 반쪽 **무지갯빛 홀로그램** + 은은한 반짝임 | 600×600 |
| `캡슐-뚜껑.png` | 열린 캡슐의 **위 반쪽만**(노랑, 살짝 기울어짐) | 600×600 |
| `캡슐-아래.png` | 열린 캡슐의 **아래 반쪽만**(흰색, 안쪽이 보이게) | 600×600 |
| `돔-캡슐더미.png` | 돔 안에 쌓인 여러 색 작은 캡슐 더미(둥근 언덕 모양, 돔 안쪽에 들어갈 크기) | 1400×1000 |
| `동전.png` | 금빛 동전 하나(토끼 얼굴이나 하트 각인), 살짝 비스듬한 정면 | 500×500 |

## 4. 프롬프트

공통(모든 부품 앞에 붙인다):

```
cute pastel anime illustration style matching the attached reference image,
warm sunflower yellow and peach orange palette with soft pink accents,
glossy toy-like plastic, soft studio lighting from top-left, front view, centered,
isolated on a fully transparent background, no ground shadow, no text, high detail
```

부품별(공통 뒤에):

- 기계-본체: `a capsule toy (gashapon) vending machine body: a round clear glass dome on top that is EMPTY inside, a rounded pastel yellow-and-peach body below with a coin slot and a small exit chute opening, short base, cute white bunny ears with orange inner ears on top of the dome, an empty round recessed socket on the front where a handle would go, NO handle`
- 손잡이: `only the turning handle of a capsule toy machine: a round glossy white knob with a horizontal pastel pink grip bar across its center, perfectly front-facing, rotation center exactly in the middle of the image`
- 캡슐-일반/레어/전설: `a single closed toy capsule ball, top half translucent glossy [sunflower yellow | soft pink | iridescent rainbow holographic with tiny sparkles], bottom half opaque white, seam line in the middle`
- 캡슐-뚜껑: `only the top half of an opened toy capsule (translucent sunflower yellow dome shape), slightly tilted, empty inside`
- 캡슐-아래: `only the bottom half of an opened toy capsule (opaque white bowl shape), seen slightly from above so the inside is visible`
- 돔-캡슐더미: `a rounded heap of many small toy capsules in pastel yellow, pink, mint, sky blue and lilac, piled as if resting inside a glass dome, soft highlights`
- 동전: `a single shiny gold coin with a cute bunny face embossed, slightly angled front view`

## 5. 일관성 규칙

1. **기계-본체를 먼저** 만들고, 나머지 부품은 기계-본체 이미지와 화풍 참고를 **함께 첨부**해서 색·광택·선 굵기를 맞춘다.
2. 캡슐 3종·뚜껑·아래는 **같은 캡슐 모양**이어야 한다(하나 만든 뒤 색만 바꿔 다시 생성).
3. 마음에 안 드는 것은 지우지 말고 `art-celebrate/가챠/반려/`로 옮긴다.

## 6. 끝나면

- `art-celebrate/가챠/원본/`에 위 9개 파일 이름 그대로.
- `art-celebrate/가챠/원본/기록.md`에: 쓴 생성기, 부품별 최종 프롬프트, 첨부한 참고 파일.
- 코드는 건드리지 않는다. 소유자가 Claude Code에 "가챠 부품 넣었어"라고 알리면 Claude가 배경 따기·크기 맞춤·연결을 한다.
