import type {DepthTier} from './depth';

/** Screen pixels per detail sample, driven by the same ground distance field.
 * Near objects retain native detail; distant objects merge tiny leaf noise. */
export function forestDetailPitch(distance:number,tier:DepthTier='full'){
  const u=Math.max(0,Math.min(1,(distance-.08)/.82));
  const near=u*u*(3-2*u);
  return (3.2-2.25*near)*(tier==='lite'?1.3:tier==='still'?1.45:1);
}
export const forestDetailBudget=(tier:DepthTier)=> (tier==='full'?8:tier==='lite'?3:1.5)*1024*1024;

/** Root distance, not the crown's screen height, owns atmospheric thickness. */
export function forestFogStrength(distance:number,weatherFog:number){
  const far=1-Math.max(0,Math.min(1,distance));
  return Math.min(.78,.13*far*far+weatherFog*(.07+.92*Math.pow(far,1.2)));
}

/** Native decoded sprites are shared, so foreground density cannot lower their
 * resolution through the per-instance cache cap. Ground pixels stay unchanged. */
export const forestNativeDetail=(distance:number,tier:DepthTier='full')=>distance>=(tier==='full'?.68:.82);
