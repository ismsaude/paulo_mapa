"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, Edit2, X, UserCheck, Mail, Ban, Map as MapIcon } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import DraggableEndereco from '@/components/DraggableEndereco';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import MapModal from '@/components/MapModal';

export default function QuadraPage() {
  const params = useParams();
  const router = useRouter();
  
  const [quadra, setQuadra] = useState<any>(null);
  const [enderecosAgrupados, setEnderecosAgrupados] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [isMapOpen, setIsMapOpen] = useState(false);

  // Estados do Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [enderecoSelecionado, setEnderecoSelecionado] = useState<any>(null);

  // Estados Admin e Edição
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNumero, setEditNumero] = useState("");
  const [editingRuaStr, setEditingRuaStr] = useState<string | null>(null);
  const [editRuaName, setEditRuaName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const adminMode = localStorage.getItem('isAdmin') === 'true';
    const role = localStorage.getItem('userRole');
    if (adminMode && role === 'admin') {
      setIsAdminUser(true);
    }
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
        
        // Retorna na ordem natural do banco de dados
        const sortedEnderecos = (data.enderecos || []);

        sortedEnderecos.forEach((e: any) => {
          const rua = e.rua || 'Sem Rua';
          if (!agrupados[rua]) agrupados[rua] = [];
          agrupados[rua].push(e);
        });

        // Ordena
        for (const rua in agrupados) {
          agrupados[rua].sort((a, b) => {
             // Se tiver ordem definida no BD, ela tem prioridade absoluta
             if (a.ordem !== undefined && b.ordem !== undefined && (a.ordem !== 0 || b.ordem !== 0)) {
               return (a.ordem || 0) - (b.ordem || 0);
             }

             // Se não tiver ordem, cai no sort normal (por número/SN)
             const numA = String(a.numero || '').toLowerCase().trim();
             const numB = String(b.numero || '').toLowerCase().trim();
             
             const isSnA = numA === 'sn' || numA === 's/n' || numA === 's.n' || numA === '';
             const isSnB = numB === 'sn' || numB === 's/n' || numB === 's.n' || numB === '';
             
             if (isSnA && !isSnB) return 1;
             if (!isSnA && isSnB) return -1;
             
             const matchA = numA.match(/\d+/);
             const matchB = numB.match(/\d+/);
             
             const intA = matchA ? parseInt(matchA[0], 10) : 0;
             const intB = matchB ? parseInt(matchB[0], 10) : 0;
             
             if (intA !== intB) return intA - intB;
             return numA.localeCompare(numB);
          });
        }

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

  const handleSaveNumero = async (id: string) => {
    if (!editNumero.trim()) { setEditId(null); return; }
    
    // update local
    setEnderecosAgrupados(prev => {
      const novo = { ...prev };
      for (const rua in novo) {
        novo[rua] = novo[rua].map(e => e.id === id ? { ...e, numero: editNumero } : e);
      }
      return novo;
    });
    setEditId(null);
    
    await supabase.from('enderecos').update({ numero: editNumero }).eq('id', id);
  };

  const handleSaveRua = async (oldRua: string) => {
    if (!editRuaName.trim() || editRuaName === oldRua) { setEditingRuaStr(null); return; }
    
    const endsToUpdate = enderecosAgrupados[oldRua];
    if (!endsToUpdate) return;
    
    // update local
    setEnderecosAgrupados(prev => {
      const novo = { ...prev };
      novo[editRuaName] = novo[oldRua].map(e => ({ ...e, rua: editRuaName }));
      delete novo[oldRua];
      return novo;
    });
    setEditingRuaStr(null);
    
    const ids = endsToUpdate.map((e: any) => e.id);
    await supabase.from('enderecos').update({ rua: editRuaName }).in('id', ids);
  };

  const handleDragEnd = async (event: DragEndEvent, ruaId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setEnderecosAgrupados((prev) => {
      const oldIndex = prev[ruaId].findIndex((x: any) => x.id === active.id);
      const newIndex = prev[ruaId].findIndex((x: any) => x.id === over.id);
      
      const newArray = arrayMove(prev[ruaId], oldIndex, newIndex);
      
      // Update the DB immediately in background
      Promise.all(newArray.map((end, index) => {
        return supabase.from('enderecos').update({ ordem: index }).eq('id', end.id);
      })).catch(err => console.error("Erro ao salvar ordem", err));

      return {
        ...prev,
        [ruaId]: newArray,
      };
    });
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
          <button 
            onClick={() => setIsMapOpen(true)}
            className="absolute left-0 top-0 text-[#0A4D3C] hover:text-[#083d2f] bg-[#0A4D3C]/10 hover:bg-[#0A4D3C]/20 p-2 rounded-full transition-all"
            title="Ver Mapa Geral"
          >
            <MapIcon size={20} />
          </button>

          <h1 className="text-[22px] sm:text-3xl font-bold text-slate-800 tracking-tight uppercase">
            {quadra?.nome}
          </h1>
          
          <div className="relative mt-2 flex items-center justify-center">
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
              {editingRuaStr === rua ? (
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center gap-2 w-full">
                  <input 
                    type="text" 
                    value={editRuaName}
                    onChange={e => setEditRuaName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveRua(rua)}
                    className="flex-1 border-b-2 border-slate-400 focus:border-[#0A4D3C] outline-none font-semibold text-slate-800 text-lg bg-gray-50"
                    autoFocus
                  />
                  <button onClick={() => handleSaveRua(rua)} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200">
                    <Check size={16} strokeWidth={3} />
                  </button>
                </div>
              ) : (
                <div className="bg-gray-50 px-4 py-3 font-semibold text-slate-800 text-lg border-b border-gray-100 flex items-center justify-between">
                  {rua}
                  {isAdminUser && (
                    <button 
                      onClick={() => { setEditRuaName(rua); setEditingRuaStr(rua); }}
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                      title="Editar nome da Rua"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                </div>
              )}
              
              {/* GRID 2 COLUNAS */}
              <DndContext 
                sensors={sensors} 
                collisionDetection={closestCenter} 
                onDragEnd={(e) => handleDragEnd(e, rua)}
              >
                <SortableContext items={enderecos.map(e => e.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2">
                    {enderecos.map((end) => {
                      const taVazio = isVazioOuLivre(end.status);
                      const isBloqueado = String(end.status).toLowerCase() === 'bloqueado' || end.is_bloqueado === true || String(end.is_bloqueado).toLowerCase() === 'true';

                      let bgStatus = 'bg-white';
                      if (isBloqueado) bgStatus = 'bg-red-50/60 hover:bg-red-100/50';
                      else if (!taVazio) {
                        if (String(end.status).toLowerCase() === 'cartas') bgStatus = 'bg-blue-50/60 hover:bg-blue-100/50';
                        else bgStatus = 'bg-green-50/60 hover:bg-green-100/50';
                      } else bgStatus = 'bg-white hover:bg-slate-50';

                      return (
                        <DraggableEndereco
                          key={end.id}
                          end={end}
                          onEnderecoClick={handleEnderecoClick}
                          isBloqueado={isBloqueado}
                          taVazio={taVazio}
                          bgStatus={bgStatus}
                          formatData={formatData}
                          isAdminUser={isAdminUser}
                          editId={editId}
                          editNumero={editNumero}
                          setEditNumero={setEditNumero}
                          handleSaveNumero={handleSaveNumero}
                          setEditId={setEditId}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
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
                  <span className="text-[9px] font-bold text-center text-slate-700 leading-tight">
                    Coloquei o convite<br/>do Congresso<br/>na caixa de correio
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
      </div>

      {isMapOpen && <MapModal onClose={() => setIsMapOpen(false)} />}
    </main>
  );
}
