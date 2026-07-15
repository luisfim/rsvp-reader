-- Fixpoint: archive and trash support
-- Run once in Supabase SQL Editor before using this update.

alter table public.documents
  add column if not exists archived_at timestamptz null,
  add column if not exists trashed_at timestamptz null;

create index if not exists documents_user_archived_at_idx
  on public.documents (user_id, archived_at);

create index if not exists documents_user_trashed_at_idx
  on public.documents (user_id, trashed_at);
