import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
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
  Clock,
  Repeat,
  Send
} from 'lucide-react';
import toast from 'react-hot-toast';
import WelcomeEventsManager from '../components/admin/WelcomeEventsManager';
import DirectGiftsSender from '../components/admin/DirectGiftsSender';
import RoleManagementDropdown from '../components/admin/RoleManagementDropdown';

// Stats Component
const AdminStats = () => {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const response = await axios.get('/api/admin/stats');
      return response.data;
    },
    refetchInterval: 10000 // Actualizar cada 10 segundos
  });

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="card-glass bg-error/20 border border-error/50 text-error p-6 text-center">
          <p className="font-bold mb-2">Error al cargar estadísticas</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

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

      {/* Fire Supply Stats */}
      <div className="card-glass mb-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Flame size={20} className="text-fire-orange" />
          Suministro de Fuegos
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-text/60">Max Supply (Total Creados)</span>
            <span className="font-bold text-violet">
              🔥 {Number(stats?.supply?.total_max || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text/60">Fuegos Emitidos</span>
            <span className="font-bold text-accent">
              🔥 {Number(stats?.supply?.total_emitted || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text/60">Fuegos en Circulación</span>
            <span className="font-bold text-fire-orange">
              🔥 {Number(stats?.supply?.total_circulating || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text/60">Fuegos Quemados 🔥</span>
            <span className="font-bold text-error">
              🔥 {Number(stats?.supply?.total_burned || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text/60">Fuegos Reservados</span>
            <span className="font-bold text-warning">
              🔥 {Number(stats?.supply?.total_reserved || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="border-t border-white/10 pt-3 mt-3">
            <div className="flex justify-between items-center">
              <span className="text-text/60 font-semibold">Fuegos Disponibles</span>
              <span className="font-bold text-success">
                🔥 {Number((stats?.supply?.total_max || 0) - (stats?.supply?.total_emitted || 0)).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Coins Stats */}
      <div className="card-glass mb-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <DollarSign size={20} className="text-accent" />
          Economía de Monedas
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-text/60">Total Coins en Circulación</span>
            <span className="font-bold text-accent">
              💰 {Number(stats?.economy?.total_coins_circulation || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text/60">Total Fires en Wallets</span>
            <span className="font-bold text-fire-orange">
              🔥 {Number(stats?.economy?.total_fires_circulation || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text/60">Promedio Coins/Usuario</span>
            <span className="font-bold text-text">
              💰 {Number(stats?.economy?.avg_coins_balance || 0).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text/60">Promedio Fires/Usuario</span>
            <span className="font-bold text-text">
              🔥 {Number(stats?.economy?.avg_fires_balance || 0).toFixed(2)}
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
  const queryClient = useQueryClient();

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

  const handleResetCredentials = async (userId, username) => {
    const confirmed = window.confirm(
      `¿Reiniciar clave y pregunta de seguridad para ${username || 'este usuario'}?` +
      '\n\nEl usuario deberá establecer una nueva contraseña y configurar de nuevo su pregunta de seguridad.'
    );

    if (!confirmed) return;

    try {
      await axios.post(`/api/admin/users/${userId}/reset-credentials`);
      toast.success('Credenciales reiniciadas correctamente');
      // Refrescar lista de usuarios por si en el futuro mostramos flags relacionados
      queryClient.invalidateQueries(['admin-users']);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al reiniciar credenciales');
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-6">Gestión de Usuarios</h2>

      <div className="card-glass mb-4 flex items-center justify-between text-sm">
        <span className="text-text/60">Usuarios totales</span>
        <span className="font-bold text-accent">{users?.total ?? 0}</span>
      </div>

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
          <option value="tito">Tito</option>
        </select>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {users?.users?.map((user) => (
          <div key={user.id} className="card-glass">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="font-semibold text-text">{user.display_name || user.username}</div>
                <div className="text-xs text-text/60">@{user.username} • ID: {user.tg_id}</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-right mr-2">
                  <div className="text-sm text-accent">💰 {user.coins_balance || 0}</div>
                  <div className="text-sm text-fire-orange">🔥 {user.fires_balance || 0}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <RoleManagementDropdown 
                    user={user} 
                    onRolesUpdated={() => {
                      // Refrescar la lista de usuarios
                      queryClient.invalidateQueries(['admin-users']);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleResetCredentials(user.id, user.username)}
                    className="px-3 py-1 rounded-full text-xs bg-warning/20 text-warning hover:bg-warning/30 transition-colors"
                  >
                    Reiniciar clave
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {user.roles?.map((role) => (
                <span key={role} className="badge-coins text-xs">
                  {role === 'tote' ? '👑' : role === 'admin' ? '⚙️' : '👤'} {role}
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
  const [activeTab, setActiveTab] = useState('events');

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 border-b border-text/10 mb-6 px-4">
        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'events'
              ? 'text-accent border-b-2 border-accent'
              : 'text-text/60 hover:text-text'
          }`}
        >
          <Gift size={18} />
          Eventos
        </button>
        <button
          onClick={() => setActiveTab('direct')}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'direct'
              ? 'text-accent border-b-2 border-accent'
              : 'text-text/60 hover:text-text'
          }`}
        >
          <Send size={18} />
          Envío Directo
        </button>
      </div>

      {/* Content */}
      {activeTab === 'events' && <WelcomeEventsManager />}
      {activeTab === 'direct' && <DirectGiftsSender />}
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
        await axios.put(`/api/economy/fire-requests/${selectedRequest.id}/approve`, {
          review_notes: reviewNotes
        });
        toast.success('Solicitud aprobada exitosamente');
      } else {
        await axios.put(`/api/economy/fire-requests/${selectedRequest.id}/reject`, {
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

// Admin Redemptions Component
const AdminRedemptions = () => {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState('pending');
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedRedemption, setSelectedRedemption] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [actionNotes, setActionNotes] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [proofUrl, setProofUrl] = useState('');

  const { data: redemptions, isLoading } = useQuery({
    queryKey: ['admin-redemptions', selectedStatus],
    queryFn: async () => {
      const params = selectedStatus !== 'all' ? `?status=${selectedStatus}` : '';
      const response = await axios.get(`/api/market/redeems/list${params}`);
      return response.data.redemptions;
    },
    refetchInterval: 10000
  });

  const handleAction = (redemption, type) => {
    setSelectedRedemption(redemption);
    setActionType(type);
    setShowActionModal(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedRedemption) return;

    try {
      if (actionType === 'accept') {
        if (!transactionId.trim()) {
          toast.error('El ID de transacción es requerido');
          return;
        }

        await axios.post(`/api/market/redeems/${selectedRedemption.id}/accept`, {
          transaction_id: transactionId,
          proof_url: proofUrl,
          notes: actionNotes
        });
        toast.success('Canje aceptado exitosamente');
      } else {
        if (!actionNotes.trim()) {
          toast.error('La razón del rechazo es requerida');
          return;
        }

        await axios.post(`/api/market/redeems/${selectedRedemption.id}/reject`, {
          reason: actionNotes
        });
        toast.success('Canje rechazado');
      }

      queryClient.invalidateQueries(['admin-redemptions']);
      setShowActionModal(false);
      setSelectedRedemption(null);
      setActionType(null);
      setActionNotes('');
      setTransactionId('');
      setProofUrl('');
    } catch (error) {
      console.error('Error processing redemption:', error);
      toast.error(error.response?.data?.error || 'Error al procesar canje');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Repeat className="text-violet" />
        Canjes de Fuegos
      </h2>

      {/* Status Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {['pending', 'completed', 'rejected', 'all'].map((status) => (
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
            {status === 'completed' && '✅ Completados'}
            {status === 'rejected' && '❌ Rechazados'}
            {status === 'all' && '📋 Todos'}
          </button>
        ))}
      </div>

      {/* Redemptions List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : !redemptions || redemptions.length === 0 ? (
        <div className="card-glass text-center py-12">
          <Repeat size={48} className="mx-auto text-text/30 mb-3" />
          <p className="text-text/60">No hay canjes {selectedStatus === 'all' ? '' : selectedStatus}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {redemptions.map((redemption) => (
            <motion.div
              key={redemption.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-glass"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-lg">{redemption.username}</span>
                    {redemption.status === 'pending' && (
                      <span className="text-xs px-2 py-1 bg-warning/20 text-warning rounded-full">
                        Pendiente
                      </span>
                    )}
                    {redemption.status === 'completed' && (
                      <span className="text-xs px-2 py-1 bg-success/20 text-success rounded-full">
                        Completado
                      </span>
                    )}
                    {redemption.status === 'rejected' && (
                      <span className="text-xs px-2 py-1 bg-error/20 text-error rounded-full">
                        Rechazado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text/60 mb-1">
                    📧 {redemption.email}
                  </p>
                  <p className="text-xs text-text/40">
                    📅 Solicitado: {formatDate(redemption.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-fire-orange">
                    {redemption.fires_amount} 🔥
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div className="glass-panel p-3 mb-4 space-y-2">
                <div className="text-sm">
                  <span className="text-text/60">Cédula:</span>
                  <span className="ml-2 font-mono">{redemption.cedula}</span>
                </div>
                <div className="text-sm">
                  <span className="text-text/60">Teléfono:</span>
                  <span className="ml-2 font-mono">{redemption.phone}</span>
                </div>
                <div className="text-sm">
                  <span className="text-text/60">Banco:</span>
                  <span className="ml-2">{redemption.bank_name} ({redemption.bank_code})</span>
                </div>
                <div className="text-sm">
                  <span className="text-text/60">Cuenta:</span>
                  <span className="ml-2 font-mono">{redemption.bank_account}</span>
                </div>
              </div>

              {redemption.notes && (
                <div className="bg-glass/50 p-3 rounded-lg mb-4">
                  <p className="text-xs text-text/60 mb-1">Notas:</p>
                  <p className="text-sm">{redemption.notes}</p>
                  {redemption.processed_by_username && (
                    <p className="text-xs text-text/40 mt-1">
                      Procesado por: {redemption.processed_by_username} • {formatDate(redemption.processed_at)}
                    </p>
                  )}
                </div>
              )}

              {redemption.transaction_id && (
                <div className="bg-success/10 p-3 rounded-lg mb-4">
                  <p className="text-xs text-success/80 mb-1">ID de Transacción:</p>
                  <p className="text-sm font-mono">{redemption.transaction_id}</p>
                  {redemption.proof_url && (
                    <a 
                      href={redemption.proof_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:underline mt-1 inline-block"
                    >
                      Ver comprobante →
                    </a>
                  )}
                </div>
              )}

              {redemption.reason && (
                <div className="bg-error/10 p-3 rounded-lg mb-4">
                  <p className="text-xs text-error/80 mb-1">Razón del rechazo:</p>
                  <p className="text-sm">{redemption.reason}</p>
                </div>
              )}

              {redemption.status === 'pending' && (
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => handleAction(redemption, 'reject')}
                    className="flex-1 py-2 px-4 bg-error/20 hover:bg-error/30 text-error rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircle size={18} />
                    Rechazar
                  </button>
                  <button
                    onClick={() => handleAction(redemption, 'accept')}
                    className="flex-1 py-2 px-4 bg-success/20 hover:bg-success/30 text-success rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={18} />
                    Aceptar
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Action Modal */}
      {showActionModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl max-w-md w-full p-6"
          >
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              {actionType === 'accept' ? (
                <>
                  <CheckCircle className="text-success" />
                  Aceptar Canje
                </>
              ) : (
                <>
                  <XCircle className="text-error" />
                  Rechazar Canje
                </>
              )}
            </h3>

            <div className="mb-4 p-3 bg-glass rounded-lg">
              <p className="text-sm text-text/60 mb-1">Usuario:</p>
              <p className="font-bold">{selectedRedemption?.username}</p>
              <p className="text-sm text-text/60 mt-2 mb-1">Monto:</p>
              <p className="text-xl font-bold text-fire-orange">{selectedRedemption?.fires_amount} 🔥</p>
            </div>

            {actionType === 'accept' ? (
              <>
                <input
                  type="text"
                  placeholder="ID de Transacción *"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="w-full px-4 py-3 bg-glass rounded-lg text-text mb-3"
                />
                <input
                  type="url"
                  placeholder="URL del Comprobante (opcional)"
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-glass rounded-lg text-text mb-3"
                />
              </>
            ) : null}

            <textarea
              placeholder={actionType === 'accept' ? 'Notas (opcional)' : 'Razón del rechazo *'}
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              className="w-full px-4 py-3 bg-glass rounded-lg text-text mb-4 min-h-[100px] resize-none"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowActionModal(false);
                  setActionNotes('');
                  setTransactionId('');
                  setProofUrl('');
                }}
                className="flex-1 py-3 px-4 bg-glass hover:bg-glass-hover rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAction}
                className={`flex-1 py-3 px-4 rounded-lg transition-colors ${
                  actionType === 'accept'
                    ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
                    : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                }`}
              >
                Confirmar {actionType === 'accept' ? 'Aceptación' : 'Rechazo'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

// Admin FIAT monitoring component
const AdminFiat = () => {
  const queryClient = useQueryClient();
  const [scrapingSource, setScrapingSource] = useState(null);

  const scrapeMutation = useMutation({
    mutationFn: async (source) => {
      const response = await axios.post('/api/admin/fiat/scrape', { source });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-fiat-rates']);
      queryClient.invalidateQueries(['economy-fiat-context']);
    }
  });

  const handleScrape = async (source) => {
    try {
      setScrapingSource(source);
      await scrapeMutation.mutateAsync(source);
      toast.success(`Tasa ${source.toUpperCase()} actualizada`);
    } catch (error) {
      const msg = error?.response?.data?.error || 'Error al actualizar tasas FIAT';
      toast.error(msg);
    } finally {
      setScrapingSource(null);
    }
  };

  const {
    data: ratesData,
    isLoading: loadingRates,
    error: errorRates
  } = useQuery({
    queryKey: ['admin-fiat-rates'],
    queryFn: async () => {
      const response = await axios.get('/api/admin/fiat/rates', {
        params: { limit: 60 }
      });
      return response.data;
    },
    refetchInterval: 15000
  });

  const {
    data: opsData,
    isLoading: loadingOps,
    error: errorOps
  } = useQuery({
    queryKey: ['admin-fiat-operations'],
    queryFn: async () => {
      const response = await axios.get('/api/admin/fiat/operations', {
        params: { limit: 50 }
      });
      return response.data;
    },
    refetchInterval: 15000
  });

  const { data: fiatContext } = useQuery({
    queryKey: ['economy-fiat-context'],
    queryFn: async () => {
      const response = await axios.get('/api/economy/fiat-context');
      return response.data;
    },
    refetchInterval: 15000
  });

  const rates = ratesData?.rates || [];
  const operations = opsData?.operations || [];

  const getLatest = (source) => {
    return rates.find((r) => r.source === source) || null;
  };

  const latestBcv = getLatest('bcv');
  const latestBinance = getLatest('binance');
  const latestMxyz = getLatest('mundoxyz');

  const bcvRate = latestBcv ? parseFloat(latestBcv.rate) : null;
  const binanceRate = latestBinance ? parseFloat(latestBinance.rate) : null;
  const mxyzRate = latestMxyz ? parseFloat(latestMxyz.rate) : null;

  let inferredMargin = null;
  if (binanceRate && mxyzRate && binanceRate > 0) {
    inferredMargin = (1 - mxyzRate / binanceRate) * 100;
  }

  const pegFires = 300;
  const pegUsdt = 1;
  const pegVes = mxyzRate && Number.isFinite(mxyzRate) ? mxyzRate : null;

  const configFiat = fiatContext?.config || null;
  const isDegradedCtx = fiatContext?.isDegraded ?? null;
  const usedFallbackCtx = fiatContext?.usedFallback ?? null;

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <DollarSign size={20} className="text-accent" />
        FIAT / Tasas y Operaciones
      </h2>
      <p className="text-sm text-text/60 mb-4">
        Monitoreo del plugin FIAT: tasas BCV, Binance P2P y tasa operativa MundoXYZ (Binance - margen) con peg
        fijo de 300 fuegos = 1 USDT.
      </p>

      {/* Plugin FIAT config overview */}
      <div className="card-glass p-4">
        <h3 className="text-sm font-semibold text-text/70 mb-2 flex items-center gap-2">
          <Shield size={16} className="text-accent" />
          Estado del Plugin FIAT
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-text/70">
          <div>
            <div className="text-text/50">Habilitado</div>
            <div className="font-semibold">
              {configFiat ? (configFiat.is_enabled ? 'Sí' : 'No') : '—'}
            </div>
          </div>
          <div>
            <div className="text-text/50">Shadow mode</div>
            <div className="font-semibold">
              {configFiat ? (configFiat.shadow_mode_enabled ? 'Sí' : 'No') : '—'}
            </div>
          </div>
          <div>
            <div className="text-text/50">TTL tasas (min)</div>
            <div className="font-semibold">
              {configFiat?.max_rate_age_minutes ?? 30}
            </div>
          </div>
          <div>
            <div className="text-text/50">Contexto degradado</div>
            <div className="font-semibold">
              {isDegradedCtx == null ? '—' : isDegradedCtx ? 'Sí' : 'No'}
            </div>
          </div>
          <div>
            <div className="text-text/50">Usando fallback (BCV)</div>
            <div className="font-semibold">
              {usedFallbackCtx == null ? '—' : usedFallbackCtx ? 'Sí' : 'No'}
            </div>
          </div>
          <div>
            <div className="text-text/50">Margen config (%)</div>
            <div className="font-semibold">
              {configFiat?.margin_percent != null
                ? parseFloat(configFiat.margin_percent).toFixed(2)
                : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-glass p-4">
          <div className="flex items-center justify-between mb-2 gap-2">
            <h3 className="text-sm font-semibold text-text/70 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-glass">
                $</span>
              BCV (USD/VES)
            </h3>
            <button
              type="button"
              onClick={() => handleScrape('bcv')}
              disabled={scrapingSource !== null}
              className="px-3 py-1 rounded-full text-[11px] bg-glass hover:bg-glass-hover text-text/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scrapingSource === 'bcv' ? 'Consultando…' : 'Consultar'}
            </button>
          </div>
          <div className="text-2xl font-bold">
            {bcvRate ? bcvRate.toFixed(2) : '—'} <span className="text-sm text-text/60">Bs</span>
          </div>
          {latestBcv && (
            <p className="text-xs text-text/50 mt-2">
              Capturado: {new Date(latestBcv.captured_at).toLocaleString('es-ES')}
            </p>
          )}
        </div>

        <div className="card-glass p-4">
          <div className="flex items-center justify-between mb-2 gap-2">
            <h3 className="text-sm font-semibold text-text/70 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-glass">
                $</span>
              Binance P2P (USD/VES)
            </h3>
            <button
              type="button"
              onClick={() => handleScrape('binance')}
              disabled={scrapingSource !== null}
              className="px-3 py-1 rounded-full text-[11px] bg-glass hover:bg-glass-hover text-text/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scrapingSource === 'binance' ? 'Consultando…' : 'Consultar'}
            </button>
          </div>
          <div className="text-2xl font-bold">
            {binanceRate ? binanceRate.toFixed(2) : '—'} <span className="text-sm text-text/60">Bs</span>
          </div>
          {latestBinance && (
            <p className="text-xs text-text/50 mt-2">
              Capturado: {new Date(latestBinance.captured_at).toLocaleString('es-ES')}
            </p>
          )}
        </div>

        <div className="card-glass p-4">
          <h3 className="text-sm font-semibold text-text/70 mb-2 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-glass">
              $</span>
            MundoXYZ (Operativa)
          </h3>
          <div className="text-2xl font-bold">
            {mxyzRate ? mxyzRate.toFixed(2) : '—'} <span className="text-sm text-text/60">Bs</span>
          </div>
          <p className="text-xs text-text/50 mt-2">
            Peg: {pegFires} fuegos = {pegUsdt.toFixed(2)} USDT
            {pegVes && Number.isFinite(pegVes) && (
              <>
                {' '}
                (≈ {pegVes.toFixed(2)} Bs)
              </>
            )}
          </p>
          {inferredMargin && Number.isFinite(inferredMargin) && (
            <p className="text-xs text-text/50 mt-1">
              Margen vs Binance ≈ {Math.abs(inferredMargin).toFixed(2)}%
            </p>
          )}
        </div>
      </div>

      {/* Loading / error states */}
      {(loadingRates || loadingOps) && (
        <div className="flex items-center gap-2 text-sm text-text/60">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent" />
          <span>Cargando datos FIAT...</span>
        </div>
      )}
      {(errorRates || errorOps) && (
        <div className="card-glass bg-error/10 border border-error/40 p-3 text-xs text-error">
          Error cargando datos FIAT. Revisa logs y conectividad a BCV/Binance.
        </div>
      )}

      {/* Rates table */}
      <div className="card-glass p-4 overflow-x-auto">
        <h3 className="text-sm font-semibold text-text/70 mb-3 flex items-center gap-2">
          <TrendingUp size={16} className="text-accent" />
          Últimas tasas capturadas
        </h3>
        {rates.length === 0 ? (
          <p className="text-xs text-text/60 py-2">No hay tasas registradas aún.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-text/50 border-b border-glass">
              <tr>
                <th className="text-left py-2 pr-2">Fuente</th>
                <th className="text-left py-2 pr-2">Par</th>
                <th className="text-right py-2 pr-2">Tasa</th>
                <th className="text-right py-2 pr-2">Spread vs BCV</th>
                <th className="text-right py-2 pr-2">Degradada</th>
                <th className="text-right py-2 pl-2">Capturada</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => {
                const spread = r.spread_vs_bcv != null ? parseFloat(r.spread_vs_bcv) : null;
                return (
                  <tr key={r.id} className="border-b border-glass/40 last:border-b-0">
                    <td className="py-1.5 pr-2 capitalize">{r.source}</td>
                    <td className="py-1.5 pr-2">{r.pair}</td>
                    <td className="py-1.5 pr-2 text-right">{parseFloat(r.rate).toFixed(4)}</td>
                    <td className="py-1.5 pr-2 text-right">
                      {spread != null && Number.isFinite(spread) ? spread.toFixed(4) : '—'}
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      {r.is_degraded ? 'Sí' : 'No'}
                    </td>
                    <td className="py-1.5 pl-2 text-right text-text/50">
                      {new Date(r.captured_at).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Operations table */}
      <div className="card-glass p-4 overflow-x-auto">
        <h3 className="text-sm font-semibold text-text/70 mb-3 flex items-center gap-2">
          <Activity size={16} className="text-accent" />
          Operaciones FIAT recientes
        </h3>
        {operations.length === 0 ? (
          <p className="text-xs text-text/60 py-2">No hay operaciones FIAT registradas.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-text/50 border-b border-glass">
              <tr>
                <th className="text-left py-2 pr-2">Usuario</th>
                <th className="text-left py-2 pr-2">Dirección</th>
                <th className="text-left py-2 pr-2">Estado</th>
                <th className="text-right py-2 pr-2">Tokens</th>
                <th className="text-right py-2 pr-2">USDT</th>
                <th className="text-right py-2 pr-2">Bs</th>
                <th className="text-right py-2 pl-2">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((op) => {
                const tokens = op.tokens_amount != null ? parseFloat(op.tokens_amount) : null;
                const usdt = op.usdt_equivalent != null ? parseFloat(op.usdt_equivalent) : null;
                const ves = op.fiat_amount_ves != null ? parseFloat(op.fiat_amount_ves) : null;
                return (
                  <tr key={op.id} className="border-b border-glass/40 last:border-b-0">
                    <td className="py-1.5 pr-2">{op.username || '—'}</td>
                    <td className="py-1.5 pr-2 capitalize">{op.direction}</td>
                    <td className="py-1.5 pr-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide ${
                          op.status === 'approved'
                            ? 'bg-success/20 text-success'
                            : op.status === 'pending'
                            ? 'bg-warning/20 text-warning'
                            : 'bg-error/20 text-error'
                        }`}
                      >
                        {op.status}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      {tokens != null && Number.isFinite(tokens) ? tokens.toFixed(2) : '—'}
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      {usdt != null && Number.isFinite(usdt) ? usdt.toFixed(4) : '—'}
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      {ves != null && Number.isFinite(ves) ? ves.toFixed(2) : '—'}
                    </td>
                    <td className="py-1.5 pl-2 text-right text-text/50">
                      {new Date(op.created_at).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
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
          <NavLink
            to="/admin/redemptions"
            className={({ isActive }) => 
              `flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
                isActive ? 'bg-violet/20 text-violet' : 'text-text/60 hover:text-text'
              }`
            }
          >
            <Repeat size={18} />
            Canjes
          </NavLink>
          <NavLink
            to="/admin/fiat"
            className={({ isActive }) => 
              `flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
                isActive ? 'bg-violet/20 text-violet' : 'text-text/60 hover:text-text'
              }`
            }
          >
            <DollarSign size={18} />
            FIAT
          </NavLink>
        </div>
      </nav>

      {/* Admin Routes */}
      <Routes>
        <Route index element={<AdminStats />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="welcome" element={<AdminWelcome />} />
        <Route path="fire-requests" element={<AdminFireRequests />} />
        <Route path="redemptions" element={<AdminRedemptions />} />
        <Route path="fiat" element={<AdminFiat />} />
      </Routes>
    </div>
  );
};

export default Admin;
