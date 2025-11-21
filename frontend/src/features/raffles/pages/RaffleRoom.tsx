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
import { useRaffle, useReserveNumber, usePurchaseNumber, useCancelRaffle, useUpdateRaffle } from '../hooks/useRaffleData';
import NumberGrid from '../components/NumberGrid';
import PurchaseModal from '../components/PurchaseModal';
import ParticipantsModal from '../components/ParticipantsModal';
import { RaffleStatus, RaffleMode, NumberState, DrawMode } from '../types';
import { formatDate, formatCurrency } from '../../../utils/format';
import { VENEZUELAN_BANKS } from '../../../constants/banks';

const GUEST_SELECTION_KEY = 'raffle_guest_selection';
const GUEST_RESERVATION_TIMEOUT_MS = 10_000; // 10 segundos para invitados

interface RaffleRoomProps {}

const RaffleRoom: React.FC<RaffleRoomProps> = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, loginWithTelegram, loading } = useAuth();
  const { socket } = useSocket();
  
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'numbers' | 'info' | 'winners'>('numbers');
  const refreshTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [timeToDrawMs, setTimeToDrawMs] = useState<number | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showBankingModal, setShowBankingModal] = useState(false);
  const [isSavingBanking, setIsSavingBanking] = useState(false);
  const [showWinnerContactModal, setShowWinnerContactModal] = useState(false);
  const [bankingForm, setBankingForm] = useState({
    accountHolder: '',
    bankCode: '',
    bankName: '',
    idNumber: '',
    accountType: 'ahorro' as 'ahorro' | 'corriente',
    accountNumber: '',
    phone: ''
  });
  const [showGuestAuthModal, setShowGuestAuthModal] = useState(false);
  const guestTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const saveGuestSelection = (raffleCode: string, numbers: number[]) => {
    try {
      const payload = {
        code: raffleCode,
        numbers,
        createdAt: Date.now()
      };
      localStorage.setItem(GUEST_SELECTION_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('[RaffleRoom] Error guardando selección invitado:', e);
    }
  };

  const clearGuestSelection = () => {
    try {
      localStorage.removeItem(GUEST_SELECTION_KEY);
    } catch (e) {
      console.error('[RaffleRoom] Error limpiando selección invitado:', e);
    }
  };
  
  // Query de la sala
  const raffleData = useRaffle(code || '');
  const raffle = raffleData.raffle;
  const numbers = raffleData.numbers;
  const winner = raffleData.winner;
  const winnerContact = (raffleData as any).winnerContact;
  const isLoading = raffleData.isLoading;
  const error = raffleData.error;
  
  useEffect(() => {
    if (!raffle || raffle.drawMode !== 'scheduled' || !raffle.scheduledDrawAt) {
      setTimeToDrawMs(null);
      return;
    }
    const target = new Date(raffle.scheduledDrawAt).getTime();
    const update = () => {
      const diff = target - Date.now();
      setTimeToDrawMs(diff > 0 ? diff : 0);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [raffle?.drawMode, raffle?.scheduledDrawAt]);
  
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
      if (guestTimerRef.current) {
        clearTimeout(guestTimerRef.current);
      }
    };
  }, []);

  // Limpiar selección invitado si se entra a otra rifa distinta
  useEffect(() => {
    if (!code) return;
    try {
      const raw = localStorage.getItem(GUEST_SELECTION_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (stored.code && stored.code !== code) {
        clearGuestSelection();
      }
    } catch (e) {
      clearGuestSelection();
    }
  }, [code]);

  // Mutations
  const reserveNumbers = useReserveNumber();
  const purchaseNumbers = usePurchaseNumber();
  const cancelRaffle = useCancelRaffle();
  const updateRaffle = useUpdateRaffle();

  const tryResumeGuestSelection = useCallback(async () => {
    if (!user || !code) return;

    let storedRaw: string | null = null;
    try {
      storedRaw = localStorage.getItem(GUEST_SELECTION_KEY);
    } catch (e) {
      console.error('[RaffleRoom] Error leyendo selección invitado:', e);
      return;
    }

    if (!storedRaw) return;

    let stored: any;
    try {
      stored = JSON.parse(storedRaw);
    } catch (e) {
      console.error('[RaffleRoom] Error parseando selección invitado:', e);
      clearGuestSelection();
      return;
    }

    if (stored.code !== code) {
      clearGuestSelection();
      return;
    }

    if (!Array.isArray(stored.numbers) || stored.numbers.length === 0) {
      clearGuestSelection();
      return;
    }

    const ageMs = Date.now() - (stored.createdAt || 0);
    if (ageMs > GUEST_RESERVATION_TIMEOUT_MS) {
      clearGuestSelection();
      toast.error('La reserva temporal expiró, selecciona los números de nuevo');
      return;
    }

    const numbersToReserve: number[] = stored.numbers;
    const toastId = toast.loading(`Reservando ${numbersToReserve.length} número${numbersToReserve.length > 1 ? 's' : ''}...`);
    const reserved: number[] = [];
    const failed: number[] = [];

    for (const idx of numbersToReserve) {
      try {
        await reserveNumbers.mutateAsync({ code: code, idx });
        reserved.push(idx);
      } catch (err) {
        console.error('[RaffleRoom] Error reservando número (reanudación invitado):', err);
        failed.push(idx);
      }
    }

    clearGuestSelection();

    if (reserved.length === 0) {
      toast.error('No se pudo reservar tu número, por favor selecciona otro', { id: toastId });
      setSelectedNumbers([]);
      return;
    }

    if (failed.length > 0) {
      toast.error(
        `Algunos números ya no están disponibles: ${failed.join(', ')}`,
        { id: toastId, duration: 5000 }
      );
    } else {
      toast.success(
        `${reserved.length} número${reserved.length > 1 ? 's' : ''} reservado${reserved.length > 1 ? 's' : ''}`,
        { id: toastId }
      );
    }

    setSelectedNumbers(reserved);
    setShowPurchaseModal(true);
  }, [user, code, reserveNumbers]);

  // Reanudar selección invitado después de login/redirección
  useEffect(() => {
    if (!user || !code) return;
    tryResumeGuestSelection();
  }, [user, code, tryResumeGuestSelection]);

  // Forzar cierre (admin)
  const [isForceFinishing, setIsForceFinishing] = useState(false);
  const handleForceFinish = async () => {
    if (!code) return;
    setIsForceFinishing(true);
    try {
      const response = await fetch(`/api/raffles/v2/${code}/finish-debug`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Error al forzar cierre');
      }
      toast.success('Rifa finalizada');
      raffleData.forceRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Error al forzar cierre');
    } finally {
      setIsForceFinishing(false);
    }
  };
  
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
      socket.on('raffle:all_sold', handleAllSold);
      socket.on('raffle:drawing_scheduled', handleDrawingScheduled);
      socket.on('raffle:draw_cancelled', handleDrawCancelled);
      
      return () => {
        socket.emit('raffle:leave_room', { code });
        socket.off('raffle:number_reserved');
        socket.off('raffle:number_released');
        socket.off('raffle:number_purchased');
        socket.off('raffle:status_changed');
        socket.off('raffle:winner_drawn');
        socket.off('raffle:cancelled');
        socket.off('raffle:all_sold');
        socket.off('raffle:drawing_scheduled');
        socket.off('raffle:draw_cancelled');
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
  
  const handleAllSold = useCallback((data: any) => {
    console.log('Raffle all sold:', data);
    if (data.code && data.code !== raffle?.code) return;
    toast.success(data.message || '¡Todos los números vendidos!');
    raffleData.forceRefresh();
  }, [raffle?.code, raffleData]);
  
  const handleDrawingScheduled = useCallback((data: any) => {
    console.log('Raffle drawing scheduled:', data);
    if (data.code && data.code !== raffle?.code) return;
    toast('El sorteo programado está en curso...', { icon: '🎰' });
    raffleData.forceRefresh();
  }, [raffle?.code, raffleData]);
  
  const handleDrawCancelled = useCallback((data: any) => {
    console.log('Raffle scheduled draw cancelled:', data);
    if (data.code && data.code !== raffle?.code) return;
    toast.error(data.message || 'No se pudo realizar el sorteo programado');
    raffleData.forceRefresh();
  }, [raffle?.code, raffleData]);
  
  const handleGuestAuthClose = () => {
    setShowGuestAuthModal(false);
    setSelectedNumbers([]);
    clearGuestSelection();
    if (guestTimerRef.current) {
      clearTimeout(guestTimerRef.current);
      guestTimerRef.current = null;
    }
  };

  const handleGuestTelegramLogin = async () => {
    const result = await loginWithTelegram();
    if (result?.success) {
      if (guestTimerRef.current) {
        clearTimeout(guestTimerRef.current);
        guestTimerRef.current = null;
      }
      setShowGuestAuthModal(false);
      // La reanudación de la reserva se maneja en tryResumeGuestSelection
    }
  };

  const navigateToLogin = () => {
    const nextUrl = window.location.pathname + window.location.search;
    navigate(`/login?next=${encodeURIComponent(nextUrl)}`);
  };

  const navigateToRegister = () => {
    const nextUrl = window.location.pathname + window.location.search;
    navigate(`/register?next=${encodeURIComponent(nextUrl)}`);
  };

  // Manejar selección de números
  const handleNumberClick = (number: number) => {
    const numberData = numbers?.find((n: any) => n.idx === number);

    if (numberData?.state === NumberState.SOLD) {
      if (user && numberData.ownerId === user.id) {
        toast('Ya compraste este número', { icon: '✅' });
      } else {
        toast.error('Este número ya fue vendido');
      }
      return;
    }

    if (numberData?.state === NumberState.RESERVED && (!user || numberData.ownerId !== user.id)) {
      toast.error('Este número está reservado por otro usuario');
      return;
    }

    if (!user) {
      if (!code) return;

      setSelectedNumbers([number]);
      saveGuestSelection(code, [number]);
      setShowGuestAuthModal(true);

      if (guestTimerRef.current) {
        clearTimeout(guestTimerRef.current);
      }
      guestTimerRef.current = setTimeout(() => {
        clearGuestSelection();
        setSelectedNumbers([]);
        setShowGuestAuthModal(false);
      }, GUEST_RESERVATION_TIMEOUT_MS);

      toast('Reserva temporal mientras inicias sesión', { icon: '⏳' });
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
    const shareUrl = `${window.location.origin}/raffles/public/${code}`;
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
  const participantsCount = raffle?.mode === RaffleMode.PRIZE
    ? (raffleData.stats?.totalParticipants ?? (Array.isArray(numbers) ? Array.from(new Set((numbers || []).filter((n:any)=> n.state==='sold' && n.ownerId).map((n:any)=> n.ownerId))).length : 0))
    : soldNumbers;
  
  const stats = {
    totalNumbers,
    soldNumbers,
    reservedNumbers,
    availableNumbers,
    progress,
    totalPot: raffle?.potFires || raffle?.potCoins || 0,
    myNumbers: raffleData.userNumbers?.length || 0
  };

  const prizeWinners =
    raffle?.mode === RaffleMode.PRIZE && (raffle as any)?.prizeMeta && Array.isArray((raffle as any).prizeMeta.winners)
      ? (raffle as any).prizeMeta.winners
      : (winner ? [winner] : []);
  const hasWinners = prizeWinners.length > 0;
  const mainWinner: any = hasWinners ? prizeWinners[0] : null;
  const isHost = !!(user && raffle && user.id === raffle.hostId);
  const canViewWinnerContact = !!(isHost && winnerContact && raffle?.status === RaffleStatus.FINISHED);

  // Sincronizar formulario de datos bancarios cuando cargue la rifa
  useEffect(() => {
    if (!raffle || raffle.mode !== RaffleMode.PRIZE) return;
    const info: any = (raffle.prizeMeta as any)?.bankingInfo || {};
    setBankingForm({
      accountHolder: info.accountHolder || '',
      bankCode: info.bankCode || '',
      bankName: info.bankName || '',
      idNumber: info.idNumber || '',
      accountType: (info.accountType as 'ahorro' | 'corriente') || 'ahorro',
      accountNumber: info.accountNumber || '',
      phone: info.phone || ''
    });
  }, [raffle?.id, raffle?.mode, (raffle as any)?.prizeMeta]);

  const handleSaveBankingInfo = async () => {
    if (!code || !raffle || raffle.mode !== RaffleMode.PRIZE) return;
    setIsSavingBanking(true);
    try {
      const currentPrizeMeta: any = raffle.prizeMeta || {};
      const selectedBank = VENEZUELAN_BANKS.find(b => b.code === bankingForm.bankCode);
      const updatedPrizeMeta = {
        ...currentPrizeMeta,
        bankingInfo: {
          accountHolder: bankingForm.accountHolder.trim(),
          bankCode: bankingForm.bankCode.trim(),
          bankName: bankingForm.bankName.trim() || selectedBank?.fullName || '',
          idNumber: bankingForm.idNumber.trim(),
          accountType: bankingForm.accountType,
          accountNumber: bankingForm.accountNumber.trim(),
          phone: bankingForm.phone.trim()
        }
      };

      await updateRaffle.mutateAsync({
        code,
        updates: {
          prizeMeta: updatedPrizeMeta
        }
      });

      toast.success('Datos bancarios actualizados');
      setShowBankingModal(false);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Error actualizando datos bancarios';
      toast.error(message);
    } finally {
      setIsSavingBanking(false);
    }
  };
  
  const formatTimeToDraw = (ms: number | null) => {
    if (ms === null) return '';
    if (ms <= 0) return '¡En cualquier momento!';
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const hh = hours.toString().padStart(2, '0');
    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');
    if (days > 0) {
      return `${days}d ${hh}:${mm}:${ss}`;
    }
    return `${hh}:${mm}:${ss}`;
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
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
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
                  {raffle.drawMode === 'scheduled' && raffle.scheduledDrawAt && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>
                        {timeToDrawMs !== null
                          ? `Sorteo en ${formatTimeToDraw(timeToDrawMs)}`
                          : `Sorteo programado para ${formatDate(raffle.scheduledDrawAt)}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Acciones */}
            <div className="flex flex-wrap gap-2 mt-4 lg:mt-0 lg:justify-end lg:items-center w-full lg:w-auto">
              {/* Ayuda */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowHelpModal(true)}
                className="p-2 bg-glass/50 rounded-lg hover:bg-glass transition-colors"
                title="Cómo funciona esta rifa"
              >
                <Info className="w-5 h-5 text-accent" />
              </motion.button>
              {/* Botón elegir ganador manual - visible para host en modo manual, requiere al menos 1 número vendido */}
              {user?.id === raffle.hostId &&
                raffle.drawMode === 'manual' &&
                raffle.status === RaffleStatus.ACTIVE &&
                totalNumbers > 0 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDrawWinner}
                  disabled={isDrawing || soldNumbers <= 0}
                  className="px-4 py-2 bg-gradient-to-r from-accent to-fire-orange rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2 text-sm font-bold text-dark"
                  title={soldNumbers > 0
                    ? 'Elegir ganador manualmente'
                    : 'Para sortear necesitas al menos 1 número vendido'}
                >
                  <Hand className="w-5 h-5" />
                  <span>{isDrawing ? 'Eligiendo...' : 'Elegir Ganador'}</span>
                  {!isDrawing && <Sparkles className="w-4 h-4" />}
                </motion.button>
              )}

              {(isAdmin() || String((user as any)?.tg_id) === '1417856820') &&
                raffle.status === RaffleStatus.ACTIVE &&
                soldNumbers === totalNumbers &&
                totalNumbers > 0 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleForceFinish}
                  disabled={isForceFinishing}
                  className="px-3 py-2 bg-accent/20 rounded-lg hover:bg-accent/30 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-semibold text-accent"
                  title="Forzar cierre (admin)"
                >
                  <Crown className="w-4 h-4" />
                  <span className="hidden sm:inline">{isForceFinishing ? 'Cerrando...' : 'Forzar Cierre'}</span>
                </motion.button>
              )}
              
              {/* Botón cancelar rifa - Posición destacada */}
              {(user?.id === raffle.hostId || 
                isAdmin() ||
                String((user as any)?.tg_id) === '1417856820') &&
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
                      className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-48 max-w-[calc(100vw-3rem)] bg-dark rounded-lg shadow-xl border border-white/10 overflow-hidden z-20"
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

              {raffle.mode === RaffleMode.PRIZE && user?.id === raffle.hostId && (
                <button
                  onClick={() => setShowParticipantsModal(true)}
                  className="p-2 bg-glass/50 rounded-lg hover:bg-glass transition-colors"
                  title="Participantes"
                >
                  <Users className="w-5 h-5 text-text" />
                </button>
              )}
              
              {raffle.mode === RaffleMode.PRIZE && user?.id === raffle.hostId && (
                <button
                  onClick={() => setShowBankingModal(true)}
                  className="p-2 bg-glass/50 rounded-lg hover:bg-glass transition-colors"
                  title="Datos de pago del anfitrión"
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
          <div 
            className={`bg-glass rounded-xl p-4 ${raffle.mode === RaffleMode.PRIZE ? 'cursor-pointer hover:bg-glass/80' : ''}`}
            onClick={raffle.mode === RaffleMode.PRIZE ? () => setShowParticipantsModal(true) : undefined}
          >
            <div className="text-xs text-text/60 mb-1">{raffle.mode === RaffleMode.PRIZE ? 'Participantes' : 'Vendidos'}</div>
            <div className="text-xl font-bold text-green-400">{raffle.mode === RaffleMode.PRIZE ? participantsCount : stats.soldNumbers}</div>
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
          {raffle.mode === RaffleMode.PRIZE ? (
            <div 
              className="bg-glass rounded-xl p-4 cursor-pointer hover:bg-glass/80"
              onClick={() => setShowPrizeModal(true)}
            >
              <div className="text-xs text-text/60 mb-1">Premio</div>
              <div className="text-sm font-semibold text-text line-clamp-2">
                {raffle.prizeMeta?.prizeDescription || 'Premio'}
              </div>
            </div>
          ) : (
            <div className="bg-glass rounded-xl p-4">
              <div className="text-xs text-text/60 mb-1">Pote Total</div>
              <div className="text-xl font-bold text-fire-orange">
                {raffle.mode === 'fires' ? '🔥' : '🪙'} {stats.totalPot}
              </div>
            </div>
          )}
          <div className="bg-glass rounded-xl p-4">
            <div className="text-xs text-text/60 mb-1">Mis Números</div>
            <div className="text-xl font-bold text-accent">{stats.myNumbers}</div>
            {Array.isArray(raffleData.userNumbers) && raffleData.userNumbers.length > 0 && (
              <div className="mt-2 text-xs text-accent/90 break-words">
                {raffleData.userNumbers.join(', ')}
              </div>
            )}
          </div>
          {raffle.visibility === 'company' && (
            <div
              className="bg-glass rounded-xl p-4 cursor-pointer hover:bg-glass/80 flex flex-col gap-2"
              onClick={() => {
                const url = `${window.location.origin}/raffles/public/${raffle.code}`;
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
            >
              <div className="text-xs text-text/60 mb-1">Landing pública</div>
              <div className="text-sm font-semibold text-text line-clamp-2">
                Comparte la página empresarial de esta rifa
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const shareUrl = `${window.location.origin}/raffles/public/${code}`;
                  navigator.clipboard.writeText(shareUrl);
                  toast.success('Enlace de la landing copiado');
                }}
                className="mt-2 inline-flex items-center gap-2 px-3 py-1 text-xs rounded-full bg-accent/20 text-accent hover:bg-accent/30"
              >
                <Share2 className="w-3 h-3" />
                Copiar enlace público
              </button>
            </div>
          )}
          {raffle?.status === RaffleStatus.FINISHED && hasWinners && (
            <div
              className={`bg-gradient-to-br from-amber-500/20 via-amber-400/10 to-amber-300/10 border border-amber-400/40 rounded-xl p-4 flex flex-col gap-2 ${canViewWinnerContact ? 'cursor-pointer hover:bg-amber-500/25 transition-colors' : ''}`}
              onClick={() => {
                if (canViewWinnerContact) {
                  setShowWinnerContactModal(true);
                }
              }}
            >
              <div className="flex items-center gap-2 text-amber-200">
                <Crown className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">
                  {prizeWinners.length > 1 ? 'Ganador principal' : 'Ganador'}
                </span>
              </div>
              <div>
                <div className="text-lg font-semibold text-amber-100">
                  {mainWinner.displayName || mainWinner.username || 'Ganador secreto'}
                </div>
                {mainWinner.winningNumber !== undefined && (
                  <div className="text-sm text-amber-200/80">Número #{mainWinner.winningNumber}</div>
                )}
              </div>
              <div className="text-sm text-amber-200/80 mt-auto">
                Premio:&nbsp;
                <span className="font-semibold">
                  {raffle.mode === RaffleMode.FIRES && (
                    <>
                      🔥{raffle.potFires}
                    </>
                  )}
                  {raffle.mode === RaffleMode.COINS && (
                    <>
                      🪙{raffle.potCoins}
                    </>
                  )}
                  {raffle.mode === RaffleMode.PRIZE && '🎁 Premio'}
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
          {hasWinners && (
            <button
              onClick={() => setActiveTab('winners')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'winners'
                  ? 'bg-amber-400/20 text-amber-200'
                  : 'bg-glass text-text/60 hover:text-text'
              }`}
            >
              <Crown className="w-4 h-4" />
              {prizeWinners.length > 1 ? 'Ganadores' : 'Ganador'}
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
                  userNumbers={raffleData.userNumbers || []}
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
          
          {activeTab === 'winners' && hasWinners && (
            <motion.div
              key="winners"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-glass rounded-2xl p-6 border border-amber-400/40 ${canViewWinnerContact ? 'cursor-pointer hover:bg-amber-500/5 transition-colors' : ''}`}
              onClick={() => {
                if (canViewWinnerContact) {
                  setShowWinnerContactModal(true);
                }
              }}
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 text-amber-200">
                  <Crown className="w-6 h-6" />
                  <div>
                    <div className="text-lg font-semibold">
                      {mainWinner.displayName || mainWinner.username}
                    </div>
                    <div className="text-sm text-amber-200/80">
                      {prizeWinners.length > 1 ? 'Ganador principal de la rifa' : 'Ganador de la rifa'}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-amber-500/10 border border-amber-400/30 rounded-xl p-4">
                    <div className="text-xs text-amber-200/70 uppercase tracking-wide">Número ganador</div>
                    <div className="text-3xl font-bold text-amber-100 mt-1">#{mainWinner.winningNumber ?? '—'}</div>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-400/30 rounded-xl p-4">
                    <div className="text-xs text-amber-200/70 uppercase tracking-wide">Premio</div>
                    <div className="text-2xl font-semibold text-amber-100 mt-1">
                      {raffle.mode === RaffleMode.FIRES && (
                        <>
                          🔥{raffle.potFires}
                        </>
                      )}
                      {raffle.mode === RaffleMode.COINS && (
                        <>
                          🪙{raffle.potCoins}
                        </>
                      )}
                      {raffle.mode === RaffleMode.PRIZE && '🎁 Premio'}
                    </div>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-400/30 rounded-xl p-4">
                    <div className="text-xs text-amber-200/70 uppercase tracking-wide">Estado</div>
                    <div className="text-lg font-semibold text-amber-100 mt-1">Completada</div>
                  </div>
                </div>
                {prizeWinners.length > 1 && (
                  <div className="mt-4 space-y-2">
                    {prizeWinners.map((w: any, index: number) => {
                      if (index === 0) return null;
                      const place = `${index + 1}° lugar`;
                      return (
                        <div
                          key={`${w.userId || w.username || index}-${w.winningNumber}`}
                          className="flex justify-between items-center text-sm text-amber-100 bg-amber-500/10 border border-amber-400/20 rounded-lg px-3 py-2"
                        >
                          <span>{place}</span>
                          <span>
                            {w.displayName || w.username || 'Ganador'}
                            {' '}
                            #{w.winningNumber !== undefined ? w.winningNumber : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="text-sm text-amber-200/80">
                  Felicita al ganador y mantente atento a las próximas rifas para más oportunidades de ganar.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Modal de ayuda: cómo funciona esta rifa */}
        <AnimatePresence>
          {showHelpModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setShowHelpModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="w-full max-w-3xl bg-dark rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
                      <Info className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-sm md:text-base font-bold text-text">Cómo funcionan las rifas</h3>
                      <p className="text-[11px] md:text-xs text-text/60">
                        Guía rápida para crear tu rifa y entender esta sala.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowHelpModal(false)}
                    className="px-3 py-1 rounded-lg bg-glass hover:bg-glass/80 text-xs text-text/80"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="p-4 pt-3 pb-5 space-y-3 text-sm md:text-base text-text/90 max-h-[70vh] overflow-y-auto scrollbar-thin leading-snug">
                  <section className="space-y-1">
                    <h4 className="font-bold text-text text-sm md:text-base">1. Crear una rifa desde el Lobby</h4>
                    <p>
                      En la página de <span className="font-semibold">Rifas Activas</span> pulsa <span className="font-semibold">"Crear Rifa"</span>. 
                      El asistente te guía paso a paso:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 ml-1">
                      <li>
                        <span className="font-semibold">Modo:</span> elige si el premio es en 🔥 fires, 🪙 monedas o un premio físico/servicio.
                      </li>
                      <li>
                        <span className="font-semibold">Rango de números:</span> cuántos números tendrá la rifa (ej. 100, 500, 1000).
                      </li>
                      <li>
                        <span className="font-semibold">Precio por número:</span> cuánto paga cada jugador por número (en fires o coins).
                      </li>
                      <li>
                        <span className="font-semibold">Visibilidad:</span> pública, privada o empresarial (landing especial para tu marca).
                      </li>
                      <li>
                        <span className="font-semibold">Modo de sorteo:</span> automático, programado o manual, según cómo quieras elegir al ganador.
                      </li>
                    </ul>
                  </section>

                  <section className="space-y-1">
                    <h4 className="font-bold text-text text-sm md:text-base">2. Qué muestra esta sala</h4>
                    <ul className="list-disc list-inside space-y-0.5 ml-1">
                      <li><span className="font-semibold">Encabezado:</span> nombre, estado, código de la rifa y tiempo para el sorteo.</li>
                      <li><span className="font-semibold">Estadísticas:</span> números totales, vendidos, reservados, disponibles y pote acumulado.</li>
                      <li><span className="font-semibold">Grilla de números:</span> cada casilla representa un número que puede estar disponible, reservado o vendido.</li>
                      <li><span className="font-semibold">Mis números:</span> resume los números que ya compraste.</li>
                    </ul>
                  </section>

                  <section className="space-y-1">
                    <h4 className="font-bold text-text text-sm md:text-base">3. Cómo comprar números</h4>
                    <ul className="list-disc list-inside space-y-0.5 ml-1">
                      <li>Haz clic sobre los números disponibles para seleccionarlos (hasta 50 por compra).</li>
                      <li>La barra flotante muestra cuántos números llevas y el <span className="font-semibold">total a pagar</span>.</li>
                      <li>Al pulsar <span className="font-semibold">"Comprar"</span>, el sistema los reserva y luego confirma el pago desde tu wallet.</li>
                    </ul>
                  </section>

                  <section className="space-y-1">
                    <h4 className="font-bold text-text text-sm md:text-base">4. Rol del organizador</h4>
                    <ul className="list-disc list-inside space-y-0.5 ml-1">
                      <li>Puede cancelar la rifa si es necesario; la plataforma reembolsa a todos los compradores.</li>
                      <li>En modo manual, el host puede pulsar <span className="font-semibold">"Elegir Ganador"</span> cuando todos los números estén vendidos.</li>
                      <li>En rifas empresariales, puede compartir la <span className="font-semibold">landing pública</span> para vender más rápido.</li>
                    </ul>
                  </section>

                  <section className="space-y-1">
                    <h4 className="font-bold text-text text-sm md:text-base">5. Buenas prácticas</h4>
                    <ul className="list-disc list-inside space-y-0.5 ml-1">
                      <li>Elige un rango de números acorde al tamaño de tu comunidad.</li>
                      <li>Define precios justos y comunica claramente el premio y las condiciones.</li>
                      <li>Evita cancelar rifas activas salvo que sea estrictamente necesario.</li>
                    </ul>
                  </section>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal de contacto del ganador - solo anfitrión */}
        <AnimatePresence>
          {showWinnerContactModal && winnerContact && isHost && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setShowWinnerContactModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="w-full max-w-md bg-dark rounded-2xl shadow-2xl border border-amber-400/40 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-amber-400/30 flex items-center justify-between bg-gradient-to-r from-amber-500/20 to-amber-300/10">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-500/30 flex items-center justify-center">
                      <Crown className="w-5 h-5 text-amber-100" />
                    </div>
                    <div>
                      <h3 className="text-sm md:text-base font-bold text-amber-50">Datos de contacto del ganador</h3>
                      <p className="text-[11px] md:text-xs text-amber-100/80">
                        Solo tú, como anfitrión, puedes ver esta información.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowWinnerContactModal(false)}
                    className="px-3 py-1 rounded-lg bg-glass hover:bg-glass/80 text-[11px] text-text/80"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <div className="bg-amber-500/10 border border-amber-400/40 rounded-xl p-3">
                    <div className="text-xs text-amber-200/80 uppercase tracking-wide mb-1">Ganador</div>
                    <div className="text-sm font-semibold text-amber-50">
                      {winnerContact.displayName || winnerContact.username || 'Ganador'}
                    </div>
                    {mainWinner?.winningNumber !== undefined && (
                      <div className="text-xs text-amber-200/80 mt-1">Número ganador: #{mainWinner.winningNumber}</div>
                    )}
                  </div>

                  <div className="bg-glass/60 rounded-xl p-3 space-y-2 text-sm text-text/90">
                    {winnerContact.username && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-text/60 text-xs">Usuario</span>
                        <span className="font-mono text-xs">@{winnerContact.username}</span>
                      </div>
                    )}
                    {winnerContact.tgId && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-text/60 text-xs">tg_id</span>
                        <span className="font-mono text-xs">{winnerContact.tgId}</span>
                      </div>
                    )}
                    {winnerContact.phone && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-text/60 text-xs">Teléfono</span>
                        <span className="font-mono text-xs">{winnerContact.phone}</span>
                      </div>
                    )}
                    {winnerContact.email && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-text/60 text-xs">Email</span>
                        <span className="font-mono text-[11px] break-all">{winnerContact.email}</span>
                      </div>
                    )}

                    {!winnerContact.tgId && !winnerContact.phone && !winnerContact.email && (
                      <div className="text-xs text-text/60">
                        No hay datos de contacto adicionales almacenados para este ganador.
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-text/60 leading-snug">
                    Usa estos datos solo para coordinar la entrega del premio. No compartas esta información con otros usuarios sin permiso del ganador.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal de edición de datos bancarios del anfitrión */}
        <AnimatePresence>
          {showBankingModal && raffle.mode === RaffleMode.PRIZE && user?.id === raffle.hostId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setShowBankingModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="w-full max-w-2xl bg-dark rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
                      <Settings className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-sm md:text-base font-bold text-text">Datos de pago del anfitrión</h3>
                      <p className="text-[11px] md:text-xs text-text/60">
                        Ajusta la cuenta donde los participantes enviarán sus pagos.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowBankingModal(false)}
                    className="px-3 py-1 rounded-lg bg-glass hover:bg-glass/80 text-xs text-text/80"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="p-4 pt-3 pb-5 space-y-4 text-xs md:text-sm text-text/80 max-h-[70vh] overflow-y-auto scrollbar-thin">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] md:text-xs text-text/70 mb-1">Nombre del titular</label>
                      <input
                        type="text"
                        value={bankingForm.accountHolder}
                        onChange={(e) => setBankingForm(prev => ({ ...prev, accountHolder: e.target.value }))}
                        className="w-full px-3 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent"
                        placeholder="Nombre completo"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] md:text-xs text-text/70 mb-1">Cédula / ID</label>
                      <input
                        type="text"
                        value={bankingForm.idNumber}
                        onChange={(e) => setBankingForm(prev => ({ ...prev, idNumber: e.target.value }))}
                        className="w-full px-3 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent"
                        placeholder="V-12345678"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] md:text-xs text-text/70 mb-1">Banco</label>
                      <select
                        value={bankingForm.bankCode}
                        onChange={(e) => {
                          const code = e.target.value;
                          const selected = VENEZUELAN_BANKS.find(b => b.code === code);
                          setBankingForm(prev => ({
                            ...prev,
                            bankCode: code,
                            bankName: selected?.fullName || prev.bankName
                          }));
                        }}
                        className="w-full px-3 py-2 bg-glass rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="">Seleccionar banco...</option>
                        {VENEZUELAN_BANKS.map(bank => (
                          <option key={bank.code} value={bank.code}>
                            {bank.code} - {bank.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] md:text-xs text-text/70 mb-1">Tipo de cuenta</label>
                      <select
                        value={bankingForm.accountType}
                        onChange={(e) => setBankingForm(prev => ({ ...prev, accountType: e.target.value as 'ahorro' | 'corriente' }))}
                        className="w-full px-3 py-2 bg-glass rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="ahorro">Ahorro</option>
                        <option value="corriente">Corriente</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] md:text-xs text-text/70 mb-1">Número de cuenta</label>
                    <input
                      type="text"
                      value={bankingForm.accountNumber}
                      onChange={(e) => setBankingForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                      className="w-full px-3 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="0000-0000-00-0000000000"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] md:text-xs text-text/70 mb-1">Teléfono de contacto</label>
                    <input
                      type="tel"
                      value={bankingForm.phone}
                      onChange={(e) => setBankingForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="0414-1234567"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowBankingModal(false)}
                      className="px-4 py-2 rounded-lg bg-glass hover:bg-glass/80 text-xs md:text-sm text-text/80"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveBankingInfo}
                      disabled={isSavingBanking}
                      className="px-4 py-2 rounded-lg bg-accent text-dark text-xs md:text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingBanking ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal de imagen de premio */}
        <AnimatePresence>
          {showPrizeModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setShowPrizeModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="max-w-3xl w-full bg-dark rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-text font-semibold">Premio</h3>
                  <button
                    onClick={() => setShowPrizeModal(false)}
                    className="px-3 py-1 rounded-lg bg-glass hover:bg-glass/80 text-text/80"
                  >
                    Cerrar
                  </button>
                </div>
                <div className="bg-black/40 p-4 flex items-center justify-center">
                  {(() => {
                    const raw = raffle.prizeImageBase64 || '';
                    const fallback = raffle.prizeMeta?.prizeImages?.[0];
                    let src = '';
                    if (raw) {
                      src = raw.startsWith('data:image') ? raw : `data:image/png;base64,${raw}`;
                    } else if (fallback) {
                      src = fallback;
                    }
                    return src ? (
                      <img src={src} alt="Premio" className="max-h-[70vh] max-w-full object-contain rounded-lg" />
                    ) : (
                      <div className="text-text/60">Sin imagen de premio</div>
                    );
                  })()}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal de autenticación para invitados */}
        <AnimatePresence>
          {showGuestAuthModal && !user && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={handleGuestAuthClose}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="w-full max-w-md bg-dark rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-sm md:text-base font-bold text-text">Inicia sesión para continuar</h3>
                      <p className="text-[11px] md:text-xs text-text/60">
                        Reservamos tu número unos segundos mientras te conectas.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleGuestAuthClose}
                    className="px-3 py-1 rounded-lg bg-glass hover:bg-glass/80 text-xs text-text/80"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="p-4 space-y-4 text-xs md:text-sm text-text/80">
                  {/* Botón principal: Iniciar con Telegram */}
                  <button
                    type="button"
                    onClick={handleGuestTelegramLogin}
                    disabled={loading}
                    className="w-full btn-primary flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span className="text-lg">📲</span>
                    <span>{loading ? 'Conectando con Telegram...' : 'Iniciar sesión con Telegram'}</span>
                  </button>

                  {/* Botón "ESPERA!! SI TENGO TELEGRAM" como en Login */}
                  <button
                    type="button"
                    onClick={() => window.open('https://t.me/mundoxyz_bot', '_blank')}
                    className="w-full bg-warning/20 border border-warning/40 rounded-lg py-2.5 text-warning text-[11px] md:text-xs font-semibold hover:bg-warning/30 transition"
                  >
                    ESPERA!! SI TENGO TELEGRAM
                  </button>

                  <div className="h-px bg-white/10" />

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={navigateToLogin}
                      className="w-full px-4 py-2 rounded-lg bg-glass hover:bg-glass/80 text-xs md:text-sm text-text/90"
                    >
                      Iniciar sesión con email/usuario
                    </button>
                    <button
                      type="button"
                      onClick={navigateToRegister}
                      className="w-full px-4 py-2 rounded-lg bg-accent/20 hover:bg-accent/30 text-xs md:text-sm text-accent font-semibold"
                    >
                      Crear cuenta nueva
                    </button>
                  </div>

                  <p className="text-[11px] md:text-xs text-text/50 text-center mt-2">
                    Si cierras esta ventana o esperas más de 10 segundos, tu selección se liberará
                    automáticamente.
                  </p>
                </div>
              </motion.div>
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
      {showParticipantsModal && code && (
        <ParticipantsModal
          raffleCode={code}
          raffleMode={raffle.mode}
          isHost={user?.id === raffle.hostId}
          onClose={() => setShowParticipantsModal(false)}
        />
      )}
    </motion.div>
  );
};

export default RaffleRoom;
