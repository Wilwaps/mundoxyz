import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { FaCoins, FaFire, FaMinus, FaPlus } from 'react-icons/fa';

const JoinRoomModal = ({ show, room, onClose, onSuccess }) => {
  const [numberOfCards, setNumberOfCards] = useState(1);
  const [password, setPassword] = useState('');

  const joinRoomMutation = useMutation({
    mutationFn: async ({ code, numberOfCards, password }) => {
      const response = await axios.post(`/api/bingo/rooms/${code}/join`, {
        numberOfCards,
        password
      });
      return response.data;
    },
    onSuccess: (data, { code }) => {
      toast.success(`¡Te uniste con ${data.cardsOwned} cartón(es)!`);
      onSuccess(code);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al unirse a la sala');
    }
  });

  const resetForm = () => {
    setNumberOfCards(1);
    setPassword('');
  };

  useEffect(() => {
    if (!show) {
      resetForm();
    }
  }, [show]);

  const handleJoin = () => {
    if (!room) return;
    
    if (room.room_type === 'private' && !password) {
      toast.error('Debes ingresar la contraseña');
      return;
    }

    joinRoomMutation.mutate({
      code: room.code,
      numberOfCards,
      password
    });
  };

  if (!show || !room) return null;

  const totalCost = numberOfCards * parseFloat(room.card_cost || 0);
  const maxCards = Math.min(room.max_cards_per_player || 10, 10);

  const getCurrencyIcon = (currency) => {
    return currency === 'coins' ? (
      <FaCoins className="text-yellow-500 inline" />
    ) : (
      <FaFire className="text-orange-500 inline" />
    );
  };

  const getCurrencyName = (currency) => {
    return currency === 'coins' ? 'monedas' : 'fuegos';
  };

  return (
    <AnimatePresence>
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
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            🎰 Unirse a Sala
          </h2>

          {/* Información de la sala */}
          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-white mb-2 flex items-center justify-between">
              <span>{room.room_name || `Sala ${room.code}`}</span>
              <span className="text-lg">
                {room.numbers_mode === 75 ? '🎱' : '🎯'}
              </span>
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/60">Host:</span>
                <span className="text-white">{room.host_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Modo:</span>
                <span className="text-white">{room.numbers_mode} números</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Victoria:</span>
                <span className="text-white">
                  {room.victory_mode === 'line' ? 'Línea' :
                   room.victory_mode === 'corners' ? 'Esquinas' : 'Completo'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Jugadores:</span>
                <span className="text-white">
                  {room.player_count || 0}/{room.max_players}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Precio por cartón:</span>
                <span className="text-white font-semibold flex items-center gap-1">
                  {room.card_cost} {getCurrencyIcon(room.currency)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-white/10">
                <span className="text-white/60">Pozo actual:</span>
                <span className="text-white font-bold text-lg flex items-center gap-1">
                  {room.pot_total || 0} {getCurrencyIcon(room.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Contraseña si es privada */}
          {room.room_type === 'private' && (
            <div className="mb-6">
              <label className="block text-white/80 text-sm mb-2">
                Contraseña de la sala <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Ingresa la contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 
                         rounded-lg text-white placeholder-white/40
                         focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}

          {/* Selector de cartones */}
          <div className="mb-6">
            <label className="block text-white/80 text-sm mb-2">
              ¿Cuántos cartones quieres comprar?
            </label>
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => setNumberOfCards(Math.max(1, numberOfCards - 1))}
                disabled={numberOfCards <= 1}
                className="w-12 h-12 rounded-lg bg-white/10 hover:bg-white/20 
                         transition-colors flex items-center justify-center
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaMinus className="text-white" />
              </button>
              
              <div className="flex-1 text-center">
                <div className="text-3xl font-bold text-white mb-1">
                  {numberOfCards}
                </div>
                <div className="text-xs text-white/60">
                  {numberOfCards === 1 ? 'cartón' : 'cartones'}
                </div>
              </div>
              
              <button
                onClick={() => setNumberOfCards(Math.min(maxCards, numberOfCards + 1))}
                disabled={numberOfCards >= maxCards}
                className="w-12 h-12 rounded-lg bg-white/10 hover:bg-white/20 
                         transition-colors flex items-center justify-center
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaPlus className="text-white" />
              </button>
            </div>
            
            {/* Slider */}
            <div className="mt-4">
              <input
                type="range"
                min="1"
                max={maxCards}
                value={numberOfCards}
                onChange={(e) => setNumberOfCards(parseInt(e.target.value))}
                className="w-full accent-purple-600"
              />
              <div className="flex justify-between text-xs text-white/40 mt-1">
                <span>1</span>
                <span>Máx: {maxCards}</span>
              </div>
            </div>
          </div>

          {/* Costo total */}
          <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 
                        rounded-lg p-4 mb-6 border border-purple-500/30">
            <div className="flex justify-between items-center">
              <span className="text-white/80">Costo total:</span>
              <div className="text-right">
                <div className="text-2xl font-bold text-white flex items-center gap-2">
                  {totalCost} {getCurrencyIcon(room.currency)}
                </div>
                <div className="text-xs text-white/60">
                  {numberOfCards} × {room.card_cost} {getCurrencyName(room.currency)}
                </div>
              </div>
            </div>
          </div>

          {/* Información adicional */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-6">
            <p className="text-xs text-blue-300">
              💡 <strong>Tip:</strong> Más cartones = más oportunidades de ganar, 
              pero también mayor inversión. ¡Juega responsablemente!
            </p>
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={joinRoomMutation.isPending}
              className="flex-1 px-6 py-3 bg-white/10 text-white rounded-xl 
                       font-semibold hover:bg-white/20 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              onClick={handleJoin}
              disabled={joinRoomMutation.isPending}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 
                       text-white rounded-xl font-semibold hover:shadow-lg 
                       hover:shadow-green-500/25 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {joinRoomMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-white/20 
                                border-t-white rounded-full" />
                  Uniéndose...
                </span>
              ) : (
                <>Unirse por {totalCost} {getCurrencyIcon(room.currency)}</>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default JoinRoomModal;
