-- ============================================================
-- AI 다문화 동료 협력학습 — Supabase 스키마
-- 사용법: Supabase 콘솔 SQL Editor 에 전체 붙여넣고 실행
-- ============================================================

-- 확장
create extension if not exists "pgcrypto";

-- ───────────────── lessons (수업) ─────────────────
create table if not exists public.lessons (
  id              text primary key,
  title           text not null,
  topic           text not null,
  objective       text not null,
  persona_type    text not null check (persona_type in ('language','culture','belonging')),
  persona_name    text not null,
  created_at      timestamptz not null default now()
);

-- ───────────────── groups (모둠) ─────────────────
create table if not exists public.groups (
  id              text primary key,
  lesson_id       text not null references public.lessons(id) on delete cascade,
  name            text not null,
  capacity        integer not null default 4 check (capacity between 1 and 5),
  position        integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists groups_lesson_idx on public.groups(lesson_id, position);

-- ───────────────── members (학생 입장) ─────────────────
-- 학생은 먼저 lesson 에 입장(미배정 상태) → 교사가 모둠으로 배정
create table if not exists public.members (
  id              uuid primary key default gen_random_uuid(),
  lesson_id       text not null references public.lessons(id) on delete cascade,
  group_id        text references public.groups(id) on delete set null,
  student_name    text not null,
  joined_at       timestamptz not null default now(),
  unique (lesson_id, student_name)
);
create index if not exists members_lesson_idx on public.members(lesson_id);
create index if not exists members_group_idx on public.members(group_id);

-- ───────────────── messages (모둠 단위 채팅) ─────────────────
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  group_id        text not null references public.groups(id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  sender_name     text,
  content         text not null,
  created_at      timestamptz not null default now()
);
create index if not exists messages_group_idx on public.messages(group_id, created_at);

-- ───────────────── role_assignments (모둠 단위 역할 분담) ─────────────────
create table if not exists public.role_assignments (
  id              uuid primary key default gen_random_uuid(),
  group_id        text not null references public.groups(id) on delete cascade,
  student_name    text not null,
  role_name       text not null,
  memo            text not null default '',
  updated_at      timestamptz not null default now(),
  unique (group_id, student_name)
);
create index if not exists roles_group_idx on public.role_assignments(group_id);

-- ───────────────── activity_records (개인별 활동 기록) ─────────────────
create table if not exists public.activity_records (
  id              uuid primary key default gen_random_uuid(),
  group_id        text not null references public.groups(id) on delete cascade,
  student_name    text not null,
  ai_needs        text not null default '',
  ai_strengths    text not null default '',
  group_solution  text not null default '',
  ai_feedback     text not null default '',
  final_revision  text not null default '',
  updated_at      timestamptz not null default now(),
  unique (group_id, student_name)
);
create index if not exists activity_group_idx on public.activity_records(group_id);

-- ───────────────── reflections (개인별 성찰문) ─────────────────
create table if not exists public.reflections (
  id              uuid primary key default gen_random_uuid(),
  group_id        text not null references public.groups(id) on delete cascade,
  student_name    text not null,
  answers         jsonb not null,
  updated_at      timestamptz not null default now(),
  unique (group_id, student_name)
);
create index if not exists reflections_group_idx on public.reflections(group_id);

-- ============================================================
-- Realtime publication
-- 필요한 테이블만 publication 에 추가 (학생 화면 동기화 대상)
-- ============================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.role_assignments;
alter publication supabase_realtime add table public.members;
alter publication supabase_realtime add table public.activity_records;
alter publication supabase_realtime add table public.reflections;

-- ============================================================
-- Row Level Security
-- 시연·MVP 단계: anon 읽기 허용, 쓰기는 서버 사이드(service role)만 통과
-- 운영 전: 학생 식별 토큰 도입 후 정책 강화 필요
-- ============================================================
alter table public.lessons          enable row level security;
alter table public.groups           enable row level security;
alter table public.members          enable row level security;
alter table public.messages         enable row level security;
alter table public.role_assignments enable row level security;
alter table public.activity_records enable row level security;
alter table public.reflections      enable row level security;

-- 익명 클라이언트 = SELECT 만 허용
do $$
declare t text;
begin
  for t in select unnest(array[
    'lessons','groups','members','messages',
    'role_assignments','activity_records','reflections'
  ]) loop
    execute format(
      'drop policy if exists "anon_select_%1$s" on public.%1$I;', t
    );
    execute format(
      'create policy "anon_select_%1$s" on public.%1$I for select to anon using (true);', t
    );
  end loop;
end $$;

-- service_role 은 RLS 우회 (Supabase 기본 동작) — 별도 정책 불필요
