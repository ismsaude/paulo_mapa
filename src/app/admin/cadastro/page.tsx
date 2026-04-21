"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Map, Grid, MapPin, Plus, CheckCircle2, RefreshCw, Database, Trash2, Edit2, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function CadastroPage() {
  const router = useRouter();
  const [territorios, setTerritorios] = useState<any[]>([]);
  const [quadras, setQuadras] = useState<any[]>([]);

  // Estados dos forms
  const [novoTerritorioNome, setNovoTerritorioNome] = useState('');
  
  const [novaQuadraNome, setNovaQuadraNome] = useState('');
  const [novaQuadraTerritorioId, setNovaQuadraTerritorioId] = useState('');
  
  const [novoEndRua, setNovoEndRua] = useState('');
  const [novoEndNumero, setNovoEndNumero] = useState(''); // Pode aceitar vários separados por vírgula no futuro
  const [novoEndTerritorioId, setNovoEndTerritorioId] = useState('');
  const [novoEndQuadraId, setNovoEndQuadraId] = useState('');

  // Mode View State
  const [viewMode, setViewMode] = useState<'create' | 'list'>('create');
  
  // List States
  const [selectedListTerritorioId, setSelectedListTerritorioId] = useState('');
  const [expandedQuadraId, setExpandedQuadraId] = useState('');
  const [quadraEnderecos, setQuadraEnderecos] = useState<any[]>([]);

  const [loadingMsg, setLoadingMsg] = useState('');

  useEffect(() => {
    const isAdmin = localStorage.getItem('isAdmin');
    if (!isAdmin) {
      router.push('/login');
      return;
    }
    fetchBaseData();
  }, [router]);

  async function fetchBaseData() {
    const { data: terrs } = await supabase.from('territorios').select('*').order('nome');
    if (terrs) setTerritorios(terrs);

    const { data: quads } = await supabase.from('quadras').select('*').order('nome');
    if (quads) setQuadras(quads);
  }

  const handleCreateTerritorio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTerritorioNome) return;
    setLoadingMsg('Criando território...');

    const { error } = await supabase.from('territorios').insert([{ nome: novoTerritorioNome }]);

    setLoadingMsg('');
    if (error) {
      alert("Erro ao criar: " + error.message);
    } else {
      setNovoTerritorioNome('');
      alert("Território criado com sucesso!");
      fetchBaseData();
    }
  };

  const handleCreateQuadra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaQuadraNome || !novaQuadraTerritorioId) return;
    setLoadingMsg('Criando quadra...');

    const { error } = await supabase.from('quadras').insert([{ 
      nome: novaQuadraNome, 
      territorio_id: novaQuadraTerritorioId 
    }]);

    setLoadingMsg('');
    if (error) {
      alert(`Erro Supabase: ${error.message} \nDetalhes: ${error.details || 'Sem detalhes adic.'}`);
      console.error(error);
    } else {
      setNovaQuadraNome('');
      alert("Quadra criada com sucesso!");
      fetchBaseData();
    }
  };

  const handleCreateEndereco = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoEndRua || !novoEndNumero || !novoEndQuadraId) return;
    setLoadingMsg('Adicionando endereço(s)...');

    // Suporte a múltiplos números separados por vírgula
    const numeros = novoEndNumero.split(',').map(n => n.trim()).filter(n => n.length > 0);
    const inserts = numeros.map(num => ({
      rua: novoEndRua,
      numero: num,
      quadra_id: novoEndQuadraId,
      status: 'false',
      is_bloqueado: false
    }));

    const { error } = await supabase.from('enderecos').insert(inserts);

    setLoadingMsg('');
    if (error) {
      alert("Erro ao criar: " + error.message);
    } else {
      setNovoEndNumero('');
      // mantem a rua e a quadra caso queira adicionar mais
      alert(`${numeros.length} endereço(s) adicionado(s) com sucesso!`);
    }
  };

  // Funções de Gestão e Deleção
  async function fetchQuadraEnderecos(quadraId: string) {
    if (!quadraId) {
      setQuadraEnderecos([]);
      return;
    }
    setLoadingMsg('Buscando endereços...');
    const { data } = await supabase.from('enderecos').select('*').eq('quadra_id', quadraId);
    if (data) {
       const sorted = data.sort((a, b) => {
         const numA = parseInt(a.numero) || 0;
         const numB = parseInt(b.numero) || 0;
         return numA - numB;
       });
       setQuadraEnderecos(sorted);
    }
    setLoadingMsg('');
  }

  // --- Deletes ---
  async function handleDeleteTerritorio(id: string) {
     if (!window.confirm("PERIGO: Isso excluirá o território e absolutamente TODAS AS QUADRAS e TODOS OS ENDEREÇOS vinculados a ele! Ação DEFINITIVA e IRREVERSÍVEL. Quer mesmo apagar?")) return;
     setLoadingMsg('Apagando território e cascata...');
     await supabase.from('territorios').delete().eq('id', id);
     fetchBaseData();
     setSelectedListTerritorioId('');
     setLoadingMsg('');
  }

  async function handleDeleteQuadra(id: string) {
     if (!window.confirm("Atenção: Excluir esta quadra e todos as SUAS CASAS registradas? Ação irreversível!")) return;
     setLoadingMsg('Apagando quadra e endereços...');
     await supabase.from('quadras').delete().eq('id', id);
     fetchBaseData();
     setExpandedQuadraId('');
     setLoadingMsg('');
  }

  async function handleDeleteEndereco(id: string) {
     if (!window.confirm("Certeza que deseja remover apenas esta casa do sistema?")) return;
     setLoadingMsg('Apagando endereço...');
     await supabase.from('enderecos').delete().eq('id', id);
     fetchQuadraEnderecos(expandedQuadraId);
  }

  // --- Edits ---
  async function handleEditTerritorio(id: string, name: string) {
     const novo = window.prompt("Renomeie o Território:", name);
     if (novo && novo.trim() !== '' && novo !== name) {
        setLoadingMsg('Atualizando...');
        await supabase.from('territorios').update({ nome: novo }).eq('id', id);
        fetchBaseData();
        setLoadingMsg('');
     }
  }

  async function handleEditQuadra(id: string, name: string) {
     const novo = window.prompt("Modificar identificação da Quadra:", name);
     if (novo && novo.trim() !== '' && novo !== name) {
        setLoadingMsg('Atualizando...');
        await supabase.from('quadras').update({ nome: novo }).eq('id', id);
        fetchBaseData();
        setLoadingMsg('');
     }
  }

  async function handleEditEndereco(id: string, rua: string, numero: string) {
     const novaRua = window.prompt("Modificar nome da Rua:", rua);
     if (novaRua === null) return;
     const novoNum = window.prompt("Modificar Número:", numero);
     if (novoNum === null) return;
     
     if ((novaRua.trim() !== rua) || (novoNum.trim() !== numero)) {
        setLoadingMsg('Salvando edição...');
        await supabase.from('enderecos').update({ rua: novaRua || rua, numero: novoNum || numero }).eq('id', id);
        fetchQuadraEnderecos(expandedQuadraId);
     }
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 -ml-2 text-slate-400 hover:text-slate-600 bg-gray-50 rounded-full transition-colors">
              <ChevronLeft size={24} />
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Gerenciamento de Base</h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-8 pt-8">

        {/* CONTROLES DE TABS */}
        <div className="flex bg-gray-200/50 p-1 rounded-2xl mb-8 w-full sm:w-fit mx-auto border border-gray-100">
           <button onClick={() => setViewMode('create')} className={`flex-1 sm:px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${viewMode === 'create' ? 'bg-white text-slate-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
             📝 Criar Novos
           </button>
           <button onClick={() => setViewMode('list')} className={`flex-1 sm:px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
             🔎 Visualizar / Editar
           </button>
        </div>

        {loadingMsg && (
          <div className="bg-blue-50 text-blue-700 p-4 rounded-xl mb-6 font-medium text-center border border-blue-100 flex items-center justify-center gap-2">
            <RefreshCw className="animate-spin" size={18} /> {loadingMsg}
          </div>
        )}

        {viewMode === 'create' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* ADD TERRITÓRIO */}
          <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 h-fit">
            <div className="flex items-center gap-3 mb-6 border-b border-gray-50 pb-4">
              <div className="bg-blue-50 text-blue-500 p-3 rounded-2xl">
                <Map size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Novo Território</h2>
                <p className="text-xs text-gray-400">Adicione uma ampla região (Ex: T1, T2)</p>
              </div>
            </div>
            
            <form onSubmit={handleCreateTerritorio} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Nome do Território</label>
                <input 
                  type="text" 
                  value={novoTerritorioNome}
                  onChange={(e) => setNovoTerritorioNome(e.target.value)}
                  placeholder="Ex: T14 ou Jd. Imperial" 
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all font-medium text-slate-800 placeholder:text-gray-300"
                  required
                />
              </div>
              <button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl px-4 py-3 transition-colors flex justify-center items-center gap-2">
                <Plus size={18} /> Salvar Território
              </button>
            </form>
          </section>

          {/* ADD QUADRA */}
          <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 h-fit">
            <div className="flex items-center gap-3 mb-6 border-b border-gray-50 pb-4">
              <div className="bg-emerald-50 text-emerald-500 p-3 rounded-2xl">
                <Grid size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Nova Quadra</h2>
                <p className="text-xs text-gray-400">Vincule a um território existente.</p>
              </div>
            </div>

            <form onSubmit={handleCreateQuadra} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Território correspondente</label>
                <select 
                  value={novaQuadraTerritorioId}
                  onChange={(e) => setNovaQuadraTerritorioId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all font-medium text-slate-800"
                  required
                >
                  <option value="">-- Selecione o território --</option>
                  {territorios.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Identificação da Quadra</label>
                <input 
                  type="text" 
                  value={novaQuadraNome}
                  onChange={(e) => setNovaQuadraNome(e.target.value)}
                  placeholder="Ex: QD 1 ou Bloco A" 
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all font-medium text-slate-800 placeholder:text-gray-300"
                  required
                />
              </div>
              <button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl px-4 py-3 transition-colors flex justify-center items-center gap-2">
                <Plus size={18} /> Salvar Quadra
              </button>
            </form>
          </section>

          {/* ADD ENDEREÇO */}
          <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 h-fit md:col-span-2">
            <div className="flex items-center gap-3 mb-6 border-b border-gray-50 pb-4">
              <div className="bg-[#0A4D3C]/10 text-[#0A4D3C] p-3 rounded-2xl">
                <MapPin size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Novos Endereços</h2>
                <p className="text-xs text-gray-400">Cadastre casas individuais ou edifícios.</p>
              </div>
            </div>

            <form onSubmit={handleCreateEndereco} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="md:col-span-2 flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Para o Território:</label>
                  <select 
                    value={novoEndTerritorioId}
                    onChange={(e) => setNovoEndTerritorioId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#0A4D3C] focus:ring-4 focus:ring-[#0A4D3C]/10 transition-all font-medium text-slate-800"
                    required
                  >
                    <option value="">-- Selecione o território --</option>
                    {territorios.map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">E para a Quadra:</label>
                  <select 
                    value={novoEndQuadraId}
                    onChange={(e) => setNovoEndQuadraId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#0A4D3C] focus:ring-4 focus:ring-[#0A4D3C]/10 transition-all font-medium text-slate-800"
                    disabled={!novoEndTerritorioId}
                    required
                  >
                    <option value="">-- Selecione a quadra --</option>
                    {quadras.filter(q => q.territorio_id === novoEndTerritorioId).map(q => (
                      <option key={q.id} value={q.id}>{q.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Logradouro / Rua</label>
                <input 
                  type="text" 
                  value={novoEndRua}
                  onChange={(e) => setNovoEndRua(e.target.value)}
                  placeholder="Ex: Rua das Flores" 
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#0A4D3C] focus:ring-4 focus:ring-[#0A4D3C]/10 transition-all font-medium text-slate-800 placeholder:text-gray-300"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Número(s)</label>
                <input 
                  type="text" 
                  value={novoEndNumero}
                  onChange={(e) => setNovoEndNumero(e.target.value)}
                  placeholder="Ex: 123 ou 123, 125, 127" 
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#0A4D3C] focus:ring-4 focus:ring-[#0A4D3C]/10 transition-all font-medium text-slate-800 placeholder:text-gray-300"
                  required
                />
                <p className="text-[10px] text-gray-400 mt-1 ml-1">*Para adicionar várias casas dessa mesma quadra e rua, separe por vírgula.</p>
              </div>

              <div className="md:col-span-2 pt-2">
                <button type="submit" className="w-full bg-[#0A4D3C] hover:bg-[#083d2f] text-white font-bold rounded-2xl px-4 py-4 transition-colors flex justify-center items-center gap-2 active:scale-95 shadow-sm">
                  <CheckCircle2 size={20} /> Cadastrar Endereços no Sistema
                </button>
              </div>

            </form>
          </section>

        </div>
        )}

        {/* MODO LISTAGEM E EDIÇÃO (COFRE DE DADOS) */}
        {viewMode === 'list' && (
           <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-gray-100 w-full min-h-[50vh]">
              <div className="flex items-center gap-3 mb-6 border-b border-gray-50 pb-4">
                <div className="bg-slate-50 text-slate-600 p-3 rounded-2xl"><Database size={24} /></div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Cofre de Dados</h2>
                  <p className="text-xs text-gray-400">Navegue na estrutura para editar ou apagar registros salvos.</p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Exibindo qual território?</label>
                <select 
                  value={selectedListTerritorioId}
                  onChange={(e) => {
                    setSelectedListTerritorioId(e.target.value);
                    setExpandedQuadraId('');
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-slate-400 transition-all font-medium text-slate-800"
                >
                  <option value="">-- Escolha um território da base --</option>
                  {territorios.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </div>

              {selectedListTerritorioId && (() => {
                 const t = territorios.find(tx => tx.id === selectedListTerritorioId);
                 const quads = quadras.filter(qx => qx.territorio_id === selectedListTerritorioId);
                 
                 return (
                   <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                     <div className="flex justify-between items-center bg-slate-800 text-white p-4 sm:p-5 rounded-2xl">
                       <span className="font-bold text-lg sm:text-xl uppercase tracking-tight">{t?.nome}</span>
                       <div className="flex gap-2">
                         <button onClick={() => handleEditTerritorio(t.id, t.nome)} className="p-2 sm:px-4 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors font-bold text-[11px] sm:text-xs flex items-center gap-2"><Edit2 size={14} /> <span className="hidden sm:inline">Renomear</span></button>
                         <button onClick={() => handleDeleteTerritorio(t.id)} className="p-2 sm:px-4 bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white rounded-xl transition-colors font-bold text-[11px] sm:text-xs flex items-center gap-2"><Trash2 size={14} /> <span className="hidden sm:inline">Apagar</span></button>
                       </div>
                     </div>

                     <div className="mt-4 pl-2 sm:pl-4 border-l-2 border-gray-100 flex flex-col gap-3">
                       {quads.length === 0 ? <p className="text-sm text-gray-400 py-4 pl-2">Nenhuma quadra ligada a este território.</p> : null}
                       
                       {quads.map(q => (
                         <div key={q.id} className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                           <div className="flex justify-between items-center p-3 sm:p-4 cursor-pointer hover:bg-gray-100/50" onClick={() => {
                             if (expandedQuadraId === q.id) {
                               setExpandedQuadraId('');
                             } else {
                               setExpandedQuadraId(q.id);
                               fetchQuadraEnderecos(q.id);
                             }
                           }}>
                             <div className="flex items-center gap-2">
                               {expandedQuadraId === q.id ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
                               <span className="font-bold text-slate-700 text-base">Quadra {q.nome}</span>
                             </div>
                             <div className="flex gap-1 sm:gap-2">
                               <button onClick={(e) => { e.stopPropagation(); handleEditQuadra(q.id, q.nome); }} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
                               <button onClick={(e) => { e.stopPropagation(); handleDeleteQuadra(q.id); }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                             </div>
                           </div>

                           {expandedQuadraId === q.id && (
                             <div className="bg-white p-3 sm:p-5 border-t border-gray-100">
                               <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Endereços Registrados</p>
                               {quadraEnderecos.length === 0 && <p className="text-sm text-gray-400 px-1 py-2">Quadra vazia. Sem casas cadastradas.</p>}
                               <div className="flex flex-col gap-2">
                                 {quadraEnderecos.map(end => (
                                   <div key={end.id} className="flex justify-between items-center bg-gray-50 px-4 py-3 rounded-xl text-sm border border-gray-100 transition-all hover:border-gray-200">
                                      <span className="text-slate-700"><b className="text-slate-900 border-r border-gray-200 pr-2 mr-2">Nº {end.numero}</b> {end.rua}</span>
                                      <div className="flex gap-1">
                                        <button onClick={() => handleEditEndereco(end.id, end.rua, end.numero)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                                        <button onClick={() => handleDeleteEndereco(end.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                                      </div>
                                   </div>
                                 ))}
                               </div>
                             </div>
                           )}
                         </div>
                       ))}
                     </div>
                   </div>
                 );
              })()}
           </div>
        )}

      </div>
    </main>
  );
}
