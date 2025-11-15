import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, Globe, X, Gamepad2, Grid3x3, Search, Loader, Trophy, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
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
  const [showHowToEarnModal, setShowHowToEarnModal] = useState(false);
  const [howToStep, setHowToStep] = useState(0);

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

  const { data: activeGames } = useQuery({
    queryKey: ['active-games-lobby'],
    queryFn: async () => {
      const response = await axios.get('/api/games/active');
      return response.data;
    },
    refetchInterval: 30000
  });

  const handleOpenSelectorModal = () => {
    setShowSelectorModal(true);
  };

  const handleSelectGameType = (type) => {
    setShowSelectorModal(false);
    switch (type) {
      case 'tictactoe':
        // Redirigir al lobby de TicTacToe (tiene su propio modal inline)
        navigate('/tictactoe/lobby');
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
      // 1) Intentar encontrar sala de juego (TicTacToe / Bingo) mediante sistema unificado
      const res = await fetch(`/api/rooms/find/${quickJoinCode}`);
      const data = await res.json();

      if (res.ok) {
        toast.success('¡Sala encontrada! Redirigiendo...');
        navigate(data.redirect_url);
        return;
      }

      // 2) Si no existe sala de juego pero el código es válido, intentar buscar una rifa
      if (data.code === 'ROOM_NOT_FOUND') {
        try {
          const raffleRes = await fetch(`/api/raffles/v2/${quickJoinCode}`);
          const raffleData = await raffleRes.json().catch(() => ({}));

          if (raffleRes.ok && raffleData?.raffle) {
            toast.success('Rifa encontrada, redirigiendo...');
            navigate(`/raffles/${quickJoinCode}`);
            return;
          }

          // Si tampoco es una rifa válida, mostrar error genérico de no encontrada
          toast.error('Sala no encontrada. Verifica el código');
        } catch (innerErr) {
          console.error('Error buscando rifa por código:', innerErr);
          toast.error('Error al buscar sala o rifa');
        }
        return;
      }

      // Otros estados específicos de salas de juego
      if (data.code === 'ROOM_FINISHED') {
        toast.error('Esta sala ya finalizó');
      } else if (data.code === 'ROOM_CANCELLED') {
        toast.error('Esta sala fue cancelada');
      } else {
        toast.error(data.error || 'Error al buscar sala');
      }
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
      case 'raffle':
        url = `/raffles/${room.code}`;
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
      case 'raffle':
        return <Trophy size={16} className="text-amber-400" />;
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
      case 'raffle':
        return 'Rifa';
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

      {/* How to earn money card */}
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          setShowHowToEarnModal(true);
          setHowToStep(0);
        }}
        className="card-glass mb-6 cursor-pointer hover:bg-glass-hover transition-all border border-accent/40"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-fire-orange/20 flex items-center justify-center">
            <span className="text-2xl">🔥</span>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-text">¿Cómo ganar dinero?</h2>
            <p className="text-sm text-text/60">
              Te explicamos en 4 pasos cómo recargar fuegos, jugar para ganar y luego retirar tu premio.
            </p>
          </div>
        </div>
      </motion.div>

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

      {activeGames && (activeGames.tictactoe?.length > 0 || activeGames.bingo?.length > 0) && (
        <div className="card-glass mt-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Gamepad2 size={20} className="text-accent" />
            Partidas Activas
          </h2>

          {activeGames.tictactoe?.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2 text-violet">Salas de La Vieja</h3>
              <div className="space-y-2">
                {activeGames.tictactoe.map((room) => (
                  <motion.div
                    key={room.id}
                    whileHover={{ x: 3 }}
                    className="bg-glass-light p-3 rounded-lg cursor-pointer hover:bg-glass-hover transition-all"
                    onClick={() => navigate(`/tictactoe/room/${room.code}`)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Sala {room.code}</span>
                          <span className="text-xs text-text/60">Host: {room.host_username}</span>
                        </div>
                        <p className="text-xs text-text/60">
                          Modo: {room.mode} • {room.player_o_username ? '2/2' : '1/2'} jugadores
                        </p>
                      </div>
                      <div className="text-right text-xs">
                        {room.mode === 'coins' && room.pot_coins > 0 && (
                          <div className="text-accent">💰 {room.pot_coins}</div>
                        )}
                        {room.mode === 'fires' && room.pot_fires > 0 && (
                          <div className="text-fire-orange">🔥 {room.pot_fires}</div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {activeGames.bingo?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-accent">Salas de Bingo</h3>
              <div className="space-y-2">
                {activeGames.bingo.map((room) => (
                  <motion.div
                    key={room.id}
                    whileHover={{ x: 3 }}
                    className="bg-glass-light p-3 rounded-lg cursor-pointer hover:bg-glass-hover transition-all"
                    onClick={() => navigate(`/bingo/v2/room/${room.code}`)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{room.name}</span>
                          <span className="text-xs text-text/60">#{room.code}</span>
                        </div>
                        <p className="text-xs text-text/60">
                          Host: {room.host_username} • {room.current_players}/{room.max_players} jugadores
                        </p>
                      </div>
                      <div className="text-right text-xs">
                        {room.total_pot > 0 && (
                          <div className="text-fire-orange">🔥 {room.total_pot}</div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
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
          show={showBingoModal}
          onClose={() => setShowBingoModal(false)}
          onSuccess={(code) => {
            setShowBingoModal(false);
            navigate(`/bingo/v2/room/${code}`);
          }}
        />
      )}

      {/* Modal: Cómo ganar dinero */}
      <AnimatePresence>
        {showHowToEarnModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowHowToEarnModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="w-full max-w-3xl card-glass relative overflow-hidden max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowHowToEarnModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="p-6 border-b border-white/10">
                <h2 className="text-2xl font-bold text-text mb-1">Cómo ganar dinero con MundoXYZ</h2>
                <p className="text-sm text-text/60">
                  Sigue este recorrido rápido: deposita fuegos, juega para multiplicarlos y luego canjea tu premio.
                </p>
              </div>

              <div className="p-6 pt-4 flex flex-col gap-4">
                {/* Indicadores de pasos */}
                <div className="flex items-center justify-center gap-3 mb-2">
                  {[0, 1, 2, 3].map((step) => (
                    <button
                      key={step}
                      onClick={() => setHowToStep(step)}
                      className={`h-2 rounded-full transition-all ${
                        howToStep === step ? 'w-10 bg-accent' : 'w-2 bg-white/20'
                      }`}
                    />
                  ))}
                </div>

                <div className="relative overflow-hidden min-h-[220px]">
                  <AnimatePresence mode="wait">
                    {howToStep === 0 && (
                      <motion.div
                        key="intro"
                        initial={{ x: 80, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -80, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="grid md:grid-cols-2 gap-6 items-center"
                      >
                        <div>
                          <h3 className="text-xl font-bold mb-2">Paso 1 · Bienvenido al juego del dinero</h3>
                          <p className="text-sm text-text/70 mb-3">
                            En MundoXYZ conviertes tu tiempo y tu diversión en fuegos <span className="text-fire-orange">🔥</span>.
                            Los fuegos son tu moneda premium: los usas para entrar a partidas, rifas y experiencias, y luego puedes
                            canjearlos por dinero real.
                          </p>
                          <ul className="text-sm text-text/70 space-y-1">
                            <li>• 💰 <strong>Monedas</strong>: puntos suaves para jugar y progresar.</li>
                            <li>• 🔥 <strong>Fuegos</strong>: la moneda con la que puedes ganar y retirar dinero.</li>
                          </ul>
                        </div>
                        <div className="hidden md:flex items-center justify-center">
                          <div className="w-48 h-48 rounded-3xl bg-gradient-to-br from-fire-orange/60 via-amber-400/40 to-violet/50 flex items-center justify-center shadow-2xl">
                            <div className="text-center">
                              <div className="text-5xl mb-2">🔥</div>
                              <p className="text-sm font-semibold text-text/90">Juega, gana y canjea</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {howToStep === 1 && (
                      <motion.div
                        key="deposit"
                        initial={{ x: 80, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -80, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="grid md:grid-cols-2 gap-6 items-start"
                      >
                        <div>
                          <h3 className="text-xl font-bold mb-2">Paso 2 · Deposita fuegos</h3>
                          <p className="text-sm text-text/70 mb-3">
                            Para ganar dinero primero necesitas fuegos en tu wallet.
                            Los puedes recargar fácil con pago bancario o recibirlos de otros jugadores.
                          </p>
                          <ul className="text-sm text-text/70 space-y-2">
                            <li>
                              <strong>Desde tu Perfil:</strong>
                              <br />
                              1. Abre el menú y entra a <span className="font-semibold">Perfil</span>.
                              <br />
                              2. Toca la tarjeta de <span className="font-semibold">🔥 Fuegos</span>.
                              <br />
                              3. En el historial, pulsa <span className="font-semibold">COMPRAR</span>.
                              <br />
                              4. Copia los datos bancarios, haz el pago e ingresa el monto y la referencia.
                              <br />
                              5. Un administrador aprueba tu compra y los fuegos aparecen en tu balance.
                            </li>
                            <li>
                              <strong>También puedes recibir fuegos</strong> de otros usuarios:
                              comparte tu dirección de billetera desde la opción <span className="font-semibold">Recibir</span>.
                            </li>
                          </ul>
                        </div>
                        <div className="hidden md:flex items-center justify-center">
                          <div className="glass-panel p-4 rounded-2xl space-y-3 w-full max-w-xs">
                            <p className="text-xs text-text/60">Ejemplo de flujo:</p>
                            <div className="text-sm">
                              <p>1. Perfil → 🔥 Fuegos</p>
                              <p>2. Botón <span className="font-semibold">COMPRAR</span></p>
                              <p>3. Enviar pago bancario</p>
                              <p>4. Cargar referencia</p>
                              <p>5. Esperar aprobación ✅</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {howToStep === 2 && (
                      <motion.div
                        key="play"
                        initial={{ x: 80, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -80, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="grid md:grid-cols-2 gap-6 items-start"
                      >
                        <div>
                          <h3 className="text-xl font-bold mb-2">Paso 3 · Juega y multiplica</h3>
                          <p className="text-sm text-text/70 mb-3">
                            Con fuegos en tu balance, ya puedes entrar a salas y rifas donde el pozo crece con cada jugador.
                            Si ganas, te llevas el premio en fuegos o monedas, según el juego.
                          </p>
                          <ul className="text-sm text-text/70 space-y-2">
                            <li>• En este Lobby verás tus salas activas y partidas abiertas.</li>
                            <li>• Crea tus propias salas de <strong>TicTacToe</strong> o entra a <strong>Bingo</strong> y <strong>Rifas</strong>.</li>
                            <li>• Cada sala muestra el pozo 💰/🔥 y el estado del juego.</li>
                            <li>• Cuando ganas, tu wallet se actualiza automáticamente y verás la transacción en el historial.</li>
                          </ul>
                        </div>
                        <div className="hidden md:flex items-center justify-center">
                          <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                            <div className="glass-panel p-3 rounded-xl">
                              <p className="text-xs text-text/60 mb-1">Ejemplo:</p>
                              <p className="text-sm font-semibold">Sala TicTacToe</p>
                              <p className="text-xs text-text/60">Pozo: 200 🔥</p>
                            </div>
                            <div className="glass-panel p-3 rounded-xl">
                              <p className="text-xs text-text/60 mb-1">Ejemplo:</p>
                              <p className="text-sm font-semibold">Bingo en vivo</p>
                              <p className="text-xs text-text/60">Premio en fuegos</p>
                            </div>
                            <div className="glass-panel p-3 rounded-xl col-span-2">
                              <p className="text-xs text-text/60 mb-1">Resultado:</p>
                              <p className="text-sm font-semibold text-green-400">Premio acreditado en tu wallet ✅</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {howToStep === 3 && (
                      <motion.div
                        key="withdraw"
                        initial={{ x: 80, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -80, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="grid md:grid-cols-2 gap-6 items-start"
                      >
                        <div>
                          <h3 className="text-xl font-bold mb-2">Paso 4 · Retira tu dinero</h3>
                          <p className="text-sm text-text/70 mb-3">
                            Cuando acumules suficientes fuegos puedes solicitar un canje a dinero real.
                            El equipo revisa tu solicitud y te paga por transferencia bancaria.
                          </p>
                          <ul className="text-sm text-text/70 space-y-2">
                            <li>• Actualmente el canje se coordina directamente con el equipo (Tote) usando los datos de tu cuenta.</li>
                            <li>• El mínimo habitual para canjear es de <strong>100 fuegos</strong>.</li>
                            <li>• Se aplica una comisión del <strong>5%</strong> sobre el monto que quieres retirar.</li>
                            <li>• Una vez aprobado, verás el movimiento en tu historial y recibirás el pago en tu banco.</li>
                          </ul>
                        </div>
                        <div className="hidden md:flex items-center justify-center">
                          <div className="glass-panel p-4 rounded-2xl space-y-3 w-full max-w-xs">
                            <p className="text-xs text-text/60">Resumen de canje:</p>
                            <ul className="text-xs text-text/70 space-y-1">
                              <li>• Solicitas 100 🔥</li>
                              <li>• Comisión 5% (5 🔥)</li>
                              <li>• Total descontado: 105 🔥</li>
                              <li>• Recibes el equivalente en tu cuenta bancaria 💵</li>
                            </ul>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Controles de navegación */}
                <div className="flex items-center justify-between mt-2">
                  <button
                    onClick={() => setHowToStep((prev) => Math.max(0, prev - 1))}
                    disabled={howToStep === 0}
                    className="px-3 py-2 text-sm rounded-lg bg-glass hover:bg-glass-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <ChevronLeft size={16} />
                    Atrás
                  </button>
                  <span className="text-xs text-text/60">
                    Paso {howToStep + 1} de 4
                  </span>
                  <button
                    onClick={() => {
                      if (howToStep < 3) {
                        setHowToStep((prev) => Math.min(3, prev + 1));
                      } else {
                        setShowHowToEarnModal(false);
                      }
                    }}
                    className="px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent/90 flex items-center gap-2"
                  >
                    {howToStep < 3 ? (
                      <>
                        Siguiente
                        <ChevronRight size={16} />
                      </>
                    ) : (
                      <>
                        ¡Listo!
                        <Check size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Lobby;
