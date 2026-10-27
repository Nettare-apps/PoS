-- ============================================================================
-- DRAFT — NOT APPLIED. No Supabase project exists for Pour Register yet;
-- creating one (and its plan) is Conner's call. This file is the proposed
-- schema for milestone 1, written for discussion and local testing only.
--
-- Shape follows the Nettare staff-apps conventions: tables are not writable
-- with the public key; every write goes through a security definer RPC that
-- resolves the caller from a session. Those RPCs land with the production
-- backend milestone; the structure below is what they will write to.
-- ============================================================================

-- The library publishes as one unit (products, categories, settings, mods).
-- Every publish is a numbered revision; the register reads only the highest
-- published revision. Reverting republishes an old revision's data as a new
-- revision — history is never rewritten (SPEC §1/§7).
create table if not exists library_revisions (
  rev         bigint generated always as identity primary key,
  kind        text not null check (kind in ('draft', 'published')),
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  created_by  text,                -- staff identity; staff tables come with auth milestone
  revert_of   bigint references library_revisions (rev)
);

-- One current draft pointer; the published pointer is the max published rev.
create table if not exists library_state (
  id            boolean primary key default true check (id),
  draft_rev     bigint references library_revisions (rev),
  published_rev bigint references library_revisions (rev)
);

-- The append-only event log (SPEC §15): {ts, type, user, tab, ...data}.
-- Reporting is built from it. Nothing is ever updated or deleted; production
-- keeps everything (the prototype's 5,000-event cap was a browser shortcut).
create table if not exists events (
  id        bigint generated always as identity primary key,
  ts        timestamptz not null default now(),
  type      text not null,
  staff_pin text,                  -- "user" in the spec; column name avoids the keyword
  tab_id    text,
  data      jsonb not null default '{}'::jsonb
);

create index if not exists events_ts_idx on events (ts);
create index if not exists events_type_ts_idx on events (type, ts);

-- Guard rails: even definer functions cannot update or delete events.
create or replace function events_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'The event log is append-only';
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'events_append_only') then
    create trigger events_append_only
      before update or delete on events
      for each row execute function events_append_only();
  end if;
end $$;

-- RLS on from day one; no policies yet means no access with the public key.
alter table library_revisions enable row level security;
alter table library_state enable row level security;
alter table events enable row level security;
