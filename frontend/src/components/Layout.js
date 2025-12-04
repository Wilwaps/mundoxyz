import React, { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import MessageInbox from './MessageInbox';
import UnifiedChat from './chat/UnifiedChat';
import { User, DoorOpen, Gamepad2, Trophy, Store, Settings } from 'lucide-react';
import ExperienceModal from './ExperienceModal';
import BuyExperienceModal from './BuyExperienceModal';
import WalletHistoryModal from './WalletHistoryModal';
import QrPaymentLinkModal from './QrPaymentLinkModal';

const Layout = () => {
  const { user, isAdmin, updateUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showExperienceModal, setShowExperienceModal] = useState(false);
  const [showBuyExperienceModal, setShowBuyExperienceModal] = useState(false);
  const [showWalletHistoryModal, setShowWalletHistoryModal] = useState(false);
  const [walletHistoryInitialTab, setWalletHistoryInitialTab] = useState('fires');
  const [showBcvCalculator, setShowBcvCalculator] = useState(false);
  const [bcvCalculatorInput, setBcvCalculatorInput] = useState('');
  const [showQrPaymentModal, setShowQrPaymentModal] = useState(false);

  // Fetch balance en tiempo real
  const { data: balanceData } = useQuery({
    queryKey: ['header-balance', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const response = await axios.get('/api/economy/balance');
      // Actualizar user en contexto con nuevo balance
      if (response.data) {
        updateUser({
          ...user,
          coins_balance: response.data.coins_balance,
          fires_balance: response.data.fires_balance
        });
      }
      return response.data;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch cada 30 segundos (antes: 3000ms causaba parpadeo agresivo)
    staleTime: 10000 // Cache por 10s para reducir requests innecesarios
  });

  const displayCoins = parseFloat(balanceData?.coins_balance ?? user?.coins_balance ?? 0);
  const displayFires = parseFloat(balanceData?.fires_balance ?? user?.fires_balance ?? 0);
  const displayExperience = user?.experience || 0;

  // Stats públicas para mostrar usuarios online
  const { data: publicStats } = useQuery({
    queryKey: ['public-stats-header'],
    queryFn: async () => {
      const response = await axios.get('/api/public/stats');
      return response.data?.data;
    },
    refetchInterval: 30000,
    staleTime: 10000
  });

  const onlineUsers = publicStats?.users?.onlineNow ?? 0;

  // Tasa BCV / tasa operativa para mostrar precio de referencia en Bs
  const { data: fiatContext } = useQuery({
    queryKey: ['fiat-context-header'],
    queryFn: async () => {
      const response = await axios.get('/api/economy/fiat-context');
      return response.data;
    }
  });

  let vesPerUsdt = null;
  if (fiatContext?.bcvRate && fiatContext.bcvRate.rate != null) {
    const bcvParsed = parseFloat(String(fiatContext.bcvRate.rate));
    if (Number.isFinite(bcvParsed) && bcvParsed > 0) {
      vesPerUsdt = bcvParsed;
    }
  }
  if (!vesPerUsdt && fiatContext?.operationalRate?.rate != null) {
    const opParsed = parseFloat(String(fiatContext.operationalRate.rate));
    if (Number.isFinite(opParsed) && opParsed > 0) {
      vesPerUsdt = opParsed;
    }
  }

  // Verificar si el usuario es tote (admin mayor)
  const isTote = user?.roles?.includes('tote');

  const navItems = [
    { path: '/profile', icon: User, label: 'Perfil' },
    { path: '/lobby', icon: DoorOpen, label: 'Lobby' },
    { path: '/games', icon: Gamepad2, label: 'Juegos' },
    { path: '/raffles', icon: Trophy, label: 'Rifas' },
    { path: '/market', icon: Store, label: 'Mercado' }
  ];

  // Añadir panel Admin para admins o para usuarios tote
  if (isAdmin() || isTote) {
    navItems.push({ path: '/admin', icon: Settings, label: 'Admin' });
  }

  const hideChat =
    location.pathname.startsWith('/store/') &&
    location.pathname.includes('/pos');

  const handleGreenBadgeClick = () => {
    if (!user) {
      navigate('/profile');
      return;
    }

    let action = '';
    if (typeof window !== 'undefined') {
      try {
        const key = `green_button_action_${user.id}`;
        const stored = window.localStorage.getItem(key);
        if (stored && typeof stored === 'string') {
          action = stored;
        }
      } catch {
        // ignore
      }
    }

    const homeSlug = user?.home_store_slug;

    if (action === 'pay') {
      setShowQrPaymentModal(true);
      return;
    }

    if (action === 'pos') {
      if (homeSlug) {
        navigate(`/store/${homeSlug}/pos`);
      } else {
        navigate('/profile?greenTarget=pos');
      }
      return;
    }

    if (action === 'store_dashboard') {
      if (homeSlug) {
        navigate(`/store/${homeSlug}/dashboard`);
      } else {
        navigate('/profile?greenTarget=store_dashboard');
      }
      return;
    }

    navigate('/profile');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-dark">
      {/* Header */}
      <header className="bg-card border-b border-glass px-3 py-1.5 safe-top">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/logo.ico"
              alt="XYZ Logo"
              className="w-8 h-8 md:w-9 md:h-9 object-contain flex-shrink-0"
            />
            <h1 className="text-base md:text-lg font-bold text-gradient-accent leading-none">
              XYZ
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Balance Display - Clickeable */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div 
                className="badge-coins cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setShowBuyExperienceModal(true)}
                title="Comprar experiencia"
              >
                <span className="text-sm">💰</span>
                <span className="text-xs font-semibold">{displayCoins.toFixed(2)}</span>
              </div>
              <div 
                className="badge-fire cursor-pointer hover:scale-105 transition-transform"
                onClick={() => {
                  setWalletHistoryInitialTab('fires');
                  setShowWalletHistoryModal(true);
                }}
                title="Ver historial de fuegos"
              >
                <span className="text-sm">🔥</span>
                <span className="text-xs font-semibold">{displayFires.toFixed(2)}</span>
              </div>
              <button
                type="button"
                className="badge-coins cursor-pointer hover:scale-105 transition-transform"
                title="Calculadora rápida en Bs (BCV)"
                onClick={() => {
                  if (!vesPerUsdt) return;
                  setShowBcvCalculator(true);
                }}
              >
                <span className="text-xs font-semibold">
                  {vesPerUsdt
                    ? vesPerUsdt.toLocaleString('es-VE', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }) + ' Bs'
                    : '--- Bs'}
                </span>
              </button>
              <button
                type="button"
                className="badge-experience cursor-pointer hover:scale-105 transition-transform"
                title="Usuarios conectados ahora mismo"
                onClick={handleGreenBadgeClick}
              >
                <span className="text-xs font-medium">🟢</span>
                <span className="text-xs font-semibold">{onlineUsers}</span>
              </button>
              
              {/* Telegram Group Shortcut */}
              <button
                type="button"
                className="badge-coins cursor-pointer hover:scale-105 transition-transform"
                onClick={() => window.open('https://t.me/+DXLjmoWzEJc0NDZh', '_blank')}
                title="Abrir grupo oficial de Telegram"
              >
                <span className="text-sm">📢</span>
              </button>
              {/* Language Indicator */}
              <div
                className="badge-experience cursor-default"
                title="Idioma: Español (Venezuela)"
              >
                <span className="text-sm">🇻🇪</span>
              </div>
              
              {/* Message Inbox Button */}
              <MessageInbox />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* BCV Quick Calculator */}
      {showBcvCalculator && vesPerUsdt && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setShowBcvCalculator(false)}
        >
          <div
            className="card-glass p-4 rounded-xl max-w-xs w-full space-y-3 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Calculadora rápida Bs</h2>
              <button
                type="button"
                className="text-[11px] text-text/60 hover:text-text"
                onClick={() => setShowBcvCalculator(false)}
              >
                Cerrar
              </button>
            </div>

            <p className="text-[11px] text-text/60">
              Ingresa un monto y se multiplicará por la tasa BCV actual.
            </p>

            <div className="space-y-1">
              <div className="text-text/60">Monto base (ej. USDT)</div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={bcvCalculatorInput}
                onChange={(e) => setBcvCalculatorInput(e.target.value)}
                className="input-glass w-full"
                placeholder="Ej: 10"
              />
            </div>

            {(() => {
              const parsed = parseFloat(bcvCalculatorInput || '0');
              const isValid = Number.isFinite(parsed) && parsed >= 0;
              const result = isValid ? parsed * vesPerUsdt : 0;
              return (
                <div className="mt-2 p-2 rounded-lg bg-glass flex flex-col gap-1">
                  <div className="text-[11px] text-text/60">
                    Resultado
                  </div>
                  <div className="text-sm font-semibold text-text/90">
                    {isValid
                      ? result.toLocaleString('es-VE', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }) + ' Bs'
                      : '0,00 Bs'}
                  </div>
                  <div className="text-[10px] text-text/50">
                    Tasa BCV: {vesPerUsdt.toLocaleString('es-VE', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} Bs
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-glass px-2 py-1 safe-bottom">
        <div className="flex justify-around text-xs text-center text-text/80">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname.startsWith(path);
            return (
              <NavLink
                key={path}
                to={path}
                className={`nav-item ${
                  isActive ? 'bg-orange-500/20 shadow-fire text-orange-400' : ''
                }`}
              >
                <Icon size={24} className="mx-auto mb-1" />
                <span className="block">{label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Experience Modal */}
      <ExperienceModal 
        isOpen={showExperienceModal}
        onClose={() => setShowExperienceModal(false)}
        user={user}
      />

      {/* Buy Experience Modal */}
      <BuyExperienceModal 
        isOpen={showBuyExperienceModal}
        onClose={() => setShowBuyExperienceModal(false)}
        user={user}
      />

      {/* Wallet History Modal */}
      <WalletHistoryModal 
        isOpen={showWalletHistoryModal}
        onClose={() => setShowWalletHistoryModal(false)}
        onOpenSend={() => {
          setShowWalletHistoryModal(false);
          if (location.pathname !== '/profile') {
            navigate('/profile?tab=fires&open=send');
          } else {
            // Si ya estamos en perfil, forzar recarga del query para que el efecto se dispare
            navigate('/profile?tab=fires&open=send', { replace: true });
          }
        }}
        onOpenBuy={() => {
          setShowWalletHistoryModal(false);
          if (location.pathname !== '/profile') {
            navigate('/profile?tab=fires&open=buy');
          } else {
            navigate('/profile?tab=fires&open=buy', { replace: true });
          }
        }}
        onOpenReceive={() => {
          setShowWalletHistoryModal(false);
          if (location.pathname !== '/profile') {
            navigate('/profile?tab=fires&open=receive');
          } else {
            navigate('/profile?tab=fires&open=receive', { replace: true });
          }
        }}
        initialTab={walletHistoryInitialTab}
      />

      {/* QR Payment Link Modal (Botón verde Pagar) */}
      <QrPaymentLinkModal
        isOpen={showQrPaymentModal}
        onClose={() => setShowQrPaymentModal(false)}
      />

      {/* Unified Chat System */}
      {!hideChat && <UnifiedChat />}
    </div>
  );
};

export default Layout;
