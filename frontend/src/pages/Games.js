import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Users, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const Games = () => {
  const navigate = useNavigate();

  const { user, isAdmin } = useAuth();
  const canSeeExperimentalGames = !!user && isAdmin();

  // Fetch available games
  const { data: games, isLoading } = useQuery({
    queryKey: ['games'],
    queryFn: async () => {
      const response = await axios.get('/api/games/list');
      return response.data;
    }
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
    pool: (
      <svg className="w-full h-full" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="pool-felt" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>
        </defs>
        <rect x="8" y="8" width="84" height="84" rx="12" fill="#0f172a" />
        <rect x="14" y="14" width="72" height="72" rx="10" fill="url(#pool-felt)" />
        <circle cx="40" cy="40" r="10" fill="#f9fafb" />
        <text x="40" y="44" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">8</text>
        <circle cx="65" cy="35" r="4" fill="#e11d48" />
        <circle cx="30" cy="65" r="4" fill="#22d3ee" />
      </svg>
    ),
    caida: (
      <svg className="w-full h-full" viewBox="0 0 100 100">
        <defs>
          <filter id="card-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
          </filter>
        </defs>
        <g style={{ filter: 'url(#card-shadow)' }}>
          <rect x="20" y="18" width="40" height="64" rx="6" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="2" />
          <rect x="40" y="22" width="40" height="64" rx="6" fill="#111827" stroke="#facc15" strokeWidth="2" />
          <text x="60" y="58" textAnchor="middle" fill="#facc15" fontSize="22" fontWeight="bold">A</text>
        </g>
      </svg>
    ),
  };

  const handleGameClick = (gameId) => {
    if (gameId === 'bingo') {
      navigate('/bingo');
    } else if (gameId === 'tictactoe') {
      navigate('/tictactoe/lobby');
    } else if (gameId === 'pool') {
      navigate('/pool/lobby');
    } else if (gameId === 'caida') {
      navigate('/caida/lobby');
    }
  };

  const handleShareGame = async (gameId) => {
    let path = '';

    if (gameId === 'pool') {
      path = '/pool/lobby';
    } else if (gameId === 'caida') {
      path = '/caida/lobby';
    } else {
      return;
    }

    try {
      const url = `${window.location.origin}${path}`;

      if (navigator.share) {
        await navigator.share({
          title: 'MundoXYZ',
          text: 'Únete a esta sala de juego en MundoXYZ',
          url
        });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado al portapapeles');
      } else {
        window.prompt('Copia este link de la sala:', url);
      }
    } catch (error) {
      // El usuario puede cancelar el share; no es un error crítico
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
          games?.map((game) => {
            const isExperimentalGame = game.id === 'pool' || game.id === 'caida';

            // Ocultar Pool y Caída para usuarios que no sean admin/tote
            if (isExperimentalGame && !canSeeExperimentalGames) {
              return null;
            }

            return (
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

                <div className="w-full max-w-xs flex gap-2 justify-center">
                  <button className="flex-1 btn-primary">
                    Jugar Ahora
                  </button>
                  {isExperimentalGame && canSeeExperimentalGames && (
                    <button
                      type="button"
                      className="btn-secondary px-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareGame(game.id);
                      }}
                    >
                      Compartir
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

    </div>
  );
};

export default Games;
