/**
 * RafflesLobby.js - Página principal del sistema de rifas
 * Lista paginada de rifas públicas con filtros y búsqueda
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaFire, FaCoins, FaTrophy, FaSearch, FaFilter, 
  FaPlus, FaBuilding, FaGift, FaStar, FaEye,
  FaClock, FaUsers, FaChartLine, FaSortAmountDown,
  FaSortAmountUp, FaChevronLeft, FaChevronRight
} from 'react-icons/fa';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import CreateRaffleModal from '../components/raffles/CreateRaffleModal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';

const RafflesLobby = () => {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filters, setFilters] = useState({
    mode: '',
    company_mode: '',
    search: '',
    sort: 'created_at',
    order: 'desc'
  });
  const [page, setPage] = useState(1);

  // Consulta para obtener rifas públicas con paginación
  const { 
    data: rafflesData, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['raffles-public', page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
        ...(filters.mode && { mode: filters.mode }),
        ...(filters.company_mode !== '' && { company_mode: filters.company_mode }),
        ...(filters.search && { search: filters.search }),
        sort: filters.sort,
        order: filters.order
      });

      const response = await fetch(`/api/raffles/public?${params}`);
      if (!response.ok) {
        throw new Error('Error al cargar rifas');
      }
      
      const result = await response.json();
      return result.data;
    },
    refetchInterval: 10000, // Actualizar cada 10 segundos
    keepPreviousData: true
  });

  // Consulta para obtener estadísticas del sistema
  const { data: stats } = useQuery({
    queryKey: ['raffles-stats'],
    queryFn: async () => {
      const response = await fetch('/api/raffles/stats/overview');
      if (!response.ok) throw new Error('Error al cargar estadísticas');
      const result = await response.json();
      return result.data;
    },
    refetchInterval: 30000 // Actualizar cada 30 segundos
  });

  useEffect(() => {
    if (error) {
      toast.error('Error al cargar las rifas. Intenta nuevamente.');
    }
  }, [error]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Resetear a primera página al cambiar filtros
  };

  const handleSearch = (e) => {
    e.preventDefault();
    refetch();
  };

  const toggleSort = (field) => {
    if (filters.sort === field) {
      handleFilterChange('order', filters.order === 'asc' ? 'desc' : 'asc');
    } else {
      handleFilterChange('sort', field);
      handleFilterChange('order', 'desc');
    }
  };

  const RaffleCard = ({ raffle }) => {
    const isCompanyMode = raffle.is_company_mode;
    const progress = raffle.total_numbers > 0 
      ? (raffle.purchased_count / raffle.total_numbers) * 100 
      : 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -5, transition: { duration: 0.2 } }}
        className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300"
      >
        {/* Header con branding */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            {isCompanyMode && raffle.logo_url && (
              <img 
                src={raffle.logo_url} 
                alt={raffle.company_name}
                className="w-10 h-10 rounded-lg object-cover"
              />
            )}
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                {raffle.name}
                {isCompanyMode && (
                  <FaBuilding className="text-purple-400" title="Modo Empresa" />
                )}
                {raffle.mode === 'prize' && (
                  <FaGift className="text-green-400" title="Modo Premio" />
                )}
              </h3>
              <p className="text-white/70 text-sm">por {raffle.host_username}</p>
            </div>
          </div>
          
          <div className="flex flex-col items-end space-y-1">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              raffle.status === 'pending' 
                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                : raffle.status === 'active'
                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
            }`}>
              {raffle.status === 'pending' ? 'Activa' : 
               raffle.status === 'active' ? 'En Curso' : 'Finalizada'}
            </span>
            <span className="text-white/60 text-xs flex items-center gap-1">
              <FaClock />
              {new Date(raffle.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Descripción */}
        {raffle.description && (
          <p className="text-white/80 text-sm mb-4 line-clamp-2">
            {raffle.description}
          </p>
        )}

        {/* Métricas principales */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-black/20 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/60 text-xs">PREMIO ACTUAL</span>
              {raffle.mode === 'fire' ? (
                <FaFire className="text-orange-400 text-sm" />
              ) : (
                <FaCoins className="text-yellow-400 text-sm" />
              )}
            </div>
            <div className="text-lg font-bold text-white">
              {raffle.mode === 'fire' 
                ? `${parseFloat(raffle.pot_fires || 0).toFixed(2)} 🔥`
                : `${parseFloat(raffle.pot_coins || 0).toFixed(2)} 🪙`
              }
            </div>
          </div>
          
          <div className="bg-black/20 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/60 text-xs">NÚMEROS</span>
              <FaChartLine className="text-blue-400 text-sm" />
            </div>
            <div className="text-lg font-bold text-white">
              {raffle.purchased_count}/{raffle.total_numbers}
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
              <div 
                className="bg-gradient-to-r from-blue-400 to-purple-400 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Precios y participación */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div>
              <span className="text-white/60 text-xs block">Costo por número</span>
              <span className="text-white font-semibold flex items-center gap-1">
                {raffle.mode === 'fire' ? (
                  <>
                    <FaFire className="text-orange-400 text-sm" />
                    {parseFloat(raffle.cost_per_number || 10).toFixed(2)}
                  </>
                ) : (
                  <>
                    <FaCoins className="text-yellow-400 text-sm" />
                    {parseFloat(raffle.cost_per_number || 100).toFixed(2)}
                  </>
                )}
              </span>
            </div>
            
            <div>
              <span className="text-white/60 text-xs block">Participantes</span>
              <span className="text-white font-semibold flex items-center gap-1">
                <FaUsers className="text-blue-400 text-sm" />
                {raffle.participant_count || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex space-x-2">
          <button
            onClick={() => window.location.href = `/raffles/${raffle.code}`}
            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
          >
            <FaEye />
            Ver Rifa
          </button>
          
          {raffle.status === 'pending' && (
            <button
              onClick={() => window.location.href = `/raffles/${raffle.code}/buy`}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
            >
              <FaTrophy />
              Participar
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-blue-900/20 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header principal */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-md rounded-3xl p-8 mb-6 border border-white/20"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                <FaTrophy className="text-yellow-400" />
                Sistema de Rifas
              </h1>
              <p className="text-white/70 text-lg">
                Participa en rifas emocionantes y gana amazing premios
              </p>
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl"
            >
              <FaPlus />
              Crear Rifa
            </button>
          </div>

          {/* Estadísticas rápidas */}
          {stats && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-black/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/60 text-sm">Rifas Activas</span>
                  <FaChartLine className="text-green-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {stats.active_raffles || 0}
                </div>
              </div>
              
              <div className="bg-black/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/60 text-sm">En Juego</span>
                  <FaFire className="text-orange-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {parseFloat(stats.total_fires_in_play || 0).toFixed(0)} 🔥
                </div>
              </div>
              
              <div className="bg-black/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/60 text-sm">Empresas</span>
                  <FaBuilding className="text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {stats.company_raffles || 0}
                </div>
              </div>
              
              <div className="bg-black/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/60 text-sm">Creadas Hoy</span>
                  <FaStar className="text-yellow-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {stats.created_today || 0}
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Filtros y búsqueda */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-6 border border-white/20"
        >
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Búsqueda */}
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                <input
                  type="text"
                  placeholder="Buscar rifas..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                />
              </div>

              {/* Modo de juego */}
              <select
                value={filters.mode}
                onChange={(e) => handleFilterChange('mode', e.target.value)}
                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
              >
                <option value="">Todos los modos</option>
                <option value="fire">🔥 Modo Fuego</option>
                <option value="prize">🎁 Modo Premio</option>
              </select>

              {/* Tipo de rifa */}
              <select
                value={filters.company_mode}
                onChange={(e) => handleFilterChange('company_mode', e.target.value)}
                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
              >
                <option value="">Todos los tipos</option>
                <option value="false">👤 Personales</option>
                <option value="true">🏢 Empresas</option>
              </select>

              {/* Ordenamiento */}
              <select
                value={`${filters.sort}_${filters.order}`}
                onChange={(e) => {
                  const [sort, order] = e.target.value.split('_');
                  handleFilterChange('sort', sort);
                  handleFilterChange('order', order);
                }}
                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
              >
                <option value="created_at_desc">⏰ Más Recientes</option>
                <option value="created_at_asc">⏰ Más Antiguas</option>
                <option value="pot_fires_desc">💰 Mayor Premio</option>
                <option value="pot_fires_asc">💰 Menor Premio</option>
                <option value="participant_count_desc">👥 Más Populares</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => toggleSort('pot_fires')}
                  className="px-4 py-2 bg-black/20 hover:bg-black/30 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {filters.order === 'desc' ? <FaSortAmountDown /> : <FaSortAmountUp />}
                  Ordenar por Premio
                </button>
              </div>

              <button
                type="submit"
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-all duration-300 flex items-center gap-2"
              >
                <FaFilter />
                Aplicar Filtros
              </button>
            </div>
          </form>
        </motion.div>

        {/* Lista de rifas */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="large" />
            </div>
          ) : rafflesData?.raffles?.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <AnimatePresence>
                  {rafflesData.raffles.map((raffle) => (
                    <RaffleCard key={raffle.id} raffle={raffle} />
                  ))}
                </AnimatePresence>
              </div>

              {/* Paginación */}
              {rafflesData.pagination?.totalPages > 1 && (
                <div className="flex justify-center items-center space-x-4">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-3 bg-white/10 hover:bg-white/20 disabled:opacity/50 disabled:cursor-not-allowed rounded-xl text-white transition-colors"
                  >
                    <FaChevronLeft />
                  </button>

                  <span className="text-white font-semibold">
                    Página {page} de {rafflesData.pagination.totalPages}
                  </span>

                  <button
                    onClick={() => setPage(Math.min(rafflesData.pagination.totalPages, page + 1))}
                    disabled={page === rafflesData.pagination.totalPages}
                    className="p-3 bg-white/10 hover:bg-white/20 disabled:opacity/50 disabled:cursor-not-allowed rounded-xl text-white transition-colors"
                  >
                    <FaChevronRight />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <FaTrophy className="text-6xl text-white/20 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">
                No hay rifas activas
              </h3>
              <p className="text-white/60 mb-6">
                Sé el primero en crear una rifa emocionante
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 inline-flex items-center gap-2"
              >
                <FaPlus />
                Crear Primera Rifa
              </button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Modal de crear rifa */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateRaffleModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              refetch();
              toast.success('¡Rifa creada exitosamente!');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default RafflesLobby;
