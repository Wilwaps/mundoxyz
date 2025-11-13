import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
  User, 
  Trophy, 
  Coins, 
  Flame, 
  Calendar,
  Award,
  TrendingUp,
  LogOut,
  Lock,
  Key
} from 'lucide-react';
import toast from 'react-hot-toast';
import PasswordChangeModal from '../components/PasswordChangeModal';
import WalletHistoryModal from '../components/WalletHistoryModal';
import SendFiresModal from '../components/SendFiresModal';
import BuyFiresModal from '../components/BuyFiresModal';
import ReceiveFiresModal from '../components/ReceiveFiresModal';
import MyDataModal from '../components/MyDataModal';
import AdminRoomsManager from '../components/bingo/AdminRoomsManager';

const Profile = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showMyData, setShowMyData] = useState(false);
  const [showFiresHistory, setShowFiresHistory] = useState(false);
  const [showSendFires, setShowSendFires] = useState(false);
  const [showBuyFires, setShowBuyFires] = useState(false);
  const [showReceiveFires, setShowReceiveFires] = useState(false);
  const [walletAddress, setWalletAddress] = useState(user?.wallet_address || null);
  const [walletHistoryInitialTab, setWalletHistoryInitialTab] = useState('fires');

  // Detectar query params para abrir modales de wallet/fuegos
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const open = params.get('open'); // 'send' | 'buy' | 'receive'
    const initial = (tab === 'coins' || tab === 'fires') ? tab : 'fires';
    setWalletHistoryInitialTab(initial);

    if (open === 'send') {
      setShowFiresHistory(false);
      setShowSendFires(true);
      return;
    }
    if (open === 'buy') {
      setShowFiresHistory(false);
      setShowBuyFires(true);
      return;
    }
    if (open === 'receive') {
      setShowFiresHistory(false);
      setShowReceiveFires(true);
      return;
    }

    if (tab === 'fires' || tab === 'coins') {
      setShowFiresHistory(true);
    }
  }, [location.search]);

  // Sync walletAddress when user changes
  React.useEffect(() => {
    if (user?.wallet_address) {
      setWalletAddress(user.wallet_address);
    }
  }, [user?.wallet_address]);

  // Fetch user stats
  const { data: stats } = useQuery({
    queryKey: ['user-stats', user?.id],
    queryFn: async () => {
      const response = await axios.get(`/api/profile/${user.id}/stats`);
      return response.data;
    },
    enabled: !!user?.id,
    refetchInterval: 10000, // Refetch cada 10 segundos
    refetchIntervalInBackground: false
  });

  // Fetch wallet address
  const { data: walletData } = useQuery({
    queryKey: ['user-wallet', user?.id],
    queryFn: async () => {
      const response = await axios.get(`/api/profile/${user.id}`);
      setWalletAddress(response.data.wallet_address);
      return response.data;
    },
    enabled: !!user?.id,
    refetchInterval: 10000, // Refetch cada 10 segundos
    refetchIntervalInBackground: false
  });

  // Fetch user games
  const { data: games } = useQuery({
    queryKey: ['user-games', user?.id],
    queryFn: async () => {
      const response = await axios.get(`/api/profile/${user.id}/games`);
      return response.data;
    },
    enabled: !!user?.id
  });

  const handleLogout = async () => {
    if (window.confirm('¿Seguro que quieres cerrar sesión?')) {
      await logout();
    }
  };

  const handleRefreshBalance = async () => {
    await refreshUser();
    // Invalidar todas las queries para forzar actualización
    queryClient.invalidateQueries(['user-stats', user?.id]);
    queryClient.invalidateQueries(['user-wallet', user?.id]);
    queryClient.invalidateQueries(['user-games', user?.id]);
    toast.success('Balance actualizado');
  };

  return (
    <div className="p-4">
      {/* Profile Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-glass mb-6"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="Avatar" className="w-full h-full rounded-full" />
            ) : (
              <User size={36} className="text-background-dark" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-text">{user?.display_name || user?.username}</h2>
            <p className="text-text/60">@{user?.username}</p>
            {user?.tg_id && (
              <p className="text-xs text-text/40">ID: {user.tg_id}</p>
            )}
          </div>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="glass-panel p-4 text-center cursor-pointer"
            onClick={handleRefreshBalance}
          >
            <Coins className="w-8 h-8 mx-auto mb-2 text-accent" />
            <div className="text-2xl font-bold text-accent">{user?.coins_balance || 0}</div>
            <div className="text-xs text-text/60">Monedas</div>
          </motion.div>
          
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="glass-panel p-4 text-center cursor-pointer"
            onClick={() => setShowFiresHistory(true)}
          >
            <Flame className="w-8 h-8 mx-auto mb-2 text-fire-orange" />
            <div className="text-2xl font-bold text-fire-orange">{user?.fires_balance || 0}</div>
            <div className="text-xs text-text/60">Fuegos</div>
          </motion.div>
        </div>

        {/* Roles */}
        {user?.roles?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-glass">
            <div className="flex flex-wrap gap-2">
              {(Array.isArray(user.roles) ? user.roles : []).map((role) => (
                <span 
                  key={role} 
                  className={`badge-coins ${
                    (role === 'tote' || role === 'admin') 
                      ? 'cursor-pointer hover:scale-105 transition-transform' 
                      : ''
                  }`}
                  onClick={() => {
                    if (role === 'tote' || role === 'admin') {
                      navigate('/admin');
                    }
                  }}
                  title={(role === 'tote' || role === 'admin') ? 'Ir al Panel Admin' : ''}
                >
                  {role === 'tote' ? '👑' : role === 'admin' ? '⚙️' : '👤'} {role}
                </span>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Stats Section */}
      {stats && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-glass mb-6"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-accent" />
            Estadísticas
          </h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-violet">
                {stats.games?.bingo?.played || 0}
              </div>
              <div className="text-xs text-text/60">Bingos Jugados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">
                {stats.games?.bingo?.won || 0}
              </div>
              <div className="text-xs text-text/60">Bingos Ganados</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Admin Rooms Manager - Solo para tote/admin */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <AdminRoomsManager />
      </motion.div>

      {/* Achievements */}
      {stats?.achievements?.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-glass mb-6"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Award size={20} className="text-fire-orange" />
            Logros
          </h3>

          <div className="space-y-3">
            {stats.achievements.map((achievement, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="text-2xl">{achievement.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold text-text">{achievement.name}</div>
                  <div className="text-xs text-text/60">{achievement.description}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Active Games */}
      {games && games.bingo?.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card-glass mb-6"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Trophy size={20} className="text-accent" />
            Partidas Activas
          </h3>

          {games.bingo?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-text/60 mb-2">Bingo</h4>
              {games.bingo.map((room) => (
                <div key={room.id} className="glass-panel p-3 mb-2">
                  <div className="font-semibold text-text">{room.name}</div>
                  <div className="text-xs text-text/60">
                    Código: {room.code} • Cartones: {room.cards_count}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Account Info */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="card-glass mb-6"
      >
        <h3 className="text-lg font-bold mb-4">Información de Cuenta</h3>
        
        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2 text-text/60">
            <Calendar size={16} />
            <span className="text-sm">
              Miembro desde: {new Date(user?.created_at).toLocaleDateString()}
            </span>
          </div>
          
          {user?.is_verified && (
            <div className="flex items-center gap-2 text-success">
              <Award size={16} />
              <span className="text-sm">Cuenta verificada</span>
            </div>
          )}
        </div>

        {/* My Data Button */}
        <button
          onClick={() => setShowMyData(true)}
          className="w-full py-3 px-4 bg-glass hover:bg-glass-hover rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <User size={18} className="text-accent" />
          <span>Mis Datos</span>
        </button>

        {/* Password Button */}
        <button
          onClick={() => setShowPasswordModal(true)}
          className="w-full py-3 px-4 bg-glass hover:bg-glass-hover rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Lock size={18} className="text-violet" />
          <span>Cambiar Contraseña</span>
        </button>
      </motion.div>

      {/* Logout Button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        onClick={handleLogout}
        className="w-full btn-secondary flex items-center justify-center gap-2"
      >
        <LogOut size={20} />
        Cerrar Sesión
      </motion.button>

      {/* Modals */}
      <PasswordChangeModal 
        isOpen={showPasswordModal} 
        onClose={() => setShowPasswordModal(false)} 
      />
      
      <WalletHistoryModal 
        isOpen={showFiresHistory}
        onClose={() => setShowFiresHistory(false)}
        onOpenSend={() => setShowSendFires(true)}
        onOpenBuy={() => setShowBuyFires(true)}
        onOpenReceive={() => setShowReceiveFires(true)}
        initialTab={walletHistoryInitialTab}
      />
      
      <SendFiresModal 
        isOpen={showSendFires} 
        onClose={() => setShowSendFires(false)}
        currentBalance={user?.fires_balance || 0}
        onSuccess={() => {
          refreshUser();
          setShowFiresHistory(true);
        }}
      />
      
      <BuyFiresModal 
        isOpen={showBuyFires} 
        onClose={() => setShowBuyFires(false)}
        onSuccess={() => {
          toast.success('Solicitud enviada exitosamente');
          setShowFiresHistory(true);
        }}
      />
      
      <ReceiveFiresModal 
        isOpen={showReceiveFires} 
        onClose={() => setShowReceiveFires(false)}
        walletAddress={user?.wallet_address || walletAddress}
      />

      <MyDataModal
        isOpen={showMyData}
        onClose={() => setShowMyData(false)}
      />
    </div>
  );
};

export default Profile;
