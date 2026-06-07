"use client";
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, X, Map as MapIcon, Edit2, Check, Settings, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import MapModal from '@/components/MapModal';

export default function TerritorioPage() {
  const params = useParams();
  const [territorio, setTerritorio] = useState<any>(null);
  const [quadras, setQuadras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isLogged, setIsLogged] = useState(false);

  // States para edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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
      return;
    }
    
    if (isAdmin === 'true') {
      setIsLogged(true);
      if (role === 'admin') setIsAdminUser(true);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('userRole');
    localStorage.removeItem('loginExpiry');
    setIsLogged(false);
    setIsAdminUser(false);
  };

  useEffect(() => {
    async function fetchQuadras() {
      if (!params?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('territorios')
          .select('id, nome, bairro, quadras(id, nome, enderecos(status, is_bloqueado))')
          .eq('id', params.id as string)
          .single();

        if (error) {
          console.error("Erro ao buscar as quadras do território:", error);
          return;
        }

        if (data) {
          setTerritorio({ nome: data.nome, bairro: data.bairro });

          const quadrasCalculadas = data.quadras?.map((q: any) => {
            let totalEnderecos = 0;
            let completos = 0;

            q.enderecos?.forEach((e: any) => {
              totalEnderecos++;
              const status = String(e.status).toLowerCase();
              const isBloqueado = status === 'bloqueado' || e.is_bloqueado === true || String(e.is_bloqueado).toLowerCase() === 'true';
              if (status === 'true' || status === 'falado' || status === 'cartas' || isBloqueado) {
                completos++;
              }
            });

            const progresso = totalEnderecos > 0 
              ? Math.round((completos / totalEnderecos) * 100) 
              : 0;

            return {
              id: q.id,
              nome: q.nome,
              progresso,
              totalEnderecos,
              completos
            };
          });
          
          quadrasCalculadas?.sort((a: any, b: any) => a.nome.localeCompare(b.nome));

          setQuadras(quadrasCalculadas || []);
        }
      } catch (err) {
        console.error("Erro inesperado:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchQuadras();
  }, [params?.id]);

  const getCircleColor = (prog: number) => {
    if (prog < 20) return "#f97316"; // orange
    if (prog < 75) return "#3b82f6"; // blue
    return "#22c55e"; // green
  };

  const handleSaveName = async (id: string) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    
    // Atualiza na tela imediatamente
    setQuadras(prev => prev.map(q => q.id === id ? { ...q, nome: editName } : q));
    setEditingId(null);

    // Salva no banco
    const { error } = await supabase
      .from('quadras')
      .update({ nome: editName })
      .eq('id', id);

    if (error) {
      console.error("Erro ao atualizar nome da quadra:", error);
      alert("Houve um erro ao tentar renomear a quadra.");
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-500 font-medium">Carregando quadras...</p>
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

      <div className="bg-white min-h-screen sm:min-h-[calc(100vh-2rem)] max-w-4xl mx-auto rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-sm">
        
        {/* CABEÇALHO */}
        <header className="text-center pb-8 pt-2 px-1 relative">
          <button 
            onClick={() => setIsMapOpen(true)}
            className="absolute left-0 top-0 text-[#0A4D3C] hover:text-[#083d2f] bg-[#0A4D3C]/10 hover:bg-[#0A4D3C]/20 p-2 rounded-full transition-all"
            title="Ver Mapa Geral"
          >
            <MapIcon size={20} />
          </button>

          <h1 className="text-[22px] sm:text-3xl font-bold text-slate-800 tracking-tight uppercase">
            {territorio?.nome} - {territorio?.bairro || 'Santa Rita'}
          </h1>
          
          <div className="relative mt-2 flex items-center justify-center">
            <p className="text-gray-500">Escolha a quadra</p>
            <Link 
              href="/" 
              className="absolute right-0 bg-[#0A4D3C] text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm hover:scale-105 active:scale-95 transition-transform"
            >
              &lt; Voltar
            </Link>
          </div>
        </header>

        {/* GRID DE QUADRAS */}
        <div className="grid grid-cols-2 gap-4">
          {quadras.length === 0 ? (
            <div className="col-span-2 text-center text-gray-400 py-8">
              Nenhuma quadra encontrada.
            </div>
          ) : (
            quadras.map((q) => (
              <div key={q.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center relative">
                
                {/* EDIÇÃO INLINE */}
                {editingId === q.id ? (
                  <div className="flex items-center justify-center gap-2 mb-1 w-full z-10" onClick={e => e.stopPropagation()}>
                    <input 
                      type="text" 
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveName(q.id)}
                      className="w-full text-center border-b-2 border-slate-400 focus:border-[#0A4D3C] outline-none font-bold text-slate-900 uppercase text-[12px] bg-gray-50"
                      autoFocus
                    />
                    <button onClick={() => handleSaveName(q.id)} className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                      <Check size={14} strokeWidth={3} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 mb-1 z-10 w-full" onClick={e => e.stopPropagation()}>
                    <h2 className="font-bold text-slate-900 uppercase text-center">{q.nome}</h2>
                    {isAdminUser && (
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditName(q.nome); setEditingId(q.id); }}
                        className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors flex-shrink-0"
                        title="Renomear quadra"
                      >
                        <Edit2 size={12} />
                      </button>
                    )}
                  </div>
                )}

                <p className="text-[10px] text-gray-400 mb-4 uppercase">{territorio?.bairro || 'Santa Rita'}</p>

                <Link href={`/quadra/${q.id}`} className="flex flex-col items-center cursor-pointer transition-transform hover:scale-[1.02] w-full">
                  {/* Círculo de Progresso */}
                  <div className="relative w-20 h-20 flex items-center justify-center mb-4">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="40" cy="40" r="34" stroke="#f1f5f9" strokeWidth="6" fill="none" />
                    <circle 
                      cx="40" cy="40" r="34" stroke={getCircleColor(q.progresso)} strokeWidth="6" fill="none" 
                      strokeDasharray="213" strokeDashoffset={213 - (213 * q.progresso) / 100}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute font-bold text-lg text-slate-800">{q.progresso}%</span>
                </div>
                
                <p className="text-[10px] text-gray-400 mb-4 uppercase">Concluído</p>

                <div className="w-full border-t border-gray-50 pt-3 flex flex-col items-center">
                  <span className="text-[11px] text-gray-500 mb-1 text-center leading-tight">
                    {q.totalEnderecos === 0 
                      ? 'Nenhuma casa'
                      : q.totalEnderecos === q.completos 
                        ? `Todas as ${q.totalEnderecos} casas concluídas`
                        : `Faltam ${q.totalEnderecos - q.completos} casas de ${q.totalEnderecos}`}
                  </span>
                  <button className="text-[10px] font-bold text-blue-600 flex items-center justify-center gap-1 uppercase mt-1">
                    Ver endereços &rarr;
                  </button>
                </div>
                </Link>
              </div>
            ))
          )}
        </div>
      </div>

      {isMapOpen && <MapModal onClose={() => setIsMapOpen(false)} />}
    </main>
  );
}
