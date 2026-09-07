"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { regiaoPadrao, numeroDoTerritorio, type RegiaoMapa } from '@/lib/mapaTerritorios';
import {
  Download, History, X, Map as MapIcon, Move, Check, RotateCcw,
  CalendarDays, Trash2, Loader2, Save, AlertTriangle, LayoutGrid, Eraser
} from 'lucide-react';
import Gerenciamento, { EtiquetaResponsavel } from './Gerenciamento';

type Territorio = { id: string; nome: string };
type Quadra = { id: string; nome: string; territorio_id: string };
type Responsavel = { id: string; nome: string; tipo: 'grupo' | 'dia'; cor: string; ordem: number; ativo: boolean; dia_semana: number | null };
type Designacao = {
  id: string;
  territorio_id: string;
  responsavel_id: string | null;
  territorio_nome: string;
  responsavel_nome: string;
  responsavel_cor: string | null;
  data_designacao: string;
  data_devolucao: string | null;
  observacao: string | null;
};

const hoje = () => new Date().toISOString().split('T')[0];

const formatarData = (d: string | null) => {
  if (!d) return '—';
  const [a, m, dia] = d.split('T')[0].split('-');
  return `${dia}/${m}/${a.slice(2)}`;
};

const diasDesde = (d: string) => {
  const ms = Date.now() - new Date(d + 'T12:00:00').getTime();
  return Math.max(0, Math.floor(ms / 86400000));
};

