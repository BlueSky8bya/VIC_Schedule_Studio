-- Muted large fills for the warm charcoal UI; small accents retain more chroma.
-- Pure source-color metadata only: no schedule, role or KST behavior changes.
-- Apply before deploying v3 readers. Roll back readers to v2; retain both older
-- generated columns and source colors. No production recolor/backfill required.
begin;
set local lock_timeout = '5s';

create or replace function public.dark_tag_palette_v3(source text)
returns jsonb language sql immutable strict parallel safe set search_path = pg_catalog as $$
  select jsonb_build_object('version',3,'source',case when source ~ '^#[0-9a-fA-F]{6}$' then lower(source) else '#b8b3aa' end,
    'bgColor',public.dark_tag_color_v2(source,0.38,0.08,0.60,0.065,0.012),
    'borderColor',public.dark_tag_color_v2(source,0.55,0.06,0.65,0.075,0.012),
    'textColor','#f1ede6',
    'accentColor',public.dark_tag_color_v2(source,0.72,0.06,0.8,0.11,0.018));
$$;

alter table public.color_palette add column if not exists dark_palette_v3 jsonb
  generated always as (public.dark_tag_palette_v3(bg_color)) stored;
alter table public.broadcast_tags add column if not exists dark_palette_v3 jsonb
  generated always as (public.dark_tag_palette_v3(bg_hex)) stored;

revoke all on function public.dark_tag_palette_v3(text) from public;
grant execute on function public.dark_tag_palette_v3(text) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
commit;
