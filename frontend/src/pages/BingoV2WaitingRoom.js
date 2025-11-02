import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import API_URL from '../config/api';
import './BingoV2WaitingRoom.css';

const BingoV2WaitingRoom = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [showBuyCardsModal, setShowBuyCardsModal] = useState(false);
  const [cardsToBuy, setCardsToBuy] = useState(1);
  const [canCloseRoom, setCanCloseRoom] = useState(false);
  const [closingRoom, setClosingRoom] = useState(false);

  useEffect(() => {
    loadRoomDetails();
    
    if (socket && user) {
      socket.emit('bingo:join_room', {
        roomCode: code,
        userId: user.id
      });

      socket.on('bingo:room_state', (roomData) => {
        setRoom(roomData);
      });

      socket.on('bingo:player_joined', (data) => {
        loadRoomDetails();
      });

      socket.on('bingo:player_left', (data) => {
        loadRoomDetails();
        checkCanCloseRoom();
      });

      socket.on('bingo:player_ready', (data) => {
        loadRoomDetails();
      });

      socket.on('bingo:game_started', () => {
        navigate(`/bingo/v2/play/${code}`);
      });

      socket.on('bingo:error', (data) => {
        setError(data.message);
      });

      return () => {
        socket.off('bingo:room_state');
        socket.off('bingo:player_joined');
        socket.off('bingo:player_left');
        socket.off('bingo:player_ready');
        socket.off('bingo:game_started');
        socket.off('bingo:error');
      };
    }
  }, [socket, user, code, navigate]);

  useEffect(() => {
    if (room && user && room.host_id === user.id) {
      checkCanCloseRoom();
    }
  }, [room, user, code]);

  const loadRoomDetails = async () => {
    try {
      const response = await fetch(`${API_URL}/api/bingo/v2/rooms/${code}`);
      const data = await response.json();
      
      if (data.success) {
        setRoom(data.room);
        
        // Redirect to game if already started
        if (data.room.status === 'in_progress') {
          navigate(`/bingo/v2/play/${code}`);
          return;
        }
        
        // Check if current user is ready
        const currentPlayer = data.room.players?.find(p => p.user_id === user?.id);
        if (currentPlayer) {
          setIsReady(currentPlayer.is_ready);
        }
      } else {
        setError(data.error || 'Error loading room');
      }
    } catch (err) {
      setError('Error loading room details');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyCards = async () => {
    try {
      const response = await fetch(`${API_URL}/api/bingo/v2/rooms/${code}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ cards_count: cardsToBuy })
      });

      const data = await response.json();
      
      if (data.success) {
        setShowBuyCardsModal(false);
        loadRoomDetails();
      } else {
        alert(data.error || 'Error buying cards');
      }
    } catch (err) {
      alert('Error buying cards');
    }
  };

  const handleReady = () => {
    if (socket) {
      socket.emit('bingo:player_ready', {
        roomCode: code,
        userId: user.id
      });
      setIsReady(true);
    }
  };

  const handleStartGame = () => {
    if (socket && room && room.host_id === user.id) {
      socket.emit('bingo:start_game', {
        roomCode: code,
        userId: user.id
      });
    }
  };

  const handleLeaveRoom = () => {
    if (socket) {
      socket.emit('bingo:leave_room', {
        roomCode: code,
        userId: user.id
      });
    }
    navigate('/bingo');
  };

  const checkCanCloseRoom = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/bingo/v2/rooms/${code}/can-close`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCanCloseRoom(data.allowed);
      }
    } catch (err) {
      console.error('Error checking if can close room:', err);
    }
  };

  const handleCloseRoom = async () => {
    if (!window.confirm('¿Estás seguro de que quieres cerrar la sala? Se reembolsará a todos los jugadores.')) {
      return;
    }

    setClosingRoom(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/bingo/v2/rooms/${code}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message || 'Sala cerrada exitosamente');
        navigate('/bingo');
      } else {
        alert(data.error || 'No se pudo cerrar la sala');
        setClosingRoom(false);
      }
    } catch (err) {
      console.error('Error closing room:', err);
      alert('Error al cerrar la sala');
      setClosingRoom(false);
    }
  };

  if (loading) return <div className="loading">Cargando sala...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!room) return <div className="error">Sala no encontrada</div>;

  const currentPlayer = room.players?.find(p => p.user_id === user?.id);
  const isHost = room.host_id === user?.id;
  const hasCards = currentPlayer && currentPlayer.cards_purchased > 0;

  return (
    <div className="bingo-v2-waiting-room">
      <div className="room-header">
        <h1>Sala de Espera</h1>
        <div className="room-info">
          <span>Código: <strong>{room.code}</strong></span>
          <span>Host: <strong>{room.host_name}</strong></span>
        </div>
        <button className="leave-button" onClick={handleLeaveRoom}>Salir</button>
      </div>

      <div className="room-content">
        <div className="config-section">
          <h2>Configuración</h2>
          <div className="config-details">
            <p>Modo: <strong>{room.mode} números</strong></p>
            <p>Victoria: <strong>{room.pattern_type}</strong></p>
            <p>Precio: <strong>{room.card_cost} {room.currency_type}</strong></p>
            <p>Max jugadores: <strong>{room.max_players}</strong></p>
            <p>Max cartones: <strong>{room.max_cards_per_player}</strong></p>
          </div>
        </div>

        <div className="pot-section">
          <h2>Pozo Acumulado</h2>
          <div className="pot-amount">{room.total_pot || 0} {room.currency_type}</div>
          <p className="pot-distribution">
            Distribución: 70% ganador, 20% host, 10% plataforma
          </p>
        </div>

        <div className="players-section">
          <h2>Jugadores ({room.players?.length || 0}/{room.max_players})</h2>
          <div className="players-list">
            {room.players?.map(player => (
              <div key={player.user_id} className={`player-item ${player.is_ready ? 'ready' : ''}`}>
                <span className="player-name">
                  {player.username}
                  {player.user_id === user?.id && ' (Tú)'}
                  {player.user_id === room.host_id && ' 👑'}
                </span>
                <span className="player-cards">
                  {player.cards_purchased} cartones
                </span>
                <span className={`player-status ${player.is_ready ? 'ready' : 'waiting'}`}>
                  {player.is_ready ? 'Listo' : 'Esperando'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="status-section">
          <h2>Estado</h2>
          {!hasCards ? (
            <div className="no-cards">
              <p>No has comprado cartones aún</p>
              <button 
                className="buy-cards-button"
                onClick={() => setShowBuyCardsModal(true)}
              >
                Comprar Cartones
              </button>
            </div>
          ) : (
            <div className="cards-info">
              <h3>Mis Cartones ({currentPlayer?.cards_purchased || 0})</h3>
              {currentPlayer?.cards?.map((card, idx) => (
                <div key={card.id} className="card-preview">
                  Cartón #{idx + 1}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="actions-section">
          <h2>Acciones</h2>
          {isHost ? (
            <div className="host-actions">
              <button 
                className="start-button"
                onClick={handleStartGame}
                disabled={!room.players || room.players.length < 1}
              >
                Iniciar Partida
              </button>
              {canCloseRoom && (
                <button 
                  className="close-room-button"
                  onClick={handleCloseRoom}
                  disabled={closingRoom}
                  style={{ marginTop: '10px', backgroundColor: '#dc3545' }}
                >
                  {closingRoom ? 'Cerrando...' : 'Cerrar Sala y Reembolsar'}
                </button>
              )}
            </div>
          ) : (
            <div className="player-actions">
              {hasCards && !isReady && (
                <button className="ready-button" onClick={handleReady}>
                  Marcar como Listo
                </button>
              )}
              {isReady && (
                <p className="ready-message">¡Estás listo!</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal para comprar cartones */}
      {showBuyCardsModal && (
        <div className="modal-overlay" onClick={() => setShowBuyCardsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Comprar Cartones</h2>
            <p>Precio por cartón: {room.card_cost} {room.currency_type}</p>
            
            <div className="cards-selector">
              <label>Cantidad:</label>
              <input 
                type="number"
                min="1"
                max={room.max_cards_per_player}
                value={cardsToBuy}
                onChange={(e) => setCardsToBuy(parseInt(e.target.value))}
              />
            </div>
            
            <p className="total-cost">
              Total: {cardsToBuy * room.card_cost} {room.currency_type}
            </p>
            
            <div className="modal-actions">
              <button onClick={() => setShowBuyCardsModal(false)}>Cancelar</button>
              <button onClick={handleBuyCards} className="primary">Comprar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BingoV2WaitingRoom;
