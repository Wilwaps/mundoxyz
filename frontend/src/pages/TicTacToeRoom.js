import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
  X, Circle, Trophy, Clock, Users, Coins, Flame, 
  ChevronLeft, RefreshCw, AlertCircle, Zap 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';

const TicTacToeRoom = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  
  const [room, setRoom] = useState(null);
  const [board, setBoard] = useState([
    [null, null, null],
    [null, null, null],
    [null, null, null]
  ]);
  const [timeLeft, setTimeLeft] = useState(15);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [mySymbol, setMySymbol] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [rematchRequested, setRematchRequested] = useState({
    byMe: false,
    byOpponent: false
  });
  const [connectionStatus, setConnectionStatus] = useState({
    opponentDisconnected: false,
    disconnectTimeout: null
  });
  
  // Reset states when room code changes (for rematch navigation)
  useEffect(() => {
    setRematchRequested({ byMe: false, byOpponent: false });
    setGameOver(false);
    setShowGameOverModal(false);
    setBoard([[null, null, null], [null, null, null], [null, null, null]]);
    setTimeLeft(15);
  }, [code]);
  
  // Fetch room details
  const { data: roomData, refetch: refetchRoom } = useQuery({
    queryKey: ['tictactoe-room', code],
    queryFn: async () => {
      const response = await axios.get(`/api/tictactoe/room/${code}`);
      return response.data.room;
    },
    refetchInterval: 2000, // Poll every 2 seconds
  });
  
  // Handle room data updates (replacement for onSuccess in v5)
  useEffect(() => {
    if (roomData) {
      // Debug logs
      console.log('Room data updated:', {
        player_x_id: roomData.player_x_id,
        player_o_id: roomData.player_o_id,
        current_user_id: user?.id,
        user_object: user,
        is_participant: roomData.is_participant
      });
      
      setRoom(roomData);
      setBoard(roomData.board || [[null, null, null], [null, null, null], [null, null, null]]);
      
      // Determine player symbol
      if (user && user.id) {
        if (roomData.player_x_id === user.id) {
          setMySymbol('X');
          setIsMyTurn(roomData.current_turn === 'X' && roomData.status === 'playing');
          console.log('User is Player X');
        } else if (roomData.player_o_id === user.id) {
          setMySymbol('O');
          setIsMyTurn(roomData.current_turn === 'O' && roomData.status === 'playing');
          console.log('User is Player O');
        } else {
          console.log('User is not a participant in this room');
        }
      } else {
        console.log('User object not available:', user);
      }
      
      // Check if game ended
      if (roomData.status === 'finished' && !gameOver) {
        setGameOver(true);
        setShowGameOverModal(true);
        // Refrescar balance después de que termine el juego
        setTimeout(async () => {
          queryClient.invalidateQueries(['balance']);
          queryClient.invalidateQueries(['economy']);
          await refreshUser(); // Actualizar balance en el header
        }, 1000);
      }
    }
  }, [roomData, user, gameOver, queryClient, refreshUser]);
  
  // Mark ready mutation (solo invitado)
  const markReadyMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post(`/api/tictactoe/room/${code}/ready`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('¡Estás listo!');
      refetchRoom();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al marcar listo');
    }
  });
  
  // Start game mutation (solo host)
  const startGameMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post(`/api/tictactoe/room/${code}/start`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('¡El juego ha comenzado!');
      refetchRoom();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al iniciar juego');
    }
  });
  
  // Make move mutation
  const makeMoveMutation = useMutation({
    mutationFn: async ({ row, col }) => {
      const response = await axios.post(`/api/tictactoe/room/${code}/move`, { row, col });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.gameOver) {
        setGameOver(true);
        setShowGameOverModal(true);
        
        if (data.reason === 'timeout') {
          toast.error('¡Tiempo agotado!');
        } else if (data.winner) {
          const isWinner = data.winnerId === user?.id;
          toast[isWinner ? 'success' : 'error'](
            isWinner ? '¡Ganaste!' : 'Has perdido'
          );
        } else if (data.isDraw) {
          toast('¡Empate!');
        }
      }
      refetchRoom();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al hacer movimiento');
    }
  });
  
  // Request rematch mutation
  const rematchMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post(`/api/tictactoe/room/${code}/rematch`);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.rematchAccepted) {
        toast.success(`¡Revancha aceptada! Sala: ${data.newRoomCode}`);
        navigate(`/tictactoe/room/${data.newRoomCode}`);
      } else {
        setRematchRequested(prev => ({ ...prev, byMe: true }));
        toast.success('Revancha solicitada. Esperando al oponente...');
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al solicitar revancha');
    }
  });
  
  // Timer countdown
  useEffect(() => {
    if (!room || room.status !== 'playing' || !isMyTurn) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up - will be handled by backend on next move attempt
          toast.error('¡Se acabó el tiempo!');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [room, isMyTurn]);
  
  // Reset timer when turn changes
  useEffect(() => {
    if (room?.status === 'playing') {
      setTimeLeft(15);
    }
  }, [room?.current_turn]);
  
  // Join socket room
  useEffect(() => {
    if (!socket || !code || !user || !mySymbol) return;
    
    // Unirse a la sala con userId y role
    socket.emit('tictactoe:join-room', {
      roomCode: code,
      userId: user.id,
      role: mySymbol
    });
    
    return () => {
      socket.emit('tictactoe:leave-room', { roomCode: code });
    };
  }, [socket, code, user, mySymbol]);
  
  // Socket listeners
  useEffect(() => {
    if (!socket || !code) return;
    
    const handlePlayerJoined = (data) => {
      if (data.roomCode === code) {
        toast('Un jugador se ha unido');
        refetchRoom();
      }
    };
    
    const handlePlayerReady = (data) => {
      if (data.roomCode === code) {
        refetchRoom();
      }
    };
    
    const handleGameStarted = (data) => {
      if (data.roomCode === code) {
        toast.success('¡El juego ha comenzado!');
        refetchRoom();
      }
    };
    
    const handleMoveMade = (data) => {
      if (data.roomCode === code) {
        refetchRoom();
      }
    };
    
    const handleGameOver = (data) => {
      if (data.roomCode === code) {
        refetchRoom();
        setGameOver(true);
        setShowGameOverModal(true);
      }
    };
    
    const handleRematchRequest = (data) => {
      if (data.roomCode === code && data.playerId !== user?.id) {
        setRematchRequested(prev => ({ ...prev, byOpponent: true }));
        toast('El oponente solicita revancha');
      }
    };
    
    const handlePlayerDisconnected = (data) => {
      if (data.roomCode === code && data.userId !== user?.id) {
        setConnectionStatus({
          opponentDisconnected: true,
          disconnectTimeout: data.timeoutSeconds
        });
        toast.error(`Oponente desconectado. Tiempo de espera: ${data.timeoutSeconds}s`, {
          duration: 5000
        });
      }
    };
    
    const handlePlayerReconnected = (data) => {
      if (data.roomCode === code && data.userId !== user?.id) {
        setConnectionStatus({
          opponentDisconnected: false,
          disconnectTimeout: null
        });
        toast.success('Oponente reconectado');
      }
    };
    
    const handleHostTransferred = (data) => {
      if (data.roomCode === code) {
        if (data.newHost === user?.id) {
          toast.success('¡Ahora eres el host de la sala!', { duration: 5000 });
          setMySymbol('X');
        } else {
          toast('El host ha sido transferido', { duration: 3000 });
        }
        refetchRoom();
      }
    };
    
    const handleRematchAccepted = (data) => {
      if (data.roomCode === code) {
        toast.success(`¡Revancha aceptada! Redirigiendo a nueva sala...`);
        // Actualizar balance antes de navegar
        refreshUser();
        setTimeout(() => {
          navigate(`/tictactoe/room/${data.newRoomCode}`);
        }, 1000);
      }
    };
    
    const handleRoomAbandoned = (data) => {
      if (data.roomCode === code) {
        toast.error(`Sala cancelada: ${data.reason}`, { duration: 5000 });
        if (data.refunded) {
          toast.success('Tu apuesta ha sido devuelta', { duration: 5000 });
        }
        setTimeout(() => {
          navigate('/tictactoe/lobby');
        }, 3000);
      }
    };
    
    socket.on('room:player-joined', handlePlayerJoined);
    socket.on('room:player-ready', handlePlayerReady);
    socket.on('room:game-started', handleGameStarted);
    socket.on('room:move-made', handleMoveMade);
    socket.on('room:game-over', handleGameOver);
    socket.on('room:rematch-request', handleRematchRequest);
    socket.on('room:rematch-accepted', handleRematchAccepted);
    socket.on('room:player-disconnected', handlePlayerDisconnected);
    socket.on('room:player-reconnected', handlePlayerReconnected);
    socket.on('room:host-transferred', handleHostTransferred);
    socket.on('room:abandoned', handleRoomAbandoned);
    
    return () => {
      socket.off('room:player-joined', handlePlayerJoined);
      socket.off('room:player-ready', handlePlayerReady);
      socket.off('room:game-started', handleGameStarted);
      socket.off('room:move-made', handleMoveMade);
      socket.off('room:game-over', handleGameOver);
      socket.off('room:rematch-request', handleRematchRequest);
      socket.off('room:rematch-accepted', handleRematchAccepted);
      socket.off('room:player-disconnected', handlePlayerDisconnected);
      socket.off('room:player-reconnected', handlePlayerReconnected);
      socket.off('room:host-transferred', handleHostTransferred);
      socket.off('room:abandoned', handleRoomAbandoned);
    };
  }, [socket, code, user, rematchRequested, navigate, refreshUser]);
  
  const handleCellClick = (row, col) => {
    if (!isMyTurn || board[row][col] || gameOver) return;
    if (room?.status !== 'playing') return;
    
    makeMoveMutation.mutate({ row, col });
  };
  
  const renderCell = (row, col) => {
    const value = board[row][col];
    const isWinningCell = room?.winning_line && checkIfWinningCell(row, col);
    
    return (
      <motion.button
        key={`${row}-${col}`}
        whileHover={!value && isMyTurn && !gameOver ? { scale: 1.05 } : {}}
        whileTap={!value && isMyTurn && !gameOver ? { scale: 0.95 } : {}}
        className={`
          aspect-square rounded-lg transition-all
          ${!value && isMyTurn && !gameOver 
            ? 'bg-white/5 hover:bg-white/10 cursor-pointer' 
            : 'bg-white/5 cursor-not-allowed'
          }
          ${isWinningCell ? 'ring-2 ring-success' : ''}
        `}
        onClick={() => handleCellClick(row, col)}
        disabled={!isMyTurn || gameOver || room?.status !== 'playing'}
      >
        <AnimatePresence mode="wait">
          {value && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="w-full h-full flex items-center justify-center"
            >
              {value === 'X' ? (
                <X size={48} className="text-violet" strokeWidth={3} />
              ) : (
                <Circle size={40} className="text-accent" strokeWidth={3} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    );
  };
  
  const checkIfWinningCell = (row, col) => {
    if (!room?.winning_line) return false;
    const { type, index } = room.winning_line;
    
    if (type === 'row' && row === index) return true;
    if (type === 'col' && col === index) return true;
    if (type === 'diag' && index === 0 && row === col) return true;
    if (type === 'diag' && index === 1 && row + col === 2) return true;
    
    return false;
  };
  
  if (!roomData) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="spinner"></div>
      </div>
    );
  }
  
  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/tictactoe/lobby')}
          className="flex items-center gap-2 text-text/60 hover:text-text transition-colors mb-4"
        >
          <ChevronLeft size={20} />
          Volver al Lobby
        </button>
        
        <div className="card-glass p-4">
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-text">Sala {code}</h1>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-sm text-text/60">
                  Modo: {room?.mode === 'coins' ? '🪙 Coins' : '🔥 Fires'}
                </span>
                <span className="text-sm text-text/60">
                  Apuesta: {room?.bet_amount}
                </span>
              </div>
              
              {/* Premio con desglose */}
              <div className="mt-3">
                {room?.status === 'waiting' && (
                  <div className="inline-block p-2 rounded-lg bg-violet/10 border border-violet/30">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">
                        {room?.mode === 'coins' ? `${room?.pot_coins || 0} 🪙` : `${room?.pot_fires || 0} 🔥`}
                      </span>
                      <span className="text-xs text-text/60">(Esperando oponente)</span>
                    </div>
                  </div>
                )}
                
                {room?.status === 'ready' && (
                  <div className="inline-block p-3 rounded-lg bg-success/10 border border-success/30">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-success mb-1">
                        {room?.mode === 'coins' ? `${room?.pot_coins || 0} 🪙` : `${room?.pot_fires || 0} 🔥`}
                      </div>
                      <div className="text-xs text-text/60 flex items-center gap-1 justify-center">
                        <span>Host: {room?.bet_amount}</span>
                        <span>+</span>
                        <span>Invitado: {room?.bet_amount}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {room?.status === 'playing' && (
                  <motion.div 
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="inline-block p-3 rounded-lg bg-gradient-to-r from-violet/20 to-accent/20 border-2 border-violet/50"
                  >
                    <div className="text-center">
                      <div className="text-xs font-semibold text-violet mb-1">PREMIO TOTAL</div>
                      <div className="text-3xl font-bold">
                        {room?.mode === 'coins' ? `${room?.pot_coins || 0} 🪙` : `${room?.pot_fires || 0} 🔥`}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
            
            {/* Timer */}
            {room?.status === 'playing' && (
              <div className={`flex flex-col items-center ${timeLeft <= 5 ? 'animate-pulse' : ''}`}>
                <Clock size={24} className={timeLeft <= 5 ? 'text-error' : 'text-text/60'} />
                <span className={`text-2xl font-bold ${timeLeft <= 5 ? 'text-error' : 'text-text'}`}>
                  {timeLeft}s
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Disconnection Alert */}
      {connectionStatus.opponentDisconnected && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-lg bg-error/20 border border-error/50"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="text-error mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="font-bold text-error">Oponente desconectado</h3>
              <p className="text-sm text-text/80 mt-1">
                Esperando reconexión... Tiempo restante: {connectionStatus.disconnectTimeout}s
              </p>
              <p className="text-xs text-text/60 mt-1">
                Si no se reconecta, la sala será gestionada automáticamente
              </p>
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Players */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Player X */}
        <div className={`card-glass p-4 ${room?.current_turn === 'X' && room?.status === 'playing' ? 'ring-2 ring-violet' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <X size={24} className="text-violet" />
            {room?.current_turn === 'X' && room?.status === 'playing' && (
              <Zap size={16} className="text-violet animate-pulse" />
            )}
          </div>
          <p className="font-semibold text-text">
            {room?.player_x_username || 'Esperando...'}
          </p>
          <p className="text-xs text-text/60">
            {room?.player_x_id === user?.id ? '(Tú)' : ''}
          </p>
          {room?.status === 'ready' && (
            <p className="text-xs text-success mt-1">
              {room?.player_x_ready ? '✓ Listo' : 'No listo'}
            </p>
          )}
        </div>
        
        {/* VS */}
        <div className="flex items-center justify-center">
          <span className="text-3xl font-bold text-text/40">VS</span>
        </div>
        
        {/* Player O */}
        <motion.div 
          animate={room?.status === 'ready' && room?.player_o_ready ? {
            boxShadow: [
              '0 0 20px rgba(134, 239, 172, 0.3)',
              '0 0 40px rgba(134, 239, 172, 0.6)',
              '0 0 20px rgba(134, 239, 172, 0.3)'
            ]
          } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
          className={`card-glass p-4 ${
            room?.current_turn === 'O' && room?.status === 'playing' 
              ? 'ring-2 ring-accent' 
              : room?.status === 'ready' && room?.player_o_ready
                ? 'ring-2 ring-success'
                : ''
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Circle size={20} className="text-accent" />
            {room?.current_turn === 'O' && room?.status === 'playing' && (
              <Zap size={16} className="text-accent animate-pulse" />
            )}
            {room?.status === 'ready' && room?.player_o_ready && (
              <span className="text-success text-2xl">✓</span>
            )}
          </div>
          <p className="font-semibold text-text">
            {room?.player_o_username || 'Esperando...'}
          </p>
          <p className="text-xs text-text/60">
            {room?.player_o_id === user?.id ? '(Tú)' : ''}
          </p>
          {room?.status === 'ready' && (
            <p className={`text-xs mt-1 font-semibold ${room?.player_o_ready ? 'text-success animate-pulse' : 'text-text/40'}`}>
              {room?.player_o_ready ? '✓ Listo para jugar' : 'No listo'}
            </p>
          )}
        </motion.div>
      </div>
      
      {/* Game Status Message */}
      {room?.status === 'waiting' && (
        <div className="mb-6 p-4 rounded-lg bg-violet/10 border border-violet/30">
          <div className="flex gap-2">
            <Users size={16} className="text-violet mt-0.5" />
            <p className="text-sm text-text/80">
              Esperando a que se una otro jugador...
            </p>
          </div>
        </div>
      )}
      
      {/* Ready Section */}
      {room?.status === 'ready' && mySymbol && (
        <div className="mb-6">
          {/* Invitado (Player O): Botón Listo */}
          {mySymbol === 'O' && !room?.player_o_ready && (
            <div className="text-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => markReadyMutation.mutate()}
                disabled={markReadyMutation.isPending}
                className="btn-primary px-8 py-3 text-lg animate-pulse"
              >
                {markReadyMutation.isPending ? 'Marcando...' : '¡Estoy Listo!'}
              </motion.button>
              <p className="text-sm text-text/60 mt-2">
                Marca listo cuando estés preparado para jugar
              </p>
            </div>
          )}
          
          {/* Invitado ya listo */}
          {mySymbol === 'O' && room?.player_o_ready && (
            <div className="p-4 rounded-lg bg-success/20 border border-success/50 text-center">
              <p className="text-success font-semibold">✓ Estás listo</p>
              <p className="text-sm text-text/60 mt-1">
                Esperando que el host inicie la partida...
              </p>
            </div>
          )}
          
          {/* Host (Player X): Ver estado del invitado */}
          {mySymbol === 'X' && (
            <div className="space-y-4">
              {/* Estado del invitado */}
              <div className={`p-4 rounded-lg border ${
                room?.player_o_ready 
                  ? 'bg-success/20 border-success/50' 
                  : 'bg-violet/10 border-violet/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users size={20} className={room?.player_o_ready ? 'text-success' : 'text-violet'} />
                    <div>
                      <p className="font-semibold">
                        {room?.player_o_ready ? '✓ Invitado está listo' : 'Esperando invitado...'}
                      </p>
                      <p className="text-xs text-text/60">
                        {room?.player_o_ready 
                          ? 'Puedes iniciar la partida cuando quieras' 
                          : 'El invitado debe marcar listo primero'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Botón Iniciar (solo si invitado listo) */}
              {room?.player_o_ready && (
                <div className="text-center">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => startGameMutation.mutate()}
                    disabled={startGameMutation.isPending}
                    className="btn-primary px-8 py-3 text-lg"
                  >
                    {startGameMutation.isPending ? 'Iniciando...' : '🎮 Iniciar Partida'}
                  </motion.button>
                  <p className="text-sm text-text/60 mt-2">
                    Comienza el juego cuando estés listo
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Game Board */}
      <div className="max-w-sm mx-auto mb-6">
        <div className="grid grid-cols-3 gap-3 aspect-square">
          {board.map((row, rowIndex) => 
            row.map((_, colIndex) => renderCell(rowIndex, colIndex))
          )}
        </div>
      </div>
      
      {/* Turn Indicator */}
      {room?.status === 'playing' && (
        <div className="text-center">
          {isMyTurn ? (
            <p className="text-lg font-semibold text-success">
              ¡Es tu turno! ({mySymbol})
            </p>
          ) : (
            <p className="text-lg text-text/60">
              Turno del oponente ({room?.current_turn})
            </p>
          )}
        </div>
      )}
      
      {/* Game Over Modal */}
      <AnimatePresence>
        {showGameOverModal && room?.status === 'finished' && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-dark/80 backdrop-blur-sm"
              onClick={() => setShowGameOverModal(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="card-glow p-6 max-w-md w-full relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                {room?.winner_id ? (
                  <>
                    {room?.winner_id === user?.id ? (
                      <>
                        <Trophy size={64} className="text-success mx-auto mb-4" />
                        <h2 className="text-3xl font-bold mb-2 text-success">
                          ¡Victoria!
                        </h2>
                        <p className="text-text/80 mb-4">
                          Has ganado {room?.mode === 'coins' 
                            ? `${room?.prize_coins || 0} 🪙` 
                            : `${room?.prize_fires || 0} 🔥`}
                        </p>
                      </>
                    ) : (
                      <>
                        <X size={64} className="text-error mx-auto mb-4" />
                        <h2 className="text-3xl font-bold mb-2 text-error">
                          Derrota
                        </h2>
                        <p className="text-text/80 mb-4">
                          Has perdido esta partida
                        </p>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-6xl mb-4">🤝</div>
                    <h2 className="text-3xl font-bold mb-2 text-text">
                      ¡Empate!
                    </h2>
                    <p className="text-text/80 mb-4">
                      Cada jugador recupera {room?.mode === 'coins' 
                        ? `${(room?.prize_coins || 0) / 2} 🪙` 
                        : `${(room?.prize_fires || 0) / 2} 🔥`}
                    </p>
                  </>
                )}
                
                <div className="mb-6 p-3 rounded-lg bg-violet/10 border border-violet/30">
                  <p className="text-sm text-text/80">
                    +1 XP ganado por participar
                  </p>
                </div>
                
                {/* Rematch Section */}
                {room?.rematch_count !== undefined && (
                  <p className="text-xs text-text/60 mb-4">
                    Revancha #{room?.rematch_count + 1}
                  </p>
                )}
                
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/tictactoe/lobby')}
                    className="flex-1 btn-secondary"
                  >
                    Volver al Lobby
                  </button>
                  
                  {!rematchRequested.byMe && (
                    <button
                      onClick={() => rematchMutation.mutate()}
                      disabled={rematchMutation.isPending}
                      className="flex-1 btn-primary flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={16} />
                      {rematchMutation.isPending ? 'Solicitando...' : 'Revancha'}
                    </button>
                  )}
                  
                  {rematchRequested.byMe && !rematchRequested.byOpponent && (
                    <button disabled className="flex-1 btn-secondary">
                      Esperando rival...
                    </button>
                  )}
                </div>
                
                {rematchRequested.byOpponent && !rematchRequested.byMe && (
                  <div className="mt-4 p-3 rounded-lg bg-success/10 border border-success/30">
                    <p className="text-sm text-success">
                      ¡El oponente quiere la revancha!
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TicTacToeRoom;
