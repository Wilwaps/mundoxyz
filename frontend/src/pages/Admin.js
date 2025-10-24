import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Users, 
  TrendingUp, 
  Gift, 
  DollarSign,
  Activity,
  Shield,
  Award
} from 'lucide-react';
import toast from 'react-hot-toast';

// Stats Component
const AdminStats = () => {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const response = await axios.get('/admin/stats');
      return response.data;
    }
  });

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-6">Panel de Administración</h2>

      {/* User Stats */}
      <div className="card-glass mb-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Users size={20} className="text-accent" />
          Usuarios
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-violet">{stats?.users?.total_users || 0}</div>
            <div className="text-xs text-text/60">Total Usuarios</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-success">{stats?.users?.active_users_24h || 0}</div>
            <div className="text-xs text-text/60">Activos 24h</div>
          </div>
        </div>
      </div>

      {/* Economy Stats */}
      <div className="card-glass mb-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <DollarSign size={20} className="text-fire-orange" />
          Economía
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-text/60">Total Fires en Circulación</span>
            <span className="font-bold text-fire-orange">🔥 {stats?.supply?.total_circulating || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text/60">Total Coins en Circulación</span>
            <span className="font-bold text-accent">🪙 {stats?.economy?.total_coins_circulation || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text/60">Fires Disponibles</span>
            <span className="font-bold text-success">
              🔥 {((stats?.supply?.total_max || 0) - (stats?.supply?.total_emitted || 0)).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Games Stats */}
      <div className="card-glass">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Activity size={20} className="text-violet" />
          Juegos Activos
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-violet">{stats?.games?.active_raffles || 0}</div>
            <div className="text-xs text-text/60">Rifas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{stats?.games?.active_bingo_rooms || 0}</div>
            <div className="text-xs text-text/60">Salas de Bingo</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Users Management Component
const AdminUsers = () => {
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  
  const { data: users } = useQuery({
    queryKey: ['admin-users', search, selectedRole],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedRole) params.append('role', selectedRole);
      const response = await axios.get(`/admin/users?${params}`);
      return response.data;
    }
  });

  const handleGrantRole = async (userId, role) => {
    try {
      await axios.post('/roles/grant', { user_id: userId, role });
      toast.success(`Rol ${role} otorgado exitosamente`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al otorgar rol');
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-6">Gestión de Usuarios</h2>

      {/* Search */}
      <div className="card-glass mb-6">
        <input
          type="text"
          placeholder="Buscar usuario..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-glass w-full mb-3"
        />
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="input-glass w-full"
        >
          <option value="">Todos los roles</option>
          <option value="user">Usuario</option>
          <option value="vip">VIP</option>
          <option value="moderator">Moderador</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {users?.users?.map((user) => (
          <div key={user.id} className="card-glass">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-semibold text-text">{user.display_name || user.username}</div>
                <div className="text-xs text-text/60">@{user.username} • ID: {user.tg_id}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-accent">🪙 {user.coins_balance || 0}</div>
                <div className="text-sm text-fire-orange">🔥 {user.fires_balance || 0}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {user.roles?.map((role) => (
                <span key={role} className="badge-coins text-xs">
                  {role}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Welcome Events Component  
const AdminWelcome = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eventData, setEventData] = useState({
    name: '',
    message: '',
    coins_amount: 0,
    fires_amount: 0,
    duration_hours: 72
  });

  const { data: events, refetch } = useQuery({
    queryKey: ['admin-welcome-events'],
    queryFn: async () => {
      const response = await axios.get('/admin/welcome/events');
      return response.data;
    }
  });

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/admin/welcome/events', eventData);
      toast.success('Evento creado exitosamente');
      setShowCreateModal(false);
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al crear evento');
    }
  };

  const handleActivateEvent = async (eventId) => {
    try {
      await axios.post(`/admin/welcome/events/${eventId}/activate`);
      toast.success('Evento activado');
      refetch();
    } catch (error) {
      toast.error('Error al activar evento');
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-6">Eventos de Bienvenida</h2>

      <button
        onClick={() => setShowCreateModal(true)}
        className="w-full btn-primary mb-6"
      >
        Crear Nuevo Evento
      </button>

      {/* Events List */}
      <div className="space-y-3">
        {events?.map((event) => (
          <div key={event.id} className="card-glass">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-semibold text-text">{event.name}</div>
                <div className="text-sm text-text/60">{event.message}</div>
              </div>
              {event.is_active ? (
                <span className="badge-coins text-xs">Activo</span>
              ) : (
                <button
                  onClick={() => handleActivateEvent(event.id)}
                  className="text-xs px-2 py-1 bg-success/20 text-success rounded"
                >
                  Activar
                </button>
              )}
            </div>
            <div className="flex gap-4 text-sm">
              <span className="text-accent">🪙 {event.coins_amount}</span>
              <span className="text-fire-orange">🔥 {event.fires_amount}</span>
              <span className="text-text/60">{event.total_claims || 0} claims</span>
            </div>
          </div>
        ))}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-glass w-full max-w-md"
          >
            <h3 className="text-xl font-bold mb-4">Crear Evento de Bienvenida</h3>
            
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <input
                type="text"
                placeholder="Nombre del evento"
                value={eventData.name}
                onChange={(e) => setEventData({...eventData, name: e.target.value})}
                className="input-glass w-full"
                required
              />
              
              <textarea
                placeholder="Mensaje"
                value={eventData.message}
                onChange={(e) => setEventData({...eventData, message: e.target.value})}
                className="input-glass w-full"
                rows="3"
              />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text/60 mb-1">Coins</label>
                  <input
                    type="number"
                    value={eventData.coins_amount}
                    onChange={(e) => setEventData({...eventData, coins_amount: e.target.value})}
                    className="input-glass w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text/60 mb-1">Fires</label>
                  <input
                    type="number"
                    value={eventData.fires_amount}
                    onChange={(e) => setEventData({...eventData, fires_amount: e.target.value})}
                    className="input-glass w-full"
                  />
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-600 text-text py-3 px-6 rounded-lg"
                >
                  Cancelar
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  Crear Evento
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

// Main Admin Component
const Admin = () => {
  const { isAdmin } = useAuth();

  if (!isAdmin()) {
    return <Navigate to="/games" replace />;
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Admin Navigation */}
      <nav className="sticky top-0 bg-card border-b border-glass p-4 z-10">
        <div className="flex gap-4 overflow-x-auto">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) => 
              `flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
                isActive ? 'bg-violet/20 text-violet' : 'text-text/60 hover:text-text'
              }`
            }
          >
            <TrendingUp size={18} />
            Estadísticas
          </NavLink>
          <NavLink
            to="/admin/users"
            className={({ isActive }) => 
              `flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
                isActive ? 'bg-violet/20 text-violet' : 'text-text/60 hover:text-text'
              }`
            }
          >
            <Users size={18} />
            Usuarios
          </NavLink>
          <NavLink
            to="/admin/welcome"
            className={({ isActive }) => 
              `flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
                isActive ? 'bg-violet/20 text-violet' : 'text-text/60 hover:text-text'
              }`
            }
          >
            <Gift size={18} />
            Bienvenida
          </NavLink>
        </div>
      </nav>

      {/* Admin Routes */}
      <Routes>
        <Route index element={<AdminStats />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="welcome" element={<AdminWelcome />} />
      </Routes>
    </div>
  );
};

export default Admin;
