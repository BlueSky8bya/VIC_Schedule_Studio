# Public Private Boundary

- `app/(public)` and `app/api/public` may import `lib/schedules/public-loader`.
- They must not import `studio-loader`, private DTOs as response types, or Supabase service-role helpers.
- Any field containing private, internal, embargo, codename, editor, work, or request payload data is forbidden in public responses.
- Prefer explicit DTO construction over object spreading when crossing from studio data to public data.
