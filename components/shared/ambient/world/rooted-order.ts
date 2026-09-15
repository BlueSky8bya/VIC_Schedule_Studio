/** Shared root/foot ordering for trees and future ground-bound actors.
 * Equal depth draws the standing object first, actor in front. */
export function rootedPass<T extends {y:number}>(sorted:readonly T[],draw:(item:T)=>void){
  let index=0;
  return (footY:number)=>{while(index<sorted.length&&sorted[index].y<=footY)draw(sorted[index++]);};
}
