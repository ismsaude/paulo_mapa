"use client";
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function TerritorioPage() {
  const params = useParams();
  const [territorio, setTerritorio] = useState<any>(null);
  const [quadras, setQuadras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMapa, setModalMapa] = useState(false);

  useEffect(() => {
    async function fetchQuadras() {
      if (!params?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('territorios')
          .select('id, nome, bairro, quadras(id, nome, enderecos(status))')
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
              if (status === 'true' || status === 'falado' || status === 'cartas') {
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
              totalEnderecos
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

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-500 font-medium">Carregando quadras...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 sm:p-4">
      <div className="bg-white min-h-screen sm:min-h-[calc(100vh-2rem)] max-w-4xl mx-auto rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-sm">
        
        {/* CABEÇALHO */}
        <header className="text-center pb-8 pt-2 px-1 relative">
          <h1 className="text-[22px] sm:text-3xl font-bold text-slate-800 tracking-tight uppercase">
            {territorio?.nome} - {territorio?.bairro || 'Santa Rita'}
          </h1>
          
          <div className="relative mt-2 flex items-center justify-center">
            <button 
              onClick={() => setModalMapa(true)}
              className="absolute left-0 text-2xl drop-shadow-sm hover:scale-110 active:scale-95 transition-transform"
              aria-label="Ver Mapa"
            >
              🗺️
            </button>
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
              <Link 
                href={`/quadra/${q.id}`} 
                key={q.id} 
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center cursor-pointer transition-transform hover:scale-105"
              >
                <h2 className="font-bold text-slate-900 uppercase text-center mb-1">{q.nome}</h2>
                <p className="text-[10px] text-gray-400 mb-4 uppercase">{territorio?.bairro || 'Santa Rita'}</p>

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
                  <span className="text-[11px] text-gray-500 mb-1">{q.totalEnderecos} endereços</span>
                  <button className="text-[10px] font-bold text-blue-600 flex items-center justify-center gap-1 uppercase">
                    Ver endereços &rarr;
                  </button>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

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
    </main>
  );
}
