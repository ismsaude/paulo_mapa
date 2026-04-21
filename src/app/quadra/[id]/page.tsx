"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, Edit2, X, UserCheck, Mail, Ban } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function QuadraPage() {
  const params = useParams();
  const router = useRouter();
  
  const [quadra, setQuadra] = useState<any>(null);
  const [enderecosAgrupados, setEnderecosAgrupados] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  // Estados do Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [modalMapa, setModalMapa] = useState(false);
  const [enderecoSelecionado, setEnderecoSelecionado] = useState<any>(null);

  useEffect(() => {
    fetchQuadraEEnderecos();
  }, [params?.id]);

  async function fetchQuadraEEnderecos() {
    if (!params?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('quadras')
        .select('*, territorio:territorios(nome, bairro), enderecos(*)')
        .eq('id', params.id as string)
        .single();

      if (error) {
        console.error("Erro ao buscar quadra:", error);
        return;
      }

      if (data) {
        setQuadra({
          id: data.id,
          nome: data.nome,
          territorio_nome: data.territorio?.nome,
          territorio_bairro: data.territorio?.bairro,
          territorio_id: data.territorio_id
        });

        // Agrupa os endereços por nome da rua
        const agrupados: Record<string, any[]> = {};
        
        // Vamos garantir que ordenamos pelo número adequadamente (numero é string, mas tentamos conversão)
        const sortedEnderecos = (data.enderecos || []).sort((a: any, b: any) => {
          const numA = parseInt(a.numero) || 0;
          const numB = parseInt(b.numero) || 0;
          return numA - numB;
        });

        sortedEnderecos.forEach((e: any) => {
          const rua = e.rua || 'Sem Rua';
          if (!agrupados[rua]) agrupados[rua] = [];
          agrupados[rua].push(e);
        });

        setEnderecosAgrupados(agrupados);
      }
    } catch (err) {
      console.error("Erro inesperado:", err);
    } finally {
      setLoading(false);
    }
  }

  const isVazioOuLivre = (status: string) => {
    if (!status) return true;
    const s = String(status).toLowerCase();
    return s === 'false' || s === 'null';
  };

  const handleEnderecoClick = (endereco: any) => {
    const isEndBloqueado = String(endereco.status).toLowerCase() === 'bloqueado' || endereco.is_bloqueado === true || String(endereco.is_bloqueado).toLowerCase() === 'true';

    // Se for "Não Visitar" ou estiver bloqueado
    if (isEndBloqueado) {
      alert("Este endereço está bloqueado (Não Visitar).");
      return;
    }

    // Se já estiver marcado, pergunta se quer desmarcar
    if (!isVazioOuLivre(endereco.status)) {
      const confirmar = window.confirm("Você gostaria de desmarcar essa casa?");
      if (confirmar) {
        atualizarStatusNoBanco(endereco.id, 'false');
      }
      return;
    }

    // Se estiver em branco (ou 'false'), abre o modal de ações
    setEnderecoSelecionado(endereco);
    setModalAberto(true);
  };

  const atualizarStatusNoBanco = async (enderecoId: string, novoStatus: string) => {
    try {
      // Cria a data atual para caso de marcação
      const hoje = String(novoStatus).toLowerCase() === 'false' ? null : new Date().toISOString().split('T')[0];

      // Atualiza na view state imediatamente pra UX ficar rápida
      setEnderecosAgrupados(prev => {
        const novo = { ...prev };
        for (const rua in novo) {
          novo[rua] = novo[rua].map(e => 
            e.id === enderecoId ? { ...e, status: novoStatus, data_visita: hoje } : e
          );
        }
        return novo;
      });

      setModalAberto(false);
      setEnderecoSelecionado(null);

      // Envia pro Supabase
      const { error } = await supabase
        .from('enderecos')
        .update({ 
          status: novoStatus,
          data_visita: hoje
        })
        .eq('id', enderecoId);
        
      if (error) {
        console.error("Erro ao salvar endereço:", error);
        alert("Houve um erro ao tentar salvar.");
        fetchQuadraEEnderecos(); // Refetch caso falhe
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatData = (dateString: string) => {
    if (!dateString) return "";
    const [year, month, day] = dateString.split('-');
    // Padrão visual do dev: "19/04/26"
    return `${day}/${month}/${year?.substring(2)}`;
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-500 font-medium">Carregando endereços...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 sm:p-4">
      <div className="bg-white min-h-screen sm:min-h-[calc(100vh-2rem)] max-w-4xl mx-auto rounded-t-3xl sm:rounded-3xl p-6 shadow-sm relative">
        
        {/* CABEÇALHO PADRONIZADO */}
        <header className="text-center pb-6 pt-2 px-1 relative">
          <h1 className="text-[22px] sm:text-3xl font-bold text-slate-800 tracking-tight uppercase">
            {quadra?.nome}
          </h1>
          
          <div className="relative mt-2 flex items-center justify-center">
            <button 
              onClick={() => setModalMapa(true)}
              className="absolute left-0 text-2xl drop-shadow-sm hover:scale-110 active:scale-95 transition-transform"
              aria-label="Ver Mapa"
            >
              🗺️
            </button>
            <p className="text-gray-500 text-[13px] sm:text-sm">
               {quadra?.territorio_nome} - {quadra?.territorio_bairro || 'Santa Rita'}
            </p>
            {quadra?.territorio_id ? (
              <Link 
                href={`/territorio/${quadra.territorio_id}`} 
                className="absolute right-0 bg-[#0A4D3C] text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm hover:scale-105 active:scale-95 transition-transform"
              >
                &lt; Voltar
              </Link>
            ) : (
               <button 
                 onClick={() => router.back()}
                 className="absolute right-0 bg-[#0A4D3C] text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm hover:scale-105 active:scale-95 transition-transform"
               >
                 &lt; Voltar
               </button>
            )}
          </div>
        </header>

        <p className="font-mono text-gray-500 tracking-tight text-sm mb-6 border-b border-gray-100 pb-6">
          Marque somente as casas que você<br/>conseguiu falar.
        </p>

        {/* LISTAGEM DE ENDEREÇOS AGRUPADOS */}
        <div className="w-full">
          {Object.entries(enderecosAgrupados).map(([rua, enderecos]) => (
            <div key={rua} className="mb-6 rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              
              {/* TÍTULO DA RUA */}
              <div className="bg-gray-50 px-4 py-3 font-semibold text-slate-800 text-sm border-b border-gray-100">
                {rua}
              </div>
              
              {/* GRID 2 COLUNAS */}
              <div className="grid grid-cols-2">
                {enderecos.map((end) => {
                  const taVazio = isVazioOuLivre(end.status);
                  const isBloqueado = String(end.status).toLowerCase() === 'bloqueado' || end.is_bloqueado === true || String(end.is_bloqueado).toLowerCase() === 'true';

                  let bgStatus = 'bg-white';
                  if (isBloqueado) {
                    bgStatus = 'bg-red-50/60 hover:bg-red-100/50';
                  } else if (!taVazio) {
                    if (String(end.status).toLowerCase() === 'cartas') {
                      bgStatus = 'bg-blue-50/60 hover:bg-blue-100/50';
                    } else {
                      bgStatus = 'bg-green-50/60 hover:bg-green-100/50';
                    }
                  } else {
                    bgStatus = 'bg-white hover:bg-slate-50';
                  }

                  return (
                    <button 
                      key={end.id}
                      onClick={() => handleEnderecoClick(end)}
                      className={`
                        w-full text-left p-3 flex items-center min-h-[48px]
                        ${bgStatus} transition-colors
                        border-b border-gray-100 
                        [&:nth-child(odd)]:border-r
                        [&:nth-last-child(-n+2)]:border-b-0
                      `}
                    >
                       <div className="flex items-center gap-2.5 w-full">
                         
                         {/* Lado Esquerdo: Ícone + Checkbox */}
                         <div className="flex items-center gap-1.5 flex-shrink-0 w-9 justify-end">
                            {!taVazio && !isBloqueado && (String(end.status).toLowerCase() === 'cartas' ? (
                              <span className="text-[12px] leading-none">✉️</span>
                            ) : (
                              <span className="text-[12px] leading-none">🗣️</span>
                            ))}
                            {isBloqueado && (
                              <span className="text-[10px] leading-none">❌</span>
                            )}
                            
                            {/* Checkbox em si */}
                            <div className={`w-5 h-5 rounded flex items-center justify-center border font-bold flex-shrink-0
                              ${!taVazio && !isBloqueado ? 'bg-slate-200 border-slate-300' : 'bg-white border-gray-300'}
                              ${isBloqueado ? 'bg-gray-100 border-gray-200' : ''}
                            `}>
                              {!taVazio && !isBloqueado && (
                                <Check size={12} className="text-slate-600" />
                              )}
                            </div>
                         </div>

                         {/* Lado Direito: Número e Data */}
                         <div className="flex items-center gap-1.5 flex-wrap">
                           <span className={`text-sm font-semibold leading-none ${isBloqueado ? 'line-through text-gray-500' : 'text-slate-800'}`}>
                             {end.numero}
                           </span>
                           {!taVazio && !isBloqueado && end.data_visita && (
                             <span className="text-[9px] text-gray-400 font-medium leading-none mt-[2px]">
                               ({formatData(end.data_visita)})
                             </span>
                           )}
                           {isBloqueado && (
                             <span className="text-[9px] text-gray-400 leading-none mt-[2px]">Não Visitar</span>
                           )}
                         </div>
                       </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* MODAL DE AÇÕES */}
        {modalAberto && enderecoSelecionado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center p-6 border-b border-gray-100">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">Nº {enderecoSelecionado.numero}</h3>
                  <p className="text-xs text-gray-500">{enderecoSelecionado.rua}</p>
                </div>
                <button 
                  onClick={() => setModalAberto(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="p-5 grid grid-cols-3 gap-3">
                <button 
                  onClick={() => atualizarStatusNoBanco(enderecoSelecionado.id, 'Falado')}
                  className="flex flex-col items-center justify-start p-3 rounded-2xl border border-gray-200 bg-white shadow-sm hover:border-green-400 hover:bg-green-50 focus:bg-green-50 active:scale-95 transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600 mb-2">
                    <UserCheck size={22} />
                  </div>
                  <span className="text-[10px] font-bold text-center text-slate-700 leading-snug">
                    Falei nessa<br/>casa
                  </span>
                </button>
                
                <button 
                  onClick={() => atualizarStatusNoBanco(enderecoSelecionado.id, 'Cartas')}
                  className="flex flex-col items-center justify-start p-3 rounded-2xl border border-gray-200 bg-white shadow-sm hover:border-blue-400 hover:bg-blue-50 focus:bg-blue-50 active:scale-95 transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
                    <Mail size={22} />
                  </div>
                  <span className="text-[10px] font-bold text-center text-slate-700 leading-snug">
                    Deixei uma<br/>carta
                  </span>
                </button>

                <button 
                  onClick={() => {
                    const confirmBlock = window.confirm("Certeza que deseja bloquear este endereço?");
                    if (confirmBlock) atualizarStatusNoBanco(enderecoSelecionado.id, 'bloqueado');
                  }}
                  className="flex flex-col items-center justify-start p-3 rounded-2xl border border-gray-200 bg-white shadow-sm hover:border-red-400 hover:bg-red-50 focus:bg-red-50 active:scale-95 transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-2">
                    <Ban size={22} />
                  </div>
                  <span className="text-[10px] font-bold text-center text-slate-700 leading-snug">
                    Não<br/>visitar
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DO MAPA */}
        {modalMapa && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-5 border-b border-gray-100">
                <h3 className="font-bold text-lg text-slate-800">Mapa Geral</h3>
                <button 
                  onClick={() => setModalMapa(false)} 
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
                >
                   <X size={18} />
                </button>
              </div>
              <div className="p-4 flex-1 overflow-auto bg-gray-50 flex items-center justify-center">
                <img 
                  src="/mapa-geral.jpg" 
                  alt="Mapa Geral" 
                  className="max-w-full rounded-xl shadow-sm border border-gray-200"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/eeeeee/888888?text=Imagem+nao+encontrada.%5CnAdicione+%22mapa-geral.jpg%22+na+pasta+public';
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
