"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { numeroDoTerritorio } from '@/lib/mapaTerritorios';
import {
  Loader2, Plus, X, Users, Trash2, Save, CalendarDays, Pencil, Layers,
} from 'lucide-react';

// ---------------------------------------------------------------------- tipos
type Territorio  = { id: string; nome: string };
type Quadra      = { id: string; nome: string; territorio_id: string };
type Responsavel = {
  id: string; nome: string; tipo: 'grupo' | 'dia'; cor: string;
  ordem: number; ativo: boolean; dia_semana: number | null;
};
type Trabalho = {
  id: string;
  territorio_id: string; quadra_id: string; responsavel_id: string | null;
  territorio_nome: string; quadra_nome: string;
  responsavel_nome: string; responsavel_cor: string | null;
  data: string; observacao: string | null;
};
type Progresso = { total: number; completos: number };

// --------------------------------------------------------------------- datas
// A grade é montada de segunda a domingo. No JavaScript o domingo é 0, então
// todo lugar que fala de "coluna" usa 0 = segunda ... 6 = domingo.
const DIAS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];

// O verde da casa, o mesmo dos botões e das outras telas do painel.
const VERDE = '#0A4D3C';

const NOMES_DIA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const isoHoje = () => new Date().toISOString().split('T')[0];

const somarDias = (iso: string, dias: number) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
};

// A segunda-feira da semana daquela data — é a chave que agrupa uma linha.
const segundaDaSemana = (iso: string) => {
  const d = new Date(iso + 'T12:00:00');
  const dow = d.getDay();
  return somarDias(iso, dow === 0 ? -6 : 1 - dow);
};

// 0 = segunda ... 6 = domingo
const colunaDoDia = (iso: string) => {
  const dow = new Date(iso + 'T12:00:00').getDay();
  return dow === 0 ? 6 : dow - 1;
};

const formatarDia = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

const formatarMes = (ym: string) => {
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const [a, m] = ym.split('-');
  return `${meses[Number(m) - 1]} de ${a}`;
};

// No celular não cabe "Quadra 07" inteiro na coluna fixa; vira "Q07".
const nomeCurto = (nome: string) => String(nome ?? '').replace(/^quadra\s*/i, 'Q');

// "Quadra 07" -> 7. Serve só para ordenar na tela.
const numeroDe = (nome: string) => {
  const m = String(nome ?? '').match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
};

// ------------------------------------------------------------------- % anel
// Anel fino com a porcentagem no meio. Serve de âncora visual do território.
function Anel({ pct, tamanho = 42, espessura = 3.5 }: { pct: number; tamanho?: number; espessura?: number }) {
  const p = Math.min(100, Math.max(0, pct));
  const r = (tamanho - espessura) / 2;
  const volta = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} className="-rotate-90 block">
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none"
          stroke={VERDE} strokeOpacity={0.14} strokeWidth={espessura} />
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none"
          stroke={VERDE} strokeWidth={espessura} strokeLinecap="round"
          strokeDasharray={volta} strokeDashoffset={volta * (1 - p / 100)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums"
        style={{ color: VERDE }}>
        {p}%
      </span>
    </div>
  );
}

