/**
 * Sistema de Rifas V2 - MyRaffles Page
 * Página de rifas del usuario (creadas y participando)
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trophy,
  Package,
  Ticket,
  Settings,
  AlertCircle
} from 'lucide-react';
import RaffleCard from '../components/RaffleCard';
import CreateRaffleModal from '../components/CreateRaffleModal';
import { useRaffleList, useUserRaffles } from '../hooks/useRaffleData';

const MyRaffles: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'created' | 'participating'>('participating');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Rifas creadas por el usuario (host)
  const {
    data: createdRaffles = [],
    isLoading: createdLoading,
    error: createdError
  } = useUserRaffles();

  // Query de rifas públicas para detectar participaciones (myNumbers)
  const {
    data: raffleData = { raffles: [] },
    isLoading,
    error
  } = useRaffleList({});
  
  // Separar rifas creadas y participando (por ahora usar el mismo data)
  const data = {
    created: Array.isArray(createdRaffles) ? createdRaffles : [],
    participating: (raffleData as any)?.raffles?.filter((r: any) => r.myNumbers && r.myNumbers.length > 0) || []
  };

  const loading = isLoading || createdLoading;
  const combinedError = error || createdError;
  
  // Estadísticas
  const stats = {
    totalCreated: data.created?.length || 0,
    activeCreated: data.created?.filter((r: any) => r.status === 'active').length || 0,
    totalParticipating: data.participating?.length || 0,
    totalNumbersOwned: data.participating?.reduce((acc: number, r: any) => 
      acc + (r.myNumbers?.length || 0), 0) || 0,
    totalInvested: data.participating?.reduce((acc: number, r: any) => 
      acc + ((r.myNumbers?.length || 0) * r.entryPrice), 0) || 0,
    wonRaffles: data.participating?.filter((r: any) => r.isWinner).length || 0
  };
  
  const raffles = activeTab === 'created' ? data.created : data.participating;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-dark via-dark to-dark/95"
    >
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-glass rounded-2xl p-6 sm:p-8 mb-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-text mb-2">
                Mis Rifas
              </h1>
              <p className="text-text/80">
                Gestiona tus rifas creadas y participaciones
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreateModal(true)}
              className="btn-primary px-6 py-3 flex items-center gap-2"
            >
              <Plus size={20} />
              Nueva Rifa
            </motion.button>
          </div>
          
          {/* Estadísticas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-glass/50 rounded-lg p-3">
              <div className="text-xs text-text/60 mb-1">Creadas</div>
              <div className="text-xl font-bold text-text">{stats.totalCreated}</div>
            </div>
            <div className="bg-glass/50 rounded-lg p-3">
              <div className="text-xs text-text/60 mb-1">Activas</div>
              <div className="text-xl font-bold text-green-400">{stats.activeCreated}</div>
            </div>
            <div className="bg-glass/50 rounded-lg p-3">
              <div className="text-xs text-text/60 mb-1">Participando</div>
              <div className="text-xl font-bold text-accent">{stats.totalParticipating}</div>
            </div>
            <div className="bg-glass/50 rounded-lg p-3">
              <div className="text-xs text-text/60 mb-1">Números</div>
              <div className="text-xl font-bold text-text">{stats.totalNumbersOwned}</div>
            </div>
            <div className="bg-glass/50 rounded-lg p-3">
              <div className="text-xs text-text/60 mb-1">Invertido</div>
              <div className="text-xl font-bold text-fire-orange">🔥{stats.totalInvested}</div>
            </div>
            <div className="bg-glass/50 rounded-lg p-3">
              <div className="text-xs text-text/60 mb-1">Ganadas</div>
              <div className="text-xl font-bold text-yellow-500">🏆{stats.wonRaffles}</div>
            </div>
          </div>
        </motion.div>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('participating')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'participating'
                ? 'bg-accent text-dark'
                : 'bg-glass text-text/60 hover:text-text'
            }`}
          >
            <Ticket className="w-5 h-5" />
            Participando ({stats.totalParticipating})
          </button>
          <button
            onClick={() => setActiveTab('created')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'created'
                ? 'bg-accent text-dark'
                : 'bg-glass text-text/60 hover:text-text'
            }`}
          >
            <Package className="w-5 h-5" />
            Creadas ({stats.totalCreated})
          </button>
        </div>
        
        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full animate-spin mb-4"></div>
              <p className="text-text/60">Cargando rifas...</p>
            </motion.div>
          ) : combinedError ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20 bg-glass rounded-xl"
            >
              <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-text mb-2">Error al cargar rifas</h3>
              <p className="text-text/60">Por favor intenta de nuevo más tarde</p>
            </motion.div>
          ) : raffles?.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20 bg-glass rounded-xl"
            >
              {activeTab === 'participating' ? (
                <>
                  <Ticket className="w-16 h-16 text-text/20 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-text mb-2">
                    No estás participando en ninguna rifa
                  </h3>
                  <p className="text-text/60 mb-6">
                    Explora las rifas activas y participa para ganar
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/raffles')}
                    className="btn-primary px-6 py-2"
                  >
                    Explorar Rifas
                  </motion.button>
                </>
              ) : (
                <>
                  <Package className="w-16 h-16 text-text/20 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-text mb-2">
                    No has creado ninguna rifa
                  </h3>
                  <p className="text-text/60 mb-6">
                    Crea tu primera rifa y comienza a ganar
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary px-6 py-2"
                  >
                    Crear Primera Rifa
                  </motion.button>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: activeTab === 'created' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: activeTab === 'created' ? -20 : 20 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {raffles.map((raffle: any, index: number) => (
                <motion.div
                  key={raffle.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className="relative">
                    <RaffleCard 
                      raffle={raffle} 
                      variant="default"
                    />
                    
                    {/* Badge adicional para rifas participando */}
                    {activeTab === 'participating' && raffle.myNumbers && (
                      <div className="absolute top-4 right-4 bg-dark/80 backdrop-blur-sm rounded-full px-3 py-1">
                        <div className="flex items-center gap-1">
                          <Ticket className="w-4 h-4 text-accent" />
                          <span className="text-xs font-bold text-text">
                            {raffle.myNumbers.length} números
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Badge para ganador */}
                    {raffle.isWinner && (
                      <div className="absolute top-4 left-4 bg-yellow-500/20 backdrop-blur-sm rounded-full px-3 py-1">
                        <div className="flex items-center gap-1">
                          <Trophy className="w-4 h-4 text-yellow-500" />
                          <span className="text-xs font-bold text-yellow-500">
                            ¡GANADOR!
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Botón de gestión para rifas creadas */}
                    {activeTab === 'created' && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/raffles/${raffle.code}`);
                        }}
                        className="absolute bottom-4 right-4 p-2 bg-dark/80 backdrop-blur-sm rounded-lg hover:bg-dark transition-colors"
                      >
                        <Settings className="w-4 h-4 text-text" />
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Modal de creación */}
        <CreateRaffleModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(code) => {
            setShowCreateModal(false);
            navigate(`/raffles/${code}`);
          }}
        />
      </div>
    </motion.div>
  );
};

export default MyRaffles;
