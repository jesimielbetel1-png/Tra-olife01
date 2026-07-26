-- =====================================================================
--  ESCALA ADVEC VITÓRIA — Esquema do banco (Supabase / PostgreSQL)
--  Rode este arquivo em: Supabase -> SQL Editor -> New query -> Run
--  Cria tabelas, regras de segurança (RLS) e o gatilho de cadastro.
-- =====================================================================

-- ---------- EXTENSÕES ----------
create extension if not exists "pgcrypto";

-- =====================================================================
--  1. OBREIROS  (1 linha por conta; o id é o mesmo do usuário de login)
-- =====================================================================
create table if not exists public.obreiros (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            text unique,
  nome             text not null default '',
  sexo             char(1) check (sexo in ('M','F')),           -- definido pela liderança
  ativo            boolean not null default false,               -- nasce INATIVO
  is_admin         boolean not null default false,               -- liderança
  prioridade       text not null default 'NORMAL'
                     check (prioridade in ('ALTA','NORMAL','BAIXA')),
  telegram_chat_id text,                                         -- vínculo do bot
  telegram_token   text,                                         -- token temporário de vínculo
  obs              text default '',
  criado_em        timestamptz not null default now()
);

-- =====================================================================
--  2. APTIDÕES  (posições que o obreiro pode assumir — CONFIDENCIAL)
--     Só a liderança lê/escreve. O obreiro nunca vê.
-- =====================================================================
create table if not exists public.aptidoes (
  obreiro_id uuid not null references public.obreiros(id) on delete cascade,
  posicao    text not null,           -- A1a, A1b, A1c, A2, A3, M1..M4, P1, P2, E1, E2, RECEPCAO
  primary key (obreiro_id, posicao)
);

-- =====================================================================
--  3. DISPONIBILIDADE  (1 linha por obreiro por semana)
--     semana = data do DOMINGO da semana (YYYY-MM-DD)
-- =====================================================================
create table if not exists public.disponibilidades (
  obreiro_id  uuid not null references public.obreiros(id) on delete cascade,
  semana      date not null,
  dom_manha   boolean not null default false,
  dom_noite   boolean not null default false,
  terca       boolean not null default false,   -- Culto da Palavra / Ceia
  quinta      boolean not null default false,   -- Culto da Vitória
  obs         text default '',
  enviado_em  timestamptz not null default now(),
  primary key (obreiro_id, semana)
);

-- =====================================================================
--  4. ESCALAS  (uma por semana) + ITENS (cada posição atribuída)
-- =====================================================================
create table if not exists public.escalas (
  id         uuid primary key default gen_random_uuid(),
  semana     date not null unique,
  status     text not null default 'rascunho'      -- rascunho | publicada
               check (status in ('rascunho','publicada')),
  criado_em  timestamptz not null default now()
);

create table if not exists public.escala_itens (
  id          uuid primary key default gen_random_uuid(),
  escala_id   uuid not null references public.escalas(id) on delete cascade,
  culto       text not null,           -- DOM_M, DOM_N, PALAVRA, VITORIA, CEIA...
  data        date not null,
  posicao     text not null,           -- A1a... ou RECEPCAO / APOIO
  obreiro_id  uuid references public.obreiros(id) on delete set null
);
create index if not exists idx_itens_escala on public.escala_itens(escala_id);

-- =====================================================================
--  5. PRESENÇA / FREQUÊNCIA  (marcada pela liderança após o culto)
-- =====================================================================
create table if not exists public.presencas (
  item_id     uuid primary key references public.escala_itens(id) on delete cascade,
  presente    boolean,                 -- null = ainda não marcado
  marcado_por uuid references public.obreiros(id),
  marcado_em  timestamptz default now()
);

-- =====================================================================
--  6. MATRIZ DE QUANTIDADE  (quantos por posição em cada culto)
--     Uma linha por posição; qtd por tipo de culto.
-- =====================================================================
create table if not exists public.matriz_quantidade (
  posicao     text primary key,
  categoria   text not null,
  qtd_padrao  int not null default 1,
  ordem       int not null default 0
);

