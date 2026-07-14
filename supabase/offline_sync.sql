-- Run this once after installing the offline-first synchronization update.
-- Supabase Dashboard -> SQL Editor -> New query -> Run.

alter table public.documents
  add column if not exists deleted_at timestamptz;

create index if not exists documents_user_deleted_index
  on public.documents (user_id, deleted_at, updated_at desc);

-- Existing Row Level Security policies continue to protect these rows.
-- Deleted documents are retained as soft-delete tombstones so another
-- offline device cannot accidentally restore an older copy.
