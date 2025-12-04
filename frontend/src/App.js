import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import Games from './pages/Games';
import Profile from './pages/Profile';
import Lobby from './pages/Lobby';
import Market from './pages/Market';
import Roles from './pages/Roles';
import Upcoming from './pages/Upcoming';
import BingoLobby from './pages/BingoLobby';
import BingoV2WaitingRoom from './pages/BingoV2WaitingRoom';
import BingoV2GameRoom from './pages/BingoV2GameRoom';
import Admin from './pages/Admin';
import TicTacToeLobby from './pages/TicTacToeLobby';
import TicTacToeRoom from './pages/TicTacToeRoom';
import RafflesLobby from './features/raffles/pages/RafflesLobby';
import RaffleRoom from './features/raffles/pages/RaffleRoom';
import MyRaffles from './features/raffles/pages/MyRaffles';
import RafflePublicLanding from './features/raffles/pages/RafflePublicLanding';
import Landing from './pages/Landing';
import GiftLinkClaimPage from './pages/GiftLinkClaimPage';
import TitoDashboard from './pages/TitoDashboard';
import TitoLanding from './pages/TitoLanding';
import Changelog from './pages/Changelog';
import PoolLobby from './pages/PoolLobby';
import PoolRoom from './pages/PoolRoom';
import CaidaLobby from './pages/CaidaLobby';
import CaidaRoom from './pages/CaidaRoom';
import StoreFront from './pages/store/StoreFront';
import StoreFrontInvoicePage from './pages/store/StoreFrontInvoicePage';
import POS from './pages/store/POS';
import KitchenDisplay from './pages/store/KitchenDisplay';
import StoreOwnerDashboard from './pages/store/StoreOwnerDashboard';
import StoreQrPaymentPage from './pages/store/StoreQrPaymentPage';
import ProtectedStoreRouteBySlug from './components/ProtectedStoreRouteBySlug';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  // Permitir acceso público al StoreFront (/store/:slug) y a la página de factura (/store/:slug/invoice/:invoiceNumber)
  const path = location.pathname;
  const publicStorefrontRoutes = [
    /^\/store\/[^/]+$/,
    /^\/store\/[^/]+\/invoice\/[^/]+$/
  ];
  const isPublicStoreFront = publicStorefrontRoutes.some((re) => re.test(path));

  if (!user && !isPublicStoreFront) {
    const nextPath = `${location.pathname}${location.search}`;
    const target = `/login?next=${encodeURIComponent(nextPath)}`;
    return <Navigate to={target} replace />;
  }

  return children;
}

function HomeRedirect() {
  const { user } = useAuth();
  const target = user?.home_store_slug ? `/store/${user.home_store_slug}` : '/lobby';
  return <Navigate to={target} replace />;
}

function App() {
  useEffect(() => {
    // Set viewport height for mobile
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);

    // Initialize appearance theme from localStorage
    try {
      const stored = typeof window !== 'undefined'
        ? window.localStorage.getItem('app_theme')
        : null;
      const theme = stored || 'blue-cristal';
      document.documentElement.dataset.theme = theme;
    } catch {
      document.documentElement.dataset.theme = 'blue-cristal';
    }

    return () => window.removeEventListener('resize', setViewportHeight);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <Router>
            <div className="App min-h-screen bg-background-dark text-text font-display">
              <Toaster
                position="top-center"
                toastOptions={{
                  duration: 2000,
                  style: {
                    background: '#121A2B',
                    color: '#E6EDF3',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '0.75rem',
                    backdropFilter: 'blur(10px)',
                  },
                  success: {
                    iconTheme: {
                      primary: '#10B981',
                      secondary: '#E6EDF3',
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: '#EF4444',
                      secondary: '#E6EDF3',
                    },
                  },
                }}
              />

              <Routes>
                {/* Landing Page Principal (sin login) */}
                <Route path="/landing" element={<Landing />} />

                {/* Landing informativa para Tito (sin login) */}
                <Route path="/tito/info" element={<TitoLanding />} />

                {/* Landing Pública de Rifas (sin login) */}
                <Route path="/raffles/public/:code" element={<RafflePublicLanding />} />

                {/* Changelog público */}
                <Route path="/changelog" element={<Changelog />} />

                <Route path="/gift-link/:token" element={<GiftLinkClaimPage />} />

                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/reset-password" element={<ResetPassword />} />


                <Route path="/" element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route index element={<HomeRedirect />} />
                  <Route path="games" element={<Games />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="tito" element={<TitoDashboard />} />
                  <Route path="lobby" element={<Lobby />} />
                  <Route path="market" element={<Market />} />
                  <Route path="roles" element={<Roles />} />
                  <Route path="upcoming" element={<Upcoming />} />
                  <Route path="bingo" element={<BingoLobby />} />
                  <Route path="bingo/v2/room/:code" element={<BingoV2WaitingRoom />} />
                  <Route path="bingo/v2/play/:code" element={<BingoV2GameRoom />} />
                  <Route path="tictactoe/lobby" element={<TicTacToeLobby />} />
                  <Route path="tictactoe/room/:code" element={<TicTacToeRoom />} />
                  <Route path="pool/lobby" element={<PoolLobby />} />
                  <Route path="pool/room/:code" element={<PoolRoom />} />
                  <Route path="caida/lobby" element={<CaidaLobby />} />
                  <Route path="caida/room/:code" element={<CaidaRoom />} />
                  <Route path="store/:slug" element={<StoreFront />} />
                  <Route path="store/:slug/invoice/:invoiceNumber" element={
                    <ProtectedStoreRouteBySlug requiredPermission="invoices">
                      <StoreFrontInvoicePage />
                    </ProtectedStoreRouteBySlug>
                  } />
                  <Route path="store/:slug/qr/:qrSessionId" element={
                    <ProtectedStoreRouteBySlug requiredPermission="pos">
                      <StoreQrPaymentPage />
                    </ProtectedStoreRouteBySlug>
                  } />
                  <Route path="store/:slug/dashboard" element={
                    <ProtectedStoreRouteBySlug requiredPermission="dashboard">
                      <StoreOwnerDashboard />
                    </ProtectedStoreRouteBySlug>
                  } />
                  <Route path="store/:slug/pos" element={
                    <ProtectedStoreRouteBySlug requiredPermission="pos">
                      <POS />
                    </ProtectedStoreRouteBySlug>
                  } />
                  <Route path="store/:slug/kitchen" element={
                    <ProtectedStoreRouteBySlug requiredPermission="kitchen">
                      <KitchenDisplay />
                    </ProtectedStoreRouteBySlug>
                  } />
                  <Route path="raffles" element={<RafflesLobby />} />
                  <Route path="raffles/my" element={<MyRaffles />} />
                  <Route path="raffles/:code" element={<RaffleRoom />} />
                  <Route path="admin/*" element={<Admin />} />
                </Route>
              </Routes>
            </div>
          </Router>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
