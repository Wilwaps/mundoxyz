import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { motion } from 'framer-motion';
import { ArrowLeft, Ticket, Users, Clock, TrendingUp, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const RaffleDetails = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [selectedNumbers, setSelectedNumbers] = useState(new Set());

  const { data: raffleData, isLoading, refetch } = useQuery({
    queryKey: ['raffle', code],
    queryFn: async () => {
      const response = await axios.get(`/api/raffles/${code}`);
      return response.data;
    },
    refetchInterval: 30000
  });

  const raffle = raffleData?.data || raffleData;

  const buyNumbersMutation = useMutation({
    mutationFn: async (numbers) => {
      return axios.post(`/api/raffles/purchase`, { 
        raffle_id: raffle?.id,
        numbers: Array.from(numbers) 
      });
    },
    onSuccess: () => {
      toast.success('¡Números comprados exitosamente!');
      setSelectedNumbers(new Set());
      refetch();
      refreshUser();
      queryClient.invalidateQueries(['user-stats', user.id]);
      queryClient.invalidateQueries(['raffles']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al comprar números');
    }
  });

  const toggleNumber = (number) => {
    const newSelected = new Set(selectedNumbers);
    if (newSelected.has(number)) {
      newSelected.delete(number);
    } else {
      newSelected.add(number);
    }
    setSelectedNumbers(newSelected);
  };

  const handleBuyNumbers = () => {
    if (selectedNumbers.size === 0) {
      toast.error('Selecciona al menos un número');
      return;
    }
    
    const totalCost = selectedNumbers.size * (raffle?.cost_per_number || 10);
    
    const normalizedMode = raffle?.mode === 'fire' ? 'fires' : raffle?.mode;
    const currency = normalizedMode === 'fires' ? 'fires' : 'coins';
    const balance = currency === 'fires' ? user?.fires_balance : user?.coins_balance;
    
    if (totalCost > balance) {
      toast.error(`Saldo insuficiente. Necesitas ${totalCost} ${currency === 'fires' ? '🔥' : '🪙'}`);
      return;
    }
    
    if (window.confirm(`¿Comprar ${selectedNumbers.size} número(s) por ${totalCost} ${currency === 'fires' ? '🔥' : '🪙'}?`)) {
      buyNumbersMutation.mutate(selectedNumbers);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 pb-24 space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-glass rounded-lg"></div>
          <div className="flex-1 space-y-2">
            <div className="h-6 bg-glass rounded w-3/4"></div>
            <div className="h-4 bg-glass rounded w-1/2"></div>
          </div>
        </div>
        
        {/* Info Card Skeleton */}
        <div className="card-glass space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="h-8 bg-glass rounded"></div>
              <div className="h-4 bg-glass rounded w-3/4 mx-auto"></div>
            </div>
            <div className="space-y-2">
              <div className="h-8 bg-glass rounded"></div>
              <div className="h-4 bg-glass rounded w-3/4 mx-auto"></div>
            </div>
          </div>
          <div className="h-3 bg-glass rounded-full"></div>
        </div>
        
        {/* Grid Skeleton */}
        <div className="card-glass">
          <div className="h-6 bg-glass rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-10 gap-2">
            {Array.from({ length: 50 }).map((_, i) => (
              <div key={i} className="aspect-square bg-glass rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!raffle) {
    return (
      <div className="p-4 text-center">
        <p className="text-text/60">Rifa no encontrada</p>
        <button onClick={() => navigate('/raffles')} className="btn-primary mt-4">
          Volver a Rifas
        </button>
      </div>
    );
  }

  const myNumbers = raffle?.numbers?.filter(n => n.owner_id === user?.id).map(n => n.number_idx) || [];
  const isFree = false; // Todas las rifas tienen costo mínimo

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/raffles')}
          className="p-2 rounded-lg bg-glass hover:bg-glass-hover transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-text">{raffle?.name}</h1>
          <p className="text-sm text-text/60">Código: {raffle?.code}</p>
        </div>
      </div>

      {/* Raffle Info */}
      <div className="card-glass mb-6">
        {raffle?.description && (
          <p className="text-text/80 mb-4">{raffle.description}</p>
        )}
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold">
              {(raffle?.pot_fires || 0) > 0 && (
                <span className="text-fire-orange">🔥 {raffle.pot_fires}</span>
              )}
              {(raffle?.pot_coins || 0) > 0 && (
                <span className="text-accent">🪙 {raffle.pot_coins}</span>
              )}
              {isFree && <span className="text-success">Gratis</span>}
            </div>
            <div className="text-xs text-text/60">Premio Acumulado</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-violet">
              {raffle?.purchased_count || 0}/{raffle?.numbers_range || '?'}
            </div>
            <div className="text-xs text-text/60">Números Vendidos</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-text/60">
            <Users size={16} />
            <span>{raffle?.participants?.length || 0} participantes</span>
          </div>
          {raffle?.ends_at && (
            <div className="flex items-center gap-1 text-text/60">
              <Clock size={16} />
              <span>{new Date(raffle.ends_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="h-3 bg-glass rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-fire-orange to-fire-yellow transition-all duration-500"
              style={{ width: `${((raffle?.purchased_count || 0) / (raffle?.numbers_range || 100)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* My Numbers */}
      {myNumbers.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-glass mb-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-2 border-blue-500/20"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Ticket className="text-blue-400" size={20} />
              Mis Números
            </h3>
            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-bold">
              {myNumbers.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {myNumbers.map(num => (
              <motion.span 
                key={num} 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.1 }}
                className="px-4 py-2 bg-gradient-to-br from-blue-500 to-purple-500 text-white rounded-lg font-bold shadow-lg"
              >
                #{num.toString().padStart(3, '0')}
              </motion.span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Number Grid */}
      {raffle?.status === 'active' && (
        <div className="card-glass mb-6">
          <h3 className="text-lg font-bold mb-3">Seleccionar Números</h3>
          
          {!isFree && (
            <div className="mb-4 p-3 bg-glass rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-text/60">Precio por número:</span>
                <span className="font-bold">
                  {(raffle?.mode === 'fires' || raffle?.mode === 'fire') ? `🔥 ${raffle?.cost_per_number || 10}` : `🪙 ${raffle?.cost_per_number || 10}`}
                </span>
              </div>
              {selectedNumbers.size > 0 && (
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-glass">
                  <span className="text-sm text-text/60">Total a pagar:</span>
                  <span className="font-bold text-fire-orange">
                    {(raffle?.mode === 'fires' || raffle?.mode === 'fire') 
                      ? `🔥 ${(raffle?.cost_per_number || 10) * selectedNumbers.size}`
                      : `🪙 ${(raffle?.cost_per_number || 10) * selectedNumbers.size}`}
                  </span>
                </div>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {raffle?.numbers?.map(({ number_idx, state, owner_id }) => {
              const isMine = owner_id === user?.id;
              const isSelected = selectedNumbers.has(number_idx);
              const isAvailable = state === 'available';
              
              return (
                <motion.button
                  key={number_idx}
                  onClick={() => isAvailable && toggleNumber(number_idx)}
                  disabled={!isAvailable || isMine}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={isAvailable ? { scale: 1.1, rotate: 2 } : {}}
                  whileTap={isAvailable ? { scale: 0.95 } : {}}
                  className={`
                    aspect-square flex items-center justify-center text-xs font-bold rounded-lg transition-all duration-200
                    ${isMine ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white border-2 border-green-400 cursor-default shadow-lg' :
                      isSelected ? 'bg-gradient-to-br from-accent to-purple-500 text-white scale-110 shadow-xl ring-2 ring-accent/50' :
                      isAvailable ? 'bg-glass hover:bg-gradient-to-br hover:from-glass-hover hover:to-glass text-text/80 hover:text-white hover:shadow-lg' :
                      'bg-gray-800/50 text-gray-600 cursor-not-allowed opacity-50'}
                  `}
                >
                  {number_idx.toString().padStart(3, '0')}
                  {isMine && <Check className="absolute top-0.5 right-0.5" size={10} />}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Participants */}
      {raffle?.participants && raffle.participants.length > 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="card-glass"
        >
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <TrendingUp size={20} className="text-accent" />
            Top Participantes
          </h3>
          <div className="space-y-2">
            {raffle.participants.slice(0, 5).map((participant, index) => (
              <motion.div 
                key={participant.user_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass-panel p-3 flex items-center justify-between hover:bg-glass-hover transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                    index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400' :
                    index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                    'bg-gradient-to-br from-primary to-accent'
                  }`}>
                    <span className="text-xs font-bold text-background-dark">
                      {index + 1}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-text">{participant.username}</div>
                    <div className="text-xs text-text/60">
                      {participant.numbers_count} número{participant.numbers_count > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {participant.fires_spent > 0 && (
                    <div className="text-xs text-fire-orange font-bold">🔥 {participant.fires_spent}</div>
                  )}
                  {participant.coins_spent > 0 && (
                    <div className="text-xs text-accent font-bold">🪙 {participant.coins_spent}</div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Buy Button */}
      {selectedNumbers.size > 0 && raffle?.status === 'active' && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-background-dark via-background-dark/95 to-transparent backdrop-blur-sm"
        >
          <motion.button 
            onClick={handleBuyNumbers}
            disabled={buyNumbersMutation.isPending}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-gradient-to-r from-fire-orange via-fire-yellow to-fire-orange text-background-dark font-bold py-4 rounded-xl shadow-2xl flex items-center justify-center gap-3 relative overflow-hidden"
          >
            {/* Animated background */}
            <motion.div
              className="absolute inset-0 bg-white/20"
              animate={{
                x: ['-100%', '100%']
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'linear'
              }}
            />
            <Ticket size={24} className="relative z-10" />
            <span className="relative z-10">
              {buyNumbersMutation.isPending 
                ? 'Procesando compra...' 
                : `Comprar ${selectedNumbers.size} número${selectedNumbers.size > 1 ? 's' : ''}`}
            </span>
            {!buyNumbersMutation.isPending && (
              <Check size={24} className="relative z-10" />
            )}
          </motion.button>
        </motion.div>
      )}
    </div>
  );
};

export default RaffleDetails;
