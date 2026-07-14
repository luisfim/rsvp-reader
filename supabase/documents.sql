-- Run this once in Supabase: SQL Editor -> New query -> Run.

create table if not exists public.documents (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  content text not null,
  word_count integer not null check (word_count >= 0),
  current_word_index integer not null default 0 check (current_word_index >= 0),
  words_per_minute integer not null default 400
    check (words_per_minute between 250 and 2000),
  font_size integer not null default 72
    check (font_size between 48 and 112),
  use_natural_pauses boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint documents_progress_within_text check (
    current_word_index <= greatest(word_count - 1, 0)
  )
);

create index if not exists documents_user_updated_index
  on public.documents (user_id, updated_at desc);

create index if not exists documents_user_deleted_index
  on public.documents (user_id, deleted_at, updated_at desc);

alter table public.documents enable row level security;

grant select, insert, update, delete
  on table public.documents
  to authenticated;

drop policy if exists "Users can read their documents"
  on public.documents;
create policy "Users can read their documents"
  on public.documents
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their documents"
  on public.documents;
create policy "Users can create their documents"
  on public.documents
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their documents"
  on public.documents;
create policy "Users can update their documents"
  on public.documents
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their documents"
  on public.documents;
create policy "Users can delete their documents"
  on public.documents
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
