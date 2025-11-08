/**
 * Sistema de Rifas V2 - RafflesLobby Page
 * Página principal con lista de rifas públicas
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  TrendingUp,
  Users,
  Trophy,
  Grid3x3,
  List,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import RaffleCard from '../components/RaffleCard';
import CreateRaffleModal from '../components/CreateRaffleModal';
import { useRaffleList, useRaffleFilters } from '../hooks/useRaffleData';
import { RaffleStatus, RaffleMode } from '../types';
import { FILTER_OPTIONS, PAGINATION } from '../constants';

const RafflesLobby: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Hook de filtros
  const { filters, updateFilter, clearFilters, applyFilters } = useRaffleFilters({
    visibility: ['public'],
    status: ['active', 'pending'],
    sortBy: 'created',
    sortOrder: 'desc'
  });
  
  // Query de rifas con valores por defecto
  const {
    data = { raffles: [], total: 0, page: 1, totalPages: 1 },
    isLoading,
    isRefetching,
    refetch
  } = useRaffleList({
    ...filters,
    search: searchTerm
  });
  
  // Manejar búsqueda
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  }, [applyFilters]);
  
  // Estadísticas globales (mock por ahora)
  const stats = {
    totalRaffles: data?.total || 0,
    totalParticipants: 2458,
    totalPotFires: 125840,
    totalPotCoins: 89320
  };
  
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
          transition={{ delay: 0.1 }}
          className="bg-glass rounded-2xl p-6 sm:p-8 mb-6"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-text mb-2 flex items-center gap-3">
                <Sparkles className="text-accent" />
                Rifas Activas
              </h1>
              <p className="text-base sm:text-lg text-text/80">
                Participa en rifas emocionantes y gana increíbles premios
              </p>
            </div>
            {user && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCreateModal(true)}
                className="btn-primary px-6 py-3 flex items-center gap-2 whitespace-nowrap"
              >
                <Plus size={20} />
                Crear Rifa
              </motion.button>
            )}
          </div>
          
          {/* Estadísticas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <div className="bg-glass/50 rounded-lg p-3 sm:p-4">
              <div className="flex items-center gap-2 text-xs text-text/60 mb-1">
                <Grid3x3 className="w-4 h-4" />
                <span className="truncate">Rifas Activas</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-text">{stats.totalRaffles}</div>
            </div>
            <div className="bg-glass/50 rounded-lg p-3 sm:p-4">
              <div className="flex items-center gap-2 text-xs text-text/60 mb-1">
                <Users className="w-4 h-4" />
                <span className="truncate">Participantes</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-accent">{stats.totalParticipants}</div>
            </div>
            <div className="bg-glass/50 rounded-lg p-3 sm:p-4">
              <div className="flex items-center gap-2 text-xs text-text/60 mb-1">
                <Trophy className="w-4 h-4" />
                <span className="truncate">Pote Total 🔥</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-fire-orange">
                {stats.totalPotFires.toLocaleString()}
              </div>
            </div>
            <div className="bg-glass/50 rounded-lg p-3 sm:p-4">
              <div className="flex items-center gap-2 text-xs text-text/60 mb-1">
                <Trophy className="w-4 h-4" />
                <span className="truncate">Pote Total 🪙</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-yellow-500">
                {stats.totalPotCoins.toLocaleString()}
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* Barra de búsqueda y filtros */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-glass rounded-xl p-4 mb-6"
        >
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            {/* Búsqueda */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text/60 w-5 h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nombre o código..."
                  className="w-full pl-10 pr-4 py-2.5 bg-glass/50 rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
            
            {/* Controles */}
            <div className="flex gap-2">
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  showFilters ? 'bg-accent text-dark' : 'bg-glass/50 text-text hover:bg-glass'
                }`}
              >
                <Filter size={18} />
                Filtros
              </motion.button>
              
              <div className="flex bg-glass/50 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'grid' ? 'bg-accent text-dark' : 'text-text/60 hover:text-text'
                  }`}
                >
                  <Grid3x3 size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'list' ? 'bg-accent text-dark' : 'text-text/60 hover:text-text'
                  }`}
                >
                  <List size={18} />
                </button>
              </div>
              
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => refetch()}
                disabled={isRefetching}
                className="p-2.5 bg-glass/50 rounded-lg text-text hover:bg-glass disabled:opacity-50"
              >
                <RefreshCw 
                  size={18} 
                  className={isRefetching ? 'animate-spin' : ''} 
                />
              </motion.button>
            </div>
          </form>
          
          {/* Panel de filtros expandible */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/10">
                  {/* Filtro de Estado */}
                  <div>
                    <label className="text-xs text-text/60 mb-1 block">Estado</label>
                    <select
                      value={filters.status?.[0] || ''}
                      onChange={(e) => updateFilter('status', e.target.value ? [e.target.value] : undefined)}
                      className="w-full px-3 py-2 bg-glass/50 rounded-lg text-text"
                    >
                      <option value="">Todos</option>
                      {FILTER_OPTIONS.STATUS.map((option: any) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Filtro de Modo */}
                  <div>
                    <label className="text-xs text-text/60 mb-1 block">Modo</label>
                    <select
                      value={filters.mode?.[0] || ''}
                      onChange={(e) => updateFilter('mode', e.target.value ? [e.target.value] : undefined)}
                      className="w-full px-3 py-2 bg-glass/50 rounded-lg text-text"
                    >
                      <option value="">Todos</option>
                      {FILTER_OPTIONS.MODE.map((option: any) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Ordenar por */}
                  <div>
                    <label className="text-xs text-text/60 mb-1 block">Ordenar por</label>
                    <select
                      value={filters.sortBy}
                      onChange={(e) => updateFilter('sortBy', e.target.value as any)}
                      className="w-full px-3 py-2 bg-glass/50 rounded-lg text-text"
                    >
                      {FILTER_OPTIONS.SORT_BY.map((option: any) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Botón limpiar filtros */}
                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs text-text/60 hover:text-text"
                  >
                    Limpiar filtros
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        
        {/* Lista de rifas */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full animate-spin mb-4"></div>
              <p className="text-text/60">Cargando rifas...</p>
            </motion.div>
          ) : data?.raffles.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20 bg-glass rounded-xl"
            >
              <Trophy className="w-16 h-16 text-text/20 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-text mb-2">No hay rifas disponibles</h3>
              <p className="text-text/60 mb-6">Sé el primero en crear una rifa emocionante</p>
              {user && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary px-6 py-2"
                >
                  Crear Primera Rifa
                </motion.button>
              )}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data?.raffles.map((raffle: any, index: number) => (
                    <motion.div
                      key={raffle.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <RaffleCard 
                        raffle={raffle} 
                        variant={index === 0 ? 'featured' : 'default'}
                      />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {data?.raffles.map((raffle: any, index: number) => (
                    <motion.div
                      key={raffle.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <RaffleCard 
                        raffle={raffle} 
                        variant="compact"
                      />
                    </motion.div>
                  ))}
                </div>
              )}
              
              {/* Paginación */}
              {data && data.totalPages > 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center items-center gap-2 mt-8"
                >
                  <button
                    onClick={() => updateFilter('page', Math.max(1, (filters.page || 1) - 1))}
                    disabled={(filters.page || 1) === 1}
                    className="px-3 py-1 bg-glass rounded-lg text-text disabled:opacity-50 hover:bg-glass-lighter"
                  >
                    Anterior
                  </button>
                  
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => updateFilter('page', page)}
                        className={`px-3 py-1 rounded-lg ${
                          page === (filters.page || 1)
                            ? 'bg-accent text-dark'
                            : 'bg-glass text-text hover:bg-glass-lighter'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  
                  <button
                    onClick={() => updateFilter('page', Math.min(data.totalPages, (filters.page || 1) + 1))}
                    disabled={(filters.page || 1) === data.totalPages}
                    className="px-3 py-1 bg-glass rounded-lg text-text disabled:opacity-50 hover:bg-glass-lighter"
                  >
                    Siguiente
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Modal de Creación */}
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

export default RafflesLobby;
