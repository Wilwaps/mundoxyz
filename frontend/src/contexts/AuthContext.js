import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Configure axios defaults
axios.defaults.baseURL = process.env.REACT_APP_API_URL || '/api';
axios.defaults.withCredentials = true;

// Add request interceptor
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (token && storedUser) {
        try {
          // Validate token with backend
          const response = await axios.get('/roles/me');
          const userData = JSON.parse(storedUser);
          setUser({
            ...userData,
            roles: response.data.roles.map(r => r.name)
          });
        } catch (error) {
          console.error('Session validation failed:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      
      setLoading(false);
    };

    checkAuth();
  }, []);

  const loginWithTelegram = async () => {
    try {
      setLoading(true);
      
      // Get Telegram WebApp data
      const tg = window.Telegram?.WebApp;
      if (!tg?.initData) {
        throw new Error('Telegram WebApp no disponible');
      }

      const response = await axios.post('/auth/login-telegram', {
        initData: tg.initData
      });

      const { token, user: userData } = response.data;
      
      // Store token and user
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setUser(userData);
      toast.success('¡Bienvenido a MUNDOXYZ!');
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.error || 'Error al iniciar sesión');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const loginWithCredentials = async (username, password) => {
    try {
      setLoading(true);
      
      const response = await axios.post('/auth/login-email', {
        email: username,
        password
      });

      const { token, user: userData } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setUser(userData);
      toast.success('¡Bienvenido a MUNDOXYZ!');
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.error || 'Error al iniciar sesión');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const register = async (formData) => {
    try {
      setLoading(true);
      
      const response = await axios.post('/auth/register', {
        username: formData.username,
        email: formData.email,
        emailConfirm: formData.emailConfirm,
        password: formData.password,
        passwordConfirm: formData.passwordConfirm,
        tg_id: formData.tg_id || null
      });

      toast.success(response.data.message || '¡Registro exitoso!');
      
      return { success: true, user: response.data.user };
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error.response?.data?.error || 'Error al registrar usuario');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await axios.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      window.location.href = '/login';
    }
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const refreshUser = async () => {
    try {
      const response = await axios.get(`/profile/${user.id}`);
      const profileData = response.data;
      
      // Construir usuario actualizado con TODOS los campos nuevos
      const updatedUser = {
        id: profileData.id,
        username: profileData.username,
        display_name: profileData.display_name,
        nickname: profileData.nickname,
        bio: profileData.bio,
        email: profileData.email,
        tg_id: profileData.tg_id,
        avatar_url: profileData.avatar_url,
        locale: profileData.locale,
        is_verified: profileData.is_verified,
        created_at: profileData.created_at,
        last_seen_at: profileData.last_seen_at,
        roles: profileData.roles || user.roles || [],
        wallet_id: profileData.wallet_id,
        // Balances del stats
        coins_balance: profileData.stats?.coins_balance || 0,
        fires_balance: profileData.stats?.fires_balance || 0,
        total_coins_earned: profileData.stats?.total_coins_earned || 0,
        total_fires_earned: profileData.stats?.total_fires_earned || 0,
        total_coins_spent: profileData.total_coins_spent || 0,
        total_fires_spent: profileData.total_fires_spent || 0
      };
      
      updateUser(updatedUser);
      return updatedUser;
    } catch (error) {
      console.error('Error refreshing user:', error);
      return null;
    }
  };

  const hasRole = (role) => {
    return user?.roles?.includes(role) || false;
  };

  const isAdmin = () => {
    return hasRole('admin') || hasRole('tote');
  };

  const isTote = () => {
    return hasRole('tote');
  };

  const value = {
    user,
    loading,
    loginWithTelegram,
    loginWithCredentials,
    register,
    logout,
    updateUser,
    refreshUser,
    hasRole,
    isAdmin,
    isTote
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
