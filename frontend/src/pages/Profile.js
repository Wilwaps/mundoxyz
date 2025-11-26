import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
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
  Key,
  Share2,
  Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import PasswordChangeModal from '../components/PasswordChangeModal';
import WalletHistoryModal from '../components/WalletHistoryModal';
import SendFiresModal from '../components/SendFiresModal';
import BuyFiresModal from '../components/BuyFiresModal';
import ReceiveFiresModal from '../components/ReceiveFiresModal';
import MyDataModal from '../components/MyDataModal';
import AdminRoomsManager from '../components/bingo/AdminRoomsManager';
import * as raffleApi from '../features/raffles/api';
import { useUserRaffles } from '../features/raffles/hooks/useRaffleData';
import RaffleCard from '../features/raffles/components/RaffleCard';
import { downloadQrForUrl } from '../utils/qr';

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
  const [raffleSettings, setRaffleSettings] = useState({ prizeModeCostFires: 500, companyModeCostFires: 500 });
  const [raffleSettingsLoading, setRaffleSettingsLoading] = useState(false);
  const [raffleSettingsSaving, setRaffleSettingsSaving] = useState(false);
  const [forceSecuritySetup, setForceSecuritySetup] = useState(false);
  const [rafflesTab, setRafflesTab] = useState('active'); // 'active' | 'finished'
  const [giftLinks, setGiftLinks] = useState([]);
  const [giftLinksLoading, setGiftLinksLoading] = useState(false);
  const [giftLinkForm, setGiftLinkForm] = useState({
    firesPerUser: '',
    maxClaims: '',
    expiresHours: 72,
    message: '',
    origin: 'supply'
  });
  const [creatingGiftLink, setCreatingGiftLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [showReferralsModal, setShowReferralsModal] = useState(false);
  const [shareStoreMenuId, setShareStoreMenuId] = useState(null);

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

  const fetchGiftLinks = async () => {
    if (!user || !Array.isArray(user.roles) || !user.roles.includes('tote')) return;
    try {
      setGiftLinksLoading(true);
      const response = await axios.get('/api/gifts/links/my', {
        params: { limit: 50, offset: 0 }
      });
      setGiftLinks(Array.isArray(response.data?.links) ? response.data.links : []);
    } catch (error) {
      console.error('Error loading gift links:', error);
      toast.error('Error al cargar links de regalo');
    } finally {
      setGiftLinksLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !Array.isArray(user.roles) || !user.roles.includes('tote')) return;
    const loadSettings = async () => {
      try {
        setRaffleSettingsLoading(true);
        const data = await raffleApi.getRaffleSettings();
        setRaffleSettings({
          prizeModeCostFires: Number(data.prizeModeCostFires) || 0,
          companyModeCostFires: Number(data.companyModeCostFires) || 0
        });
      } catch (error) {
        console.error('Error loading raffle settings:', error);
        toast.error('Error al cargar configuración de rifas');
      } finally {
        setRaffleSettingsLoading(false);
      }
    };
    loadSettings();
  }, [user?.id]);

  useEffect(() => {
    if (!user || !Array.isArray(user.roles) || !user.roles.includes('tote')) return;
    fetchGiftLinks();
  }, [user?.id]);

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

  // Fetch store staff
  const {
    data: storeStaff,
    isLoading: storeStaffLoading,
    error: storeStaffError
  } = useQuery({
    queryKey: ['store-staff-user', user?.id],
    queryFn: async () => {
      const response = await axios.get(`/api/admin/store-staff/user/${user.id}`);
      return response.data;
    },
    enabled: !!user?.id
  });

  const myStores = Array.isArray(storeStaff) ? storeStaff : [];

  // Fetch user store orders ("Mis pedidos")
  const {
    data: myOrdersData,
    isLoading: myOrdersLoading,
    error: myOrdersError
  } = useQuery({
    queryKey: ['my-store-orders', user?.id],
    queryFn: async () => {
      const response = await axios.get('/api/store/order/my', {
        params: { limit: 20 }
      });
      return response.data;
    },
    enabled: !!user?.id
  });

  const myOrders = Array.isArray(myOrdersData?.orders) ? myOrdersData.orders : [];

  const {
    data: referralsInfo,
    isLoading: referralsLoading,
    error: referralsError,
    refetch: refetchReferrals
  } = useQuery({
    queryKey: ['my-referrals', user?.id],
    queryFn: async () => {
      const response = await axios.get('/api/referrals/me');
      return response.data;
    },
    enabled: !!user?.id
  });

  const tapMutation = useMutation({
    mutationFn: async (targetUserId) => {
      const response = await axios.post('/api/referrals/tap', {
        target_user_id: targetUserId
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Tap enviado');
      refetchReferrals();
    },
    onError: (error) => {
      const status = error?.response?.status;
      if (status === 429) {
        const data = error.response?.data || {};
        const next = data.next_available_at;
        let message = data.error || 'Solo puedes enviar un tap cada 24 horas';
        if (next) {
          try {
            const dt = new Date(next);
            message += ` (próximo tap: ${dt.toLocaleString('es-ES')})`;
          } catch (e) {}
        }
        toast.error(message);
      } else {
        const msg = error?.response?.data?.error || 'Error al enviar tap';
        toast.error(msg);
      }
    }
  });

  const referralsEnabled =
    referralsInfo?.user?.referrals_enabled !== undefined
      ? !!referralsInfo.user.referrals_enabled
      : true;
  const myReferrer = referralsInfo?.referrer || null;
  const myReferrals = Array.isArray(referralsInfo?.referrals) ? referralsInfo.referrals : [];
  const myCommissions = Array.isArray(referralsInfo?.commissions)
    ? referralsInfo.commissions
    : [];
  const tapsLast24h = referralsInfo?.taps_last_24h || { sent: 0, received: 0 };
  const myReferralLink = referralsInfo?.referral_link || '';
  const canSendTap = tapsLast24h.sent === 0 && !tapMutation.isLoading;

  // Rifas del usuario (como host)
  const {
    data: userRaffles = [],
    isLoading: rafflesLoading,
    error: rafflesError
  } = useUserRaffles();

  const createdRaffles = Array.isArray(userRaffles) ? userRaffles : [];

  const myActiveRaffles = createdRaffles.filter((r) => r.status === 'active');
  const myFinishedRaffles = createdRaffles.filter((r) => r.status === 'finished');

  const getStoreRoleLabel = (role) => {
    if (role === 'owner') return 'Dueño';
    if (role === 'admin') return 'Admin';
    if (role === 'manager') return 'Gerente';
    if (role === 'seller') return 'Vendedor';
    if (role === 'marketing') return 'Marketing';
    return role;
  };

  const shareStore = async (row, platform) => {
    if (!row || !row.store_slug || typeof window === 'undefined') return;

    const url = `${window.location.origin}/store/${row.store_slug}`;
    const title = row.store_name || 'Mi tienda';
    const text = `Mira la tienda ${title} en MundoXYZ`;

    try {
      switch (platform) {
        case 'whatsapp': {
          const shareText = `${text} ${url}`;
          const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
          window.open(waUrl, '_blank', 'noopener,noreferrer');
          break;
        }
        case 'telegram': {
          const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
          window.open(tgUrl, '_blank', 'noopener,noreferrer');
          break;
        }
        case 'copy': {
          try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
              await navigator.clipboard.writeText(url);
              toast.success('Link de tienda copiado');
            } else {
              window.prompt('Copia este link de tu tienda:', url);
            }
          } catch (err) {
            console.error('Error copiando link de tienda:', err);
            window.prompt('Copia este link de tu tienda:', url);
          }
          break;
        }
        case 'qr': {
          try {
            await downloadQrForUrl(url, `tienda-${row.store_slug}-qr.png`);
          } catch (err) {
            console.error('Error generando QR de tienda:', err);
          }
          break;
        }
        default:
          break;
      }
    } finally {
      setShareStoreMenuId(null);
    }
  };

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

  const handleCreateGiftLink = async () => {
    if (!user || !Array.isArray(user.roles) || !user.roles.includes('tote')) return;

    const fires = Number(giftLinkForm.firesPerUser);
    const maxClaims = Number(giftLinkForm.maxClaims);
    const expiresHours = Number(giftLinkForm.expiresHours) || 72;

    if (!Number.isFinite(fires) || fires <= 0 || !Number.isFinite(maxClaims) || maxClaims <= 0) {
      toast.error('Ingresa valores válidos para fuegos por persona y cantidad de personas');
      return;
    }

    if (!giftLinkForm.message.trim()) {
      toast.error('El mensaje no puede estar vacío');
      return;
    }

    try {
      setCreatingGiftLink(true);
      setGeneratedLink(null);

      const payload = {
        fires_per_user: fires,
        max_claims: maxClaims,
        message: giftLinkForm.message,
        expires_hours: expiresHours,
        origin: 'supply'
      };

      const response = await axios.post('/api/gifts/links', payload);
      const gift = response.data?.gift;

      if (!gift) {
        throw new Error('Respuesta inválida del servidor');
      }

      const backendUrl = response.data?.url;
      const url = backendUrl || `${window.location.origin}/gift-link/${gift.link_token}`;

      setGeneratedLink({ url, gift });
      toast.success('Link de regalo creado');

      setGiftLinkForm((prev) => ({
        ...prev,
        firesPerUser: '',
        maxClaims: '',
        expiresHours,
        message: prev.message
      }));

      await fetchGiftLinks();
    } catch (error) {
      console.error('Error creating gift link:', error);
      const message = error?.response?.data?.error || 'Error al crear link de regalo';
      toast.error(message);
    } finally {
      setCreatingGiftLink(false);
    }
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
            onClick={() => {
              setWalletHistoryInitialTab('coins');
              setShowFiresHistory(true);
            }}
          >
            <Coins className="w-8 h-8 mx-auto mb-2 text-accent" />
            <div className="text-2xl font-bold text-accent">{user?.coins_balance || 0}</div>
            <div className="text-xs text-text/60">Monedas</div>
          </motion.div>
          
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="glass-panel p-4 text-center cursor-pointer"
            onClick={() => {
              setWalletHistoryInitialTab('fires');
              setShowFiresHistory(true);
            }}
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
              {(Array.isArray(user.roles) ? user.roles : []).map((role) => {
                const isAdminRole = role === 'tote' || role === 'admin';
                const isTitoRole = role === 'tito';
                const isClickable = isAdminRole || isTitoRole;

                let icon = '👤';
                if (role === 'tote') {
                  icon = '👑';
                } else if (role === 'admin') {
                  icon = '⚙️';
                } else if (role === 'tito') {
                  icon = '🧑‍🚀';
                }

                return (
                  <span
                    key={role}
                    className={`badge-coins ${
                      isClickable
                        ? 'cursor-pointer hover:scale-105 transition-transform'
                        : ''
                    }`}
                    onClick={() => {
                      if (isAdminRole) {
                        navigate('/admin');
                      } else if (isTitoRole) {
                        navigate('/tito');
                      }
                    }}
                    title={
                      isAdminRole
                        ? 'Ir al Panel Admin'
                        : isTitoRole
                        ? 'Ir al Panel Tito'
                        : ''
                    }
                  >
                    {icon} {role}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>

      {/* Mis Tiendas */}
      {myStores.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="card-glass mb-6"
        >
          <h3 className="text-lg font-bold mb-4">Mis tiendas</h3>
          {storeStaffLoading && (
            <div className="text-xs text-text/60 mb-2">Cargando tiendas...</div>
          )}
          {storeStaffError && (
            <div className="text-xs text-red-400 mb-2">Error al cargar tus tiendas</div>
          )}
          <div className="space-y-3">
            {myStores.map((row) => {
              const role = row.role;
              const canOpenDashboard =
                role === 'owner' || role === 'admin' || role === 'manager';
              const canOpenPos =
                role === 'owner' ||
                role === 'admin' ||
                role === 'manager' ||
                role === 'seller';

              return (
                <div
                  key={row.id}
                  className="glass-panel p-3 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3">
                    {row.logo_url ? (
                      <img
                        src={row.logo_url}
                        alt={row.store_name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-glass flex items-center justify-center text-sm font-semibold">
                        {(row.store_name || 'T')[0]}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-text">{row.store_name}</div>
                      <div className="text-xs text-text/60">
                        @{row.store_slug}  b7 {getStoreRoleLabel(row.role)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs mt-1">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setShareStoreMenuId((current) =>
                            current === row.id ? null : row.id
                          )
                        }
                        className="px-3 py-1 rounded-full bg-glass hover:bg-glass-hover flex items-center gap-1"
                      >
                        <Share2 size={12} />
                        Compartir
                      </button>
                      {shareStoreMenuId === row.id && (
                        <div className="absolute left-0 mt-1 w-44 rounded-lg bg-black/90 border border-white/10 shadow-lg z-20 text-xs">
                          <button
                            type="button"
                            onClick={() => shareStore(row, 'whatsapp')}
                            className="w-full text-left px-3 py-1.5 hover:bg-white/10"
                          >
                            WhatsApp
                          </button>
                          <button
                            type="button"
                            onClick={() => shareStore(row, 'telegram')}
                            className="w-full text-left px-3 py-1.5 hover:bg-white/10"
                          >
                            Telegram
                          </button>
                          <button
                            type="button"
                            onClick={() => shareStore(row, 'copy')}
                            className="w-full text-left px-3 py-1.5 hover:bg-white/10"
                          >
                            Copiar enlace
                          </button>
                          <button
                            type="button"
                            onClick={() => shareStore(row, 'qr')}
                            className="w-full text-left px-3 py-1.5 hover:bg-white/10"
                          >
                            Descargar QR
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/store/${row.store_slug}`)}
                      className="px-3 py-1 rounded-full bg-glass hover:bg-glass-hover"
                    >
                      Ver tienda
                    </button>

                    {canOpenDashboard && (
                      <button
                        type="button"
                        onClick={() => navigate(`/store/${row.store_slug}/dashboard`)}
                        className="px-3 py-1 rounded-full bg-accent/20 text-accent hover:bg-accent/30"
                      >
                        Panel de tienda
                      </button>
                    )}

                    {canOpenDashboard && (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/store/${row.store_slug}/dashboard?tab=settings`
                          )
                        }
                        className="px-3 py-1 rounded-full bg-accent/10 text-accent hover:bg-accent/20"
                      >
                        Configuraci f3n
                      </button>
                    )}

                    {canOpenPos && (
                      <button
                        type="button"
                        onClick={() => navigate(`/store/${row.store_slug}/pos`)}
                        className="px-3 py-1 rounded-full bg-accent/20 text-accent hover:bg-accent/30"
                      >
                        Ir al POS
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Mis pedidos */}
      {user && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="card-glass mb-6"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Trophy size={20} className="text-accent" />
            Mis pedidos
          </h3>

          {myOrdersLoading ? (
            <div className="py-4 text-sm text-text/60">Cargando tus pedidos...</div>
          ) : myOrdersError ? (
            <div className="py-4 text-sm text-red-400">Error al cargar tus pedidos</div>
          ) : myOrders.length === 0 ? (
            <div className="py-4 text-sm text-text/60">
              Aún no tienes pedidos registrados.
            </div>
          ) : (
            <>
              <div className="text-[11px] text-text/60 mb-2">
                Mostrando tus últimos {Math.min(myOrders.length, 5)} pedidos.
              </div>
              <div className="space-y-2 text-xs">
                {myOrders.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    className="glass-panel p-2 flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-text truncate">
                        {order.store_name || 'Tienda'}
                      </div>
                      <div className="text-[11px] text-text/60 flex flex-wrap gap-2">
                        <span>Estado: {order.status}</span>
                        <span>Pago: {order.payment_status}</span>
                      </div>
                      <div className="text-[11px] text-text/50">
                        {new Date(order.created_at).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                      <div className="text-sm font-semibold text-accent">
                        {Number(order.total_usdt || 0).toFixed(2)} USDT
                      </div>
                      {order.store_slug && order.invoice_number != null && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/store/${order.store_slug}/invoice/${order.invoice_number}`
                            )
                          }
                          className="px-3 py-1 rounded-full bg-glass hover:bg-glass-hover text-[11px]"
                        >
                          Ver factura
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Generador de links de regalo - Solo Tote */}
      {Array.isArray(user?.roles) && user.roles.includes('tote') && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="card-glass mb-6"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Flame size={20} className="text-fire-orange" />
            Generador de links de regalo
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-xs text-text/60 mb-1">Fuegos por persona (🔥)</div>
              <input
                type="number"
                min={1}
                value={giftLinkForm.firesPerUser}
                onChange={(e) =>
                  setGiftLinkForm((prev) => ({
                    ...prev,
                    firesPerUser: e.target.value
                  }))
                }
                className="w-full px-4 py-2 bg-glass rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <div className="text-xs text-text/60 mb-1">Cantidad de personas (slots)</div>
              <input
                type="number"
                min={1}
                value={giftLinkForm.maxClaims}
                onChange={(e) =>
                  setGiftLinkForm((prev) => ({
                    ...prev,
                    maxClaims: e.target.value
                  }))
                }
                className="w-full px-4 py-2 bg-glass rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <div className="text-xs text-text/60 mb-1">Expira en (horas)</div>
              <input
                type="number"
                min={1}
                value={giftLinkForm.expiresHours}
                onChange={(e) =>
                  setGiftLinkForm((prev) => ({
                    ...prev,
                    expiresHours: e.target.value
                  }))
                }
                className="w-full px-4 py-2 bg-glass rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="text-xs text-text/60 mb-1">Mensaje para el buzón (se muestra después de reclamar)</div>
            <textarea
              rows={3}
              value={giftLinkForm.message}
              onChange={(e) =>
                setGiftLinkForm((prev) => ({
                  ...prev,
                  message: e.target.value
                }))
              }
              className="w-full px-4 py-2 bg-glass rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="mb-4 text-xs text-text/60">
            Origen de los fuegos:
            <div className="mt-1 flex gap-3 items-center">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="radio"
                  checked={giftLinkForm.origin === 'supply'}
                  onChange={() =>
                    setGiftLinkForm((prev) => ({
                      ...prev,
                      origin: 'supply'
                    }))
                  }
                />
                <span>Desde supply (max supply)</span>
              </label>
              <label className="flex items-center gap-2 text-xs opacity-50 cursor-not-allowed">
                <input type="radio" disabled />
                <span>Desde mi wallet (próximamente)</span>
              </label>
            </div>
          </div>

          <button
            onClick={handleCreateGiftLink}
            disabled={creatingGiftLink}
            className="w-full py-3 px-4 bg-glass hover:bg-glass-hover rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            {creatingGiftLink ? 'Creando link...' : 'Crear link de regalo'}
          </button>

          {generatedLink && (
            <div className="mb-4 p-3 glass-panel text-xs">
              <div className="font-semibold mb-1">Link generado</div>
              <div className="flex flex-col md:flex-row md:items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedLink.url}
                  className="flex-1 px-3 py-2 bg-background-dark rounded-lg text-[11px]"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(generatedLink.url);
                      toast.success('Link copiado');
                    } catch (e) {
                      console.error('Error copying link:', e);
                      toast.error('No se pudo copiar el link');
                    }
                  }}
                  className="px-3 py-2 text-xs rounded-full bg-accent text-dark font-semibold"
                >
                  Copiar
                </button>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-text/80">Links creados</h4>
              {giftLinksLoading && (
                <span className="text-[11px] text-text/60">Cargando...</span>
              )}
            </div>

            {giftLinks.length === 0 ? (
              <p className="text-xs text-text/60">Aún no has creado links de regalo.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
                {giftLinks.map((link) => {
                  const totalSlots = link.max_claims != null ? Number(link.max_claims) : null;
                  const claimed = link.claimed_count != null ? Number(link.claimed_count) : 0;
                  const remaining = totalSlots != null ? Math.max(totalSlots - claimed, 0) : null;
                  const status = link.status;
                  const url = link.link_token
                    ? `${window.location.origin}/gift-link/${link.link_token}`
                    : '';

                  return (
                    <div key={link.id} className="glass-panel p-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold truncate">
                          {link.message?.slice(0, 40) || 'Sin mensaje'}
                        </div>
                        {url && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(url);
                                toast.success('Link copiado');
                              } catch (e) {
                                console.error('Error copying link:', e);
                                toast.error('No se pudo copiar el link');
                              }
                            }}
                            className="px-2 py-1 text-[10px] rounded-full bg-glass hover:bg-glass-hover"
                          >
                            Copiar
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] text-text/70">
                        <span>🔥 {Number(link.fires_amount || 0)} por persona</span>
                        {totalSlots != null && (
                          <span>
                            Slots: {claimed}/{totalSlots}
                            {remaining !== null && ` (libres: ${remaining})`}
                          </span>
                        )}
                        <span>
                          Estado: {status}
                        </span>
                        {link.expires_at && (
                          <span>
                            Expira: {new Date(link.expires_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {referralsInfo && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.13 }}
          className="card-glass mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Users size={20} className="text-accent" />
              Referidos
            </h3>
            {referralsLoading && (
              <span className="text-[11px] text-text/60">Cargando...</span>
            )}
          </div>

          {!referralsEnabled && (
            <div className="mb-4 text-xs text-text/60">
              Tienes los referidos desactivados. No generarás nuevas comisiones por ahora.
            </div>
          )}

          {myReferralLink && (
            <div className="mb-4 text-xs">
              <div className="text-text/60 mb-1">Tu link de invitación</div>
              <div className="flex flex-col md:flex-row md:items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={myReferralLink}
                  className="flex-1 px-3 py-2 bg-background-dark rounded-lg text-[11px]"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(myReferralLink);
                      toast.success('Link de referido copiado');
                    } catch (e) {
                      toast.error('No se pudo copiar el link');
                    }
                  }}
                  className="px-3 py-2 text-xs rounded-full bg-accent text-dark font-semibold"
                >
                  Copiar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await downloadQrForUrl(myReferralLink, 'mundoxyz-referral-qr.png');
                    } catch (e) {
                      // Errores ya manejados en la utilidad
                    }
                  }}
                  className="px-3 py-2 text-xs rounded-full bg-glass hover:bg-glass-hover text-text/80"
                >
                  QR
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2 text-xs">
              <div className="font-semibold text-text/80">Mi líder</div>
              {myReferrer ? (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm text-text">
                      {myReferrer.display_name || myReferrer.username}
                    </div>
                    <div className="text-[11px] text-text/60">@{myReferrer.username}</div>
                  </div>
                  <button
                    type="button"
                    disabled={!canSendTap}
                    onClick={() => tapMutation.mutate(myReferrer.id)}
                    className="px-3 py-1 rounded-full text-xs bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {canSendTap ? 'Enviar Tap' : 'Tap en 24h'}
                  </button>
                </div>
              ) : (
                <div className="text-text/60">
                  Aún no tienes líder asignado.
                </div>
              )}

              <div className="mt-3">
                <div className="font-semibold text-text/80 mb-1">Actividad de taps (24h)</div>
                <div className="flex justify-between">
                  <span className="text-text/60">Enviados</span>
                  <span className="font-semibold">{tapsLast24h.sent}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text/60">Recibidos</span>
                  <span className="font-semibold">{tapsLast24h.received}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-semibold text-text/80">Mis comisiones</div>
              {myCommissions.length === 0 ? (
                <div className="text-text/60">
                  Aún no tienes comisiones generadas.
                </div>
              ) : (
                <div className="space-y-1">
                  {myCommissions.map((row) => (
                    <div key={row.currency} className="flex justify-between">
                      <span className="text-text/60">{row.currency}</span>
                      <span className="font-semibold">
                        {Number(row.total || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div>
              <div className="font-semibold text-text/80">Mis referidos directos</div>
              <div className="text-text/60">
                {myReferrals.length} usuarios
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowReferralsModal(true)}
              disabled={myReferrals.length === 0}
              className="px-3 py-1 rounded-full bg-glass hover:bg-glass-hover text-text/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Ver detalle
            </button>
          </div>

          {referralsError && (
            <div className="mt-3 text-[11px] text-red-400">
              Error al cargar tus datos de referidos.
            </div>
          )}
        </motion.div>
      )}

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

      {/* Rifas del usuario */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="card-glass mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Trophy size={20} className="text-accent" />
            Rifas
          </h3>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setRafflesTab('active')}
              className={`px-3 py-1 rounded-full font-medium transition-colors ${
                rafflesTab === 'active'
                  ? 'bg-accent text-dark'
                  : 'bg-glass text-text/60 hover:text-text'
              }`}
            >
              Mis rifas
            </button>
            <button
              type="button"
              onClick={() => setRafflesTab('finished')}
              className={`px-3 py-1 rounded-full font-medium transition-colors ${
                rafflesTab === 'finished'
                  ? 'bg-accent text-dark'
                  : 'bg-glass text-text/60 hover:text-text'
              }`}
            >
              Finalizadas
            </button>
          </div>
        </div>

        {rafflesLoading ? (
          <div className="py-6 text-sm text-text/60">Cargando tus rifas...</div>
        ) : rafflesError ? (
          <div className="py-6 text-sm text-red-400">Error al cargar tus rifas</div>
        ) : (
          <>
            {rafflesTab === 'active' && (
              <div className="space-y-3">
                {myActiveRaffles.length === 0 ? (
                  <p className="text-sm text-text/60">
                    No tienes rifas activas como organizador.
                  </p>
                ) : (
                  myActiveRaffles.slice(0, 5).map((raffle) => (
                    <RaffleCard
                      key={raffle.id}
                      raffle={raffle}
                      variant="compact"
                    />
                  ))
                )}
              </div>
            )}

            {rafflesTab === 'finished' && (
              <div className="space-y-3">
                {myFinishedRaffles.length === 0 ? (
                  <p className="text-sm text-text/60">
                    Aún no tienes rifas finalizadas como organizador.
                  </p>
                ) : (
                  myFinishedRaffles.slice(0, 5).map((raffle) => (
                    <RaffleCard
                      key={raffle.id}
                      raffle={raffle}
                      variant="compact"
                    />
                  ))
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => navigate('/raffles/my')}
                className="text-xs px-3 py-1 rounded-full bg-glass hover:bg-glass-hover text-text/80"
              >
                Ver detalle de mis rifas
              </button>
            </div>
          </>
        )}
      </motion.div>

      {/* Admin Rooms Manager - Solo para tote/admin */}
      {Array.isArray(user?.roles) &&
        (user.roles.includes('tote') || user.roles.includes('admin')) && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card-glass mb-6"
          >
            <AdminRoomsManager />
          </motion.div>
        )}

      {Array.isArray(user?.roles) && user.roles.includes('tote') && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="card-glass mb-6"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Flame size={20} className="text-fire-orange" />
            Configuración de Rifas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-xs text-text/60 mb-1">Costo creación modo Premio (🔥)</div>
              <input
                type="number"
                value={raffleSettings.prizeModeCostFires}
                onChange={(e) =>
                  setRaffleSettings((prev) => ({
                    ...prev,
                    prizeModeCostFires: Number(e.target.value)
                  }))
                }
                min={0}
                className="w-full px-4 py-2 bg-glass rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <div className="text-xs text-text/60 mb-1">Costo creación modo Empresa (🔥)</div>
              <input
                type="number"
                value={raffleSettings.companyModeCostFires}
                onChange={(e) =>
                  setRaffleSettings((prev) => ({
                    ...prev,
                    companyModeCostFires: Number(e.target.value)
                  }))
                }
                min={0}
                className="w-full px-4 py-2 bg-glass rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                setRaffleSettingsSaving(true);
                const sanitized = {
                  prizeModeCostFires: Number(raffleSettings.prizeModeCostFires) || 0,
                  companyModeCostFires: Number(raffleSettings.companyModeCostFires) || 0
                };
                const data = await raffleApi.updateRaffleSettings(sanitized);
                setRaffleSettings({
                  prizeModeCostFires: Number(data.prizeModeCostFires) || 0,
                  companyModeCostFires: Number(data.companyModeCostFires) || 0
                });
                toast.success('Configuración de rifas actualizada');
              } catch (error) {
                console.error('Error updating raffle settings:', error);
                toast.error('Error al actualizar configuración de rifas');
              } finally {
                setRaffleSettingsSaving(false);
              }
            }}
            disabled={raffleSettingsLoading || raffleSettingsSaving}
            className="w-full py-3 px-4 bg-glass hover:bg-glass-hover rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {raffleSettingsSaving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </motion.div>
      )}


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
        onFirstPasswordSet={() => {
          // Solo forzar flujo si es usuario con Telegram vinculado y sin respuesta de seguridad
          if (user?.tg_id && !user?.security_answer) {
            setShowPasswordModal(false);
            setForceSecuritySetup(true);
            setShowMyData(true);
          } else {
            setShowPasswordModal(false);
          }
        }}
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
        onClose={() => {
          setShowMyData(false);
          setForceSecuritySetup(false);
        }}
        forceSecuritySetup={forceSecuritySetup}
        onSecuritySetupCompleted={() => {
          setForceSecuritySetup(false);
          setShowMyData(false);
        }}
      />
      {showReferralsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md card-glass p-6 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users size={18} className="text-accent" />
              Mis referidos
            </h3>
            {myReferrals.length === 0 ? (
              <p className="text-sm text-text/60">Aún no tienes usuarios referidos.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {myReferrals.map((r) => (
                  <div key={r.id} className="glass-panel p-2 flex flex-col">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-text">
                          {r.display_name || r.username}
                        </div>
                        <div className="text-[11px] text-text/60">@{r.username}</div>
                      </div>
                      <div className="text-[11px] text-text/60">
                        {r.created_at
                          ? new Date(r.created_at).toLocaleDateString('es-ES')
                          : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowReferralsModal(false)}
                className="px-4 py-2 rounded-lg bg-glass hover:bg-glass-hover text-sm"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Profile;
