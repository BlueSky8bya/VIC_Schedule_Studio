/** Decorative pompom deformation in the sprite plane. Preserve its apparent
 * area while retaining the requested vertical extension/compression. Uniform
 * world zoom, hiding and user-selected character sizes are separate. */
export function companionMaterialScale(vertical: number): { scaleX: number; scaleY: number } {
  const scaleY = Number.isFinite(vertical) && vertical > 0 ? vertical : 1;
  return { scaleX: 1 / scaleY, scaleY };
}
