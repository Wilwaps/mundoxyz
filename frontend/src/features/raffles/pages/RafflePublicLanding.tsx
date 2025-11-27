/**
 * Landing Pública de Rifa
 * Acceso sin autenticación, optimizado para empresas
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Trophy,
  Users,
  TrendingUp,
  Calendar,
  ExternalLink,
  LogIn,
  Loader,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';
import NumberGrid from '../components/NumberGrid';
import ParticipantsModal from '../components/ParticipantsModal';
import type { RaffleNumber, PrizeMeta } from '../types';
import { useAuth } from '../../../contexts/AuthContext';

interface PublicLandingData {
  raffle: {
    code: string;
    name: string;
    description?: string;
    status: string;
    mode: string;
    hostUsername: string;
    entryPriceFire?: number;
    entryPriceCoin?: number;
    potFires: number;
    potCoins: number;
    createdAt: string;
    startsAt?: string;
    endsAt?: string;
    prizeImageBase64?: string;
    prizeMeta?: PrizeMeta;
  };
  company?: {
    name: string;
    rif?: string;
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string;
    logoBase64?: string;
    websiteUrl?: string;
  };
  stats: {
    totalNumbers: number;
    soldNumbers: number;
    reservedNumbers: number;
    availableNumbers: number;
    progress: number;
  };
  numbers: RaffleNumber[];
}

const RafflePublicLanding: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [data, setData] = useState<PublicLandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showAuthRequired, setShowAuthRequired] = useState(false);
  
  useEffect(() => {
    if (!code) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/raffles/v2/public/${code}`);
        
        if (response.data.success) {
          setData(response.data);
        } else {
          setError('No se pudo cargar la información de la rifa');
        }
      } catch (err: any) {
        console.error('Error fetching public landing:', err);
        setError(err.response?.data?.message || 'Rifa no encontrada');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [code]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark via-dark to-dark/95 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-accent animate-spin mx-auto mb-4" />
          <p className="text-text/60">Cargando rifa...</p>
        </div>
      </div>
    );
  }
  
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark via-dark to-dark/95 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-text mb-2">Rifa no encontrada</h2>
          <p className="text-text/60 mb-6">{error}</p>
          <button
            onClick={() => navigate('/raffles')}
            className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            Ver todas las rifas
          </button>
        </div>
      </div>
    );
  }
  
  const { raffle, company, stats, numbers } = data;
  
  const handlePublicNumberClick = (idx: number) => {
    if (!user) {
      setShowAuthRequired(true);
      return;
    }
    if (code) {
      navigate(`/raffles/${code}`);
    } else {
      navigate('/raffles');
    }
  };
  
  // Colores personalizados de empresa o defaults
  const primaryColor = company?.primaryColor || '#8B5CF6';
  const secondaryColor = company?.secondaryColor || '#06B6D4';

  const logoSrc = company?.logoBase64
    ? (company.logoBase64.startsWith('data:image')
        ? company.logoBase64
        : `data:image/png;base64,${company.logoBase64}`)
    : company?.logoUrl;
  
  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-dark via-dark to-dark/95"
      style={{
        backgroundImage: company 
          ? `linear-gradient(135deg, ${primaryColor}15 0%, ${secondaryColor}15 100%)`
          : undefined
      }}
    >
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 py-12">
        {/* Header con Logo Empresa alineado a la izquierda */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          {(company || logoSrc) && (
            <div className="flex items-center gap-4 mb-6">
              {logoSrc && (
                <div className="flex-shrink-0">
                  <img
                    src={logoSrc}
                    alt={company?.name || 'Logo de empresa'}
                    className="h-20 w-20 rounded-lg shadow-lg object-contain bg-dark/40"
                  />
                </div>
              )}
              {company && (
                <div>
                  <h3
                    className="text-2xl font-bold mb-1"
                    style={{ color: primaryColor }}
                  >
                    {company.name}
                  </h3>
                  {company.rif && (
                    <p className="text-sm text-text/60">RIF: {company.rif}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <h1 className="text-4xl sm:text-5xl font-bold text-text mb-4">
            {raffle.name}
          </h1>
          
          {raffle.description && (
            <p className="text-lg text-text/80 max-w-2xl">
              {raffle.description}
            </p>
          )}
        </motion.div>
        
        {/* Estadísticas */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-glass rounded-xl p-4 text-center">
            <Trophy className="w-8 h-8 text-accent mx-auto mb-2" />
            <div className="text-2xl font-bold text-text">{stats.totalNumbers}</div>
            <div className="text-xs text-text/60">Total Números</div>
          </div>
          
          <div className="bg-glass rounded-xl p-4 text-center">
            <Users className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-400">{stats.soldNumbers}</div>
            <div className="text-xs text-text/60">Vendidos</div>
          </div>
          
          <div
            className="bg-glass rounded-xl p-4 text-center cursor-pointer hover:bg-glass-lighter transition-colors"
            onClick={() => {
              if (!user) {
                setShowAuthRequired(true);
                return;
              }
              if (code) {
                navigate(`/raffles/${code}`);
              } else {
                navigate('/raffles');
              }
            }}
          >
            <TrendingUp className="w-8 h-8 text-fire-orange mx-auto mb-2" />
            <div className="text-2xl font-bold text-fire-orange">{stats.progress}%</div>
            <div className="text-xs text-text/60">Progreso</div>
          </div>
          
          <div
            className="bg-glass rounded-xl p-4 text-center cursor-pointer hover:bg-glass-lighter transition-colors"
            onClick={() => {
              if (!user) {
                setShowAuthRequired(true);
                return;
              }
              if (code) {
                navigate(`/raffles/${code}`);
              } else {
                navigate('/raffles');
              }
            }}
          >
            <Calendar className="w-8 h-8 text-text/60 mx-auto mb-2" />
            <div className="text-2xl font-bold text-text">{stats.availableNumbers}</div>
            <div className="text-xs text-text/60">Disponibles</div>
          </div>
        </motion.div>
        
        {/* Barra de Progreso */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <div className="bg-glass rounded-xl p-6">
            <div className="flex justify-between text-sm text-text/80 mb-3">
              <span>{stats.soldNumbers} vendidos</span>
              <span>{stats.progress}% completado</span>
              <span>{stats.availableNumbers} disponibles</span>
            </div>
            <div className="h-4 bg-dark rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stats.progress}%` }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                }}
              />
            </div>
          </div>
        </motion.div>

        {/* Tablero de Números - solo lectura */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <NumberGrid
            totalNumbers={stats.totalNumbers}
            numbers={numbers || []}
            userNumbers={[]}
            onNumberClick={handlePublicNumberClick}
          />
        </motion.div>
        
        {/* Información de la Rifa */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-glass rounded-xl p-6 mb-8"
        >
          <h2 className="text-xl font-bold text-text mb-4">Información de la Rifa</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-text/60 mb-1">Organizador</div>
              <div className="text-text font-medium">{raffle.hostUsername}</div>
            </div>
            
            <div>
              <div className="text-sm text-text/60 mb-1">Estado</div>
              <div className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-400">
                {raffle.status === 'active' ? 'Activa' : raffle.status}
              </div>
            </div>
            
            {raffle.mode !== 'prize' && (
              <div>
                <div className="text-sm text-text/60 mb-1">Precio por Número</div>
                <div className="text-text font-medium">
                  {raffle.entryPriceFire ? `${raffle.entryPriceFire} 🔥` : `${raffle.entryPriceCoin} 🪙`}
                </div>
              </div>
            )}
            
            {raffle.mode === 'fires' && (
              <div>
                <div className="text-sm text-text/60 mb-1">Acumulado</div>
                <div className="text-text font-medium">{raffle.potFires.toLocaleString()} 🔥</div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Botones de Premio y Participantes */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex flex-wrap gap-3 mb-8"
        >
          {(raffle.prizeImageBase64 || raffle.prizeMeta) && (
            <button
              type="button"
              onClick={() => setShowPrizeModal(true)}
              className="px-4 py-2 rounded-lg bg-glass text-text hover:bg-glass-lighter transition-colors text-sm font-medium"
            >
              Ver Premio
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowParticipantsModal(true)}
            className="px-4 py-2 rounded-lg bg-glass text-text hover:bg-glass-lighter transition-colors text-sm font-medium"
          >
            Participantes
          </button>
        </motion.div>
        
        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <button
            onClick={() => {
              if (!user) {
                setShowAuthRequired(true);
                return;
              }
              navigate(`/raffles/${code}`);
            }}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg text-white font-semibold text-lg transition-all hover:scale-105 shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
            }}
          >
            <LogIn className="w-6 h-6" />
            Participar en la Rifa
          </button>
          
          <p className="text-sm text-text/60 mt-4">
            Inicia sesión o regístrate para comprar tus números
          </p>
          
          {company?.websiteUrl && (
            <a
              href={company.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-text/60 hover:text-accent mt-4 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Visitar sitio web de {company.name}
            </a>
          )}
        </motion.div>
      </div>

      {/* Modal: requiere autenticación para participar */}
      {showAuthRequired && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowAuthRequired(false)}
        >
          <div
            className="w-full max-w-md bg-dark rounded-2xl shadow-2xl border border-white/10 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-text mb-2">¿Quieres participar en esta rifa?</h3>
            <p className="text-sm text-text/70 mb-6">
              Para comprar números necesitas una cuenta en MUNDOXYZ. Crea tu cuenta en segundos o inicia sesión si ya tienes una.
            </p>
            <div className="space-y-3">
              <button
                type="button"
                className="w-full btn-accent flex items-center justify-center gap-2"
                onClick={() => {
                  const nextPath = code ? `/raffles/${code}` : '/raffles';
                  navigate(`/register?next=${encodeURIComponent(nextPath)}`);
                }}
              >
                Crear cuenta y participar
              </button>
              <button
                type="button"
                className="w-full btn-secondary flex items-center justify-center gap-2"
                onClick={() => {
                  const nextPath = code ? `/raffles/${code}` : '/raffles';
                  navigate(`/login?next=${encodeURIComponent(nextPath)}`);
                }}
              >
                Ya tengo cuenta / Iniciar sesión
              </button>
              <button
                type="button"
                className="w-full px-4 py-2 rounded-lg bg-glass text-text/70 hover:bg-glass/80 text-sm"
                onClick={() => setShowAuthRequired(false)}
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de imagen de premio */}
      {showPrizeModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPrizeModal(false)}
        >
          <div
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
                const fallback = (raffle.prizeMeta as PrizeMeta | undefined)?.prizeImages?.[0];
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
          </div>
        </div>
      )}

      {/* Modal de participantes (público, sin acciones de host) */}
      {showParticipantsModal && (
        <ParticipantsModal
          raffleCode={raffle.code}
          raffleMode={raffle.mode}
          isHost={false}
          onClose={() => setShowParticipantsModal(false)}
        />
      )}
    </div>
  );
};

export default RafflePublicLanding;

