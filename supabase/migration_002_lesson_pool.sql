-- ============================================================
-- Migration 002 — 학생을 lesson 풀에 먼저 입장시킨 뒤 교사가 모둠 배정
-- 기존 schema.sql 을 한 번 실행하신 분만 이걸 SQL Editor 에 추가 실행
-- ============================================================

-- 1) members.group_id 를 nullable 로
alter table public.members
  alter column group_id drop not null;

-- 2) ON DELETE 동작 변경 (cascade → set null)
--    그룹 삭제 시 학생을 미배정 상태로 되돌리도록
alter table public.members
  drop constraint if exists members_group_id_fkey;
alter table public.members
  add constraint members_group_id_fkey
  foreign key (group_id) references public.groups(id) on delete set null;

-- 3) lesson_id 컬럼 추가 + 백필
alter table public.members
  add column if not exists lesson_id text;

update public.members m
set lesson_id = (select g.lesson_id from public.groups g where g.id = m.group_id)
where lesson_id is null and group_id is not null;

-- 4) lesson_id 를 NOT NULL + FK
alter table public.members
  alter column lesson_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'members_lesson_id_fkey'
  ) then
    alter table public.members
      add constraint members_lesson_id_fkey
      foreign key (lesson_id) references public.lessons(id) on delete cascade;
  end if;
end $$;

-- 5) 기존 unique(group_id, student_name) 제거 → unique(lesson_id, student_name)
do $$
declare cname text;
begin
  for cname in
    select conname from pg_constraint
    where conrelid = 'public.members'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%(group_id, student_name)%'
  loop
    execute format('alter table public.members drop constraint %I', cname);
  end loop;

  if not exists (
    select 1 from pg_constraint where conname = 'members_lesson_student_unique'
  ) then
    alter table public.members
      add constraint members_lesson_student_unique unique (lesson_id, student_name);
  end if;
end $$;

-- 6) 인덱스
create index if not exists members_lesson_idx on public.members(lesson_id);

-- 7) groups.capacity 상한 12 → 5
alter table public.groups
  drop constraint if exists groups_capacity_check;
alter table public.groups
  add constraint groups_capacity_check check (capacity between 1 and 5);

-- 8) 모둠별 페르소나 — 각 모둠이 서로 다른 AI 동료를 가질 수 있도록
alter table public.groups
  add column if not exists persona_type text;
alter table public.groups
  add column if not exists persona_name text;

-- 8a) 기존 행은 lesson 의 페르소나로 백필
update public.groups g
set persona_type = coalesce(g.persona_type, l.persona_type),
    persona_name = coalesce(g.persona_name, l.persona_name)
from public.lessons l
where l.id = g.lesson_id
  and (g.persona_type is null or g.persona_name is null);

-- 8b) NOT NULL + CHECK
alter table public.groups
  alter column persona_type set not null,
  alter column persona_name set not null;

alter table public.groups
  drop constraint if exists groups_persona_type_check;
alter table public.groups
  add constraint groups_persona_type_check
  check (persona_type in ('language','culture','belonging'));
