/**
 * Landing Empresarial Premium para Rifas
 * Diseño minimalista y elegante que inspira confianza
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Users,
  Clock,
  Shield,
  Star,
  Award,
  CheckCircle,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Heart,
  Building2
} from 'lucide-react';
import { useRaffle } from '../hooks/useRaffleData';
import NumberGrid from '../components/NumberGrid';
import PurchaseModal from '../components/PurchaseModal';
import ParticipantsModal from '../components/ParticipantsModal';

interface CompanyLandingProps {}

const CompanyLanding: React.FC<CompanyLandingProps> = () => {
  const { code } = useParams<{ code: string }>();
  const { raffle, numbers, isLoading, error } = useRaffle(code || '');
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  
  // Colores de la empresa con fallback elegante
  const primaryColor = raffle?.companyConfig?.primaryColor || '#8B5CF6';
  const secondaryColor = raffle?.companyConfig?.secondaryColor || '#06B6D4';
  
  // Estadísticas en tiempo real
  const stats = {
    totalNumbers: raffle?.numbersRange || 0,
    soldNumbers: numbers?.filter(n => n.state === 'sold').length || 0,
    participants: new Set(numbers?.filter(n => n.state === 'sold').map(n => n.ownerId)).size || 0,
    progress: Math.round(((numbers?.filter(n => n.state === 'sold').length || 0) / (raffle?.numbersRange || 1)) * 100),
    timeLeft: raffle?.endsAt ? Math.max(0, new Date(raffle.endsAt).getTime() - Date.now()) : null
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-t-transparent rounded-full"
          style={{ borderColor: primaryColor }}
        />
      </div>
    );
  }
  
  if (error || !raffle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Rifa no encontrada</h1>
          <p className="text-gray-600">Por favor verifica el enlace e intenta nuevamente</p>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      className="min-h-screen relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${primaryColor}10 0%, ${secondaryColor}10 100%)`
      }}
    >
      {/* Logo como marca de agua */}
      {raffle.companyConfig?.logoUrl && (
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ opacity: 0.15 }}
        >
          <img 
            src={raffle.companyConfig.logoUrl} 
            alt="Logo" 
            className="w-96 h-96 object-contain"
          />
        </div>
      )}
      
      {/* Header Premium */}
      <header className="relative z-10 bg-white/90 backdrop-blur-lg shadow-xl">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            {/* Logo y nombre de empresa */}
            <div className="flex items-center gap-4">
              {raffle.companyConfig?.logoUrl && (
                <img 
                  src={raffle.companyConfig.logoUrl} 
                  alt={raffle.companyConfig.companyName}
                  className="h-12 w-12 object-contain"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {raffle.companyConfig?.companyName || 'Empresa'}
                </h1>
                <p className="text-sm text-gray-600">Rifa oficial certificada</p>
              </div>
            </div>
            
            {/* Trust badges */}
            <div className="hidden md:flex items-center gap-6">
              <div className="flex items-center gap-2 text-green-600">
                <Shield className="w-5 h-5" />
                <span className="text-sm font-medium">100% Seguro</span>
              </div>
              <div className="flex items-center gap-2 text-blue-600">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Verificado</span>
              </div>
              <div className="flex items-center gap-2 text-purple-600">
                <Award className="w-5 h-5" />
                <span className="text-sm font-medium">Premium</span>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <section className="relative z-10 container mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 rounded-full shadow-lg mb-6">
            <Sparkles className="w-5 h-5" style={{ color: primaryColor }} />
            <span className="text-sm font-semibold" style={{ color: primaryColor }}>
              SORTEO EXCLUSIVO
            </span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            {raffle.name}
          </h1>
          
          <p className="text-xl text-gray-700 mb-8 leading-relaxed">
            {raffle.description || 'Participa en esta increíble oportunidad de ganar premios exclusivos'}
          </p>
          
          {/* CTA Principal */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowPurchaseModal(true)}
            className="inline-flex items-center gap-3 px-8 py-4 text-white font-bold text-lg rounded-full shadow-2xl transition-all"
            style={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
            }}
          >
            <Trophy className="w-6 h-6" />
            Participar Ahora
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>
      </section>
      
      {/* Estadísticas en tiempo real */}
      <section className="relative z-10 container mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {[
            { 
              icon: Users, 
              label: 'Participantes', 
              value: stats.participants,
              color: primaryColor 
            },
            { 
              icon: TrendingUp, 
              label: 'Progreso', 
              value: `${stats.progress}%`,
              color: secondaryColor 
            },
            { 
              icon: Trophy, 
              label: 'Números Vendidos', 
              value: `${stats.soldNumbers}/${stats.totalNumbers}`,
              color: primaryColor 
            },
            { 
              icon: Clock, 
              label: 'Tiempo Restante', 
              value: stats.timeLeft ? formatTimeLeft(stats.timeLeft) : 'Sin límite',
              color: secondaryColor 
            }
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/90 backdrop-blur rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-shadow"
            >
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: `${stat.color}20` }}
              >
                <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
              </div>
              <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </motion.div>
          ))}
        </div>
      </section>
      
      {/* Barra de progreso visual */}
      <section className="relative z-10 container mx-auto px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white/90 backdrop-blur rounded-full p-2 shadow-xl">
            <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stats.progress}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-gray-700">
                  {stats.progress}% Completado
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Grid de números */}
      <section className="relative z-10 container mx-auto px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-gray-900">
                Selecciona tus números
              </h2>
              <button
                onClick={() => setShowParticipantsModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                <Users className="w-5 h-5" />
                <span className="font-medium">Ver Participantes</span>
                <span 
                  className="px-2 py-1 text-xs font-bold text-white rounded-full"
                  style={{ backgroundColor: primaryColor }}
                >
                  {stats.participants}
                </span>
              </button>
            </div>
            
            <NumberGrid
              totalNumbers={raffle.numbersRange}
              numbers={numbers}
              onNumberClick={(idx) => {
                if (selectedNumbers.includes(idx)) {
                  setSelectedNumbers(prev => prev.filter(n => n !== idx));
                } else {
                  setSelectedNumbers(prev => [...prev, idx]);
                }
              }}
              selectedNumbers={selectedNumbers}
              isSelecting={true}
            />
            
            {selectedNumbers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 p-6 bg-gradient-to-r rounded-2xl"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${primaryColor}10 0%, ${secondaryColor}10 100%)`
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Números seleccionados</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {selectedNumbers.sort((a, b) => a - b).join(', ')}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPurchaseModal(true)}
                    className="px-6 py-3 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
                    style={{
                      background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                    }}
                  >
                    Comprar {selectedNumbers.length} número{selectedNumbers.length > 1 ? 's' : ''}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </section>
      
      {/* Sección de confianza */}
      <section className="relative z-10 container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">
            ¿Por qué participar con nosotros?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: 'Transparencia Total',
                description: 'Proceso verificable y sorteo público con testigos'
              },
              {
                icon: Heart,
                title: 'Impacto Social',
                description: 'Tu participación apoya causas importantes'
              },
              {
                icon: Star,
                title: 'Premios Garantizados',
                description: 'Entrega certificada y documentada de todos los premios'
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/90 backdrop-blur rounded-2xl p-6 shadow-xl"
              >
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: `${primaryColor}20` }}
                >
                  <feature.icon className="w-8 h-8" style={{ color: primaryColor }} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="relative z-10 bg-gray-900 text-white py-12 mt-20">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-6 md:mb-0">
              <h3 className="text-xl font-bold mb-2">
                {raffle.companyConfig?.companyName || 'Empresa'}
              </h3>
              <p className="text-gray-400">
                Rifa oficial certificada por MundoXYZ
              </p>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-400">
                  RIF: {raffle.companyConfig?.rifNumber || 'J-00000000-0'}
                </span>
              </div>
              <div className="text-sm text-gray-400">
                © 2025 Todos los derechos reservados
              </div>
            </div>
          </div>
        </div>
      </footer>
      
      {/* Modales */}
      <AnimatePresence>
        {showPurchaseModal && (
          <PurchaseModal
            isOpen={showPurchaseModal}
            raffle={raffle}
            selectedNumbers={selectedNumbers}
            onClose={() => setShowPurchaseModal(false)}
            onSuccess={() => {
              setSelectedNumbers([]);
              setShowPurchaseModal(false);
            }}
          />
        )}
        
        {showParticipantsModal && (
          <ParticipantsModal
            raffleCode={code!}
            raffleMode={raffle.mode}
            isHost={false}
            onClose={() => setShowParticipantsModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Función helper para formatear tiempo restante
function formatTimeLeft(ms: number): string {
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} minutos`;
}

export default CompanyLanding;
