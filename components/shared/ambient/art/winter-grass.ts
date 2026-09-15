/** Photo-informed dry grass: longitudinal fibres follow the bent blade;
 * varying width/light exposes rolled faces instead of a flat icon outline.
 * Evaluated only while baking material sprites and their matching shadows. */
function section(t:number,variant:number){
 const kind=variant%3;
 let x:number,y:number,dx:number,dy:number;
 if(kind===0){
  x=.3*Math.sin(t*4.4-.5)-.08;y=.91-1.84*t;
  dx=1.32*Math.cos(t*4.4-.5);dy=-1.84;
 }else if(kind===1){
  const a=-.2+t*5.1,rad=.52-.16*t;
  x=rad*Math.cos(a)-.18;y=.82-1.5*t+rad*Math.sin(a);
  dx=-.16*Math.cos(a)-5.1*rad*Math.sin(a);dy=-1.5-.16*Math.sin(a)+5.1*rad*Math.cos(a);
 }else{
  x=.34*Math.sin(t*5.8-.9);y=.93-1.86*t;
  dx=1.972*Math.cos(t*5.8-.9);dy=-1.86;
 }
 const length=Math.hypot(dx,dy),taper=Math.pow(Math.sin(Math.PI*(.025+.95*t)),.55);
 const width=(kind===1?.155:.12)*taper*(.68+.32*Math.abs(Math.cos(t*5+kind)));
 return {x,y,nx:-dy/length,ny:dx/length,width};
}
function edge(t:number,side:number,variant:number){
 const p=section(t,variant);
 const wear=1+.065*Math.sin(t*93+side*2)+.025*Math.sin(t*177+variant);
 return {x:p.x+p.nx*p.width*side*wear,y:p.y+p.ny*p.width*side*wear};
}
export function dryGrassPath(g:CanvasRenderingContext2D,r:number,variant:number){
 g.beginPath();
 for(const side of [-1,1])for(let j=0;j<=64;j++){
  const t=side===-1?j/64:1-j/64,p=edge(t,side,variant);
  if(side===-1&&j===0)g.moveTo(p.x*r,p.y*r);else g.lineTo(p.x*r,p.y*r);
 }
 g.closePath();
}
export function paintDryGrassDetail(g:CanvasRenderingContext2D,r:number,variant:number){
 // Broad strips make rolled edges and alternating faces legible at game scale.
 for(let lane=0;lane<12;lane++){
  const u=-1+lane/6,v=u+1/6;
  g.beginPath();
  for(let j=0;j<=48;j++){const p=section(j/48,variant);g.lineTo((p.x+p.nx*p.width*u)*r,(p.y+p.ny*p.width*u)*r);}
  for(let j=48;j>=0;j--){const p=section(j/48,variant);g.lineTo((p.x+p.nx*p.width*v)*r,(p.y+p.ny*p.width*v)*r);}
  g.closePath();g.fillStyle=lane<3?'rgba(88,64,35,.30)':lane<7?'rgba(255,242,200,.38)':'rgba(117,87,47,.16)';g.fill();
 }
 for(let lane=0;lane<13;lane++){
  const u=-.94+lane*.155;
  g.strokeStyle=lane%3===0?'rgba(102,73,38,.32)':'rgba(250,229,178,.45)';g.lineWidth=.35;
  g.beginPath();
  for(let j=0;j<=64;j++){
   const t=.025+j/64*.95,p=section(t,variant),grain=u+.028*Math.sin(t*54+lane);
   const x=(p.x+p.nx*p.width*grain)*r,y=(p.y+p.ny*p.width*grain)*r;
   if(j===0)g.moveTo(x,y);else g.lineTo(x,y);
  }
  g.stroke();
 }
 // Dry, irregular brown marks aligned with the fibres, without bold borders.
 for(let i=0;i<14;i++){
  const t=.1+((i*37+variant*11)%83)/100,p=section(t,variant),u=Math.sin(i*9.1)*.7;
  g.fillStyle='rgba(101,74,43,.20)';g.fillRect((p.x+p.nx*p.width*u)*r,(p.y+p.ny*p.width*u)*r,.6,1.3);
 }
}
