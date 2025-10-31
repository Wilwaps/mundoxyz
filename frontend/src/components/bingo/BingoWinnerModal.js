import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Modal central que aparece cuando el usuario completa un patrón ganador
 * - Overlay oscuro 80%
 * - Botón central "¡BINGO!"
 * - Animaciones suaves
 */
const BingoWinnerModal = ({ isOpen, onCallBingo, cardId, cardNumber }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay oscuro 80% */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40"
            style={{ pointerEvents: 'none' }}
          />

          {/* Modal central */}
          <motion.div
            initial={{ scale: 0, opacity: 0, rotate: -180 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0, rotate: 180 }}
            transition={{ type: 'spring', damping: 15, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto">
              {/* Contenedor del botón */}
              <div className="flex flex-col items-center gap-6">
                {/* Texto informativo */}
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-center"
                >
                  <h2 className="text-3xl md:text-4xl font-bold text-yellow-400 mb-2 drop-shadow-lg">
                    ¡Patrón Completo!
                  </h2>
                  <p className="text-lg md:text-xl text-white drop-shadow-md">
                    Cartón #{cardNumber}
                  </p>
                </motion.div>

                {/* Botón BINGO central */}
                <motion.button
                  onClick={() => onCallBingo(cardId)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 400 }}
                  className="relative group"
                >
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-full blur-2xl opacity-75 group-hover:opacity-100 transition-opacity animate-pulse" />
                  
                  {/* Botón principal */}
                  <div className="relative px-16 py-12 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 rounded-full shadow-2xl">
                    <span className="text-6xl md:text-8xl font-black text-white drop-shadow-2xl">
                      ¡BINGO!
                    </span>
                  </div>

                  {/* Confetti particles */}
                  <motion.div
                    animate={{
                      rotate: [0, 360],
                      scale: [1, 1.2, 1]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'linear'
                    }}
                    className="absolute -top-4 -left-4 text-6xl"
                  >
                    🎉
                  </motion.div>
                  <motion.div
                    animate={{
                      rotate: [0, -360],
                      scale: [1, 1.3, 1]
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: 'linear'
                    }}
                    className="absolute -top-4 -right-4 text-6xl"
                  >
                    🎊
                  </motion.div>
                  <motion.div
                    animate={{
                      rotate: [0, 360],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: 'linear'
                    }}
                    className="absolute -bottom-4 -left-4 text-6xl"
                  >
                    ✨
                  </motion.div>
                  <motion.div
                    animate={{
                      rotate: [0, -360],
                      scale: [1, 1.4, 1]
                    }}
                    transition={{
                      duration: 2.2,
                      repeat: Infinity,
                      ease: 'linear'
                    }}
                    className="absolute -bottom-4 -right-4 text-6xl"
                  >
                    🎆
                  </motion.div>
                </motion.button>

                {/* Texto de instrucción */}
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-white/80 text-center text-lg drop-shadow-md"
                >
                  ¡Presiona para reclamar tu victoria!
                </motion.p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BingoWinnerModal;
