import React, { useState } from 'react';
import { X, AlertTriangle, DollarSign } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const CancelRaffleModal = ({ isOpen, onClose, raffle, onCancelled }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !raffle) return null;

  const soldNumbers = raffle.numbers?.filter(n => n.state === 'sold') || [];
  const totalRefundBuyers = soldNumbers.length * (raffle.entry_price_fire || 0);
  const uniqueBuyers = new Set(soldNumbers.map(n => n.owner_id)).size;
  
  // Calcular creation_cost del host
  const isCompanyMode = raffle.is_company_mode || false;
  const creationCost = isCompanyMode ? 3000 : (raffle.mode === 'fires' || raffle.mode === 'fire' ? 300 : 0);
  
  const totalRefund = totalRefundBuyers + creationCost;

  const handleCancel = async () => {
    const confirmMsg = creationCost > 0
      ? `¿CONFIRMAR CANCELACIÓN?\n\n` +
        `Reembolso compradores: ${totalRefundBuyers} 🔥 (${uniqueBuyers} usuarios)\n` +
        `Reembolso host (creación): ${creationCost} 🔥\n` +
        `TOTAL: ${totalRefund} 🔥\n\n` +
        `Esta acción NO se puede deshacer.`
      : `¿CONFIRMAR CANCELACIÓN?\n\n` +
        `Esto reembolsará ${totalRefundBuyers} 🔥 a ${uniqueBuyers} usuario(s).\n\n` +
        `Esta acción NO se puede deshacer.`;
    
    if (!window.confirm(confirmMsg)) {
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/raffles/admin/cancel-raffle', {
        raffle_id: raffle.id,
        reason: reason.trim() || 'Cancelación administrativa'
      });

      const successMsg = creationCost > 0
        ? `Rifa cancelada. ${uniqueBuyers} comprador(es) + host reembolsados. Total: ${totalRefund} 🔥`
        : `Rifa cancelada. ${uniqueBuyers} usuario(s) reembolsado(s).`;
      
      toast.success(successMsg);
      onCancelled?.();
      onClose();
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Error al cancelar rifa';
      toast.error(errorMsg);
      console.error('Error cancelando rifa:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-lg w-full border-2 border-red-500/50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-red-500/10">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-500" size={28} />
            <h3 className="text-xl font-bold text-white">Cancelar Rifa</h3>
          </div>
          <button 
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Información de la rifa */}
          <div className="bg-gray-700/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-300">Rifa:</span>
              <span className="text-white font-semibold">{raffle.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Código:</span>
              <span className="text-yellow-400 font-mono">{raffle.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Estado:</span>
              <span className={`font-semibold ${
                raffle.status === 'active' ? 'text-green-400' : 'text-blue-400'
              }`}>
                {raffle.status === 'active' ? 'Activa' : 'Pendiente'}
              </span>
            </div>
          </div>

          {/* Información del reembolso */}
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-orange-400 font-semibold mb-2">
              <DollarSign size={20} />
              <span>Reembolso Automático</span>
            </div>
            
            {/* Reembolso a compradores */}
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">Números vendidos:</span>
              <span className="text-white font-semibold">{soldNumbers.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">Usuarios compradores:</span>
              <span className="text-white font-semibold">{uniqueBuyers}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">Reembolso compradores:</span>
              <span className="text-white font-semibold">{totalRefundBuyers} 🔥</span>
            </div>
            
            {/* Reembolso al host */}
            {creationCost > 0 && (
              <>
                <div className="border-t border-orange-500/20 my-2"></div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Reembolso host (creación):</span>
                  <span className="text-white font-semibold">{creationCost} 🔥</span>
                </div>
                <div className="text-xs text-gray-400 italic">
                  {isCompanyMode ? '(Modo Empresa: 3000 🔥)' : '(Modo Fires: 300 🔥)'}
                </div>
              </>
            )}
            
            {/* Total */}
            <div className="flex justify-between text-sm pt-2 border-t border-orange-500/20">
              <span className="text-gray-300 font-bold">TOTAL A REEMBOLSAR:</span>
              <span className="text-orange-400 font-bold text-lg">{totalRefund} 🔥</span>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-300 text-sm flex items-start gap-2">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>
                Esta acción es <strong>irreversible</strong>. Todos los compradores serán 
                reembolsados automáticamente y la rifa quedará marcada como cancelada.
              </span>
            </p>
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              Motivo de cancelación (opcional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none disabled:opacity-50"
              rows="3"
              placeholder="Describe el motivo de la cancelación..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:text-gray-400 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Cancelando...
              </>
            ) : (
              <>
                <AlertTriangle size={20} />
                Confirmar Cancelación
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelRaffleModal;
