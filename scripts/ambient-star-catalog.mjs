// Reproducible, attributed magnitude-limited HYG subset. No runtime network.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const url='https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v40.csv.gz';
const response=await fetch(url); if(!response.ok)throw Error(`HYG ${response.status}`);
const bytes=Buffer.from(await response.arrayBuffer());
const csv=gunzipSync(bytes).toString('utf8');
function fields(line){
 const out=[];let value='',quoted=false;
 for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){out.push(value);value='';}else value+=c;}
 out.push(value);return out;
}
const lines=csv.trim().split(/\r?\n/),head=fields(lines.shift());
const rows=lines.map(line=>Object.fromEntries(fields(line).map((v,i)=>[head[i],v])))
 .filter(s=>Number(s.id)>0&&s.mag!==''&&Number(s.mag)<=6)
 .map(s=>[Number(s.hip)||Number(s.id)+200000,+s.ra,+s.dec,+s.mag,s.ci===''?null:+s.ci,s.proper||'',+s.pmra,+s.pmdec])
 .sort((a,b)=>a[3]-b[3]||a[0]-b[0]);
const file='components/shared/ambient/world/star-catalog.json';
fs.writeFileSync(file,JSON.stringify(rows)+'\n');
const license=await fetch('https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/LICENSE').then(r=>r.text());
fs.writeFileSync('public/ambient/licenses/hyg.txt',`HYG v4.0 — David Nash / Astronexus\n${url}\nAdaptation: stars magnitude <= 6, selected fields, sorted by magnitude.\nFields: HIP (fallback HYG+200000), RA hours, Dec degrees, apparent magnitude, B-V, proper name, pmRA, pmDec mas/year.\n${license}`);
fs.writeFileSync('docs/ambient/star-catalog-source.json',JSON.stringify({url,sha256:createHash('sha256').update(bytes).digest('hex'),count:rows.length,limit:6,license:'CC BY-SA 4.0',fields:['hip','raHours','decDegrees','magnitude','bv','name','pmRaMasYear','pmDecMasYear'],output:file,outputSha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')},null,2)+'\n');
console.log(`${rows.length} catalog stars; ${fs.statSync(file).size} bytes`);
