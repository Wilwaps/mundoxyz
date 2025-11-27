import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';
import Card from '../components/CaidaGame/Card';
import './CaidaRoom.css'; // We'll add some specific room styles here

const CaidaRoom = () => {
    const { code } = useParams();
    const { user } = useAuth();
    const { socket } = useSocket();
    const [gameState, setGameState] = useState(null);
    const [players, setPlayers] = useState([]);
    const [lastMoveMessage, setLastMoveMessage] = useState('');

    // Fetch Room Data
    const { data: roomData, refetch } = useQuery({
        queryKey: ['caida-room', code],
        queryFn: async () => {
            const response = await axios.get(`/api/caida/room/${code}`);
            return response.data.room;
        },
        refetchInterval: 2000
    });

    // Start Game Mutation
    const startGameMutation = useMutation({
        mutationFn: async () => {
            await axios.post(`/api/caida/start/${code}`);
        },
        onError: (error) => toast.error('Error al iniciar partida')
    });

    // Socket Effects
    useEffect(() => {
        if (!socket || !user) return;

        socket.emit('caida:join-room', { roomCode: code, userId: user.id });

        socket.on('caida:player-joined', (data) => {
            toast.success(`${data.username} se ha unido!`);
            refetch();
        });

        socket.on('caida:game-started', () => {
            toast.success('¡La partida ha comenzado!');
            refetch();
        });

        socket.on('caida:game-update', (data) => {
            console.log('[Caida] game-update', {
                scores: data.gameState?.scores,
                gameState: data.gameState,
                lastMove: data.lastMove
            });
            setGameState(data.gameState);
            if (data.lastMove?.result?.message) {
                setLastMoveMessage(data.lastMove.result.message);
                setTimeout(() => setLastMoveMessage(''), 3000);
            }
            refetch(); // Sync full state occasionally
        });

        return () => {
            socket.off('caida:player-joined');
            socket.off('caida:game-started');
            socket.off('caida:game-update');
        };
    }, [socket, code, user, refetch]);

    // Sync local state with room data
    useEffect(() => {
        if (!roomData) return;

        setPlayers(roomData.players || []);

        if (roomData.game_state && Object.keys(roomData.game_state).length > 0) {
            console.log('[Caida] roomData game_state.scores', roomData.game_state.scores);
            setGameState(prev => {
                if (prev && roomData.status === 'playing') {
                    return prev;
                }
                return roomData.game_state;
            });
        }
    }, [roomData]);

    const handlePlayCard = (card) => {
        if (!socket || !user) return;
        if (roomData?.status !== 'playing') return;

        // Check turn
        const currentTurnId = roomData.player_ids[roomData.current_turn_index];
        if (currentTurnId !== user.id) {
            toast.error('No es tu turno');
            return;
        }

        socket.emit('caida:play-card', {
            roomCode: code,
            userId: user.id,
            card
        });
    };

    if (!roomData) return <div className="flex justify-center p-20"><div className="spinner"></div></div>;

    const isHost = roomData.host_id === user?.id;
    const isMyTurn = roomData.status === 'playing' && roomData.player_ids[roomData.current_turn_index] === user?.id;
    const myHand = gameState?.hands?.[user?.id] || [];
    const tableCards = gameState?.table_cards || [];

    const deckCount = gameState?.deck?.length || 0;
    const handsCount = gameState?.hands
        ? Object.values(gameState.hands).reduce((sum, hand) => sum + (hand ? hand.length : 0), 0)
        : 0;
    const remainingCards = deckCount + handsCount;

    const currentTurnPlayer = players.find(p => p.id === roomData.player_ids[roomData.current_turn_index]);

    return (
        <div className="caida-room min-h-screen bg-scene p-4 pb-24 flex flex-col items-center">
            {/* Header */}
            <div className="w-full max-w-6xl flex justify-between items-center mb-8 glass-panel p-4 rounded-xl">
                <div>
                    <h1 className="text-2xl font-bold text-gradient-gold">Sala {code}</h1>
                    <div className="flex gap-4 text-sm text-text/60">
                        <span>Apuesta: {roomData.bet_amount} {roomData.mode === 'coins' ? '💰' : '🔥'}</span>
                        <span>Estado: {roomData.status}</span>
                    </div>
                </div>

                {/* Players Strip */}
                <div className="flex gap-4">
                    {players.map((p, idx) => (
                        <div key={p.id} className={`flex flex-col items-center p-2 rounded-lg ${roomData.player_ids[roomData.current_turn_index] === p.id ? 'bg-accent/20 border border-accent' : ''
                            }`}>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet to-fuchsia flex items-center justify-center text-xs font-bold">
                                {p.username.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="text-xs mt-1">{p.username}</span>
                            <span className="text-xs font-bold text-accent">
                                {gameState?.scores?.[p.id] || 0} pts
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {roomData.status === 'playing' && (
                <div className="w-full max-w-6xl mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className={`inline-flex items-center px-4 py-2 rounded-full font-semibold text-sm md:text-base shadow-lg transition-colors ${isMyTurn ? 'bg-accent text-dark animate-pulse' : 'bg-dark/60 text-text/60'}`}>
                        {isMyTurn ? '¡Tu Turno!' : `Turno de ${currentTurnPlayer?.username || ''}`}
                    </div>
                    <div className="text-sm text-text/70">
                        Cartas restantes: {gameState ? remainingCards : '--'}
                    </div>
                </div>
            )}

            {/* Game Area */}
            <div className="flex-1 w-full max-w-6xl flex flex-col justify-center relative">

                {/* Message Overlay */}
                <AnimatePresence>
                    {lastMoveMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.8 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute top-1/4 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none"
                        >
                            <div className="text-4xl font-bold text-gradient-gold drop-shadow-lg bg-black/50 px-6 py-3 rounded-full border border-gold-3">
                                {lastMoveMessage}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Table */}
                <div className="game-table relative w-full max-w-3xl mx-auto aspect-[9/16] md:aspect-[16/9] bg-emerald-900/40 rounded-[30px] border-[12px] border-wood-4 shadow-2xl overflow-hidden mb-8">
                    {/* Felt Texture */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] opacity-50 mix-blend-overlay"></div>

                    {/* Center Logo/Decor */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                        <div className="w-64 h-64 rounded-full border-4 border-white"></div>
                    </div>

                    {/* Table Cards */}
                    <div className="absolute inset-0 flex items-center justify-center gap-4 flex-wrap p-12">
                        <AnimatePresence>
                            {tableCards.map((card, idx) => (
                                <motion.div
                                    key={`${card.suit}-${card.rank}-${idx}`}
                                    initial={{ opacity: 0, scale: 0.5, y: -100 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    transition={{ type: 'spring', damping: 15 }}
                                >
                                    <Card suit={card.suit} rank={card.rank} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    {/* Waiting State */}
                    {roomData.status === 'waiting' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
                            <div className="text-center">
                                <h2 className="text-3xl font-bold mb-4">Esperando jugadores...</h2>
                                {isHost && players.length >= 2 && (
                                    <button
                                        onClick={() => startGameMutation.mutate()}
                                        className="btn-primary px-8 py-3 text-lg shadow-lg hover:scale-105 transition-transform"
                                    >
                                        Iniciar Partida
                                    </button>
                                )}
                                {isHost && players.length < 2 && (
                                    <p className="text-text/60">Necesitas al menos 2 jugadores para comenzar.</p>
                                )}
                                {!isHost && (
                                    <p className="text-text/60">Esperando a que el anfitrión inicie...</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Player Hand */}
                {roomData.status === 'playing' && (
                    <div className="player-hand w-full flex justify-center items-end pb-4 mt-2">
                        <div className="flex items-end gap-2 md:gap-3 px-2 overflow-x-auto max-w-full">
                            {myHand.map((card, idx) => (
                                <motion.div
                                    key={`${card.suit}-${card.rank}-${idx}`}
                                    whileHover={{ y: -20, scale: 1.02 }}
                                    className="flex-shrink-0 transition-transform duration-200"
                                >
                                    <Card
                                        suit={card.suit}
                                        rank={card.rank}
                                        onClick={() => handlePlayCard(card)}
                                        className={isMyTurn ? 'cursor-pointer ring-2 ring-accent ring-offset-2 ring-offset-black' : 'opacity-80 grayscale-[0.3]'}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default CaidaRoom;
