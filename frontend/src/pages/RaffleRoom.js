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
  FaLock, FaUnlock, FaHourglassHalf, FaStar, FaHistory
} from 'react-icons/fa';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MathCaptcha from '../components/MathCaptcha';
import NumberGrid from '../components/raffles/NumberGrid';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';

const RaffleRoom = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

  // Mutación para comprar número
  const purchaseMutation = useMutation({
    mutationFn: async ({ number, captcha_data }) => {
      const response = await fetch('/api/raffles/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          raffle_id: raffle.id,
          number,
          captcha_data
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al comprar número');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast.success('¡Número comprado exitosamente!');
      setShowBuyModal(false);
      setSelectedNumber(null);
      setCaptchaAnswer('');
      // Refrescar datos
      queryClient.invalidateQueries(['raffle', code]);
      queryClient.invalidateQueries(['raffle-numbers', code]);
      setRefreshTrigger(prev => prev + 1);
    },
    onError: (error) => {
      toast.error(error.message || 'Error al comprar el número');
    }
  });

  // Generar nuevo CAPTCHA
  const generateCaptcha = () => {
    setCaptchaAnswer('');
  };

  // Comprar número
  const handlePurchase = () => {
    if (!selectedNumber || !captchaAnswer) {
      toast.error('Completa todos los campos');
      return;
    }

    purchaseMutation.mutate({
      number: selectedNumber,
      captcha_data: {
        question: captchaData?.question,
        answer: captchaAnswer
      }
    });
  };

  // Verificar si un número está disponible
  const isNumberAvailable = (num) => {
    return numbers?.find(n => n.number === num)?.status === 'available';
  };

  // Verificar si el usuario ya compró un número
  const userOwnsNumber = (num) => {
    return numbers?.find(n => n.number === num)?.purchased_by === user?.id;
  };

  const captchaData = MathCaptcha.generateCaptcha();

  useEffect(() => {
    if (error) {
      toast.error('Error al cargar la rifa');
    }
  }, [error]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-blue-900/20 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!raffle) {
    return (
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
    );
  }

  const progress = raffle.total_numbers > 0 
    ? (raffle.purchased_count / raffle.total_numbers) * 100 
    : 0;

  return (
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
              <button
                onClick={() => window.open(`/raffles/${code}/share`, '_blank')}
                className="text-white/60 hover:text-white transition-colors"
              >
                Compartir
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
                setShowBuyModal(true);
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

      {/* Modal de compra */}
      <AnimatePresence>
        {showBuyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowBuyModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gradient-to-br from-purple-900/90 to-pink-900/90 rounded-3xl max-w-md w-full border border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-white/20">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <FaShoppingCart className="text-green-400" />
                  Comprar Número #{selectedNumber}
                </h3>
                <button
                  onClick={() => setShowBuyModal(false)}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  {/* Detalles de compra */}
                  <div className="p-4 bg-white/10 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white/80">Número seleccionado:</span>
                      <span className="text-white font-bold">#{selectedNumber}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Costo:</span>
                      <span className="text-green-400 font-bold">
                        {raffle.cost_per_number} fuegos
                      </span>
                    </div>
                  </div>

                  {/* CAPTCHA */}
                  <div>
                    <label className="block text-white font-semibold mb-2">
                      Verificación de Seguridad
                    </label>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-center mb-4">
                        <div className="text-2xl font-bold text-white mb-2">
                          {captchaData.question}
                        </div>
                        <div className="text-white/60 text-sm">
                          Resuelve la operación para continuar
                        </div>
                      </div>
                      <input
                        type="text"
                        value={captchaAnswer}
                        onChange={(e) => setCaptchaAnswer(e.target.value)}
                        placeholder="Tu respuesta"
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 text-center"
                      />
                      <button
                        type="button"
                        onClick={generateCaptcha}
                        className="w-full mt-2 text-purple-400 hover:text-purple-300 text-sm transition-colors"
                      >
                        Generar nueva operación
                      </button>
                    </div>
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex space-x-3 mt-6">
                  <button
                    onClick={() => setShowBuyModal(false)}
                    className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handlePurchase}
                    disabled={purchaseMutation.isLoading || !captchaAnswer}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity/50 text-white rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    {purchaseMutation.isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Comprando...
                      </>
                    ) : (
                      <>
                        <FaShoppingCart />
                        Comprar Ahora
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RaffleRoom;
