/** QA model, not runtime policy. Native coverage is always reported separately. */
export const BOOLEAN_KEYS = Object.freeze(['enabled', 'activeWhileVisible', 'roam', 'jump', 'sleep', 'heartPrank', 'cardPrank', 'ambientPrank', 'panelPrank', 'rarePrank', 'drag', 'petting', 'feeding', 'learnFromYou', 'sound', 'soundCare', 'soundMotion', 'soundKeepsakes']);
export const PERSONALITIES = Object.freeze(['performer', 'curious', 'affectionate', 'sleepy', 'tidy', 'mischievous', 'gourmet', 'homebody', 'balanced']);
export const ROUTINES = Object.freeze(['meal', 'wash', 'sleep', 'nap', 'outing', 'music']);
export const MODELED_RECIPE_COUNT = 162;
export const DIMENSIONS = Object.freeze({
  personality: PERSONALITIES,
  surface: ['viewer', 'studio-owner', 'studio-developer', 'preview'],
  width: [1100, 1440, 1920, 2400],
  theme: ['light', 'dark'],
  motion: ['full', 'soft', 'off', 'reduced'],
  season: ['spring', 'summer', 'autumn', 'winter'],
  band: ['day', 'night'],
  need: ['content', 'hungry', 'tired'],
});
export const PURE_SUITES = Object.freeze([
  'tests/unit/companion-qa-142.test.ts',
  'tests/unit/companion-activity-criteria-145.test.ts',
  'tests/unit/companion-readonly-font-142.test.ts',
  'tests/unit/companion-native-toy-replay-142.test.ts',
  'tests/unit/companion-ball-use-replay-156.test.ts',
  'tests/unit/companion-play-presentation-156.test.ts',
  'tests/unit/companion-scene-continuity-156.test.ts',
  'tests/unit/companion-owned-rest-preparation-156.test.ts',
  'tests/unit/companion-sofa-world-frame-156.test.ts',
  'tests/unit/companion-home-contact-156.test.ts',
  'tests/unit/companion-rest-intent-157.test.ts',
  'tests/unit/companion-synthetic-reads-157.test.ts',
  'tests/unit/companion-safe-room-floor-157.test.ts',
  'tests/unit/companion-daily-ideas-157.test.ts',
  'tests/unit/companion-daily-witness-157.test.ts',
  'tests/unit/companion-accepted-pet-157.test.ts',
  'tests/unit/companion-before-bed-rest-157.test.ts',
  'tests/unit/companion-curious-admission-diagnostics-157.test.ts',
  'tests/unit/companion-inset-observer-157.test.ts',
  'tests/unit/companion-choice-fairness-157.test.ts',
  'tests/unit/companion-home-contact-anchor-157.test.ts',
  'tests/unit/companion-tidy-primary-157.test.ts',
  'tests/unit/companion-painted-source-157.test.ts',
  'tests/unit/companion-car-use-157.test.ts',
  'tests/unit/companion-post-return-closure-157.test.ts',
  'tests/unit/companion-home-carrier-scroll-157.test.ts',
  'tests/unit/companion-home-contact-presentation-157.test.ts',
  'tests/unit/companion-floor-placement-157.test.ts',
  'tests/unit/companion-house-controls-162.test.ts',
  'tests/unit/activity-home-wash-162.test.ts',
  'tests/unit/companion-expressions-161.test.ts',
  'tests/unit/companion-native-travel-142.test.ts',
  'tests/unit/companion-ordinary-travel-142.test.ts',
  'tests/unit/companion-personality-catalog-137.test.ts',
  'tests/unit/companion-personality-director-137.test.ts',
  'tests/unit/companion-personality-admission-140.test.ts',
  'tests/unit/companion-personality-handoff-140.test.ts',
  'tests/unit/companion-personality-spawn-admission-141.test.ts',
  'tests/unit/companion-routine-arbiter-141.test.ts',
  'tests/unit/companion-routine-director-141.test.ts',
  'tests/unit/companion-routine-music-141.test.ts',
  'tests/unit/companion-household-budget-140.test.ts',
  'tests/unit/companion-toy-round-trip-budget-140.test.ts',
  'tests/unit/companion-home-physical-141.test.ts',
  'tests/unit/companion-discovery-flight-141.test.ts',
  'tests/unit/companion-discovery-flight-lifecycle-141.test.ts',
  'tests/unit/companion-food-reach-131.test.ts',
  'tests/unit/companion-living-policy-143.test.ts',
  'tests/unit/companion-work-expression-143.test.ts',
  'tests/unit/companion-living-criteria-143.test.ts',
  'tests/unit/companion-outside-ownership-143.test.ts',
  'tests/unit/viewer-companion-geometry.test.ts',
  'tests/unit/companion-goal-continuity-142.test.ts',
  'tests/unit/companion-daily-review-143.test.ts',
  'tests/unit/companion-curious-completion-144.test.ts',
  'tests/unit/companion-sofa-flight-depth-143.test.ts',
  'tests/unit/companion-weighted-catalog-143.test.ts',
  'tests/unit/companion-collection-expansion-143.test.ts',
  'tests/unit/companion-taste-capacity-143.test.ts',
  'tests/unit/companion-tv-channels-143.test.ts',
  'tests/unit/companion-collection-art-143.test.ts',
  'tests/unit/companion-eye-scale-143.test.ts',
  'tests/unit/companion-visual-registration-143.test.ts',
  'tests/unit/companion-public-life-146.test.ts',
  'tests/unit/companion-preparation-budget-146.test.ts',
  'tests/unit/companion-cleanup-aftercare-146.test.ts',
  'tests/unit/companion-homage-catalog-146.test.ts',
  'tests/unit/companion-collection-art-146.test.ts',
  'tests/unit/companion-item-anchor-147.test.ts',
  'tests/unit/companion-items-scroll-147.test.ts',
  'tests/unit/companion-cheer-149.test.ts',
  'tests/unit/companion-home-life-policy-149.test.ts',
  'tests/unit/companion-toy-play-149.test.ts',
  'tests/unit/companion-food-aftertaste-149.test.ts',
]);
export const NATIVE_SUITES = Object.freeze([
  'companion-daily-142.spec.ts', 'companion-home-agency-141.spec.ts',
  'companion-collection-settings-141.spec.ts', 'companion-gallery-arrows-134.spec.ts',
  'companion-personality-scenes-137.spec.ts', 'companion-home-window-123.spec.ts',
  'companion-activity.spec.ts',
  'companion-living-143.spec.ts',
  'companion-house-146.spec.ts',
  'companion-living-runtime-146.spec.ts',
  'companion-items-scroll-147.spec.ts',
  'companion-living-149.spec.ts',
  'companion-objects-149.spec.ts',
  'companion-sofa-anchor-release-156.spec.ts',
  'companion-play-presentation-156.spec.ts',
  'companion-rest-continuity-157.spec.ts',
  'companion-daily-ideas-157.spec.ts',
  'companion-house-controls-162.spec.ts',
]);
export const NATIVE_ENTRY_TITLES = Object.freeze(['viewer', 'studio', 'preview'].flatMap(surface => PERSONALITIES.map(personality => `137 ${surface} native ${personality} selection expresses immediately and remains purposeful`)));
export const NATIVE_FLOATING_TIDY_TITLES = Object.freeze([
  '142 floating home tidy preserves all four returns with learned care on',
  '142 floating home tidy returns from a real calendar perch to all four toys',
]);
export const NATIVE_NARROW_WASH_TITLES = Object.freeze(['162 narrow default panel keeps a real mat stance and accepts a sofa wash request']);
export const NATIVE_CAR_USE_TITLES = Object.freeze(['200 viewer real car completes typed wheel push before mischief and collection']);
export const PLANNED_NATIVE_CASE_COUNT = 200;
export const NATIVE_ENTRY_GREP = `(?:^|\\s)137 (?:viewer|studio|preview) native (?:${PERSONALITIES.join('|')}) selection expresses immediately and remains purposeful$`;
export const NATIVE_GREP = '157 |156 |149 |147 |146 |143 |142 |141 |134 .*arrows activate|140 .*primary and secondary|140 outside-home|123 actual solar|123 six shared|123 static|autonomous companion movement never|110 developer views' + '|' + NATIVE_ENTRY_GREP + '|162 (?:viewer|studio|preview) (?:pointer|keyboard) direct pad approach wash and exit$' + '|(?:^|\\s)162 narrow default panel keeps a real mat stance and accepts a sofa wash request$' + '|(?:^|\\s)200 viewer real car completes typed wheel push before mischief and collection$';
const key = (a, av, b, bv) => JSON.stringify([a, av, b, bv]);
export function pairKeys(row, dimensions = DIMENSIONS) {
  const names = Object.keys(dimensions), result = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    if (dimensions[names[i]].includes(row[names[i]]) && dimensions[names[j]].includes(row[names[j]])) result.push(key(names[i], row[names[i]], names[j], row[names[j]]));
  }
  return result;
}
/** Deterministic covering array. It proves pair coverage, not all cross-products. */
export function pairwiseRows(dimensions = DIMENSIONS) {
  const names = Object.keys(dimensions), uncovered = new Set();
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) for (const a of dimensions[names[i]]) for (const b of dimensions[names[j]]) uncovered.add(key(names[i], a, names[j], b));
  const rows = [];
  while (uncovered.size) {
    const [a, av, b, bv] = JSON.parse(uncovered.values().next().value), row = { [a]: av, [b]: bv };
    for (const name of names.filter(name => !(name in row))) {
      let best = dimensions[name][0], score = -1;
      for (const value of dimensions[name]) {
        const trial = { ...row, [name]: value }, count = pairKeys(trial, dimensions).filter(pair => uncovered.has(pair)).length;
        if (count > score) { score = count; best = value; }
      }
      row[name] = best;
    }
    rows.push(row); for (const pair of pairKeys(row, dimensions)) uncovered.delete(pair);
  }
  return rows;
}
export function dailyCases(dayOrdinal) {
  if (!Number.isSafeInteger(dayOrdinal) || dayOrdinal < 0) throw Error('Invalid KST day ordinal');
  const matrix = pairwiseRows();
  return PERSONALITIES.map(personality => {
    const candidates = matrix.filter(row => row.personality === personality), selected = candidates[dayOrdinal % candidates.length];
    return { ...selected, plannedMotion: selected.motion, motion: "full", id: `daily-${personality}`, seconds: 90 };
  });
}
export function coverageFor(rows, dimensions = DIMENSIONS) {
  const required = new Set(pairwiseRows(dimensions).flatMap(row => pairKeys(row, dimensions)));
  const covered = new Set(rows.flatMap(row => pairKeys(row, dimensions)).filter(pair => required.has(pair)));
  return { method: 'pairwise', requiredPairs: required.size, coveredPairs: covered.size, complete: required.size === covered.size, missingPairs: [...required].filter(pair => !covered.has(pair)) };
}
export function universe() {
  return { schemaVersion: 1, normalizedPreferenceCrossProduct: 2 ** BOOLEAN_KEYS.length * PERSONALITIES.length * 3 * 3 * 101,
    preferenceEnums: { personality: PERSONALITIES.length, animalMode: 3, speed: 3, soundVolume: 101 }, fixedNormalizedSize: 'large',
    booleanPatternCount: 2 ** BOOLEAN_KEYS.length, booleanKeys: BOOLEAN_KEYS, dimensions: DIMENSIONS,
    modeledRoutineTemplates: ROUTINES.length * PERSONALITIES.length, modeledEntries: PERSONALITIES.length, plannedNativeEntryCases: PERSONALITIES.length * 3, plannedNativeFloatingTidyCases: NATIVE_FLOATING_TIDY_TITLES.length, plannedNativeNarrowWashCases: NATIVE_NARROW_WASH_TITLES.length, plannedNativeCarUseCases: NATIVE_CAR_USE_TITLES.length, plannedNativeCaseCount: PLANNED_NATIVE_CASE_COUNT,
    pairwiseRows: pairwiseRows(), claims: { nativeExhaustive: false, continuousWorldExhaustive: false, arbitraryFramePairsAreLegal: false },
    limitations: ['Coordinates, time and human input sequences are continuous/unbounded.', 'Pairwise rows do not cover all setting cross-products.', 'Only passing, observed native cases count toward native coverage.', 'Pure host ACKs are not rendered effect or artwork evidence.'] };
}
