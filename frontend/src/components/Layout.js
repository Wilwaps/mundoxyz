import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  User,
  DoorOpen,
  Gamepad2,
  Ticket,
  Store,
  Shield,
  Clock,
  Settings
} from 'lucide-react';

const Layout = () => {
  const { user, isAdmin } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/profile', icon: User, label: 'Perfil' },
    { path: '/lobby', icon: DoorOpen, label: 'Lobby' },
    { path: '/games', icon: Gamepad2, label: 'Juegos' },
    { path: '/raffles', icon: Ticket, label: 'Rifas' },
    { path: '/market', icon: Store, label: 'Mercado' },
    { path: '/roles', icon: Shield, label: 'Rol' },
    { path: '/upcoming', icon: Clock, label: 'Próximo' }
  ];

  if (isAdmin()) {
    navItems.push({ path: '/admin', icon: Settings, label: 'Admin' });
  }

  return (
    <div className="flex flex-col min-h-screen bg-background-dark">
      {/* Header */}
      <header className="bg-card border-b border-glass px-4 py-3 safe-top">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gradient-accent">MUNDOXYZ</h1>
          <div className="flex items-center gap-4">
            {/* Balance Display */}
            <div className="flex items-center gap-3">
              <div className="badge-coins">
                <span className="text-sm">🪙 {user?.coins_balance || 0}</span>
              </div>
              <div className="badge-fire">
                <span className="text-sm">🔥 {user?.fires_balance || 0}</span>
              </div>
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
    </div>
  );
};

export default Layout;
