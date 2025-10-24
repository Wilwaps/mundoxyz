import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Plus, Ticket, Clock, Users, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

const Raffles = () => {
  const navigate = useNavigate();

  const { data: raffles, isLoading } = useQuery({
    queryKey: ['raffles'],
    queryFn: async () => {
      const response = await axios.get('/raffles');
      return response.data;
    },
    refetchInterval: 30000
  });

  const handleCreateRaffle = () => {
    toast.info('Creación de rifas próximamente');
  };

  const formatTimeRemaining = (endsAt) => {
    const end = new Date(endsAt);
    const now = new Date();
    const diff = end - now;
    
    if (diff <= 0) return 'Finalizada';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} día${days > 1 ? 's' : ''}`;
    return `${hours} hora${hours > 1 ? 's' : ''}`;
  };

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold text-center mb-8 text-gradient-fire">Rifas</h1>
      
      {/* Create Raffle Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleCreateRaffle}
        className="w-full btn-primary flex items-center justify-center gap-2 mb-6"
      >
        <Plus size={20} />
        Crear Rifa
      </motion.button>

      {/* Active Raffles */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="spinner mx-auto"></div>
          </div>
        ) : raffles?.length > 0 ? (
          raffles.map((raffle) => (
            <motion.div
              key={raffle.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              className="card-glass cursor-pointer"
              onClick={() => navigate(`/raffles/${raffle.code}`)}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-bold text-text">{raffle.name}</h3>
                  {raffle.description && (
                    <p className="text-sm text-text/60 mt-1">{raffle.description}</p>
                  )}
                </div>
                <span className="badge-fire">
                  {raffle.code}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
                <div className="text-center">
                  <div className="text-text/60">Premio</div>
                  <div className="font-bold">
                    {raffle.pot_fires > 0 && <span className="text-fire-orange">🔥 {raffle.pot_fires}</span>}
                    {raffle.pot_coins > 0 && <span className="text-accent ml-2">🪙 {raffle.pot_coins}</span>}
                    {!raffle.pot_fires && !raffle.pot_coins && <span className="text-success">Gratis</span>}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-text/60">Números</div>
                  <div className="font-bold text-violet">
                    {raffle.numbers_sold}/{raffle.numbers_range}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-text/60">Termina</div>
                  <div className="font-bold text-accent">
                    {formatTimeRemaining(raffle.ends_at)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-text/60">
                <div className="flex items-center gap-1">
                  <Users size={14} />
                  <span>{raffle.participant_count || 0} participantes</span>
                </div>
                <div>
                  Host: {raffle.host_username}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3">
                <div className="h-2 bg-glass rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-fire-orange to-fire-yellow transition-all duration-500"
                    style={{ width: `${(raffle.numbers_sold / raffle.numbers_range) * 100}%` }}
                  />
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-8 card-glass">
            <Ticket size={48} className="mx-auto mb-3 text-text/30" />
            <p className="text-text/60">No hay rifas activas</p>
            <p className="text-sm text-text/40 mt-2">¡Crea la primera rifa del día!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Raffles;
