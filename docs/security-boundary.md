# Security Boundary

The main security rule is simple: private fields are excluded before data reaches public routes or public clients.

Do not rely on CSS, client filters, or hidden DOM nodes to protect private schedule data.

## Public Data

Allowed public event fields:
- `id`
- `startsAt`
- `endsAt`
- `publicTitle`
- `publicDescription`
- `status`, excluding `draft`
- `category`
- `variantGroupId`
- `variantLabel`

Forbidden public fields:
- `privateTitle`
- `privateNotes`
- `codename`
- `embargoUntil`
- `editorNote`
- work state
- request payloads
- unlock session data

## Roles

| Role | Read public | Read private | Write events | Scope |
| --- | --- | --- | --- | --- |
| viewer | yes | no | no | n/a |
| manager | yes | unlock required | no | one calendar |
| worker | yes | unlock required | no | one calendar |
| owner | yes | unlock required | yes | own calendar |
| developer | yes | unlock required | yes | all calendars |

`developer` is a platform-level superadmin (the system maintainer), separate from
`owner` (the streamer). Developers can read and edit every calendar so they can debug
and fix issues, but two boundaries still hold:

- The public API output is identical regardless of role. Developer access never
  changes what `public-loader` returns. Public stays private-free for everyone.
- Reading embargo/work/owner_private rows still requires a valid unlock session.
  Developers enter the passcode like anyone else; this is not a passcode bypass.

owner_private ("나만") events are OWNER-ONLY: not developers, not trusted members. RLS
for owner_private uses `is_calendar_owner` (not `is_calendar_admin`), and only the owner
sees the "나만" option / can create them.

There is no anonymous/public page route. Everyone signs in with Google at root (`/`);
a viewer is simply a signed-in account that is neither owner, developer, nor trusted
member, and is routed to the public calendar. (Public API routes under
`/api/public/[slug]` still return public-only data and stay private-free.)

## Authentication Resolution

Role resolution is server-side only.

1. Read Supabase Auth session from SSR cookies.
2. If no user exists, show the Google login gate at `/`.
3. Elevated roles require a Supabase user whose provider or identity is `google`.
4. If the verified Google email is in `platform_admins`, return developer (checked first, cross-calendar).
5. Else if the verified Google email is in `OWNER_EMAIL` (a comma-separated list — a streamer may use more than one account), return owner.
6. Otherwise query `trusted_members` by calendar slug and Google email with the service-role client.
7. Active trusted members resolve to `manager` or `worker`.
8. Everyone else resolves to viewer.

In the database, `is_developer()` reads `platform_admins`, and `is_calendar_admin()`
= owner OR developer. `is_calendar_owner()` is true for `calendars.owner_id` (the
primary owner) OR any account in `calendar_co_owners` (co-owners — extra accounts of
the same streamer). Management/write policies and owner_private reads use
`is_calendar_admin()`; embargo/work/owner_private reads still require `has_private_unlock()`.

Knowing the owner's email address is not enough to get owner permissions. The
request must carry a valid Google-authenticated Supabase session for that email.

Client-side role selectors are not trusted for permissions. Studio UI receives the resolved actor from the server and only uses it for ergonomics; write APIs must still re-check owner status.

## Checks

- Public route groups import only `public-loader`.
- Studio route groups use server-side checks before private data access.
- RLS mirrors application rules.
- Security tests assert that public API JSON does not contain private keys.
