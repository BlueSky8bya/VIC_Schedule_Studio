/** Publisher-licensed recordings, streamed one at a time. Exact source/
 * recording/license/checksums: public/companion/audio/radio/provenance-v155.json.
 * Pacing BPM is a reaction hint, not live audio beat detection. */
export type CompanionRadioMood = "lively" | "graceful" | "calm";
export type CompanionRadioTrack = Readonly<{ id: string; title: string; creator: string; credit?: string; mood: CompanionRadioMood; bpm: number; src: string; sourceUrl: string; license: "CC-BY-4.0"; licenseUrl: string }>;
export const COMPANION_RADIO_MOOD_NAMES = { lively: "신나게", graceful: "우아하게", calm: "잔잔하게" } as const;
export const COMPANION_RADIO_TRACKS: readonly CompanionRadioTrack[] = [
  {
    "id": "km-usuan1400011",
    "title": "Monkeys Spinning Monkeys",
    "mood": "lively",
    "bpm": 144,
    "src": "/companion/audio/radio/km-usuan1400011.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400011",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "creator": "Kevin MacLeod"
  },
  {
    "id": "km-usuan1100772",
    "title": "Sneaky Snitch",
    "mood": "lively",
    "bpm": 87,
    "src": "/companion/audio/radio/km-usuan1100772.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100772",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "creator": "Kevin MacLeod"
  },
  {
    "id": "km-usuan1100833",
    "title": "Pixel Peeker Polka - faster",
    "mood": "lively",
    "bpm": 144,
    "src": "/companion/audio/radio/km-usuan1100833.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100833",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "creator": "Kevin MacLeod"
  },
  {
    "id": "km-usuan1300012",
    "title": "Local Forecast - Elevator",
    "mood": "lively",
    "bpm": 82,
    "src": "/companion/audio/radio/km-usuan1300012.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300012",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "creator": "Kevin MacLeod"
  },
  {
    "id": "km-usuan1400024",
    "title": "Run Amok",
    "mood": "lively",
    "bpm": 148,
    "src": "/companion/audio/radio/km-usuan1400024.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400024",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "creator": "Kevin MacLeod"
  },
  {
    "id": "km-usuan1100326",
    "title": "Arcadia",
    "mood": "calm",
    "bpm": 80,
    "src": "/companion/audio/radio/km-usuan1100326.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100326",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "creator": "Kevin MacLeod"
  },
  {
    "id": "km-usuan1600065",
    "title": "River of Io",
    "mood": "lively",
    "bpm": 104,
    "src": "/companion/audio/radio/km-usuan1600065.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1600065",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "creator": "Kevin MacLeod"
  },
  {
    "id": "km-usuan1900059",
    "title": "The Entertainer",
    "mood": "graceful",
    "bpm": 184,
    "src": "/companion/audio/radio/km-usuan1900059.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1900059",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "creator": "Kevin MacLeod"
  },
  {
    "id": "km-usuan1900058",
    "title": "Maple Leaf Rag",
    "mood": "lively",
    "bpm": 200,
    "src": "/companion/audio/radio/km-usuan1900058.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1900058",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "creator": "Kevin MacLeod"
  },
  {
    "id": "km-usuan1100701",
    "title": "Fig Leaf Rag",
    "mood": "graceful",
    "bpm": 85,
    "src": "/companion/audio/radio/km-usuan1100701.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100701",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "creator": "Kevin MacLeod"
  },
  {
    "id": "km-usuan1100787",
    "title": "Gymnopedie No. 1",
    "mood": "calm",
    "bpm": 77,
    "src": "/companion/audio/radio/km-usuan1100787.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100787",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "creator": "Kevin MacLeod"
  },
  {
    "id": "km-usuan1100786",
    "title": "Gymnopedie No. 2",
    "mood": "calm",
    "bpm": 77,
    "src": "/companion/audio/radio/km-usuan1100786.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100786",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "creator": "Kevin MacLeod"
  },
  {
    "id": "km-usuan1100301",
    "title": "Canon in D Major",
    "mood": "graceful",
    "bpm": 80,
    "src": "/companion/audio/radio/km-usuan1100301.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100301",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "creator": "Kevin MacLeod"
  },
  {
    "id": "km-usuan1200072",
    "title": "그리그 · 산왕의 궁전에서",
    "creator": "Kevin MacLeod",
    "mood": "lively",
    "bpm": 160,
    "src": "/companion/audio/radio/km-usuan1200072.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1200072",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1200069",
    "title": "베토벤 · 에그몬트 서곡",
    "creator": "Kevin MacLeod",
    "mood": "lively",
    "bpm": 150,
    "src": "/companion/audio/radio/km-usuan1200069.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1200069",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1100785",
    "title": "사티 · 짐노페디 3번",
    "creator": "Kevin MacLeod",
    "mood": "calm",
    "bpm": 77,
    "src": "/companion/audio/radio/km-usuan1100785.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100785",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1100689",
    "title": "바흐 · 평균율 전주곡 1번",
    "creator": "Kevin MacLeod",
    "mood": "calm",
    "bpm": 49,
    "src": "/companion/audio/radio/km-usuan1100689.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100689",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1100676",
    "title": "로시니 · 윌리엄 텔 목동의 노래",
    "creator": "Kevin MacLeod",
    "mood": "calm",
    "bpm": 56,
    "src": "/companion/audio/radio/km-usuan1100676.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100676",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1100673",
    "title": "바흐 · 신포니아 5번",
    "creator": "Kevin MacLeod",
    "mood": "graceful",
    "bpm": 71,
    "src": "/companion/audio/radio/km-usuan1100673.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100673",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1100656",
    "title": "비제 · 카르멘 하바네라",
    "creator": "Kevin MacLeod · Jenny Lee Mitchell",
    "credit": "Kevin MacLeod (incompetech.com) · 보컬 Jenny Lee Mitchell",
    "mood": "graceful",
    "bpm": 110,
    "src": "/companion/audio/radio/km-usuan1100656.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100656",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1100546",
    "title": "생상스 · 죽음의 무도",
    "creator": "Kevin MacLeod",
    "mood": "lively",
    "bpm": 67,
    "src": "/companion/audio/radio/km-usuan1100546.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100546",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1100533",
    "title": "모차르트 · 디베르티멘토 K.131",
    "creator": "Kevin MacLeod",
    "mood": "lively",
    "bpm": 138,
    "src": "/companion/audio/radio/km-usuan1100533.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100533",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1100350",
    "title": "바흐 · 토카타와 푸가",
    "creator": "Kevin MacLeod",
    "mood": "graceful",
    "bpm": 80,
    "src": "/companion/audio/radio/km-usuan1100350.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100350",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1100303",
    "title": "바흐 · 브란덴부르크 협주곡 4번 1악장",
    "creator": "Kevin MacLeod",
    "mood": "lively",
    "bpm": 177,
    "src": "/companion/audio/radio/km-usuan1100303.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100303",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1100298",
    "title": "바흐 · 첼로 모음곡 1번 전주곡",
    "creator": "Kevin MacLeod",
    "mood": "calm",
    "bpm": 88,
    "src": "/companion/audio/radio/km-usuan1100298.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100298",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1100294",
    "title": "바흐 · 반음계적 푸가",
    "creator": "Kevin MacLeod",
    "mood": "graceful",
    "bpm": 87,
    "src": "/companion/audio/radio/km-usuan1100294.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100294",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1100293",
    "title": "바흐 · 반음계적 환상곡",
    "creator": "Kevin MacLeod",
    "mood": "graceful",
    "bpm": 88,
    "src": "/companion/audio/radio/km-usuan1100293.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100293",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1100270",
    "title": "차이콥스키 · 사탕 요정의 춤",
    "creator": "Kevin MacLeod",
    "mood": "graceful",
    "bpm": 120,
    "src": "/companion/audio/radio/km-usuan1100270.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100270",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1100256",
    "title": "들리브 · 실비아 피치카토",
    "creator": "Kevin MacLeod",
    "mood": "lively",
    "bpm": 140,
    "src": "/companion/audio/radio/km-usuan1100256.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100256",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1100189",
    "title": "바흐 · 예수 인간 소망의 기쁨",
    "creator": "Kevin MacLeod",
    "mood": "calm",
    "bpm": 75,
    "src": "/companion/audio/radio/km-usuan1100189.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100189",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1100079",
    "title": "바흐 · 양들은 한가로이 풀을 뜯고",
    "creator": "Kevin MacLeod",
    "mood": "graceful",
    "bpm": 116,
    "src": "/companion/audio/radio/km-usuan1100079.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100079",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1100051",
    "title": "홀스트 · 목성의 선율",
    "creator": "Kevin MacLeod",
    "mood": "calm",
    "bpm": 57,
    "src": "/companion/audio/radio/km-usuan1100051.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100051",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1100021",
    "title": "바그너 · 혼례의 합창",
    "creator": "Kevin MacLeod",
    "mood": "graceful",
    "bpm": 60,
    "src": "/companion/audio/radio/km-usuan1100021.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100021",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  },
  {
    "id": "km-usuan1100019",
    "title": "차이콥스키 · 왈츠 Op.40",
    "creator": "Kevin MacLeod",
    "mood": "graceful",
    "bpm": 151,
    "src": "/companion/audio/radio/km-usuan1100019.ogg",
    "sourceUrl": "https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100019",
    "license": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"
  }
];
