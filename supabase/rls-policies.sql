-- ============================================================================
-- ContractIQ — RLS Policies (standalone, idempotent)
-- Paste directly into the Supabase SQL Editor and run — safe to re-run
-- against a database that already has these tables/policies applied.
-- Source: security-foundation skill; mirrors docs/specs/supabase-schema.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enable RLS on every application table (idempotent — safe to re-run)
-- ----------------------------------------------------------------------------
alter table if exists contracts enable row level security;
alter table if exists key_terms enable row level security;
alter table if exists custom_key_terms enable row level security;
alter table if exists chat_sessions enable row level security;
alter table if exists chat_messages enable row level security;
alter table if exists user_feedback enable row level security;
alter table if exists rate_limit_events enable row level security;

-- ----------------------------------------------------------------------------
-- contracts
-- ----------------------------------------------------------------------------
drop policy if exists "contracts_select_own" on contracts;
create policy "contracts_select_own" on contracts for select using (auth.uid() = user_id);

drop policy if exists "contracts_insert_own" on contracts;
create policy "contracts_insert_own" on contracts for insert with check (auth.uid() = user_id);

drop policy if exists "contracts_update_own" on contracts;
create policy "contracts_update_own" on contracts for update using (auth.uid() = user_id);

drop policy if exists "contracts_delete_own" on contracts;
create policy "contracts_delete_own" on contracts for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- key_terms
-- ----------------------------------------------------------------------------
drop policy if exists "key_terms_select_own" on key_terms;
create policy "key_terms_select_own" on key_terms for select using (auth.uid() = user_id);

drop policy if exists "key_terms_insert_own" on key_terms;
create policy "key_terms_insert_own" on key_terms for insert with check (auth.uid() = user_id);

drop policy if exists "key_terms_update_own" on key_terms;
create policy "key_terms_update_own" on key_terms for update using (auth.uid() = user_id);

drop policy if exists "key_terms_delete_own" on key_terms;
create policy "key_terms_delete_own" on key_terms for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- custom_key_terms
-- ----------------------------------------------------------------------------
drop policy if exists "custom_key_terms_select_own" on custom_key_terms;
create policy "custom_key_terms_select_own" on custom_key_terms for select using (auth.uid() = user_id);

drop policy if exists "custom_key_terms_insert_own" on custom_key_terms;
create policy "custom_key_terms_insert_own" on custom_key_terms for insert with check (auth.uid() = user_id);

drop policy if exists "custom_key_terms_update_own" on custom_key_terms;
create policy "custom_key_terms_update_own" on custom_key_terms for update using (auth.uid() = user_id);

drop policy if exists "custom_key_terms_delete_own" on custom_key_terms;
create policy "custom_key_terms_delete_own" on custom_key_terms for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- chat_sessions
-- ----------------------------------------------------------------------------
drop policy if exists "chat_sessions_select_own" on chat_sessions;
create policy "chat_sessions_select_own" on chat_sessions for select using (auth.uid() = user_id);

drop policy if exists "chat_sessions_insert_own" on chat_sessions;
create policy "chat_sessions_insert_own" on chat_sessions for insert with check (auth.uid() = user_id);

drop policy if exists "chat_sessions_delete_own" on chat_sessions;
create policy "chat_sessions_delete_own" on chat_sessions for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- chat_messages
-- ----------------------------------------------------------------------------
drop policy if exists "chat_messages_select_own" on chat_messages;
create policy "chat_messages_select_own" on chat_messages for select using (auth.uid() = user_id);

drop policy if exists "chat_messages_insert_own" on chat_messages;
create policy "chat_messages_insert_own" on chat_messages for insert with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- user_feedback
-- ----------------------------------------------------------------------------
drop policy if exists "user_feedback_select_own" on user_feedback;
create policy "user_feedback_select_own" on user_feedback for select using (auth.uid() = user_id);

drop policy if exists "user_feedback_insert_own" on user_feedback;
create policy "user_feedback_insert_own" on user_feedback for insert with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- rate_limit_events (server-only table; Edge Functions use the service role
-- key, which bypasses RLS — these policies cover any direct client access attempt)
-- ----------------------------------------------------------------------------
create table if not exists rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  function_name text not null check (function_name in ('process-extraction', 'chat')),
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_events_lookup
  on rate_limit_events(user_id, function_name, created_at desc);

drop policy if exists "rate_limit_events_select_own" on rate_limit_events;
create policy "rate_limit_events_select_own" on rate_limit_events for select using (auth.uid() = user_id);

drop policy if exists "rate_limit_events_insert_own" on rate_limit_events;
create policy "rate_limit_events_insert_own" on rate_limit_events for insert with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Storage: `contracts` bucket — private, path-scoped to the owning user
-- Path pattern: contracts/{user_id}/{contract_id}/{filename}
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

drop policy if exists "contracts_storage_insert_own" on storage.objects;
create policy "contracts_storage_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'contracts'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "contracts_storage_select_own" on storage.objects;
create policy "contracts_storage_select_own"
on storage.objects for select
using (
  bucket_id = 'contracts'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "contracts_storage_delete_own" on storage.objects;
create policy "contracts_storage_delete_own"
on storage.objects for delete
using (
  bucket_id = 'contracts'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================================
-- End of RLS policies
-- ============================================================================
