import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check } from 'lucide-react';

export default function DraggableEndereco({ end, onEnderecoClick, isBloqueado, taVazio, bgStatus, formatData, isAdminUser, editId, editNumero, setEditNumero, handleSaveNumero, setEditId }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: end.id, disabled: !isAdminUser });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`
        w-full text-left flex items-stretch min-h-[48px] relative
        ${bgStatus} transition-colors
        border-b border-gray-100 
        [&:nth-child(odd)]:border-r
        [&:nth-last-child(-n+2)]:border-b-0
      `}
    >
      {/* Drag handle */}
      {isAdminUser && (
        <div 
          {...attributes} 
          {...listeners} 
          className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-black/5"
          title="Arrastar"
        >
          <div className="w-1 h-5 flex flex-col justify-between gap-1">
            <div className="w-full h-1 bg-gray-300 rounded"></div>
            <div className="w-full h-1 bg-gray-300 rounded"></div>
            <div className="w-full h-1 bg-gray-300 rounded"></div>
          </div>
        </div>
      )}

      <button 
        onClick={(e) => {
           if (editId === end.id) return; 
           handleEnderecoClick(end, e);
        }}
        className={`flex items-center gap-2.5 w-full p-3 ${isAdminUser ? 'ml-6' : ''}`}
      >
        {/* Lado Esquerdo: Ícone + Checkbox */}
        <div className="flex items-center gap-2 flex-shrink-0 w-14 justify-end">
          {!taVazio && !isBloqueado && (String(end.status).toLowerCase() === 'cartas' ? (
            <span className="text-[14px] leading-none">✉️</span>
          ) : (
            <span className="text-[14px] leading-none">🗣️</span>
          ))}
          {isBloqueado && (
            <span className="text-[12px] leading-none">❌</span>
          )}
          
          <div className={`w-8 h-8 rounded flex items-center justify-center border-[3px] font-bold flex-shrink-0
            ${!taVazio && !isBloqueado ? 'bg-gray-200 border-black' : 'bg-white border-black'}
            ${isBloqueado ? 'bg-gray-100 border-gray-400' : ''}
          `}>
            {!taVazio && !isBloqueado && (
              <Check size={20} strokeWidth={4} className="text-black" />
            )}
          </div>
        </div>

        {/* Lado Direito: Número e Data */}
        <div className="flex items-center gap-2 flex-wrap flex-1" onClick={e => e.stopPropagation()}>
          {editId === end.id ? (
             <div className="flex items-center gap-1">
               <input 
                 type="text"
                 value={editNumero}
                 onChange={e => setEditNumero(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleSaveNumero(end.id)}
                 className="w-16 text-xl font-bold bg-white border-b-2 border-[#0A4D3C] outline-none"
                 autoFocus
               />
               <button onClick={() => handleSaveNumero(end.id)} className="p-1 bg-green-100 text-green-700 rounded"><Check size={14}/></button>
             </div>
          ) : (
             <div className="flex items-center gap-2 flex-1" onClick={() => isAdminUser ? (() => {setEditId(end.id); setEditNumero(end.numero);})() : onEnderecoClick(end)}>
               <span className={`text-xl font-bold leading-none ${isBloqueado ? 'line-through text-gray-500' : 'text-slate-800'}`}>
                 {end.numero}
               </span>
               {!taVazio && !isBloqueado && end.data_visita && (
                 <span className="text-xs text-gray-500 font-medium leading-none">
                   ({formatData(end.data_visita)})
                 </span>
               )}
               {isBloqueado && (
                 <span className="text-xs text-gray-400 leading-none">Não Visitar</span>
               )}
             </div>
          )}
        </div>
      </button>
    </div>
  );
}

function handleEnderecoClick(end: any, e: any) {
  // handled internally or passed by prop
}
