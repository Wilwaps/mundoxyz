import React from 'react';

const FiresHistoryModal = ({ isOpen, onClose, onOpenSend, onOpenBuy, onOpenReceive }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-dark rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-bold text-text">Historial de Fuegos</h3>
          <button onClick={onClose} className="px-2 py-1 bg-glass rounded">Cerrar</button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-text/60 text-sm">Próximamente: historial detallado de transacciones de fuegos.</div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            <button onClick={onOpenSend} className="py-2 bg-glass rounded hover:bg-glass/80 transition">Enviar</button>
            <button onClick={onOpenBuy} className="py-2 bg-glass rounded hover:bg-glass/80 transition">Comprar</button>
            <button onClick={onOpenReceive} className="py-2 bg-glass rounded hover:bg-glass/80 transition">Recibir</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FiresHistoryModal;