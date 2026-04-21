"use client";
import { useState, useEffect } from 'react';
import { ArrowRight, X, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function Home() {
  const [territorios, setTerritorios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMapa, setModalMapa] = useState(false);

  // ... (use effect stays the same)
  useEffect(() => {
    async function fetchTerritorios() {
      try {
        const { data, error } = await supabase
          .from('territorios')
          .select('id, nome, bairro, quadras(id, nome, enderecos(status))')
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
                if (status === 'true' || status === 'falado' || status === 'cartas') {
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

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <p className="text-gray-500 font-medium">Carregando territórios...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12 relative">
      <Link href="/login" className="absolute top-6 right-6 text-gray-300 hover:text-gray-500 transition-colors z-10" title="Acesso Admin">
        <Settings size={20} />
      </Link>
      
      <header className="text-center py-8 px-4 max-w-4xl mx-auto relative">
        <h1 className="text-[22px] sm:text-3xl font-bold text-slate-800 tracking-tight">Territórios Jardim Santa Rita</h1>
        
        <div className="relative mt-2 flex items-center justify-center">
          <p className="text-gray-500">Escolha o território</p>
          <button 
            onClick={() => setModalMapa(true)}
            className="absolute right-0 text-2xl drop-shadow-sm hover:scale-110 active:scale-95 transition-transform"
            aria-label="Ver Mapa Geral"
          >
            🗺️
          </button>
        </div>
      </header>

      {/* GRID DE 2 COLUNAS FIXAS (Funciona em mobile e PC) */}
      <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto">
        {territorios.map((t) => (
          <Link href={`/territorio/${t.id}`} key={t.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center cursor-pointer transition-transform hover:scale-105">
            <h2 className="font-bold text-gray-800 uppercase text-center">{t.nome}</h2>
            <p className="text-[10px] text-gray-400 mb-4 uppercase">{t.bairro}</p>

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
                <span className="text-[9px] text-gray-400 mb-2 truncate max-w-full px-2" title={t.quadrasNomes}>
                  Quadras: {t.quadrasNomes}
                </span>
              )}
              <button className="text-[10px] font-bold text-blue-600 flex items-center justify-center gap-1 uppercase">
                VER QUADRAS <ArrowRight size={14} />
              </button>
            </div>
          </Link>
        ))}
      </div>

      {/* MODAL DO MAPA */}
      {modalMapa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h3 className="font-bold text-lg text-slate-800">Mapa do Território</h3>
              <button 
                onClick={() => setModalMapa(false)} 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
              >
                 <X size={18} />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto bg-gray-50 flex items-center justify-center">
              {/* === INSTRUÇÃO DE USO === */}
              {/* Para a imagem funcionar, adicione sua imagem na pasta "public" do seu projeto com o nome exato "mapa-geral.jpg" ou "mapa-geral.png" (e ajuste abaixo) */}
              {/* Se for uma URL da internet, troque "/mapa-geral.jpg" pela "https://endereco-da-imagem..." */}
              <img 
                src="/mapa-geral.jpg" 
                alt="Mapa Geral do Território" 
                className="max-w-full rounded-xl shadow-sm border border-gray-200"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/eeeeee/888888?text=Imagem+nao+encontrada.%5CnAdicione+%22mapa-geral.jpg%22+na+pasta+public';
                }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
