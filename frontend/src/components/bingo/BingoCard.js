import React from 'react';
import { motion } from 'framer-motion';
import { FaStar } from 'react-icons/fa';

const BingoCard = ({ card, drawnNumbers = [], markedNumbers = [], onNumberClick, isWinner = false, mode = 75 }) => {
  if (!card) return null;

  const isNumberDrawn = (number) => {
    return drawnNumbers.includes(number);
  };

  const isNumberMarked = (number) => {
    return markedNumbers.includes(number);
  };

  const getCellClass = (number) => {
    const base = "relative flex items-center justify-center text-lg font-bold rounded-lg transition-all cursor-pointer";
    
    if (number === 'FREE' || number === null) {
      return `${base} bg-purple-600 text-white`;
    }
    
    const isDrawn = isNumberDrawn(number);
    const isMarked = isNumberMarked(number);
    
    if (isMarked) {
      return `${base} bg-green-500 text-white ring-2 ring-green-300`;
    } else if (isDrawn) {
      return `${base} bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 animate-pulse`;
    } else {
      return `${base} bg-white/10 text-white/70 hover:bg-white/20`;
    }
  };

  if (mode === 75) {
    // Modo 75 números - Cartón 5x5 con B-I-N-G-O
    const columns = ['B', 'I', 'N', 'G', 'O'];
    const grid = card.grid || card.card_data || [];

    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`glass-effect p-4 rounded-xl ${isWinner ? 'ring-4 ring-yellow-400 animate-pulse' : ''}`}
      >
        {/* Header con número de cartón */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-white/60">Cartón #{card.card_number || card.id}</span>
          {isWinner && (
            <span className="flex items-center gap-1 text-yellow-400">
              <FaStar /> ¡GANADOR!
            </span>
          )}
        </div>

        {/* Columnas B-I-N-G-O */}
        <div className="grid grid-cols-5 gap-1 mb-1">
          {columns.map((letter) => (
            <div key={letter} className="text-center font-bold text-2xl text-purple-400">
              {letter}
            </div>
          ))}
        </div>

        {/* Grid del cartón */}
        <div className="grid grid-cols-5 gap-1">
          {grid.map((column, colIndex) => 
            column.map((number, rowIndex) => {
              const cellKey = `${colIndex}-${rowIndex}`;
              const isFreeSpace = colIndex === 2 && rowIndex === 2;
              
              return (
                <motion.div
                  key={cellKey}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className={`aspect-square ${getCellClass(isFreeSpace ? 'FREE' : number)}`}
                  onClick={() => !isFreeSpace && number && onNumberClick(number)}
                >
                  {isFreeSpace ? (
                    <span className="text-xs">FREE</span>
                  ) : (
                    <span>{number}</span>
                  )}
                  {isNumberMarked(number) && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <div className="w-8 h-8 rounded-full bg-green-500/30 animate-ping" />
                    </motion.div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>

        {/* Estadísticas del cartón */}
        <div className="mt-3 pt-3 border-t border-white/10 flex justify-between text-xs text-white/60">
          <span>Marcados: {markedNumbers.length}</span>
          <span>Progreso: {Math.round((markedNumbers.length / 24) * 100)}%</span>
        </div>
      </motion.div>
    );
  } else {
    // Modo 90 números - Cartón 9x3
    const grid = card.grid || card.card_data || [];

    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`glass-effect p-4 rounded-xl ${isWinner ? 'ring-4 ring-yellow-400 animate-pulse' : ''}`}
      >
        {/* Header con número de cartón */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-white/60">Cartón #{card.card_number || card.id}</span>
          {isWinner && (
            <span className="flex items-center gap-1 text-yellow-400">
              <FaStar /> ¡GANADOR!
            </span>
          )}
        </div>

        {/* Grid del cartón 9x3 */}
        <div className="grid grid-cols-9 gap-1">
          {grid.map((row, rowIndex) => 
            row.map((number, colIndex) => {
              const cellKey = `${rowIndex}-${colIndex}`;
              
              return (
                <motion.div
                  key={cellKey}
                  whileHover={number ? { scale: 1.1 } : {}}
                  whileTap={number ? { scale: 0.95 } : {}}
                  className={`aspect-square text-sm ${
                    number ? getCellClass(number) : 'bg-transparent'
                  }`}
                  onClick={() => number && onNumberClick(number)}
                >
                  {number && (
                    <>
                      <span>{number}</span>
                      {isNumberMarked(number) && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                          <div className="w-6 h-6 rounded-full bg-green-500/30 animate-ping" />
                        </motion.div>
                      )}
                    </>
                  )}
                </motion.div>
              );
            })
          )}
        </div>

        {/* Estadísticas del cartón */}
        <div className="mt-3 pt-3 border-t border-white/10 flex justify-between text-xs text-white/60">
          <span>Marcados: {markedNumbers.length}</span>
          <span>Progreso: {Math.round((markedNumbers.length / 15) * 100)}%</span>
        </div>
      </motion.div>
    );
  }
};

export default BingoCard;
