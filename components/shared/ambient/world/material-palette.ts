import type {SeasonKey} from '../registry';
import type {BiomeKey} from './biomes';
// Material albedo only: shared time/weather lighting still runs after drawing.
// Meadow is the accepted baseline. Apply to the entire sprite, including veins.
const profiles:Partial<Record<BiomeKey,readonly[number,number,number]>>={
 hill:[.95,.90,.06],pond:[.94,.88,.08],valley:[.91,.80,.10],
 forest:[.85,.78,.10],mountain:[.85,.66,.15],
};
const surroundings:Record<SeasonKey,readonly[number,number,number]>={
 spring:[146,150,117],summer:[119,134,94],autumn:[151,126,90],winter:[149,151,144],
};
/** Small cached sprite bake; no scene reads or per-frame pixel work. Alpha intact. */
export function harmonizeMaterial(data:Uint8ClampedArray,biome:BiomeKey,season:SeasonKey){
 const profile=profiles[biome];if(!profile)return;
 const [exposure,saturation,mix]=profile,ambient=surroundings[season];
 // Petals keep their pink/cream distinctions; winter straw keeps its warm fiber.
 const sat=season==='spring'?1-(1-saturation)*.65:saturation;
 for(let i=0;i<data.length;i+=4){
  if(!data[i+3])continue;
  const lum=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
  for(let ch=0;ch<3;ch++)data[i+ch]=Math.round((lum+(data[i+ch]-lum)*sat)*exposure*(1-mix)+ambient[ch]*mix);
 }
}
