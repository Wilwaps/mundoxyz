import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, Users, Coins, Flame, Lock, Globe, X, AlertCircle, ArrowRight, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import InsufficientFiresModal from '../components/InsufficientFiresModal';

const PoolLobby = () => {
    const navigate = useNavigate();
    const { user, refreshUser } = useAuth();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({
        mode: 'coins',
        bet_amount: 100,
        visibility: 'public',
        opponent_type: 'player',
        ai_difficulty: 'easy'
    });
    const [modeFilter, setModeFilter] = useState('all');
    const [joinCode, setJoinCode] = useState('');
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [showInsufficientFiresModal, setShowInsufficientFiresModal] = useState(false);
    const [missingFires, setMissingFires] = useState(0);

    // Fetch active room (reconnection)
    // Note: We might need a specific endpoint for pool active room if not shared
    // For now assuming we check via a new endpoint or generic one
    const { data: activeRoomData } = useQuery({
        queryKey: ['pool-active-room'],
        queryFn: async () => {
            if (!user) return { activeRoom: null };
            try {
                // We might need to implement this endpoint in backend/routes/pool.js if we want auto-reconnect
                // For now, let's skip auto-reconnect logic or assume it's handled elsewhere
                return { activeRoom: null };
            } catch (error) {
                return { activeRoom: null };
            }
        },
        enabled: !!user,
        refetchInterval: 10000
    });

    const activeRoom = activeRoomData?.activeRoom;

    // Fetch public rooms (using tictactoe pattern but for pool)
    // We need to implement GET /api/pool/rooms/public in backend if not done
    // Wait, I didn't implement that in the routes file! I only did create/join/start.
    // I need to add that route. For now, I'll assume I'll add it.
    const { data: rooms, isLoading } = useQuery({
        queryKey: ['pool-rooms', modeFilter],
        queryFn: async () => {
            // Temporary: Mock response until backend route is ready or use a generic one
            // Actually, I should add the route. But let's write the frontend code assuming it exists.
            // I'll add the route in the next step.
            const params = modeFilter !== 'all' ? `?mode=${modeFilter}` : '';
            try {
                const response = await axios.get(`/api/pool/rooms/public${params}`);
                return response.data.rooms;
            } catch (e) {
                return [];
            }
        },
        refetchInterval: 5000
    });

    // Fetch user balance
    const { data: balance, refetch: refetchBalance } = useQuery({
        queryKey: ['user-balance'],
        queryFn: async () => {
            if (!user) return { coins_balance: 0, fires_balance: 0 };
            try {
                const response = await axios.get('/api/economy/balance');
                return response.data;
            } catch (error) {
                return { coins_balance: 0, fires_balance: 0 };
            }
        },
        enabled: !!user,
        refetchInterval: 5000
    });

    // Create room mutation
    const createRoomMutation = useMutation({
        mutationFn: async (data) => {
            const response = await axios.post('/api/pool/create', data);
            return response.data;
        },
        onSuccess: async (data) => {
            toast.success('Sala de Pool creada exitosamente');
            refetchBalance();
            await refreshUser();
            navigate(`/pool/room/${data.room.code}`);
        },
        onError: (error) => {
            toast.error(error.response?.data?.error || 'Error al crear sala');
        }
    });

    // Join room mutation
    const joinRoomMutation = useMutation({
        mutationFn: async (code) => {
            const response = await axios.post(`/api/pool/join/${code}`);
            return response.data;
        },
        onSuccess: async (data, code) => {
            toast.success('Te has unido a la sala');
            refetchBalance();
            await refreshUser();
            navigate(`/pool/room/${code}`);
        },
        onError: (error) => {
            toast.error(error.response?.data?.error || 'Error al unirse a la sala');
        }
    });

    const handleCreateRoom = () => {
        if (!user) {
            toast.error('Debes iniciar sesión');
            return;
        }

        // Validaciones económicas SOLO para partidas vs jugador
        if (createForm.opponent_type === 'player') {
            if (createForm.mode === 'coins') {
                if (createForm.bet_amount < 1 || createForm.bet_amount > 10000) {
                    toast.error('La apuesta debe ser entre 1 y 10000 coins');
                    return;
                }
                if (balance?.coins_balance < createForm.bet_amount) {
                    toast.error('No tienes suficientes coins');
                    return;
                }
            } else if (createForm.mode === 'fires') {
                const firesBalance = parseFloat(balance?.fires_balance || 0);
                if (firesBalance < 1) {
                    setMissingFires(1 - firesBalance);
                    setShowInsufficientFiresModal(true);
                    return;
                }
            }
        }

        let dataToSend;
        if (createForm.opponent_type === 'ron_ai') {
            // Modo práctica: sin apuesta real
            dataToSend = {
                ...createForm,
                bet_amount: 0
            };
        } else {
            dataToSend = {
                ...createForm,
                bet_amount: createForm.mode === 'fires' ? 1 : createForm.bet_amount
            };
        }

        createRoomMutation.mutate(dataToSend);
    };

    const handleJoinRoom = (code) => {
        if (!user) {
            toast.error('Debes iniciar sesión');
            return;
        }
        joinRoomMutation.mutate(code);
    };

    return (
        <div className="p-4">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-center mb-2 text-gradient-accent">
                    8-Ball Pool 🎱
                </h1>
                <p className="text-center text-text/60">
                    Billar clásico • Física realista • Apuestas en tiempo real
                </p>
                <div className="mt-3 flex justify-center">
                    <button
                        type="button"
                        onClick={() => setShowHelpModal(true)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-glass hover:bg-glass-hover text-xs text-text/80 transition-colors"
                    >
                        <Info size={14} className="text-accent" />
                        <span>Reglas y Ayuda</span>
                    </button>
                </div>
            </div>

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

                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Código"
                        value={joinCode}
                        onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            if (value.length <= 6) setJoinCode(value);
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
                                toast.error('Código inválido');
                            }
                        }}
                        disabled={!user || joinCode.length !== 6}
                        className="btn-secondary px-4"
                    >
                        Unirse
                    </button>
                </div>

                <div className="flex gap-2 flex-1 justify-center sm:justify-start">
                    <button
                        onClick={() => setModeFilter('all')}
                        className={`px-4 py-2 rounded-lg transition-colors ${modeFilter === 'all' ? 'bg-violet text-white' : 'glass-panel text-text/60'
                            }`}
                    >
                        Todos
                    </button>
                    <button
                        onClick={() => setModeFilter('coins')}
                        className={`px-4 py-2 rounded-lg transition-colors ${modeFilter === 'coins' ? 'bg-accent text-dark' : 'glass-panel text-text/60'
                            }`}
                    >
                        💰 Coins
                    </button>
                    <button
                        onClick={() => setModeFilter('fires')}
                        className={`px-4 py-2 rounded-lg transition-colors ${modeFilter === 'fires' ? 'bg-fire-orange text-dark' : 'glass-panel text-text/60'
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
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-lg text-text">Sala {room.code}</h3>
                                    <p className="text-sm text-text/60">Host: {room.host_username}</p>
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
                                <div className={`px-3 py-1 rounded-full text-sm font-medium ${room.status === 'waiting' ? 'bg-success/20 text-success' : 'bg-violet/20 text-violet'
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
                                <button className="btn-secondary text-sm px-3 py-1">Unirse</button>
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

            {/* Create Modal */}
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

                            <h2 className="text-2xl font-bold mb-4 text-text">Crear Sala - Pool</h2>

                            {/* Mode Selection (moneda) */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-text/80 mb-2">Modo</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setCreateForm({ ...createForm, mode: 'coins' })}
                                        className={`p-3 rounded-lg border transition-all ${createForm.mode === 'coins' ? 'border-accent bg-accent/20 text-accent' : 'border-white/10 text-text/60'
                                            }`}
                                    >
                                        <Coins className="mx-auto mb-1" size={24} />
                                        <div className="text-sm">Coins</div>
                                    </button>
                                    <button
                                        onClick={() => setCreateForm({ ...createForm, mode: 'fires', bet_amount: 1 })}
                                        className={`p-3 rounded-lg border transition-all ${createForm.mode === 'fires' ? 'border-fire-orange bg-fire-orange/20 text-fire-orange' : 'border-white/10 text-text/60'
                                            }`}
                                    >
                                        <Flame className="mx-auto mb-1" size={24} />
                                        <div className="text-sm">Fires</div>
                                    </button>
                                </div>
                            </div>

                            {/* Tipo de partida: vs jugador o RON-IA */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-text/80 mb-2">Tipo de partida</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setCreateForm({ ...createForm, opponent_type: 'player' })}
                                        className={`p-3 rounded-lg border transition-all ${
                                            createForm.opponent_type === 'player'
                                                ? 'border-success bg-success/20 text-success'
                                                : 'border-white/10 text-text/60'
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
                                                : 'border-white/10 text-text/60'
                                        }`}
                                    >
                                        <span className="mx-auto mb-1 text-lg">🤖</span>
                                        <div className="text-sm">Vs RON-IA (Práctica)</div>
                                    </button>
                                </div>
                            </div>

                            {/* Dificultad RON-IA */}
                            {createForm.opponent_type === 'ron_ai' && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-text/80 mb-2">Dificultad RON-IA</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['easy', 'medium', 'hard'].map((level) => (
                                            <button
                                                key={level}
                                                onClick={() => setCreateForm({ ...createForm, ai_difficulty: level })}
                                                className={`p-2 rounded-lg border text-xs font-semibold transition-all ${
                                                    createForm.ai_difficulty === level
                                                        ? 'border-accent bg-accent/20 text-accent'
                                                        : 'border-white/10 text-text/60'
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

                            {/* Bet Amount (solo aplica vs jugador) */}
                            {createForm.opponent_type === 'player' && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-text/80 mb-2">Apuesta</label>
                                    {createForm.mode === 'coins' ? (
                                        <div>
                                            <input
                                                type="number"
                                                min="1"
                                                max="10000"
                                                value={createForm.bet_amount}
                                                onChange={(e) => setCreateForm({ ...createForm, bet_amount: parseInt(e.target.value) || 1 })}
                                                className="w-full p-3 rounded-lg bg-dark border border-white/10 focus:border-accent text-black"
                                            />
                                            <div className="mt-2 text-xs text-text/60">
                                                Balance: {balance?.coins_balance?.toFixed(2) || '0.00'} 💰
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-3 rounded-lg bg-fire-orange/10 border border-fire-orange/30">
                                            <span className="text-fire-orange font-bold">1 Fire (Fijo)</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Visibility */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-text/80 mb-2">Visibilidad</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setCreateForm({ ...createForm, visibility: 'public' })}
                                        className={`p-3 rounded-lg border transition-all ${createForm.visibility === 'public' ? 'border-success bg-success/20 text-success' : 'border-white/10 text-text/60'
                                            }`}
                                    >
                                        <Globe className="mx-auto mb-1" size={20} />
                                        <div className="text-sm">Pública</div>
                                    </button>
                                    <button
                                        onClick={() => setCreateForm({ ...createForm, visibility: 'private' })}
                                        className={`p-3 rounded-lg border transition-all ${createForm.visibility === 'private' ? 'border-violet bg-violet/20 text-violet' : 'border-white/10 text-text/60'
                                            }`}
                                    >
                                        <Lock className="mx-auto mb-1" size={20} />
                                        <div className="text-sm">Privada</div>
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setShowCreateModal(false)} className="flex-1 btn-secondary">Cancelar</button>
                                <button onClick={handleCreateRoom} disabled={createRoomMutation.isPending} className="flex-1 btn-primary">
                                    {createRoomMutation.isPending ? 'Creando...' : 'Crear Sala'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
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

export default PoolLobby;
