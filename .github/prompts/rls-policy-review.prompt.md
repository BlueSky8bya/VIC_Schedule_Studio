# RLS Policy Review

Review the changed Supabase schema and RLS policies for VIC Schedule Studio.

Focus on:
- owner-only event writes
- trusted member read-only private-layer access
- unlock session requirements
- anonymous viewer public reads
- public proposal creation without direct event mutation
- absence of public access to `event_private_meta`, `requests`, and `unlock_sessions`
