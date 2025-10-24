import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, Play, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const BingoRoom = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [selectedNumbers, setSelectedNumbers] = useState(new Set());

  const { data: room, isLoading } = useQuery({
    queryKey: ['bingo-room', code],
    queryFn: async () => {
      const response = await axios.get(`/games/bingo/room/${code}`);
      return response.data;
    },
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  const handleNumberClick = (number) => {
    if (number === 'FREE') return;
    
    const newSelected = new Set(selectedNumbers);
    if (newSelected.has(number)) {
      newSelected.delete(number);
    } else {
      newSelected.add(number);
    }
    setSelectedNumbers(newSelected);
  };

  const renderBingoCard = (card) => {
    const cardData = JSON.parse(card.card_data);
    
    return (
      <div className="glass-panel p-4">
        <div className="text-center mb-2 text-sm text-text/60">
          Cartón #{card.card_number}
        </div>
        <div className="grid grid-cols-5 gap-1">
          {['B', 'I', 'N', 'G', 'O'].map((letter, index) => (
            <div key={letter} className="text-center font-bold text-accent text-xs mb-1">
              {letter}
            </div>
          ))}
          {cardData.map((column, colIndex) => 
            column.map((number, rowIndex) => {
              const isDrawn = room?.room?.numbers_drawn?.includes(number);
              const isSelected = selectedNumbers.has(number);
              const isFree = number === 'FREE';
              
              return (
                <button
                  key={`${colIndex}-${rowIndex}`}
                  onClick={() => handleNumberClick(number)}
                  className={`
                    aspect-square flex items-center justify-center text-sm font-semibold rounded
                    ${isFree ? 'bg-success/30 text-success cursor-default' :
                      isSelected ? 'bg-accent/30 text-accent border-2 border-accent' :
                      isDrawn ? 'bg-fire-orange/20 text-fire-orange' :
                      'bg-glass text-text/60 hover:bg-glass-hover'}
                    transition-all duration-200
                  `}
                  disabled={isFree}
                >
                  {isFree ? 'FREE' : number}
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="p-4 text-center">
        <p className="text-text/60">Sala no encontrada</p>
        <button onClick={() => navigate('/games')} className="btn-primary mt-4">
          Volver a Juegos
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/games')}
          className="p-2 rounded-lg bg-glass hover:bg-glass-hover transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-text">{room.room.name}</h1>
          <p className="text-sm text-text/60">Código: {room.room.code}</p>
        </div>
      </div>

      {/* Room Info */}
      <div className="card-glass mb-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-accent">{room.room.current_players}</div>
            <div className="text-xs text-text/60">Jugadores</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-fire-orange">
              {room.room.pot_fires > 0 ? `🔥 ${room.room.pot_fires}` :
               room.room.pot_coins > 0 ? `🪙 ${room.room.pot_coins}` : 'Gratis'}
            </div>
            <div className="text-xs text-text/60">Premio</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-violet">{room.room.ball_count}</div>
            <div className="text-xs text-text/60">Bolas</div>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className={`mb-6 p-3 rounded-lg text-center ${
        room.room.status === 'waiting' ? 'bg-warning/20 border border-warning/30' :
        room.room.status === 'playing' ? 'bg-success/20 border border-success/30' :
        'bg-info/20 border border-info/30'
      }`}>
        <p className={`text-sm font-semibold ${
          room.room.status === 'waiting' ? 'text-warning' :
          room.room.status === 'playing' ? 'text-success' :
          'text-info'
        }`}>
          {room.room.status === 'waiting' ? 'Esperando jugadores...' :
           room.room.status === 'playing' ? '¡Juego en progreso!' :
           room.room.status === 'finished' ? 'Juego terminado' :
           'Preparando...'}
        </p>
      </div>

      {/* Current Number */}
      {room.room.status === 'playing' && room.room.current_number && (
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="card-glass mb-6 text-center"
        >
          <p className="text-sm text-text/60 mb-2">Número actual</p>
          <div className="text-6xl font-bold text-gradient-fire">
            {room.room.current_number}
          </div>
        </motion.div>
      )}

      {/* Numbers Drawn */}
      {room.room.numbers_drawn?.length > 0 && (
        <div className="card-glass mb-6">
          <h3 className="text-sm font-semibold text-text/60 mb-2">
            Números cantados ({room.room.numbers_drawn.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {room.room.numbers_drawn.map((num) => (
              <span
                key={num}
                className={`w-10 h-10 flex items-center justify-center rounded-full text-sm font-bold ${
                  num === room.room.current_number 
                    ? 'bg-fire-orange text-background-dark shadow-fire' 
                    : 'bg-glass text-text/60'
                }`}
              >
                {num}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* My Cards */}
      {room.my_cards?.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-bold mb-4">Mis Cartones</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {room.my_cards.map((card) => (
              <div key={card.id}>
                {renderBingoCard(card)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Players */}
      <div className="card-glass">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Users size={20} className="text-accent" />
          Jugadores ({room.players.length})
        </h3>
        <div className="space-y-2">
          {room.players.map((player) => (
            <div key={player.id} className="glass-panel p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <span className="text-xs font-bold text-background-dark">
                    {player.username?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-text">
                    {player.username}
                    {player.is_host && (
                      <span className="ml-2 text-xs text-fire-orange">Host</span>
                    )}
                  </div>
                  <div className="text-xs text-text/60">
                    {player.cards_count} cartón{player.cards_count > 1 ? 'es' : ''}
                  </div>
                </div>
              </div>
              {player.is_ready && (
                <Check size={16} className="text-success" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      {room.is_host && room.room.status === 'waiting' && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-background-dark to-transparent">
          <button className="w-full btn-primary flex items-center justify-center gap-2">
            <Play size={20} />
            Iniciar Juego
          </button>
        </div>
      )}

      {room.is_host && room.room.status === 'playing' && (
        <button 
          className="fixed bottom-24 right-4 w-16 h-16 bg-gradient-to-r from-fire-orange to-fire-yellow rounded-full shadow-fire flex items-center justify-center"
          onClick={() => toast.info('Función de cantar próximamente')}
        >
          <span className="text-2xl font-bold text-background-dark">!</span>
        </button>
      )}
    </div>
  );
};

export default BingoRoom;
