import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from '@tanstack/react-query';
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
  const { user } = useAuth();
  const { socket } = useSocket();
  
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
  
  // Fetch room details
  const { data: roomData, refetch: refetchRoom } = useQuery({
    queryKey: ['tictactoe-room', code],
    queryFn: async () => {
      const response = await axios.get(`/api/tictactoe/room/${code}`);
      return response.data.room;
    },
    refetchInterval: 2000, // Poll every 2 seconds
    onSuccess: (data) => {
      setRoom(data);
      setBoard(data.board || [[null, null, null], [null, null, null], [null, null, null]]);
      
      // Determine player symbol
      if (user) {
        if (data.player_x_id === user.id) {
          setMySymbol('X');
          setIsMyTurn(data.current_turn === 'X' && data.status === 'playing');
        } else if (data.player_o_id === user.id) {
          setMySymbol('O');
          setIsMyTurn(data.current_turn === 'O' && data.status === 'playing');
        }
      }
      
      // Check if game ended
      if (data.status === 'finished' && !gameOver) {
        setGameOver(true);
        setShowGameOverModal(true);
      }
    }
  });
  
  // Mark ready mutation
  const markReadyMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post(`/api/tictactoe/room/${code}/ready`);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.gameStarted) {
        toast.success('¡El juego ha comenzado!');
      } else {
        toast.success('Estás listo');
      }
      refetchRoom();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al marcar listo');
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
        setRematchRequested({ ...rematchRequested, byMe: true });
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
        setRematchRequested({ ...rematchRequested, byOpponent: true });
        toast('El oponente solicita revancha');
      }
    };
    
    socket.on('room:player-joined', handlePlayerJoined);
    socket.on('room:player-ready', handlePlayerReady);
    socket.on('room:game-started', handleGameStarted);
    socket.on('room:move-made', handleMoveMade);
    socket.on('room:game-over', handleGameOver);
    socket.on('room:rematch-request', handleRematchRequest);
    
    return () => {
      socket.off('room:player-joined', handlePlayerJoined);
      socket.off('room:player-ready', handlePlayerReady);
      socket.off('room:game-started', handleGameStarted);
      socket.off('room:move-made', handleMoveMade);
      socket.off('room:game-over', handleGameOver);
      socket.off('room:rematch-request', handleRematchRequest);
    };
  }, [socket, code, user, rematchRequested]);
  
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
            <div>
              <h1 className="text-2xl font-bold text-text">Sala {code}</h1>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-sm text-text/60">
                  Modo: {room?.mode === 'coins' ? '🪙 Coins' : '🔥 Fires'}
                </span>
                <span className="text-sm text-text/60">
                  Apuesta: {room?.bet_amount}
                </span>
                <span className="text-sm text-text/60">
                  Premio: {room?.mode === 'coins' 
                    ? `${room.pot_coins} 🪙` 
                    : `${room.pot_fires} 🔥`}
                </span>
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
        <div className={`card-glass p-4 ${room?.current_turn === 'O' && room?.status === 'playing' ? 'ring-2 ring-accent' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <Circle size={20} className="text-accent" />
            {room?.current_turn === 'O' && room?.status === 'playing' && (
              <Zap size={16} className="text-accent animate-pulse" />
            )}
          </div>
          <p className="font-semibold text-text">
            {room?.player_o_username || 'Esperando...'}
          </p>
          <p className="text-xs text-text/60">
            {room?.player_o_id === user?.id ? '(Tú)' : ''}
          </p>
          {room?.status === 'ready' && (
            <p className="text-xs text-success mt-1">
              {room?.player_o_ready ? '✓ Listo' : 'No listo'}
            </p>
          )}
        </div>
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
      
      {room?.status === 'ready' && !room?.player_x_ready && !room?.player_o_ready && (
        <div className="mb-6 p-4 rounded-lg bg-success/10 border border-success/30">
          <div className="flex gap-2">
            <AlertCircle size={16} className="text-success mt-0.5" />
            <p className="text-sm text-text/80">
              Ambos jugadores deben marcar "Listo" para comenzar
            </p>
          </div>
        </div>
      )}
      
      {/* Ready Button */}
      {room?.status === 'ready' && mySymbol && (
        <div className="mb-6 text-center">
          {((mySymbol === 'X' && !room.player_x_ready) || 
            (mySymbol === 'O' && !room.player_o_ready)) && (
            <button
              onClick={() => markReadyMutation.mutate()}
              disabled={markReadyMutation.isPending}
              className="btn-primary"
            >
              {markReadyMutation.isPending ? 'Marcando...' : '¡Estoy Listo!'}
            </button>
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
                {room.winner_id ? (
                  <>
                    {room.winner_id === user?.id ? (
                      <>
                        <Trophy size={64} className="text-success mx-auto mb-4" />
                        <h2 className="text-3xl font-bold mb-2 text-success">
                          ¡Victoria!
                        </h2>
                        <p className="text-text/80 mb-4">
                          Has ganado {room.mode === 'coins' 
                            ? `${room.prize_coins} 🪙` 
                            : `${room.prize_fires} 🔥`}
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
                      Cada jugador recupera {room.mode === 'coins' 
                        ? `${room.prize_coins / 2} 🪙` 
                        : `${room.prize_fires / 2} 🔥`}
                    </p>
                  </>
                )}
                
                <div className="mb-6 p-3 rounded-lg bg-violet/10 border border-violet/30">
                  <p className="text-sm text-text/80">
                    +1 XP ganado por participar
                  </p>
                </div>
                
                {/* Rematch Section */}
                {room.rematch_count !== undefined && (
                  <p className="text-xs text-text/60 mb-4">
                    Revancha #{room.rematch_count + 1}
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
