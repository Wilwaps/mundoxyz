import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { Sparkles, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

const Login = () => {
  const navigate = useNavigate();
  const { loginWithTelegram, loginWithCredentials, user, loading } = useAuth();
  const [isDevMode, setIsDevMode] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', password: '' });

  useEffect(() => {
    if (user) {
      navigate('/games');
    }
  }, [user, navigate]);

  useEffect(() => {
    // Check if running in Telegram WebApp
    const tg = window.Telegram?.WebApp;
    if (!tg?.initData) {
      setIsDevMode(true);
    }
  }, []);

  const handleTelegramLogin = async () => {
    const result = await loginWithTelegram();
    if (result.success) {
      navigate('/games');
    }
  };

  const handleDevLogin = async (e) => {
    e.preventDefault();
    if (!credentials.username || !credentials.password) {
      toast.error('Por favor ingresa usuario y contraseña');
      return;
    }
    const result = await loginWithCredentials(credentials.username, credentials.password);
    if (result.success) {
      navigate('/games');
    }
  };

  return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <motion.div 
            className="inline-block mb-4"
            animate={{ 
              rotate: [0, 10, -10, 10, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              repeatDelay: 2
            }}
          >
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center shadow-neon-accent">
              <Sparkles size={48} className="text-background-dark" />
            </div>
          </motion.div>
          
          <h1 className="text-4xl font-bold text-gradient-accent mb-2">MUNDOXYZ</h1>
          <p className="text-text/60">MiniApp de Telegram</p>
        </div>

        {/* Login Card */}
        <div className="card-glass p-8">
          <h2 className="text-2xl font-semibold text-center mb-6">Bienvenido</h2>
          
          {!isDevMode ? (
            <>
              {/* Telegram Login */}
              <button
                onClick={handleTelegramLogin}
                disabled={loading}
                className="w-full btn-primary flex items-center justify-center gap-3 mb-4"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.56c-.21 2.27-1.13 7.78-1.6 10.32-.2 1.08-.59 1.44-.97 1.47-.82.07-1.45-.54-2.24-.97-1.24-.78-1.95-1.27-3.16-2.03-1.4-.88-.49-1.37.3-2.16.21-.21 3.82-3.5 3.89-3.8.01-.04 0-.17-.06-.25s-.18-.05-.26-.03c-.11.03-1.79 1.14-5.07 3.35-.48.33-.91.49-1.3.48-.43-.01-1.25-.24-1.86-.44-.75-.24-1.35-.37-1.3-.79.03-.22.33-.45.89-.67 3.52-1.53 5.86-2.54 7.04-3.03 3.36-1.39 4.06-1.63 4.51-1.64.1 0 .32.02.46.14.12.1.16.23.17.33.01.1-.01.24-.02.37z"/>
                </svg>
                {loading ? 'Conectando...' : 'Iniciar con Telegram'}
              </button>

              <div className="text-center text-text/40 text-sm">
                Usa tu cuenta de Telegram para acceder
              </div>
            </>
          ) : (
            <>
              {/* Dev Mode Login */}
              <div className="mb-4">
                <div className="bg-warning/20 border border-warning/30 rounded-lg p-3 mb-4">
                  <p className="text-warning text-xs">
                    Modo desarrollo: No se detectó Telegram WebApp
                  </p>
                </div>
                
                <form onSubmit={handleDevLogin} className="space-y-4">
                  <div>
                    <input
                      type="text"
                      placeholder="Usuario o Email"
                      value={credentials.username}
                      onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                      className="input-glass w-full"
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      placeholder="Contraseña"
                      value={credentials.password}
                      onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                      className="input-glass w-full"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full btn-secondary"
                  >
                    {loading ? 'Iniciando...' : 'Iniciar Sesión (Dev)'}
                  </button>
                </form>
              </div>

              <div className="text-center">
                <button
                  onClick={handleTelegramLogin}
                  disabled={loading}
                  className="text-accent hover:underline text-sm"
                >
                  Intentar con Telegram de todas formas
                </button>
              </div>
            </>
          )}
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="glass-panel p-4"
          >
            <div className="text-violet text-2xl mb-2">🎮</div>
            <p className="text-xs text-text/60">Juegos</p>
          </motion.div>
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="glass-panel p-4"
          >
            <div className="text-accent text-2xl mb-2">🔥</div>
            <p className="text-xs text-text/60">Economía</p>
          </motion.div>
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="glass-panel p-4"
          >
            <div className="text-fire-orange text-2xl mb-2">🎯</div>
            <p className="text-xs text-text/60">Premios</p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
