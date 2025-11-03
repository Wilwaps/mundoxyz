import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import BingoV2Card from '../components/bingo/BingoV2Card';
import BingoV2Chat from '../components/bingo/BingoV2Chat';
import API_URL from '../config/api';
import './BingoV2GameRoom.css';

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
  const [autoCallEnabled, setAutoCallEnabled] = useState(false);
  const [userExperience, setUserExperience] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isCallingNumber, setIsCallingNumber] = useState(false);

  useEffect(() => {
    loadRoomAndCards();
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
        setWinner(data.winner);
        setShowWinnerModal(true);
      });

      socket.on('bingo:error', (data) => {
        console.warn('Bingo Error:', data.message);
        // Mostrar mensaje más amigable según el error
        if (data.message.includes('espera un momento')) {
          // Ignorar errores de rate limiting si ya tenemos throttling en cliente
          return;
        } else if (data.message.includes('All numbers')) {
          alert('¡Todos los números han sido cantados!');
        } else {
          alert(data.message);
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
  }, [socket, user, code]);

  const loadRoomAndCards = async () => {
    try {
      const response = await fetch(`${API_URL}/api/bingo/v2/rooms/${code}`);
      const data = await response.json();
      
      if (data.success) {
        setRoom(data.room);
        setDrawnNumbers(data.room.drawn_numbers || []);
        
        // Get my cards
        const myPlayer = data.room.players?.find(p => p.user_id === user?.id);
        if (myPlayer) {
          setMyCards(myPlayer.cards || []);
        }
      }
    } catch (err) {
      console.error('Error loading room:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUserExperience = async () => {
    try {
      const response = await fetch(`${API_URL}/api/bingo/v2/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setUserExperience(data.stats.experience || 0);
      }
    } catch (err) {
      console.error('Error loading user stats:', err);
    }
  };

  const highlightCalledNumber = (number) => {
    // This will be handled in the card component
    setMyCards(prevCards => 
      prevCards.map(card => ({
        ...card,
        highlightedNumber: number
      }))
    );
  };

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
      if (!autoCallEnabled && userExperience < 400) {
        alert(`Aún te falta ${400 - userExperience} experiencia para activar este modo`);
        return;
      }

      socket.emit('bingo:toggle_auto_call', {
        roomCode: code,
        userId: user.id,
        enable: !autoCallEnabled
      });
    }
  };

  const handleMarkNumber = (cardId, position) => {
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
    
    console.log('🔍 checkPatternComplete:', {
      cardId: card.id,
      pattern,
      mode,
      markedCount: marked.size,
      markedPositions: Array.from(marked)
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
      socket.emit('bingo:call_bingo', {
        roomCode: code,
        userId: user.id,
        cardId,
        pattern: room?.pattern_type
      }, (response) => {
        if (response.success) {
          console.log('¡BINGO VALIDADO!');
        } else {
          console.warn('Bingo inválido:', response.message);
          alert('El patrón aún no está completo. Continúa marcando números.');
          setCanCallBingo(false);
        }
      });
    }
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

        <button className="exit-button" onClick={handleExitRoom}>
          Salir
        </button>
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

        {/* Controls Section */}
        {isHost && (
          <div className="host-controls">
            <h3>Controles del Host</h3>
            <button 
              className="call-number-btn"
              onClick={handleCallNumber}
              disabled={autoCallEnabled || isCallingNumber}
            >
              {isCallingNumber ? 'Esperando...' : 'Cantar Número'}
            </button>
            
            <button 
              className={`auto-call-btn ${autoCallEnabled ? 'active' : ''}`}
              onClick={toggleAutoCall}
            >
              {autoCallEnabled ? 'Detener Auto-Canto' : 'Activar Auto-Canto'}
            </button>
            
            {userExperience < 400 && (
              <p className="exp-warning">
                Necesitas {400 - userExperience} exp más para auto-canto
              </p>
            )}
          </div>
        )}

        {/* Chat Section */}
        <BingoV2Chat roomCode={code} userId={user?.id} />
      </div>

      {/* Floating Numbers Board Button */}
      <button 
        className="floating-board-btn"
        onClick={() => setShowNumbersBoard(!showNumbersBoard)}
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
            <div className="celebration-animation">🎉🎊🎉</div>
            <h1>¡BINGO!</h1>
            <h2>Ganador: {winner.username}</h2>
            <p>Patrón completado: {winner.pattern}</p>
            
            <div className="prize-info">
              <h3>Premios Distribuidos</h3>
              <p>Pozo total: {room.total_pot} {room.currency_type}</p>
            </div>
            
            <button onClick={() => navigate('/bingo')}>
              Volver al Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BingoV2GameRoom;