// ============================================================================
// onResponsaveisMudaram: o mapa carrega a lista de responsáveis uma vez só.
// Sem este aviso, um responsável criado aqui só apareceria lá depois de
// recarregar a página inteira.
export default function Gerenciamento({
  onResponsaveisMudaram,
}: {
  onResponsaveisMudaram?: () => void;
}) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [territorios, setTerritorios]   = useState<Territorio[]>([]);
  const [quadras, setQuadras]           = useState<Quadra[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [trabalhos, setTrabalhos]       = useState<Trabalho[]>([]);
  const [progresso, setProgresso]       = useState<Record<string, Progresso>>({});
  const [inicioCiclo, setInicioCiclo]   = useState<string | null>(null);

  // 'ciclo' = tudo desde o último reset. Senão, um mês no formato AAAA-MM.
  const [periodo, setPeriodo] = useState<string>('ciclo');

  const [celula, setCelula]           = useState<{ quadra: Quadra; data: string } | null>(null);
  const [terrAberto, setTerrAberto]   = useState<Territorio | null>(null);
  const [dataTerr, setDataTerr]       = useState(isoHoje());
  const [painelResp, setPainelResp]   = useState(false);

  // ------------------------------------------------------------- carregar
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const [rTerr, rQuad, rResp, rTrab, rCiclo] = await Promise.all([
      supabase.from('territorios').select('id, nome'),
      supabase.from('quadras').select('id, nome, territorio_id'),
      supabase.from('responsaveis').select('*').order('ordem'),
      supabase.from('trabalhos').select('*').order('data'),
      supabase.from('ciclos').select('data_reset').order('data_reset', { ascending: false }).limit(1),
    ]);

    const falhou = rTerr.error || rQuad.error || rResp.error || rTrab.error;
    if (falhou) { setErro(falhou.message); setCarregando(false); return; }

    setTerritorios(((rTerr.data ?? []) as Territorio[])
      .sort((a, b) => (numeroDoTerritorio(a.nome) ?? '').localeCompare(numeroDoTerritorio(b.nome) ?? '')));
    setQuadras(((rQuad.data ?? []) as Quadra[]).sort((a, b) => numeroDe(a.nome) - numeroDe(b.nome)));
    // Enquanto o SQL 002 não roda, a coluna dia_semana nem existe e chega como
    // undefined. Normaliza aqui para o resto da tela não precisar saber disso.
    setResponsaveis(((rResp.data ?? []) as Responsavel[])
      .map(r => ({ ...r, dia_semana: r.dia_semana ?? null })));
    setTrabalhos((rTrab.data ?? []) as Trabalho[]);
    setInicioCiclo(rCiclo.data?.[0]?.data_reset?.split('T')[0] ?? null);

    // As porcentagens saem das casas. Só três colunas, mas são milhares de
    // linhas — o Supabase devolve no máximo 1000 por vez, então vai por página.
    const casas: { quadra_id: string; status: string; is_bloqueado: unknown }[] = [];
    for (let pag = 0; pag < 50; pag++) {
      const { data, error } = await supabase
        .from('enderecos')
        .select('quadra_id, status, is_bloqueado')
        .order('id')
        .range(pag * 1000, (pag + 1) * 1000 - 1);
      if (error) { setErro(error.message); break; }
      if (!data?.length) break;
      casas.push(...(data as typeof casas));
      if (data.length < 1000) break;
    }

    // Mesma conta que a aba "Visão Geral" já usa: casa bloqueada conta como
    // resolvida, para a quadra conseguir fechar em 100%.
    const prog: Record<string, Progresso> = {};
    casas.forEach(c => {
      if (!c.quadra_id) return;
      const s = String(c.status).toLowerCase();
      const bloqueada = s === 'bloqueado' || c.is_bloqueado === true || String(c.is_bloqueado).toLowerCase() === 'true';
      const resolvida = bloqueada || s === 'falado' || s === 'true' || s === 'cartas';
      const p = prog[c.quadra_id] ?? (prog[c.quadra_id] = { total: 0, completos: 0 });
      p.total++;
      if (resolvida) p.completos++;
    });
    setProgresso(prog);

    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // ------------------------------------------------------------- derivados
  const ativos = useMemo(() => responsaveis.filter(r => r.ativo), [responsaveis]);

  const trabalhosDoCiclo = useMemo(
    () => (inicioCiclo ? trabalhos.filter(t => t.data >= inicioCiclo) : trabalhos),
    [trabalhos, inicioCiclo],
  );

  const mesesDisponiveis = useMemo(() => {
    const set = new Set(trabalhosDoCiclo.map(t => t.data.slice(0, 7)));
    return [...set].sort().reverse();
  }, [trabalhosDoCiclo]);

  const visiveis = useMemo(
    () => (periodo === 'ciclo' ? trabalhosDoCiclo : trabalhosDoCiclo.filter(t => t.data.startsWith(periodo))),
    [trabalhosDoCiclo, periodo],
  );

  // Onde cai a linha em branco de uma quadra que ainda não foi trabalhada.
  const semanaPadrao = useMemo(
    () => segundaDaSemana(periodo === 'ciclo' ? isoHoje() : `${periodo}-01`),
    [periodo],
  );

  const pctDaQuadra = (id: string) => {
    const p = progresso[id];
    return p && p.total > 0 ? Math.round((p.completos / p.total) * 100) : 0;
  };

  const pctDoTerritorio = (territorioId: string) => {
    let total = 0, completos = 0;
    quadras.filter(q => q.territorio_id === territorioId).forEach(q => {
      const p = progresso[q.id];
      if (p) { total += p.total; completos += p.completos; }
    });
    return total > 0 ? Math.round((completos / total) * 100) : 0;
  };

  // Resumo do período — dá contexto antes de a pessoa ler a grade linha a linha.
  const resumo = useMemo(() => {
    let total = 0, completos = 0;
    Object.values(progresso).forEach(p => { total += p.total; completos += p.completos; });
    return {
      registros: visiveis.length,
      quadrasTrabalhadas: new Set(visiveis.map(w => w.quadra_id)).size,
      quadrasTotal: quadras.length,
      pctGeral: total > 0 ? Math.round((completos / total) * 100) : 0,
    };
  }, [visiveis, progresso, quadras]);

  // Coluna do dia de hoje (0 = segunda). Serve só para destacar na grade.
  const colunaHoje = colunaDoDia(isoHoje());
  const semanaDeHoje = segundaDaSemana(isoHoje());

  // A grade inteira, já montada: território > quadra > uma linha por semana.
  const grade = useMemo(() => {
    return territorios.map(t => {
      const suasQuadras = quadras.filter(q => q.territorio_id === t.id);

      const linhasPorQuadra = suasQuadras.map(q => {
        const daQuadra = visiveis.filter(w => w.quadra_id === q.id);
        const semanas = [...new Set(daQuadra.map(w => segundaDaSemana(w.data)))].sort();
        // Quadra sem nenhum trabalho ainda aparece com uma linha vazia.
        const chaves = semanas.length ? semanas : [semanaPadrao];

        return {
          quadra: q,
          linhas: chaves.map(semana => ({
            semana,
            dias: Array.from({ length: 7 }, (_, col) =>
              daQuadra.filter(w => segundaDaSemana(w.data) === semana && colunaDoDia(w.data) === col)),
          })),
        };
      });

      return {
        territorio: t,
        quadras: linhasPorQuadra,
        alturaTotal: linhasPorQuadra.reduce((s, q) => s + q.linhas.length, 0) || 1,
      };
    });
  }, [territorios, quadras, visiveis, semanaPadrao]);

  // --------------------------------------------------------------- ações
  const linhasDeTrabalho = (quadrasAlvo: Quadra[], resp: Responsavel, data: string) =>
    quadrasAlvo.map(q => ({
      territorio_id: q.territorio_id,
      quadra_id: q.id,
      responsavel_id: resp.id,
      territorio_nome: territorios.find(t => t.id === q.territorio_id)?.nome ?? '',
      quadra_nome: q.nome,
      responsavel_nome: resp.nome,
      responsavel_cor: resp.cor,
      data,
    }));

  const registrar = async (quadrasAlvo: Quadra[], resp: Responsavel, data: string) => {
    if (!quadrasAlvo.length) { alert('Este território ainda não tem quadras cadastradas.'); return; }
    setSalvando(true);

    // ignoreDuplicates: clicar duas vezes no mesmo responsável e dia não cria
    // linha repetida — o índice único do banco cuida disso.
    const { error } = await supabase
      .from('trabalhos')
      .upsert(linhasDeTrabalho(quadrasAlvo, resp, data), {
        onConflict: 'quadra_id,responsavel_id,data',
        ignoreDuplicates: true,
      });

    setSalvando(false);
    if (error) { alert('Erro ao registrar: ' + error.message); return; }

    setCelula(null);
    setTerrAberto(null);
    carregar();
  };

  const remover = async (t: Trabalho) => {
    if (!window.confirm(`Apagar o registro de ${t.responsavel_nome} na ${t.quadra_nome} em ${formatarDia(t.data)}?`)) return;
    const { error } = await supabase.from('trabalhos').delete().eq('id', t.id);
    if (error) { alert('Erro ao apagar: ' + error.message); return; }
    carregar();
  };

  // ------------------------------------------------------------ telas base
  if (carregando) {
    return (
      <div className="bg-white rounded-3xl p-10 shadow-sm border border-gray-100 flex flex-col items-center gap-3">
        <Loader2 className="animate-spin text-gray-400" size={28} />
        <p className="text-gray-500 font-medium text-sm">Montando a grade...</p>
      </div>
    );
  }

  if (erro) {
    const faltaTabela = /relation .* does not exist|schema cache|Could not find the table|column .* does not exist/i.test(erro);
    return (
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-red-100">
        <h3 className="font-bold text-lg text-red-600 mb-2">
          {faltaTabela ? 'Falta criar a tabela de trabalhos' : 'Erro ao carregar'}
        </h3>
        {faltaTabela ? (
          <div className="text-sm text-slate-600 leading-relaxed space-y-3">
            <p>A aba Gerenciamento precisa de uma tabela nova. É um passo único:</p>
            <ol className="list-decimal pl-5 space-y-1.5 font-medium">
              <li>Abra o painel do Supabase e vá em <strong>SQL Editor</strong>.</li>
              <li>Abra o arquivo <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">sql/002_gerenciamento.sql</code> do projeto.</li>
              <li>Cole todo o conteúdo dele lá e clique em <strong>Run</strong>.</li>
              <li>Volte aqui e atualize a página.</li>
            </ol>
          </div>
        ) : (
          <p className="text-sm text-slate-600">{erro}</p>
        )}
        <button onClick={carregar} className="mt-5 bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold active:scale-95 transition">
          Tentar de novo
        </button>
      </div>
    );
  }

  const quadrasDoTerrAberto = terrAberto ? quadras.filter(q => q.territorio_id === terrAberto.id) : [];
  const trabalhosDaCelula = celula
    ? visiveis.filter(w => w.quadra_id === celula.quadra.id && w.data === celula.data)
    : [];

  // =========================================================== a tela toda
  const CELULA_VAZIA = 'h-9';

  return (
    <div className="flex flex-col gap-4">

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">

        {/* ------------------------------------------------------- CABEÇALHO */}
        <div className="px-5 sm:px-6 pt-5 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[17px] font-bold text-slate-800 tracking-tight">Grade de trabalho</h3>
              <p className="text-xs text-gray-400 mt-1">
                Uma linha por semana. Toque numa célula para registrar quem trabalhou.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={periodo}
                onChange={e => setPeriodo(e.target.value)}
                className="bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-slate-600 outline-none hover:border-gray-300 focus:border-[#0A4D3C] transition cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
              >
                <option value="ciclo">Ciclo atual</option>
                {mesesDisponiveis.map(m => (
                  <option key={m} value={m}>{formatarMes(m)}</option>
                ))}
              </select>

              <button
                onClick={() => setPainelResp(true)}
                className="bg-white border border-gray-200 text-slate-600 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:border-[#0A4D3C] hover:text-[#0A4D3C] transition active:scale-95 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
              >
                <Users size={14} /> Responsáveis
              </button>
            </div>
          </div>

          {/* Três números que dão o contexto antes de ler a grade. */}
          <div className="mt-4 flex items-stretch rounded-2xl bg-[#0A4D3C]/[0.035] border border-[#0A4D3C]/[0.07] overflow-hidden">
            {([
              [resumo.registros, resumo.registros === 1 ? 'registro' : 'registros'],
              [`${resumo.quadrasTrabalhadas}/${resumo.quadrasTotal}`, 'quadras trabalhadas'],
              [`${resumo.pctGeral}%`, 'do campo concluído'],
            ] as const).map(([valor, rotulo], i) => (
              <div key={rotulo} className={`flex-1 px-4 py-3 ${i > 0 ? 'border-l border-[#0A4D3C]/[0.08]' : ''}`}>
                <p className="text-lg font-black leading-none tabular-nums" style={{ color: VERDE }}>{valor}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1.5 leading-tight">{rotulo}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ----------------------------------------------------------- GRADE */}
        {territorios.length === 0 ? (
          <p className="text-sm text-gray-400 py-12 text-center border-t border-gray-100">
            Nenhum território cadastrado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto border-t border-gray-100">
            <table className="w-full border-collapse min-w-[664px] sm:min-w-[818px]">
              <thead>
                <tr className="bg-[#FBFCFC]">
                  <th className="sticky left-0 z-30 bg-[#FBFCFC] w-[46px] sm:w-[88px] px-1 py-3.5 text-[8px] font-bold text-gray-400 uppercase tracking-[0.1em] border-b border-gray-200">
                    <span className="sm:hidden">Terr.</span>
                    <span className="hidden sm:inline">Território</span>
                  </th>
                  <th className="sticky left-[46px] sm:left-[88px] z-30 bg-[#FBFCFC] w-[94px] sm:w-[156px] px-2 sm:px-3 py-3.5 text-left text-[9px] font-bold text-gray-400 uppercase tracking-[0.12em] border-b border-r border-gray-200">
                    Quadra
                  </th>
                  {DIAS.map((d, i) => {
                    const hoje = i === colunaHoje;
                    return (
                      <th key={d}
                        className={`px-2 py-3.5 min-w-[74px] sm:min-w-[82px] text-[9px] font-bold uppercase tracking-[0.12em] border-b transition-colors ${
                          hoje  ? 'text-[#0A4D3C] border-[#0A4D3C]/30 bg-[#0A4D3C]/[0.05]'
                          : i >= 5 ? 'text-gray-300 border-gray-200 bg-[#F8F9FA]'
                          : 'text-gray-400 border-gray-200'
                        }`}>
                        <span className="inline-flex items-center gap-1.5">
                          {hoje && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: VERDE }} />}
                          {d}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {grade.map(bloco => (
                  bloco.quadras.length === 0 ? (
                    // Território cadastrado, mas ainda sem nenhuma quadra.
                    <tr key={bloco.territorio.id} className="border-t-[6px] border-[#F4F6F6]">
                      <td className="sticky left-0 z-20 bg-white px-2 py-4 align-middle text-center">
                        <span className="text-2xl font-black leading-none tracking-tight" style={{ color: VERDE }}>
                          {numeroDoTerritorio(bloco.territorio.nome) ?? bloco.territorio.nome}
                        </span>
                      </td>
                      <td colSpan={8} className="bg-white px-4 py-5 text-xs text-gray-400 font-medium border-l border-gray-100">
                        Nenhuma quadra cadastrada neste território.
                      </td>
                    </tr>
                  ) : (
                    bloco.quadras.map((blocoQuadra, iq) =>
                      blocoQuadra.linhas.map((linha, il) => {
                        const primeiraDoTerritorio = iq === 0 && il === 0;
                        const primeiraDaQuadra = il === 0;
                        const pctQ = pctDaQuadra(blocoQuadra.quadra.id);
                        const nQuadras = bloco.quadras.length;

                        return (
                          <tr
                            key={`${blocoQuadra.quadra.id}-${linha.semana}`}
                            className={
                              // Faixa clara larga separa territórios; linha fina separa
                              // quadras; pontilhado separa semanas da mesma quadra.
                              primeiraDoTerritorio ? 'border-t-[6px] border-[#F4F6F6]'
                              : primeiraDaQuadra   ? 'border-t border-gray-100'
                              : 'border-t border-dashed border-gray-200'
                            }
                          >
                            {/* ------------------------------------- TERRITÓRIO */}
                            {primeiraDoTerritorio && (
                              <td rowSpan={bloco.alturaTotal}
                                className="sticky left-0 z-20 bg-white px-1 sm:px-1.5 py-2 align-middle">
                                <button
                                  onClick={() => { setTerrAberto(bloco.territorio); setDataTerr(isoHoje()); }}
                                  className="w-full flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-gradient-to-b from-[#0A4D3C]/[0.08] to-[#0A4D3C]/[0.02] ring-1 ring-inset ring-[#0A4D3C]/[0.07] hover:from-[#0A4D3C]/[0.14] hover:ring-[#0A4D3C]/20 transition-all active:scale-[0.97]"
                                  title="Registrar trabalho no território inteiro"
                                >
                                  <span className="text-[19px] sm:text-[28px] font-black leading-none tracking-tight" style={{ color: VERDE }}>
                                    {numeroDoTerritorio(bloco.territorio.nome) ?? bloco.territorio.nome}
                                  </span>
                                  {/* No celular o anel não cabe na coluna estreita; vira só o número. */}
                                  <span className="hidden sm:block">
                                    <Anel pct={pctDoTerritorio(bloco.territorio.id)} />
                                  </span>
                                  <span className="sm:hidden text-[10px] font-black tabular-nums text-[#0A4D3C]/60">
                                    {pctDoTerritorio(bloco.territorio.id)}%
                                  </span>
                                  <span className="hidden sm:block text-[9px] font-bold text-[#0A4D3C]/40 uppercase tracking-wider">
                                    {nQuadras} {nQuadras === 1 ? 'quadra' : 'quadras'}
                                  </span>
                                </button>
                              </td>
                            )}

                            {/* ----------------------------------------- QUADRA */}
                            {primeiraDaQuadra && (
                              <td rowSpan={blocoQuadra.linhas.length}
                                className="sticky left-[46px] sm:left-[88px] z-20 bg-white px-2 sm:px-3 pt-3 pb-2.5 align-top border-r border-gray-200 group/q">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline justify-between gap-2">
                                      <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 truncate tracking-tight">
                                        <span className="sm:hidden">{nomeCurto(blocoQuadra.quadra.nome)}</span>
                                        <span className="hidden sm:inline">{blocoQuadra.quadra.nome}</span>
                                      </span>
                                      <span className={`text-[10px] font-black tabular-nums shrink-0 ${
                                        pctQ === 0 ? 'text-gray-300' : 'text-[#0A4D3C]/70'
                                      }`}>
                                        {pctQ}%
                                      </span>
                                    </div>
                                    {/* Barra fina lê melhor que um anel miúdo nesta altura. */}
                                    <div className="mt-1.5 h-[3px] rounded-full bg-black/[0.06] overflow-hidden">
                                      <div className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${Math.max(pctQ, pctQ > 0 ? 3 : 0)}%`, backgroundColor: VERDE }} />
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => setCelula({
                                      quadra: blocoQuadra.quadra,
                                      // Abre já na segunda da semana seguinte à última usada.
                                      data: somarDias(blocoQuadra.linhas[blocoQuadra.linhas.length - 1].semana, 7),
                                    })}
                                    className="w-5 h-5 sm:w-7 sm:h-7 shrink-0 flex items-center justify-center rounded-lg text-gray-300 hover:text-[#0A4D3C] hover:bg-[#0A4D3C]/[0.08] group-hover/q:text-gray-400 transition active:scale-90"
                                    title="Registrar em uma nova semana"
                                  >
                                    <Plus size={15} />
                                  </button>
                                </div>
                              </td>
                            )}

                            {/* ------------------------------- AS SETE COLUNAS */}
                            {linha.dias.map((doDia, col) => {
                              const dataDaCelula = somarDias(linha.semana, col);
                              const ehHoje = col === colunaHoje && linha.semana === semanaDeHoje;
                              const fimDeSemana = col >= 5;

                              return (
                                <td
                                  key={col}
                                  onClick={() => setCelula({ quadra: blocoQuadra.quadra, data: dataDaCelula })}
                                  className={`group/c relative px-1.5 py-2 align-middle border-l border-gray-100 cursor-pointer transition-colors hover:bg-[#0A4D3C]/[0.045] ${
                                    ehHoje ? 'bg-[#0A4D3C]/[0.035]' : fimDeSemana ? 'bg-[#FBFCFC]' : 'bg-white'
                                  }`}
                                  title={`${blocoQuadra.quadra.nome} — ${DIAS[col]} ${formatarDia(dataDaCelula)}`}
                                >
                                  {doDia.length === 0 ? (
                                    <span className={`${CELULA_VAZIA} flex items-center justify-center`}>
                                      <Plus size={13} className="text-gray-300 opacity-0 group-hover/c:opacity-100 transition-opacity" />
                                    </span>
                                  ) : (
                                    <div className="flex flex-col gap-1">
                                      {doDia.map(w => {
                                        const cor = w.responsavel_cor ?? '#475569';
                                        return (
                                          <div key={w.id}
                                            className="rounded-lg pl-2 pr-1.5 py-1.5 text-left ring-1 ring-inset transition-shadow group-hover/c:shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                                            style={{ backgroundColor: `${cor}14`, borderLeft: `2.5px solid ${cor}`, boxShadow: 'none' }}>
                                            <div className="flex items-center gap-1">
                                              <span className="text-[11px] font-bold leading-tight truncate tracking-tight"
                                                style={{ color: cor }}>
                                                {w.responsavel_nome}
                                              </span>
                                            </div>
                                            <div className="text-[10px] text-slate-500/80 tabular-nums leading-tight mt-0.5 font-medium">
                                              {formatarDia(w.data)}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* ------------------------------------------------- MODAL DE UMA CÉLULA */}
      {celula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
             onClick={() => setCelula(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[88vh] overflow-y-auto shadow-2xl"
               onClick={e => e.stopPropagation()}>

            <div className="flex justify-between items-start p-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
              <div>
                <h3 className="font-bold text-lg text-slate-800">{celula.quadra.nome}</h3>
                <p className="text-xs text-gray-500 first-letter:uppercase">
                  {NOMES_DIA_SEMANA[new Date(celula.data + 'T12:00:00').getDay()]}, {formatarDia(celula.data)}
                </p>
              </div>
              <button onClick={() => setCelula(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 shrink-0">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                  <CalendarDays size={13} /> Dia do trabalho
                </label>
                <input
                  type="date" value={celula.data}
                  onChange={e => e.target.value && setCelula({ ...celula, data: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-[#0A4D3C] transition"
                />
                <p className="text-[11px] text-gray-400 mt-1.5">
                  A coluna da grade sai daqui: mudou a data, muda o dia da semana.
                </p>
              </div>

              {trabalhosDaCelula.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                    Já registrado neste dia
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {trabalhosDaCelula.map(w => (
                      <div key={w.id} className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: w.responsavel_cor ?? '#94a3b8' }} />
                        <span className="text-xs font-bold text-slate-700 flex-1 truncate">{w.responsavel_nome}</span>
                        <button onClick={() => remover(w)} className="text-gray-300 hover:text-red-500 p-1 transition-colors" title="Apagar registro">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ativos.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  Nenhum responsável cadastrado. Use o botão <strong>Responsáveis</strong> lá em cima.
                </p>
              ) : (
                <div>
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                    Quem trabalhou
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[...ativos]
                      // Quem tem esse dia fixo aparece primeiro — é quase sempre a escolha certa.
                      .sort((a, b) => {
                        const dia = new Date(celula.data + 'T12:00:00').getDay();
                        return Number(b.dia_semana === dia) - Number(a.dia_semana === dia);
                      })
                      .map(r => {
                        const doDia = r.dia_semana === new Date(celula.data + 'T12:00:00').getDay();
                        return (
                          <button
                            key={r.id}
                            onClick={() => registrar([celula.quadra], r, celula.data)}
                            disabled={salvando}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition active:scale-95 disabled:opacity-50 ${
                              doDia ? 'border-[#0A4D3C] bg-[#0A4D3C]/5' : 'border-gray-200 bg-white hover:border-slate-400'
                            }`}
                          >
                            <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: r.cor }} />
                            <span className="text-xs font-bold text-slate-700 truncate">{r.nome}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------- MODAL DO TERRITÓRIO INTEIRO */}
      {terrAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
             onClick={() => setTerrAberto(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[88vh] overflow-y-auto shadow-2xl"
               onClick={e => e.stopPropagation()}>

            <div className="flex justify-between items-start p-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
              <div>
                <h3 className="font-bold text-lg text-slate-800">{terrAberto.nome}</h3>
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Layers size={12} /> Registra de uma vez nas {quadrasDoTerrAberto.length} quadras
                </p>
              </div>
              <button onClick={() => setTerrAberto(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 shrink-0">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                  <CalendarDays size={13} /> Dia do trabalho
                </label>
                <input type="date" value={dataTerr} onChange={e => e.target.value && setDataTerr(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-[#0A4D3C] transition" />
              </div>

              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Quem trabalhou</p>
                <div className="grid grid-cols-2 gap-2">
                  {ativos.map(r => (
                    <button key={r.id} onClick={() => registrar(quadrasDoTerrAberto, r, dataTerr)} disabled={salvando}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-slate-400 text-left transition active:scale-95 disabled:opacity-50">
                      <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: r.cor }} />
                      <span className="text-xs font-bold text-slate-700 truncate">{r.nome}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {painelResp && (
        <PainelResponsaveis
          responsaveis={responsaveis}
          onFechar={() => setPainelResp(false)}
          onMudou={() => { carregar(); onResponsaveisMudaram?.(); }}
        />
      )}
    </div>
  );
}

// ============================================================================
//  PAINEL DE RESPONSÁVEIS
//  Antes os nomes vinham chumbados no arquivo SQL. Agora quem manda é você:
//  o nome é o de quem dirige (Adalto) e o dia da semana fica num campo à parte,
//  que é o que joga o registro na coluna certa da grade.
//
//  Regra simples: escolheu um dia -> é do tipo "dia". Sem dia -> é "grupo".
// ============================================================================
function PainelResponsaveis({
  responsaveis, onFechar, onMudou,
}: {
  responsaveis: Responsavel[];
  onFechar: () => void;
  onMudou: () => void;
}) {
  type Rascunho = { nome: string; dia_semana: number | null; cor: string; ativo: boolean };

  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho>({ nome: '', dia_semana: null, cor: '#0A4D3C', ativo: true });
  const [criando, setCriando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const limpar = () => { setEditando(null); setCriando(false); setRascunho({ nome: '', dia_semana: null, cor: '#0A4D3C', ativo: true }); };

  const abrirEdicao = (r: Responsavel) => {
    setCriando(false);
    setEditando(r.id);
    setRascunho({ nome: r.nome, dia_semana: r.dia_semana, cor: r.cor, ativo: r.ativo });
  };

  const salvar = async () => {
    const nome = rascunho.nome.trim();
    if (!nome) { alert('Falta o nome.'); return; }

    setSalvando(true);
    const campos = {
      nome,
      dia_semana: rascunho.dia_semana,
      tipo: rascunho.dia_semana === null ? 'grupo' : 'dia',
      cor: rascunho.cor,
      ativo: rascunho.ativo,
    };

    const { error } = editando
      ? await supabase.from('responsaveis').update(campos).eq('id', editando)
      : await supabase.from('responsaveis').insert([{
          ...campos,
          ordem: Math.max(0, ...responsaveis.map(r => r.ordem)) + 1,
        }]);

    setSalvando(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    limpar();
    onMudou();
  };

  const apagar = async (r: Responsavel) => {
    if (!window.confirm(
      `Apagar "${r.nome}"?\n\nOs registros antigos dele na grade e no histórico continuam lá, com o nome guardado. Se a ideia é só tirar de circulação, desmarque "ativo" no lugar de apagar.`
    )) return;

    const { error } = await supabase.from('responsaveis').delete().eq('id', r.id);
    if (error) { alert('Erro ao apagar: ' + error.message); return; }
    onMudou();
  };

  const formulario = (
    <div className="border border-[#0A4D3C]/30 bg-[#0A4D3C]/5 rounded-2xl p-3 flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="color" value={rascunho.cor}
          onChange={e => setRascunho({ ...rascunho, cor: e.target.value })}
          className="w-11 h-11 rounded-xl border border-gray-300 bg-white p-1 cursor-pointer shrink-0"
          title="Cor no mapa e na grade"
        />
        <input
          type="text" value={rascunho.nome} autoFocus
          onChange={e => setRascunho({ ...rascunho, nome: e.target.value })}
          placeholder="Nome (ex: Adalto, Grupo 1)"
          className="flex-1 min-w-0 bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-[#0A4D3C] transition placeholder:font-medium placeholder:text-gray-400"
        />
      </div>

      <div>
        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">
          Dia fixo da semana
        </label>
        <select
          value={rascunho.dia_semana ?? ''}
          onChange={e => setRascunho({ ...rascunho, dia_semana: e.target.value === '' ? null : Number(e.target.value) })}
          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-[#0A4D3C] transition first-letter:uppercase"
        >
          <option value="">Sem dia fixo (grupo)</option>
          {NOMES_DIA_SEMANA.map((d, i) => <option key={d} value={i} className="capitalize">{d}</option>)}
        </select>
        <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
          Quem tem dia fixo aparece primeiro na hora de registrar naquele dia. Não trava nada: dá para
          registrar em qualquer dia.
        </p>
      </div>

      <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
        <input type="checkbox" checked={rascunho.ativo}
          onChange={e => setRascunho({ ...rascunho, ativo: e.target.checked })}
          className="w-4 h-4 accent-[#0A4D3C]" />
        Ativo (aparece na hora de designar)
      </label>

      <div className="flex gap-2">
        <button onClick={salvar} disabled={salvando}
          className="flex-1 bg-[#0A4D3C] hover:bg-[#07382c] text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50">
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar
        </button>
        <button onClick={limpar}
          className="px-4 bg-white border border-gray-300 text-slate-600 rounded-xl font-bold text-sm active:scale-95 transition">
          Cancelar
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onFechar}>
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[88vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>

        <div className="flex justify-between items-start p-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl z-10">
          <div>
            <h3 className="font-bold text-lg text-slate-800">Responsáveis</h3>
            <p className="text-xs text-gray-500">Quem pode receber território, e em que dia sai.</p>
          </div>
          <button onClick={onFechar}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-3">
          {criando ? formulario : (
            <button onClick={() => { setEditando(null); setCriando(true); setRascunho({ nome: '', dia_semana: null, cor: '#0A4D3C', ativo: true }); }}
              className="w-full border-2 border-dashed border-gray-300 text-slate-500 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:border-[#0A4D3C] hover:text-[#0A4D3C] transition active:scale-95">
              <Plus size={16} /> Novo responsável
            </button>
          )}

          {responsaveis.length === 0 && !criando && (
            <p className="text-sm text-gray-400 py-6 text-center">Nenhum responsável cadastrado ainda.</p>
          )}

          {responsaveis.map(r => (
            editando === r.id ? <div key={r.id}>{formulario}</div> : (
              <div key={r.id}
                className={`flex items-center gap-2.5 border rounded-2xl px-3 py-2.5 ${r.ativo ? 'border-gray-200' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                <span className="w-4 h-4 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: r.cor }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 truncate">{r.nome}</p>
                  <p className="text-[11px] text-gray-500 first-letter:uppercase">
                    {r.dia_semana === null ? 'sem dia fixo' : NOMES_DIA_SEMANA[r.dia_semana]}
                    {!r.ativo && ' · inativo'}
                  </p>
                </div>
                <button onClick={() => abrirEdicao(r)} className="text-gray-400 hover:text-[#0A4D3C] p-1.5 transition-colors" title="Editar">
                  <Pencil size={15} />
                </button>
                <button onClick={() => apagar(r)} className="text-gray-300 hover:text-red-500 p-1.5 transition-colors" title="Apagar">
                  <Trash2 size={15} />
                </button>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}
