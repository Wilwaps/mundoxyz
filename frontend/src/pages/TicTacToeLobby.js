import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, Users, Coins, Flame, Lock, Globe, X, AlertCircle, ArrowRight, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import InsufficientFiresModal from '../components/InsufficientFiresModal';

const TicTacToeLobby = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    mode: 'coins',
    bet_amount: 10,
    visibility: 'public',
    opponent_type: 'player',
    ai_difficulty: 'easy'
  });
  const [modeFilter, setModeFilter] = useState('all');
  const [joinCode, setJoinCode] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showInsufficientFiresModal, setShowInsufficientFiresModal] = useState(false);
  const [missingFires, setMissingFires] = useState(0);
  const isAdminOrTote = !!(user && (user.roles?.includes('admin') || user.roles?.includes('tote')));
  
  // Fetch active room (para reconexión)
  const { data: activeRoomData } = useQuery({
    queryKey: ['my-active-room'],
    queryFn: async () => {
      if (!user) return { activeRoom: null };
      try {
        const response = await axios.get('/api/tictactoe/my-active-room');
        return response.data;
      } catch (error) {
        console.error('Error fetching active room:', error);
        return { activeRoom: null };
      }
    },
    enabled: !!user,
    refetchInterval: 10000 // Check every 10 seconds
  });
  
  const activeRoom = activeRoomData?.activeRoom;
  
  // Fetch public rooms
  const { data: rooms, isLoading, refetch } = useQuery({
    queryKey: ['tictactoe-rooms', modeFilter],
    queryFn: async () => {
      const params = modeFilter !== 'all' ? `?mode=${modeFilter}` : '';
      const response = await axios.get(`/api/tictactoe/rooms/public${params}`);
      return response.data.rooms;
    },
    refetchInterval: 5000 // Refetch every 5 seconds
  });
  
  // Admin: fetch all active rooms (waiting, ready, playing)
  const {
    data: adminRooms,
    isLoading: isLoadingAdminRooms,
    refetch: refetchAdminRooms
  } = useQuery({
    queryKey: ['tictactoe-admin-rooms'],
    queryFn: async () => {
      const response = await axios.get('/api/tictactoe/rooms/admin');
      return response.data.rooms;
    },
    enabled: isAdminOrTote,
    refetchInterval: 5000
  });
  
  // Fetch user balance
  const { data: balance, refetch: refetchBalance } = useQuery({
    queryKey: ['user-balance'],
    queryFn: async () => {
      if (!user) return { coins_balance: 0, fires_balance: 0 };
      try {
        const response = await axios.get('/api/economy/balance');
        console.log('Balance fetched:', response.data); // Debug log
        return response.data;
      } catch (error) {
        console.error('Error fetching balance:', error);
        return { coins_balance: 0, fires_balance: 0 };
      }
    },
    enabled: !!user,
    refetchInterval: 5000, // Refetch balance every 5 seconds
    staleTime: 0, // Don't cache, always fresh
    cacheTime: 0 // Don't keep old data in cache
  });
  
  // Create room mutation
  const createRoomMutation = useMutation({
    mutationFn: async (data) => {
      const response = await axios.post('/api/tictactoe/create', data);
      return response.data;
    },
    onSuccess: async (data) => {
      toast.success('Sala creada exitosamente');
      refetchBalance(); // Refrescar balance de la query
      await refreshUser(); // Actualizar balance en el header
      navigate(`/tictactoe/room/${data.room.code}`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al crear sala');
    }
  });
  
  // Join room mutation
  const joinRoomMutation = useMutation({
    mutationFn: async (code) => {
      const response = await axios.post(`/api/tictactoe/join/${code}`);
      return response.data;
    },
    onSuccess: async (data, code) => {
      toast.success('Te has unido a la sala');
      refetchBalance(); // Refrescar balance de la query
      await refreshUser(); // Actualizar balance en el header
      navigate(`/tictactoe/room/${code}`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al unirse a la sala');
    }
  });
  
  // Close room mutation (admin)
  const closeRoomMutation = useMutation({
    mutationFn: async (code) => {
      const response = await axios.delete(`/api/tictactoe/rooms/${code}`);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Sala cerrada exitosamente');
      refetch();
      if (isAdminOrTote) {
        refetchAdminRooms();
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al cerrar sala');
    }
  });
  
  const handleCloseRoom = async (room, e) => {
    e.stopPropagation(); // Prevenir que se abra la sala al hacer clic en X
    
    if (!window.confirm(`¿Cerrar sala ${room.code}? Se reembolsará a los jugadores.`)) {
      return;
    }
    
    closeRoomMutation.mutate(room.code);
  };
  
  const handleCreateRoom = () => {
    if (!user) {
      toast.error('Debes iniciar sesión para crear una sala');
      return;
    }
    
    // Validate bet amount
    if (createForm.mode === 'coins') {
      if (createForm.bet_amount < 1 || createForm.bet_amount > 1000) {
        toast.error('La apuesta debe ser entre 1 y 1000 coins');
        return;
      }
      if (balance?.coins_balance < createForm.bet_amount) {
        toast.error('No tienes suficientes coins');
        return;
      }
    } else if (createForm.mode === 'fires') {
      const firesBalance = parseFloat(balance?.fires_balance || 0);
      const required = 1;
      if (firesBalance < required) {
        const missing = required - firesBalance;
        setMissingFires(missing > 0 ? missing : required);
        setShowInsufficientFiresModal(true);
        return;
      }
    }
    
    // Para RON-IA de momento es modo práctica: ignoramos apuesta y enviamos bet_amount = 0
    let dataToSend;
    if (createForm.opponent_type === 'ron_ai') {
      dataToSend = {
        ...createForm,
        bet_amount: 0
      };
    } else {
      // For fires mode, always set bet_amount to 1
      dataToSend = {
        ...createForm,
        bet_amount: createForm.mode === 'fires' ? 1 : createForm.bet_amount
      };
    }
    
    createRoomMutation.mutate(dataToSend);
  };
  
  const handleJoinRoom = (code) => {
    if (!user) {
      toast.error('Debes iniciar sesión para unirte');
      return;
    }
    joinRoomMutation.mutate(code);
  };
  
  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-center mb-2 text-gradient-accent">
          La Vieja - Lobby
        </h1>
        <p className="text-center text-text/60">
          Duelos rápidos de 3 en raya • 15 seg por turno • Sin comisión
        </p>
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-glass hover:bg-glass-hover text-xs text-text/80 transition-colors"
          >
            <Info size={14} className="text-accent" />
            <span>Cómo crear y usar salas de La Vieja</span>
          </button>
        </div>
      </div>
      
      {/* Active Room Alert */}
      {activeRoom && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-lg bg-violet/20 border border-violet/50"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-violet">¡Tienes una sala activa!</h3>
              <p className="text-sm text-text/80">
                Sala {activeRoom.code} • {activeRoom.mode === 'coins' ? '💰' : '🔥'} {activeRoom.bet_amount} • 
                Estado: {activeRoom.status === 'waiting' ? 'Esperando' : activeRoom.status === 'ready' ? 'Listo' : 'Jugando'}
              </p>
              {activeRoom.opponent && (
                <p className="text-xs text-text/60">vs {activeRoom.opponent}</p>
              )}
            </div>
            <button
              onClick={() => navigate(`/tictactoe/room/${activeRoom.code}`)}
              className="btn-primary flex items-center gap-2"
            >
              Volver a la sala
              <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      )}
      
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center justify-center gap-2"
          disabled={!user}
        >
          <Plus size={20} />
          Crear Sala
        </button>
        
        {/* Input para unirse a sala por código */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Código de sala"
            value={joinCode}
            onChange={(e) => {
              // Solo permitir números
              const value = e.target.value.replace(/[^0-9]/g, '');
              if (value.length <= 6) {
                setJoinCode(value);
              }
            }}
            maxLength="6"
            className="glass-input px-4 py-2 w-32 text-center"
            style={{ letterSpacing: '0.2em' }}
          />
          <button
            onClick={() => {
              if (joinCode.length === 6) {
                handleJoinRoom(joinCode);
                setJoinCode('');
              } else {
                toast.error('El código debe tener 6 dígitos');
              }
            }}
            disabled={!user || joinCode.length !== 6}
            className="btn-secondary px-4"
          >
            Unirse
          </button>
        </div>
        
        {/* Mode Filter */}
        <div className="flex gap-2 flex-1 justify-center sm:justify-start">
          <button
            onClick={() => setModeFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              modeFilter === 'all' 
                ? 'bg-violet text-white' 
                : 'glass-panel text-text/60 hover:bg-white/10'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setModeFilter('coins')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              modeFilter === 'coins' 
                ? 'bg-accent text-dark' 
                : 'glass-panel text-text/60 hover:bg-white/10'
            }`}
          >
            💰 Coins
          </button>
          <button
            onClick={() => setModeFilter('fires')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              modeFilter === 'fires' 
                ? 'bg-fire-orange text-dark' 
                : 'glass-panel text-text/60 hover:bg-white/10'
            }`}
          >
            🔥 Fires
          </button>
        </div>
      </div>
      
      {/* Rooms List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="spinner"></div>
        </div>
      ) : rooms && rooms.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              className="card-glass p-4 cursor-pointer relative"
              onClick={() => handleJoinRoom(room.code)}
            >
              {/* Admin close button */}
              {user && (user.roles?.includes('admin') || user.roles?.includes('tote')) && (
                <button
                  onClick={(e) => handleCloseRoom(room, e)}
                  className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-error/80 hover:bg-error text-white transition-colors z-10"
                  title="Cerrar sala (Admin)"
                  disabled={closeRoomMutation.isPending}
                >
                  <X size={14} />
                </button>
              )}
              
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg text-text">
                    Sala {room.code}
                  </h3>
                  <p className="text-sm text-text/60">
                    Host: {room.host_username}
                  </p>
                </div>
                <div className="text-right">
                  {room.visibility === 'public' ? (
                    <Globe size={16} className="text-success inline" />
                  ) : (
                    <Lock size={16} className="text-text/40 inline" />
                  )}
                </div>
              </div>
              
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-text/60" />
                  <span className="text-sm">1/2 jugadores</span>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  room.status === 'waiting' 
                    ? 'bg-success/20 text-success' 
                    : 'bg-violet/20 text-violet'
                }`}>
                  {room.status === 'waiting' ? 'Esperando' : 'Listo'}
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {room.mode === 'coins' ? (
                    <>
                      <Coins size={16} className="text-accent" />
                      <span className="text-accent font-bold">{room.bet_amount}</span>
                    </>
                  ) : (
                    <>
                      <Flame size={16} className="text-fire-orange" />
                      <span className="text-fire-orange font-bold">1</span>
                    </>
                  )}
                </div>
                <button className="btn-secondary text-sm px-3 py-1">
                  Unirse
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-text/60 mb-4">No hay salas disponibles</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
            disabled={!user}
          >
            Crear Primera Sala
          </button>
        </div>
      )}

      {isAdminOrTote && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-text flex items-center gap-2">
              <Users size={18} className="text-accent" />
              <span>Salas activas (admin/tote)</span>
            </h2>
          </div>

          {isLoadingAdminRooms ? (
            <div className="flex justify-center py-6">
              <div className="spinner"></div>
            </div>
          ) : adminRooms && adminRooms.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {adminRooms.map((room) => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02 }}
                  className="card-glass p-4 cursor-pointer relative"
                  onClick={() => navigate(`/tictactoe/room/${room.code}`)}
                >
                  {user && (user.roles?.includes('admin') || user.roles?.includes('tote')) && (
                    <button
                      onClick={(e) => handleCloseRoom(room, e)}
                      className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-error/80 hover:bg-error text-white transition-colors z-10"
                      title="Cerrar sala (Admin)"
                      disabled={closeRoomMutation.isPending}
                    >
                      <X size={14} />
                    </button>
                  )}

                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg text-text">
                        Sala {room.code}
                      </h3>
                      <p className="text-sm text-text/60">
                        Host: {room.host_username}
                      </p>
                    </div>
                    <div className="text-right text-xs text-text/60">
                      <div
                        className={`px-2 py-1 rounded-full font-medium inline-block ${
                          room.status === 'waiting'
                            ? 'bg-success/20 text-success'
                            : room.status === 'ready'
                              ? 'bg-violet/20 text-violet'
                              : 'bg-accent/20 text-accent'
                        }`}
                      >
                        {room.status === 'waiting'
                          ? 'Esperando'
                          : room.status === 'ready'
                            ? 'Listo'
                            : 'Jugando'}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {room.mode === 'coins' ? (
                        <>
                          <Coins size={16} className="text-accent" />
                          <span className="text-accent font-bold">{room.bet_amount}</span>
                        </>
                      ) : (
                        <>
                          <Flame size={16} className="text-fire-orange" />
                          <span className="text-fire-orange font-bold">{room.bet_amount}</span>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-text/50">
                      {room.visibility === 'public' ? 'Pública' : 'Privada'}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text/60">No hay salas activas en este momento.</p>
          )}
        </div>
      )}
      
      {/* Create Room Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowCreateModal(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="card-glow p-6 max-w-md w-full relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-4 right-4 text-text/60 hover:text-text"
              >
                <X size={20} />
              </button>
              
              <h2 className="text-2xl font-bold mb-4 text-text">
                Crear Sala - La Vieja
              </h2>
              
              {/* Mode Selection (moneda) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-text/80 mb-2">
                  Modo de Juego
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCreateForm({...createForm, mode: 'coins'})}
                    className={`p-3 rounded-lg border transition-all ${
                      createForm.mode === 'coins'
                        ? 'border-accent bg-accent/20 text-accent'
                        : 'border-white/10 hover:border-white/20 text-text/60'
                    }`}
                  >
                    <Coins className="mx-auto mb-1" size={24} />
                    <div className="text-sm">Coins</div>
                  </button>
                  <button
                    onClick={() => setCreateForm({...createForm, mode: 'fires', bet_amount: 1})}
                    className={`p-3 rounded-lg border transition-all ${
                      createForm.mode === 'fires'
                        ? 'border-fire-orange bg-fire-orange/20 text-fire-orange'
                        : 'border-white/10 hover:border-white/20 text-text/60'
                    }`}
                  >
                    <Flame className="mx-auto mb-1" size={24} />
                    <div className="text-sm">Fires</div>
                  </button>
                </div>
              </div>

              {/* Tipo de partida: vs jugador o RON-IA */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-text/80 mb-2">
                  Tipo de Partida
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCreateForm({ ...createForm, opponent_type: 'player' })}
                    className={`p-3 rounded-lg border transition-all ${
                      createForm.opponent_type === 'player'
                        ? 'border-success bg-success/20 text-success'
                        : 'border-white/10 hover:border-white/20 text-text/60'
                    }`}
                  >
                    <Users className="mx-auto mb-1" size={20} />
                    <div className="text-sm">Vs Jugador</div>
                  </button>
                  <button
                    onClick={() => setCreateForm({ ...createForm, opponent_type: 'ron_ai', ai_difficulty: 'easy' })}
                    className={`p-3 rounded-lg border transition-all ${
                      createForm.opponent_type === 'ron_ai'
                        ? 'border-violet bg-violet/20 text-violet'
                        : 'border-white/10 hover:border-white/20 text-text/60'
                    }`}
                  >
                    <span className="mx-auto mb-1 text-lg">🤖</span>
                    <div className="text-sm">Vs RON-IA</div>
                  </button>
                </div>
              </div>

              {/* Dificultad RON-IA */}
              {createForm.opponent_type === 'ron_ai' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text/80 mb-2">
                    Dificultad RON-IA
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['easy', 'medium', 'hard'].map((level) => (
                      <button
                        key={level}
                        onClick={() => setCreateForm({ ...createForm, ai_difficulty: level })}
                        className={`p-2 rounded-lg border text-xs font-semibold transition-all ${
                          createForm.ai_difficulty === level
                            ? 'border-accent bg-accent/20 text-accent'
                            : 'border-white/10 hover:border-white/20 text-text/60'
                        }`}
                      >
                        {level === 'easy' && 'Fácil'}
                        {level === 'medium' && 'Medio'}
                        {level === 'hard' && 'Difícil'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Bet Amount (solo aplica para vs jugador) */}
              {createForm.opponent_type === 'player' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text/80 mb-2">
                    Apuesta
                  </label>
                  {createForm.mode === 'coins' ? (
                    <div>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={createForm.bet_amount}
                        onChange={(e) => setCreateForm({
                          ...createForm,
                          bet_amount: parseInt(e.target.value) || 1
                        })}
                        className="w-full p-3 rounded-lg bg-dark border border-white/10 focus:border-accent text-black"
                        placeholder="1-1000 Coins"
                      />
                      <div className="mt-2 text-xs text-text/60">
                        Balance: {balance?.coins_balance?.toFixed(2) || '0.00'} 💰
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-fire-orange/10 border border-fire-orange/30">
                      <div className="flex items-center justify-between">
                        <span className="text-fire-orange font-bold">1 Fire (Fijo)</span>
                        <Flame size={20} className="text-fire-orange" />
                      </div>
                      <div className="mt-2 text-xs text-text/60">
                        Balance: {balance?.fires_balance?.toFixed(2) || '0.00'} 🔥
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Visibility */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text/80 mb-2">
                  Visibilidad
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCreateForm({...createForm, visibility: 'public'})}
                    className={`p-3 rounded-lg border transition-all ${
                      createForm.visibility === 'public'
                        ? 'border-success bg-success/20 text-success'
                        : 'border-white/10 hover:border-white/20 text-text/60'
                    }`}
                  >
                    <Globe className="mx-auto mb-1" size={20} />
                    <div className="text-sm">Pública</div>
                  </button>
                  <button
                    onClick={() => setCreateForm({...createForm, visibility: 'private'})}
                    className={`p-3 rounded-lg border transition-all ${
                      createForm.visibility === 'private'
                        ? 'border-violet bg-violet/20 text-violet'
                        : 'border-white/10 hover:border-white/20 text-text/60'
                    }`}
                  >
                    <Lock className="mx-auto mb-1" size={20} />
                    <div className="text-sm">Privada</div>
                  </button>
                </div>
              </div>
              
              {/* Info Box */}
              <div className="mb-6 p-3 rounded-lg bg-violet/10 border border-violet/30">
                <div className="flex gap-2">
                  <AlertCircle size={16} className="text-violet mt-0.5" />
                  <div className="text-xs text-text/80">
                    <p>• Sin comisión - 100% al ganador</p>
                    <p>• 15 segundos por turno</p>
                    <p>• Revanchas ilimitadas disponibles</p>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateRoom}
                  disabled={createRoomMutation.isPending}
                  className="flex-1 btn-primary"
                >
                  {createRoomMutation.isPending ? 'Creando...' : 'Crear Sala'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Help Modal - Lobby La Vieja */}
      <AnimatePresence>
        {showHelpModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowHelpModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              className="w-full max-w-2xl card-glass max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                    <Info size={18} className="text-accent" />
                  </div>
                  <div>
                    <h2 className="text-sm md:text-base font-bold text-text">Cómo crear salas de La Vieja</h2>
                    <p className="text-[11px] md:text-xs text-text/60">Guía rápida desde este lobby para crear partidas justas.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="px-2 py-1 rounded-lg bg-glass hover:bg-glass-hover text-xs text-text/70"
                >
                  Cerrar
                </button>
              </div>

              <div className="flex-1 px-4 pb-4 pt-3 overflow-y-auto scrollbar-thin scroll-touch-y text-sm md:text-base text-text/90 space-y-3 leading-snug">
                <section className="space-y-1">
                  <h3 className="font-bold text-text text-base md:text-lg">1. Desde dónde se crean las salas</h3>
                  <p>
                    Usa el botón <span className="font-semibold">"Crear Sala"</span> de arriba. Desde aquí defines cómo será el duelo:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 ml-1">
                    <li>
                      <span className="font-semibold">Modo:</span> elige entre 💰 <span className="font-semibold">Coins</span> o 🔥 <span className="font-semibold">Fires</span>.
                    </li>
                    <li>
                      <span className="font-semibold">Apuesta:</span> si juegas con coins, defines cuántas pondrá cada jugador. En fires la apuesta es fija de 1 fuego.
                    </li>
                    <li>
                      <span className="font-semibold">Visibilidad:</span> pública (aparece en la lista) o privada (solo con código).
                    </li>
                  </ul>
                </section>

                <section className="space-y-1">
                  <h3 className="font-bold text-text text-base md:text-lg">2. Qué pasa al crear la sala</h3>
                  <ul className="list-disc list-inside space-y-0.5 ml-1">
                    <li>Se descuenta tu apuesta de la wallet y se crea una sala nueva con un código de 6 dígitos.</li>
                    <li>La sala aparece en este lobby si es pública, o puedes compartir el código si es privada.</li>
                    <li>Cuando otro jugador entra, el sistema arma el pozo con las dos apuestas.</li>
                  </ul>
                </section>

                <section className="space-y-1">
                  <h3 className="font-bold text-text text-base md:text-lg">3. Unirse usando código o lista</h3>
                  <ul className="list-disc list-inside space-y-0.5 ml-1">
                    <li>Desde el campo <span className="font-semibold">"Código de sala"</span> puedes entrar directo si te compartieron el código.</li>
                    <li>También puedes unirte tocando cualquier sala pública de la lista de abajo.</li>
                  </ul>
                </section>

                <section className="space-y-1">
                  <h3 className="font-bold text-text text-base md:text-lg">4. Estados de la sala</h3>
                  <ul className="list-disc list-inside space-y-0.5 ml-1">
                    <li><span className="font-semibold">Esperando:</span> estás tú solo, esperando rival.</li>
                    <li><span className="font-semibold">Listo:</span> ambos jugadores dentro; el invitado marca "Estoy listo".</li>
                    <li><span className="font-semibold">Jugando:</span> partida en curso con turnos de 15 segundos.</li>
                  </ul>
                </section>

                <section className="space-y-1">
                  <h3 className="font-bold text-text text-base md:text-lg">5. Buenas prácticas</h3>
                  <ul className="list-disc list-inside space-y-0.5 ml-1">
                    <li>Crea salas públicas para encontrar rivales rápido, y privadas para jugar solo con amigos.</li>
                    <li>Antes de apostar alto, revisa tu balance de coins/fires.</li>
                    <li>Si una sala se queda colgada, puedes pedir al admin/tote que la cierre para reembolsar apuestas.</li>
                  </ul>
                </section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <InsufficientFiresModal
        isOpen={showInsufficientFiresModal}
        onClose={() => setShowInsufficientFiresModal(false)}
        missingFires={missingFires}
      />
    </div>
  );
};
export default TicTacToeLobby;
