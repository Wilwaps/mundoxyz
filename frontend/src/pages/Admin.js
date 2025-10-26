import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Award,
  Flame,
  CheckCircle,
  XCircle,
  Clock
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
      const response = await axios.get(`/api/admin/users?${params}`);
      return response.data;
    }
  });

  const handleGrantRole = async (userId, role) => {
    try {
      await axios.post('/api/roles/grant', { user_id: userId, role });
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

// Fire Requests Component
const AdminFireRequests = () => {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['fire-requests', selectedStatus],
    queryFn: async () => {
      const response = await axios.get('/api/economy/fire-requests', {
        params: { status: selectedStatus, limit: 50 }
      });
      return response.data;
    }
  });

  const handleReview = (request, action) => {
    setSelectedRequest(request);
    setReviewAction(action);
    setShowReviewModal(true);
  };

  const handleConfirmReview = async () => {
    try {
      if (reviewAction === 'approve') {
        await axios.put(`/economy/fire-requests/${selectedRequest.id}/approve`, {
          review_notes: reviewNotes
        });
        toast.success('Solicitud aprobada exitosamente');
      } else {
        await axios.put(`/economy/fire-requests/${selectedRequest.id}/reject`, {
          review_notes: reviewNotes
        });
        toast.success('Solicitud rechazada');
      }
      
      // Invalidar todas las queries relevantes para actualizar en tiempo real
      queryClient.invalidateQueries(['fire-requests']);
      queryClient.invalidateQueries(['user-stats']);
      queryClient.invalidateQueries(['user-wallet']);
      queryClient.invalidateQueries(['wallet-transactions']);
      queryClient.invalidateQueries(['admin-stats']);
      
      setShowReviewModal(false);
      setReviewNotes('');
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al procesar solicitud');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Flame className="text-fire-orange" />
        Solicitudes de Fuegos
      </h2>

      {/* Status Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {['pending', 'approved', 'rejected', 'all'].map((status) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              selectedStatus === status
                ? 'bg-violet/20 text-violet'
                : 'bg-glass hover:bg-glass-hover'
            }`}
          >
            {status === 'pending' && '⏳ Pendientes'}
            {status === 'approved' && '✅ Aprobadas'}
            {status === 'rejected' && '❌ Rechazadas'}
            {status === 'all' && '📋 Todas'}
          </button>
        ))}
      </div>

      {/* Requests List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : !data?.requests || data.requests.length === 0 ? (
        <div className="card-glass text-center py-12">
          <Clock size={48} className="mx-auto text-text/30 mb-3" />
          <p className="text-text/60">No hay solicitudes {selectedStatus === 'all' ? '' : selectedStatus}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.requests.map((request) => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-glass"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-lg">{request.username}</span>
                    {request.status === 'pending' && (
                      <span className="text-xs px-2 py-1 bg-warning/20 text-warning rounded-full">
                        Pendiente
                      </span>
                    )}
                    {request.status === 'approved' && (
                      <span className="text-xs px-2 py-1 bg-success/20 text-success rounded-full">
                        Aprobada
                      </span>
                    )}
                    {request.status === 'rejected' && (
                      <span className="text-xs px-2 py-1 bg-error/20 text-error rounded-full">
                        Rechazada
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text/60 mb-1">
                    📧 {request.email}
                  </p>
                  <p className="text-xs text-text/40">
                    📅 {formatDate(request.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-fire-orange">
                    {parseFloat(request.amount).toFixed(2)} 🔥
                  </div>
                </div>
              </div>

              <div className="glass-panel p-3 mb-4">
                <div className="text-sm">
                  <span className="text-text/60">Referencia:</span>
                  <span className="ml-2 font-mono text-accent">{request.reference}</span>
                </div>
              </div>

              {request.review_notes && (
                <div className="bg-glass/50 p-3 rounded-lg mb-4">
                  <p className="text-xs text-text/60 mb-1">Notas de revisión:</p>
                  <p className="text-sm">{request.review_notes}</p>
                  {request.reviewer_username && (
                    <p className="text-xs text-text/40 mt-1">
                      Por: {request.reviewer_username} • {formatDate(request.reviewed_at)}
                    </p>
                  )}
                </div>
              )}

              {request.status === 'pending' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleReview(request, 'reject')}
                    className="flex-1 py-3 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircle size={18} />
                    Rechazar
                  </button>
                  <button
                    onClick={() => handleReview(request, 'approve')}
                    className="flex-1 py-3 px-4 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={18} />
                    Aprobar
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md card-glass p-6"
          >
            <h3 className="text-xl font-bold mb-4">
              {reviewAction === 'approve' ? '✅ Aprobar Solicitud' : '❌ Rechazar Solicitud'}
            </h3>

            <div className="glass-panel p-4 mb-4">
              <p className="text-sm text-text/60 mb-1">Usuario:</p>
              <p className="font-bold mb-3">{selectedRequest.username}</p>
              <p className="text-sm text-text/60 mb-1">Cantidad:</p>
              <p className="text-2xl font-bold text-fire-orange mb-3">
                {parseFloat(selectedRequest.amount).toFixed(2)} 🔥
              </p>
              <p className="text-sm text-text/60 mb-1">Referencia:</p>
              <p className="font-mono text-accent">{selectedRequest.reference}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-text/80 mb-2">
                Notas (opcional)
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="input-glass w-full h-24 resize-none"
                placeholder={reviewAction === 'approve' ? 'Ej: Referencia verificada' : 'Ej: Referencia inválida'}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setReviewNotes('');
                }}
                className="flex-1 py-3 px-4 bg-glass hover:bg-glass-hover rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReview}
                className={`flex-1 py-3 px-4 rounded-lg transition-colors ${
                  reviewAction === 'approve'
                    ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
                    : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                }`}
              >
                Confirmar {reviewAction === 'approve' ? 'Aprobación' : 'Rechazo'}
              </button>
            </div>
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
          <NavLink
            to="/admin/fire-requests"
            className={({ isActive }) => 
              `flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
                isActive ? 'bg-violet/20 text-violet' : 'text-text/60 hover:text-text'
              }`
            }
          >
            <Flame size={18} />
            Solicitudes
          </NavLink>
        </div>
      </nav>

      {/* Admin Routes */}
      <Routes>
        <Route index element={<AdminStats />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="welcome" element={<AdminWelcome />} />
        <Route path="fire-requests" element={<AdminFireRequests />} />
      </Routes>
    </div>
  );
};

export default Admin;
