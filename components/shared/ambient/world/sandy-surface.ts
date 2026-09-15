import type {DepthTier} from './depth';
import {SANDY_WATER} from './sandy-geometry';

const vertex=`attribute vec2 position; varying vec2 uv;
void main(){uv=vec2(position.x*.5+.5,.5-position.y*.5);gl_Position=vec4(position,0.,1.);}`;
// Adapted sum-of-waves principle, not borrowed artwork:
// GPU Gems ch.1, Effective Water Simulation from Physical Models (Mark Finch).
// Sample the original foam and water; never add independent horizontal strokes.
const fragment=`precision highp float;
varying vec2 uv; uniform sampler2D art; uniform sampler2D waterMask; uniform float masked;
uniform vec2 offset; uniform vec2 layout; uniform float time; uniform float strength;
float motion(float v){return .035+.18*smoothstep(.36,.66,v)+.66*smoothstep(.66,1.,v);}
void main(){
 vec2 q=uv;
 for(int i=0;i<2;i++){float v=(q.y-layout.x)/layout.y;q=uv-offset*motion(v);}
 float v=(q.y-layout.x)/layout.y;
 float mask=smoothstep(${SANDY_WATER.start},${SANDY_WATER.full},v)*(1.-smoothstep(${SANDY_WATER.fade},${SANDY_WATER.end},v));
 if(masked>.5)mask=texture2D(waterMask,q).r*smoothstep(.385,.43,v);
 if(mask>0. && strength>0.){
 // Different wavelengths and phase speeds keep the foam from moving as one card.
 float broad=sin(time*.82-q.x*4.7-v*18.);
 float fine=sin(time*1.31+q.x*15.3-v*39.);
 float wash=sin(time*.68+q.x*3.1+.4*sin(q.x*9.));
 float shore=smoothstep(.55,.64,v);
 q.y-=layout.y*mask*strength*(.0045*broad+.0015*fine+.005*shore*wash);
 q.x+=mask*strength*(.0013*sin(time*.57+q.x*13.+v*31.));
 }
 gl_FragColor=texture2D(art,clamp(q,vec2(.0001),vec2(.9999)));
}`;

/** One bounded GPU pass, continuous source coordinates, no readback or per-frame
 * texture uploads. Unsupported/lost contexts fall back to cached 2D relief. */
export class SandySurface {
 private canvas?:HTMLCanvasElement;
 private gl?:WebGLRenderingContext;
 private program?:WebGLProgram;
 private texture?:WebGLTexture;
 private maskTexture?:WebGLTexture;
 private maskSource?:HTMLCanvasElement;
 private buffer?:WebGLBuffer;
 private uniforms:Record<string,WebGLUniformLocation|null>={};
 private source?:HTMLCanvasElement;
 private failed=false;
 private uploads=0;
 private maskUploads=0;
 private draws=0;
 private amplitude=0;
 private frameKey="";
 private init(){
  if(this.gl)return !this.gl.isContextLost();
  if(this.failed)return false;
  const c=document.createElement('canvas');
  const gl=c.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true});
  if(!gl){this.failed=true;return false;}
  this.canvas=c;this.gl=gl;
  c.addEventListener('webglcontextlost',()=>{this.failed=true;});
  const compile=(kind:number,code:string)=>{
   const s=gl.createShader(kind)!;gl.shaderSource(s,code);gl.compileShader(s);
   if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);return null;}return s;
  };
  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
  if(!vs||!fs){if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);this.dispose();this.failed=true;return false;}
  const p=gl.createProgram()!;gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)){gl.deleteProgram(p);this.dispose();this.failed=true;return false;}
  this.program=p;gl.useProgram(p);
  this.buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const a=gl.getAttribLocation(p,'position');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
  this.texture=gl.createTexture()!;gl.bindTexture(gl.TEXTURE_2D,this.texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  this.maskTexture=gl.createTexture()!;gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.maskTexture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));gl.activeTexture(gl.TEXTURE0);
  for(const name of ['art','waterMask','masked','offset','layout','time','strength'])this.uniforms[name]=gl.getUniformLocation(p,name);
  gl.uniform1i(this.uniforms.art,0);gl.uniform1i(this.uniforms.waterMask,1);return true;
 }
 draw(g:CanvasRenderingContext2D,source:HTMLCanvasElement,w:number,h:number,off:{x:number;y:number},tier:DepthTier,t:number,strength:number,layout:{y:number;height:number},mask?:HTMLCanvasElement){
  this.amplitude=tier==='still'?0:strength;
  if(tier==='still'||!this.init())return false;
  const gl=this.gl!,c=this.canvas!;
  const scale=Math.min(source.width/w,tier==='lite'?.7:1.5,Math.sqrt((tier==='lite'?700000:2800000)/(w*h)));
  const width=Math.ceil(w*scale),height=Math.ceil(h*scale);
  if(c.width!==width||c.height!==height){this.frameKey="";c.width=width;c.height=height;gl.viewport(0,0,width,height);}
  if(source!==this.source){gl.bindTexture(gl.TEXTURE_2D,this.texture!);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);this.source=source;this.uploads++;this.frameKey="";}
  if(mask!==this.maskSource){
   if(mask){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.maskTexture!);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,mask);gl.activeTexture(gl.TEXTURE0);this.maskUploads++;}
   this.maskSource=mask;this.frameKey="";
  }
  gl.uniform1f(this.uniforms.masked,mask?1:0);
  this.amplitude=strength;
  // Subpixel-slow surf needs 24 updates/sec (12 in lite), not 60 texture passes.
  // Pointer changes remain immediate. Still water reuses the previous result.
  const tick=strength>0?Math.floor(t*(tier==='lite'?12:24)):0;
  const key=`${tick}:${off.x}:${off.y}:${strength.toFixed(2)}:${layout.y}:${layout.height}`;
  if(key===this.frameKey){g.drawImage(c,0,0,w,h);return true;}
  this.frameKey=key;
  gl.uniform2f(this.uniforms.offset,off.x/w,off.y/h);gl.uniform2f(this.uniforms.layout,layout.y/h,layout.height/h);
  gl.uniform1f(this.uniforms.time,t);gl.uniform1f(this.uniforms.strength,strength);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);g.drawImage(c,0,0,w,h);this.draws++;return true;
 }
 debug(){return {available:!!this.gl&&!this.failed,uploads:this.uploads,maskUploads:this.maskUploads,draws:this.draws,amplitude:this.amplitude,pixels:this.canvas?this.canvas.width*this.canvas.height:0};}
 dispose(){const gl=this.gl;if(gl){if(this.texture)gl.deleteTexture(this.texture);if(this.maskTexture)gl.deleteTexture(this.maskTexture);if(this.buffer)gl.deleteBuffer(this.buffer);if(this.program)gl.deleteProgram(this.program);gl.getExtension('WEBGL_lose_context')?.loseContext();}if(this.canvas)this.canvas.width=this.canvas.height=1;this.gl=undefined;this.canvas=undefined;this.source=undefined;this.maskSource=undefined;}
}
