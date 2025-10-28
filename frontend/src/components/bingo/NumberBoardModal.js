import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaCheckCircle } from 'react-icons/fa';

const NumberBoardModal = ({ isOpen, onClose, drawnNumbers = [], totalNumbers = 75, mode = 75 }) => {
  const called = drawnNumbers.length;
  const remaining = totalNumbers - called;

  // Generar array de números según el modo
  const numbers = mode === 75 
    ? Array.from({ length: 75 }, (_, i) => i + 1)
    : Array.from({ length: 90 }, (_, i) => i + 1);

  const isDrawn = (num) => drawnNumbers.includes(num);

  // Organizar en columnas para modo 75 (B-I-N-G-O)
  const getColumnLabel = (index) => {
    if (mode !== 75) return null;
    const labels = ['B', 'I', 'N', 'G', 'O'];
    return labels[Math.floor(index / 15)];
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="fixed inset-4 md:inset-10 lg:inset-20 z-50 flex items-center justify-center"
          >
            <div className="w-full h-full max-w-4xl bg-gradient-to-br from-gray-900 to-black rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10 bg-gradient-to-r from-purple-900/50 to-blue-900/50">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Tabla de Números</h2>
                  <p className="text-sm md:text-base text-white/60 mt-1">
                    Conjunto: <span className="text-white font-semibold">{totalNumbers}</span> • 
                    Cantados: <span className="text-green-400 font-semibold">{called}</span> • 
                    Restantes: <span className="text-white/80 font-semibold">{remaining}</span>
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <FaTimes className="text-white text-xl" />
                </button>
              </div>

              {/* Grid de números */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className={`grid gap-2 ${
                  mode === 75 
                    ? 'grid-cols-5 md:grid-cols-5' 
                    : 'grid-cols-9 md:grid-cols-10'
                }`}>
                  {numbers.map((num, index) => {
                    const drawn = isDrawn(num);
                    
                    return (
                      <motion.div
                        key={num}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.002 }}
                        className={`
                          relative aspect-square rounded-lg font-bold text-base md:text-xl
                          flex items-center justify-center transition-all duration-300
                          ${drawn 
                            ? 'bg-gradient-to-br from-yellow-500 to-orange-600 text-black shadow-lg shadow-yellow-500/50 scale-105' 
                            : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                          }
                        `}
                      >
                        {drawn && (
                          <FaCheckCircle className="absolute -top-1 -right-1 text-green-400 text-xs md:text-sm" />
                        )}
                        <span className={drawn ? 'font-black' : ''}>{num}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Footer con leyenda */}
              <div className="p-4 border-t border-white/10 bg-gradient-to-r from-gray-900 to-black">
                <div className="flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-yellow-500 to-orange-600"></div>
                    <span className="text-white/80">Cantado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-white/5"></div>
                    <span className="text-white/80">Pendiente</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NumberBoardModal;
