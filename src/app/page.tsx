"use client";
import { useState, useEffect } from 'react';
import { ArrowRight, X, Settings, Map as MapIcon, Edit2, Check, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import MapModal from '@/components/MapModal';

export default function Home() {
  const [territorios, setTerritorios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // States para edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    // Checa se o usuário atual é admin logado
    const adminMode = localStorage.getItem('isAdmin') === 'true';
    const role = localStorage.getItem('userRole');
    if (adminMode) {
      setIsLoggedIn(true);
      if (role === 'admin') {
        setIsAdminUser(true);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('loginTime');
    setIsLoggedIn(false);
    setIsAdminUser(false);
    window.location.reload();
  };

  useEffect(() => {
    async function fetchTerritorios() {
      try {
        const { data, error } = await supabase
          .from('territorios')
          .select('id, nome, bairro, quadras(id, nome, enderecos(status, is_bloqueado))')
          .order('nome', { ascending: true });

        if (error) {
          console.error("Erro ao buscar territórios:", error);
          return;
        }

        if (data) {
          const territoriosCalculados = data.map((t: any) => {
            let totalEnderecos = 0;
            let completos = 0;

            t.quadras?.forEach((q: any) => {
              q.enderecos?.forEach((e: any) => {
                totalEnderecos++;
                const status = String(e.status).toLowerCase();
                const isBloqueado = status === 'bloqueado' || e.is_bloqueado === true || String(e.is_bloqueado).toLowerCase() === 'true';
                if (status === 'true' || status === 'falado' || status === 'cartas' || isBloqueado) {
                  completos++;
                }
              });
            });

            const progresso = totalEnderecos > 0 
              ? Math.round((completos / totalEnderecos) * 100) 
              : 0;

            const quadrasNomes = (t.quadras || [])
              .map((q: any) => {
                const match = String(q.nome || '').match(/\d+/);
                return match ? Number(match[0]) : q.nome;
              })
              .sort((a: any, b: any) => {
                if (typeof a === 'number' && typeof b === 'number') return a - b;
                return String(a).localeCompare(String(b));
              })
              .join(', ');

            return {
              id: t.id,
              nome: t.nome,
              bairro: t.bairro || 'Santa Rita',
              progresso,
              quadrasNomes
            };
          });

          setTerritorios(territoriosCalculados);
        }
      } catch (err) {
        console.error("Erro inesperado:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchTerritorios();
  }, []);

  const getCircleColor = (prog: number) => {
    if (prog < 20) return "#f97316"; // Laranja
    if (prog < 75) return "#3b82f6"; // Azul
    return "#22c55e"; // Verde
  };

  const handleSaveName = async (id: string) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    
    // Atualiza na tela imediatamente
    setTerritorios(prev => prev.map(t => t.id === id ? { ...t, nome: editName } : t));
    setEditingId(null);

    // Salva no banco de dados
    const { error } = await supabase
      .from('territorios')
      .update({ nome: editName })
      .eq('id', id);

    if (error) {
      console.error("Erro ao atualizar nome:", error);
      alert("Houve um erro ao tentar renomear o território.");
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <p className="text-gray-500 font-medium">Carregando territórios...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12 relative">
      <div className="absolute top-6 right-6 z-10 flex items-center gap-3">
        {isLoggedIn && (
          <button 
            onClick={handleLogout}
            className="text-red-400 hover:text-red-600 transition-colors bg-red-50 p-2 rounded-full" 
            title="Sair do sistema"
          >
            <LogOut size={20} />
          </button>
        )}
        <Link href="/login" className="text-[#0A4D3C] hover:text-[#083d2f] transition-colors bg-[#0A4D3C]/10 hover:bg-[#0A4D3C]/20 p-2 rounded-full" title="Configurações">
          <Settings size={20} />
        </Link>
      </div>
      
      <button 
        onClick={() => setIsMapOpen(true)}
        className="absolute top-6 left-6 text-[#0A4D3C] hover:text-[#083d2f] bg-[#0A4D3C]/10 hover:bg-[#0A4D3C]/20 p-2 rounded-full transition-all z-10"
        title="Ver Mapa Geral"
      >
        <MapIcon size={20} />
      </button>
      
      <header className="text-center py-8 px-4 max-w-4xl mx-auto relative">
        <h1 className="text-[22px] sm:text-3xl font-bold text-slate-800 tracking-tight">Territórios Jardim Santa Rita</h1>
        
        <div className="relative mt-2 flex items-center justify-center">
          <p className="text-gray-500">Escolha o território</p>
        </div>
      </header>

      {/* GRID DE 2 COLUNAS FIXAS (Funciona em mobile e PC) */}
      <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto">
        {territorios.map((t) => (
          <div key={t.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center relative">
            
            {/* EDIÇÃO INLINE */}
            {editingId === t.id ? (
              <div className="flex items-center justify-center gap-2 mb-2 w-full z-10" onClick={e => e.stopPropagation()}>
                <input 
                  type="text" 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveName(t.id)}
                  className="w-full text-center border-b-2 border-slate-400 focus:border-[#0A4D3C] outline-none font-bold text-gray-800 uppercase text-[13px] bg-gray-50"
                  autoFocus
                />
                <button onClick={() => handleSaveName(t.id)} className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                  <Check size={14} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 mb-1 z-10 w-full" onClick={e => e.stopPropagation()}>
                <h2 className="font-bold text-gray-800 uppercase text-center">{t.nome}</h2>
                {isAdminUser && (
                  <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditName(t.nome); setEditingId(t.id); }}
                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                    title="Renomear território"
                  >
                    <Edit2 size={12} />
                  </button>
                )}
              </div>
            )}
            
            <p className="text-[10px] text-gray-400 mb-4 uppercase">{t.bairro}</p>

            <Link href={`/territorio/${t.id}`} className="flex flex-col items-center cursor-pointer transition-transform hover:scale-[1.02] w-full">
              {/* Círculo de Progresso */}
              <div className="relative w-20 h-20 flex items-center justify-center mb-4">
              <svg className="w-full h-full -rotate-90">
                <circle cx="40" cy="40" r="34" stroke="#f1f5f9" strokeWidth="6" fill="none" />
                <circle 
                  cx="40" cy="40" r="34" stroke={getCircleColor(t.progresso)} strokeWidth="6" fill="none" 
                  strokeDasharray="213" strokeDashoffset={213 - (213 * t.progresso) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute font-bold text-lg">{t.progresso}%</span>
            </div>
            
            <p className="text-[10px] text-gray-400 mb-4 uppercase">Concluído</p>

            <div className="w-full border-t border-gray-100 pt-3 flex flex-col items-center">
              {t.quadrasNomes && (
                <span className="text-[12px] text-gray-500 font-medium mb-2 truncate max-w-full px-2" title={t.quadrasNomes}>
                  Quadras: {t.quadrasNomes}
                </span>
              )}
              <button className="text-[10px] font-bold text-blue-600 flex items-center justify-center gap-1 uppercase">
                VER QUADRAS <ArrowRight size={14} />
              </button>
            </div>
            </Link>
          </div>
        ))}
      </div>

      {isMapOpen && <MapModal onClose={() => setIsMapOpen(false)} />}
    </main>
  );
}
