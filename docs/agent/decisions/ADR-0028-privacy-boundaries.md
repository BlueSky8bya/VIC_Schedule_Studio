# ADR-0028 — Privacy is a release boundary

Status: Accepted

Date: 2026-09-21 KST. Authority: owner requested project-wide privacy audit, constitutional
protection rule, DB migration and deployment after the Fancim incident.

Public display identity must never derive from authentication identity. Explicit DTOs are required
both at application and direct database access boundaries. Row security alone does not protect
sensitive columns, and permissive ALL policies must enforce the same private-unlock condition as
SELECT policies. Operational SECURITY DEFINER RPCs explicitly revoke PUBLIC/anon/authenticated
EXECUTE rather than merely granting service_role.

0125 introduces an explicitly projected masked public event view; its owner-rights execution is
intentional and restricted to public calendars, non-draft/nondeleted events and masked future
teasers. The public loader uses it, while raw event RLS denies unrevealed rows to viewers.
Calendar owner_id and private passcode settings are not public client fields.

Passcode verification reserves from one service-only atomic limit across unlock/change routes.
Security-state failure denies verification; concurrent password writes compare the version.

Public Realtime role/device/visibility sharing is retired. This supersedes the old assumption
that omitting email made the presence feed safe. Stable account/device hashes remain pseudonymous
personal data. Analytics uses reviewed keys and typed values; arbitrary short text is not safe.

Live-tab restoration (2026-09-21): `/api/developer/presence` authenticates the real developer
on every request before counting existing active visit sessions. Explicit numeric DTO, private
no-store responses, no raw rows/identifiers, no public channel or new collection. Visible-tab
polling is 15 seconds; heartbeat window is 90 seconds. Counts represent sessions, not unique
people; hidden tabs are not measured. Independent counts can differ briefly during arrivals.
This replaces the temporary unavailable live-tab UI, not the prohibition on public Realtime.

Root AGENTS G-20 and constitution entry codify these rules. Audit scope, remaining historical
exposure/retention/provider gaps and deployment evidence live in
[privacy audit](../verification/PRIVACY-20260921.md). No claim of zero prior breach is made.

Apply0124/0125 before application deployment. Keep restrictive grants when rolling app versions
back; an old reader may omit countdown stubs. Never recover UX by reopening personal-data paths.
