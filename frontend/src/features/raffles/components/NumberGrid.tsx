/**
 * Sistema de Rifas V2 - NumberGrid Component
 * Grilla interactiva de números para selección y visualización
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Clock, User, Lock } from 'lucide-react';
import { RaffleNumber } from '../types';

interface NumberGridProps {
  totalNumbers: number;
  numbers: RaffleNumber[];
  userNumbers?: number[];
  onNumberClick?: (idx: number) => void;
  selectedNumbers?: number[];
  isSelecting?: boolean;
  disabled?: boolean;
  showOwners?: boolean;
  gridColumns?: number;
}

const NumberGrid: React.FC<NumberGridProps> = ({
  totalNumbers,
  numbers,
  userNumbers = [],
  onNumberClick,
  selectedNumbers = [],
  isSelecting = false,
  disabled = false,
  showOwners = false,
  gridColumns = 10
}) => {
  const [hoveredNumber, setHoveredNumber] = useState<number | null>(null);
  
  // Crear mapa de números para acceso rápido
  const numbersMap = useMemo(() => {
    const map = new Map<number, RaffleNumber>();
    numbers.forEach(num => {
      map.set(num.idx, num);
    });
    return map;
  }, [numbers]);
  
  // Obtener estado de un número
  const getNumberState = useCallback((idx: number) => {
    const number = numbersMap.get(idx);
    if (!number) return 'available';
    return number.state;
  }, [numbersMap]);
  
  // Verificar si número pertenece al usuario
  const isUserNumber = useCallback((idx: number) => {
    return userNumbers.includes(idx);
  }, [userNumbers]);
  
  // Verificar si número está seleccionado
  const isSelected = useCallback((idx: number) => {
    return selectedNumbers.includes(idx);
  }, [selectedNumbers]);
  
  // Obtener clase CSS para un número
  const getNumberClass = useCallback((idx: number) => {
    const state = getNumberState(idx);
    const isUser = isUserNumber(idx);
    const selected = isSelected(idx);
    
    let baseClass = 'relative w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg flex items-center justify-center font-bold text-xs sm:text-sm md:text-base transition-all duration-200 cursor-pointer select-none ';
    
    // Estado base del número
    if (state === 'sold' && !isUser) {
      baseClass += 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-60 ';
    } else if (state === 'reserved' && !isUser) {
      baseClass += 'bg-yellow-900/30 text-yellow-600 cursor-not-allowed ';
    } else if (state === 'reserved' && isUser) {
      baseClass += 'bg-yellow-500/20 text-yellow-400 ring-2 ring-yellow-500 ';
    } else if (state === 'sold' && isUser) {
      // Números propios vendidos - Azul turquesa brillante
      baseClass += 'bg-gradient-to-br from-cyan-500/30 to-blue-500/30 text-cyan-300 ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/20 ';
    } else if (selected) {
      baseClass += 'bg-fire-orange/30 text-fire-orange ring-2 ring-fire-orange ';
    } else {
      baseClass += 'bg-glass hover:bg-glass-lighter text-text ';
    }
    
    // Efectos hover
    if (!disabled && state === 'available' && !isUser) {
      baseClass += 'hover:scale-105 hover:shadow-lg ';
    }
    
    return baseClass;
  }, [getNumberState, isUserNumber, isSelected, disabled]);
  
  // Obtener icono para un número
  const getNumberIcon = useCallback((idx: number) => {
    const state = getNumberState(idx);
    const isUser = isUserNumber(idx);
    
    if (state === 'sold' && isUser) {
      return <Check className="absolute top-0 right-0 w-3 h-3 text-green-400" />;
    }
    if (state === 'sold' && !isUser) {
      return <Lock className="absolute top-0 right-0 w-3 h-3 text-gray-500" />;
    }
    if (state === 'reserved') {
      return <Clock className="absolute top-0 right-0 w-3 h-3 text-yellow-500" />;
    }
    if (isSelected(idx)) {
      return <Check className="absolute top-0 right-0 w-3 h-3 text-fire-orange" />;
    }
    return null;
  }, [getNumberState, isUserNumber, isSelected]);
  
  // Manejar click en número
  const handleNumberClick = useCallback((idx: number) => {
    if (disabled) return;
    
    const state = getNumberState(idx);
    const isUser = isUserNumber(idx);
    
    // No permitir click en números vendidos a otros
    if (state === 'sold' && !isUser) return;
    
    // No permitir click en números reservados por otros
    if (state === 'reserved' && !isUser) return;
    
    onNumberClick?.(idx);
  }, [disabled, getNumberState, isUserNumber, onNumberClick]);
  
  // Generar array de números
  const numberIndices = useMemo(() => {
    return Array.from({ length: totalNumbers }, (_, i) => i + 1);
  }, [totalNumbers]);
  
  // Calcular estadísticas
  const stats = useMemo(() => {
    let sold = 0;
    let reserved = 0;
    let available = 0;
    
    numberIndices.forEach(idx => {
      const state = getNumberState(idx);
      if (state === 'sold') sold++;
      else if (state === 'reserved') reserved++;
      else available++;
    });
    
    return { sold, reserved, available };
  }, [numberIndices, getNumberState]);
  
  return (
    <div className="space-y-4">
      {/* Estadísticas */}
      <div className="flex flex-wrap gap-3 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-600"></div>
          <span className="text-text/80">Vendidos: {stats.sold}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-600"></div>
          <span className="text-text/80">Reservados: {stats.reserved}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-glass"></div>
          <span className="text-text/80">Disponibles: {stats.available}</span>
        </div>
        {userNumbers.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-accent"></div>
            <span className="text-accent">Tus números: {userNumbers.length}</span>
          </div>
        )}
        {selectedNumbers.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-fire-orange"></div>
            <span className="text-fire-orange">Seleccionados: {selectedNumbers.length}</span>
          </div>
        )}
      </div>
      
      {/* Grilla de números */}
      <div 
        className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5 sm:gap-2 md:gap-3 p-3 sm:p-4 md:p-6 bg-glass rounded-xl"
      >
        <AnimatePresence>
          {numberIndices.map(idx => {
            const number = numbersMap.get(idx);
            const state = getNumberState(idx);
            
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileHover={!disabled && state === 'available' ? { scale: 1.05 } : {}}
                whileTap={!disabled && state === 'available' ? { scale: 0.95 } : {}}
                transition={{ duration: 0.1 }}
              >
                <div
                  className={getNumberClass(idx)}
                  onClick={() => handleNumberClick(idx)}
                  onMouseEnter={() => setHoveredNumber(idx)}
                  onMouseLeave={() => setHoveredNumber(null)}
                >
                  <span className="relative z-10">{idx}</span>
                  {getNumberIcon(idx)}
                  
                  {/* Tooltip con información del dueño */}
                  {showOwners && hoveredNumber === idx && number?.ownerUsername && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 z-50"
                    >
                      <div className="bg-dark px-3 py-1 rounded-lg shadow-lg whitespace-nowrap">
                        <div className="flex items-center gap-2 text-xs">
                          <User className="w-3 h-3" />
                          <span className="text-text">{number.ownerUsername}</span>
                        </div>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-dark rotate-45 -mt-1"></div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      
      {/* Leyenda de ayuda */}
      {isSelecting && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-glass/50 rounded-lg p-3 text-sm text-text/80"
        >
          <p className="flex items-center gap-2">
            <span className="text-fire-orange">💡</span>
            Click en los números disponibles para seleccionarlos
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default NumberGrid;
