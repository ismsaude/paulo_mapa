import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Edit2, Check, Trash2 } from 'lucide-react';

export default function DraggableRua({ 
  rua, 
  ruaData,
  isAdminUser, 
  editingRuaStr, 
  editRuaName, 
  setEditRuaName, 
  handleSaveRua, 
  setEditingRuaStr, 
  handleDeleteRua,
  children 
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `rua-${rua}`, disabled: !isAdminUser });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 1,
    opacity: isDragging ? 0.8 : 1,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-6 rounded-xl border border-gray-100 overflow-hidden shadow-sm bg-white">
      {/* TÍTULO DA RUA */}
      {editingRuaStr === rua ? (
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center gap-2 w-full relative">
          <input 
            type="text" 
            value={editRuaName}
            onChange={e => setEditRuaName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveRua(rua)}
            className="flex-1 border-b-2 border-slate-400 focus:border-[#0A4D3C] outline-none font-semibold text-slate-800 text-lg bg-gray-50 ml-6"
            autoFocus
          />
          <button onClick={() => handleSaveRua(rua)} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200">
            <Check size={16} strokeWidth={3} />
          </button>
        </div>
      ) : (
        <div className="bg-gray-50 px-4 py-3 font-semibold text-slate-800 text-lg border-b border-gray-100 flex items-center justify-between relative group">
          {/* Drag Handle para a Rua inteira */}
          {isAdminUser && (
            <div 
              {...attributes} 
              {...listeners} 
              className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-black/5"
              title="Arrastar Bloco da Rua"
            >
              <div className="w-1 h-5 flex flex-col justify-between gap-1">
                <div className="w-full h-1 bg-gray-400 rounded"></div>
                <div className="w-full h-1 bg-gray-400 rounded"></div>
                <div className="w-full h-1 bg-gray-400 rounded"></div>
              </div>
            </div>
          )}

          <span className={isAdminUser ? "ml-6" : ""}>{rua}</span>
          
          {isAdminUser && (
            <div className="flex items-center gap-1">
              <button 
                onClick={() => { setEditRuaName(rua); setEditingRuaStr(rua); }}
                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                title="Editar nome da Rua"
              >
                <Edit2 size={14} />
              </button>
              <button 
                onClick={() => handleDeleteRua(rua)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                title="Excluir bloco inteiro"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* O conteúdo interno (GRID 2 COLUNAS de endereços) é injetado aqui */}
      {children}
    </div>
  );
}
