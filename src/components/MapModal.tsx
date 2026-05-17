"use client";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";

export default function MapModal({ onClose }: { onClose: () => void }) {
  const [scale, setScale] = useState(1);

  // Impede rolagem do body quando modal está aberto
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      {/* HEADER */}
      <div className="w-full flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 z-10">
        <div className="flex gap-3 bg-black/50 rounded-full p-1 backdrop-blur-md">
          <button 
            onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
            className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
          >
            <ZoomOut size={20} />
          </button>
          <button 
            onClick={() => setScale(s => Math.min(3, s + 0.25))}
            className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
          >
            <ZoomIn size={20} />
          </button>
        </div>
        <button 
          onClick={onClose}
          className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* CONTEÚDO SCROLLÁVEL */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <div 
          className="relative transition-transform duration-200 origin-center"
          style={{ transform: `scale(${scale})` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/mapa-geral.jpg" 
            alt="Mapa Geral" 
            className="max-w-full h-auto rounded-xl shadow-2xl"
          />
        </div>
      </div>
    </div>
  );
}
