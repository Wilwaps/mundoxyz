import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { motion } from 'framer-motion';
import { ArrowLeft, Ticket, Users, Clock, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

const RaffleDetails = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [selectedNumbers, setSelectedNumbers] = useState(new Set());

  const { data: raffle, isLoading, refetch } = useQuery({
    queryKey: ['raffle', code],
    queryFn: async () => {
      const response = await axios.get(`/raffles/${code}`);
      return response.data;
    },
    refetchInterval: 30000
  });

  const buyNumbersMutation = useMutation({
    mutationFn: async (numbers) => {
      return axios.post(`/raffles/${code}/buy`, { numbers: Array.from(numbers) });
    },
    onSuccess: () => {
      toast.success('¡Números comprados exitosamente!');
      setSelectedNumbers(new Set());
      refetch();
      refreshUser();
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
    
    const totalCost = selectedNumbers.size * (
      raffle.raffle.entry_price_fire || raffle.raffle.entry_price_coin || 0
    );
    
    const currency = raffle.raffle.entry_price_fire > 0 ? 'fires' : 'coins';
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
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

  const myNumbers = raffle.numbers?.filter(n => n.owner_id === user?.id).map(n => n.number_idx) || [];
  const isFree = !raffle.raffle.entry_price_fire && !raffle.raffle.entry_price_coin;

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
          <h1 className="text-xl font-bold text-text">{raffle.raffle.name}</h1>
          <p className="text-sm text-text/60">Código: {raffle.raffle.code}</p>
        </div>
      </div>

      {/* Raffle Info */}
      <div className="card-glass mb-6">
        {raffle.raffle.description && (
          <p className="text-text/80 mb-4">{raffle.raffle.description}</p>
        )}
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold">
              {raffle.raffle.pot_fires > 0 && (
                <span className="text-fire-orange">🔥 {raffle.raffle.pot_fires}</span>
              )}
              {raffle.raffle.pot_coins > 0 && (
                <span className="text-accent">🪙 {raffle.raffle.pot_coins}</span>
              )}
              {isFree && <span className="text-success">Gratis</span>}
            </div>
            <div className="text-xs text-text/60">Premio Acumulado</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-violet">
              {raffle.raffle.numbers_sold}/{raffle.raffle.numbers_range}
            </div>
            <div className="text-xs text-text/60">Números Vendidos</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-text/60">
            <Users size={16} />
            <span>{raffle.raffle.participant_count} participantes</span>
          </div>
          <div className="flex items-center gap-1 text-text/60">
            <Clock size={16} />
            <span>{new Date(raffle.raffle.ends_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="h-3 bg-glass rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-fire-orange to-fire-yellow transition-all duration-500"
              style={{ width: `${(raffle.raffle.numbers_sold / raffle.raffle.numbers_range) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* My Numbers */}
      {myNumbers.length > 0 && (
        <div className="card-glass mb-6">
          <h3 className="text-lg font-bold mb-3">Mis Números ({myNumbers.length})</h3>
          <div className="flex flex-wrap gap-2">
            {myNumbers.map(num => (
              <span key={num} className="badge-fire px-3 py-2">
                #{num.toString().padStart(3, '0')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Number Grid */}
      {raffle.raffle.status === 'active' && (
        <div className="card-glass mb-6">
          <h3 className="text-lg font-bold mb-3">Seleccionar Números</h3>
          
          {!isFree && (
            <div className="mb-4 p-3 bg-glass rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-text/60">Precio por número:</span>
                <span className="font-bold">
                  {raffle.raffle.entry_price_fire > 0 ? `🔥 ${raffle.raffle.entry_price_fire}` :
                   raffle.raffle.entry_price_coin > 0 ? `🪙 ${raffle.raffle.entry_price_coin}` : 'Gratis'}
                </span>
              </div>
              {selectedNumbers.size > 0 && (
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-glass">
                  <span className="text-sm text-text/60">Total a pagar:</span>
                  <span className="font-bold text-fire-orange">
                    {raffle.raffle.entry_price_fire > 0 
                      ? `🔥 ${raffle.raffle.entry_price_fire * selectedNumbers.size}`
                      : `🪙 ${raffle.raffle.entry_price_coin * selectedNumbers.size}`}
                  </span>
                </div>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {raffle.numbers?.map(({ number_idx, state, owner_id }) => {
              const isMine = owner_id === user?.id;
              const isSelected = selectedNumbers.has(number_idx);
              const isAvailable = state === 'available';
              
              return (
                <button
                  key={number_idx}
                  onClick={() => isAvailable && toggleNumber(number_idx)}
                  disabled={!isAvailable || isMine}
                  className={`
                    aspect-square flex items-center justify-center text-xs font-bold rounded-lg transition-all
                    ${isMine ? 'bg-success/30 text-success border-2 border-success cursor-default' :
                      isSelected ? 'bg-accent text-background-dark scale-110' :
                      isAvailable ? 'bg-glass hover:bg-glass-hover text-text/60' :
                      'bg-gray-800 text-gray-600 cursor-not-allowed'}
                  `}
                >
                  {number_idx.toString().padStart(3, '0')}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Participants */}
      <div className="card-glass">
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <TrendingUp size={20} className="text-accent" />
          Top Participantes
        </h3>
        <div className="space-y-2">
          {raffle.participants?.slice(0, 5).map((participant, index) => (
            <div key={participant.user_id} className="glass-panel p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
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
                  <div className="text-xs text-fire-orange">🔥 {participant.fires_spent}</div>
                )}
                {participant.coins_spent > 0 && (
                  <div className="text-xs text-accent">🪙 {participant.coins_spent}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Buy Button */}
      {selectedNumbers.size > 0 && raffle.raffle.status === 'active' && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-background-dark to-transparent">
          <button 
            onClick={handleBuyNumbers}
            disabled={buyNumbersMutation.isPending}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            <Ticket size={20} />
            {buyNumbersMutation.isPending 
              ? 'Comprando...' 
              : `Comprar ${selectedNumbers.size} Número${selectedNumbers.size > 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
};

export default RaffleDetails;
