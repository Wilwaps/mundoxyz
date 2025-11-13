/**
 * Modal de Participantes - Vista según rol y modo de rifa
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Check, XCircle, Eye, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useParticipants } from '../hooks/useParticipants';
import { useApproveRequest } from '../hooks/useApproveRequest';
import { useRejectRequest } from '../hooks/useRejectRequest';
import type { PaymentRequestDetail } from '../types';

interface ParticipantsModalProps {
  raffleCode: string;
  raffleMode: string;
  isHost: boolean;
  onClose: () => void;
}

const ParticipantsModal: React.FC<ParticipantsModalProps> = ({
  raffleCode,
  raffleMode,
  isHost,
  onClose
}) => {
  const { data, isLoading, error } = useParticipants(raffleCode);
  const approveRequest = useApproveRequest();
  const rejectRequest = useRejectRequest();
  
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequestDetail | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const handleApprove = async (requestId: number) => {
    try {
      await approveRequest.mutateAsync({ code: raffleCode, requestId });
      setSelectedRequest(null);
    } catch (error) {
      // Error manejado por el hook
    }
  };

  const handleReject = async (requestId: number) => {
    try {
      await rejectRequest.mutateAsync({ 
        code: raffleCode, 
        requestId, 
        reason: rejectReason || 'No especificada' 
      });
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedRequest(null);
    } catch (error) {
      // Error manejado por el hook
    }
  };

  const isPrizeMode = raffleMode === 'prize';
  const showHostRequests = isPrizeMode && !!data?.requests;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-glass rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/20 rounded-lg">
              <Users className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text">
                {showHostRequests ? 'Solicitudes de Compra' : 'Participantes'}
              </h2>
              <p className="text-sm text-text/60">Rifa #{raffleCode}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-text" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <p className="text-text/60">Error al cargar participantes</p>
              </div>
            </div>
          )}

          {data && !isLoading && (
            <>
              {/* Vista PRIZE host: Solicitudes (detectado por respuesta del backend) */}
              {showHostRequests && (
                <div className="space-y-3">
                  {data.requests.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-16 h-16 text-text/40 mx-auto mb-4" />
                      <p className="text-text/60">No hay solicitudes pendientes</p>
                    </div>
                  ) : (
                    data.requests.map((request) => (
                      <div
                        key={request.requestId}
                        className="bg-glass/50 rounded-lg p-4 border border-white/10 hover:border-accent/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-text">
                                {request.buyerProfile.displayName || request.telegramUsername || 'Usuario'}
                              </h3>
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                request.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                                request.status === 'approved' ? 'bg-green-500/20 text-green-500' :
                                'bg-red-500/20 text-red-500'
                              }`}>
                                {request.status === 'pending' ? 'Pendiente' : 
                                 request.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                              </span>
                            </div>
                            
                            <div className="text-sm text-text/60 space-y-1">
                              <p>Números: {request.numbers.join(', ')}</p>
                              {request.buyerProfile.phone && (
                                <p>Teléfono: {request.buyerProfile.phone}</p>
                              )}
                              {request.requestData.reference && (
                                <p>Referencia: {request.requestData.reference}</p>
                              )}
                              {request.requestData.bankCode && (
                                <p>Banco: {request.requestData.bankCode}</p>
                              )}
                            </div>
                          </div>

                          {request.status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => setSelectedRequest(request)}
                                className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors"
                                title="Ver detalles"
                              >
                                <Eye className="w-5 h-5 text-blue-500" />
                              </button>
                              <button
                                onClick={() => handleApprove(request.requestId)}
                                disabled={approveRequest.isPending}
                                className="p-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg transition-colors disabled:opacity-50"
                                title="Aprobar"
                              >
                                <Check className="w-5 h-5 text-green-500" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setShowRejectModal(true);
                                }}
                                disabled={rejectRequest.isPending}
                                className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors disabled:opacity-50"
                                title="Rechazar"
                              >
                                <XCircle className="w-5 h-5 text-red-500" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Vista FIRES/COINS: Lista pública */}
              {!isPrizeMode && data.participants && (
                <div className="space-y-3">
                  {data.participants.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-16 h-16 text-text/40 mx-auto mb-4" />
                      <p className="text-text/60">Aún no hay participantes</p>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-text/60 mb-4">
                        Total: {data.totalParticipants || data.participants.length} participante(s)
                      </div>
                      {data.participants.map((participant, idx) => (
                        <div
                          key={idx}
                          className="bg-glass/50 rounded-lg p-4 border border-white/10"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold text-text">
                                {participant.displayName}
                              </h3>
                              {participant.telegramUsername && (
                                <p className="text-sm text-text/60">
                                  @{participant.telegramUsername}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-text/60">
                                {participant.numbers.length} número(s)
                              </p>
                              <p className="text-xs text-accent">
                                {participant.numbers.slice(0, 5).join(', ')}
                                {participant.numbers.length > 5 && '...'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Vista PRIZE como usuario: Solo aprobados */}
              {isPrizeMode && !isHost && data.participants && (
                <div className="space-y-3">
                  {data.participants.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-16 h-16 text-text/40 mx-auto mb-4" />
                      <p className="text-text/60">Aún no hay participantes aprobados</p>
                    </div>
                  ) : (
                    data.participants.map((participant: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-glass/50 rounded-lg p-4 border border-white/10"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-text">
                            {participant.displayName}
                          </h3>
                          <p className="text-sm text-text/60">
                            {participant.numbers.length} número(s)
                          </p>
                        </div>
                        <div className="mt-2 text-xs text-accent break-words">
                          {participant.numbers.join(', ')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 btn-primary rounded-lg"
          >
            Cerrar
          </button>
        </div>
      </motion.div>

      {/* Modal de Detalles de Solicitud */}
      <AnimatePresence>
        {selectedRequest && !showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 flex items-center justify-center p-4"
            onClick={() => setSelectedRequest(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-glass rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
            >
              <h3 className="text-lg font-bold text-text mb-4">Detalles de Solicitud</h3>
              
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-text/60">Nombre:</span>
                  <p className="text-text font-medium">{selectedRequest.buyerProfile.displayName || 'No especificado'}</p>
                </div>
                
                {selectedRequest.buyerProfile.fullName && (
                  <div>
                    <span className="text-text/60">Nombre completo:</span>
                    <p className="text-text">{selectedRequest.buyerProfile.fullName}</p>
                  </div>
                )}
                
                {selectedRequest.buyerProfile.phone && (
                  <div>
                    <span className="text-text/60">Teléfono:</span>
                    <p className="text-text">{selectedRequest.buyerProfile.phone}</p>
                  </div>
                )}
                
                {selectedRequest.buyerProfile.email && (
                  <div>
                    <span className="text-text/60">Email:</span>
                    <p className="text-text">{selectedRequest.buyerProfile.email}</p>
                  </div>
                )}
                
                <div>
                  <span className="text-text/60">Números:</span>
                  <p className="text-text font-medium">{(selectedRequest.numbers || []).join(', ') || '-'}</p>
                </div>
                
                {selectedRequest.requestData.paymentProofBase64 && (
                  <div>
                    <span className="text-text/60 block mb-2">Comprobante:</span>
                    <img 
                      src={selectedRequest.requestData.paymentProofBase64} 
                      alt="Comprobante"
                      className="w-full rounded-lg border border-white/10"
                    />
                  </div>
                )}
                
                {selectedRequest.requestData.notes && (
                  <div>
                    <span className="text-text/60">Notas:</span>
                    <p className="text-text">{selectedRequest.requestData.notes}</p>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="flex-1 px-4 py-2 bg-glass hover:bg-glass-lighter rounded-lg transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Rechazar */}
      <AnimatePresence>
        {showRejectModal && selectedRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 flex items-center justify-center p-4"
            onClick={() => setShowRejectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-glass rounded-xl p-6 max-w-md w-full"
            >
              <h3 className="text-lg font-bold text-text mb-4">Rechazar Solicitud</h3>
              
              <div className="mb-4">
                <label className="block text-sm text-text/80 mb-2">
                  Razón del rechazo (opcional)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ej: Datos incorrectos, pago no verificado..."
                  className="w-full px-4 py-2 bg-glass-lighter rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  rows={3}
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                  }}
                  className="flex-1 px-4 py-2 bg-glass hover:bg-glass-lighter rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleReject(selectedRequest.requestId)}
                  disabled={rejectRequest.isPending}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50 text-white font-medium"
                >
                  {rejectRequest.isPending ? 'Rechazando...' : 'Rechazar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ParticipantsModal;
