-- ============================================================================
--  MAPAS CONG — Aba "Gerenciamento"
--  Rode este arquivo UMA VEZ no SQL Editor do Supabase, depois do 001.
--  É seguro rodar de novo: tudo usa "if not exists".
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. RESPONSÁVEIS ganham nome de gente e dia fixo
--
--    Hoje os responsáveis do tipo "dia" se chamam "Segunda", "Terça"...
--    Na grade de gerenciamento o dia da semana virou COLUNA, então o nome
--    precisa ser o de quem dirige (Adalto, Cláudio, Odete) e o dia vira um
--    campo separado. Quem é grupo continua sem dia fixo (dia_semana nulo).
--
--    0 = domingo, 1 = segunda, ... 6 = sábado (igual ao JavaScript).
-- ----------------------------------------------------------------------------
alter table public.responsaveis
  add column if not exists dia_semana smallint
  check (dia_semana is null or (dia_semana between 0 and 6));


-- Preenche o dia de quem já está cadastrado com nome de dia, uma única vez.
-- O nome NÃO é alterado aqui de propósito: quem troca "Segunda" por "Adalto"
-- é você, pelo botão Responsáveis dentro da aba Gerenciamento.
update public.responsaveis set dia_semana = 1 where dia_semana is null and nome ilike 'segunda%';
update public.responsaveis set dia_semana = 2 where dia_semana is null and nome ilike 'ter_a%';
update public.responsaveis set dia_semana = 3 where dia_semana is null and nome ilike 'quarta%';
update public.responsaveis set dia_semana = 4 where dia_semana is null and nome ilike 'quinta%';
update public.responsaveis set dia_semana = 5 where dia_semana is null and nome ilike 'sexta%';
update public.responsaveis set dia_semana = 6 where dia_semana is null and nome ilike 's_bado%';
update public.responsaveis set dia_semana = 0 where dia_semana is null and nome ilike 'domingo%';


-- ----------------------------------------------------------------------------
-- 2. TRABALHOS — o registro de "fulano trabalhou nesta quadra neste dia"
--
--    Por que uma tabela nova e não reaproveitar "designacoes"?
--    São duas coisas diferentes:
--
--      designacoes -> o território está NA MÃO de alguém (sai e volta).
--                     Só um responsável por vez.
--      trabalhos   -> quem foi a campo naquela quadra naquele dia.
--                     Vários no mesmo território, na mesma semana.
--
--    A grade do gerenciamento mostra "trabalhos". Quando você designa um
--    território no mapa, o sistema cria automaticamente um trabalho para cada
--    quadra dele — por isso a grade se atualiza sozinha.
--
--    Os nomes ficam copiados aqui de propósito, igual em "designacoes": assim
--    a grade antiga continua legível se um grupo for renomeado ou apagado.
-- ----------------------------------------------------------------------------
create table if not exists public.trabalhos (
  id               uuid primary key default gen_random_uuid(),
  territorio_id    uuid not null references public.territorios(id)  on delete cascade,
  quadra_id        uuid not null references public.quadras(id)      on delete cascade,
  responsavel_id   uuid          references public.responsaveis(id) on delete set null,
  designacao_id    uuid          references public.designacoes(id)  on delete cascade,
  territorio_nome  text not null,
  quadra_nome      text not null,
  responsavel_nome text not null,
  responsavel_cor  text,
  data             date not null default current_date,
  observacao       text,
  created_at       timestamptz not null default now()
);

create index if not exists trabalhos_quadra_idx     on public.trabalhos (quadra_id, data);
create index if not exists trabalhos_territorio_idx on public.trabalhos (territorio_id, data);
create index if not exists trabalhos_data_idx       on public.trabalhos (data);

-- A mesma pessoa não registra duas vezes a mesma quadra no mesmo dia.
-- É isto que deixa o sistema reenviar um registro sem criar linha repetida.
create unique index if not exists trabalhos_sem_repetir
  on public.trabalhos (quadra_id, responsavel_id, data);


-- ----------------------------------------------------------------------------
-- 3. PERMISSÕES — mesmo modelo das outras tabelas do projeto
--    (veja a nota de segurança no fim do arquivo 001)
-- ----------------------------------------------------------------------------
alter table public.trabalhos enable row level security;

drop policy if exists "acesso_total_anon" on public.trabalhos;
create policy "acesso_total_anon" on public.trabalhos
  for all to anon, authenticated using (true) with check (true);
