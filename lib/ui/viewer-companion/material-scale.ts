/** Decorative pompom deformation in the sprite plane. Preserve its apparent
 * area while retaining the requested vertical extension/compression. Uniform
 * world zoom, hiding and user-selected character sizes are separate. */
export function companionMaterialScale(vertical: number): { scaleX: number; scaleY: number } {
  const scaleY = Number.isFinite(vertical) && vertical > 0 ? vertical : 1;
  return { scaleX: 1 / scaleY, scaleY };
}

/** One strain budget for the complete decorative chain, including opposing
 * loads around different pivots/rotations. Bounding each layer alone still
 * compounds into a different silhouette. Uniform world zoom is separate.
 * Sum of absolute log scales bounds the singular values even after rotation. */
export const COMPANION_MAX_MATERIAL_STRETCH = 1.08;
export function companionMaterialStack(verticals: readonly number[]) {
  const logs = verticals.map(value => Math.log(companionMaterialScale(value).scaleY));
  const strain = logs.reduce((sum, value) => sum + Math.abs(value), 0);
  const gain = strain > 0 ? Math.min(1, Math.log(COMPANION_MAX_MATERIAL_STRETCH) / strain) : 1;
  return logs.map(value => companionMaterialScale(Math.exp(value * gain)));
}
