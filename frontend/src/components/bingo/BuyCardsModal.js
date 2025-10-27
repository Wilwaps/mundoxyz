import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaCoins, FaFire, FaTicketAlt } from 'react-icons/fa';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const BuyCardsModal = ({ 
  isOpen, 
  onClose, 
  roomCode, 
  room, 
  userBalance 
}) => {
  const [numberOfCards, setNumberOfCards] = useState(1);
  const queryClient = useQueryClient();

  const totalCost = numberOfCards * room.card_cost;
  const canAfford = userBalance >= totalCost;

  const buyCardsMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post(`/api/bingo/rooms/${roomCode}/join`, {
        numberOfCards,
        password: room.room_type === 'private' ? room.password : undefined
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bingo-room', roomCode]);
      queryClient.invalidateQueries(['economy-balance']);
      toast.success(`¡${numberOfCards} cartón${numberOfCards > 1 ? 'es' : ''} comprado${numberOfCards > 1 ? 's' : ''}!`);
      onClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al comprar cartones');
    }
  });

  const handleBuy = () => {
    if (!canAfford) {
      toast.error('No tienes suficiente saldo');
      return;
    }
    buyCardsMutation.mutate();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 
                   flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="glass-effect p-6 rounded-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <FaTicketAlt className="text-2xl text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Comprar Cartones</h2>
                  <p className="text-sm text-white/60">
                    Sala {room.room_name || room.code}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <FaTimes className="text-white" />
              </button>
            </div>

            {/* Información de precios */}
            <div className="bg-white/5 p-4 rounded-xl mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-white/60">Precio por cartón:</span>
                <span className="text-white font-semibold flex items-center gap-2">
                  {room.card_cost}
                  {room.currency === 'coins' ? 
                    <FaCoins className="text-yellow-500" /> : 
                    <FaFire className="text-orange-500" />
                  }
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/60">Tu saldo:</span>
                <span className="text-white font-semibold flex items-center gap-2">
                  {userBalance?.toFixed(2) || 0}
                  {room.currency === 'coins' ? 
                    <FaCoins className="text-yellow-500" /> : 
                    <FaFire className="text-orange-500" />
                  }
                </span>
              </div>
            </div>

            {/* Selector de cantidad */}
            <div className="mb-6">
              <label className="block text-white/80 mb-2">
                Cantidad de cartones (máx: {room.max_cards_per_player})
              </label>
              <input
                type="number"
                min="1"
                max={room.max_cards_per_player}
                value={numberOfCards}
                onChange={(e) => setNumberOfCards(Math.max(1, Math.min(room.max_cards_per_player, parseInt(e.target.value) || 1)))}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl 
                         text-white placeholder-white/40 focus:outline-none focus:border-purple-500 
                         transition-colors text-center text-2xl font-bold"
              />
              
              {/* Slider */}
              <input
                type="range"
                min="1"
                max={room.max_cards_per_player}
                value={numberOfCards}
                onChange={(e) => setNumberOfCards(parseInt(e.target.value))}
                className="w-full mt-4 accent-purple-500"
              />
            </div>

            {/* Resumen */}
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 p-4 rounded-xl mb-6 border border-purple-500/30">
              <div className="flex justify-between items-center">
                <span className="text-white font-semibold">Total a pagar:</span>
                <span className={`text-2xl font-bold flex items-center gap-2 ${
                  canAfford ? 'text-white' : 'text-red-400'
                }`}>
                  {totalCost}
                  {room.currency === 'coins' ? 
                    <FaCoins className={canAfford ? 'text-yellow-500' : 'text-red-400'} /> : 
                    <FaFire className={canAfford ? 'text-orange-500' : 'text-red-400'} />
                  }
                </span>
              </div>
              {!canAfford && (
                <p className="text-red-400 text-sm mt-2">
                  ⚠️ Saldo insuficiente
                </p>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-white/10 text-white rounded-xl 
                         font-semibold hover:bg-white/20 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleBuy}
                disabled={!canAfford || buyCardsMutation.isPending}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all
                  ${canAfford && !buyCardsMutation.isPending
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg hover:shadow-purple-500/25'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
              >
                {buyCardsMutation.isPending ? 'Comprando...' : 'Comprar'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BuyCardsModal;
