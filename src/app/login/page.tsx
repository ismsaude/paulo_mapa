"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario || !senha) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('login', usuario.toLowerCase().trim())
      .limit(1)
      .single();

    setLoading(false);

    if (data && data.senha === senha) {
      localStorage.setItem("isAdmin", "true");
      localStorage.setItem("userName", data.nome);
      localStorage.setItem("userRole", data.tipo);
      router.push("/admin");
    } else {
      alert("Usuário ou senha incorretos!");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-sm border border-gray-100 flex flex-col items-center">
        <div className="w-16 h-16 bg-[#0A4D3C]/10 text-[#0A4D3C] rounded-full flex items-center justify-center mb-6">
          <Lock size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Acesso Restrito</h1>
        <p className="text-gray-500 text-sm text-center mb-8">Faça login para gerenciar o sistema e realizar os bloqueios.</p>
        
        <form onSubmit={handleLogin} className="w-full flex flex-col gap-3">
          <input 
            type="text" 
            placeholder="Usuário" 
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#0A4D3C] transition-colors text-slate-700" 
          />
          <input 
            type="password" 
            placeholder="Senha de acesso" 
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#0A4D3C] transition-colors text-slate-700" 
          />
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#0A4D3C] hover:bg-[#083d2f] text-white font-bold rounded-xl px-4 py-3 transition-colors md:mt-2 shadow-sm disabled:opacity-50"
          >
            {loading ? 'Acessando...' : 'Entrar'}
          </button>
        </form>

        <Link href="/" className="mt-8 text-sm text-gray-400 hover:text-gray-600 font-medium">
          Voltar ao Início
        </Link>
      </div>
    </main>
  );
}
