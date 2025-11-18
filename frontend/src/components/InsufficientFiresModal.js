import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Flame, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const InsufficientFiresModal = ({ isOpen, onClose, missingFires }) => {
  const navigate = useNavigate();

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleGoToBuy = () => {
    if (onClose) {
      onClose();
    }
    navigate('/profile?open=buy');
  };

  const formattedMissing = Number.isFinite(missingFires)
    ? missingFires.toFixed(2)
    : '...';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="w-full max-w-md card-glass p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-lg bg-glass hover:bg-glass-hover transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Flame className="text-fire-orange" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold">Saldo insuficiente de fuegos</h2>
                <p className="text-xs text-text/60">
                  Aún necesitas
                  {' '}
                  <span className="font-semibold text-fire-orange">
                    {formattedMissing} fuegos
                  </span>
                  {' '}
                  para completar esta acción.
                </p>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                <div className="text-xs text-red-200/90">
                  <p className="font-semibold mb-1">¿Quieres recargar tu billetera?</p>
                  <p>
                    Te llevaremos a tu perfil para abrir el flujo de
                    {' '}
                    <span className="font-semibold">compra de fuegos</span>
                    .
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 bg-glass rounded-lg text-text hover:bg-glass-hover transition-colors text-sm"
              >
                No, cancelar
              </button>
              <button
                type="button"
                onClick={handleGoToBuy}
                className="flex-1 py-2.5 btn-primary rounded-lg text-sm"
              >
                Sí, recargar fuegos
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InsufficientFiresModal;
