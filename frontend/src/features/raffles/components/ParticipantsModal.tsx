/**
 * Modal de Participantes - Versión Básica
 * TODO: Implementar funcionalidad completa
 */

import React from 'react';
import { motion } from 'framer-motion';
import { X, Users } from 'lucide-react';

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
        className="bg-glass rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/20 rounded-lg">
              <Users className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text">Participantes</h2>
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
        <div className="p-6">
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-text/40 mx-auto mb-4" />
            <p className="text-text/60 mb-2">Modal de participantes</p>
            <p className="text-sm text-text/40">
              Funcionalidad completa próximamente
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-glass hover:bg-glass-lighter rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ParticipantsModal;
