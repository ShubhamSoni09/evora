-- evora Supabase schema
-- Run in Supabase Dashboard → SQL Editor → New query → Run

-- Messages (patient ↔ evora conversation)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id text not null default 'margaret',
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists messages_session_sort_idx
  on public.messages (session_id, sort_order);

-- Family notes + memory anchors
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  session_id text not null default 'margaret',
  type text not null check (type in ('family', 'voice', 'music', 'story', 'routine')),
  label text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists memories_session_idx
  on public.memories (session_id, created_at);

-- Caregiver alerts (escalations)
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  session_id text not null default 'margaret',
  severity text not null check (severity in ('low', 'medium', 'high')),
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists alerts_session_idx
  on public.alerts (session_id, created_at desc);

-- Demo seed (only if empty)
insert into public.memories (session_id, type, label, content)
select 'margaret', v.type, v.label, v.content
from (values
  ('voice'::text, 'Sarah''s voice message', 'Hi Mom, I''ll talk to you tonight. I love you so much.'),
  ('family'::text, 'Note from Sarah', 'Hi Mom, Tom and the kids say hello. We''re thinking of you today and we''ll call this evening. Love you always.'),
  ('music'::text, 'Evening music', 'Moon River — your favourite song from the 1960s.'),
  ('story'::text, 'Rose garden', 'You and Harold tended the rose garden every Sunday morning for 30 years.'),
  ('routine'::text, 'Morning routine', 'Wake up, chamomile tea, read the newspaper by the window.'),
  ('story'::text, 'Christmas 2023', 'Sarah, Tom, and the grandchildren visited. Everyone wore matching sweaters.')
) as v(type, label, content)
where not exists (select 1 from public.memories where session_id = 'margaret' limit 1);

-- Optional: enable RLS later for multi-tenant production
-- alter table public.messages enable row level security;
-- alter table public.memories enable row level security;
-- alter table public.alerts enable row level security;

-- Ephemeral phone/TTS sessions (required for two-way Twilio on serverless)
create table if not exists public.phone_sessions (
  id text primary key,
  role text not null check (role in ('patient', 'caregiver')),
  messages jsonb not null default '[]',
  opener_parts jsonb not null default '[]',
  turn_count int not null default 0,
  reprompts int not null default 0,
  max_turns int not null default 8,
  webhook_base text,
  expires_at timestamptz not null
);

create index if not exists phone_sessions_expires_idx
  on public.phone_sessions (expires_at);

create table if not exists public.tts_sessions (
  id text primary key,
  parts jsonb not null default '[]',
  expires_at timestamptz not null
);

create index if not exists tts_sessions_expires_idx
  on public.tts_sessions (expires_at);
