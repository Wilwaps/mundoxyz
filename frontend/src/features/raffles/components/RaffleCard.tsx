/**
 * Sistema de Rifas V2 - RaffleCard Component
 * Tarjeta de rifa para mostrar en listas y grids
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  Users,
  Clock,
  Tag,
  TrendingUp,
  Calendar,
  Eye,
  Award,
  Building2,
  Globe,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { useCancelRaffle } from '../hooks/useRaffleData';
import { Raffle } from '../types';
import { STATUS_COLORS, STATUS_MESSAGES } from '../constants';

interface RaffleCardProps {
  raffle: Raffle;
  onClick?: () => void;
  variant?: 'default' | 'compact' | 'featured';
  showStats?: boolean;
}

const RaffleCard: React.FC<RaffleCardProps> = ({
  raffle,
  onClick,
  variant = 'default',
  showStats = true
}) => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const cancelRaffle = useCancelRaffle();
  
  // Calcular progreso
  const progress = (raffle.numbersSold / raffle.numbersRange) * 100;
  const remaining = raffle.numbersRange - raffle.numbersSold - raffle.numbersReserved;
  
  // Formatear precio
  const price = raffle.mode === 'fires' 
    ? `${raffle.entryPriceFire} 🔥`
    : raffle.mode === 'coins'
    ? `${raffle.entryPriceCoin} 🪙`
    : 'Premio';
  
  // Formatear pote
  const pot = raffle.mode === 'fires'
    ? `${raffle.potFires.toFixed(0)} 🔥`
    : raffle.mode === 'coins'
    ? `${raffle.potCoins.toFixed(0)} 🪙`
    : 'Ver Premio';
  
  // Determinar color de estado
  const statusColor = STATUS_COLORS[raffle.status] || 'bg-gray-500';
  const statusText = STATUS_MESSAGES[raffle.status] || raffle.status;
  
  // Verificar permisos para cancelar
  const canCancel = user && (
    raffle.hostId === user.id ||
    isAdmin() ||
    (user as any)?.tg_id === '1417856820'
  ) && raffle.status !== 'finished' && raffle.status !== 'cancelled';
  
  // Manejar click
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/raffles/${raffle.code}`);
    }
  };
  
  // Manejar cancelación
  const handleCancelRaffle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const confirmCancel = window.confirm(
      `⚠️ ¿Cancelar "${raffle.name}"?\n\n` +
      'Se reembolsarán todos los compradores.\n' +
      'Esta acción no se puede revertir.'
    );
    
    if (!confirmCancel) return;
    
    try {
      await cancelRaffle.mutateAsync(raffle.code);
      toast.success('Rifa cancelada y compradores reembolsados');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al cancelar');
    }
  };
  
  // Renderizar tarjeta compacta
  if (variant === 'compact') {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        className="bg-glass rounded-lg p-3 cursor-pointer hover:bg-glass-lighter transition-all"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-text truncate">{raffle.name}</h4>
            <div className="flex items-center gap-3 mt-1 text-xs text-text/60">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {raffle.numbersSold}/{raffle.numbersRange}
              </span>
              <span className="text-accent font-semibold">{price}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-text/60">Pote</div>
            <div className="font-bold text-fire-orange">{pot}</div>
          </div>
        </div>
      </motion.div>
    );
  }
  
  // Renderizar tarjeta destacada
  if (variant === 'featured') {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        className="relative bg-gradient-to-br from-accent/20 to-fire-orange/20 rounded-xl overflow-hidden cursor-pointer group"
      >
        {/* Badges y acciones superiores */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          {/* Badge de destacado */}
          <div className="bg-fire-orange text-dark px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <Award className="w-3 h-3" />
            DESTACADA
          </div>
          
          {/* Botón cancelar (si tiene permisos) */}
          {canCancel && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleCancelRaffle}
              disabled={cancelRaffle.isPending}
              className="p-2 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
              title="Cancelar rifa"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </motion.button>
          )}
        </div>
        
        {/* Logo de empresa si existe */}
        {raffle.companyConfig?.logoUrl && (
          <div className="absolute top-3 left-3 z-10">
            <img
              src={raffle.companyConfig.logoUrl}
              alt={raffle.companyConfig.companyName}
              className="w-12 h-12 rounded-lg bg-white/10 backdrop-blur object-cover"
            />
          </div>
        )}
        
        <div className="p-6">
          {/* Header */}
          <div className="mb-4">
            <h3 className="text-2xl font-bold text-text mb-1">{raffle.name}</h3>
            {raffle.description && (
              <p className="text-text/80 text-sm line-clamp-2">{raffle.description}</p>
            )}
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-xs text-text/60 mb-1">Precio</div>
              <div className="font-bold text-lg text-accent">{price}</div>
            </div>
            <div>
              <div className="text-xs text-text/60 mb-1">Pote Actual</div>
              <div className="font-bold text-lg text-fire-orange">{pot}</div>
            </div>
            <div>
              <div className="text-xs text-text/60 mb-1">Disponibles</div>
              <div className="font-bold text-lg text-text">{remaining}</div>
            </div>
          </div>
          
          {/* Progreso */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-text/60 mb-1">
              <span>Progreso</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-glass rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-accent to-fire-orange"
              />
            </div>
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-text/60">
              <Clock className="w-3 h-3" />
              {raffle.endsAt ? (
                <span>Termina {new Date(raffle.endsAt).toLocaleDateString()}</span>
              ) : (
                <span>Sin fecha límite</span>
              )}
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn-primary px-4 py-2 text-sm"
            >
              Participar
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }
  
  // Renderizar tarjeta default
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className="bg-glass rounded-xl overflow-hidden cursor-pointer hover:bg-glass-lighter transition-all"
    >
      {/* Header con estado */}
      <div className="relative p-4 pb-0">
        {/* Botones de acción superior */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {/* Badge de estado */}
          <div className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
            {statusText}
          </div>
          
          {/* Botón cancelar (si tiene permisos) */}
          {canCancel && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleCancelRaffle}
              disabled={cancelRaffle.isPending}
              className="p-1.5 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
              title="Cancelar rifa"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </motion.button>
          )}
        </div>
        
        {/* Tipo de rifa */}
        <div className="flex items-center gap-2 mb-2">
          {raffle.visibility === 'company' ? (
            <>
              <Building2 className="w-4 h-4 text-accent" />
              <span className="text-xs text-accent">Empresa</span>
            </>
          ) : raffle.visibility === 'private' ? (
            <>
              <Eye className="w-4 h-4 text-text/60" />
              <span className="text-xs text-text/60">Privada</span>
            </>
          ) : (
            <>
              <Globe className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-500">Pública</span>
            </>
          )}
        </div>
        
        {/* Título y host */}
        <h3 className="font-bold text-lg text-text mb-1">{raffle.name}</h3>
        <p className="text-sm text-text/60">por @{raffle.hostUsername}</p>
      </div>
      
      {/* Descripción si existe */}
      {raffle.description && (
        <div className="px-4 py-2">
          <p className="text-sm text-text/80 line-clamp-2">{raffle.description}</p>
        </div>
      )}
      
      {/* Stats */}
      <div className="p-4 space-y-3">
        {/* Precio y Pote */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-text/60" />
            <span className="text-sm text-text/80">Precio:</span>
            <span className="font-semibold text-accent">{price}</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-fire-orange" />
            <span className="font-bold text-fire-orange">{pot}</span>
          </div>
        </div>
        
        {/* Progreso de venta */}
        <div>
          <div className="flex justify-between text-xs text-text/60 mb-1">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {raffle.numbersSold} vendidos
            </span>
            <span>{remaining} disponibles</span>
          </div>
          <div className="h-2 bg-dark/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-accent to-fire-orange"
            />
          </div>
        </div>
        
        {/* Info adicional */}
        <div className="flex items-center justify-between text-xs text-text/60">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {raffle.createdAt && new Date(raffle.createdAt).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {progress.toFixed(0)}% completado
          </span>
        </div>
      </div>
      
      {/* Footer con CTA */}
      {showStats && (
        <div className="px-4 pb-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            className="w-full btn-primary py-2 text-sm font-semibold"
          >
            Ver Detalles
          </motion.button>
        </div>
      )}
    </motion.div>
  );
};

export default RaffleCard;
