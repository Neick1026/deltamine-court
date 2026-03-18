-- Запусти это в Supabase → SQL Editor

create table cases (
  id          bigint primary key default extract(epoch from now())::bigint,
  plaintiff   text not null,
  defendant   text not null,
  case_type   text not null,
  description text not null,
  evidence    text,
  discord     text,
  status      text not null default 'pending',
  judge_nick  text,
  verdict     text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table judges (
  id       serial primary key,
  nick     text unique not null,
  password text not null
);

-- Разрешаем публичный доступ (anon key)
alter table cases  enable row level security;
alter table judges enable row level security;

create policy "read cases"   on cases  for select using (true);
create policy "insert cases" on cases  for insert with check (true);
create policy "update cases" on cases  for update using (true);
create policy "read judges"  on judges for select using (true);

-- Добавляем судей (замени пароли!)
insert into judges (nick, password) values
  ('! 𝐃 𝐀 𝐖 𝐈 𝐍 𝐂 𝐈 𝐊 !', 'dawincik123'),
  ('popcat6482',             'popcat123'),
  ('maksimsherks',           'maksim123');
