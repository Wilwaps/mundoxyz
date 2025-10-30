import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';

const NumberTableModal = ({ isOpen, onClose, mode = 75, drawnNumbers = [], markedNumbers = [] }) => {
  if (!isOpen) return null;

  const maxNumber = mode;
  const totalDrawn = drawnNumbers.length;
  
  // Generar array de números
  const numbers = Array.from({ length: maxNumber }, (_, i) => i + 1);
  
  // Determinar columnas según el modo
  const cols = mode === 75 ? 10 : 10; // 10 columnas para ambos modos
  
  const isDrawn = (num) => drawnNumbers.includes(num);
  const isMarked = (num) => markedNumbers.includes(num);
  
  const getNumberClass = (num) => {
    const base = "aspect-square flex items-center justify-center text-sm font-bold rounded-lg transition-all";
    
    if (isMarked(num)) {
      return `${base} bg-gradient-to-br from-green-500 to-emerald-600 text-white ring-2 ring-green-300 shadow-lg shadow-green-500/50`;
    } else if (isDrawn(num)) {
      return `${base} bg-gradient-to-br from-cyan-500 to-blue-600 text-white ring-2 ring-cyan-300 shadow-lg shadow-cyan-500/50 animate-pulse`;
    } else {
      return `${base} bg-white/10 text-white/40 hover:bg-white/20`;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25 }}
            className="glass-effect rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Tabla</h2>
                <p className="text-sm text-white/60">
                  Conjunto: {maxNumber} • Cantados: {totalDrawn}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                aria-label="Cerrar"
              >
                <FaTimes className="text-white text-xl" />
              </button>
            </div>

            {/* Grid de números */}
            <div className={`grid grid-cols-${cols} gap-2 mb-4`}>
              {numbers.map((num) => (
                <motion.div
                  key={num}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: num * 0.002 }}
                  className={getNumberClass(num)}
                >
                  {num}
                </motion.div>
              ))}
            </div>

            {/* Leyenda */}
            <div className="flex flex-wrap gap-4 justify-center pt-4 border-t border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gradient-to-br from-cyan-500 to-blue-600"></div>
                <span className="text-xs text-white/70">Cantado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gradient-to-br from-green-500 to-emerald-600"></div>
                <span className="text-xs text-white/70">Marcado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-white/10"></div>
                <span className="text-xs text-white/70">Pendiente</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NumberTableModal;