insert into public.matriz_quantidade (posicao, categoria, qtd_padrao, ordem) values
  ('A1a','Altar',1,1),('A1b','Altar',1,2),('A1c','Altar',1,3),
  ('A2','Altar',1,4),('A3','Altar',1,5),
  ('M1','Microfone',1,6),('M2','Microfone',1,7),('M3','Microfone',1,8),('M4','Microfone',1,9),
  ('P1','Porta',1,10),('P2','Porta',1,11),
  ('E1','Entrada',1,12),('E2','Entrada',1,13),
  ('RECEPCAO','Recepção',6,14)
on conflict (posicao) do nothing;

-- =====================================================================
--  GATILHO: toda conta nova de login vira um obreiro INATIVO
--  (assim ninguém entra na escala sem a liderança aprovar)
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.obreiros (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
--  FUNÇÃO AUXILIAR: sou admin?  (usada nas policies, evita recursão)
-- =====================================================================
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select is_admin from public.obreiros where id = auth.uid()), false);
$$;

-- =====================================================================
--  ROW LEVEL SECURITY
-- =====================================================================
alter table public.obreiros          enable row level security;
alter table public.aptidoes          enable row level security;
alter table public.disponibilidades  enable row level security;
alter table public.escalas           enable row level security;
alter table public.escala_itens      enable row level security;
alter table public.presencas         enable row level security;
alter table public.matriz_quantidade enable row level security;

-- ----- OBREIROS -----
-- Cada um lê a própria linha; admin lê todas.
drop policy if exists obreiros_select on public.obreiros;
create policy obreiros_select on public.obreiros for select
  using (id = auth.uid() or public.is_admin());

-- Cada um atualiza só campos "seus" (nome/telegram); admin atualiza tudo.
drop policy if exists obreiros_update_self on public.obreiros;
create policy obreiros_update_self on public.obreiros for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists obreiros_update_admin on public.obreiros;
create policy obreiros_update_admin on public.obreiros for update
  using (public.is_admin()) with check (public.is_admin());

-- ----- APTIDÕES (confidencial: só admin) -----
drop policy if exists aptidoes_admin on public.aptidoes;
create policy aptidoes_admin on public.aptidoes for all
  using (public.is_admin()) with check (public.is_admin());

-- ----- DISPONIBILIDADES -----
-- Obreiro lê/grava a própria; admin lê todas.
drop policy if exists disp_select on public.disponibilidades;
create policy disp_select on public.disponibilidades for select
  using (obreiro_id = auth.uid() or public.is_admin());

drop policy if exists disp_write on public.disponibilidades;
create policy disp_write on public.disponibilidades for all
  using (obreiro_id = auth.uid() or public.is_admin())
  with check (obreiro_id = auth.uid() or public.is_admin());

-- ----- ESCALAS / ITENS (todo obreiro ativo vê a escala publicada; admin edita) -----
drop policy if exists escalas_select on public.escalas;
create policy escalas_select on public.escalas for select using (true);
drop policy if exists escalas_admin on public.escalas;
create policy escalas_admin on public.escalas for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists itens_select on public.escala_itens;
create policy itens_select on public.escala_itens for select using (true);
drop policy if exists itens_admin on public.escala_itens;
create policy itens_admin on public.escala_itens for all
  using (public.is_admin()) with check (public.is_admin());

-- ----- PRESENÇAS (só admin marca; todos leem) -----
drop policy if exists presencas_select on public.presencas;
create policy presencas_select on public.presencas for select using (true);
drop policy if exists presencas_admin on public.presencas;
create policy presencas_admin on public.presencas for all
  using (public.is_admin()) with check (public.is_admin());

-- ----- MATRIZ (todos leem; admin edita) -----
drop policy if exists matriz_select on public.matriz_quantidade;
create policy matriz_select on public.matriz_quantidade for select using (true);
drop policy if exists matriz_admin on public.matriz_quantidade;
create policy matriz_admin on public.matriz_quantidade for all
  using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
--  PRONTO.
--  Depois de entrar a 1ª vez no site com seu e-mail, vire admin com:
--
--    update public.obreiros
--       set is_admin = true, ativo = true, nome = 'Jesimiel Barros', sexo = 'M'
--     where email = 'SEU-EMAIL@exemplo.com';
-- =====================================================================
