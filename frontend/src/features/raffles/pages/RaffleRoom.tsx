/**
 * Sistema de Rifas V2 - RaffleRoom Page
 * Sala individual de rifa con grilla de números y detalles
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Users,
  Trophy,
  Clock,
  Calendar,
  Share2,
  Settings,
  ShoppingCart,
  AlertCircle,
  CheckCircle,
  XCircle,
  Zap,
  TrendingUp,
  Info,
  DollarSign,
  Sparkles,
  Trash2,
  Hand,
  Crown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { useSocket } from '../../../contexts/SocketContext';
import { useRaffle, useReserveNumber, usePurchaseNumber, useCancelRaffle } from '../hooks/useRaffleData';
import NumberGrid from '../components/NumberGrid';
import PurchaseModal from '../components/PurchaseModal';
import { RaffleStatus, RaffleMode, NumberState, DrawMode } from '../types';
import { formatDate, formatCurrency } from '../../../utils/format';

interface RaffleRoomProps {}

const RaffleRoom: React.FC<RaffleRoomProps> = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'numbers' | 'info' | 'winners'>('numbers');
  const refreshTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // Query de la sala
  const raffleData = useRaffle(code || '');
  const raffle = raffleData.raffle;
  const numbers = raffleData.numbers;
  const winner = raffleData.winner;
  const isLoading = raffleData.isLoading;
  const error = raffleData.error;
  
  // Debounced refetch para evitar múltiples actualizaciones simultáneas
  const debouncedRefetch = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    
    refreshTimerRef.current = setTimeout(() => {
      raffleData.forceRefresh();
    }, 300); // 300ms debounce
  }, [raffleData.forceRefresh]);
  
  // Cleanup del timer al desmontar
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);
  
  // Mutations
  const reserveNumbers = useReserveNumber();
  const purchaseNumbers = usePurchaseNumber();
  const cancelRaffle = useCancelRaffle();
  
  // Conectar a socket room
  useEffect(() => {
    if (socket && code) {
      socket.emit('raffle:join_room', { code });
      
      // Listeners de eventos
      socket.on('raffle:number_reserved', handleNumberReserved);
      socket.on('raffle:number_released', handleNumberReleased);
      socket.on('raffle:number_purchased', handleNumberPurchased);
      socket.on('raffle:status_changed', handleStatusChanged);
      socket.on('raffle:winner_drawn', handleWinnerDrawn);
      socket.on('raffle:cancelled', handleRaffleCancelled);
      
      return () => {
        socket.emit('raffle:leave_room', { code });
        socket.off('raffle:number_reserved');
        socket.off('raffle:number_released');
        socket.off('raffle:number_purchased');
        socket.off('raffle:status_changed');
        socket.off('raffle:winner_drawn');
        socket.off('raffle:cancelled');
      };
    }
  }, [socket, code]);
  
  // Manejadores de eventos socket - optimizados para no refrescar en eventos propios
  const handleNumberReserved = useCallback((data: any) => {
    console.log('Number reserved:', data);
    // Solo refrescar si no es el usuario actual
    if (data.userId !== user?.id) {
      debouncedRefetch();
    }
  }, [debouncedRefetch, user]);
  
  const handleNumberReleased = useCallback((data: any) => {
    console.log('Number released:', data);
    // Siempre refrescar cuando se liberen números
    debouncedRefetch();
  }, [debouncedRefetch]);
  
  const handleNumberPurchased = useCallback((data: any) => {
    console.log('Number purchased:', data);
    // Refrescar solo si es otro usuario
    if (data.userId !== user?.id) {
      debouncedRefetch();
      toast(`Número ${data.number} vendido`, { icon: '🎫' });
    } else {
      // Para el usuario actual, forzar refresh inmediato
      raffleData.forceRefresh();
      toast.success(`¡Compraste el número ${data.number}!`);
    }
  }, [debouncedRefetch, raffleData, user]);
  
  const handleStatusChanged = useCallback((data: any) => {
    console.log('Status changed:', data);
    raffleData.forceRefresh();
    if (data.status === 'finished') {
      toast.success('¡La rifa ha finalizado!');
      // Limpiar selección
      setSelectedNumbers([]);
    }
  }, [raffleData]);
  
  const handleWinnerDrawn = useCallback((data: any) => {
    console.log('Winner drawn:', data);
    raffleData.forceRefresh();
    if (data.winnerId === user?.id) {
      toast.success('🎉 ¡FELICIDADES! ¡Has ganado la rifa! 🎉', {
        duration: 10000,
        icon: '🏆'
      });
    } else {
      toast.success(`El ganador es: ${data.winnerName}`);
    }
  }, [raffleData, user]);
  
  const handleRaffleCancelled = useCallback((data: any) => {
    console.log('Raffle cancelled:', data);
    toast.error('⚠️ Esta rifa ha sido cancelada. Serás reembolsado automáticamente.', {
      duration: 6000
    });
    setTimeout(() => {
      navigate('/raffles');
    }, 3000);
  }, [navigate]);
  
  // Manejar selección de números
  const handleNumberClick = (number: number) => {
    if (!user) {
      toast.error('Debes iniciar sesión para seleccionar números');
      return;
    }
    
    const numberData = numbers?.find((n: any) => n.idx === number);
    
    if (numberData?.state === NumberState.SOLD) {
      if (numberData.ownerId === user.id) {
        toast('Ya compraste este número', { icon: '✅' });
      } else {
        toast.error('Este número ya fue vendido');
      }
      return;
    }
    
    if (numberData?.state === NumberState.RESERVED && numberData.ownerId !== user.id) {
      toast.error('Este número está reservado por otro usuario');
      return;
    }
    
    setSelectedNumbers(prev => {
      if (prev.includes(number)) {
        return prev.filter(n => n !== number);
      } else {
        // Límite flexible: máximo 50 números por compra
        const MAX_NUMBERS_PER_PURCHASE = 50;
        if (prev.length >= MAX_NUMBERS_PER_PURCHASE) {
          toast.error(`Máximo ${MAX_NUMBERS_PER_PURCHASE} números por compra`);
          return prev;
        }
        return [...prev, number];
      }
    });
  };
  
  // Proceder a compra - OPTIMIZADO: reserva batch
  const handleProceedToPurchase = async () => {
    if (selectedNumbers.length === 0) {
      toast.error('Selecciona al menos un número');
      return;
    }
    
    // Verificar que la rifa sigue activa
    if (!raffle || raffle.status !== RaffleStatus.ACTIVE) {
      toast.error('Esta rifa ya no está disponible');
      setSelectedNumbers([]);
      return;
    }
    
    const toastId = toast.loading(`Reservando ${selectedNumbers.length} número${selectedNumbers.length > 1 ? 's' : ''}...`);
    
    try {
      // Reservar números individualmente pero con manejo de errores mejorado
      let reservedCount = 0;
      const failedNumbers: number[] = [];
      
      for (const num of selectedNumbers) {
        try {
          await reserveNumbers.mutateAsync({
            code: code!,
            idx: num
          });
          reservedCount++;
        } catch (err: any) {
          console.error(`Error reservando número ${num}:`, err);
          failedNumbers.push(num);
          
          // Si la rifa no existe, detener todo
          if (err.response?.status === 404 || err.response?.data?.code === 'NOT_FOUND') {
            toast.error('Esta rifa ya no existe o fue eliminada', { id: toastId });
            setTimeout(() => navigate('/raffles'), 2000);
            return;
          }
        }
      }
      
      if (failedNumbers.length > 0) {
        toast.error(
          `No se pudieron reservar ${failedNumbers.length} número${failedNumbers.length > 1 ? 's' : ''}: ${failedNumbers.join(', ')}`,
          { id: toastId, duration: 5000 }
        );
        // Remover números que no se pudieron reservar
        setSelectedNumbers(prev => prev.filter(n => !failedNumbers.includes(n)));
      }
      
      if (reservedCount > 0) {
        toast.success(`${reservedCount} número${reservedCount > 1 ? 's' : ''} reservado${reservedCount > 1 ? 's' : ''}`, { id: toastId });
        setShowPurchaseModal(true);
      } else {
        toast.error('No se pudo reservar ningún número', { id: toastId });
      }
      
    } catch (error: any) {
      console.error('Error en handleProceedToPurchase:', error);
      toast.error('Error al reservar números', { id: toastId });
    }
  };
  
  // Compartir rifa
  const shareRaffle = (platform: 'whatsapp' | 'telegram' | 'copy') => {
    const shareUrl = `${window.location.origin}/raffles/${code}`;
    const shareText = `¡Participa en la rifa "${raffle?.name}"! 🎉\n\nPremio: ${raffle?.prizeMeta?.prizeDescription || 'Increíble premio'}\nNúmeros disponibles: ${availableNumbers}\n\nÚnete aquí:`;
    
    switch (platform) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`);
        break;
      case 'telegram':
        window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`);
        break;
      case 'copy':
        navigator.clipboard.writeText(shareUrl);
        toast.success('Enlace copiado al portapapeles');
        break;
    }
    
    setShowShareMenu(false);
  };
  
  // Cancelar rifa
  const handleCancelRaffle = async () => {
    if (!code) return;
    
    const confirmCancel = window.confirm(
      '⚠️ ¿Estás seguro de cancelar esta rifa?\n\n' +
      'Esto hará lo siguiente:\n' +
      '• Se reembolsarán todos los compradores desde el pot\n' +
      '• La rifa quedará marcada como CANCELADA\n' +
      '• No se podrá revertir esta acción\n\n' +
      '¿Deseas continuar?'
    );
    
    if (!confirmCancel) return;
    
    try {
      await cancelRaffle.mutateAsync(code);
      toast.success('Rifa cancelada exitosamente. Todos los compradores fueron reembolsados.');
      setTimeout(() => navigate('/raffles'), 2000);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al cancelar la rifa');
    }
  };
  
  // Elegir ganador manualmente (solo modo manual)
  const [isDrawing, setIsDrawing] = useState(false);
  const handleDrawWinner = async () => {
    if (!code) return;
    
    const confirmDraw = window.confirm(
      '🎯 ¿Deseas elegir el ganador ahora?\n\n' +
      'Esto hará lo siguiente:\n' +
      '• Se elegirá un ganador al azar de todos los números vendidos\n' +
      '• Se distribuirán los premios automáticamente\n' +
      '• La rifa quedará marcada como FINALIZADA\n' +
      '• No se podrá revertir esta acción\n\n' +
      '¿Deseas continuar?'
    );
    
    if (!confirmDraw) return;
    
    setIsDrawing(true);
    try {
      const response = await fetch(`/api/raffles/v2/${code}/draw-winner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al elegir ganador');
      }
      
      const data = await response.json();
      toast.success('¡Ganador elegido exitosamente! 🎉');
      
      // Recargar datos de la rifa
      raffleData.forceRefresh();
      
      // Opcional: Mostrar notificación con el ganador
      if (data.winner) {
        setTimeout(() => {
          toast.success(`Número ganador: ${data.winner.number}`, { duration: 5000 });
        }, 1000);
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al elegir ganador');
    } finally {
      setIsDrawing(false);
    }
  };
  
  // Calcular estadísticas desde los datos del hook
  const soldNumbers = numbers?.filter((n: any) => n.state === 'sold').length || 0;
  const reservedNumbers = numbers?.filter((n: any) => n.state === 'reserved').length || 0;
  const totalNumbers = raffle?.numbersRange || 0;
  const availableNumbers = totalNumbers - soldNumbers - reservedNumbers;
  const progress = totalNumbers > 0 ? Math.round((soldNumbers / totalNumbers) * 100) : 0;
  
  const stats = {
    totalNumbers,
    soldNumbers,
    reservedNumbers,
    availableNumbers,
    progress,
    totalPot: raffle?.potFires || raffle?.potCoins || 0,
    myNumbers: raffleData.userNumbers?.length || 0
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark via-dark to-dark/95 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full animate-spin mb-4"></div>
          <p className="text-text/60">Cargando rifa...</p>
        </div>
      </div>
    );
  }
  
  if (error || !raffle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark via-dark to-dark/95 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-text mb-2">Rifa no encontrada</h2>
          <p className="text-text/60 mb-6">La rifa que buscas no existe o ha sido eliminada</p>
          <button
            onClick={() => navigate('/raffles')}
            className="btn-primary px-6 py-2"
          >
            Volver a Rifas
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-dark via-dark to-dark/95 pb-64"
    >
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-glass rounded-2xl p-6 mb-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <button
                onClick={() => navigate('/raffles')}
                className="p-2 bg-glass/50 rounded-lg hover:bg-glass transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-text" />
              </button>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-text">
                    {raffle.name}
                  </h1>
                  {raffle.status === 'active' && (
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">
                      ACTIVA
                    </span>
                  )}
                  {raffle.status === 'pending' && (
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full font-medium">
                      PENDIENTE
                    </span>
                  )}
                  {raffle.status === 'finished' && (
                    <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full font-medium">
                      FINALIZADA
                    </span>
                  )}
                </div>
                
                <p className="text-text/60 mb-3">{raffle.description}</p>
                
                <div className="flex flex-wrap items-center gap-4 text-sm text-text/80">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>Creada {formatDate(raffle.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{soldNumbers} participantes</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Trophy className="w-4 h-4" />
                    <span>Código: {raffle.code}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Acciones */}
            <div className="flex gap-2">
              {/* Botón elegir ganador manual - Solo host, modo manual, todos vendidos */}
              {user?.id === raffle.hostId &&
                raffle.drawMode === 'manual' &&
                raffle.status === RaffleStatus.ACTIVE &&
                soldNumbers === totalNumbers &&
                totalNumbers > 0 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDrawWinner}
                  disabled={isDrawing}
                  className="px-4 py-2 bg-gradient-to-r from-accent to-fire-orange rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2 text-sm font-bold text-dark"
                  title="Elegir ganador manualmente"
                >
                  <Hand className="w-5 h-5" />
                  <span>{isDrawing ? 'Eligiendo...' : 'Elegir Ganador'}</span>
                  {!isDrawing && <Sparkles className="w-4 h-4" />}
                </motion.button>
              )}
              
              {/* Botón cancelar rifa - Posición destacada */}
              {(user?.id === raffle.hostId || 
                user?.roles?.includes('admin') || 
                user?.roles?.includes('Tote') ||
                (user as any)?.tg_id === '1417856820') &&
                raffle.status !== RaffleStatus.FINISHED &&
                raffle.status !== RaffleStatus.CANCELLED && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCancelRaffle}
                  disabled={cancelRaffle.isPending}
                  className="px-3 py-2 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-medium text-red-400"
                  title="Cancelar rifa y reembolsar compradores"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Cancelar Rifa</span>
                </motion.button>
              )}
              
              {/* Botón compartir */}
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  className="p-2 bg-glass/50 rounded-lg hover:bg-glass transition-colors"
                >
                  <Share2 className="w-5 h-5 text-text" />
                </motion.button>
                
                <AnimatePresence>
                  {showShareMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute right-0 mt-2 w-48 bg-dark rounded-lg shadow-xl border border-white/10 overflow-hidden z-10"
                    >
                      <button
                        onClick={() => shareRaffle('whatsapp')}
                        className="w-full px-4 py-2 text-left text-text hover:bg-glass/50 transition-colors flex items-center gap-2"
                      >
                        <span>WhatsApp</span>
                      </button>
                      <button
                        onClick={() => shareRaffle('telegram')}
                        className="w-full px-4 py-2 text-left text-text hover:bg-glass/50 transition-colors flex items-center gap-2"
                      >
                        <span>Telegram</span>
                      </button>
                      <button
                        onClick={() => shareRaffle('copy')}
                        className="w-full px-4 py-2 text-left text-text hover:bg-glass/50 transition-colors flex items-center gap-2"
                      >
                        <span>Copiar enlace</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {user?.id === raffle.hostId && (
                <button
                  onClick={() => navigate(`/raffles/${code}/manage`)}
                  className="p-2 bg-glass/50 rounded-lg hover:bg-glass transition-colors"
                  title="Administrar rifa"
                >
                  <Settings className="w-5 h-5 text-text" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
        
        {/* Estadísticas */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6"
        >
          <div className="bg-glass rounded-xl p-4">
            <div className="text-xs text-text/60 mb-1">Total</div>
            <div className="text-xl font-bold text-text">{stats.totalNumbers}</div>
          </div>
          <div className="bg-glass rounded-xl p-4">
            <div className="text-xs text-text/60 mb-1">Vendidos</div>
            <div className="text-xl font-bold text-green-400">{stats.soldNumbers}</div>
          </div>
          <div className="bg-glass rounded-xl p-4">
            <div className="text-xs text-text/60 mb-1">Reservados</div>
            <div className="text-xl font-bold text-yellow-400">{stats.reservedNumbers}</div>
          </div>
          <div className="bg-glass rounded-xl p-4">
            <div className="text-xs text-text/60 mb-1">Disponibles</div>
            <div className="text-xl font-bold text-accent">{stats.availableNumbers}</div>
          </div>
          <div className="bg-glass rounded-xl p-4">
            <div className="text-xs text-text/60 mb-1">Progreso</div>
            <div className="text-xl font-bold text-text">{stats.progress}%</div>
          </div>
          <div className="bg-glass rounded-xl p-4">
            <div className="text-xs text-text/60 mb-1">Pote Total</div>
            <div className="text-xl font-bold text-fire-orange">
              {raffle.mode === 'fires' ? '🔥' : '🪙'} {stats.totalPot}
            </div>
          </div>
          <div className="bg-glass rounded-xl p-4">
            <div className="text-xs text-text/60 mb-1">Mis Números</div>
            <div className="text-xl font-bold text-accent">{stats.myNumbers}</div>
          </div>
          {raffle?.status === RaffleStatus.FINISHED && winner && (
            <div className="bg-gradient-to-br from-amber-500/20 via-amber-400/10 to-amber-300/10 border border-amber-400/40 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-amber-200">
                <Crown className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">Ganador</span>
              </div>
              <div>
                <div className="text-lg font-semibold text-amber-100">
                  {winner.displayName || winner.username || 'Ganador secreto'}
                </div>
                {winner.winningNumber !== undefined && (
                  <div className="text-sm text-amber-200/80">Número #{winner.winningNumber}</div>
                )}
              </div>
              <div className="text-sm text-amber-200/80 mt-auto">
                Premio:&nbsp;
                <span className="font-semibold">
                  {winner.currency === 'fires' ? '🔥' : '🪙'}
                  {raffle?.mode === RaffleMode.FIRES ? raffle?.potFires : raffle?.potCoins}
                </span>
              </div>
            </div>
          )}
        </motion.div>
        
        {/* Progress bar */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-glass rounded-xl p-4 mb-6"
        >
          <div className="flex justify-between text-sm text-text/80 mb-2">
            <span>{stats.soldNumbers} vendidos</span>
            <span>{stats.progress}% completado</span>
            <span>{stats.availableNumbers} disponibles</span>
          </div>
          <div className="h-3 bg-dark/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stats.progress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-accent to-fire-orange"
            />
          </div>
        </motion.div>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('numbers')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'numbers'
                ? 'bg-accent text-dark'
                : 'bg-glass text-text/60 hover:text-text'
            }`}
          >
            Números
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'info'
                ? 'bg-accent text-dark'
                : 'bg-glass text-text/60 hover:text-text'
            }`}
          >
            Información
          </button>
          {winner && (
            <button
              onClick={() => setActiveTab('winners')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'winners'
                  ? 'bg-amber-400/20 text-amber-200'
                  : 'bg-glass text-text/60 hover:text-text'
              }`}
            >
              <Crown className="w-4 h-4" />
              Ganador
            </button>
          )}
        </div>
        
        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'numbers' && (
            <motion.div
              key="numbers"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6 pb-12"
            >
              {/* Grilla de números */}
              <div className="bg-glass rounded-xl p-6">
                <NumberGrid
                  numbers={numbers || []}
                  totalNumbers={raffle.numbersRange}
                  selectedNumbers={selectedNumbers}
                  onNumberClick={handleNumberClick}
                  disabled={raffle.status !== RaffleStatus.ACTIVE}
                />
              </div>
              
              {/* Barra de compra flotante - Alineada a la izquierda */}
              {selectedNumbers.length > 0 && raffle.status === 'active' && (
                <motion.div
                  initial={{ x: -100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -100, opacity: 0 }}
                  className="fixed bottom-32 left-4 bg-dark rounded-2xl shadow-2xl border border-accent/30 p-3 z-40 w-auto max-w-[calc(100vw-2rem)] sm:max-w-2xl"
                >
                  <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="text-text">
                        <span className="text-text/60">Seleccionados:</span>
                        <span className="ml-1 font-bold">{selectedNumbers.length}</span>
                      </div>
                      
                      <div className="h-6 w-px bg-white/20"></div>
                      
                      <div className="text-text">
                        <span className="text-text/60">Total:</span>
                        <span className="ml-1 font-bold text-fire-orange">
                          {(selectedNumbers.length * (raffle.mode === RaffleMode.FIRES ? (raffle.entryPriceFire || 0) : (raffle.entryPriceCoin || 0))).toFixed(0)}
                          {' '}{raffle.mode === RaffleMode.FIRES ? '🔥' : '🪙'}
                        </span>
                      </div>
                    </div>
                    
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleProceedToPurchase}
                        className="btn-primary px-4 py-2 flex items-center gap-2 text-sm flex-1 sm:flex-none"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        Comprar
                      </motion.button>
                    
                      <button
                        onClick={() => setSelectedNumbers([])}
                        className="p-2 bg-glass/50 rounded-lg hover:bg-glass transition-colors"
                      >
                        <XCircle className="w-5 h-5 text-text/60" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
          
          {activeTab === 'info' && (
            <motion.div
              key="info"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-glass rounded-xl p-6"
            >
              <h3 className="text-xl font-bold text-text mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-accent" />
                Información de la Rifa
              </h3>
              
              <div className="space-y-4">
                {raffle.mode === 'prize' && raffle.prizeMeta && (
                  <div>
                    <h4 className="text-sm font-semibold text-text/80 mb-2">Premio</h4>
                    <div className="bg-glass/50 rounded-lg p-4">
                      <p className="text-text mb-2">{raffle.prizeMeta.prizeDescription}</p>
                      {raffle.prizeMeta.prizeValue > 0 && (
                        <p className="text-sm text-text/60">
                          Valor estimado: ${raffle.prizeMeta.prizeValue}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-text/80 mb-2">Detalles</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-text/60">Modo:</span>
                        <span className="text-text">
                          {raffle.mode === 'fires' && '🔥 Fuegos'}
                          {raffle.mode === 'coins' && '🪙 Monedas'}
                          {raffle.mode === 'prize' && '🎁 Premio'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text/60">Precio por número:</span>
                        <span className="text-text">
                          {raffle.mode === RaffleMode.PRIZE ? 'Gratis' : `${raffle.mode === RaffleMode.FIRES ? (raffle.entryPriceFire || 0) : (raffle.entryPriceCoin || 0)} ${raffle.mode === RaffleMode.FIRES ? '🔥' : '🪙'}`}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text/60">Visibilidad:</span>
                        <span className="text-text capitalize">{raffle.visibility}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-semibold text-text/80 mb-2">Organizador</h4>
                    <div className="flex items-center gap-3 bg-glass/50 rounded-lg p-3">
                      <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text">{raffle.hostUsername}</p>
                        <p className="text-xs text-text/60">Organizador</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {raffle.termsConditions && (
                  <div>
                    <h4 className="text-sm font-semibold text-text/80 mb-2">Términos y Condiciones</h4>
                    <div className="bg-glass/50 rounded-lg p-4">
                      <p className="text-sm text-text/80 whitespace-pre-wrap">{raffle.termsConditions}</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          
          {activeTab === 'winners' && winner && (
            <motion.div
              key="winners"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-glass rounded-2xl p-6 border border-amber-400/40"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 text-amber-200">
                  <Crown className="w-6 h-6" />
                  <div>
                    <div className="text-lg font-semibold">
                      {winner.displayName || winner.username}
                    </div>
                    <div className="text-sm text-amber-200/80">
                      Ganador de la rifa
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-amber-500/10 border border-amber-400/30 rounded-xl p-4">
                    <div className="text-xs text-amber-200/70 uppercase tracking-wide">Número ganador</div>
                    <div className="text-3xl font-bold text-amber-100 mt-1">#{winner.winningNumber ?? '—'}</div>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-400/30 rounded-xl p-4">
                    <div className="text-xs text-amber-200/70 uppercase tracking-wide">Premio</div>
                    <div className="text-2xl font-semibold text-amber-100 mt-1">
                      {winner.currency === 'fires' ? '🔥' : '🪙'}
                      {raffle?.mode === RaffleMode.FIRES ? raffle?.potFires : raffle?.potCoins}
                    </div>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-400/30 rounded-xl p-4">
                    <div className="text-xs text-amber-200/70 uppercase tracking-wide">Estado</div>
                    <div className="text-lg font-semibold text-amber-100 mt-1">Completada</div>
                  </div>
                </div>
                <div className="text-sm text-amber-200/80">
                  Felicita al ganador y mantente atento a las próximas rifas para más oportunidades de ganar.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Modal de compra */}
        <PurchaseModal
          isOpen={showPurchaseModal}
          onClose={() => {
            setShowPurchaseModal(false);
            setSelectedNumbers([]);
          }}
          raffle={raffle}
          selectedNumbers={selectedNumbers}
          onSuccess={() => {
            setShowPurchaseModal(false);
            setSelectedNumbers([]);
            raffleData.forceRefresh();
          }}
        />
      </div>
    </motion.div>
  );
};

export default RaffleRoom;
