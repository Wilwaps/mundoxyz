import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import BingoCard from '../components/bingo/BingoCard';
import NumberBoard from '../components/bingo/NumberBoard';
import BuyCardsModal from '../components/bingo/BuyCardsModal';
import BingoWaitingRoom from '../components/bingo/BingoWaitingRoom';
import NumberBoardModal from '../components/bingo/NumberBoardModal';
import BingoWinnerModal from '../components/bingo/BingoWinnerModal';
import { checkVictoryPattern } from '../utils/bingoValidation';
import { 
  FaArrowLeft, FaUsers, FaPlay, FaCheck, FaTrophy, 
  FaCoins, FaFire, FaCrown, FaTicketAlt, FaStop, FaRobot, FaShoppingCart,
  FaThLarge
} from 'react-icons/fa';

const BingoRoom = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { user } = useAuth();
  
  const [markedNumbers, setMarkedNumbers] = useState({});
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [lastNumber, setLastNumber] = useState(null);
  const [isAutoDrawing, setIsAutoDrawing] = useState(false);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerInfo, setWinnerInfo] = useState(null);
  const [showBuyCardsModal, setShowBuyCardsModal] = useState(false);
  const [showNumberBoardModal, setShowNumberBoardModal] = useState(false);
  const [drawCooldown, setDrawCooldown] = useState(false);
  const [winningCardId, setWinningCardId] = useState(null);
  const [winningCardNumber, setWinningCardNumber] = useState(null);
  const [showBingoModal, setShowBingoModal] = useState(false);
  const [lastMarkedNumber, setLastMarkedNumber] = useState(null);
  const [bingoCalled, setBingoCalled] = useState(false);

  // Obtener detalles de la sala
  const { data: roomData, isLoading } = useQuery({
    queryKey: ['bingo-room', code],
    queryFn: async () => {
      const response = await axios.get(`/api/bingo/rooms/${code}`);
      return response.data.room; // Devolver room directamente
    },
    refetchInterval: 3000
  });
  
  // Procesar room data
  const room = roomData || null;

  // Obtener balance del usuario
  const { data: balance } = useQuery({
    queryKey: ['economy-balance'],
    queryFn: async () => {
      const response = await axios.get('/api/economy/balance');
      return response.data;
    }
  });

  // Efecto para procesar datos de la sala (React Query V5 fix)
  useEffect(() => {
    if (roomData) {
      setDrawnNumbers(roomData.drawnNumbers || []);
      setLastNumber(roomData.lastNumber || null);
      setGameStatus(roomData.status || 'waiting');
    }
  }, [roomData]);

  // WebSocket effects
  useEffect(() => {
    if (!socket || !code) return;

    // Unirse a la sala
    socket.emit('bingo:join', { code });

    // Listeners de eventos
    socket.on('bingo:player_update', (data) => {
      queryClient.invalidateQueries(['bingo-room', code]);
    });

    socket.on('bingo:game_started', (data) => {
      setGameStatus('playing');
      toast.success('¡El juego ha comenzado!');
    });

    socket.on('bingo:number_drawn', (data) => {
      setDrawnNumbers(prev => [...prev, data.number]);
      setLastNumber(data.number);
      toast(`Número cantado: ${data.number}`, {
        icon: '🎰',
        duration: 3000
      });
    });

    socket.on('bingo:auto_draw_started', (data) => {
      setIsAutoDrawing(true);
    });

    socket.on('bingo:auto_draw_stopped', (data) => {
      setIsAutoDrawing(false);
    });

    socket.on('bingo:claim_in_progress', (data) => {
      toast.info(`${data.message}`, {
        icon: '⏳',
        duration: 2000
      });
    });

    socket.on('bingo:claim_invalid', (data) => {
      toast.error('BINGO inválido - Continúa jugando', {
        icon: '❌',
        duration: 4000
      });
      // Permitir cantar BINGO de nuevo
      setBingoCalled(false);
    });

    socket.on('bingo:game_over', (data) => {
      setGameStatus('finished');
      setWinnerInfo(data);
      setShowWinnerModal(true);
      setShowBingoModal(false); // Cerrar modal de BINGO
      
      // Mensaje diferenciado para ganador vs otros jugadores
      if (data.winnerId === user?.id) {
        toast.success('¡Felicitaciones! ¡Has ganado!', {
          icon: '🎉',
          duration: 5000
        });
      } else {
        toast(`${data.winnerName} ha ganado el BINGO`, {
          icon: '🏆',
          duration: 4000
        });
      }
    });

    return () => {
      socket.emit('bingo:leave', { code });
      socket.off('bingo:player_update');
      socket.off('bingo:game_started');
      socket.off('bingo:number_drawn');
      socket.off('bingo:claim_in_progress');
      socket.off('bingo:claim_invalid');
      socket.off('bingo:game_over');
    };
  }, [socket, code, queryClient, user]);

  // Detectar automáticamente cuando se completa un patrón ganador
  useEffect(() => {
    if (!room || !room.user_cards || gameStatus !== 'playing') return;
    if (showBingoModal) return; // Ya hay un modal abierto
    if (bingoCalled) return; // Ya se cantó BINGO, no volver a mostrar modal
    
    // NO disparar modal si el último número marcado fue FREE
    // FREE solo se marca para completar el patrón, no dispara victoria
    if (lastMarkedNumber === 'FREE') return;

    // Revisar todos los cartones del usuario
    for (const card of room.user_cards) {
      const cardMarked = markedNumbers[card.id] || [];
      const hasVictory = checkVictoryPattern(
        card.grid || card.card_data,
        cardMarked,
        room.victory_mode
      );

      if (hasVictory) {
        // ¡Patrón ganador detectado!
        setWinningCardId(card.id);
        setWinningCardNumber(card.card_number || card.id);
        setShowBingoModal(true);
        toast.success('¡Has completado el patrón ganador!', {
          icon: '🎉',
          duration: 5000
        });
        break; // Solo mostrar modal para el primer cartón ganador
      }
    }
  }, [markedNumbers, room, gameStatus, showBingoModal, lastMarkedNumber, bingoCalled]);

  // Marcar número en cartón
  const handleNumberClick = useCallback((cardId, number) => {
    // FREE se puede marcar siempre, sin necesidad de ser cantado
    if (number !== 'FREE' && !drawnNumbers.includes(number)) {
      toast.error('Este número aún no ha sido cantado');
      return;
    }

    // Prevenir doble-marcado
    const currentMarked = markedNumbers[cardId] || [];
    if (currentMarked.includes(number)) {
      return; // Ya está marcado, no hacer nada
    }

    socket.emit('bingo:mark_number', { code, cardId, number });
    
    // Guardar el último número marcado
    setLastMarkedNumber(number);
    
    setMarkedNumbers(prev => ({
      ...prev,
      [cardId]: [...(prev[cardId] || []), number]
    }));
  }, [code, socket, drawnNumbers, markedNumbers]);

  // Llamar BINGO
  const callBingo = useCallback((cardId) => {
    const cardMarked = markedNumbers[cardId] || [];
    
    if (cardMarked.length < 5) {
      toast.error('Necesitas más números marcados');
      return;
    }
    
    // Marcar que ya se cantó BINGO para prevenir que modal vuelva a aparecer
    setBingoCalled(true);
    
    socket.emit('bingo:call_bingo', { code, cardId });
    
    toast.info('Validando BINGO...', {
      icon: '⏳',
      duration: 3000
    });
  }, [code, socket, markedNumbers]);

  // Iniciar auto-draw (solo host)
  const toggleAutoDraw = useCallback(() => {
    if (isAutoDrawing) {
      socket.emit('bingo:stop_auto_draw', { code });
      setIsAutoDrawing(false);
      toast.success('Auto-draw detenido');
    } else {
      socket.emit('bingo:start_auto_draw', { code, interval: 5000 });
      setIsAutoDrawing(true);
      toast.success('Auto-draw iniciado (5 segundos por número)');
    }
  }, [code, socket, isAutoDrawing]);

  // Cantar número manual (solo host)
  const drawNumber = useMutation({
    mutationFn: async () => {
      // Prevenir llamadas múltiples rápidas
      if (drawCooldown) {
        throw new Error('Por favor espera un momento antes de cantar otro número');
      }
      setDrawCooldown(true);
      
      const response = await axios.post(`/api/bingo/rooms/${code}/draw`);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`¡Número ${data.drawnNumber} cantado!`);
      setDrawnNumbers(prev => [...prev, data.drawnNumber]);
      setLastNumber(data.drawnNumber);
      queryClient.invalidateQueries(['bingo-room', code]);
      
      // Cooldown de 300ms para prevenir race conditions
      setTimeout(() => setDrawCooldown(false), 300);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al cantar número');
      setDrawCooldown(false);
    }
  });

  // Marcar jugador listo
  const markReady = useMutation({
    mutationFn: async () => {
      const response = await axios.post(`/api/bingo/rooms/${code}/ready`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bingo-room', code]);
      toast.success('¡Estás listo!');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al marcar listo');
    }
  });

  // Iniciar juego (solo host)
  const startGame = useMutation({
    mutationFn: async () => {
      const response = await axios.post(`/api/bingo/rooms/${code}/start`);
      return response.data;
    },
    onSuccess: () => {
      setGameStatus('playing');
      toast.success('¡Juego iniciado!');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al iniciar el juego');
    }
  });

  const isHost = room?.host_id === user?.id;
  const myCards = room?.user_cards || room?.myCards || room?.cards || [];
  const players = room?.players || [];
  const currentPlayer = players.find(p => p.user_id === user?.id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 
                    flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 
                    flex items-center justify-center p-4">
        <div className="glass-effect p-8 rounded-xl text-center max-w-md">
          <div className="text-6xl mb-4">🎰</div>
          <h2 className="text-2xl font-bold text-white mb-2">Sala no encontrada</h2>
          <p className="text-white/60 mb-6">La sala de Bingo que buscas no existe o ha finalizado.</p>
          <button 
            onClick={() => navigate('/bingo/lobby')} 
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 
                     text-white rounded-xl font-semibold hover:shadow-lg 
                     hover:shadow-purple-500/25 transition-all"
          >
            Volver al Lobby
          </button>
        </div>
      </div>
    );
  }

  // Si está en estado de espera, listo o lobby, mostrar sala de espera
  if (room.status === 'waiting' || room.status === 'ready' || room.status === 'lobby') {
    return (
      <BingoWaitingRoom
        room={room}
        user={user}
        isHost={isHost}
        onLeave={() => navigate('/bingo/lobby')}
        onStartGame={() => startGame.mutate()}
      />
    );
  }

  // Si está en juego o finalizado, mostrar tablero de juego
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
      {/* Header */}
      <div className="glass-effect sticky top-0 z-40 border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/bingo/lobby')}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <FaArrowLeft className="text-white" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">
                  {room.room_name || `Sala ${room.code}`}
                </h1>
                <p className="text-sm text-white/60">Código: {room.code}</p>
              </div>
            </div>
            
            {/* Host Controls */}
            {isHost && gameStatus === 'playing' && (
              <div className="flex gap-2">
                <button
                  onClick={() => drawNumber.mutate()}
                  disabled={drawNumber.isPending || drawCooldown}
                  className="px-4 py-2 bg-gradient-to-r from-yellow-600 to-orange-600 
                           text-white rounded-lg font-semibold hover:shadow-lg 
                           hover:shadow-yellow-500/25 transition-all flex items-center gap-2
                           disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaPlay /> {drawNumber.isPending || drawCooldown ? 'Cantando...' : 'Cantar Número'}
                </button>
                <button
                  onClick={user?.experience >= 400 ? toggleAutoDraw : null}
                  disabled={user?.experience < 400}
                  title={user?.experience < 400 ? 'Se activa con 400 puntos de experiencia' : ''}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2
                            ${user?.experience < 400 
                              ? 'bg-gray-600 text-white/50 cursor-not-allowed' 
                              : isAutoDrawing 
                                ? 'bg-red-600 text-white hover:bg-red-700' 
                                : 'bg-green-600 text-white hover:bg-green-700'}`}
                >
                  {isAutoDrawing ? <FaStop /> : <FaRobot />}
                  {user?.experience < 400 
                    ? 'Se activa con 400 XP' 
                    : isAutoDrawing ? 'Detener Auto' : 'Auto-Cantar'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna izquierda - Tablero de números */}
          <div className="lg:col-span-1">
            <NumberBoard 
              drawnNumbers={drawnNumbers}
              lastNumber={lastNumber}
              mode={room.numbers_mode || 75}
              isAutoDrawing={isAutoDrawing}
            />

            {/* Información de la sala */}
            <div className="glass-effect p-4 rounded-xl mt-6">
              <h3 className="text-lg font-bold text-white mb-3">Información</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Estado:</span>
                  <span className={`font-semibold
                    ${room.status === 'waiting' ? 'text-yellow-400' :
                      room.status === 'playing' ? 'text-green-400' :
                      'text-blue-400'}`}>
                    {room.status === 'waiting' ? 'Esperando' :
                     room.status === 'playing' ? 'Jugando' :
                     room.status === 'finished' ? 'Finalizado' : 'Listo'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Jugadores:</span>
                  <span className="text-white font-semibold">
                    {players.length}/{room.max_players}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Pozo total:</span>
                  <span className="text-white font-semibold flex items-center gap-1">
                    {room.pot_total || 0}
                    {room.currency === 'coins' ? 
                      <FaCoins className="text-yellow-500" /> : 
                      <FaFire className="text-orange-500" />
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Modo victoria:</span>
                  <span className="text-white font-semibold capitalize">
                    {room.victory_mode === 'line' ? 'Línea' :
                     room.victory_mode === 'corners' ? 'Esquinas' : 'Completo'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Columna central - Mis cartones */}
          <div className="lg:col-span-2">
            {myCards.length > 0 ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-white">Mis Cartones ({myCards.length})</h2>
                  <div className="flex gap-2">
                    {/* Botón comprar más cartones (solo en espera) */}
                    {(room.status === 'waiting' || room.status === 'ready') && myCards.length < room.max_cards_per_player && (
                      <button
                        onClick={() => setShowBuyCardsModal(true)}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 
                                 text-white rounded-lg font-semibold hover:shadow-lg 
                                 hover:shadow-blue-500/25 transition-all flex items-center gap-2"
                      >
                        <FaShoppingCart /> Comprar Más
                      </button>
                    )}
                    {room.status === 'waiting' && !currentPlayer?.is_ready && (
                      <button
                        onClick={() => markReady.mutate()}
                        disabled={markReady.isPending}
                        className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 
                                 text-white rounded-lg font-semibold hover:shadow-lg 
                                 hover:shadow-green-500/25 transition-all flex items-center gap-2"
                      >
                        <FaCheck /> Estoy Listo
                      </button>
                    )}
                    {isHost && room.status === 'ready' && (
                      <button
                        onClick={() => startGame.mutate()}
                        disabled={startGame.isPending}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 
                                 text-white rounded-lg font-semibold hover:shadow-lg 
                                 hover:shadow-purple-500/25 transition-all flex items-center gap-2"
                      >
                        <FaPlay /> Iniciar Juego
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myCards.map((card) => (
                    <div key={card.id}>
                      <BingoCard 
                        card={card}
                        drawnNumbers={drawnNumbers}
                        markedNumbers={markedNumbers[card.id] || []}
                        onNumberClick={(number) => handleNumberClick(card.id, number)}
                        mode={room.numbers_mode || 75}
                      />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="glass-effect p-8 rounded-xl text-center">
                <FaTicketAlt className="text-6xl text-white/40 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No tienes cartones</h3>
                <p className="text-white/60 mb-4">
                  {isHost ? 'Como anfitrión, puedes comprar cartones para participar' : 'Compra cartones para participar en esta sala'}
                </p>
                {(room.status === 'waiting' || room.status === 'ready') && (
                  <button
                    onClick={() => setShowBuyCardsModal(true)}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 
                             text-white rounded-xl font-semibold hover:shadow-lg 
                             hover:shadow-purple-500/25 transition-all flex items-center gap-2 mx-auto"
                  >
                    <FaShoppingCart /> Comprar Cartones
                  </button>
                )}
                {room.status === 'playing' && (
                  <p className="text-yellow-400 text-sm">⚠️ El juego ya comenzó, solo puedes observar</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Lista de jugadores */}
        <div className="mt-6">
          <div className="glass-effect p-6 rounded-xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FaUsers /> Jugadores ({players.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {players.map((player) => (
                <div key={player.id} 
                     className="bg-white/5 p-3 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {player.user_id === room.host_id && (
                      <FaCrown className="text-yellow-400" />
                    )}
                    <div>
                      <div className="font-semibold text-white">
                        {player.user_name}
                      </div>
                      <div className="text-xs text-white/60">
                        {player.cards_owned} cartón{player.cards_owned !== 1 ? 'es' : ''}
                      </div>
                    </div>
                  </div>
                  {player.is_ready && (
                    <FaCheck className="text-green-400" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de compra de cartones */}
      <BuyCardsModal 
        isOpen={showBuyCardsModal}
        onClose={() => setShowBuyCardsModal(false)}
        roomCode={code}
        room={room}
        userBalance={room.currency === 'coins' ? balance?.coins_balance : balance?.fires_balance}
      />

      {/* Modal de celebración del ganador */}
      <AnimatePresence>
        {showWinnerModal && winnerInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 
                     flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0, y: 50 }}
              transition={{ type: 'spring', damping: 15, stiffness: 300 }}
              className="glass-effect p-8 md:p-12 rounded-3xl max-w-lg w-full text-center relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Confetti decorativo */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500"></div>
              
              {/* Emoji celebración */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="text-8xl mb-6"
              >
                🎉
              </motion.div>
              
              {/* Título */}
              <motion.h2
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 mb-4"
              >
                ¡BINGO!
              </motion.h2>
              
              {/* Ganador */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mb-6"
              >
                <p className="text-white/70 text-sm mb-2">🏆 Ganador:</p>
                <p className="text-2xl md:text-3xl font-bold text-white">
                  {winnerInfo.winnerName}
                </p>
              </motion.div>
              
              {/* Premio */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 p-6 rounded-2xl mb-8 border-2 border-yellow-500/30"
              >
                <p className="text-sm text-white/80 mb-3">💰 Premio Total:</p>
                <p className="text-4xl md:text-5xl font-black text-yellow-400 flex items-center justify-center gap-3">
                  {winnerInfo.totalPot?.toLocaleString()}
                  {room?.currency === 'coins' ? 
                    <FaCoins className="text-yellow-500" /> : 
                    <FaFire className="text-orange-500" />
                  }
                </p>
              </motion.div>
              
              {/* Botón */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                onClick={() => navigate('/bingo/lobby')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 
                         text-white rounded-xl font-bold text-lg shadow-2xl 
                         hover:shadow-purple-500/50 transition-all"
              >
                Aceptar - Volver al Lobby
              </motion.button>
              
              {/* Decoración inferior */}
              <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-purple-600 via-pink-600 to-red-600"></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón flotante para ver tabla de números */}
      {(gameStatus === 'playing' || drawnNumbers.length > 0) && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowNumberBoardModal(true)}
          className="fixed bottom-6 right-6 z-40 w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 
                   text-white rounded-full shadow-2xl shadow-purple-500/50 
                   flex items-center justify-center hover:shadow-purple-500/75 transition-all"
        >
          <FaThLarge className="text-2xl" />
          {drawnNumbers.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-yellow-500 text-black 
                           text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center
                           border-2 border-white">
              {drawnNumbers.length}
            </span>
          )}
        </motion.button>
      )}

      {/* Modal de tabla de números */}
      <NumberBoardModal
        isOpen={showNumberBoardModal}
        onClose={() => setShowNumberBoardModal(false)}
        drawnNumbers={drawnNumbers}
        totalNumbers={room?.numbers_mode || 75}
        mode={room?.numbers_mode || 75}
      />

      {/* Modal central de BINGO (aparece automáticamente al completar patrón) */}
      <BingoWinnerModal
        isOpen={showBingoModal}
        onCallBingo={(cardId) => {
          callBingo(cardId);
          setShowBingoModal(false);
        }}
        cardId={winningCardId}
        cardNumber={winningCardNumber}
      />
    </div>
  );
};

export default BingoRoom;
