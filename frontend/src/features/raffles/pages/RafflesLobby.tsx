/**
 * Sistema de Rifas V2 - RafflesLobby Page
 * Página principal con lista de rifas públicas
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Users,
  Trophy,
  Grid3x3,
  List,
  RefreshCw,
  Sparkles,
  Info,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import RaffleCard from '../components/RaffleCard';
import CreateRaffleModal from '../components/CreateRaffleModal';
import { useRaffleList, useRaffleFilters } from '../hooks/useRaffleData';
import { RaffleStatus, RaffleMode, RaffleVisibility } from '../types';
import { FILTER_OPTIONS } from '../constants';

type CalendarEventType = 'start' | 'draw';

interface CalendarEvent {
  id: string;
  raffleId: number;
  code: string;
  name: string;
  type: CalendarEventType;
  date: Date;
  status?: string;
  mode?: string;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getStartOfWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function getStartOfMonth(date: Date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

const RafflesLobby: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMode, setCalendarMode] = useState<'month' | 'week'>('month');
  const [calendarReferenceDate, setCalendarReferenceDate] = useState<Date>(() => new Date());
  
  // Hook de filtros
  const { filters, updateFilter, clearFilters, applyFilters } = useRaffleFilters({
    // Mostrar por defecto rifas públicas y de empresa, solo activas/pendientes
    visibility: [RaffleVisibility.PUBLIC, RaffleVisibility.COMPANY],
    status: [RaffleStatus.ACTIVE, RaffleStatus.PENDING],
    sortBy: 'created',
    sortOrder: 'desc'
  });
  
  // Query de rifas con valores por defecto y auto-refresh
  // Filtros efectivos: cuando hay término de búsqueda, permitir todos los estados
  const effectiveFilters = useMemo(() => {
    if (searchTerm.trim()) {
      return {
        ...filters,
        status: undefined
      };
    }
    return filters;
  }, [filters, searchTerm]);

  const {
    data = { raffles: [], total: 0, page: 1, totalPages: 1 },
    isLoading,
    isRefetching,
    refetch
  } = useRaffleList({
    ...effectiveFilters,
    search: searchTerm || undefined
  });
  
  // Manejar búsqueda
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  }, [applyFilters]);
  
  // Estadísticas globales calculadas en tiempo real
  const stats = useMemo(() => {
    const raffles = data?.raffles || [];
    const totalParticipants = raffles.reduce((sum: number, raffle: any) => 
      sum + (raffle.participants || 0), 0);
    const totalPotFires = raffles.reduce((sum: number, raffle: any) => 
      sum + (parseFloat(raffle.pot_fires || 0)), 0);
    const totalPotCoins = raffles.reduce((sum: number, raffle: any) => 
      sum + (parseFloat(raffle.pot_coins || 0)), 0);
    
    return {
      totalRaffles: data?.total || 0,
      totalParticipants,
      totalPotFires,
      totalPotCoins
    };
  }, [data]);
  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    const raffles = data?.raffles || [];
    const events: CalendarEvent[] = [];
    raffles.forEach((raffle: any) => {
      const base = {
        raffleId: raffle.id,
        code: raffle.code,
        name: raffle.name,
        status: raffle.status,
        mode: raffle.mode
      };
      if (raffle.startsAt) {
        const d = new Date(raffle.startsAt);
        if (!Number.isNaN(d.getTime())) {
          events.push({
            id: `start-${raffle.id}`,
            type: 'start',
            date: d,
            ...base
          });
        }
      }
      if (raffle.scheduledDrawAt) {
        const d = new Date(raffle.scheduledDrawAt);
        if (!Number.isNaN(d.getTime())) {
          events.push({
            id: `draw-${raffle.id}`,
            type: 'draw',
            date: d,
            ...base
          });
        }
      }
    });
    return events;
  }, [data]);

  const monthDays = useMemo(
    () => {
      const startOfMonth = getStartOfMonth(calendarReferenceDate);
      const calendarStart = getStartOfWeek(startOfMonth);
      const days: {
        date: Date;
        key: string;
        isCurrentMonth: boolean;
        isToday: boolean;
        events: CalendarEvent[];
      }[] = [];
      const today = new Date();

      for (let i = 0; i < 42; i += 1) {
        const date = new Date(calendarStart);
        date.setDate(calendarStart.getDate() + i);
        const key = date.toISOString().slice(0, 10);
        const dayEvents = calendarEvents.filter((ev) => isSameDay(ev.date, date));
        days.push({
          date,
          key,
          isCurrentMonth:
            date.getMonth() === startOfMonth.getMonth() &&
            date.getFullYear() === startOfMonth.getFullYear(),
          isToday: isSameDay(date, today),
          events: dayEvents
        });
      }

      return days;
    },
    [calendarReferenceDate, calendarEvents]
  );

  const weekDays = useMemo(
    () => {
      const startOfWeek = getStartOfWeek(calendarReferenceDate);
      const days: {
        date: Date;
        key: string;
        isToday: boolean;
        events: CalendarEvent[];
      }[] = [];
      const today = new Date();

      for (let i = 0; i < 7; i += 1) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const key = date.toISOString().slice(0, 10);
        const dayEvents = calendarEvents.filter((ev) => isSameDay(ev.date, date));
        days.push({
          date,
          key,
          isToday: isSameDay(date, today),
          events: dayEvents
        });
      }

      return days;
    },
    [calendarReferenceDate, calendarEvents]
  );

  const calendarTitle = useMemo(
    () => {
      if (calendarMode === 'month') {
        const label = calendarReferenceDate.toLocaleDateString('es-VE', {
          month: 'long',
          year: 'numeric'
        });
        return label.charAt(0).toUpperCase() + label.slice(1);
      }

      const start = getStartOfWeek(calendarReferenceDate);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const startLabel = start.toLocaleDateString('es-VE', {
        day: '2-digit',
        month: 'short'
      });
      const endLabel = end.toLocaleDateString('es-VE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      return `Semana del ${startLabel} al ${endLabel}`;
    },
    [calendarReferenceDate, calendarMode]
  );

  const handlePrevPeriod = useCallback(() => {
    setCalendarReferenceDate((current) => {
      const next = new Date(current);
      if (calendarMode === 'month') {
        next.setMonth(next.getMonth() - 1);
      } else {
        next.setDate(next.getDate() - 7);
      }
      return next;
    });
  }, [calendarMode]);

  const handleNextPeriod = useCallback(() => {
    setCalendarReferenceDate((current) => {
      const next = new Date(current);
      if (calendarMode === 'month') {
        next.setMonth(next.getMonth() + 1);
      } else {
        next.setDate(next.getDate() + 7);
      }
      return next;
    });
  }, [calendarMode]);

  const handleToday = useCallback(() => {
    setCalendarReferenceDate(new Date());
  }, []);
  
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
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowHelpModal(true)}
                  className="px-3 py-2 rounded-lg bg-glass/60 hover:bg-glass text-xs text-text/80 flex items-center gap-2"
                  type="button"
                >
                  <Info size={16} className="text-accent" />
                  <span>Cómo crear rifas</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary px-6 py-3 flex items-center gap-2 whitespace-nowrap"
                  type="button"
                >
                  <Plus size={20} />
                  Crear Rifa
                </motion.button>
              </div>
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
                onClick={() => setShowCalendar((prev) => !prev)}
                className={`px-3 sm:px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  showCalendar ? 'bg-accent text-dark' : 'bg-glass/50 text-text hover:bg-glass'
                }`}
              >
                <Calendar size={18} />
                <span className="hidden sm:inline">Calendario</span>
                <span className="sm:hidden">Cal</span>
              </motion.button>
              
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
                      onChange={(e) => updateFilter('status', e.target.value ? [e.target.value as RaffleStatus] : undefined)}
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
                      onChange={(e) => updateFilter('mode', e.target.value ? [e.target.value as RaffleMode] : undefined)}
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
        {showCalendar && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 bg-glass rounded-2xl p-4 sm:p-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-accent" />
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-text">
                    Calendario de campañas y rifas
                  </h2>
                  <p className="text-[11px] text-text/60">
                    Basado en fechas de inicio y sorteos programados
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-glass/60 rounded-lg p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setCalendarMode('month')}
                    className={`px-2.5 py-1 rounded-md ${
                      calendarMode === 'month'
                        ? 'bg-accent text-dark'
                        : 'text-text/70 hover:text-text'
                    }`}
                  >
                    Mes
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarMode('week')}
                    className={`px-2.5 py-1 rounded-md ${
                      calendarMode === 'week'
                        ? 'bg-accent text-dark'
                        : 'text-text/70 hover:text-text'
                    }`}
                  >
                    Semana
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevPeriod}
                    className="p-1.5 rounded-lg bg-glass/60 text-text/80 hover:bg-glass"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextPeriod}
                    className="p-1.5 rounded-lg bg-glass/60 text-text/80 hover:bg-glass"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleToday}
                    className="ml-1 px-2.5 py-1 rounded-lg bg-glass/60 text-[11px] text-text/80 hover:bg-glass"
                  >
                    Hoy
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs text-text/70 mb-2">
                {calendarTitle}
              </div>
              {calendarEvents.length === 0 ? (
                <div className="text-xs text-text/60 bg-glass/60 rounded-lg p-3">
                  No hay fechas de inicio ni sorteos programados para las rifas actuales.
                </div>
              ) : calendarMode === 'month' ? (
                <>
                  <div className="grid grid-cols-7 gap-1 text-[11px] text-text/60 mb-1">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((label) => (
                      <div
                        key={label}
                        className="text-center uppercase tracking-wide"
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-xs">
                    {monthDays.map((day) => (
                      <div
                        key={day.key}
                        className={`min-h-[72px] rounded-lg border border-white/5 bg-glass/40 p-1.5 flex flex-col ${
                          day.isCurrentMonth ? '' : 'opacity-40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-text/80">
                            {day.date.getDate()}
                          </span>
                          {day.isToday && (
                            <span className="text-[9px] px-1 rounded-full bg-accent/20 text-accent">
                              Hoy
                            </span>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          {day.events.slice(0, 3).map((event) => (
                            <button
                              key={event.id}
                              type="button"
                              onClick={() => navigate(`/raffles/${event.code}`)}
                              className="w-full text-left text-[10px] px-1 py-0.5 rounded bg-accent/15 text-text/90 hover:bg-accent/25"
                            >
                              <span className="font-semibold">
                                {event.type === 'start' ? 'Inicio' : 'Sorteo'}:
                              </span>{' '}
                              <span className="truncate inline-block max-w-[90%] align-middle">
                                {event.name}
                              </span>
                            </button>
                          ))}
                          {day.events.length > 3 && (
                            <div className="text-[10px] text-text/50">
                              +{day.events.length - 3} más
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-2 text-xs">
                  {weekDays.map((day) => (
                    <div
                      key={day.key}
                      className="rounded-lg border border-white/5 bg-glass/40 p-2"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-text/80">
                            {day.date.toLocaleDateString('es-VE', {
                              weekday: 'short',
                              day: '2-digit',
                              month: 'short'
                            })}
                          </span>
                          {day.isToday && (
                            <span className="text-[9px] px-1 rounded-full bg-accent/20 text-accent">
                              Hoy
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-text/60">
                          {day.events.length} evento{day.events.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      {day.events.length === 0 ? (
                        <div className="text-[10px] text-text/50">
                          Sin eventos este día.
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {day.events.map((event) => (
                            <button
                              key={event.id}
                              type="button"
                              onClick={() => navigate(`/raffles/${event.code}`)}
                              className="w-full text-left px-1.5 py-0.5 rounded bg-accent/15 text-text/90 hover:bg-accent/25"
                            >
                              <span className="font-semibold">
                                {event.type === 'start' ? 'Inicio' : 'Sorteo'}
                              </span>{' '}
                              <span>
                                {event.date.toLocaleTimeString('es-VE', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>{' '}
                              ·{' '}
                              <span className="truncate inline-block max-w-[55%] align-middle">
                                {event.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
        
        {/* Modal de ayuda - Lobby de Rifas */}
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
                      <h3 className="text-sm md:text-base font-bold text-text">Cómo crear rifas desde este lobby</h3>
                      <p className="text-[11px] md:text-xs text-text/60">
                        Guía para configurar una rifa sólida antes de entrar a la sala.
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
                    <h4 className="font-bold text-text text-base md:text-lg">1. Abrir el creador de rifas</h4>
                    <p>
                      Pulsa el botón <span className="font-semibold">"Crear Rifa"</span>. Se abrirá un asistente con varios pasos:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 ml-1">
                      <li><span className="font-semibold">Modo:</span> define si el premio es en 🔥 fires, 🪙 monedas o un premio físico/servicio.</li>
                      <li><span className="font-semibold">Rango de números:</span> cuántos números tendrá la rifa (100, 500, 1000...).</li>
                      <li><span className="font-semibold">Precio por número:</span> cuánto paga cada jugador por número.</li>
                      <li><span className="font-semibold">Visibilidad:</span> pública, privada o empresarial (con landing especial).</li>
                    </ul>
                  </section>

                  <section className="space-y-1">
                    <h4 className="font-bold text-text text-base md:text-lg">2. Qué ves en la lista de rifas</h4>
                    <ul className="list-disc list-inside space-y-0.5 ml-1">
                      <li>Cada tarjeta muestra nombre, estado, pote actual y número de participantes.</li>
                      <li>Las rifas públicas y empresariales se listan por defecto; puedes filtrarlas por estado y modo.</li>
                      <li>Desde aquí entras a la sala de cada rifa para comprar números y ver detalles.</li>
                    </ul>
                  </section>

                  <section className="space-y-1">
                    <h4 className="font-bold text-text text-base md:text-lg">3. Filtros y orden</h4>
                    <ul className="list-disc list-inside space-y-0.5 ml-1">
                      <li>Usa los filtros de estado, modo y orden para priorizar rifas activas, próximas o con mayor pote.</li>
                      <li>El buscador permite localizar rifas por nombre o código.</li>
                    </ul>
                  </section>

                  <section className="space-y-1">
                    <h4 className="font-bold text-text text-base md:text-lg">4. Buenas prácticas al crear rifas</h4>
                    <ul className="list-disc list-inside space-y-0.5 ml-1">
                      <li>Elige un rango de números razonable para el tamaño de tu comunidad.</li>
                      <li>Define precios que sean atractivos pero sostenibles para el premio que ofreces.</li>
                      <li>Describe bien el premio en el proceso de creación para generar confianza.</li>
                    </ul>
                  </section>
                </div>
              </motion.div>
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
