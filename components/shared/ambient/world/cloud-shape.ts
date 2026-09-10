/** Slow spatially varying strain, not translation of the entire cloud. */
export function cloudLobeShape(t:number,phase:number,column:number,row:number,strength:number){
 const clock=t*(.035+.025*strength),a=phase+column*1.73+row*2.41;
 return {
  x:Math.sin(clock+a)*(.045+.045*strength),
  y:Math.sin(clock*.83+a*1.31)*(.12+.1*strength),
  sx:1+Math.sin(clock*.91+a)*.16,
  sy:1+Math.sin(clock*1.07+a*1.7)*.27,
  shear:Math.sin(clock*.77+a+row)*.12,
 };
}
