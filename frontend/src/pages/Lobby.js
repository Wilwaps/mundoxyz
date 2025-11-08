import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, Globe, X, Gamepad2, Grid3x3, Search, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

// Import modales existentes
import BingoCreateRoomModal from '../components/bingo/CreateRoomModal';

const Lobby = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showSelectorModal, setShowSelectorModal] = useState(false);
  const [showBingoModal, setShowBingoModal] = useState(false);
  const [quickJoinCode, setQuickJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Obtener salas activas del usuario
  const { data: myRooms, isLoading: loadingRooms } = useQuery({
    queryKey: ['my-active-rooms'],
    queryFn: async () => {
      const res = await fetch('/api/rooms/active', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) throw new Error('Error al obtener salas');
      const data = await res.json();
      return data.rooms || [];
    },
    enabled: !!user,
    refetchInterval: 10000 // Refrescar cada 10s
  });

  const handleOpenSelectorModal = () => {
    setShowSelectorModal(true);
  };

  const handleSelectGameType = (type) => {
    setShowSelectorModal(false);
    switch (type) {
      case 'tictactoe':
        // Redirigir al lobby de TicTacToe (tiene su propio modal inline)
        navigate('/tictactoe');
        break;
      case 'bingo':
        setShowBingoModal(true);
        break;
    }
  };

  const handleQuickJoin = async () => {
    if (!quickJoinCode || quickJoinCode.length !== 6) {
      toast.error('Ingresa un código válido de 6 dígitos');
      return;
    }

    if (!user) {
      toast.error('Debes iniciar sesión para unirte a una sala');
      return;
    }

    setIsJoining(true);

    try {
      const res = await fetch(`/api/rooms/find/${quickJoinCode}`);
      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'ROOM_NOT_FOUND') {
          toast.error('Sala no encontrada. Verifica el código');
        } else if (data.code === 'ROOM_FINISHED') {
          toast.error('Esta sala ya finalizó');
        } else if (data.code === 'ROOM_CANCELLED') {
          toast.error('Esta sala fue cancelada');
        } else {
          toast.error(data.error || 'Error al buscar sala');
        }
        return;
      }

      toast.success('¡Sala encontrada! Redirigiendo...');
      navigate(data.redirect_url);
    } catch (error) {
      console.error('Error en Quick Join:', error);
      toast.error('Error al buscar sala');
    } finally {
      setIsJoining(false);
    }
  };

  const handleRoomClick = (room) => {
    let url = '';
    switch (room.game_type) {
      case 'tictactoe':
        url = `/tictactoe/room/${room.code}`;
        break;
      case 'bingo':
        url = `/bingo/v2/room/${room.code}`;
        break;
    }
    if (url) navigate(url);
  };

  const getGameIcon = (gameType) => {
    switch (gameType) {
      case 'tictactoe':
        return <Grid3x3 size={16} className="text-purple-400" />;
      case 'bingo':
        return <Gamepad2 size={16} className="text-blue-400" />;
      default:
        return <Globe size={16} />;
    }
  };

  const getGameLabel = (gameType) => {
    switch (gameType) {
      case 'tictactoe':
        return 'TicTacToe';
      case 'bingo':
        return 'Bingo';
      default:
        return 'Sala';
    }
  };

  const getStatusBadge = (room) => {
    if (room.status === 'waiting') {
      return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full">Esperando</span>;
    }
    if (room.status === 'playing' || room.status === 'in_progress' || room.status === 'active') {
      return <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">En juego</span>;
    }
    if (room.status === 'pending') {
      return <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">Pendiente</span>;
    }
    return null;
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-8 text-gradient-accent">Lobby</h1>
      
      {/* Create Room Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleOpenSelectorModal}
        className="w-full btn-primary flex items-center justify-center gap-2 mb-6"
      >
        <Plus size={20} />
        Crear Sala
      </motion.button>

      {/* Quick Join */}
      <div className="card-glass mb-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Search size={20} className="text-accent" />
          Unirse Rápido
        </h2>
        <p className="text-sm text-text/60 mb-3">
          Ingresa el código de 6 dígitos de cualquier sala para unirte directamente
        </p>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="000000"
            value={quickJoinCode}
            onChange={(e) => setQuickJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="input-glass w-full text-center text-xl tracking-wider font-mono"
            maxLength={6}
            disabled={isJoining}
            onKeyPress={(e) => e.key === 'Enter' && handleQuickJoin()}
          />
          <button
            onClick={handleQuickJoin}
            disabled={isJoining || quickJoinCode.length !== 6}
            className="btn-accent w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isJoining ? (
              <>
                <Loader size={18} className="animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Search size={18} />
                Buscar
              </>
            )}
          </button>
        </div>
      </div>

      {/* My Active Rooms */}
      {user && (
        <div className="card-glass">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Users size={20} className="text-accent" />
            Mis Salas Activas
          </h2>
          
          {loadingRooms ? (
            <div className="text-center py-8">
              <Loader size={32} className="mx-auto animate-spin text-accent mb-2" />
              <p className="text-text/60">Cargando salas...</p>
            </div>
          ) : myRooms && myRooms.length > 0 ? (
            <div className="space-y-3">
              {myRooms.map((room) => (
                <motion.div
                  key={`${room.game_type}-${room.code}`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleRoomClick(room)}
                  className="bg-glass-light p-4 rounded-lg cursor-pointer hover:bg-glass-hover transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getGameIcon(room.game_type)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{getGameLabel(room.game_type)}</span>
                          <span className="text-xs text-text/60">#{room.code}</span>
                        </div>
                        {room.host_username && (
                          <p className="text-sm text-text/60">Host: {room.host_username}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(room)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-text/40">
              <Users size={48} className="mx-auto mb-2 opacity-50" />
              <p>No tienes salas activas</p>
              <p className="text-sm mt-2">¡Crea una sala o únete a una existente!</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Selector de Tipo de Sala */}
      <AnimatePresence>
        {showSelectorModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowSelectorModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card-glass max-w-md w-full relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowSelectorModal(false)}
                className="absolute top-4 right-4 text-text/60 hover:text-text transition-colors"
              >
                <X size={24} />
              </button>

              <h2 className="text-2xl font-bold mb-6">Selecciona el Tipo de Sala</h2>

              <div className="space-y-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectGameType('tictactoe')}
                  className="w-full bg-gradient-to-r from-purple-600 to-purple-700 p-4 rounded-lg text-left hover:from-purple-500 hover:to-purple-600 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Grid3x3 size={32} />
                    <div>
                      <h3 className="font-bold text-lg">TicTacToe</h3>
                      <p className="text-sm text-text/80">Juego clásico 1v1</p>
                    </div>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectGameType('bingo')}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 p-4 rounded-lg text-left hover:from-blue-500 hover:to-blue-600 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Gamepad2 size={32} />
                    <div>
                      <h3 className="font-bold text-lg">Bingo</h3>
                      <p className="text-sm text-text/80">Multijugador con cartones</p>
                    </div>
                  </div>
                </motion.button>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modales de Creación */}
      {showBingoModal && (
        <BingoCreateRoomModal
          isOpen={showBingoModal}
          onClose={() => setShowBingoModal(false)}
          onSuccess={(room) => {
            setShowBingoModal(false);
            navigate(`/bingo/v2/room/${room.code}`);
          }}
        />
      )}

    </div>
  );
};

export default Lobby;
