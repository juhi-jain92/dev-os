-- ============================================================================
-- ContractIQ — Supabase Schema
-- Paste directly into the Supabase SQL Editor and run on a fresh project.
-- Source: docs/engineering/engineering-doc.md §7 (Database Design and Schema)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- provides gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type contract_type_enum as enum ('nda', 'msa');
create type contract_status_enum as enum ('text_extracted', 'processing', 'processed', 'error');
create type message_role_enum as enum ('user', 'assistant');
create type context_source_enum as enum ('contract', 'history', 'both');
create type feedback_rating_enum as enum ('up', 'down');

-- ----------------------------------------------------------------------------
-- Shared trigger function: auto-update `updated_at`
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- Table: contracts
-- ============================================================================
create table contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contract_type contract_type_enum not null,
  file_name text not null,
  file_path text, -- Storage path; null if Storage upload failed (non-blocking per FR-06)
  contract_text text not null, -- full extracted text with [PAGE N] markers
  status contract_status_enum not null default 'text_extracted',
  page_count int not null check (page_count > 0 and page_count <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_contracts_user_id on contracts(user_id);
create index idx_contracts_user_created on contracts(user_id, created_at desc);

create trigger trg_contracts_updated_at
before update on contracts
for each row execute function set_updated_at();

-- ============================================================================
-- Table: key_terms (standard, AI-extracted terms)
-- ============================================================================
create table key_terms (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  term_name text not null,
  value text not null,
  original_ai_value text, -- set only when is_edited = true
  page_number int not null check (page_number > 0),
  confidence_score numeric(5,2) not null check (confidence_score >= 0 and confidence_score <= 100),
  source_sentence text not null,
  is_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_key_terms_contract_id on key_terms(contract_id);
create index idx_key_terms_user_id on key_terms(user_id);

create trigger trg_key_terms_updated_at
before update on key_terms
for each row execute function set_updated_at();

-- ============================================================================
-- Table: custom_key_terms (user-defined terms, max 5 per contract)
-- ============================================================================
create table custom_key_terms (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  term_input text not null, -- the user's original free-text term request
  term_name text not null,
  value text not null,
  original_ai_value text,
  page_number int not null check (page_number > 0),
  confidence_score numeric(5,2) not null check (confidence_score >= 0 and confidence_score <= 100),
  source_sentence text not null,
  is_manual boolean not null default true,
  is_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_custom_key_terms_contract_id on custom_key_terms(contract_id);
create index idx_custom_key_terms_user_id on custom_key_terms(user_id);

create trigger trg_custom_key_terms_updated_at
before update on custom_key_terms
for each row execute function set_updated_at();

-- Enforce max 5 custom key terms per contract (PRD constraint)
create or replace function check_custom_key_term_limit()
returns trigger as $$
begin
  if (select count(*) from custom_key_terms where contract_id = new.contract_id) >= 5 then
    raise exception 'Maximum of 5 custom key terms per contract';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_custom_key_terms_limit
before insert on custom_key_terms
for each row execute function check_custom_key_term_limit();

-- ============================================================================
-- Table: chat_sessions (one per contract at MVP)
-- ============================================================================
create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null unique references contracts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_chat_sessions_user_id on chat_sessions(user_id);

-- ============================================================================
-- Table: chat_messages
-- ============================================================================
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role message_role_enum not null,
  content text not null check (char_length(content) <= 4000),
  page_citation int, -- parsed from [Page X] in assistant responses
  context_source context_source_enum, -- classification result; null for user-authored messages
  created_at timestamptz not null default now()
);

create index idx_chat_messages_session_created on chat_messages(session_id, created_at asc);

-- ============================================================================
-- Table: user_feedback
-- ============================================================================
create table user_feedback (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating feedback_rating_enum not null,
  comment text,
  created_at timestamptz not null default now()
);

create index idx_user_feedback_contract_id on user_feedback(contract_id);
create index idx_user_feedback_user_id on user_feedback(user_id);

-- ============================================================================
-- Table: rate_limit_events (sliding-window per-user rate limiting for
-- OpenAI-backed Edge Functions — process-extraction and chat)
-- ============================================================================
create table rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  function_name text not null check (function_name in ('process-extraction', 'chat')),
  created_at timestamptz not null default now()
);

create index idx_rate_limit_events_lookup on rate_limit_events(user_id, function_name, created_at desc);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table contracts enable row level security;
alter table key_terms enable row level security;
alter table custom_key_terms enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table user_feedback enable row level security;
alter table rate_limit_events enable row level security;

-- contracts
create policy "contracts_select_own" on contracts for select using (auth.uid() = user_id);
create policy "contracts_insert_own" on contracts for insert with check (auth.uid() = user_id);
create policy "contracts_update_own" on contracts for update using (auth.uid() = user_id);
create policy "contracts_delete_own" on contracts for delete using (auth.uid() = user_id);

-- key_terms
create policy "key_terms_select_own" on key_terms for select using (auth.uid() = user_id);
create policy "key_terms_insert_own" on key_terms for insert with check (auth.uid() = user_id);
create policy "key_terms_update_own" on key_terms for update using (auth.uid() = user_id);
create policy "key_terms_delete_own" on key_terms for delete using (auth.uid() = user_id);

-- custom_key_terms
create policy "custom_key_terms_select_own" on custom_key_terms for select using (auth.uid() = user_id);
create policy "custom_key_terms_insert_own" on custom_key_terms for insert with check (auth.uid() = user_id);
create policy "custom_key_terms_update_own" on custom_key_terms for update using (auth.uid() = user_id);
create policy "custom_key_terms_delete_own" on custom_key_terms for delete using (auth.uid() = user_id);

-- chat_sessions
create policy "chat_sessions_select_own" on chat_sessions for select using (auth.uid() = user_id);
create policy "chat_sessions_insert_own" on chat_sessions for insert with check (auth.uid() = user_id);
create policy "chat_sessions_delete_own" on chat_sessions for delete using (auth.uid() = user_id);

-- chat_messages
create policy "chat_messages_select_own" on chat_messages for select using (auth.uid() = user_id);
create policy "chat_messages_insert_own" on chat_messages for insert with check (auth.uid() = user_id);

-- user_feedback
create policy "user_feedback_select_own" on user_feedback for select using (auth.uid() = user_id);
create policy "user_feedback_insert_own" on user_feedback for insert with check (auth.uid() = user_id);

-- rate_limit_events (server-only table; Edge Functions use the service role key,
-- which bypasses RLS — policies below cover any direct client access attempt)
create policy "rate_limit_events_select_own" on rate_limit_events for select using (auth.uid() = user_id);
create policy "rate_limit_events_insert_own" on rate_limit_events for insert with check (auth.uid() = user_id);

-- ============================================================================
-- Storage: `contracts` bucket + RLS policies
-- Path pattern: contracts/{user_id}/{contract_id}/{filename}.pdf
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

create policy "contracts_storage_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'contracts'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "contracts_storage_select_own"
on storage.objects for select
using (
  bucket_id = 'contracts'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "contracts_storage_delete_own"
on storage.objects for delete
using (
  bucket_id = 'contracts'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================================
-- End of schema
-- ============================================================================
