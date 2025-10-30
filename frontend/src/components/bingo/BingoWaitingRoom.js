import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
  FaUsers, FaPlay, FaCheck, FaTrophy, 
  FaCoins, FaFire, FaCrown, FaTicketAlt, FaShoppingCart,
  FaArrowLeft, FaTimes
} from 'react-icons/fa';
import BingoCard from './BingoCard';

const BingoWaitingRoom = ({ room, user, isHost, onLeave, onStartGame }) => {
  const queryClient = useQueryClient();
  const [showBuyCardsModal, setShowBuyCardsModal] = useState(false);
  
  const myCards = room?.user_cards || [];
  const totalPot = room?.total_pot || 0;
  const currency = room?.currency || 'coins';
  
  // Usar propiedades del backend directamente
  const amIReady = room?.amIReady || false;
  
  // Debug logs
  console.log('🎰 BingoWaitingRoom Debug:', {
    status: room?.status,
    amIReady,
    myCardsLength: myCards.length,
    showReadyButton: (room?.status === 'lobby' || room?.status === 'ready') && !amIReady && myCards.length > 0
  });

  // Marcar jugador listo
  const markReady = useMutation({
    mutationFn: async () => {
      console.log('🎯 Llamando a /ready para sala:', room.code);
      const response = await axios.post(`/api/bingo/rooms/${room.code}/ready`);
      console.log('✅ Respuesta de /ready:', response.data);
      return response.data;
    },
    onSuccess: (data) => {
      console.log('🎉 Marcado como listo exitoso:', data);
      toast.success('¡Marcado como listo!');
      queryClient.invalidateQueries(['bingo-room', room.code]);
    },
    onError: (error) => {
      console.error('❌ Error al marcar listo:', error);
      toast.error(error.response?.data?.error || 'Error al marcar listo');
    }
  });

  // Comprar cartones
  const buyCards = useMutation({
    mutationFn: async (numberOfCards) => {
      const response = await axios.post(`/api/bingo/rooms/${room.code}/join`, {
        numberOfCards,
        password: ''
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`¡Compraste ${data.cards_purchased} cartones!`);
      setShowBuyCardsModal(false);
      queryClient.invalidateQueries(['bingo-room', room.code]);
      queryClient.invalidateQueries(['economy-balance']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al comprar cartones');
    }
  });

  const allPlayersReady = room?.players?.every(p => p.is_ready) && room?.players?.length > 0;
  const canStart = isHost && allPlayersReady && (room.status === 'lobby' || room.status === 'ready');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900/20 to-blue-900/20 p-4">
      {/* Header */}
      <div className="glass-effect rounded-xl p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <FaCrown className="text-yellow-400" />
              Sala de Espera
            </h1>
            <p className="text-white/80">Código: <span className="font-mono text-xl text-yellow-400">{room?.code}</span></p>
            <p className="text-white/60">Host: {room?.host_username}</p>
          </div>
          <button
            onClick={onLeave}
            className="px-4 py-2 bg-red-600/80 text-white rounded-lg hover:bg-red-700 transition-all flex items-center gap-2"
          >
            <FaArrowLeft /> Salir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel izquierdo - Información de la sala */}
        <div className="space-y-6">
          {/* Configuración */}
          <div className="glass-effect rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FaTrophy className="text-yellow-400" />
              Configuración
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-white/60">Modo:</span>
                <span className="text-white font-semibold">
                  {room?.numbers_mode} números
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Victoria:</span>
                <span className="text-white font-semibold capitalize">
                  {room?.victory_mode === 'line' ? 'Línea' :
                   room?.victory_mode === 'corners' ? 'Esquinas' : 'Completo'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Precio:</span>
                <span className="text-white font-semibold flex items-center gap-1">
                  {currency === 'coins' ? <FaCoins className="text-yellow-400" /> : <FaFire className="text-orange-400" />}
                  {room?.card_cost}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Max jugadores:</span>
                <span className="text-white font-semibold">{room?.max_players}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Max cartones:</span>
                <span className="text-white font-semibold">{room?.max_cards_per_player}</span>
              </div>
            </div>
          </div>

          {/* Pozo acumulado */}
          <div className="glass-effect rounded-xl p-6 bg-gradient-to-br from-yellow-600/20 to-orange-600/20">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FaCoins className="text-yellow-400" />
              Pozo Acumulado
            </h2>
            <div className="text-center">
              <div className="text-4xl font-bold text-yellow-400 mb-2">
                {currency === 'coins' ? <FaCoins className="text-yellow-400" /> : <FaFire className="text-orange-400" />}
                {totalPot}
              </div>
              <p className="text-white/60 text-sm">
                Distribución: 70% ganador, 20% host, 10% plataforma
              </p>
            </div>
          </div>
        </div>

        {/* Panel central - Jugadores y estado */}
        <div className="space-y-6">
          {/* Jugadores */}
          <div className="glass-effect rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FaUsers className="text-blue-400" />
              Jugadores ({room?.current_players}/{room?.max_players})
            </h2>
            <div className="space-y-3">
              {room?.players?.map((player) => (
                <motion.div
                  key={player.user_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    player.is_host ? 'bg-yellow-600/20 border border-yellow-600/50' : 'bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {player.is_host && <FaCrown className="text-yellow-400" />}
                    <span className="text-white font-semibold">
                      {player.username}
                      {player.user_id === user?.id && ' (Tú)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-white/60 text-sm">
                      {player.cards_count} cartones
                    </span>
                    {player.is_ready ? (
                      <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full flex items-center gap-1">
                        <FaCheck /> Listo
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-600 text-white text-xs rounded-full">
                        Esperando
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
            
            {room?.current_players === 0 && (
              <div className="text-center py-8">
                <FaUsers className="text-4xl text-white/40 mx-auto mb-2" />
                <p className="text-white/60">Esperando jugadores...</p>
              </div>
            )}
          </div>

          {/* Estado del juego */}
          <div className="glass-effect rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Estado</h2>
            <div className="text-center">
              {room?.status === 'waiting' && (
                <div>
                  <div className="text-2xl font-bold text-yellow-400 mb-2">⏳ Esperando</div>
                  <p className="text-white/60">Los jugadores se están uniendo y comprando cartones</p>
                </div>
              )}
              {room?.status === 'ready' && (
                <div>
                  <div className="text-2xl font-bold text-green-400 mb-2">✅ Listo para iniciar</div>
                  <p className="text-white/60">
                    {allPlayersReady ? '¡Todos los jugadores están listos!' : 'Esperando que todos marquen "listo"'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel derecho - Mis cartones y acciones */}
        <div className="space-y-6">
          {/* Mis cartones */}
          <div className="glass-effect rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FaTicketAlt className="text-purple-400" />
              Mis Cartones ({myCards.length})
            </h2>
            
            {myCards.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {myCards.slice(0, 3).map((card) => (
                  <div key={card.id} className="bg-white/10 rounded-lg p-3">
                    <div className="text-white/60 text-sm mb-2">Cartón #{card.id}</div>
                    <div className="grid grid-cols-5 gap-1 text-xs">
                      {card.numbers.slice(0, 15).map((num, idx) => (
                        <div key={idx} className="bg-white/20 rounded p-1 text-center text-white">
                          {num || '-'}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {myCards.length > 3 && (
                  <p className="text-white/60 text-center">... y {myCards.length - 3} más</p>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <FaTicketAlt className="text-4xl text-white/40 mx-auto mb-2" />
                <p className="text-white/60 mb-4">No tienes cartones</p>
                <button
                  onClick={() => setShowBuyCardsModal(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all flex items-center gap-2 mx-auto"
                >
                  <FaShoppingCart /> Comprar Cartones
                </button>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="glass-effect rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Acciones</h2>
            <div className="space-y-3">
              {/* Comprar más cartones */}
              {(room?.status === 'lobby' || room?.status === 'ready') && 
               myCards.length < room?.max_cards_per_player && (
                <button
                  onClick={() => setShowBuyCardsModal(true)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <FaShoppingCart /> Comprar Más Cartones
                </button>
              )}

              {/* Marcar listo */}
              {(room?.status === 'lobby' || room?.status === 'ready') && !amIReady && myCards.length > 0 && (
                <button
                  onClick={() => {
                    console.log('🟢 Click en botón Estoy Listo');
                    markReady.mutate();
                  }}
                  disabled={markReady.isPending}
                  className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-3 border-2 border-green-400/50"
                >
                  <FaCheck className="text-2xl" /> {markReady.isPending ? 'Marcando...' : 'Estoy Listo'}
                </button>
              )}

              {/* Iniciar juego (solo host) */}
              {canStart && (
                <button
                  onClick={onStartGame}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 animate-pulse"
                >
                  <FaPlay /> Iniciar Partida
                </button>
              )}

              {/* Mensaje para host esperando jugadores */}
              {isHost && !allPlayersReady && room?.players?.length > 0 && (
                <div className="text-center py-3 px-4 bg-yellow-600/20 rounded-lg">
                  <span className="text-yellow-400 font-semibold text-sm">
                    ⏳ Esperando que todos estén listos ({room.players.filter(p => p.is_ready).length}/{room.players.length})
                  </span>
                </div>
              )}

              {/* Estado de listo */}
              {amIReady && (
                <div className="text-center py-2 px-4 bg-green-600/20 rounded-lg">
                  <span className="text-green-400 font-semibold flex items-center justify-center gap-2">
                    <FaCheck /> ¡Estás listo!
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal comprar cartones */}
      <AnimatePresence>
        {showBuyCardsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={() => setShowBuyCardsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-effect rounded-xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Comprar Cartones</h3>
                <button
                  onClick={() => setShowBuyCardsModal(false)}
                  className="text-white/60 hover:text-white"
                >
                  <FaTimes />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-white/60 text-sm">Cantidad de cartones</label>
                  <input
                    type="range"
                    min="1"
                    max={Math.min(5, room?.max_cards_per_player - myCards.length || 1)}
                    defaultValue="1"
                    className="w-full"
                    id="cardsRange"
                  />
                  <div className="text-center text-white font-semibold" id="cardsDisplay">1</div>
                </div>
                
                <div className="text-center">
                  <p className="text-white/60">Costo total:</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {currency === 'coins' ? <FaCoins /> : <FaFire />}
                    <span id="totalCost">1</span>
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    const count = parseInt(document.getElementById('cardsRange').value);
                    buyCards.mutate(count);
                  }}
                  disabled={buyCards.isPending}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  {buyCards.isPending ? 'Comprando...' : 'Confirmar Compra'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Script para actualizar costo */}
      <script dangerouslySetInnerHTML={{
        __html: `
          const range = document.getElementById('cardsRange');
          const display = document.getElementById('cardsDisplay');
          const cost = document.getElementById('totalCost');
          if (range) {
            range.addEventListener('input', (e) => {
              const value = e.target.value;
              display.textContent = value;
              cost.textContent = value * ${room?.card_cost || 1};
            });
          }
        `
      }} />
    </div>
  );
};

export default BingoWaitingRoom;
