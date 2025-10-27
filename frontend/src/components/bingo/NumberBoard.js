import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const NumberBoard = ({ drawnNumbers = [], lastNumber, mode = 75, isAutoDrawing = false }) => {
  const totalNumbers = mode === 75 ? 75 : 90;
  const columns = mode === 75 ? 5 : 9;
  const rows = Math.ceil(totalNumbers / columns);

  const isNumberDrawn = (num) => drawnNumbers.includes(num);

  return (
    <div className="glass-effect p-6 rounded-xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">
          Números Cantados ({drawnNumbers.length}/{totalNumbers})
        </h3>
        {isAutoDrawing && (
          <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm animate-pulse">
            Auto-Draw Activo
          </span>
        )}
      </div>

      {/* Último número cantado */}
      {lastNumber && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          className="mb-6 text-center"
        >
          <p className="text-sm text-white/60 mb-2">Último número:</p>
          <div className="inline-flex items-center justify-center w-20 h-20 
                        bg-gradient-to-br from-yellow-400 to-orange-500 
                        rounded-full text-3xl font-bold text-white shadow-lg">
            {mode === 75 ? getBingoLetter(lastNumber) : ''}{lastNumber}
          </div>
        </motion.div>
      )}

      {/* Grid de números */}
      <div className={`grid grid-cols-${columns} gap-1`}>
        {Array.from({ length: totalNumbers }, (_, i) => i + 1).map((number) => (
          <AnimatePresence key={number}>
            <motion.div
              initial={false}
              animate={{
                scale: isNumberDrawn(number) ? 1 : 0.9,
                opacity: isNumberDrawn(number) ? 1 : 0.3,
              }}
              transition={{ duration: 0.3 }}
              className={`
                aspect-square flex items-center justify-center rounded-lg text-sm font-semibold
                ${isNumberDrawn(number) 
                  ? number === lastNumber
                    ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white ring-2 ring-yellow-300'
                    : 'bg-purple-600 text-white'
                  : 'bg-white/5 text-white/30'
                }
              `}
            >
              {mode === 75 ? getBingoLetter(number) : ''}{number}
            </motion.div>
          </AnimatePresence>
        ))}
      </div>

      {/* Estadísticas */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-white/60">Progreso:</span>
            <div className="mt-1 w-full bg-white/10 rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(drawnNumbers.length / totalNumbers) * 100}%` }}
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
              />
            </div>
          </div>
          <div className="text-right">
            <span className="text-white/60">Restantes:</span>
            <span className="ml-2 text-white font-semibold">
              {totalNumbers - drawnNumbers.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function for 75-ball bingo letters
const getBingoLetter = (number) => {
  if (number <= 15) return 'B-';
  if (number <= 30) return 'I-';
  if (number <= 45) return 'N-';
  if (number <= 60) return 'G-';
  if (number <= 75) return 'O-';
  return '';
};

export default NumberBoard;
