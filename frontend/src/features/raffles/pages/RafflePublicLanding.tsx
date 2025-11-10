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
import toast from 'react-hot-toast';

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
  };
  company?: {
    name: string;
    rif?: string;
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string;
    websiteUrl?: string;
  };
  stats: {
    totalNumbers: number;
    soldNumbers: number;
    reservedNumbers: number;
    availableNumbers: number;
    progress: number;
  };
}

const RafflePublicLanding: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  
  const [data, setData] = useState<PublicLandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
  
  const { raffle, company, stats } = data;
  
  // Colores personalizados de empresa o defaults
  const primaryColor = company?.primaryColor || '#8B5CF6';
  const secondaryColor = company?.secondaryColor || '#06B6D4';
  
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
        {/* Header con Logo Empresa */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          {company?.logoUrl && (
            <div className="mb-6">
              <img
                src={company.logoUrl}
                alt={company.name}
                className="h-24 w-auto mx-auto rounded-lg shadow-lg"
              />
            </div>
          )}
          
          {company && (
            <div className="mb-4">
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
          
          <h1 className="text-4xl sm:text-5xl font-bold text-text mb-4">
            {raffle.name}
          </h1>
          
          {raffle.description && (
            <p className="text-lg text-text/80 max-w-2xl mx-auto">
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
          
          <div className="bg-glass rounded-xl p-4 text-center">
            <TrendingUp className="w-8 h-8 text-fire-orange mx-auto mb-2" />
            <div className="text-2xl font-bold text-fire-orange">{stats.progress}%</div>
            <div className="text-xs text-text/60">Progreso</div>
          </div>
          
          <div className="bg-glass rounded-xl p-4 text-center">
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
        
        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <button
            onClick={() => navigate(`/raffles/${code}`)}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg text-white font-semibold text-lg transition-all hover:scale-105 shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
            }}
          >
            <LogIn className="w-6 h-6" />
            Participar en la Rifa
          </button>
          
          <p className="text-sm text-text/60 mt-4">
            Inicia sesión para comprar tus números
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
    </div>
  );
};

export default RafflePublicLanding;
