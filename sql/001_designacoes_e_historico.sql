-- ============================================================================
--  MAPAS CONG — Designações, calibração do mapa e histórico de ciclos
--  Rode este arquivo UMA VEZ no SQL Editor do Supabase.
--  É seguro rodar de novo: tudo usa "if not exists".
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. RESPONSÁVEIS — os grupos e os dias que recebem território
-- ----------------------------------------------------------------------------
create table if not exists public.responsaveis (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  tipo        text not null default 'grupo' check (tipo in ('grupo', 'dia')),
  cor         text not null default '#0A4D3C',
  ordem       integer not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
-- 2. DESIGNAÇÕES — quem está com qual território, desde quando
--    O nome do responsável e do território ficam copiados aqui de propósito:
--    assim o relatório antigo continua legível mesmo se um grupo for renomeado
--    ou apagado depois.
-- ----------------------------------------------------------------------------
create table if not exists public.designacoes (
  id                uuid primary key default gen_random_uuid(),
  territorio_id     uuid not null references public.territorios(id) on delete cascade,
  responsavel_id    uuid references public.responsaveis(id) on delete set null,
  territorio_nome   text not null,
  responsavel_nome  text not null,
  responsavel_cor   text,
  data_designacao   date not null default current_date,
  data_devolucao    date,
  observacao        text,
  created_at        timestamptz not null default now()
);

create index if not exists designacoes_territorio_idx  on public.designacoes (territorio_id);
create index if not exists designacoes_abertas_idx     on public.designacoes (data_devolucao) where data_devolucao is null;

-- Um território só pode estar designado para um responsável por vez.
create unique index if not exists designacoes_uma_aberta_por_territorio
  on public.designacoes (territorio_id) where data_devolucao is null;


-- ----------------------------------------------------------------------------
-- 3. TERRITORIO_MAPA — onde fica cada território na imagem do mapa
--    Guardado em PORCENTAGEM (0 a 100) da largura/altura da imagem, para
--    funcionar igual no celular e no computador.
-- ----------------------------------------------------------------------------
create table if not exists public.territorio_mapa (
  territorio_id uuid primary key references public.territorios(id) on delete cascade,
  x numeric not null,
  y numeric not null,
  w numeric not null,
  h numeric not null,
  atualizado_em timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
-- 4. CICLOS — cada reset do mapa fecha um ciclo e vira um relatório
-- ----------------------------------------------------------------------------
create table if not exists public.ciclos (
  id                 uuid primary key default gen_random_uuid(),
  nome               text,
  data_inicio        date,
  data_reset         timestamptz not null default now(),
  total_casas        integer not null default 0,
  total_falados      integer not null default 0,
  total_cartas       integer not null default 0,
  total_nao_falados  integer not null default 0,
  total_bloqueados   integer not null default 0,
  observacao         text
);


-- ----------------------------------------------------------------------------
-- 5. HISTORICO_CASAS — a foto de cada casa no momento em que o ciclo fechou.
--    É isto que responde "quais casas nunca são faladas".
-- ----------------------------------------------------------------------------
create table if not exists public.historico_casas (
  id               uuid primary key default gen_random_uuid(),
  ciclo_id         uuid not null references public.ciclos(id) on delete cascade,
  endereco_id      uuid,
  territorio_nome  text,
  quadra_nome      text,
  rua              text,
  numero           text,
  status           text,
  falado           boolean not null default false,
  data_visita      date
);

create index if not exists historico_casas_ciclo_idx    on public.historico_casas (ciclo_id);
create index if not exists historico_casas_endereco_idx on public.historico_casas (endereco_id);


-- ----------------------------------------------------------------------------
-- 6. VIEW — ranking das casas que mais passam batido
--    Uma linha por casa, com quantos ciclos ela participou e em quantos
--    ninguém conseguiu falar.
-- ----------------------------------------------------------------------------
create or replace view public.casas_nunca_faladas as
select
  h.endereco_id,
  max(h.territorio_nome)                              as territorio_nome,
  max(h.quadra_nome)                                  as quadra_nome,
  max(h.rua)                                          as rua,
  max(h.numero)                                       as numero,
  count(*)                                            as ciclos_registrados,
  count(*) filter (where h.falado)                    as ciclos_falados,
  count(*) filter (where not h.falado)                as ciclos_sem_falar,
  round(100.0 * count(*) filter (where not h.falado) / nullif(count(*), 0), 0) as pct_sem_falar,
  max(h.data_visita)                                  as ultima_vez_falado
from public.historico_casas h
where h.endereco_id is not null
group by h.endereco_id;


-- ----------------------------------------------------------------------------
-- 7. PERMISSÕES
--    O app hoje acessa o Supabase só com a chave anônima, então as tabelas
--    novas seguem o mesmo modelo das antigas para o app funcionar.
--    ATENÇÃO: isso deixa os dados legíveis por qualquer um que tenha a chave
--    anônima (que fica exposta no navegador). Veja a nota no fim do arquivo.
-- ----------------------------------------------------------------------------
alter table public.responsaveis     enable row level security;
alter table public.designacoes      enable row level security;
alter table public.territorio_mapa  enable row level security;
alter table public.ciclos           enable row level security;
alter table public.historico_casas  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['responsaveis','designacoes','territorio_mapa','ciclos','historico_casas']
  loop
    execute format('drop policy if exists "acesso_total_anon" on public.%I', t);
    execute format(
      'create policy "acesso_total_anon" on public.%I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;


-- A view não herda as permissões das tabelas, então precisa de acesso próprio.
grant select on public.casas_nunca_faladas to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 8. DADOS INICIAIS — os 7 grupos e os dias de reunião
--    Só insere se a tabela ainda estiver vazia.
-- ----------------------------------------------------------------------------
insert into public.responsaveis (nome, tipo, cor, ordem)
select * from (values
  ('Grupo 1',      'grupo', '#DC2626',  1),
  ('Grupo 2',      'grupo', '#EA580C',  2),
  ('Grupo 3',      'grupo', '#CA8A04',  3),
  ('Grupo 4',      'grupo', '#16A34A',  4),
  ('Grupo 5',      'grupo', '#0891B2',  5),
  ('Grupo 6',      'grupo', '#2563EB',  6),
  ('Grupo 7',      'grupo', '#7C3AED',  7),
  ('Segunda',      'dia',   '#BE185D',  8),
  ('Terça',        'dia',   '#9D174D',  9),
  ('Quarta',       'dia',   '#065F46', 10),
  ('Quinta',       'dia',   '#1E40AF', 11),
  ('Sexta manhã',  'dia',   '#B45309', 12),
  ('Sexta tarde',  'dia',   '#7E22CE', 13),
  ('Sábado',       'dia',   '#0F766E', 14)
) as v(nome, tipo, cor, ordem)
where not exists (select 1 from public.responsaveis);


-- ============================================================================
--  NOTA DE SEGURANÇA (importante, mas não bloqueia o uso do sistema)
--
--  A tabela "usuarios" guarda a senha em texto puro e é legível com a chave
--  anônima, que fica visível no navegador. Na prática, qualquer pessoa com o
--  endereço do site consegue ler login e senha de todos os usuários.
--  As tabelas criadas aqui apenas seguem o padrão que já existia — elas não
--  pioram nem melhoram isso. Vale tratar esse ponto separado.
-- ============================================================================
