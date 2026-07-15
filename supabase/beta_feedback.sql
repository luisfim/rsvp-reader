-- RSVP Reader: public beta feedback collection
-- Run once in Supabase SQL Editor before publishing the feedback page.

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  category text not null,
  rating smallint null,
  message text not null,
  contact_email text null,
  include_diagnostics boolean not null default true,
  diagnostics jsonb null,
  page_path text not null default '/feedback',
  created_at timestamptz not null default now(),
  constraint beta_feedback_category_check
    check (category in ('bug', 'suggestion', 'usability', 'pdf', 'sync', 'other')),
  constraint beta_feedback_rating_check
    check (rating is null or rating between 1 and 5),
  constraint beta_feedback_message_length_check
    check (char_length(message) between 10 and 4000),
  constraint beta_feedback_contact_email_length_check
    check (contact_email is null or char_length(contact_email) <= 320),
  constraint beta_feedback_page_path_length_check
    check (char_length(page_path) between 1 and 300),
  constraint beta_feedback_diagnostics_size_check
    check (diagnostics is null or octet_length(diagnostics::text) <= 12000)
);

alter table public.beta_feedback enable row level security;

revoke all on table public.beta_feedback from anon, authenticated;
grant insert on table public.beta_feedback to anon, authenticated;

create policy "Visitors can submit beta feedback"
  on public.beta_feedback
  for insert
  to anon, authenticated
  with check (
    (user_id is null or user_id = auth.uid())
    and category in ('bug', 'suggestion', 'usability', 'pdf', 'sync', 'other')
    and (rating is null or rating between 1 and 5)
    and char_length(message) between 10 and 4000
    and (contact_email is null or char_length(contact_email) <= 320)
    and char_length(page_path) between 1 and 300
    and (diagnostics is null or octet_length(diagnostics::text) <= 12000)
  );

create index if not exists beta_feedback_created_at_idx
  on public.beta_feedback (created_at desc);

create index if not exists beta_feedback_category_created_at_idx
  on public.beta_feedback (category, created_at desc);

comment on table public.beta_feedback is
  'Private beta feedback queue. Client roles can insert but cannot read, update or delete rows.';
