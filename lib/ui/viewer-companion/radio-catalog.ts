/** Publisher-licensed recordings, streamed one at a time. Exact source/
 * recording/license/checksums: public/companion/audio/radio/provenance-v111.json.
 * Pacing BPM is a reaction hint, not live audio beat detection. */
export type CompanionRadioMood = "lively" | "graceful" | "calm";
export type CompanionRadioTrack = Readonly<{ id: string; title: string; creator: string; mood: CompanionRadioMood; bpm: number; src: string; sourceUrl: string; license: "CC-BY-4.0"; licenseUrl: string }>;
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
  }
];
