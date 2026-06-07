"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Home, Users, Mail, Ban, RefreshCw, Plus, Unlock, LogOut, Map, UserCog, ClockAlert, ChevronRight, ArrowLeft, X, BarChart2, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import DesignacaoMap from './DesignacaoMap';
import GerenciarUsuarios from './GerenciarUsuarios';

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    falados: 0,
    cartas: 0,
    bloqueados: 0,
    percentagem: 0
  });
  const [enderecosBloqueados, setEnderecosBloqueados] = useState<any[]>([]);
  const [todosEnderecos, setTodosEnderecos] = useState<any[]>([]);
  const [detalhesModal, setDetalhesModal] = useState<'total' | 'falados' | 'cartas' | 'restritas' | null>(null);
  const [oldestQuadras, setOldestQuadras] = useState<any[]>([]);
  const [progressoData, setProgressoData] = useState<any[]>([]);
  const [expandedTerritorio, setExpandedTerritorio] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'alertas' | 'bloqueadas' | 'usuarios' | 'designacao' | 'progresso'>('dashboard');
  const [userRole, setUserRole] = useState('assistente');
  const fetchBeganRef = useRef(false);

  useEffect(() => {
    if (fetchBeganRef.current) return;

    const isAdmin = localStorage.getItem('isAdmin');
    const role = localStorage.getItem('userRole') || 'assistente';
    const expiry = localStorage.getItem('loginExpiry');
    
    if (!isAdmin || (expiry && Date.now() > parseInt(expiry, 10))) {
      localStorage.removeItem('isAdmin');
      localStorage.removeItem('userRole');
      localStorage.removeItem('loginExpiry');
      router.push('/login');
      return;
    }
    setUserRole(role);
    
    fetchBeganRef.current = true;
    fetchData();
  }, [router]);

  async function fetchData() {
    setLoading(true);
    let allEnderecos: any[] = [];
    let fetchError = null;
    let page = 0;
    const pageSize = 1000;

    try {
      // Trava de segurança para no máximo 50.000 casas (página < 50) para evitar loop infinito do navegador
      while (page < 50) {
        const { data, error } = await supabase
          .from('enderecos')
          .select('*, quadra:quadras(nome, territorio:territorios(nome))')
          .order('id') // Muito importante para o range (offset) não se perder se atualizado no meio do reload
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          fetchError = error;
          break;
        }

        if (data && data.length > 0) {
          allEnderecos = [...allEnderecos, ...data];
          if (data.length < pageSize) {
            break;
          }
        } else {
          break;
        }
        page++;
      }
    } catch (error) {
      console.error("Exceção ao buscar dados:", error);
      fetchError = error;
    }

    if (fetchError) {
      console.error(fetchError);
      setLoading(false);
      return;
    }

    const enderecos = allEnderecos;

    if (enderecos) {
      setTodosEnderecos(enderecos);
      let t = 0, f = 0, c = 0, b = 0;
      const bloqueadosList: any[] = [];
      const quadrasData: Record<string, any> = {};

      enderecos.forEach(end => {
        t++;
        const s = String(end.status).toLowerCase();
        const isBloq = s === 'bloqueado' || end.is_bloqueado === true || String(end.is_bloqueado).toLowerCase() === 'true';

        if (isBloq) {
          b++;
          bloqueadosList.push(end);
        } else if (s === 'falado' || s === 'true') {
          f++;
        } else if (s === 'cartas') {
          c++;
        }

        // Rastreamento de ociosidade das quadras
        if (end.quadra && end.quadra_id) {
          const qKey = end.quadra_id;
          if (!quadrasData[qKey]) {
            quadrasData[qKey] = {
              id: qKey,
              nome: end.quadra.nome,
              territorio: end.quadra.territorio?.nome || 'Desconhecido',
              lastVisit: null
            };
          }
          if (end.data_visita) {
            const dv = new Date(end.data_visita);
            if (!quadrasData[qKey].lastVisit || dv > quadrasData[qKey].lastVisit) {
               quadrasData[qKey].lastVisit = dv;
            }
          }
        }
      });
      
      // Agrupamento para "Visão Geral de Progresso"
      const progressoMap: Record<string, any> = {};
      enderecos.forEach(end => {
        if (end.quadra && end.quadra.territorio) {
          const tName = end.quadra.territorio.nome;
          const qName = end.quadra.nome;
          const s = String(end.status).toLowerCase();
          const isBloq = s === 'bloqueado' || end.is_bloqueado === true || String(end.is_bloqueado).toLowerCase() === 'true';
          const estaCompleta = s === 'falado' || s === 'true' || s === 'cartas' || isBloq;
          
          if (!progressoMap[tName]) {
            progressoMap[tName] = { nome: tName, total: 0, completos: 0, quadras: {} };
          }
          if (!progressoMap[tName].quadras[qName]) {
            progressoMap[tName].quadras[qName] = { nome: qName, total: 0, completos: 0 };
          }
          
          progressoMap[tName].total++;
          progressoMap[tName].quadras[qName].total++;
          
          if (estaCompleta) {
             progressoMap[tName].completos++;
             progressoMap[tName].quadras[qName].completos++;
          }
        }
      });
      
      const progressoArray = Object.values(progressoMap).map((t: any) => ({
        ...t,
        quadras: Object.values(t.quadras).sort((a: any, b: any) => {
          const matchA = a.nome.match(/\d+/);
          const matchB = b.nome.match(/\d+/);
          const numA = matchA ? parseInt(matchA[0], 10) : 0;
          const numB = matchB ? parseInt(matchB[0], 10) : 0;
          return numA - numB;
        })
      })).sort((a: any, b: any) => a.nome.localeCompare(b.nome));
      
      setProgressoData(progressoArray);

      const activeTotal = t - b;
      const worked = f + c;
      const percentagem = activeTotal > 0 ? Math.round((worked / activeTotal) * 100) : 0;

      setStats({ total: t, falados: f, cartas: c, bloqueados: b, percentagem });

      // Ordena casas restritas pelo número
      bloqueadosList.sort((a, b) => {
          const numA = parseInt(a.numero) || 0;
          const numB = parseInt(b.numero) || 0;
          return numA - numB;
      });
      setEnderecosBloqueados(bloqueadosList);

      // Processa a ociosidade das quadras (há quantos dias não é visitada)
      const now = new Date();
      const listQuads = Object.values(quadrasData).map(q => {
         let daysAgo = Infinity;
         if (q.lastVisit) {
            const diffTime = Math.abs(now.getTime() - q.lastVisit.getTime());
            daysAgo = Math.floor(diffTime / (1000 * 60 * 60 * 24));
         }
         return { ...q, daysAgo };
      });
      
      // Filtra para pegar as mais antigas (maior daysAgo para menor) e ignora as ativas demais
      listQuads.sort((a, b) => b.daysAgo - a.daysAgo);
      setOldestQuadras(listQuads);
    }
    setLoading(false);
  }

  const handleReset = async () => {
    const confirm = window.confirm("ATENÇÃO: Você vai limpar o status de toda a congregação voltando as quadras para 0%. As casas restritas (bloqueadas) NÃO serão afetadas. Deseja mesmo continuar?");
    if (!confirm) return;

    const senhaDigitada = window.prompt("AÇÃO DESTRUTIVA!\nDigite a senha de acesso (admin) para confirmar a limpeza:");
    if (senhaDigitada !== "admin123") {
      alert("Senha incorreta. O reset foi cancelado por segurança.");
      return;
    }

    try {
      // Atualiza somente os endereços que estão com status marcado que não seja bloqueado.
      const { error: resetErr } = await supabase
        .from('enderecos')
        .update({ status: 'false', data_visita: null })
        .in('status', ['Falado', 'falado', 'Cartas', 'cartas', 'true', 'TRUE']);

      if (resetErr) {
        alert("Erro ao resetar: " + resetErr.message);
      } else {
        alert("Todos os mapas foram resetados com sucesso! Casas com restrição foram preservadas.");
        fetchData(); // Recarrega o painel em tempo real
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnlock = async (id: string) => {
    if (!window.confirm("Deseja perdoar restrição e desbloquear esta casa para ser visitada novamente?")) return;

    const { error } = await supabase
      .from('enderecos')
      .update({ status: 'false', is_bloqueado: false })
      .eq('id', id);

    if (error) {
      alert("Erro ao desbloquear.");
      console.error(error);
    } else {
      fetchData();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isAdmin');
    router.push('/');
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
         <p className="text-gray-500 font-medium">Carregando painel...</p>
      </main>
    );
  }

  // Lógica para o modal de detalhes
  const obterEnderecosFiltrados = () => {
    if (!detalhesModal) return [];
    
    return todosEnderecos.filter(end => {
      const s = String(end.status).toLowerCase();
      const isBloq = s === 'bloqueado' || end.is_bloqueado === true || String(end.is_bloqueado).toLowerCase() === 'true';

      if (detalhesModal === 'restritas') return isBloq;
      if (detalhesModal === 'falados') return !isBloq && (s === 'falado' || s === 'true');
      if (detalhesModal === 'cartas') return !isBloq && s === 'cartas';
      if (detalhesModal === 'total') return true;
      return false;
    });
  };

  const getModalTitle = () => {
    if (detalhesModal === 'falados') return 'Casas Faladas';
    if (detalhesModal === 'cartas') return 'Cartas Entregues';
    if (detalhesModal === 'restritas') return 'Casas Restritas';
    if (detalhesModal === 'total') return 'Todos os Endereços';
    return '';
  };
  
  const getModalColor = () => {
    if (detalhesModal === 'falados') return 'text-green-700 bg-green-100 border-green-200';
    if (detalhesModal === 'cartas') return 'text-blue-700 bg-blue-100 border-blue-200';
    if (detalhesModal === 'restritas') return 'text-red-700 bg-red-100 border-red-200';
    return 'text-slate-800 bg-gray-200 border-gray-300';
  };

  const renderizarListaModal = () => {
    const lista = obterEnderecosFiltrados();
    // Ordena por Território -> Quadra -> Casa (Numérico)
    const ordenada = [...lista].sort((a, b) => {
      const tA = a.quadra?.territorio?.nome || '';
      const tB = b.quadra?.territorio?.nome || '';
      if (tA !== tB) return tA.localeCompare(tB);
      
      const qA = a.quadra?.nome || '';
      const qB = b.quadra?.nome || '';
      if (qA !== qB) return qA.localeCompare(qB);
      
      const nA = parseInt(a.numero) || 0;
      const nB = parseInt(b.numero) || 0;
      return nA - nB;
    });

    return (
      <div className="flex flex-col gap-2 p-3 sm:p-5">
        {ordenada.length === 0 ? (
           <p className="text-center text-gray-400 py-10 font-medium">Nenhum endereço encontrado.</p>
        ) : (
          ordenada.map(end => (
            <div key={end.id} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-gray-200 transition-colors">
              <div>
                <p className="font-bold text-slate-700 text-[15px]">Nº {end.numero} - {end.rua}</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5 tracking-wider">
                  {end.quadra?.territorio?.nome} &bull; {end.quadra?.nome}
                </p>
              </div>
              {end.data_visita && (
                <span className="text-[10px] text-gray-500 font-bold bg-gray-100 px-2.5 py-1 rounded-lg">
                  {new Date(end.data_visita).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
             {activeTab !== 'dashboard' && (
                <button onClick={() => setActiveTab('dashboard')} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 bg-white rounded-full transition-colors border shadow-sm">
                   <ArrowLeft size={20} />
                </button>
             )}
             <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
               {activeTab === 'dashboard' ? 'Painel Geral' :
                activeTab === 'alertas' ? 'Inatividade' :
                activeTab === 'bloqueadas' ? 'Não Visitar' : 
                activeTab === 'designacao' ? 'Designações' : 
                activeTab === 'progresso' ? 'Visão Geral' : 'Gerenciar Usuários'}
             </h1>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link href="/" className="flex-1 sm:flex-none text-center bg-white border border-gray-200 shadow-sm px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-gray-100">
              Ver Mapas
            </Link>
            <button onClick={handleLogout} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 text-white shadow-sm px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700">
              <LogOut size={16} /> Sair
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <>
            {/* PROGRESSO GERAL */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-blue-50 mb-6 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
              <div className="flex justify-between items-end mb-2">
                <div>
                  <h3 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest pl-2">Desempenho do Território</h3>
                  <p className="text-lg font-bold text-slate-800 pl-2">Território Trabalhado</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-blue-600">{stats.percentagem}</span>
                  <span className="text-xl font-bold text-blue-400">%</span>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 mt-3 overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${stats.percentagem}%`}}></div>
              </div>
            </div>

            {/* DASHBOARD CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 items-stretch">
              <button onClick={() => setDetalhesModal('total')} className="text-left bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between h-full min-h-[130px] hover:scale-[1.03] hover:shadow-md hover:border-gray-300 transition-all active:scale-95 cursor-pointer">
                <div className="flex items-start gap-2 text-slate-400">
                  <Home size={18} className="mt-0.5 flex-shrink-0" /> <span className="font-bold text-[10px] sm:text-[11px] uppercase tracking-wide leading-tight">Total de casas no nosso território</span>
                </div>
                <span className="text-4xl font-black text-slate-800 leading-none mt-4">{stats.total}</span>
              </button>

              <button onClick={() => setDetalhesModal('falados')} className="text-left bg-green-50 p-4 sm:p-5 rounded-3xl shadow-sm border border-green-100 flex flex-col justify-between h-full min-h-[130px] hover:scale-[1.03] hover:shadow-md hover:border-green-300 transition-all active:scale-95 cursor-pointer">
                <div className="flex items-start gap-2 text-green-500">
                  <Users size={18} className="mt-0.5 flex-shrink-0" /> <span className="font-bold text-[10px] sm:text-[11px] uppercase tracking-wide leading-tight">Total de casas onde foi falado</span>
                </div>
                <span className="text-4xl font-black text-green-700 leading-none mt-4">{stats.falados}</span>
              </button>

              <button onClick={() => setDetalhesModal('cartas')} className="text-left bg-blue-50 p-4 sm:p-5 rounded-3xl shadow-sm border border-blue-100 flex flex-col justify-between h-full min-h-[130px] hover:scale-[1.03] hover:shadow-md hover:border-blue-300 transition-all active:scale-95 cursor-pointer">
                <div className="flex items-start gap-2 text-blue-500">
                  <Mail size={18} className="mt-0.5 flex-shrink-0" /> <span className="font-bold text-[10px] sm:text-[11px] uppercase tracking-wide leading-tight">Total de casas onde foram deixado cartas/convites</span>
                </div>
                <span className="text-4xl font-black text-blue-700 leading-none mt-4">{stats.cartas}</span>
              </button>

              <button onClick={() => setDetalhesModal('restritas')} className="text-left bg-red-50 p-4 sm:p-5 rounded-3xl shadow-sm border border-red-100 flex flex-col justify-between h-full min-h-[130px] hover:scale-[1.03] hover:shadow-md hover:border-red-300 transition-all active:scale-95 cursor-pointer">
                <div className="flex items-start gap-2 text-red-500">
                  <Ban size={18} className="mt-0.5 flex-shrink-0" /> <span className="font-bold text-[10px] sm:text-[11px] uppercase tracking-wide leading-tight">Total de casas para não visitar</span>
                </div>
                <span className="text-4xl font-black text-red-700 leading-none mt-4">{stats.bloqueados}</span>
              </button>
            </div>

            {/* MENU DE OPÇÕES TIPO APP */}
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-2 mb-4 mt-8">Configurações Adicionais</h2>
            <div className="flex flex-col gap-3 mb-10">
              {userRole === 'admin' && (
                <Link href="/admin/cadastro" className="bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 hover:border-emerald-200 hover:bg-slate-50 transition-all font-bold text-slate-700 active:scale-[0.98]">
                  <div className="bg-emerald-50 text-emerald-500 p-3 rounded-xl"><Map size={24} /></div>
                  <div className="flex-1">
                    <span className="block text-[17px] leading-tight">Gerenciar Territórios</span>
                    <span className="text-xs text-gray-400 font-normal">Criar quadras e endereços</span>
                  </div>
                  <ChevronRight className="text-gray-300" />
                </Link>
              )}

              <button onClick={() => setActiveTab('progresso')} className="text-left bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 hover:border-blue-200 hover:bg-slate-50 transition-all font-bold text-slate-700 active:scale-[0.98]">
                <div className="bg-blue-50 text-blue-500 p-3 rounded-xl"><BarChart2 size={24} /></div>
                <div className="flex-1">
                  <span className="block text-[17px] leading-tight">Visão Geral de Progresso</span>
                  <span className="text-xs text-gray-400 font-normal">Casas faltantes por local</span>
                </div>
                <ChevronRight className="text-gray-300" />
              </button>

              <button onClick={() => setActiveTab('designacao')} className="text-left bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 hover:border-purple-200 hover:bg-slate-50 transition-all font-bold text-slate-700 active:scale-[0.98]">
                <div className="bg-purple-50 text-purple-500 p-3 rounded-xl"><Map size={24} /></div>
                <div className="flex-1">
                  <span className="block text-[17px] leading-tight">Designação de Território</span>
                  <span className="text-xs text-gray-400 font-normal">Arraste bolas e faça download</span>
                </div>
                <ChevronRight className="text-gray-300" />
              </button>

              {userRole === 'admin' && (
                <button onClick={() => setActiveTab('usuarios')} className="text-left bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 hover:border-indigo-200 hover:bg-slate-50 transition-all font-bold text-slate-700 active:scale-[0.98]">
                  <div className="bg-indigo-50 text-indigo-500 p-3 rounded-xl"><UserCog size={24} /></div>
                  <div className="flex-1">
                    <span className="block text-[17px] leading-tight">Gerenciar Usuários</span>
                    <span className="text-xs text-gray-400 font-normal">Cadastrar líderes e senhas</span>
                  </div>
                  <ChevronRight className="text-gray-300" />
                </button>
              )}

              <button onClick={() => setActiveTab('alertas')} className="text-left bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 hover:border-orange-200 hover:bg-slate-50 transition-all font-bold text-slate-700 active:scale-[0.98]">
                <div className="bg-orange-50 text-orange-500 p-3 rounded-xl"><ClockAlert size={24} /></div>
                <div className="flex-1">
                  <span className="block text-[17px] leading-tight">Alertas de Inatividade</span>
                  <span className="text-xs text-gray-400 font-normal">Quadras há muito tempo ociosas</span>
                </div>
                <ChevronRight className="text-gray-300" />
              </button>

              <button onClick={() => setActiveTab('bloqueadas')} className="text-left bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 hover:border-red-200 hover:bg-slate-50 transition-all font-bold text-slate-700 active:scale-[0.98]">
                <div className="bg-red-50 text-red-500 p-3 rounded-xl"><Ban size={24} /></div>
                <div className="flex-1">
                  <span className="block text-[17px] leading-tight">Não Visitar</span>
                  <span className="text-xs text-gray-400 font-normal">Casas bloqueadas para visita</span>
                </div>
                <ChevronRight className="text-gray-300" />
              </button>
            </div>

            {/* ZONA DE PERIGO */}
            {userRole === 'admin' && (
              <div className="mt-12 border-t border-red-200/50 pt-10 flex flex-col items-center justify-center pb-8 opacity-80 hover:opacity-100 transition-opacity">
                  <p className="text-red-400/80 text-[10px] font-bold uppercase tracking-widest mb-3">ATENÇÃO</p>
                  <button 
                    onClick={handleReset} 
                    className="bg-white border text-red-500 border-red-100 hover:bg-red-50 hover:border-red-200 px-6 py-3 rounded-2xl shadow-sm text-sm font-bold transition-all active:scale-95 flex items-center gap-2"
                  >
                    <RefreshCw size={16} /> RESETAR TERRITÓRIO
                  </button>
                  <p className="max-w-xs text-center text-[11px] text-gray-400 mt-3 leading-relaxed">
                    Isso apagará o histórico da campanha atual de *todas* as quadras simultaneamente, voltando-as para 0%. Casas "Não Visitar" serão preservadas.
                  </p>
              </div>
            )}
          </>
        )}

        {/* TELA DE ALERTAS */}
        {activeTab === 'alertas' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100/50">
             <p className="text-xs text-gray-400 mb-4 font-medium text-center">Do local mais abandonado para o mais recente trabalhado:</p>
             {oldestQuadras.length === 0 ? (
               <p className="text-center text-gray-400 py-10">Aguardando dados...</p>
             ) : (
               <div className="flex flex-col gap-1.5">
                 {oldestQuadras.map((q, i) => {
                   const isInactive = q.daysAgo === Infinity;
                   const isOld = !isInactive && q.daysAgo > 14; 
                   return (
                   <div key={q.id} className={`flex justify-between items-center px-3 py-2 rounded-xl border ${isInactive || isOld ? 'bg-orange-50/40 border-orange-100/50' : 'bg-gray-50/50 border-gray-100'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isInactive ? 'bg-red-400' : isOld ? 'bg-orange-400' : 'bg-green-400'}`}></span>
                        <div className="flex flex-col justify-center">
                          <span className="font-bold text-slate-800 text-[13px] leading-tight">{q.nome}</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{q.territorio}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                         {isInactive ? (
                           <span className="text-[11px] font-bold text-red-500 tracking-tight uppercase">Não iniciado</span>
                         ) : (
                           <div className="flex flex-col items-end justify-center pt-0.5">
                             <span className="text-[8px] text-gray-400 font-medium leading-none mb-0.5">Trabalhado há</span>
                             <div className="flex items-baseline justify-end gap-1">
                               <span className={`text-[15px] font-black tracking-tighter leading-none ${isOld ? 'text-orange-600' : 'text-slate-600'}`}>
                                 {q.daysAgo}
                               </span>
                               <span className="text-[9px] font-bold uppercase text-slate-400">dias</span>
                             </div>
                           </div>
                         )}
                      </div>
                   </div>
                 )})}
               </div>
             )}
          </div>
        )}

        {/* TELA DE VISÃO GERAL DE PROGRESSO */}
        {activeTab === 'progresso' && (
          <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-gray-100">
             <p className="text-sm text-gray-500 mb-6 font-medium">
               Acompanhe de forma fácil quais territórios e quadras precisam de mais atenção nesta campanha.
             </p>
             <div className="flex flex-col gap-3">
               {progressoData.map((t) => {
                 const pct = t.total > 0 ? Math.round((t.completos / t.total) * 100) : 0;
                 const faltam = t.total - t.completos;
                 const isExpanded = expandedTerritorio === t.nome;
                 
                 return (
                   <div key={t.nome} className={`border rounded-2xl transition-all overflow-hidden ${isExpanded ? 'border-blue-200 shadow-md' : 'border-gray-100 shadow-sm hover:border-gray-200'}`}>
                     <button 
                       onClick={() => setExpandedTerritorio(isExpanded ? null : t.nome)}
                       className={`w-full flex items-center justify-between p-4 sm:p-5 text-left transition-colors ${isExpanded ? 'bg-blue-50/50' : 'bg-white'}`}
                     >
                        <div className="flex-1 pr-4">
                          <h3 className="font-bold text-slate-800 text-[15px] sm:text-lg mb-1">{t.nome}</h3>
                          <p className="text-[11px] sm:text-xs text-gray-500 font-medium leading-tight">
                            {faltam === 0 ? (
                              <span className="text-green-600 font-bold">Todas as {t.total} casas concluídas! 🎉</span>
                            ) : (
                              <span>Faltam <strong className="text-slate-700">{faltam}</strong> casas de {t.total}</span>
                            )}
                          </p>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3 overflow-hidden">
                            <div className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm sm:text-lg font-black ${pct === 100 ? 'text-green-500' : 'text-blue-600'}`}>{pct}%</span>
                          <ChevronDown size={20} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                     </button>
                     
                     {isExpanded && (
                       <div className="bg-slate-50 border-t border-gray-100 p-4 sm:p-6 flex flex-col gap-2.5">
                         {t.quadras.map((q: any) => {
                           const qPct = q.total > 0 ? Math.round((q.completos / q.total) * 100) : 0;
                           const qFaltam = q.total - q.completos;
                           
                           return (
                             <div key={q.nome} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm gap-2">
                               <div className="flex-1">
                                 <h4 className="font-bold text-slate-700 text-[13px]">{q.nome}</h4>
                                 <p className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5">
                                   {qFaltam === 0 ? 'Concluída' : `Faltam ${qFaltam} de ${q.total}`}
                                 </p>
                               </div>
                               <div className="flex items-center gap-2 sm:w-1/3">
                                 <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                    <div className={`h-full rounded-full ${qPct === 100 ? 'bg-green-400' : 'bg-blue-400'}`} style={{ width: `${qPct}%` }}></div>
                                 </div>
                                 <span className="text-[10px] font-bold text-slate-600 w-8 text-right">{qPct}%</span>
                               </div>
                             </div>
                           );
                         })}
                       </div>
                     )}
                   </div>
                 );
               })}
             </div>
          </div>
        )}
        {activeTab === 'bloqueadas' && (
          <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-gray-100">
            {enderecosBloqueados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Ban size={48} className="mb-4 opacity-20" />
                <p className="font-medium text-lg">Nenhuma casa bloqueada no momento.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {enderecosBloqueados.map(end => (
                   <div key={end.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-gray-50 rounded-2xl border border-gray-100 gap-4 transition-all">
                     <div>
                       <span className="font-bold text-slate-800 text-lg block mb-1">Nº {end.numero} - {end.rua}</span>
                       <p className="text-xs text-gray-500 font-medium">
                         <span className="uppercase text-[10px] tracking-wider text-slate-400">Território:</span> {end.quadra?.territorio?.nome} &nbsp;&bull;&nbsp; <span className="uppercase text-[10px] tracking-wider text-slate-400">Quadra:</span> {end.quadra?.nome}
                       </p>
                     </div>
                     <button 
                       onClick={() => handleUnlock(end.id)} 
                       className="bg-white border border-gray-200 shadow-sm px-5 py-3 rounded-xl text-slate-600 hover:text-green-600 hover:border-green-300 transition-colors flex items-center justify-center gap-2 font-bold text-sm"
                     >
                       <Unlock size={18} /> Reativar
                     </button>
                   </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TELA DE USUÁRIOS */}
        {activeTab === 'usuarios' && (
          <GerenciarUsuarios />
        )}

        {/* TELA DE DESIGNAÇÃO VIA MAP */}
        {activeTab === 'designacao' && (
          <DesignacaoMap />
        )}

        {/* MODAL DE DETALHES DOS CARDS */}
        {detalhesModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
            <div className="bg-gray-50 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
              <div className={`flex justify-between items-center p-5 border-b ${getModalColor()}`}>
                <div>
                  <h3 className="font-bold text-lg uppercase tracking-wider">{getModalTitle()}</h3>
                  <p className="text-sm opacity-80 font-medium">{obterEnderecosFiltrados().length} endereços encontrados</p>
                </div>
                <button 
                  onClick={() => setDetalhesModal(null)}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 text-current transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-auto bg-gray-50/50">
                 {renderizarListaModal()}
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
