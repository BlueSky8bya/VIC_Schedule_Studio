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

| Role | Read public | Read private | Write events |
| --- | --- | --- | --- |
| viewer | yes | no | no |
| trusted_member | yes | unlock required | no |
| owner | yes | unlock required | yes |

## Checks

- Public route groups import only `public-loader`.
- Studio route groups use server-side checks before private data access.
- RLS mirrors application rules.
- Security tests assert that public API JSON does not contain private keys.
