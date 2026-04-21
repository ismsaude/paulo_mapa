"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UserCog, Plus, Trash2, Edit2, Shield, Key } from 'lucide-react';

export default function GerenciarUsuarios() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ id: '', nome: '', login: '', senha: '', tipo: 'admin' });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchUsuarios();
  }, []);

  async function fetchUsuarios() {
    setLoading(true);
    const { data } = await supabase.from('usuarios').select('*').order('nome');
    if (data) setUsuarios(data);
    setLoading(false);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.login || !formData.senha) return alert("Preencha todos os campos!");

    if (editing && formData.id) {
      if (!window.confirm("Deseja confirmar as atualizações deste usuário?")) return;
      const { error } = await supabase.from('usuarios').update({
        nome: formData.nome,
        login: formData.login,
        senha: formData.senha,
        tipo: formData.tipo
      }).eq('id', formData.id);
      
      if (error) alert("Erro ao atualizar: " + error.message);
    } else {
      const { error } = await supabase.from('usuarios').insert([{
        nome: formData.nome,
        login: formData.login,
        senha: formData.senha,
        tipo: formData.tipo
      }]);
      
      if (error) alert("Erro ao criar usuário: " + error.message);
    }

    setShowModal(false);
    resetForm();
    fetchUsuarios();
  };

  const handleEdit = (u: any) => {
    setFormData({ id: u.id, nome: u.nome, login: u.login, senha: u.senha, tipo: u.tipo });
    setEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (usuarios.length === 1) return alert("Você não pode deletar o último usuário restante!");
    if (!window.confirm("Tem certeza que deseja apagar este usuário definitivamente?")) return;

    const { error } = await supabase.from('usuarios').delete().eq('id', id);
    if (error) alert("Erro ao apagar: " + error.message);
    else fetchUsuarios();
  };

  const resetForm = () => {
    setFormData({ id: '', nome: '', login: '', senha: '', tipo: 'admin' });
    setEditing(false);
  };

  if (loading) {
     return <div className="p-8 text-center text-gray-500">Carregando usuários...</div>;
  }

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div className="flex items-center gap-3">
           <div className="p-3 bg-indigo-50 text-indigo-500 rounded-xl">
             <UserCog size={24} />
           </div>
           <div>
             <h2 className="text-xl font-bold text-slate-800">Contas de Acesso</h2>
             <p className="text-xs text-gray-500 font-medium">Nomes e senhas permitidos no sistema</p>
           </div>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-[#0A4D3C] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#083d2f] transition-all"
        >
          <Plus size={18} /> Novo Usuário
        </button>
      </div>

      <div className="grid gap-3">
        {usuarios.map(u => (
          <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-100 rounded-2xl bg-gray-50 hover:border-indigo-100 transition-all gap-4">
             <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold tracking-tighter">
                  {u.nome.substring(0, 2).toUpperCase()}
               </div>
               <div>
                  <p className="font-bold text-slate-800 text-[15px]">{u.nome}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Shield size={12} className="text-indigo-400"/> {u.login} &bull; <Key size={12} className="text-orange-400 ml-1"/> {u.senha}</p>
               </div>
             </div>
             <div className="flex items-center gap-2 mt-2 sm:mt-0 border-t sm:border-t-0 pt-3 sm:pt-0">
               <button onClick={() => handleEdit(u)} className="p-2 text-slate-400 hover:text-blue-600 bg-white border border-gray-200 rounded-lg shadow-sm">
                 <Edit2 size={16} />
               </button>
               <button onClick={() => handleDelete(u.id)} className="p-2 text-slate-400 hover:text-red-600 bg-white border border-gray-200 rounded-lg shadow-sm">
                 <Trash2 size={16} />
               </button>
             </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
               <div className="bg-indigo-50 text-indigo-600 p-2 rounded-lg"><UserCog size={20} /></div>
               <h3 className="text-xl font-bold text-slate-800">{editing ? 'Editar Usuário' : 'Novo Usuário'}</h3>
            </div>
            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
               <div>
                 <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Nome completo</label>
                 <input type="text" required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-400 bg-gray-50" placeholder="Ex: João Silva" />
               </div>
               <div>
                 <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Nome de Login</label>
                 <input type="text" required value={formData.login} onChange={e => setFormData({...formData, login: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-400 bg-gray-50 lowercase" placeholder="Ex: joao" />
               </div>
               <div>
                 <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Senha Restrita</label>
                 <input type="text" required value={formData.senha} onChange={e => setFormData({...formData, senha: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-400 bg-gray-50" placeholder="Defina a senha" />
               </div>
               <div className="mt-4 flex gap-3">
                 <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 py-3 rounded-xl font-bold text-slate-600 hover:bg-gray-50">Cancelar</button>
                 <button type="submit" className="flex-1 bg-[#0A4D3C] hover:bg-[#083d2f] py-3 rounded-xl font-bold text-white shadow-sm">Salvar</button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
