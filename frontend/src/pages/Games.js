import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Gamepad2, Users, Trophy, Clock, Zap } from 'lucide-react';

const Games = () => {
  const navigate = useNavigate();

  // Fetch available games
  const { data: games, isLoading } = useQuery({
    queryKey: ['games'],
    queryFn: async () => {
      const response = await axios.get('/api/games/list');
      return response.data;
    }
  });

  // Fetch active games
  const { data: activeGames } = useQuery({
    queryKey: ['active-games'],
    queryFn: async () => {
      const response = await axios.get('/api/games/active');
      return response.data;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const gameIcons = {
    tictactoe: (
      <svg className="w-full h-full" viewBox="0 0 100 100">
        <defs>
          <filter id="neon-glow-violet" width="200%" height="200%" x="-50%" y="-50%">
            <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="4" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g style={{ filter: 'url(#neon-glow-violet)' }}>
          <path d="M20 20 L50 50 M50 20 L20 50" stroke="#a78bfa" strokeLinecap="round" strokeWidth="8" />
          <circle cx="70" cy="70" fill="none" r="15" stroke="#a78bfa" strokeWidth="8" />
        </g>
      </svg>
    ),
    bingo: (
      <svg className="w-full h-full" viewBox="0 0 100 100">
        <defs>
          <filter id="neon-glow-accent" width="200%" height="200%" x="-50%" y="-50%">
            <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="3" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern id="mesh" patternUnits="userSpaceOnUse" width="10" height="10">
            <path d="M-1,1 l2,-2 M0,10 l10,-10 M9,11 l2,-2" stroke="#22d3ee80" strokeWidth="1" />
          </pattern>
        </defs>
        <g style={{ filter: 'url(#neon-glow-accent)' }}>
          <circle cx="50" cy="50" fill="url(#mesh)" r="40" stroke="#22d3ee" strokeWidth="4" />
          <circle cx="50" cy="50" fill="none" r="40" stroke="#22d3ee" strokeWidth="4" />
          <text x="50" y="58" textAnchor="middle" fill="#22d3ee" fontSize="24" fontWeight="bold">B</text>
        </g>
      </svg>
    ),
    raffles: (
      <svg className="w-full h-full" viewBox="0 0 100 100">
        <defs>
          <filter id="neon-glow-fire" width="200%" height="200%" x="-50%" y="-50%">
            <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="3" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g style={{ filter: 'url(#neon-glow-fire)' }}>
          <rect x="25" y="35" width="50" height="30" fill="none" stroke="#FFA500" strokeWidth="3" rx="5" />
          <circle cx="35" cy="50" r="5" fill="#FFFF00" />
          <circle cx="50" cy="50" r="5" fill="#FFA500" />
          <circle cx="65" cy="50" r="5" fill="#FF6347" />
        </g>
      </svg>
    )
  };

  const handleGameClick = (gameId) => {
    if (gameId === 'bingo') {
      navigate('/bingo');
    } else if (gameId === 'raffles') {
      navigate('/raffles/lobby');
    } else if (gameId === 'tictactoe') {
      navigate('/tictactoe/lobby');
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold text-center mb-8 text-gradient-accent">Juegos</h1>
      
      {/* Main Games Grid */}
      <div className="space-y-6 mb-8">
        {isLoading ? (
          <div className="flex justify-center">
            <div className="spinner"></div>
          </div>
        ) : (
          games?.map((game) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              className="card-glass flex flex-col items-center text-center cursor-pointer"
              onClick={() => handleGameClick(game.id)}
            >
              <div className="relative w-24 h-24 mb-4 flex items-center justify-center">
                {gameIcons[game.id]}
              </div>
              
              <h2 className="text-2xl font-bold text-violet mb-2">{game.name}</h2>
              <p className="text-text/60 mb-4">{game.description}</p>
              
              <div className="flex items-center gap-4 mb-4 text-sm">
                <div className="flex items-center gap-1 text-text/60">
                  <Users size={16} />
                  <span>{game.min_players}-{game.max_players}</span>
                </div>
                {game.active_rooms > 0 && (
                  <div className="flex items-center gap-1 text-success">
                    <Zap size={16} />
                    <span>{game.active_rooms} activas</span>
                  </div>
                )}
              </div>
              
              <button className="w-full max-w-xs btn-primary">
                Jugar Ahora
              </button>
            </motion.div>
          ))
        )}
      </div>

      {/* Active Games Section */}
      {activeGames && (activeGames.tictactoe?.length > 0 || activeGames.bingo?.length > 0 || activeGames.raffles?.length > 0) && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4 text-text/80">Partidas Activas</h2>
          
          {/* Active TicTacToe Rooms */}
          {activeGames.tictactoe?.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-violet">Salas de La Vieja</h3>
              <div className="space-y-3">
                {activeGames.tictactoe.map((room) => (
                  <motion.div
                    key={room.id}
                    whileHover={{ x: 5 }}
                    className="glass-panel p-4 cursor-pointer"
                    onClick={() => navigate(`/tictactoe/room/${room.code}`)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold text-text">Sala {room.code}</h4>
                        <p className="text-sm text-text/60">
                          Host: {room.host_username} • Modo: {room.mode}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-text/60">
                          {room.player_o_username ? '2/2' : '1/2'} jugadores
                        </div>
                        {room.mode === 'coins' && room.pot_coins > 0 && (
                          <div className="text-sm text-accent">
                            🪙 {room.pot_coins}
                          </div>
                        )}
                        {room.mode === 'fires' && room.pot_fires > 0 && (
                          <div className="text-sm text-fire-orange">
                            🔥 {room.pot_fires}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
          
          {/* Active Bingo Rooms */}
          {activeGames.bingo?.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-accent">Salas de Bingo</h3>
              <div className="space-y-3">
                {activeGames.bingo.map((room) => (
                  <motion.div
                    key={room.id}
                    whileHover={{ x: 5 }}
                    className="glass-panel p-4 cursor-pointer"
                    onClick={() => navigate(`/bingo/room/${room.code}`)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold text-text">{room.name}</h4>
                        <p className="text-sm text-text/60">
                          Código: {room.code} • Host: {room.host_username}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-text/60">
                          {room.current_players}/{room.max_players} jugadores
                        </div>
                        {room.pot_fires > 0 && (
                          <div className="text-sm text-fire-orange">
                            🔥 {room.pot_fires}
                          </div>
                        )}
                        {room.pot_coins > 0 && (
                          <div className="text-sm text-accent">
                            🪙 {room.pot_coins}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
          
          {/* Active Raffles */}
          {activeGames.raffles?.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-fire-orange">Rifas Activas</h3>
              <div className="space-y-3">
                {activeGames.raffles.map((raffle) => (
                  <motion.div
                    key={raffle.id}
                    whileHover={{ x: 5 }}
                    className="glass-panel p-4 cursor-pointer"
                    onClick={() => navigate(`/raffles/room/${raffle.code}`)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold text-text">{raffle.name}</h4>
                        <p className="text-sm text-text/60">
                          {raffle.numbers_sold}/{raffle.numbers_range} números vendidos
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-text/60">
                          <Clock size={14} className="inline mr-1" />
                          {new Date(raffle.ends_at).toLocaleDateString()}
                        </div>
                        {raffle.pot_fires > 0 && (
                          <div className="text-sm text-fire-orange">
                            🔥 {raffle.pot_fires}
                          </div>
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
    </div>
  );
};

export default Games;
