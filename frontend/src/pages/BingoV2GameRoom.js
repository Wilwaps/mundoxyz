import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import BingoV2Card from '../components/bingo/BingoV2Card';
import { Clock, LogOut, Repeat } from 'lucide-react';
import API_URL from '../config/api';
import './BingoV2GameRoom.css';
import toast from 'react-hot-toast';

/* eslint-disable no-use-before-define */

const BingoV2GameRoom = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [room, setRoom] = useState(null);
  const [myCards, setMyCards] = useState([]);
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [lastCalledNumber, setLastCalledNumber] = useState(null);
  const [canCallBingo, setCanCallBingo] = useState(false);
  const [showNumbersBoard, setShowNumbersBoard] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winner, setWinner] = useState(null);
  const [prizes, setPrizes] = useState(null);
  const [autoCallEnabled, setAutoCallEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  const [remainingTime, setRemainingTime] = useState(30);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // eslint-disable-next-line no-use-before-define
  useEffect(() => {
    // CRITICAL: Validate user authentication
    if (!user || !user.id) {
      console.error('❌ User not authenticated in BingoV2GameRoom');
      alert('Error: Usuario no autenticado. Redirigiendo al lobby...');
      navigate('/bingo');
      return;
    }

    // eslint-disable-next-line no-use-before-define
    loadRoomAndCards();
    // eslint-disable-next-line no-use-before-define
    loadUserExperience();

    if (socket && user) {
      socket.emit('bingo:join_room', {
        roomCode: code,
        userId: user.id
      });

      socket.on('bingo:room_state', (roomData) => {
        setRoom(roomData);
        setDrawnNumbers(roomData.drawn_numbers || []);
      });

      socket.on('bingo:number_called', (data) => {
        setLastCalledNumber(data.number);
        setDrawnNumbers(data.drawnNumbers);
        
        // Auto-highlight numbers
        highlightCalledNumber(data.number);
      });

      socket.on('bingo:auto_call_enabled', () => {
        setAutoCallEnabled(true);
      });

      socket.on('bingo:auto_call_disabled', () => {
        setAutoCallEnabled(false);
      });

      socket.on('bingo:auto_call_forced', (data) => {
        setAutoCallEnabled(true);
        alert(data.message || 'Autocanto activado automáticamente');
      });

      socket.on('bingo:game_over', (data) => {
        console.log('🎉 GAME OVER EVENT RECEIVED:', data);
        setWinner(data.winner);
        setPrizes(data.prizes || null);
        setShowWinnerModal(true);
        
        // CRITICAL FIX: Actualizar estado de sala para permitir nueva ronda
        if (data.room) {
          setRoom(data.room);
          console.log('✅ Room state updated to:', data.room.status);
        }
      });

      socket.on('bingo:error', (data) => {
        const message = data?.message || 'Error en Bingo';
        console.warn('Bingo Error:', message);
        if (message.includes('espera un momento')) {
          return;
        } else if (message.includes('All numbers')) {
          alert('¡Todos los números han sido cantados!');
        } else if (message.toLowerCase().includes('experiencia')) {
          const match = message.match(/(\d+)/);
          const diff = match ? parseInt(match[1], 10) : null;
          const text = Number.isFinite(diff)
            ? `Todavía te faltan ${diff} puntos de experiencia para esta función`
            : 'Todavía te falta experiencia para esta función';
          toast.error(text);
        } else {
          alert(message);
        }
      });

      return () => {
        socket.off('bingo:room_state');
        socket.off('bingo:number_called');
        socket.off('bingo:auto_call_enabled');
        socket.off('bingo:auto_call_disabled');
        socket.off('bingo:auto_call_forced');
        socket.off('bingo:game_over');
        socket.off('bingo:error');
      };
    }
  }, [socket, user, code, navigate, loadRoomAndCards, loadUserExperience, highlightCalledNumber]);

  const loadRoomAndCards = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/bingo/v2/rooms/${code}`);
      const data = await response.json();
      
      console.log('🎰 Room data received:', data);
      
      if (data.success) {
        setRoom(data.room);
        setDrawnNumbers(data.room.drawn_numbers || []);
        
        // Get my cards
        const myPlayer = data.room.players?.find(p => p.user_id === user?.id);
        console.log('🎟️ My player data:', myPlayer);
        console.log('🎟️ My cards:', myPlayer?.cards);
        
        if (myPlayer) {
          const cards = myPlayer.cards || [];
          
          // Parsear grid si llega como string
          const parsedCards = cards.map(card => {
            let parsedGrid = card.grid;
            
            if (typeof card.grid === 'string') {
              try {
                parsedGrid = JSON.parse(card.grid);
              } catch (e) {
                console.error(`Error parsing grid for card ${card.id}:`, e);
                parsedGrid = null;
              }
            }
            
            return {
              ...card,
              grid: parsedGrid
            };
          });
          
          setMyCards(parsedCards);
        }
      }
    } catch (err) {
      console.error('Error loading room:', err);
    } finally {
      setLoading(false);
    }
  }, [code, user?.id]);

  const loadUserExperience = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/bingo/v2/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      // Stats loaded successfully (reserved for future use)
      if (data.success) {
        // Future: Podemos agregar estadísticas aquí
      }
    } catch (err) {
      console.error('Error loading user stats:', err);
    }
  }, []);

  const highlightCalledNumber = useCallback((number) => {
    // This will be handled in the card component
    setMyCards(prevCards => 
      prevCards.map(card => ({
        ...card,
        highlightedNumber: number
      }))
    );
  }, []);

  const handleCallNumber = () => {
    if (socket && room && room.host_id === user.id && !isCallingNumber) {
      setIsCallingNumber(true);
      socket.emit('bingo:call_number', {
        roomCode: code,
        userId: user.id,
        isAuto: false
      });
      
      // Re-habilitar después de 2 segundos
      setTimeout(() => {
        setIsCallingNumber(false);
      }, 2000);
    }
  };

  const toggleAutoCall = () => {
    if (socket && room && room.host_id === user.id) {
      socket.emit('bingo:toggle_auto_call', {
        roomCode: code,
        userId: user.id,
        enabled: !autoCallEnabled
      });
    }
  };

  const handleMarkNumber = (cardId, position) => {
    // CRITICAL VALIDATION: Check all required data
    if (!user || !user.id) {
      console.error('❌ User not authenticated:', user);
      alert('Error: Usuario no autenticado. Por favor recarga la página.');
      return;
    }
    
    if (!position || typeof position.row !== 'number' || typeof position.col !== 'number') {
      console.error('❌ Invalid position:', position);
      alert('Error: Posición inválida.');
      return;
    }
    
    // CRITICAL DEBUG: Log what we're sending
    console.log('📤 Sending mark_number:', {
      cardId,
      position,
      positionType: typeof position,
      hasRow: position?.row !== undefined,
      hasCol: position?.col !== undefined,
      roomCode: code,
      userId: user.id
    });
    
    if (socket) {
      // Emit to backend and wait for confirmation
      socket.emit('bingo:mark_number', {
        roomCode: code,
        userId: user.id,
        cardId,
        position
      }, (response) => {
        // Only update local state if backend confirms
        if (response && response.marked) {
          setMyCards(prevCards => {
            const updatedCards = prevCards.map(card => {
              if (card.id === cardId) {
                // Check if position already exists
                const posExists = card.marked_positions?.some(
                  p => p.row === position.row && p.col === position.col
                );
                
                if (posExists) return card;
                
                const newMarkedPositions = [...(card.marked_positions || []), position];
                const updatedCard = {
                  ...card,
                  marked_positions: newMarkedPositions
                };
                
                return updatedCard;
              }
              return card;
            });
            
            // CRITICAL FIX: Check ALL cards, not just the one updated
            const anyCardComplete = updatedCards.some(card => 
              checkPatternComplete(card, room?.pattern_type)
            );
            
            console.log('🎯 Pattern check after mark:', {
              cardId,
              position,
              pattern: room?.pattern_type,
              anyCardComplete,
              markedPositions: updatedCards.find(c => c.id === cardId)?.marked_positions
            });
            
            setCanCallBingo(anyCardComplete);
            
            return updatedCards;
          });
        } else if (response && response.error) {
          console.error('Error marcando número:', response.error);
        }
      });
    }
  };

  const checkPatternComplete = (card, pattern) => {
    if (!card.grid || !card.marked_positions) {
      console.warn('❌ No grid or marked_positions');
      return false;
    }
    
    const marked = new Set(card.marked_positions.map(p => `${p.row},${p.col}`));
    const mode = room?.mode || '75';
    
    // CRITICAL FIX: Auto-mark FREE space for 75-ball mode
    if (mode === '75') {
      marked.add('2,2');  // Always consider FREE as marked
    }
    
    console.log('🔍 checkPatternComplete:', {
      cardId: card.id,
      pattern,
      mode,
      markedCount: marked.size,
      markedPositions: Array.from(marked),
      hasFree: marked.has('2,2')
    });
    
    if (mode === '75') {
      switch (pattern) {
        case 'line':
          // Verificar filas completas (horizontal)
          for (let row = 0; row < 5; row++) {
            let complete = true;
            for (let col = 0; col < 5; col++) {
              if (!(row === 2 && col === 2) && !marked.has(`${row},${col}`)) {
                complete = false;
                break;
              }
            }
            if (complete) {
              console.log(`✅ HORIZONTAL line complete at row ${row}`);
              return true;
            }
          }
          
          // Verificar columnas completas (vertical)
          for (let col = 0; col < 5; col++) {
            let complete = true;
            for (let row = 0; row < 5; row++) {
              if (!(row === 2 && col === 2) && !marked.has(`${row},${col}`)) {
                complete = false;
                break;
              }
            }
            if (complete) {
              console.log(`✅ VERTICAL line complete at col ${col}`);
              return true;
            }
          }
          
          // Verificar diagonal principal (top-left to bottom-right)
          let diag1Complete = true;
          let diag1Debug = [];
          for (let i = 0; i < 5; i++) {
            const pos = `${i},${i}`;
            const isMarked = marked.has(pos);
            const isFree = i === 2;
            diag1Debug.push({ pos, isMarked, isFree });
            if (i !== 2 && !isMarked) {
              diag1Complete = false;
            }
          }
          console.log('🔹 Diagonal 1 (\\\\):', diag1Debug, 'Complete:', diag1Complete);
          if (diag1Complete) {
            console.log('✅ DIAGONAL 1 complete!');
            return true;
          }
          
          // Verificar diagonal secundaria (top-right to bottom-left)
          let diag2Complete = true;
          let diag2Debug = [];
          for (let i = 0; i < 5; i++) {
            const pos = `${i},${4-i}`;
            const isMarked = marked.has(pos);
            const isFree = i === 2;
            diag2Debug.push({ pos, isMarked, isFree });
            if (i !== 2 && !isMarked) {
              diag2Complete = false;
            }
          }
          console.log('🔹 Diagonal 2 (//):', diag2Debug, 'Complete:', diag2Complete);
          if (diag2Complete) {
            console.log('✅ DIAGONAL 2 complete!');
            return true;
          }
          
          console.warn('❌ No line pattern found');
          return false;
          
        case 'corners':
          return marked.has('0,0') && marked.has('0,4') && 
                 marked.has('4,0') && marked.has('4,4');
                 
        case 'fullcard':
          return marked.size >= 24; // 25 - 1 FREE space
          
        default:
          return false;
      }
    } else {
      // 90-ball: verificar línea horizontal completa
      for (let row = 0; row < 3; row++) {
        let count = 0;
        for (let col = 0; col < 9; col++) {
          if (marked.has(`${row},${col}`)) count++;
        }
        if (count >= 5) return true; // 90-ball tiene 5 números por línea
      }
      return false;
    }
  };

  const handleCallBingo = (cardId) => {
    if (socket && canCallBingo) {
      // CRITICAL DEBUG: Log what we're sending
      const cardData = myCards.find(c => c.id === cardId);
      console.log('🎯 CALLING BINGO:', {
        cardId,
        pattern: room?.pattern_type,
        roomCode: code,
        userId: user.id,
        markedPositions: cardData?.marked_positions,
        markedCount: cardData?.marked_positions?.length
      });
      
      socket.emit('bingo:call_bingo', {
        roomCode: code,
        userId: user.id,
        cardId,
        pattern: room?.pattern_type
      }, (response) => {
        console.log('📩 BINGO RESPONSE:', response);
        if (response.success) {
          console.log('✅ ¡BINGO VALIDADO!');
          // El modal aparecerá automáticamente cuando el backend emita 'bingo:game_over'
        } else {
          console.warn('❌ Bingo inválido:', response.message);
          alert('El patrón aún no está completo. Continúa marcando números.');
        }
      });
    } else {
      console.warn('⚠️ Cannot call BINGO:', { socket: !!socket, canCallBingo });
    }
  };

  // Timer countdown for winner modal
  useEffect(() => {
    if (!showWinnerModal || isRedirecting) return;
    
    const interval = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsRedirecting(true);
          if (socket) {
            socket.emit('bingo:leave_room', {
              roomCode: code,
              userId: user.id
            });
          }
          navigate('/bingo');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [showWinnerModal, isRedirecting, navigate, socket, code, user]);

  // Handler: Back to Lobby
  const handleBackToLobby = () => {
    setIsRedirecting(true);
    if (socket) {
      socket.emit('bingo:leave_room', {
        roomCode: code,
        userId: user.id
      });
    }
    navigate('/bingo');
  };

  // Handler: Another Round (Otra Ronda)
  const handleAnotherRound = () => {
    setIsRedirecting(true);
    
    if (socket) {
      socket.emit('bingo:request_new_round', {
        roomCode: code,
        userId: user.id
      });
    }
    
    // Navigate immediately to waiting room
    navigate(`/bingo/v2/room/${code}`);
  };

  const handleExitRoom = () => {
    if (socket) {
      socket.emit('bingo:leave_room', {
        roomCode: code,
        userId: user.id
      });
    }
    navigate('/bingo');
  };

  if (loading) return <div className="loading">Cargando juego...</div>;
  if (!room) return <div className="error">Sala no encontrada</div>;

  const isHost = room.host_id === user?.id;
  const isWinnerUser = winner?.userId === user?.id;
  const winnerPrize = prizes?.winnerPrize ?? 0;
  const hostPrize = prizes?.hostPrize ?? 0;
  const myPrizeAmount = (isWinnerUser ? winnerPrize : 0) + (isHost ? hostPrize : 0);
  const currencyEmoji = room.currency_type === 'coins' ? '🪙' : '🔥';

  return (
    <div className="bingo-v2-game-room">
      {/* Header */}
      <div className="game-header">
        <div className="room-info">
          <span>Sala: {room.code}</span>
          <span>Modo: {room.mode} números</span>
          <span>Victoria: {room.pattern_type}</span>
        </div>
        
        <div className="last-number">
          {lastCalledNumber && (
            <>
              <span className="label">Último número:</span>
              <span className="number">{lastCalledNumber}</span>
            </>
          )}
        </div>

        <div className="header-buttons">
          {isHost && (
            <button 
              className={`auto-call-btn ${autoCallEnabled ? 'active' : ''}`}
              onClick={toggleAutoCall}
            >
              {autoCallEnabled ? '⏸ Detener Auto' : '▶ Auto-Canto'}
            </button>
          )}
          
          <button className="exit-button" onClick={handleExitRoom}>
            Salir
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="game-content">
        {/* Cards Section */}
        <div className="cards-section">
          <h2>Mis Cartones</h2>
          <div className="cards-container">
            {myCards.map((card, idx) => (
              <BingoV2Card
                key={card.id}
                card={card}
                cardNumber={idx + 1}
                drawnNumbers={drawnNumbers}
                mode={room.mode}
                onMarkNumber={(position) => handleMarkNumber(card.id, position)}
                onCallBingo={() => handleCallBingo(card.id)}
                canCallBingo={canCallBingo}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Floating Buttons */}
      {isHost && (
        <button 
          className="floating-call-btn"
          onClick={handleCallNumber}
          disabled={autoCallEnabled || isCallingNumber}
          title="Cantar Número"
        >
          {isCallingNumber ? '⏳' : '🎲'}
        </button>
      )}
      
      <button 
        className="floating-board-btn"
        onClick={() => setShowNumbersBoard(!showNumbersBoard)}
        title="Ver Números Cantados"
      >
        📋
      </button>

      {/* Numbers Board Modal */}
      {showNumbersBoard && (
        <div className="modal-overlay" onClick={() => setShowNumbersBoard(false)}>
          <div className="numbers-board" onClick={e => e.stopPropagation()}>
            <div className="board-header">
              <h3>Números Cantados</h3>
              <button className="close-btn" onClick={() => setShowNumbersBoard(false)}>×</button>
            </div>
            <div className="numbers-grid">
              {Array.from({ length: room.mode === '75' ? 75 : 90 }, (_, i) => i + 1).map(num => (
                <div 
                  key={num}
                  className={`number-cell ${drawnNumbers.includes(num) ? 'called' : ''}`}
                >
                  {num}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Winner Modal */}
      {showWinnerModal && winner && (
        <div className="winner-modal-overlay">
          <div className="winner-modal">
            <div className="celebration-animation">🎉</div>
            <h1>¡BINGO!</h1>
            <h2>Ganador: {winner.username}</h2>
            <p>Patrón completado: {winner.pattern}</p>
            
            <div className="prize-info">
              {isWinnerUser || isHost ? (
                <>
                  <h3>Tu premio</h3>
                  <p>
                    Has recibido
                    {" "}
                    <strong>
                      {myPrizeAmount.toFixed(2)} {currencyEmoji} {room.currency_type}
                    </strong>
                    {isWinnerUser && isHost && ' (ganador + host)'}
                    {isWinnerUser && !isHost && ' como ganador'}
                    {!isWinnerUser && isHost && ' como host'}
                    .
                  </p>
                </>
              ) : (
                <>
                  <h3>Juego finalizado</h3>
                  <p>
                    Esta vez el premio fue para <strong>{winner.username}</strong>.
                    Tu participación suma experiencia para las próximas rondas 💪
                  </p>
                </>
              )}
            </div>
            
            {/* Timer Countdown */}
            <div className="timer-container">
              <div className="timer-text">
                {remainingTime > 0 ? (
                  <>
                    <Clock size={20} />
                    <span>Redirigiendo al lobby en {remainingTime}s</span>
                  </>
                ) : (
                  <span>Redirigiendo...</span>
                )}
              </div>
              <div className="timer-progress-bar">
                <div 
                  className="timer-progress-fill"
                  style={{ width: `${(remainingTime / 30) * 100}%` }}
                />
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="modal-actions">
              <button 
                onClick={handleBackToLobby}
                className="btn-secondary-modal"
                disabled={isRedirecting}
              >
                <LogOut size={18} />
                Volver al Lobby
              </button>
              
              <button 
                onClick={handleAnotherRound}
                className="btn-primary-modal"
                disabled={isRedirecting}
              >
                <Repeat size={18} />
                Otra Ronda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BingoV2GameRoom;
