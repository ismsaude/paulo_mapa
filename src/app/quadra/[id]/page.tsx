"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, Edit2, X, UserCheck, Mail, Ban, Map as MapIcon, Settings, LogOut, Trash2 } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, rectSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable';
import DraggableEndereco from '@/components/DraggableEndereco';
import DraggableRua from '@/components/DraggableRua';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import MapModal from '@/components/MapModal';

export default function QuadraPage() {
  const params = useParams();
  const router = useRouter();
  
  const [quadra, setQuadra] = useState<any>(null);
  const [ruasAgrupadas, setRuasAgrupadas] = useState<{rua: string, ordem_rua: number, enderecos: any[]}[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMapOpen, setIsMapOpen] = useState(false);

  // Estados do Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [enderecoSelecionado, setEnderecoSelecionado] = useState<any>(null);

  // Estados Admin e Edição
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isLogged, setIsLogged] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNumero, setEditNumero] = useState("");
  const [editingRuaStr, setEditingRuaStr] = useState<string | null>(null);
  const [editRuaName, setEditRuaName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const isAdmin = localStorage.getItem('isAdmin');
    const role = localStorage.getItem('userRole');
    const expiry = localStorage.getItem('loginExpiry');
    
    if (isAdmin === 'true' && expiry && Date.now() > parseInt(expiry, 10)) {
      localStorage.removeItem('isAdmin');
      localStorage.removeItem('userRole');
      localStorage.removeItem('loginExpiry');
      setIsLogged(false);
      setIsAdminUser(false);
    } else if (isAdmin === 'true') {
      setIsLogged(true);
      if (role === 'admin') setIsAdminUser(true);
    }
    
    fetchQuadraEEnderecos();
  }, [params?.id]);

  const handleLogout = () => {
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('userRole');
    localStorage.removeItem('loginExpiry');
    setIsLogged(false);
    setIsAdminUser(false);
  };

  // Escutar mudanças em tempo real no banco
  useEffect(() => {
    if (!params?.id) return;

    const channel = supabase
      .channel('realtime-enderecos')
      .on(
        'postgres_changes',
        {
          event: '*', // UPDATE, INSERT, DELETE
          schema: 'public',
          table: 'enderecos',
          filter: `quadra_id=eq.${params.id}`
        },
        () => {
          // Quando alguém alterar um endereço (ex: marcar), atualiza a lista
          fetchQuadraEEnderecos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

        // Converte para Array de Ruas
        const ruasArray = Object.keys(agrupados).map(rua => {
           const ordem_rua = agrupados[rua].find(e => e.ordem_rua && e.ordem_rua !== 0)?.ordem_rua || 0;
           return {
             rua,
             ordem_rua,
             enderecos: agrupados[rua]
           }
        });

        // Ordena as ruas entre si
        ruasArray.sort((a, b) => {
          if (a.ordem_rua !== 0 || b.ordem_rua !== 0) {
            return a.ordem_rua - b.ordem_rua;
          }
          return a.rua.localeCompare(b.rua);
        });

        // Ordena os endereços dentro de cada rua
        ruasArray.forEach(r => {
          r.enderecos.sort((a, b) => {
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
        });

        setRuasAgrupadas(ruasArray);
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
      setRuasAgrupadas(prev => {
        const novo = [...prev];
        for (let i = 0; i < novo.length; i++) {
          novo[i].enderecos = novo[i].enderecos.map(e => 
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
    setRuasAgrupadas(prev => {
      const novo = [...prev];
      for (let i = 0; i < novo.length; i++) {
        novo[i].enderecos = novo[i].enderecos.map(e => e.id === id ? { ...e, numero: editNumero } : e);
      }
      return novo;
    });
    setEditId(null);
    
    await supabase.from('enderecos').update({ numero: editNumero }).eq('id', id);
  };

  const handleSaveRua = async (oldRua: string) => {
    if (!editRuaName.trim() || editRuaName === oldRua) { setEditingRuaStr(null); return; }
    
    const ruaIndex = ruasAgrupadas.findIndex(r => r.rua === oldRua);
    if (ruaIndex === -1) return;
    
    // update local
    setRuasAgrupadas(prev => {
      const novo = [...prev];
      novo[ruaIndex] = { 
        ...novo[ruaIndex], 
        rua: editRuaName,
        enderecos: novo[ruaIndex].enderecos.map(e => ({ ...e, rua: editRuaName }))
      };
      return novo;
    });
    setEditingRuaStr(null);
    
    const ids = ruasAgrupadas[ruaIndex].enderecos.map((e: any) => e.id);
    await supabase.from('enderecos').update({ rua: editRuaName }).in('id', ids);
  };

  const handleDeleteEndereco = async (id: string) => {
    const confirmar = window.confirm("Certeza absoluta que deseja excluir este número de casa?");
    if (!confirmar) return;

    // update local
    setRuasAgrupadas(prev => {
      const novo = [...prev];
      for (let i = 0; i < novo.length; i++) {
        novo[i].enderecos = novo[i].enderecos.filter(e => e.id !== id);
      }
      return novo.filter(r => r.enderecos.length > 0); // remove rua se ficar vazia
    });

    await supabase.from('enderecos').delete().eq('id', id);
  };

  const handleDeleteRua = async (ruaName: string) => {
    const confirmar = window.confirm(`Certeza que deseja excluir TODAS as casas da rua "${ruaName}"?`);
    if (!confirmar) return;

    const ruaIndex = ruasAgrupadas.findIndex(r => r.rua === ruaName);
    if (ruaIndex === -1) return;

    const ids = ruasAgrupadas[ruaIndex].enderecos.map((e: any) => e.id);

    // update local
    setRuasAgrupadas(prev => prev.filter(r => r.rua !== ruaName));

    await supabase.from('enderecos').delete().in('id', ids);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Se estiver arrastando uma RUA inteira
    if (activeId.startsWith('rua-') && overId.startsWith('rua-')) {
       setRuasAgrupadas(prev => {
          const oldIndex = prev.findIndex(r => `rua-${r.rua}` === activeId);
          const newIndex = prev.findIndex(r => `rua-${r.rua}` === overId);
          const newArray = arrayMove(prev, oldIndex, newIndex);
          
          // Salva ordem das ruas no BD
          Promise.all(newArray.map((r, index) => {
             const ids = r.enderecos.map((e: any) => e.id);
             return supabase.from('enderecos').update({ ordem_rua: index }).in('id', ids);
          })).catch(err => console.error("Erro ao salvar ordem das ruas", err));

          return newArray;
       });
       return;
    }

    // Se estiver arrastando um ENDEREÇO dentro da rua
    let ruaIndex = -1;
    let isEnderecoDrag = false;

    // Acha a rua que contém este endereço (assumindo drag and drop apenas dentro da mesma rua por enquanto)
    for (let i = 0; i < ruasAgrupadas.length; i++) {
       if (ruasAgrupadas[i].enderecos.some(e => String(e.id) === activeId)) {
          ruaIndex = i;
          isEnderecoDrag = true;
          break;
       }
    }

    if (isEnderecoDrag && ruaIndex !== -1) {
       setRuasAgrupadas(prev => {
          const novo = [...prev];
          const oldIndex = novo[ruaIndex].enderecos.findIndex(x => String(x.id) === activeId);
          const newIndex = novo[ruaIndex].enderecos.findIndex(x => String(x.id) === overId);
          
          if (oldIndex !== -1 && newIndex !== -1) {
             const newArray = arrayMove(novo[ruaIndex].enderecos, oldIndex, newIndex);
             novo[ruaIndex] = { ...novo[ruaIndex], enderecos: newArray };
             
             // Salva no BD em bg
             Promise.all(newArray.map((end, index) => {
                return supabase.from('enderecos').update({ ordem: index }).eq('id', end.id);
             })).catch(err => console.error("Erro ao salvar ordem dos endereços", err));
          }
          return novo;
       });
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
    <main className="min-h-screen bg-gray-50 sm:p-4 relative">
      <div className="absolute top-6 right-6 hidden sm:flex items-center gap-2 z-20">
        {isLogged ? (
          <>
             <Link href="/admin" className="text-[#0A4D3C] bg-[#0A4D3C]/10 hover:bg-[#0A4D3C]/20 px-3 py-1.5 rounded-full text-sm font-bold transition-all" title="Painel de Administração">
                Admin
             </Link>
             <button onClick={handleLogout} className="text-red-500 bg-red-50 hover:bg-red-100 p-2 rounded-full transition-all" title="Sair">
                <LogOut size={16} />
             </button>
          </>
        ) : (
          <Link href="/login" className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors" title="Acesso Admin">
            <Settings size={20} />
          </Link>
        )}
      </div>

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
          <DndContext 
            sensors={sensors} 
            collisionDetection={closestCenter} 
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={ruasAgrupadas.map(r => `rua-${r.rua}`)} strategy={verticalListSortingStrategy}>
              {ruasAgrupadas.map((ruaGroup) => (
                <DraggableRua 
                  key={ruaGroup.rua}
                  rua={ruaGroup.rua}
                  ruaData={ruaGroup}
                  isAdminUser={isAdminUser}
                  editingRuaStr={editingRuaStr}
                  editRuaName={editRuaName}
                  setEditRuaName={setEditRuaName}
                  handleSaveRua={handleSaveRua}
                  setEditingRuaStr={setEditingRuaStr}
                  handleDeleteRua={handleDeleteRua}
                >
                  <SortableContext items={ruaGroup.enderecos.map(e => e.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-2">
                      {ruaGroup.enderecos.map((end) => {
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
                            handleDeleteEndereco={handleDeleteEndereco}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DraggableRua>
              ))}
            </SortableContext>
          </DndContext>
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
                    Coloquei uma<br/>carta
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
