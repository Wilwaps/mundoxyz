import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { ChevronLeft, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';
import PoolGame from '../components/PoolGame/PoolGame'; // We will create this next

const PoolRoom = () => {
    const { code } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { socket } = useSocket();

    const [room, setRoom] = useState(null);
    const [gameState, setGameState] = useState(null);

    // Fetch room details
    const { data: roomData, refetch: refetchRoom } = useQuery({
        queryKey: ['pool-room', code],
        queryFn: async () => {
            const response = await axios.get(`/api/pool/room/${code}`);
            return response.data.room;
        },
        refetchInterval: 2000,
    });

    useEffect(() => {
        if (roomData) {
            setRoom(roomData);
            setGameState(roomData.game_state);
        }
    }, [roomData]);

    // Join socket room
    useEffect(() => {
        if (!socket || !code || !user) return;

        socket.emit('pool:join-room', {
            roomCode: code,
            userId: user.id
        });

        return () => {
            socket.emit('pool:leave-room', { roomCode: code });
        };
    }, [socket, code, user]);

    // Socket listeners
    useEffect(() => {
        if (!socket) return;

        socket.on('pool:player-joined', () => {
            toast('Un jugador se ha unido');
            refetchRoom();
        });

        socket.on('pool:game-started', () => {
            toast.success('¡El juego ha comenzado!');
            refetchRoom();
        });

        socket.on('pool:turn-processed', (data) => {
            // Update local state from server authority
            setGameState(data.gameState);
            refetchRoom();
            if (data.foul) {
                toast.error(`Falta: ${data.foulReason}`);
            }
        });

        return () => {
            socket.off('pool:player-joined');
            socket.off('pool:game-started');
            socket.off('pool:turn-processed');
        };
    }, [socket, refetchRoom]);

    // Start game mutation
    const startGameMutation = useMutation({
        mutationFn: async () => {
            await axios.post(`/api/pool/room/${code}/start`);
        },
        onSuccess: () => {
            toast.success('Iniciando partida...');
        }
    });

    if (!room) return <div className="flex justify-center items-center h-screen"><div className="spinner"></div></div>;

    const isHost = room.host_id === user?.id;
    const isOpponent = room.player_opponent_id === user?.id;

    return (
        <div className="min-h-screen bg-black/90 flex flex-col">
            {/* Header Overlay */}
            <div className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between items-start pointer-events-none">
                <div className="pointer-events-auto">
                    <button
                        onClick={() => navigate('/pool/lobby')}
                        className="flex items-center gap-2 text-white/80 hover:text-white bg-black/50 px-3 py-1 rounded-full backdrop-blur-md"
                    >
                        <ChevronLeft size={20} />
                        Lobby
                    </button>
                </div>

                <div className="bg-black/50 px-4 py-2 rounded-xl backdrop-blur-md text-white text-center">
                    <div className="text-xs text-white/60">Sala {code}</div>
                    <div className="font-bold text-lg">
                        {room.mode === 'coins' ? `${room.pot_coins} 💰` : `${room.pot_fires} 🔥`}
                    </div>
                </div>

                <div className="bg-black/50 px-4 py-2 rounded-xl backdrop-blur-md text-white text-right">
                    <div className="flex items-center gap-2 justify-end">
                        <span className={room.current_turn === room.host_id ? 'text-accent font-bold' : 'text-white/60'}>
                            {room.host_username}
                            {isHost && ' (Tú)'}
                        </span>
                        <div className="w-2 h-2 rounded-full bg-white/20"></div>
                        <span className={room.current_turn === room.player_opponent_id ? 'text-accent font-bold' : 'text-white/60'}>
                            {room.opponent_username || 'Esperando...'}
                            {isOpponent && ' (Tú)'}
                        </span>
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                        {room.status === 'playing' ? (
                            <span className="text-success">En Juego</span>
                        ) : (
                            <span>{room.status}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Game Area */}
            <div className="flex-1 flex items-center justify-center relative overflow-hidden">
                {room.status === 'playing' ? (
                    <PoolGame
                        room={room}
                        user={user}
                        socket={socket}
                        gameState={gameState}
                        isMyTurn={room.current_turn === user?.id}
                    />
                ) : (
                    <div className="text-center p-8 bg-glass rounded-2xl border border-white/10 max-w-md mx-4">
                        <h2 className="text-2xl font-bold text-white mb-4">
                            {room.status === 'waiting' ? 'Esperando Oponente' : 'Listo para Jugar'}
                        </h2>

                        {room.status === 'waiting' && (
                            <div className="flex justify-center mb-6">
                                <div className="animate-pulse bg-white/10 p-4 rounded-full">
                                    <Users size={48} className="text-white/40" />
                                </div>
                            </div>
                        )}

                        {room.status === 'ready' && isHost && (
                            <button
                                onClick={() => startGameMutation.mutate()}
                                disabled={startGameMutation.isPending}
                                className="btn-primary w-full py-3 text-lg"
                            >
                                {startGameMutation.isPending ? 'Iniciando...' : '🎱 Iniciar Partida'}
                            </button>
                        )}

                        {room.status === 'ready' && !isHost && (
                            <p className="text-white/60">Esperando al host para iniciar...</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PoolRoom;
