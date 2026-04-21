"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Home, Users, Mail, Ban, RefreshCw, Plus, Unlock, LogOut, Map, UserCog, ClockAlert, ChevronRight, ArrowLeft } from 'lucide-react';
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
  const [oldestQuadras, setOldestQuadras] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'alertas' | 'bloqueadas' | 'usuarios' | 'designacao'>('dashboard');
  const fetchBeganRef = useRef(false);

  useEffect(() => {
    if (fetchBeganRef.current) return;

    const isAdmin = localStorage.getItem('isAdmin');
    if (!isAdmin) {
      router.push('/login');
      return;
    }
    
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
                activeTab === 'designacao' ? 'Designações' : 'Gerenciar Usuários'}
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
                <div className="flex items-center gap-2 text-slate-400">
                  <Home size={18} /> <span className="font-bold text-xs uppercase tracking-wide">Total Geral</span>
                </div>
                <span className="text-4xl font-black text-slate-800 leading-none">{stats.total}</span>
              </div>

              <div className="bg-green-50 p-5 rounded-3xl shadow-sm border border-green-100 flex flex-col justify-between h-32">
                <div className="flex items-center gap-2 text-green-500">
                  <Users size={18} /> <span className="font-bold text-xs uppercase tracking-wide">Falados</span>
                </div>
                <span className="text-4xl font-black text-green-700 leading-none">{stats.falados}</span>
              </div>

              <div className="bg-blue-50 p-5 rounded-3xl shadow-sm border border-blue-100 flex flex-col justify-between h-32">
                <div className="flex items-center gap-2 text-blue-500">
                  <Mail size={18} /> <span className="font-bold text-xs uppercase tracking-wide">Cartas</span>
                </div>
                <span className="text-4xl font-black text-blue-700 leading-none">{stats.cartas}</span>
              </div>

              <div className="bg-red-50 p-5 rounded-3xl shadow-sm border border-red-100 flex flex-col justify-between h-32">
                <div className="flex items-center gap-2 text-red-500">
                  <Ban size={18} /> <span className="font-bold text-xs uppercase tracking-wide">Restritas</span>
                </div>
                <span className="text-4xl font-black text-red-700 leading-none">{stats.bloqueados}</span>
              </div>
            </div>

            {/* MENU DE OPÇÕES TIPO APP */}
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-2 mb-4 mt-8">Configurações Adicionais</h2>
            <div className="flex flex-col gap-3 mb-10">
              <Link href="/admin/cadastro" className="bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 hover:border-emerald-200 hover:bg-slate-50 transition-all font-bold text-slate-700 active:scale-[0.98]">
                <div className="bg-emerald-50 text-emerald-500 p-3 rounded-xl"><Map size={24} /></div>
                <div className="flex-1">
                  <span className="block text-[17px] leading-tight">Gerenciar Territórios</span>
                  <span className="text-xs text-gray-400 font-normal">Criar quadras e endereços</span>
                </div>
                <ChevronRight className="text-gray-300" />
              </Link>

              <button onClick={() => setActiveTab('designacao')} className="text-left bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 hover:border-purple-200 hover:bg-slate-50 transition-all font-bold text-slate-700 active:scale-[0.98]">
                <div className="bg-purple-50 text-purple-500 p-3 rounded-xl"><Map size={24} /></div>
                <div className="flex-1">
                  <span className="block text-[17px] leading-tight">Designação de Território</span>
                  <span className="text-xs text-gray-400 font-normal">Arraste bolas e faça download</span>
                </div>
                <ChevronRight className="text-gray-300" />
              </button>

              <button onClick={() => setActiveTab('usuarios')} className="text-left bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 hover:border-indigo-200 hover:bg-slate-50 transition-all font-bold text-slate-700 active:scale-[0.98]">
                <div className="bg-indigo-50 text-indigo-500 p-3 rounded-xl"><UserCog size={24} /></div>
                <div className="flex-1">
                  <span className="block text-[17px] leading-tight">Gerenciar Usuários</span>
                  <span className="text-xs text-gray-400 font-normal">Cadastrar líderes e senhas</span>
                </div>
                <ChevronRight className="text-gray-300" />
              </button>

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

        {/* TELA DE CASAS BLOQUEADAS */}
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

      </div>
    </main>
  );
}
