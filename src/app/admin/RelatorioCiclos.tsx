"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, ChevronRight, X, Download, Archive } from 'lucide-react';

type Ciclo = {
  id: string;
  nome: string | null;
  data_reset: string;
  total_casas: number;
  total_falados: number;
  total_cartas: number;
  total_nao_falados: number;
  total_bloqueados: number;
};

type CasaFria = {
  endereco_id: string;
  territorio_nome: string | null;
  quadra_nome: string | null;
  rua: string | null;
  numero: string | null;
  ciclos_registrados: number;
  ciclos_falados: number;
  ciclos_sem_falar: number;
  pct_sem_falar: number;
  ultima_vez_falado: string | null;
};

const formatarDataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function RelatorioCiclos() {
  const [aba, setAba] = useState<'frias' | 'ciclos'>('frias');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [casasFrias, setCasasFrias] = useState<CasaFria[]>([]);
  const [soNuncaFaladas, setSoNuncaFaladas] = useState(true);
  const [cicloAberto, setCicloAberto] = useState<Ciclo | null>(null);
  const [detalhes, setDetalhes] = useState<any[]>([]);
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const [rCiclos, rFrias] = await Promise.all([
      supabase.from('ciclos').select('*').order('data_reset', { ascending: false }),
      supabase.from('casas_nunca_faladas').select('*').order('ciclos_sem_falar', { ascending: false }).limit(500),
    ]);

    const falhou = rCiclos.error || rFrias.error;
    if (falhou) { setErro(falhou.message); setCarregando(false); return; }

    setCiclos((rCiclos.data ?? []) as Ciclo[]);
    setCasasFrias((rFrias.data ?? []) as CasaFria[]);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirCiclo = async (c: Ciclo) => {
    setCicloAberto(c);
    setCarregandoDetalhes(true);
    const { data } = await supabase
      .from('historico_casas')
      .select('territorio_nome, quadra_nome, rua, numero, status, falado')
      .eq('ciclo_id', c.id)
      .eq('falado', false)
      .order('territorio_nome')
      .limit(3000);
    setDetalhes(data ?? []);
    setCarregandoDetalhes(false);
  };

  const baixarCSV = (linhas: any[], nome: string) => {
    if (linhas.length === 0) return;
    const colunas = Object.keys(linhas[0]);
    const escapar = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      colunas.join(';'),
      ...linhas.map(l => colunas.map(c => escapar(l[c])).join(';')),
    ].join('\n');

    // BOM para o Excel abrir os acentos corretamente
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = nome;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (carregando) {
    return (
      <div className="bg-white rounded-3xl p-10 shadow-sm border border-gray-100 flex flex-col items-center gap-3">
        <Loader2 className="animate-spin text-gray-400" size={28} />
        <p className="text-gray-500 font-medium text-sm">Carregando relatórios...</p>
      </div>
    );
  }

  if (erro) {
    const faltaTabela = /relation .* does not exist|schema cache|Could not find the table/i.test(erro);
    return (
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-red-100">
        <h3 className="font-bold text-lg text-red-600 mb-2">
          {faltaTabela ? 'Falta criar as tabelas no banco' : 'Erro ao carregar'}
        </h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          {faltaTabela
            ? <>Rode o arquivo <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">sql/001_designacoes_e_historico.sql</code> no SQL Editor do Supabase e atualize a página.</>
            : erro}
        </p>
      </div>
    );
  }

  const listaFiltrada = soNuncaFaladas
    ? casasFrias.filter(c => c.ciclos_falados === 0)
    : casasFrias;

  return (
    <div className="flex flex-col gap-4">

      <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 flex gap-1">
        {([['frias', 'Casas que passam batido'], ['ciclos', 'Ciclos fechados']] as const).map(([id, rotulo]) => (
          <button key={id} onClick={() => setAba(id)}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 ${
              aba === id ? 'bg-[#0A4D3C] text-white shadow-sm' : 'text-slate-500 hover:bg-gray-50'
            }`}>
            {rotulo}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------ CASAS QUE PASSAM BATIDO */}
      {aba === 'frias' && (
        <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
            <div>
              <h3 className="font-bold text-slate-800">Casas que ninguém consegue falar</h3>
              <p className="text-xs text-gray-500 mt-0.5 max-w-lg leading-relaxed">
                Comparação de todos os ciclos já fechados. Uma casa só aparece aqui depois que
                pelo menos um reset foi feito com o relatório salvo.
              </p>
            </div>
            {listaFiltrada.length > 0 && (
              <button onClick={() => baixarCSV(listaFiltrada, `casas_sem_falar_${new Date().toISOString().split('T')[0]}.csv`)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition active:scale-95">
                <Download size={14} /> Baixar planilha
              </button>
            )}
          </div>

          {casasFrias.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Archive className="mx-auto text-gray-300 mb-3" size={36} />
              <p className="text-sm text-gray-500 font-medium mb-1">Nenhum ciclo fechado ainda</p>
              <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                Este relatório é montado a partir das fotos tiradas antes de cada reset.
                Na próxima vez que você resetar o mapa, os dados começam a aparecer aqui.
              </p>
            </div>
          ) : (
            <>
              <label className="flex items-center gap-2 mb-4 cursor-pointer w-fit">
                <input type="checkbox" checked={soNuncaFaladas} onChange={e => setSoNuncaFaladas(e.target.checked)}
                  className="w-4 h-4 accent-[#0A4D3C]" />
                <span className="text-xs font-bold text-slate-600">Mostrar só as que nunca foram faladas em ciclo nenhum</span>
              </label>

              <p className="text-xs text-gray-500 mb-3">
                <strong className="text-slate-700">{listaFiltrada.length}</strong> casas nesta lista.
              </p>

              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-sm min-w-[620px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                      <th className="py-2 px-3 font-bold">Endereço</th>
                      <th className="py-2 px-3 font-bold">Quadra</th>
                      <th className="py-2 px-3 font-bold">Território</th>
                      <th className="py-2 px-3 font-bold text-center">Sem falar</th>
                      <th className="py-2 px-3 font-bold text-center">Ciclos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaFiltrada.slice(0, 300).map(c => (
                      <tr key={c.endereco_id} className="border-b border-gray-50 hover:bg-slate-50/60">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-700">{c.numero}</span>
                          <span className="text-slate-500"> — {c.rua}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{c.quadra_nome}</td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{c.territorio_nome}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                            c.pct_sem_falar >= 100 ? 'bg-red-100 text-red-700'
                            : c.pct_sem_falar >= 50 ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                          }`}>
                            {c.ciclos_sem_falar}× ({c.pct_sem_falar}%)
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500">{c.ciclos_registrados}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {listaFiltrada.length > 300 && (
                <p className="text-[11px] text-gray-400 mt-3 text-center">
                  Mostrando as 300 primeiras. Baixe a planilha para ver todas as {listaFiltrada.length}.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------- CICLOS */}
      {aba === 'ciclos' && (
        <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-slate-800 mb-1">Ciclos fechados</h3>
          <p className="text-xs text-gray-500 mb-4">
            Cada reset do mapa guarda aqui a situação de todas as casas naquele momento.
          </p>

          {ciclos.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Nenhum ciclo fechado ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {ciclos.map(c => {
                const trabalhadas = c.total_falados + c.total_cartas;
                const pct = c.total_casas > 0 ? Math.round((trabalhadas / c.total_casas) * 100) : 0;
                return (
                  <button key={c.id} onClick={() => abrirCiclo(c)}
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-gray-200 rounded-2xl p-4 text-left transition active:scale-[0.99] flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-700 text-sm">{c.nome || `Ciclo de ${formatarDataHora(c.data_reset)}`}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {c.total_casas} casas · <span className="text-green-700 font-bold">{c.total_falados} faladas</span>
                        {' · '}<span className="text-blue-700 font-bold">{c.total_cartas} cartas</span>
                        {' · '}<span className="text-red-600 font-bold">{c.total_nao_falados} sem falar</span>
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div className="bg-[#0A4D3C] h-full rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-gray-400 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------- MODAL DETALHE CICLO */}
      {cicloAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
             onClick={() => setCicloAberto(null)}>
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200"
               onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start p-5 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-lg text-slate-800">Casas sem falar neste ciclo</h3>
                <p className="text-xs text-gray-500">{formatarDataHora(cicloAberto.data_reset)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {detalhes.length > 0 && (
                  <button onClick={() => baixarCSV(detalhes, `ciclo_${cicloAberto.data_reset.split('T')[0]}.csv`)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-full transition" title="Baixar planilha">
                    <Download size={16} />
                  </button>
                )}
                <button onClick={() => setCicloAberto(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-5">
              {carregandoDetalhes ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
              ) : detalhes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Todas as casas foram trabalhadas neste ciclo.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                      <th className="py-2 px-2 font-bold">Nº</th>
                      <th className="py-2 px-2 font-bold">Rua</th>
                      <th className="py-2 px-2 font-bold">Quadra</th>
                      <th className="py-2 px-2 font-bold">Território</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalhes.map((d, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-2 px-2 font-bold text-slate-700">{d.numero}</td>
                        <td className="py-2 px-2 text-slate-500">{d.rua}</td>
                        <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{d.quadra_nome}</td>
                        <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{d.territorio_nome}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
