const SEASONS = ["spring", "summer", "autumn", "winter"];
const SEASON_KO = { spring: "봄", summer: "여름", autumn: "가을", winter: "겨울" };

/** Directory layout only. A grouped entity does not acquire paired-image checks. */
export function buildEntities({ ART_SLOTS, ART_FAMILIES = {}, slotFiles }) {
  const slotsById = new Map(ART_SLOTS.map((slot) => [slot.id, slot]));
  if (slotsById.size !== ART_SLOTS.length) throw new Error("Duplicate art slot id");
  const owner = new Map(), groups = new Map();
  function group(id, ids, category = null) {
    const slots = ids.map((slotId) => slotsById.get(slotId));
    if (!ids.length || slots.some((slot) => !slot)) throw new Error(`Unknown entity member: ${id}`);
    if (!category && new Set(slots.map((slot) => slot.category)).size !== 1) throw new Error(`Mixed entity categories: ${id}`);
    if (groups.has(id) || ids.some((slotId) => owner.has(slotId))) throw new Error(`Overlapping art entity: ${id}`);
    groups.set(id, { ids, category: category ?? slots[0].category });
    for (const slotId of ids) owner.set(slotId, id);
  }
  // Beach decoration and codex creature share one animal workspace. Runtime slot/file IDs stay distinct.
  if (["starfish", "animal-starfish"].every((id) => slotsById.has(id))) {
    group("animal-starfish", ["starfish", "animal-starfish"], "animal");
  }
  for (const [id, family] of Object.entries(ART_FAMILIES)) group(id, [...family.slotIds]);
  for (const slot of ART_SLOTS) {
    const match = slot.id.match(/^(.+)-(spring|summer|autumn|winter)$/);
    if (!match || owner.has(slot.id)) continue;
    const ids = SEASONS.map((season) => `${match[1]}-${season}`);
    if (ids.every((id) => slotsById.has(id) && !owner.has(id))) group(match[1], ids);
  }
  const saplings = ["sapling-green", "sapling-autumn", "sapling-bare"];
  if (saplings.every((id) => slotsById.has(id) && !owner.has(id))) group("sapling", saplings);
  for (const slot of ART_SLOTS) if (!owner.has(slot.id)) group(slot.id, [slot.id]);

  const emitted = new Set(), filenames = new Set();
  return ART_SLOTS.flatMap((slot) => {
    const id = owner.get(slot.id);
    if (emitted.has(id)) return [];
    emitted.add(id);
    const grouped = groups.get(id), slotIds = grouped.ids;
    const files = slotIds.flatMap((slotId) => {
      const member = slotsById.get(slotId);
      const season = member.seasons.length === 1 ? member.seasons[0] : null;
      const seasonKo = season === null ? "공통" : SEASON_KO[season];
      if (!seasonKo) throw new Error(`Unknown art season: ${slotId}`);
      return slotFiles(member).map((filename, index) => {
        if (!/^[a-z0-9][a-z0-9-]*\.png$/.test(filename) || filenames.has(filename)) throw new Error(`Invalid or duplicate canonical filename: ${filename}`);
        filenames.add(filename);
        const variant = index + 1;
        return { filename, slotId, variant, season, seasonKo, relativePath: `생성본/${variant}/${seasonKo}/${filename}` };
      });
    });
    return [{ id, category: grouped.category, slotIds, files }];
  });
}
