import React from 'react';
import { motion } from 'framer-motion';
import { FaUsers, FaTicketAlt, FaTrophy, FaCoins, FaFire, FaLock } from 'react-icons/fa';

const RoomCard = ({ room, onClick }) => {
  const getCurrencyIcon = (currency) => {
    return currency === 'coins' ? (
      <FaCoins className="text-yellow-500" />
    ) : (
      <FaFire className="text-orange-500" />
    );
  };

  const getVictoryModeName = (mode) => {
    switch(mode) {
      case 'line': return 'Línea';
      case 'corners': return 'Esquinas';
      case 'full': return 'Completo';
      default: return mode;
    }
  };

  const getModeIcon = (numbersMode) => {
    return numbersMode === 75 ? '🎱' : '🎯';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className="glass-effect p-6 rounded-xl hover:shadow-xl 
                 hover:shadow-purple-500/20 transition-all cursor-pointer"
      onClick={onClick}
    >
      {/* Header de la sala */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">
            {room.room_name || `Sala ${room.code}`}
          </h3>
          <p className="text-sm text-white/60">
            Host: {room.host_name}
          </p>
        </div>
        <div className="text-2xl">
          {getModeIcon(room.numbers_mode)}
        </div>
      </div>

      {/* Información de la sala */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60 flex items-center gap-2">
            <FaUsers /> Jugadores
          </span>
          <span className="text-white font-semibold">
            {room.player_count || 0}/{room.max_players}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60 flex items-center gap-2">
            <FaTicketAlt /> Precio cartón
          </span>
          <span className="text-white font-semibold flex items-center gap-1">
            {room.card_cost}
            {getCurrencyIcon(room.currency)}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60 flex items-center gap-2">
            <FaTrophy /> Modo
          </span>
          <span className="text-white font-semibold capitalize">
            {getVictoryModeName(room.victory_mode)}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60 flex items-center gap-2">
            💰 Pozo actual
          </span>
          <span className="text-white font-bold text-lg flex items-center gap-1">
            {room.pot_total || 0}
            {getCurrencyIcon(room.currency)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-purple-600/30 rounded text-xs text-purple-300">
            {room.numbers_mode} números
          </span>
          {room.room_type === 'private' && (
            <FaLock className="text-white/40" size={14} />
          )}
        </div>
        <button
          className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 
                     text-white rounded-lg text-sm font-semibold 
                     hover:shadow-lg hover:shadow-green-500/25 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          Unirse
        </button>
      </div>
    </motion.div>
  );
};

export default RoomCard;
