import React, { useState } from 'react';
import { X, Check, XCircle, User, Phone, CreditCard, MessageSquare } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const PendingRequestsModal = ({ isOpen, onClose, raffleId, onRequestProcessed }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null);

  React.useEffect(() => {
    if (isOpen && raffleId) {
      loadRequests();
    }
  }, [isOpen, raffleId]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/raffles/${raffleId}/pending-requests`);
      setRequests(data.data || []);
    } catch (error) {
      toast.error('Error al cargar solicitudes');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    setProcessing(requestId);
    try {
      await axios.post('/api/raffles/approve-purchase', { request_id: requestId });
      toast.success('Compra aprobada exitosamente');
      setRequests(requests.filter(r => r.id !== requestId));
      onRequestProcessed?.();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al aprobar');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId) => {
    const reason = prompt('Motivo del rechazo (opcional):');
    
    setProcessing(requestId);
    try {
      await axios.post('/api/raffles/reject-purchase', { 
        request_id: requestId, 
        reason 
      });
      toast.success('Solicitud rechazada');
      setRequests(requests.filter(r => r.id !== requestId));
      onRequestProcessed?.();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al rechazar');
    } finally {
      setProcessing(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h3 className="text-2xl font-bold text-white">Solicitudes Pendientes</h3>
            <p className="text-gray-400 text-sm mt-1">{requests.length} solicitudes esperando aprobación</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
              <p className="text-gray-400 mt-4">Cargando solicitudes...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <Check className="mx-auto text-green-500 mb-4" size={48} />
              <p className="text-gray-400 text-lg">No hay solicitudes pendientes</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => {
                const buyerProfile = JSON.parse(request.buyer_profile || '{}');
                const requestData = JSON.parse(request.request_data || '{}');
                
                return (
                  <div key={request.id} className="bg-gray-700/50 rounded-lg p-5 border border-gray-600">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Info del comprador */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <User className="text-blue-400" size={20} />
                          <span className="text-white font-semibold text-lg">{buyerProfile.full_name}</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <p className="text-gray-300">
                            <strong>Usuario:</strong> @{request.username}
                          </p>
                          <p className="text-gray-300">
                            <strong>Cédula:</strong> {buyerProfile.id_number}
                          </p>
                          <p className="text-gray-300 flex items-center gap-2">
                            <Phone size={16} />
                            {buyerProfile.phone}
                          </p>
                          {buyerProfile.location && (
                            <p className="text-gray-400">📍 {buyerProfile.location}</p>
                          )}
                        </div>
                      </div>

                      {/* Info de la compra */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <CreditCard className="text-yellow-400" size={20} />
                          <span className="text-white font-semibold">Detalles de Pago</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <p className="text-gray-300">
                            <strong>Número:</strong> {requestData.number_idx}
                          </p>
                          <p className="text-gray-300">
                            <strong>Método:</strong> 
                            <span className="ml-2 px-2 py-1 bg-gray-600 rounded capitalize">
                              {request.payment_method}
                            </span>
                          </p>
                          {request.payment_reference && (
                            <p className="text-gray-300">
                              <strong>Referencia:</strong> {request.payment_reference}
                            </p>
                          )}
                          <p className="text-gray-400 text-xs">
                            Solicitado: {new Date(request.created_at).toLocaleString('es-ES')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Mensaje */}
                    {request.message && (
                      <div className="mt-4 pt-4 border-t border-gray-600">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="text-gray-400 flex-shrink-0 mt-1" size={16} />
                          <div>
                            <p className="text-gray-400 text-xs font-semibold mb-1">Mensaje:</p>
                            <p className="text-gray-300 text-sm italic">"{request.message}"</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Acciones */}
                    <div className="mt-4 pt-4 border-t border-gray-600 flex gap-3">
                      <button
                        onClick={() => handleApprove(request.id)}
                        disabled={processing === request.id}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
                      >
                        {processing === request.id ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                          <>
                            <Check size={20} />
                            Aprobar
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleReject(request.id)}
                        disabled={processing === request.id}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
                      >
                        <XCircle size={20} />
                        Rechazar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PendingRequestsModal;
