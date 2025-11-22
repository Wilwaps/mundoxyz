import React, { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import MessageInbox from './MessageInbox';
import UnifiedChat from './chat/UnifiedChat';
import {
  User,
  DoorOpen,
  Gamepad2,
  Store,
  Shield,
  Clock,
  Settings,
  Trophy,
  Sparkles
} from 'lucide-react';
import ExperienceModal from './ExperienceModal';
import BuyExperienceModal from './BuyExperienceModal';
import WalletHistoryModal from './WalletHistoryModal';

const Layout = () => {
  const { user, isAdmin, updateUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showBalanceTooltip, setShowBalanceTooltip] = useState(false);
  const [showExperienceModal, setShowExperienceModal] = useState(false);
  const [showBuyExperienceModal, setShowBuyExperienceModal] = useState(false);
  const [showWalletHistoryModal, setShowWalletHistoryModal] = useState(false);
  const [walletHistoryInitialTab, setWalletHistoryInitialTab] = useState('fires');

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

  // Verificar si el usuario es tote (admin mayor)
  const isTote = user?.roles?.includes('tote');

  const navItems = [
    { path: '/profile', icon: User, label: 'Perfil' },
    { path: '/lobby', icon: DoorOpen, label: 'Lobby' },
    { path: '/games', icon: Gamepad2, label: 'Juegos' },
    { path: '/raffles', icon: Trophy, label: 'Rifas' },
    { path: '/market', icon: Store, label: 'Mercado' },
    { path: '/roles', icon: Shield, label: 'Rol' },
    { path: '/upcoming', icon: Clock, label: 'Próximo' }
  ];

  // Añadir panel Tito para usuarios con rol 'tito'
  if (user?.roles?.includes('tito')) {
    navItems.splice(5, 0, { path: '/tito', icon: Sparkles, label: 'Tito' });
  }

  // Añadir panel Admin para admins o para usuarios tote
  if (isAdmin() || isTote) {
    navItems.push({ path: '/admin', icon: Settings, label: 'Admin' });
  }

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
                className="badge-experience cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setShowExperienceModal(true)}
                title="Ver detalles de experiencia"
              >
                <span className="text-xs font-medium">⭐</span>
                <span className="text-xs font-semibold">{displayExperience} XP</span>
              </div>
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
                title="Idioma: Español (España)"
              >
                <span className="text-sm">🇪🇸</span>
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

      {/* Unified Chat System */}
      <UnifiedChat />
    </div>
  );
};

export default Layout;
