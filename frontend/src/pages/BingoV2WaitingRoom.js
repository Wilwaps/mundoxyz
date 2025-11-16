import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Plus, Minus, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import API_URL from '../config/api';
import './BingoV2WaitingRoom.css';

const BingoV2WaitingRoom = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { socket } = useSocket();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [showBuyCardsModal, setShowBuyCardsModal] = useState(false);
  const [cardsToBuy, setCardsToBuy] = useState(1);
  const [canCloseRoom, setCanCloseRoom] = useState(false);
  const [closingRoom, setClosingRoom] = useState(false);
  const [currentCards, setCurrentCards] = useState(0);
  const [pendingCards, setPendingCards] = useState(1);
  const [showHelpModal, setShowHelpModal] = useState(false);

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

      socket.on('bingo:player_cards_updated', (data) => {
        // Si el usuario que cambió cartones es el actual, resetear estado de listo
        if (data.userId === user.id) {
          setIsReady(false);
          toast.info('Debes marcar "Listo" nuevamente después de cambiar cartones', {
            icon: '⚠️',
            duration: 4000
          });
        }
        loadRoomDetails(); // Actualizar vista de todos los jugadores
      });

      socket.on('bingo:game_started', () => {
        navigate(`/bingo/v2/play/${code}`);
      });

      socket.on('bingo:new_round_ready', (data) => {
        console.log('🔄 Nueva ronda lista:', data);
        
        // Actualizar room con nueva configuración
        setRoom(data.room);
        
        // Reset estados locales
        setIsReady(false);
        
        // Si el usuario tiene cartones de la ronda anterior, mantener cantidad
        const myPlayer = data.room.players?.find(p => p.user_id === user.id);
        const myCards = myPlayer?.cards_purchased || 0;
        setCurrentCards(myCards);
        setPendingCards(myCards > 0 ? myCards : 1);
        
        // Mostrar notificación
        toast.success(`Nueva ronda iniciada. Host: ${data.room.host_name}`, {
          icon: '🔄',
          duration: 5000
        });
      });

      socket.on('bingo:error', (data) => {
        setError(data.message);
      });

      return () => {
        socket.off('bingo:room_state');
        socket.off('bingo:player_joined');
        socket.off('bingo:player_left');
        socket.off('bingo:player_ready');
        socket.off('bingo:player_cards_updated');
        socket.off('bingo:game_started');
        socket.off('bingo:new_round_ready');
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
        
        // Check if current user is ready and has cards
        const currentPlayer = data.room.players?.find(p => p.user_id === user?.id);
        if (currentPlayer) {
          setIsReady(currentPlayer.is_ready);
          const myCards = currentPlayer.cards_purchased || 0;
          setCurrentCards(myCards);
          if (myCards === 0) {
            setPendingCards(1); // Default para compra inicial
          } else {
            setPendingCards(myCards); // Mantener cantidad actual
          }
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

  // Handler: Modificar cantidad de cartones con botones +/-
  const handleCardChange = (delta) => {
    // Si el jugador ya estaba listo y cambia cantidad, desactivar listo
    if (isReady && currentCards > 0) {
      setIsReady(false);
      toast.info('⚠️ Debes confirmar nuevamente después de cambiar cartones', {
        duration: 3000
      });
    }
    
    setPendingCards(prev => {
      const newValue = prev + delta;
      return Math.max(1, Math.min(room.max_cards_per_player, newValue));
    });
  };

  // Handler: Modificar cantidad directamente en input
  const handleCardChangeInput = (value) => {
    // Si el jugador ya estaba listo y cambia cantidad, desactivar listo
    if (isReady && currentCards > 0) {
      setIsReady(false);
      toast.info('⚠️ Debes confirmar nuevamente después de cambiar cartones', {
        duration: 3000
      });
    }
    
    const numValue = parseInt(value) || 1;
    setPendingCards(Math.max(1, Math.min(room.max_cards_per_player, numValue)));
  };

  // Handler: Actualizar cartones (comprar o ajustar)
  const handleUpdateCards = async () => {
    try {
      const isHost = room?.host_id === user?.id;
      
      const response = await fetch(`${API_URL}/api/bingo/v2/rooms/${code}/update-cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          cards_count: pendingCards,
          auto_ready: !isHost // Solo marcar listo automáticamente si NO es host
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setCurrentCards(pendingCards);
        
        // ✅ CRITICAL: Actualizar balance del usuario si viene en la respuesta
        if (data.updatedBalance) {
          updateUser({
            ...user,
            coins_balance: data.updatedBalance.coins,
            fires_balance: data.updatedBalance.fires
          });
        }
        
        // Si no es host, marcar como listo automáticamente
        if (!isHost) {
          setIsReady(true);
          if (socket) {
            socket.emit('bingo:player_ready', {
              roomCode: code,
              userId: user.id
            });
          }
          toast.success(`✅ ${pendingCards} cartones comprados y marcado como listo`, {
            icon: '🎟️',
            duration: 3000
          });
        } else {
          toast.success(`✅ ${pendingCards} cartones comprados`, {
            icon: '🎟️',
            duration: 3000
          });
        }
        
        loadRoomDetails(); // Refresh room data
      } else {
        toast.error(data.error || 'Error actualizando cartones');
      }
    } catch (err) {
      toast.error('Error al actualizar cartones');
      console.error(err);
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
        <div>
          <h1>Sala de Espera</h1>
          <div className="room-info">
            <span>Código: <strong>{room.code}</strong></span>
            <span>Host: <strong>{room.host_name}</strong></span>
          </div>
        </div>
        <div className="room-header-actions">
          <button
            type="button"
            className="help-button"
            onClick={() => setShowHelpModal(true)}
          >
            <Info size={16} />
            <span>Cómo funciona esta sala</span>
          </button>
          <button className="leave-button" onClick={handleLeaveRoom}>Salir</button>
        </div>
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

        {/* Modificador de Cartones Inline */}
        <div className="cards-manager">
          <h3>Mis Cartones</h3>
          
          {/* Cartones actuales */}
          {currentCards > 0 && (
            <div className="current-cards-info">
              <span className="badge-fire">
                {currentCards} cartón(es) comprados
              </span>
            </div>
          )}
          
          {/* Modificador para ajustar */}
          <div className="cards-modifier">
            <label>Cantidad de cartones:</label>
            <div className="number-input-group">
              <button 
                onClick={() => handleCardChange(-1)}
                disabled={pendingCards <= 1}
                className="btn-modifier"
              >
                <Minus size={16} />
              </button>
              
              <input 
                type="number"
                min="1"
                max={room.max_cards_per_player}
                value={pendingCards}
                onChange={(e) => handleCardChangeInput(e.target.value)}
                className="cards-input"
              />
              
              <button 
                onClick={() => handleCardChange(1)}
                disabled={pendingCards >= room.max_cards_per_player}
                className="btn-modifier"
              >
                <Plus size={16} />
              </button>
            </div>
            
            <div className="cost-info">
              <span>Costo total:</span>
              <span className="cost-value">
                {pendingCards * room.card_cost} {room.currency_type}
              </span>
            </div>
            
            {/* Botón para aplicar cambios */}
            {pendingCards !== currentCards && (
              <button 
                onClick={handleUpdateCards}
                className="btn-update-cards"
              >
                {currentCards > 0 ? 'Actualizar Cartones' : 'Comprar Cartones'}
              </button>
            )}
          </div>
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

      {/* Modal de ayuda: cómo funciona esta sala de Bingo */}
      {showHelpModal && (
        <div className="modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div className="help-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <div className="help-modal-header-left">
                <div className="help-modal-icon">
                  <Info size={18} />
                </div>
                <div>
                  <h2>Cómo funciona esta sala de Bingo</h2>
                  <p>Guía rápida para crear la sala, comprar cartones y empezar la partida.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="help-modal-close"
              >
                Cerrar
              </button>
            </div>

            <div className="help-modal-body">
              <section>
                <h3>1. Crear una sala de Bingo</h3>
                <p>
                  Desde el lobby de Bingo eliges <strong>crear sala</strong> y defines la configuración:
                </p>
                <ul>
                  <li><strong>Modo:</strong> cantidad de números del cartón (75 / 90, etc.).</li>
                  <li><strong>Victoria:</strong> patrón que gana (línea, cartón lleno, figura especial).</li>
                  <li><strong>Precio por cartón:</strong> cuántas monedas/fuegos cuesta cada cartón.</li>
                  <li><strong>Máx. jugadores y cartones:</strong> límites por sala y por jugador.</li>
                </ul>
              </section>

              <section>
                <h3>2. Qué ves en esta sala de espera</h3>
                <ul>
                  <li><strong>Configuración:</strong> resumen de modo, patrón, precio y límites.</li>
                  <li><strong>Pozo acumulado:</strong> crece con cada cartón vendido.</li>
                  <li><strong>Jugadores:</strong> lista de quién está dentro, sus cartones y si están listos.</li>
                </ul>
              </section>

              <section>
                <h3>3. Comprar y ajustar cartones</h3>
                <ul>
                  <li>Usa los botones <strong>+</strong> y <strong>-</strong> para elegir cuántos cartones quieres.</li>
                  <li>El sistema muestra el <strong>costo total</strong> antes de confirmar.</li>
                  <li>Al aplicar cambios se descuenta de tu wallet y se actualiza el pozo.</li>
                </ul>
              </section>

              <section>
                <h3>4. Listo para jugar</h3>
                <ul>
                  <li>Cuando tengas tus cartones, pulsa <strong>"Marcar como Listo"</strong>.</li>
                  <li>El host ve quién está listo y puede iniciar la partida cuando haya jugadores suficientes.</li>
                  <li>Si cambias la cantidad de cartones, deberás marcarte listo de nuevo.</li>
                </ul>
              </section>

              <section>
                <h3>5. Cerrar sala (host)</h3>
                <ul>
                  <li>El host puede cerrar la sala cuando los jugadores se retiran o no se completa.</li>
                  <li>Al cerrar, el sistema <strong>reembolsa</strong> automáticamente a los participantes.</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}

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
