/**
 * RaffleRoom.js - Página principal de una rifa
 * Detalles completos, compra de números, grid interactivo
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaTimes, FaFire, FaGift, FaBuilding, FaTrophy, FaUsers,
  FaClock, FaEye, FaChartLine, FaCheck, FaShoppingCart,
  FaTicketAlt, FaQrcode, FaShieldAlt, FaCoins, FaTag,
  FaLock, FaUnlock, FaHourglassHalf, FaStar, FaHistory,
  FaDollarSign, FaShareAlt, FaCopy
} from 'react-icons/fa';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MathCaptcha from '../components/MathCaptcha';
import NumberGrid from '../components/raffles/NumberGrid';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import PaymentDetailsModal from '../components/raffles/PaymentDetailsModal';
import BuyNumberModal from '../components/raffles/BuyNumberModal';
import ParticipantsModal from '../components/raffles/ParticipantsModal';

const RaffleRoom = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  const [selectedNumber, setSelectedNumber] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Estados para modales de sistema de pagos
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);
  const [showBuyNumberModal, setShowBuyNumberModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState(null);

  // Consulta principal de la rifa
  const { 
    data: raffle, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['raffle', code, refreshTrigger],
    queryFn: async () => {
      const response = await fetch(`/api/raffles/${code}`);
      if (!response.ok) {
        throw new Error('Rifa no encontrada');
      }
      const result = await response.json();
      return result.data;
    },
    refetchInterval: 5000 // Actualizar cada 5 segundos
  });

  // Consulta de números de la rifa
  const { data: numbers } = useQuery({
    queryKey: ['raffle-numbers', code],
    queryFn: async () => {
      const response = await fetch(`/api/raffles/${code}/numbers`);
      if (!response.ok) throw new Error('Error al cargar números');
      const result = await response.json();
      return result.data;
    },
    enabled: !!raffle,
    refetchInterval: 10000 // Actualizar cada 10 segundos
  });

  // Verificar si un número está disponible
  const isNumberAvailable = (num) => {
    return numbers?.find(n => n.number === num)?.status === 'available';
  };

  // Verificar si el usuario ya compró un número
  const userOwnsNumber = (num) => {
    return numbers?.find(n => n.number === num)?.purchased_by === user?.id;
  };

  // Función para copiar enlace público (modo empresa)
  const handleCopyPublicLink = () => {
    const publicUrl = `${window.location.origin}/raffles/public/${raffle.code}`;
    navigator.clipboard.writeText(publicUrl).then(() => {
      toast.success('¡Enlace copiado al portapapeles!');
    }).catch(() => {
      toast.error('Error al copiar enlace');
    });
  };

  // Abrir modal de compra (siempre usar BuyNumberModal completo)
  const handleNumberClick = (numberIdx) => {
    setSelectedNumber(numberIdx);
    setShowBuyNumberModal(true);
  };

  // Guardar datos de pago actualizados
  const handlePaymentDetailsSaved = (updatedData) => {
    setPaymentDetails(updatedData);
    toast.success('Datos de pago actualizados correctamente');
    refetch();
  };

  // Compra exitosa en modo Premio/Empresa
  const handleBuyNumberSuccess = () => {
    toast.success('¡Solicitud enviada! Espera la aprobación del anfitrión');
    refetch();
    queryClient.invalidateQueries(['raffle-numbers', code]);
  };

  useEffect(() => {
    if (error) {
      toast.error('Error al cargar la rifa');
    }
  }, [error]);

  // WebSocket: Sincronización en tiempo real de rifas
  useEffect(() => {
    if (!socket || !raffle) return;

    const raffleRoom = `raffle-${raffle.id}`;
    
    // Unirse a la sala de la rifa
    socket.emit('join-raffle', raffle.id);
    console.log('🔌 Socket conectado a rifa:', raffle.id);

    // 1. Número reservado (alguien abrió el modal)
    const handleNumberReserved = (data) => {
      console.log('🔒 Número reservado:', data);
      queryClient.invalidateQueries(['raffle-numbers', code]);
      toast.info(`Número ${data.numberIdx} reservado temporalmente`);
    };

    // 2. Número liberado (cerró modal sin comprar)
    const handleNumberReleased = (data) => {
      console.log('🔓 Número liberado:', data);
      queryClient.invalidateQueries(['raffle-numbers', code]);
    };

    // 3. Número comprado (solicitud aprobada)
    const handleNumberPurchased = (data) => {
      console.log('💰 Número comprado:', data);
      queryClient.invalidateQueries(['raffle-numbers', code]);
      queryClient.invalidateQueries(['raffle', code]);
      toast.success(`¡Número ${data.numberIdx} vendido!`);
    };

    // 4. Nueva solicitud pendiente (solo para host)
    const handleNewRequest = (data) => {
      console.log('📩 Nueva solicitud:', data);
      if (raffle.host_id === user?.id) {
        queryClient.invalidateQueries(['raffle', code]);
        toast.info('Nueva solicitud de compra pendiente', {
          icon: '🔔'
        });
      }
    };

    // 5. Rifa actualizada (cambio de estado, progreso, etc)
    const handleRaffleUpdated = (data) => {
      console.log('🔄 Rifa actualizada:', data);
      queryClient.invalidateQueries(['raffle', code]);
      queryClient.invalidateQueries(['raffle-numbers', code]);
    };

    // 6. Rifa completada/sorteada
    const handleRaffleCompleted = (data) => {
      console.log('🎉 Rifa completada:', data);
      queryClient.invalidateQueries(['raffle', code]);
      toast.success('¡Rifa completada! Revisando ganadores...', {
        duration: 5000
      });
    };

    // Registrar todos los listeners
    socket.on('raffle:number-reserved', handleNumberReserved);
    socket.on('raffle:number-released', handleNumberReleased);
    socket.on('raffle:number-purchased', handleNumberPurchased);
    socket.on('raffle:new-request', handleNewRequest);
    socket.on('raffle:updated', handleRaffleUpdated);
    socket.on('raffle:completed', handleRaffleCompleted);

    // Cleanup al desmontar
    return () => {
      console.log('🔌 Desconectando de rifa:', raffle.id);
      socket.off('raffle:number-reserved', handleNumberReserved);
      socket.off('raffle:number-released', handleNumberReleased);
      socket.off('raffle:number-purchased', handleNumberPurchased);
      socket.off('raffle:new-request', handleNewRequest);
      socket.off('raffle:updated', handleRaffleUpdated);
      socket.off('raffle:completed', handleRaffleCompleted);
      socket.emit('leave-raffle', raffle.id);
    };
  }, [socket, raffle, code, queryClient, user]);

  if (isLoading) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-blue-900/20 flex items-center justify-center">
          <LoadingSpinner size="large" />
        </div>
        
        {/* Botón flotante mientras carga */}
        <div className="fixed bottom-32 right-24 md:bottom-8 md:right-8 flex flex-col gap-4 z-[12000] pointer-events-auto">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full shadow-2xl flex items-center justify-center opacity-50">
            <FaUsers size={24} className="text-white" />
          </div>
        </div>
      </>
    );
  }

  if (!raffle) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-blue-900/20 flex items-center justify-center">
          <div className="text-center">
            <FaTrophy className="text-6xl text-white/20 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Rifa no encontrada</h2>
            <p className="text-white/60 mb-6">La rifa que buscas no existe o fue eliminada</p>
            <button
              onClick={() => navigate('/raffles/lobby')}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-300"
            >
              Volver al Lobby
            </button>
          </div>
        </div>
        
        {/* Botón flotante Participantes - SIEMPRE VISIBLE incluso sin rifa */}
        <div className="fixed bottom-32 right-24 md:bottom-8 md:right-8 flex flex-col gap-4 z-[12000] pointer-events-auto">
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowParticipantsModal(true)}
            className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:shadow-blue-500/50 transition-all duration-300"
            title="Ver participantes"
          >
            <FaUsers size={24} />
          </motion.button>
        </div>
      </>
    );
  }

  const progress = raffle.total_numbers > 0 
    ? (raffle.purchased_count / raffle.total_numbers) * 100 
    : 0;

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-blue-900/20">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/10 backdrop-blur-md border-b border-white/20"
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/raffles/lobby')}
              className="text-white/60 hover:text-white transition-colors flex items-center gap-2"
            >
              <FaTimes /> Volver al Lobby
            </button>
            
            <div className="flex items-center gap-4">
              <span className="text-white/60 text-sm">
                Código: <span className="text-white font-semibold">{raffle.code}</span>
              </span>
              
              {/* Botón Participantes */}
              <button
                onClick={() => setShowParticipantsModal(true)}
                className="text-white/60 hover:text-white transition-colors flex items-center gap-2"
                title="Ver participantes"
              >
                <FaUsers /> Participantes
              </button>
              
              {/* Botón Mis datos de pago (solo host y modo premio/empresa) */}
              {raffle.host_id === user?.id && (raffle.mode === 'prize' || raffle.mode === 'company') && (
                <button
                  onClick={() => setShowPaymentDetailsModal(true)}
                  className="text-white/60 hover:text-white transition-colors flex items-center gap-2"
                  title="Configurar datos de pago"
                >
                  <FaDollarSign /> Mis datos de pago
                </button>
              )}
              
              {/* Botón Copiar enlace público (solo modo empresa) */}
              {raffle.mode === 'company' && (
                <button
                  onClick={handleCopyPublicLink}
                  className="text-white/60 hover:text-white transition-colors flex items-center gap-2"
                  title="Copiar enlace público"
                >
                  <FaCopy /> Enlace público
                </button>
              )}
              
              <button
                onClick={() => window.open(`/raffles/${code}/share`, '_blank')}
                className="text-white/60 hover:text-white transition-colors flex items-center gap-2"
              >
                <FaShareAlt /> Compartir
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Información principal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-md rounded-3xl p-8 mb-6 border border-white/20"
        >
          {/* Header con branding */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              {raffle.is_company_mode && raffle.logo_url && (
                <img 
                  src={raffle.logo_url} 
                  alt={raffle.company_name}
                  className="w-16 h-16 rounded-xl object-cover border-2 border-white/20"
                  style={{ borderColor: raffle.primary_color }}
                />
              )}
              <div>
                <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                  {raffle.name}
                  {raffle.is_company_mode && (
                    <FaBuilding className="text-purple-400" title="Modo Empresa" />
                  )}
                  {raffle.mode === 'prize' && (
                    <FaGift className="text-green-400" title="Modo Premio" />
                  )}
                </h1>
                <p className="text-white/70 text-lg mb-2">
                  por {raffle.host_username}
                </p>
                <div className="flex items-center gap-4 text-white/60 text-sm">
                  <span className="flex items-center gap-1">
                    <FaClock />
                    Creada: {new Date(raffle.created_at).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <FaEye />
                    {raffle.view_count || 0} vistas
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-end space-y-2">
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                raffle.status === 'pending' 
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : raffle.status === 'active'
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                  : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
              }`}>
                {raffle.status === 'pending' ? '🟢 Activa' : 
                 raffle.status === 'active' ? '🟡 En Curso' : '⚪ Finalizada'}
              </span>
              {raffle.is_company_mode && (
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <FaBuilding style={{ color: raffle.primary_color }} />
                  {raffle.company_name}
                </div>
              )}
            </div>
          </div>

          {/* Descripción */}
          {raffle.description && (
            <div className="mb-6 p-4 bg-white/5 rounded-xl">
              <p className="text-white/90">{raffle.description}</p>
            </div>
          )}

          {/* Métricas principales */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl p-4 border border-orange-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/80 text-sm">PREMIO ACTUAL</span>
                {raffle.mode === 'fire' ? (
                  <FaFire className="text-orange-400" />
                ) : (
                  <FaCoins className="text-yellow-400" />
                )}
              </div>
              <div className="text-2xl font-bold text-white">
                {raffle.mode === 'fire' 
                  ? `${parseFloat(raffle.pot_fires || 0).toFixed(2)} 🔥`
                  : `${parseFloat(raffle.pot_coins || 0).toFixed(2)} 🪙`
                }
              </div>
              <div className="text-white/60 text-xs mt-1">
                70% para el ganador
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl p-4 border border-blue-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/80 text-sm">PROGRESO</span>
                <FaChartLine className="text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {raffle.purchased_count}/{raffle.total_numbers}
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 mt-2">
                <div 
                  className="bg-gradient-to-r from-blue-400 to-purple-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl p-4 border border-green-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/80 text-sm">PARTICIPANTES</span>
                <FaUsers className="text-green-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {raffle.participant_count || 0}
              </div>
              <div className="text-white/60 text-xs mt-1">
                Únicos compradores
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl p-4 border border-purple-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/80 text-sm">PRECIO</span>
                <FaTag className="text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {parseFloat(raffle.cost_per_number || 10).toFixed(2)}
              </div>
              <div className="text-white/60 text-xs mt-1">
                {raffle.mode === 'fire' ? 'fuegos por número' : 'fuegos por número'}
              </div>
            </div>
          </div>

          {/* Configuración especial */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {raffle.mode === 'prize' && raffle.prize_meta && (
              <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <FaGift className="text-green-400" />
                  Premio Detallado
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="text-white/80">
                    <strong>Descripción:</strong> {raffle.prize_meta.description}
                  </div>
                  {raffle.prize_meta.estimated_value && (
                    <div className="text-white/80">
                      <strong>Valor Estimado:</strong> {raffle.prize_meta.estimated_value}
                    </div>
                  )}
                  {raffle.prize_meta.delivery_info && (
                    <div className="text-white/80">
                      <strong>Entrega:</strong> {raffle.prize_meta.delivery_info}
                    </div>
                  )}
                  <div className="text-green-400 text-xs mt-2">
                    <FaShieldAlt className="inline mr-1" />
                    Las compras requieren aprobación del host
                  </div>
                </div>
              </div>
            )}

            {raffle.is_company_mode && raffle.company_config && (
              <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <FaBuilding className="text-purple-400" />
                  Empresa Organizadora
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="text-white/80">
                    <strong>Nombre:</strong> {raffle.company_config.company_name}
                  </div>
                  <div className="text-white/80">
                    <strong>RIF:</strong> {raffle.company_config.company_rif}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div 
                      className="w-6 h-6 rounded-full border border-white/20"
                      style={{ backgroundColor: raffle.company_config.primary_color }}
                    />
                    <div 
                      className="w-6 h-6 rounded-full border border-white/20"
                      style={{ backgroundColor: raffle.company_config.secondary_color }}
                    />
                    <span className="text-white/60 text-xs">Colores de marca</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Grid de números */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-md rounded-3xl p-8 mb-6 border border-white/20"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <FaQrcode className="text-purple-400" />
              Números de la Rifa
            </h2>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <FaClock />
              Actualizar
            </button>
          </div>

          <NumberGrid
            numbers={numbers}
            onNumberClick={(num) => {
              if (raffle.status === 'pending' && isNumberAvailable(num)) {
                setSelectedNumber(num);
                setShowBuyNumberModal(true);  // ← CORRECCIÓN: Usar modal completo
              }
            }}
            userPurchases={numbers?.filter(n => n.purchased_by === user?.id) || []}
            disabled={raffle.status !== 'pending'}
            user={user}
          />
        </motion.div>

        {/* Historial y reglas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Mis números */}
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FaTicketAlt className="text-blue-400" />
              Mis Números
            </h3>
            {numbers?.filter(n => n.purchased_by === user?.id).length > 0 ? (
              <div className="space-y-2">
                {numbers.filter(n => n.purchased_by === user?.id).map(num => (
                  <div key={num.number} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-white font-semibold">#{num.number}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-green-400 text-sm">Comprado</span>
                      <FaCheck className="text-green-400" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FaTicketAlt className="text-4xl text-white/20 mx-auto mb-2" />
                <p className="text-white/60">No tienes números comprados</p>
              </div>
            )}
          </div>

          {/* Reglas y términos */}
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FaShieldAlt className="text-yellow-400" />
              Reglas y Términos
            </h3>
            <div className="space-y-3 text-sm text-white/80">
              <div className="flex items-start gap-2">
                <FaCheck className="text-green-400 mt-1" />
                <span>Cada número cuesta {raffle.cost_per_number} fuegos</span>
              </div>
              <div className="flex items-start gap-2">
                <FaCheck className="text-green-400 mt-1" />
                <span>El ganador recibe el 70% del pozo acumulado</span>
              </div>
              <div className="flex items-start gap-2">
                <FaCheck className="text-green-400 mt-1" />
                <span>El host recibe el 20% como comisión</span>
              </div>
              {raffle.mode === 'prize' && (
                <div className="flex items-start gap-2">
                  <FaHourglassHalf className="text-yellow-400 mt-1" />
                  <span>Las compras requieren aprobación manual del host</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <FaLock className="text-purple-400 mt-1" />
                <span>El sorteo se realiza automáticamente al completar los números</span>
              </div>
            </div>
            
            {raffle.terms_conditions && (
              <div className="mt-4 p-3 bg-white/5 rounded-lg">
                <h4 className="text-white font-semibold mb-2">Términos Especiales:</h4>
                <p className="text-white/70 text-sm">{raffle.terms_conditions}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Modal de compra - Usando BuyNumberModal completo */}
      
      {/* Modales del sistema de pagos */}
      {showPaymentDetailsModal && (
        <PaymentDetailsModal
          raffleId={raffle.id}
          currentData={paymentDetails}
          onClose={() => setShowPaymentDetailsModal(false)}
          onSave={handlePaymentDetailsSaved}
        />
      )}
      
      {showBuyNumberModal && selectedNumber && (
        <BuyNumberModal
          raffle={raffle}
          numberIdx={selectedNumber}
          onClose={() => {
            setShowBuyNumberModal(false);
            setSelectedNumber(null);
          }}
          onSuccess={handleBuyNumberSuccess}
        />
      )}
      
      {showParticipantsModal && (
        <ParticipantsModal
          raffleId={raffle.id}
          onClose={() => setShowParticipantsModal(false)}
        />
      )}

      {/* Modal simple de solicitudes pendientes */}
      {showRequestsModal && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowRequestsModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                <FaShoppingCart className="text-yellow-400" />
                Solicitudes Pendientes
              </h2>
              <button
                onClick={() => setShowRequestsModal(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <FaTimes size={24} />
              </button>
            </div>

            {raffle.pending_requests && raffle.pending_requests.length > 0 ? (
              <div className="space-y-4">
                {raffle.pending_requests.map((request) => (
                  <div 
                    key={request.id}
                    className="bg-white/5 rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-white font-bold text-lg">
                            Usuario: {request.user_username || 'Anónimo'}
                          </span>
                          <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-sm">
                            Pendiente
                          </span>
                        </div>
                        <div className="text-white/80 space-y-1">
                          <p>📞 Teléfono: {request.buyer_profile?.phone || 'No especificado'}</p>
                          <p>💳 Método: {request.buyer_profile?.payment_method || 'No especificado'}</p>
                          <p>📅 Fecha: {new Date(request.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={async () => {
                            try {
                              await fetch(`/api/raffles/approve-purchase`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                                },
                                body: JSON.stringify({ request_id: request.id })
                              });
                              toast.success('Solicitud aprobada');
                              refetch();
                              setShowRequestsModal(false);
                            } catch (error) {
                              toast.error('Error al aprobar solicitud');
                            }
                          }}
                          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                        >
                          ✅ Aprobar
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await fetch(`/api/raffles/reject-purchase`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                                },
                                body: JSON.stringify({ request_id: request.id })
                              });
                              toast.success('Solicitud rechazada');
                              refetch();
                              setShowRequestsModal(false);
                            } catch (error) {
                              toast.error('Error al rechazar solicitud');
                            }
                          }}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                        >
                          ❌ Rechazar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FaShoppingCart className="text-6xl text-white/20 mx-auto mb-4" />
                <p className="text-white/60 text-lg">No hay solicitudes pendientes</p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>

    {/* Botones flotantes - FUERA del scroll container */}
    <div
      className="fixed bottom-32 right-24 md:bottom-8 md:right-8 flex flex-col gap-4 z-[12000] pointer-events-auto"
    >
      {/* Botón flotante Participantes - TODOS */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowParticipantsModal(true)}
        className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:shadow-blue-500/50 transition-all duration-300"
        title="Ver participantes"
      >
        <FaUsers size={24} />
      </motion.button>

      {/* Botón flotante Ver Solicitudes (solo host en modo premio) */}
      {raffle.host_id === user?.id && raffle.mode === 'prize' && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowRequestsModal(true)}
          className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:shadow-yellow-500/50 transition-all duration-300 relative"
          title="Ver solicitudes pendientes"
        >
          <FaShoppingCart size={24} />
          {raffle.pending_requests?.length > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {raffle.pending_requests.length}
            </span>
          )}
        </motion.button>
      )}

      {/* Botón flotante Datos de pago (solo host en modo premio/empresa) */}
      {raffle.host_id === user?.id && (raffle.mode === 'prize' || raffle.mode === 'company') && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowPaymentDetailsModal(true)}
          className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:shadow-green-500/50 transition-all duration-300"
          title="Configurar datos de pago"
        >
          <FaDollarSign size={24} />
        </motion.button>
      )}

      {/* Botón flotante Cerrar Rifa (solo host, si está en pending) */}
      {raffle.host_id === user?.id && raffle.status === 'pending' && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={async () => {
            if (window.confirm('¿Cerrar la rifa y proceder al sorteo?')) {
              try {
                await axios.post(
                  `${API_URL}/api/raffles/${raffle.id}/close`,
                  {},
                  {
                    headers: {
                      Authorization: `Bearer ${localStorage.getItem('token')}`
                    }
                  }
                );
                toast.success('Rifa cerrada. Procediendo al sorteo...');
                refetch();
              } catch (err) {
                toast.error(err.response?.data?.error || 'Error al cerrar rifa');
              }
            }
          }}
          className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:shadow-purple-500/50 transition-all duration-300"
          title="Cerrar rifa y sortear"
        >
          <FaTrophy size={24} />
        </motion.button>
      )}

      {/* Botón flotante Cancelar Rifa (solo host, si está en pending) */}
      {raffle.host_id === user?.id && raffle.status === 'pending' && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={async () => {
            if (window.confirm('¿Cancelar la rifa? Se reembolsarán los fuegos a los compradores.')) {
              try {
                await axios.post(
                  `${API_URL}/api/raffles/${raffle.id}/cancel`,
                  {},
                  {
                    headers: {
                      Authorization: `Bearer ${localStorage.getItem('token')}`
                    }
                  }
                );
                toast.success('Rifa cancelada. Reembolsos procesados.');
                navigate('/raffles/lobby');
              } catch (err) {
                toast.error(err.response?.data?.error || 'Error al cancelar rifa');
              }
            }
          }}
          className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:shadow-red-500/50 transition-all duration-300"
          title="Cancelar rifa"
        >
          <FaTimes size={24} />
        </motion.button>
      )}
    </div>
    </>
  );
};

export default RaffleRoom;
