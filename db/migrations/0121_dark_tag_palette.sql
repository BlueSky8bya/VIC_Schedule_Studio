-- Automatic dark tag palette, version 1. Public visual metadata only.
-- Apply BEFORE the app selects dark_palette. Existing light colors are untouched.
-- STORED generated columns cover existing rows and every future insert/update,
-- including custom bg_hex edits and direct SQL writes. Children inherit via NULL.
-- Rollback: deploy the previous readers first; leave these harmless columns in
-- place. Removal, if ever needed, is a separate authorized migration.
-- Existing table grants/RLS remain unchanged. Formula matches lib/tags/dark-palette.ts
-- and color-tone.ts; never redefine v1 with a different color contract.
begin;
set local lock_timeout = '5s';

create or replace function public.dark_tag_color_v1(
  source text, base_l double precision, l_gain double precision,
  chroma_gain double precision, chroma_cap double precision
) returns text language plpgsql immutable strict parallel safe
set search_path = pg_catalog as $$
declare
  rgb double precision[]; lin double precision[]; lab_l double precision;
  lab_a double precision; lab_b double precision; lm double precision;
  mm double precision; sm double precision; hue double precision;
  target_l double precision; chroma double precision; low_c double precision := 0;
  high_c double precision; candidate double precision; aa double precision;
  bb double precision; i integer; pass integer; j integer; channel integer;
  result text := '#'; valid boolean;
begin
  if source !~ '^#[0-9a-fA-F]{6}$' then source := '#b8b3aa'; end if;
  rgb := array[get_byte(decode(substr(source,2),'hex'),0), get_byte(decode(substr(source,2),'hex'),1), get_byte(decode(substr(source,2),'hex'),2)]::double precision[];
  for i in 1..3 loop
    rgb[i] := rgb[i] / 255;
    rgb[i] := case when rgb[i] <= 0.04045 then rgb[i]/12.92 else power((rgb[i]+0.055)/1.055,2.4) end;
  end loop;
  lm := power(0.4122214708*rgb[1]+0.5363325363*rgb[2]+0.0514459929*rgb[3],1.0/3);
  mm := power(0.2119034982*rgb[1]+0.6806995451*rgb[2]+0.1073969566*rgb[3],1.0/3);
  sm := power(0.0883024619*rgb[1]+0.2817188376*rgb[2]+0.6299787005*rgb[3],1.0/3);
  lab_l := 0.2104542553*lm+0.793617785*mm-0.0040720468*sm;
  lab_a := 1.9779984951*lm-2.428592205*mm+0.4505937099*sm;
  lab_b := 0.0259040371*lm+0.7827717662*mm-0.808675766*sm;
  hue := atan2(lab_b,lab_a);
  target_l := base_l + lab_l*l_gain;
  chroma := least(chroma_cap,sqrt(lab_a*lab_a+lab_b*lab_b)*chroma_gain);
  high_c := chroma;
  -- Initial gamut test, then exactly 24 bisections if needed, then final encode.
  for pass in 0..25 loop
    candidate := case when pass=0 then chroma when pass=25 then low_c else (low_c+high_c)/2 end;
    aa := candidate*cos(hue); bb := candidate*sin(hue);
    lm := power(target_l+0.3963377774*aa+0.2158037573*bb,3);
    mm := power(target_l-0.1055613458*aa-0.0638541728*bb,3);
    sm := power(target_l-0.0894841775*aa-1.291485548*bb,3);
    lin := array[4.0767416621*lm-3.3077115913*mm+0.2309699292*sm,
      -1.2684380046*lm+2.6097574011*mm-0.3413193965*sm,
      -0.0041960863*lm-0.7034186147*mm+1.707614701*sm];
    valid := lin[1] between -0.0001 and 1.0001 and lin[2] between -0.0001 and 1.0001 and lin[3] between -0.0001 and 1.0001;
    if pass=0 and valid then exit; end if;
    if pass>0 and pass<25 then
      if valid then low_c := candidate; else high_c := candidate; end if;
    end if;
  end loop;
  for j in 1..3 loop
    lin[j] := greatest(0,least(1,lin[j]));
    channel := floor(255*greatest(0,least(1,case when lin[j]<=0.0031308 then 12.92*lin[j] else 1.055*power(lin[j],1/2.4)-0.055 end))+0.5)::integer;
    result := result || lpad(to_hex(channel),2,'0');
  end loop;
  return result;
end $$;

create or replace function public.dark_tag_palette_v1(source text)
returns jsonb language sql immutable strict parallel safe set search_path = pg_catalog as $$
  select jsonb_build_object('version',1,'source',case when source ~ '^#[0-9a-fA-F]{6}$' then lower(source) else '#b8b3aa' end,
    'bgColor',public.dark_tag_color_v1(source,0.34,0.10,0.45,0.065),
    'borderColor',public.dark_tag_color_v1(source,0.55,0.04,0.55,0.075),
    'textColor','#f1ede6',
    'accentColor',public.dark_tag_color_v1(source,0.72,0.06,0.75,0.12));
$$;

alter table public.color_palette add column if not exists dark_palette jsonb
  generated always as (public.dark_tag_palette_v1(bg_color)) stored;
alter table public.broadcast_tags add column if not exists dark_palette jsonb
  generated always as (public.dark_tag_palette_v1(bg_hex)) stored;

revoke all on function public.dark_tag_color_v1(text,double precision,double precision,double precision,double precision) from public;
revoke all on function public.dark_tag_palette_v1(text) from public;
grant execute on function public.dark_tag_color_v1(text,double precision,double precision,double precision,double precision) to anon, authenticated, service_role;
grant execute on function public.dark_tag_palette_v1(text) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
commit;