export default function DesignacaoMap() {
  const [aba, setAba] = useState<'mapa' | 'gerenciamento' | 'historico' | 'calibrar'>('mapa');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [abertas, setAbertas] = useState<Designacao[]>([]);
  const [historico, setHistorico] = useState<Designacao[]>([]);
  const [regioes, setRegioes] = useState<Record<string, RegiaoMapa>>({});

  const [limpezaAberta, setLimpezaAberta] = useState(false);
  const [confirmacaoApagar, setConfirmacaoApagar] = useState('');

  const [territorioAberto, setTerritorioAberto] = useState<Territorio | null>(null);
  const [formData, setFormData] = useState(hoje());
  const [formObs, setFormObs] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const mapImgRef = useRef<HTMLImageElement>(null);

  // ---------------------------------------------------------------- carregar
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const [rTerr, rQuad, rResp, rDesig, rMapa] = await Promise.all([
      supabase.from('territorios').select('id, nome').order('nome'),
      supabase.from('quadras').select('id, nome, territorio_id'),
      supabase.from('responsaveis').select('*').eq('ativo', true).order('ordem'),
      supabase.from('designacoes').select('*').order('data_designacao', { ascending: false }),
      supabase.from('territorio_mapa').select('*'),
    ]);

    const falhou = rTerr.error || rResp.error || rDesig.error || rMapa.error;
    if (falhou) {
      setErro(falhou.message);
      setCarregando(false);
      return;
    }

    const terrs = (rTerr.data ?? []) as Territorio[];
    setTerritorios(terrs);
    setQuadras((rQuad.data ?? []) as Quadra[]);
    setResponsaveis(((rResp.data ?? []) as Responsavel[])
      .map(r => ({ ...r, dia_semana: r.dia_semana ?? null })));

    const todas = (rDesig.data ?? []) as Designacao[];
    setAbertas(todas.filter(d => !d.data_devolucao));
    setHistorico(todas);

    // Posições salvas ganham das posições de fábrica.
    const salvas: Record<string, RegiaoMapa> = {};
    (rMapa.data ?? []).forEach((m: any) => {
      salvas[m.territorio_id] = { x: Number(m.x), y: Number(m.y), w: Number(m.w), h: Number(m.h) };
    });

    const mapa: Record<string, RegiaoMapa> = {};
    terrs.forEach(t => {
      const r = salvas[t.id] ?? regiaoPadrao(t.nome);
      if (r) mapa[t.id] = r;
    });
    setRegioes(mapa);

    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const designacaoDe = (territorioId: string) => abertas.find(d => d.territorio_id === territorioId) ?? null;

  // ---------------------------------------------------------------- designar
  const designar = async (resp: Responsavel) => {
    if (!territorioAberto) return;
    setSalvando(true);

    const { data: criada, error } = await supabase.from('designacoes').insert([{
      territorio_id: territorioAberto.id,
      responsavel_id: resp.id,
      territorio_nome: territorioAberto.nome,
      responsavel_nome: resp.nome,
      responsavel_cor: resp.cor,
      data_designacao: formData,
      observacao: formObs || null,
    }]).select('id').single();

    if (error) {
      setSalvando(false);
      // O índice único do banco barra dois responsáveis no mesmo território.
      if (error.code === '23505') {
        alert('Este território já está designado para alguém. Devolva primeiro para designar de novo.');
      } else {
        alert('Erro ao designar: ' + error.message);
      }
      return;
    }

    // É isto que faz a aba Gerenciamento se atualizar sozinha: designar o
    // território registra o trabalho de cada quadra dele naquele dia.
    // Se a quadra e o dia já tiverem esse responsável, o banco ignora em vez
    // de duplicar a linha.
    const suasQuadras = quadras.filter(q => q.territorio_id === territorioAberto.id);
    if (suasQuadras.length > 0) {
      const { error: erroTrab } = await supabase.from('trabalhos').upsert(
        suasQuadras.map(q => ({
          territorio_id: territorioAberto.id,
          quadra_id: q.id,
          responsavel_id: resp.id,
          designacao_id: criada?.id ?? null,
          territorio_nome: territorioAberto.nome,
          quadra_nome: q.nome,
          responsavel_nome: resp.nome,
          responsavel_cor: resp.cor,
          data: formData,
          observacao: formObs || null,
        })),
        { onConflict: 'quadra_id,responsavel_id,data', ignoreDuplicates: true },
      );

      if (erroTrab) {
        alert(
          'A designação foi salva, mas não entrou na grade do Gerenciamento:\n\n'
          + erroTrab.message
          + '\n\nSe a tabela ainda não existe, rode o arquivo sql/002_gerenciamento.sql no Supabase.'
        );
      }
    }

    setSalvando(false);
    setTerritorioAberto(null);
    setFormObs('');
    carregar();
  };

  const devolver = async (d: Designacao) => {
    if (!window.confirm(`Confirmar a devolução do ${d.territorio_nome} por ${d.responsavel_nome}?`)) return;
    setSalvando(true);

    const { error } = await supabase
      .from('designacoes')
      .update({ data_devolucao: hoje() })
      .eq('id', d.id);

    setSalvando(false);
    if (error) { alert('Erro ao devolver: ' + error.message); return; }

    setTerritorioAberto(null);
    carregar();
  };

  // ------------------------------------------------------------ limpar tudo
  // Devolver é o caminho normal: o mapa fica limpo e o período de cada
  // território entra para o histórico, igual a devolver um por um.
  const devolverTodas = async () => {
    setSalvando(true);
    const { error } = await supabase
      .from('designacoes')
      .update({ data_devolucao: hoje() })
      .is('data_devolucao', null);

    setSalvando(false);
    if (error) { alert('Erro ao devolver: ' + error.message); return; }

    setLimpezaAberta(false);
    carregar();
  };

  // Apagar é para quando a designação foi lançada errada e não deve deixar
  // rastro. Leva junto os registros que ela criou na grade do Gerenciamento.
  const apagarTodasAbertas = async () => {
    setSalvando(true);
    const { error } = await supabase
      .from('designacoes')
      .delete()
      .in('id', abertas.map(d => d.id));

    setSalvando(false);
    if (error) { alert('Erro ao apagar: ' + error.message); return; }

    setLimpezaAberta(false);
    setConfirmacaoApagar('');
    carregar();
  };

  const apagarRegistro = async (id: string) => {
    if (!window.confirm('Apagar este registro do histórico? Isso não pode ser desfeito.')) return;
    const { error } = await supabase.from('designacoes').delete().eq('id', id);
    if (error) { alert('Erro ao apagar: ' + error.message); return; }
    carregar();
  };

  // --------------------------------------------------------------- calibrar
  const arrastando = useRef<{ id: string; modo: 'mover' | 'tamanho'; px: number; py: number; base: RegiaoMapa } | null>(null);

  const iniciarArrasto = (e: React.PointerEvent, id: string, modo: 'mover' | 'tamanho') => {
    if (aba !== 'calibrar') return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    arrastando.current = { id, modo, px: e.clientX, py: e.clientY, base: { ...regioes[id] } };
  };

  const moverArrasto = (e: React.PointerEvent) => {
    const a = arrastando.current;
    const box = containerRef.current;
    if (!a || !box) return;

    const rect = box.getBoundingClientRect();
    const dx = ((e.clientX - a.px) / rect.width) * 100;
    const dy = ((e.clientY - a.py) / rect.height) * 100;

    setRegioes(prev => {
      const r = a.base;
      const novo = a.modo === 'mover'
        ? { ...r, x: Math.min(100 - r.w, Math.max(0, r.x + dx)), y: Math.min(100 - r.h, Math.max(0, r.y + dy)) }
        : { ...r, w: Math.max(2, Math.min(100 - r.x, r.w + dx)), h: Math.max(2, Math.min(100 - r.y, r.h + dy)) };
      return { ...prev, [a.id]: novo };
    });
  };

  const terminarArrasto = () => { arrastando.current = null; };

  const salvarCalibracao = async () => {
    setSalvando(true);
    const linhas = Object.entries(regioes).map(([territorio_id, r]) => ({
      territorio_id,
      x: Number(r.x.toFixed(2)),
      y: Number(r.y.toFixed(2)),
      w: Number(r.w.toFixed(2)),
      h: Number(r.h.toFixed(2)),
      atualizado_em: new Date().toISOString(),
    }));

    const { error } = await supabase.from('territorio_mapa').upsert(linhas, { onConflict: 'territorio_id' });
    setSalvando(false);

    if (error) { alert('Erro ao salvar posições: ' + error.message); return; }
    alert('Posições salvas! O mapa vai abrir assim para todo mundo agora.');
    setAba('mapa');
  };

  const restaurarPadrao = () => {
    if (!window.confirm('Voltar todas as áreas para a posição original de fábrica?')) return;
    const mapa: Record<string, RegiaoMapa> = {};
    territorios.forEach(t => {
      const r = regiaoPadrao(t.nome);
      if (r) mapa[t.id] = r;
    });
    setRegioes(mapa);
  };

  // ---------------------------------------------------------------- imagem
  const baixarImagem = () => {
    const img = mapImgRef.current;
    if (!img || !img.complete || !img.naturalWidth) {
      alert('O mapa ainda está carregando. Espere um instante e tente de novo.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    abertas.forEach(d => {
      const r = regioes[d.territorio_id];
      if (!r) return;

      const x = (r.x / 100) * canvas.width;
      const y = (r.y / 100) * canvas.height;
      const w = (r.w / 100) * canvas.width;
      const h = (r.h / 100) * canvas.height;
      const cor = d.responsavel_cor || '#0A4D3C';

      // Área pintada por cima do território
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = cor;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;

      ctx.lineWidth = canvas.width * 0.003;
      ctx.strokeStyle = cor;
      ctx.strokeRect(x, y, w, h);

      // Etiqueta com o nome de quem está com o território
      const fonte = canvas.width * 0.016;
      ctx.font = `900 ${fonte}px sans-serif`;
      const texto = d.responsavel_nome;
      const padX = fonte * 0.6;
      const larguraEtq = ctx.measureText(texto).width + padX * 2;
      const alturaEtq = fonte * 1.9;
      const ex = x + w / 2 - larguraEtq / 2;
      const ey = y + h / 2 - alturaEtq / 2;

      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = canvas.width * 0.004;
      ctx.shadowOffsetY = canvas.width * 0.001;

      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(ex, ey, larguraEtq, alturaEtq, fonte * 0.5);
      else ctx.rect(ex, ey, larguraEtq, alturaEtq);
      ctx.fillStyle = cor;
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.lineWidth = canvas.width * 0.0015;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(texto, x + w / 2, ey + alturaEtq / 2);
    });

    const link = document.createElement('a');
    link.download = `Designacoes_${hoje()}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.9);
    link.click();
  };

  // ------------------------------------------------------------------ telas
  if (carregando) {
    return (
      <div className="bg-white rounded-3xl p-10 shadow-sm border border-gray-100 flex flex-col items-center gap-3">
        <Loader2 className="animate-spin text-gray-400" size={28} />
        <p className="text-gray-500 font-medium text-sm">Carregando designações...</p>
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
        {faltaTabela ? (
          <div className="text-sm text-slate-600 leading-relaxed space-y-3">
            <p>
              O sistema de designações precisa de tabelas novas que ainda não existem no seu Supabase.
              É um passo único e leva menos de um minuto:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 font-medium">
              <li>Abra o painel do Supabase e vá em <strong>SQL Editor</strong>.</li>
              <li>Abra o arquivo <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">sql/001_designacoes_e_historico.sql</code> do projeto.</li>
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

  const grupos = responsaveis.filter(r => r.tipo === 'grupo');
  const dias = responsaveis.filter(r => r.tipo === 'dia');
  const semDesignacao = territorios.filter(t => !designacaoDe(t.id));

  // Cada grupo/dia precisa estar com pelo menos um território na mão.
  const comTerritorio = new Set(abertas.map(d => d.responsavel_id).filter(Boolean));
  const semTerritorio = responsaveis.filter(r => !comTerritorio.has(r.id));
  const designacaoAtual = territorioAberto ? designacaoDe(territorioAberto.id) : null;

  return (
    <div className="flex flex-col gap-4">

      {/* ABAS INTERNAS */}
      <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 grid grid-cols-2 gap-1 sm:flex">
        {([
          ['mapa', 'Mapa', MapIcon],
          ['gerenciamento', 'Gerenciamento', LayoutGrid],
          ['historico', 'Histórico', History],
          ['calibrar', 'Calibrar', Move],
        ] as const).map(([id, rotulo, Icone]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2.5 px-1 rounded-xl text-[11px] sm:text-sm font-bold transition-all active:scale-95 ${
              aba === id ? 'bg-[#0A4D3C] text-white shadow-sm' : 'text-slate-500 hover:bg-gray-50'
            }`}
          >
            <Icone size={16} className="shrink-0" /> <span className="truncate">{rotulo}</span>
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------ GERENCIAMENTO */}
      {aba === 'gerenciamento' && <Gerenciamento onResponsaveisMudaram={carregar} />}

      {/* ---------------------------------------------------------- HISTÓRICO */}
      {aba === 'historico' && (
        <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-slate-800 mb-1">Registro de designações</h3>
          <p className="text-xs text-gray-500 mb-4">
            Todo território que já saiu, para quem foi e quanto tempo ficou.
          </p>

          {historico.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Nenhuma designação registrada ainda.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                    <th className="py-2 px-3 font-bold">Território</th>
                    <th className="py-2 px-3 font-bold">Responsável</th>
                    <th className="py-2 px-3 font-bold">Saída</th>
                    <th className="py-2 px-3 font-bold">Devolução</th>
                    <th className="py-2 px-3 font-bold">Dias</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map(d => {
                    const aberta = !d.data_devolucao;
                    const dias = aberta
                      ? diasDesde(d.data_designacao)
                      : Math.max(0, Math.round(
                          (new Date(d.data_devolucao! + 'T12:00:00').getTime()
                            - new Date(d.data_designacao + 'T12:00:00').getTime()) / 86400000
                        ));
                    return (
                      <tr key={d.id} className="border-b border-gray-50 hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-bold text-slate-700 whitespace-nowrap">{d.territorio_nome}</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.responsavel_cor || '#94a3b8' }} />
                            {d.responsavel_nome}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{formatarData(d.data_designacao)}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {aberta
                            ? <span className="text-[11px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Em campo</span>
                            : <span className="text-slate-500">{formatarData(d.data_devolucao)}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{dias}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button onClick={() => apagarRegistro(d.id)} className="text-gray-300 hover:text-red-500 p-1 transition-colors" title="Apagar registro">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------- MAPA/CALIBRAR */}
      {(aba === 'mapa' || aba === 'calibrar') && (
        <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-gray-100 flex flex-col items-center">

          {aba === 'calibrar' ? (
            <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
              <h3 className="font-bold text-amber-900 text-sm mb-1 flex items-center gap-2"><Move size={16} /> Modo calibrar</h3>
              <p className="text-xs text-amber-800 leading-relaxed mb-3">
                As áreas vieram medidas a olho e quase certamente estão tortas. Arraste cada uma para cima do
                território certo e use o canto de baixo à direita para esticar. Depois salve.
              </p>
              <div className="flex gap-2">
                <button onClick={salvarCalibracao} disabled={salvando}
                  className="bg-[#0A4D3C] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition disabled:opacity-50">
                  {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar posições
                </button>
                <button onClick={restaurarPadrao}
                  className="bg-white border border-amber-300 text-amber-800 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition">
                  <RotateCcw size={14} /> Restaurar padrão
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-wrap justify-between items-center gap-2 mb-4">
              <p className="text-xs text-gray-500 font-medium">
                Toque num território do mapa para designar ou devolver.
              </p>
              <div className="flex items-center gap-2">
                {abertas.length > 0 && (
                  <button onClick={() => { setLimpezaAberta(true); setConfirmacaoApagar(''); }}
                    className="bg-white border border-gray-200 text-slate-600 flex items-center gap-2 py-2 px-3 rounded-xl text-xs font-bold hover:border-slate-400 hover:text-slate-800 transition active:scale-95">
                    <Eraser size={15} /> Limpar <span className="text-gray-400 font-black tabular-nums">{abertas.length}</span>
                  </button>
                )}
                <button onClick={baixarImagem}
                  className="bg-[#0A4D3C] hover:bg-[#07382c] text-white flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold shadow-sm transition active:scale-95">
                  <Download size={15} /> Baixar imagem
                </button>
              </div>
            </div>
          )}

          {/* O MAPA */}
          <div
            ref={containerRef}
            onPointerMove={aba === 'calibrar' ? moverArrasto : undefined}
            onPointerUp={aba === 'calibrar' ? terminarArrasto : undefined}
            onPointerCancel={aba === 'calibrar' ? terminarArrasto : undefined}
            className="relative w-full overflow-hidden rounded-xl border-2 border-gray-100 shadow-sm select-none touch-none"
          >
            <img ref={mapImgRef} src="/mapa-geral.jpg?v=2" alt="Mapa dos territórios" className="w-full h-auto block" />

            {territorios.map(t => {
              const r = regioes[t.id];
              if (!r) return null;

              const d = designacaoDe(t.id);
              const cor = d?.responsavel_cor || '#0A4D3C';
              const num = numeroDoTerritorio(t.nome) ?? '?';

              return (
                <div
                  key={t.id}
                  onPointerDown={aba === 'calibrar' ? (e) => iniciarArrasto(e, t.id, 'mover') : undefined}
                  onClick={aba === 'mapa' ? () => { setTerritorioAberto(t); setFormData(hoje()); setFormObs(''); } : undefined}
                  className={`absolute rounded-md sm:rounded-lg flex items-center justify-center transition-all ${
                    aba === 'calibrar'
                      ? 'cursor-move border-2 border-dashed border-amber-500 bg-amber-400/25'
                      : d
                        ? 'cursor-pointer border-2 hover:brightness-110'
                        : 'cursor-pointer border-2 border-transparent hover:border-slate-400 hover:bg-slate-900/10'
                  }`}
                  style={{
                    left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`,
                    ...(d && aba === 'mapa' ? { backgroundColor: `${cor}66`, borderColor: cor } : {}),
                  }}
                  title={d ? `${t.nome} — ${d.responsavel_nome}` : t.nome}
                >
                  {aba === 'calibrar' && (
                    <>
                      <span className="text-[10px] sm:text-sm font-black text-amber-900 drop-shadow pointer-events-none">{num}</span>
                      <span
                        onPointerDown={(e) => iniciarArrasto(e, t.id, 'tamanho')}
                        className="absolute -right-1.5 -bottom-1.5 w-4 h-4 bg-amber-500 border-2 border-white rounded-full cursor-nwse-resize shadow"
                      />
                    </>
                  )}

                  {aba === 'mapa' && d && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[8px] sm:text-[11px] font-black text-white text-center leading-tight shadow-md pointer-events-none max-w-full truncate"
                      style={{ backgroundColor: cor }}
                    >
                      {d.responsavel_nome}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* QUEM ESTÁ SEM TERRITÓRIO NA MÃO */}
          {aba === 'mapa' && semTerritorio.length > 0 && (
            <div className="w-full mt-5 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <h4 className="text-[11px] font-bold text-amber-900 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <AlertTriangle size={14} /> Sem território no momento ({semTerritorio.length})
              </h4>
              <p className="text-[11px] text-amber-800 mb-3">
                Estes precisam receber pelo menos um território para trabalhar.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {semTerritorio.map(r => (
                  <span key={r.id}
                    className="inline-flex items-center gap-1.5 bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.cor }} />
                    {r.nome}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* RESUMO ABAIXO DO MAPA */}
          {aba === 'mapa' && (
            <div className="w-full mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-gray-200 rounded-2xl p-4">
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Em campo agora ({abertas.length})
                </h4>
                {abertas.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhum território designado no momento.</p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
                    {abertas.map(d => (
                      <button
                        key={d.id}
                        onClick={() => {
                          const t = territorios.find(x => x.id === d.territorio_id);
                          if (t) { setTerritorioAberto(t); setFormData(hoje()); setFormObs(''); }
                        }}
                        className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-left hover:border-slate-400 transition active:scale-[0.99]"
                      >
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.responsavel_cor || '#94a3b8' }} />
                        <span className="text-xs font-bold text-slate-700 flex-1 truncate">{d.territorio_nome}</span>
                        <span className="text-xs text-slate-500 truncate">{d.responsavel_nome}</span>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">{diasDesde(d.data_designacao)}d</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-50 border border-gray-200 rounded-2xl p-4">
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Livres para designar ({semDesignacao.length})
                </h4>
                {semDesignacao.length === 0 ? (
                  <p className="text-xs text-gray-400">Todos os territórios estão em campo.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {semDesignacao.map(t => (
                      <button
                        key={t.id}
                        onClick={() => { setTerritorioAberto(t); setFormData(hoje()); setFormObs(''); }}
                        className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:border-[#0A4D3C] hover:text-[#0A4D3C] transition active:scale-95"
                      >
                        {numeroDoTerritorio(t.nome) ?? t.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------- MODAL DE LIMPEZA */}
      {limpezaAberta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
             onClick={() => setLimpezaAberta(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[88vh] overflow-y-auto shadow-2xl"
               onClick={e => e.stopPropagation()}>

            <div className="flex justify-between items-start p-5 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-lg text-slate-800">Limpar o mapa</h3>
                <p className="text-xs text-gray-500">
                  {abertas.length} {abertas.length === 1 ? 'território está' : 'territórios estão'} em campo agora.
                </p>
              </div>
              <button onClick={() => setLimpezaAberta(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 shrink-0">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">

              {/* Caminho normal, sem perda de dado. */}
              <div className="border border-gray-200 rounded-2xl p-4">
                <h4 className="text-sm font-bold text-slate-800 mb-1">Registrar a devolução de todos</h4>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  Marca a devolução de hoje em todos. O mapa fica limpo e cada período
                  continua no Histórico e na grade do Gerenciamento. É o mesmo que devolver
                  um por um, só que de uma vez.
                </p>
                <button onClick={devolverTodas} disabled={salvando}
                  className="w-full bg-[#0A4D3C] hover:bg-[#07382c] text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50">
                  {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Devolver {abertas.length}
                </button>
              </div>

              {/* Caminho destrutivo, escondido atrás de uma palavra digitada. */}
              <div className="border border-red-200 bg-red-50/40 rounded-2xl p-4">
                <h4 className="text-sm font-bold text-red-700 mb-1 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Apagar sem deixar rastro
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed mb-1">
                  Para quando a designação foi lançada errada. Some do Histórico como se
                  nunca tivesse existido, e leva junto os registros que ela criou na grade
                  do Gerenciamento.
                </p>
                <p className="text-[11px] text-red-700 font-bold mb-3">Não dá para desfazer.</p>

                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">
                  Digite APAGAR para liberar
                </label>
                <input
                  type="text" value={confirmacaoApagar}
                  onChange={e => setConfirmacaoApagar(e.target.value)}
                  placeholder="APAGAR"
                  className="w-full bg-white border border-red-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-red-500 transition placeholder:text-gray-300 placeholder:font-medium mb-2.5"
                />
                <button
                  onClick={apagarTodasAbertas}
                  disabled={salvando || confirmacaoApagar.trim().toUpperCase() !== 'APAGAR'}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {salvando ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  Apagar {abertas.length}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ------------------------------------------------------------- MODAL */}
      {territorioAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
             onClick={() => setTerritorioAberto(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[88vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200"
               onClick={e => e.stopPropagation()}>

            <div className="flex justify-between items-start p-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
              <div>
                <h3 className="font-bold text-lg text-slate-800">{territorioAberto.nome}</h3>
                <p className="text-xs text-gray-500">
                  {designacaoAtual ? 'Está em campo' : 'Livre para designar'}
                </p>
              </div>
              <button onClick={() => setTerritorioAberto(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 shrink-0">
                <X size={18} />
              </button>
            </div>

            {designacaoAtual ? (
              <div className="p-5 flex flex-col gap-4">
                <div className="rounded-2xl p-4 border-2" style={{
                  borderColor: designacaoAtual.responsavel_cor || '#0A4D3C',
                  backgroundColor: `${designacaoAtual.responsavel_cor || '#0A4D3C'}12`,
                }}>
                  <p className="text-[11px] uppercase tracking-widest text-gray-500 font-bold mb-1">Com</p>
                  <p className="text-xl font-black text-slate-800">{designacaoAtual.responsavel_nome}</p>
                  <p className="text-xs text-slate-600 mt-2 font-medium">
                    Desde {formatarData(designacaoAtual.data_designacao)} · {diasDesde(designacaoAtual.data_designacao)} dias
                  </p>
                  {designacaoAtual.observacao && (
                    <p className="text-xs text-slate-500 mt-2 italic">"{designacaoAtual.observacao}"</p>
                  )}
                </div>

                <button onClick={() => devolver(designacaoAtual)} disabled={salvando}
                  className="w-full bg-[#0A4D3C] hover:bg-[#07382c] text-white py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50">
                  {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Registrar devolução
                </button>
                <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                  Ao devolver, o território fica livre e o período entra no histórico.
                </p>
              </div>
            ) : (
              <div className="p-5 flex flex-col gap-4">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                    <CalendarDays size={13} /> Data da saída
                  </label>
                  <input type="date" value={formData} onChange={e => setFormData(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-[#0A4D3C] transition" />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">
                    Observação (opcional)
                  </label>
                  <input type="text" value={formObs} onChange={e => setFormObs(e.target.value)}
                    placeholder="Ex: entregue impresso no salão"
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#0A4D3C] transition placeholder:text-gray-400" />
                </div>

                {responsaveis.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    Nenhum grupo cadastrado. Rode o arquivo SQL do projeto para criar os grupos e dias padrão.
                  </p>
                ) : (
                  <>
                    {grupos.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Grupos</p>
                        <div className="grid grid-cols-2 gap-2">
                          {grupos.map(r => (
                            <button key={r.id} onClick={() => designar(r)} disabled={salvando}
                              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-slate-400 text-left transition active:scale-95 disabled:opacity-50">
                              <EtiquetaResponsavel nome={r.nome} cor={r.cor} dia={r.dia_semana} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {dias.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Dias</p>
                        <div className="grid grid-cols-2 gap-2">
                          {dias.map(r => (
                            <button key={r.id} onClick={() => designar(r)} disabled={salvando}
                              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-slate-400 text-left transition active:scale-95 disabled:opacity-50">
                              <EtiquetaResponsavel nome={r.nome} cor={r.cor} dia={r.dia_semana} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
