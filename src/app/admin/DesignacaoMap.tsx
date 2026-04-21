import { useState, useRef, useEffect } from 'react';
import { Download, Save, History, X, Trash2 } from 'lucide-react';

const INITIAL_PIN_NAMES = [
  "G-Fábio", "G-Pedro", "G-Valdenor", "G-Átila", "G-Bruno", "G-Denis", "G-Leonardo", 
  "Segunda", "Terça", "Quarta", "Quinta", "Sexta"
];

// Cor gerada baseada no index para garantir tons únicos e vibrantes
const getPinColor = (index: number) => `hsl(${(index * 35) % 360}, 85%, 45%)`;

export default function DesignacaoMap() {
  const [pins, setPins] = useState(() => 
    INITIAL_PIN_NAMES.map((name, i) => ({
      id: `pin-${i}`,
      name,
      x: 0,
      y: 0,
      isPlaced: false,
      color: getPinColor(i)
    }))
  );

  const [activePinId, setActivePinId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapImgRef = useRef<HTMLImageElement>(null);

  // States for Date Stamp
  const [stampText, setStampText] = useState("");
  const [stamp, setStamp] = useState({ isPlaced: false, x: 0, y: 0 });

  // States for report history
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('mapaDesignacoes_historico');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const handleCreateStamp = (dateString: string) => {
     if(!dateString) return;
     const date = new Date(dateString + "T12:00:00");
     const day = date.getDay(); // 0 is Sun, 1 is Mon
     
     const diffToMonday = date.getDate() - day + (day === 0 ? -6 : 1);
     const monday = new Date(new Date(date).setDate(diffToMonday));
     const sunday = new Date(new Date(monday).setDate(monday.getDate() + 6));
     
     const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
     
     // Formato curto e grosso para caber no círculo
     setStampText(`SEMANA: ${fmt(monday)} A ${fmt(sunday)}`);
     setActivePinId('DATE_STAMP');
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activePinId || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (activePinId === 'DATE_STAMP') {
       if (stampText) setStamp({ isPlaced: true, x, y });
    } else {
       setPins(prev => prev.map(p => 
         p.id === activePinId ? { ...p, x, y, isPlaced: true } : p
       ));
    }
    setActivePinId(null);
  };

  const handlePinClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Evita que o clique vaze pro mapa
    setActivePinId(activePinId === id ? null : id);
  };

  const resetPin = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPins(prev => prev.map(p => p.id === id ? { ...p, isPlaced: false } : p));
  };

  const limparMapa = () => {
    if (!window.confirm("Remover todas as bandeiras do mapa e voltar peças para a caixa?")) return;
    setPins(prev => prev.map(p => ({ ...p, isPlaced: false })));
    setStamp(prev => ({ ...prev, isPlaced: false }));
  };

  const downloadImage = () => {
    const img = mapImgRef.current;
    if (!img) return;

    // Criar um canvas do mesmo tamanho da imagem original
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Desenhar a imagem base
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 2. Desenhar cada Etiqueta Retangular no Canvas
    const placedPins = pins.filter(p => p.isPlaced);
    placedPins.forEach(p => {
      const x = (p.x / 100) * canvas.width;
      const y = (p.y / 100) * canvas.height;
      
      const fontSize = canvas.width * 0.024;
      ctx.font = `900 ${fontSize}px sans-serif`;
      
      const textW = ctx.measureText(p.name).width;
      const padX = canvas.width * 0.020;
      const padY = canvas.width * 0.012;

      const rectW = textW + (padX * 2);
      const rectH = fontSize + (padY * 2);
      const rectX = x - (rectW / 2);
      const rectY = y - (rectH / 2);
      
      // Sombra externa
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 4;

      // Desenhar Fundo Retangular Curvado
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(rectX, rectY, rectW, rectH, canvas.width * 0.008);
      else ctx.rect(rectX, rectY, rectW, rectH);
      ctx.fillStyle = p.color;
      ctx.fill();

      // Limpar sombra
      ctx.shadowColor = "transparent";

      // Borda grossa branca
      ctx.lineWidth = canvas.width * 0.004;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Nome Branco no Centro
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.name, x, y + fontSize * 0.08); // leve ajuste basinal
    });

    // 3. Desenhar o Carimbo de Data Redondo
    if (stamp.isPlaced && stampText) {
      const sx = (stamp.x / 100) * canvas.width;
      const sy = (stamp.y / 100) * canvas.height;
      const stampRadius = canvas.width * 0.08; // Raio Base Equivalente Gigante (8% da tela inteira)

      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 6;

      // Fundo circular branco 
      ctx.beginPath();
      ctx.arc(sx, sy, stampRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();

      ctx.shadowColor = "transparent";

      // Borda grossa escura 
      ctx.lineWidth = canvas.width * 0.006;
      ctx.strokeStyle = "#1E293B";
      ctx.stroke();

      // Círculo centralzinho escuro
      ctx.beginPath();
      ctx.arc(sx, sy, stampRadius * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = "#1E293B";
      ctx.fill();

      // Texto circular em órbita perfeita com compressão horizontal (estilo carimbo oficial)
      const circText = stampText + " • " + stampText + " • ";
      ctx.font = `900 ${stampRadius * 0.22}px sans-serif`;
      ctx.fillStyle = "#1E293B";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      const textRadius = stampRadius * 0.73; // Distância do centro
      const angleStep = (Math.PI * 2) / circText.length; // Distribuição matematicamente perfeita (espaçamento igual)
      
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-Math.PI / 2); // Start no topo central
      
      for (let i = 0; i < circText.length; i++) {
        const char = circText[i];
        
        ctx.save();
        ctx.rotate(i * angleStep);
        ctx.translate(0, -textRadius);
        
        // MAGIA: Achatar levemente as letras para caberem sem sobrepor, igual no SVG (spacingAndGlyphs)
        ctx.scale(0.8, 1);
        
        ctx.fillText(char, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }

    // Baixar a imagem processada
    const link = document.createElement('a');
    link.download = `Mapa_Designacao_${new Date().toISOString().split('T')[0]}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.9);
    link.click();
  };

  const salvarRelatorio = () => {
    const placedPins = pins.filter(p => p.isPlaced);
    if (placedPins.length === 0) {
      alert("Nenhuma designação posicionada no mapa para salvar.");
      return;
    }

    const novoRegistro = {
      id: Date.now().toString(),
      data: new Date().toLocaleString('pt-BR'),
      designacoes: placedPins.map(p => p.name)
    };

    const newHistory = [novoRegistro, ...history];
    setHistory(newHistory);
    localStorage.setItem('mapaDesignacoes_historico', JSON.stringify(newHistory));
    alert("Relatório salvo com sucesso!");
  };

  const deletarRelatorio = (id: string) => {
    if(!window.confirm("Apagar este registro?")) return;
    const newHistory = history.filter(h => h.id !== id);
    setHistory(newHistory);
    localStorage.setItem('mapaDesignacoes_historico', JSON.stringify(newHistory));
  }

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-gray-100 flex flex-col items-center">
      
      {/* Barra de Ferramentas Compacta */}
      <div className="w-full flex justify-between items-center bg-gray-50 p-2 rounded-2xl mb-4 border border-gray-100 gap-2">
        <button onClick={downloadImage} className="bg-[#0A4D3C] hover:bg-[#07382c] text-white flex justify-center items-center gap-2 py-2 px-4 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition active:scale-95 flex-1 sm:flex-none">
          <Download size={16}/> <span className="hidden sm:inline">Baixar Imagem</span><span className="sm:hidden">Baixar</span>
        </button>
        
        <div className="flex gap-1.5 sm:gap-2">
           <button onClick={salvarRelatorio} title="Salvar Relatório de Hoje" className="bg-blue-100 text-blue-700 hover:bg-blue-200 p-2 sm:px-3 sm:py-2 rounded-xl flex items-center gap-2 text-xs sm:text-sm font-bold transition active:scale-95">
             <Save size={16}/> <span className="hidden sm:inline">Salvar</span>
           </button>
           <button onClick={() => setShowHistory(!showHistory)} title="Consultar Histórico" className="bg-slate-200 text-slate-700 hover:bg-slate-300 p-2 sm:px-3 sm:py-2 rounded-xl flex items-center gap-2 text-xs sm:text-sm font-bold transition active:scale-95">
             <History size={16}/> <span className="hidden sm:inline">Histórico</span>
           </button>
           <button onClick={limparMapa} title="Limpar Mapa" className="bg-red-100 text-red-600 hover:bg-red-200 p-2 sm:px-3 sm:py-2 rounded-xl flex items-center gap-2 text-xs sm:text-sm font-bold transition active:scale-95">
             <Trash2 size={16}/> <span className="hidden sm:inline">Limpar</span>
           </button>
        </div>
      </div>

      {showHistory && (
        <div className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl mb-6 shadow-inner animate-in fade-in zoom-in-95">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800">Registros de Designação</h3>
            <button onClick={() => setShowHistory(false)}><X size={20} className="text-gray-400"/></button>
          </div>
          <div className="max-h-60 overflow-y-auto pr-2 flex flex-col gap-2">
            {history.length === 0 && <p className="text-sm text-gray-500">Nenhum salvo ainda.</p>}
            {history.map(h => (
              <div key={h.id} className="bg-white p-3 rounded-xl border border-gray-100 text-sm flex justify-between">
                <div>
                  <span className="font-bold text-slate-700 block mb-1 text-[11px]">{h.data}</span>
                  <span className="text-gray-600 font-medium leading-relaxed">{h.designacoes.join(" • ")}</span>
                </div>
                <button onClick={() => deletarRelatorio(h.id)} className="text-red-400 hover:text-red-600 p-2"><X size={16}/></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Como Funciona Minimalista */}
      <div className="flex gap-2 text-[10px] sm:text-xs text-gray-400 font-medium mb-3 bg-gray-50/50 px-3 py-1.5 rounded-full border border-gray-100">
        <span>1. Toque na cor</span> &bull; <span>2. Toque no mapa</span>
      </div>

      {/* O MAPA */}
      <div 
        ref={containerRef}
        className="relative w-full max-w-full overflow-hidden rounded-xl border-2 border-gray-100 shadow-sm cursor-crosshair select-none"
        onClick={handleMapClick}
      >
        <img 
          ref={mapImgRef}
          src="/mapa-geral.jpg" 
          alt="Mapa Base" 
          className="w-full h-auto block" 
        />

        {/* Retângulos Posicionados no Mapa */}
        {pins.filter(p => p.isPlaced).map(p => (
           <div 
             key={p.id}
             onClick={(e) => resetPin(p.id, e)} // Clica na placa no mapa pra remover
             className={`absolute flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-105 ${activePinId === p.id ? 'z-50 scale-110' : 'z-10'}`}
             style={{ left: `${p.x}%`, top: `${p.y}%` }}
           >
             <div 
               className="shadow-xl border-2 sm:border-[3px] border-white flex justify-center items-center rounded-lg sm:rounded-xl px-2 py-1.5 sm:px-4 sm:py-2"
               style={{ backgroundColor: p.color }}
             >
               <span className="text-[10px] sm:text-[14px] font-black text-white text-center leading-none tracking-wide drop-shadow-md select-none pointer-events-none whitespace-nowrap">
                 {p.name}
               </span>
             </div>
           </div>
        ))}

        {/* Carimbo de Data no Mapa */}
        {stamp.isPlaced && stampText && (
            <div 
             onClick={(e) => { e.stopPropagation(); setStamp(prev => ({...prev, isPlaced: false})); }}
             className={`absolute flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-105 ${activePinId === 'DATE_STAMP' ? 'z-50 scale-110' : 'z-20'}`}
             style={{ left: `${stamp.x}%`, top: `${stamp.y}%` }}
           >
             <div className="w-[5.4rem] h-[5.4rem] sm:w-[6.6rem] sm:h-[6.6rem] rounded-full shadow-2xl border-2 sm:border-[3px] border-slate-800 bg-white flex items-center justify-center relative active:opacity-75 overflow-hidden">
                <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full text-slate-800 pointer-events-none">
                  <path id="circlePath" d="M 50, 50 m -36, 0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="transparent" />
                  <text fontSize="10.5" fontWeight="900" fill="currentColor" letterSpacing="1">
                    <textPath href="#circlePath" startOffset="0%" textLength="226" lengthAdjust="spacingAndGlyphs">
                      {stampText} • {stampText} • 
                    </textPath>
                  </text>
                </svg>
                {/* Miolo escuro */}
                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-slate-800 rounded-full pointer-events-none"></div>
             </div>
           </div>
        )}
      </div>

      {/* CAIXA DE FERRAMENTAS */}
      <div className="w-full mt-8 bg-gray-50 border border-gray-200 p-4 rounded-3xl">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pl-1">Bandeiras Disponíveis</h3>
        
        <div className="flex flex-wrap gap-2">
          {pins.filter(p => !p.isPlaced).map(p => (
            <button
              key={p.id}
              onClick={(e) => handlePinClick(e, p.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-bold shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/20 active:scale-95 shrink-0 ${activePinId === p.id ? 'bg-blue-50 border-blue-500 text-blue-700 scale-105' : 'bg-white border-gray-200 text-slate-700 hover:bg-gray-50'}`}
            >
              <div className="w-5 h-5 rounded-full border-2 border-white shadow-sm flex-shrink-0" style={{ backgroundColor: p.color }}></div>
              {p.name}
            </button>
          ))}
          {pins.filter(p => !p.isPlaced).length === 0 && (
             <p className="text-xs text-gray-400 font-medium py-2">Todas foram colocadas no mapa!</p>
          )}
        </div>

        {/* Carimbo de Data Discreto Abaixo */}
        <div className="mt-8 pt-5 border-t border-gray-200/60 flex flex-col sm:flex-row items-center justify-between gap-3">
           <div className="flex items-center gap-2">
             <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Carimbo de Data:</span>
             <input 
                type="date" 
                onChange={(e) => handleCreateStamp(e.target.value)} 
                className="bg-white border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 text-xs font-bold outline-none ring-slate-800 focus:border-slate-800 text-slate-600 transition shadow-sm" 
              />
           </div>
           
           {stampText && (
             <button 
               onClick={(e) => { e.stopPropagation(); setActivePinId(activePinId === 'DATE_STAMP' ? null : 'DATE_STAMP'); }}
               className={`px-4 py-2 rounded-full text-[11px] sm:text-xs font-bold shadow-sm transition-all focus:outline-none active:scale-95 ${activePinId === 'DATE_STAMP' ? 'bg-slate-800 text-white scale-105 ring-4 ring-slate-400/30' : 'bg-gray-200 text-slate-700 hover:bg-gray-300'}`}
             >
               Ativar Pincel: {stampText}
             </button>
           )}
        </div>
      </div>

    </div>
  );
}
