import React, { useEffect, useState } from 'react';
import { useParams, useLocation, Navigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const GiftLinkClaimPage = () => {
  const { token } = useParams();
  const location = useLocation();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!token || status !== 'idle') return;

    const claim = async () => {
      try {
        setStatus('loading');
        const response = await axios.post('/api/gifts/links/claim', { token });
        setResult(response.data);
        setStatus('success');
        toast.success('Regalo acreditado');
      } catch (e) {
        const message = e?.response?.data?.error || 'No se pudo reclamar el regalo';
        setError(message);
        setStatus('error');
        toast.error(message);
      }
    };

    claim();
  }, [token, user, loading, status]);

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen text-text">
        Link de regalo inválido.
      </div>
    );
  }

  if (!loading && !user) {
    const nextPath = `${location.pathname}${location.search}`;
    const target = `/login?next=${encodeURIComponent(nextPath)}`;
    return <Navigate to={target} replace />;
  }

  if (loading || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen text-text">
        Procesando regalo...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen text-text">
        {error || 'No se pudo reclamar este regalo.'}
      </div>
    );
  }

  if (status === 'success' && result) {
    const fires = Number(result.fires_received || 0);
    const coins = Number(result.coins_received || 0);
    const message = result.gift?.message;

    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-glass max-w-md w-full text-center p-6"
        >
          <div className="text-3xl mb-2">🎁</div>
          <h1 className="text-xl font-bold mb-2 text-text">Regalo recibido</h1>
          <p className="text-sm text-text/70 mb-4">
            {fires > 0 && `Has recibido ${fires} fuegos.`}
            {coins > 0 && fires > 0 && ' '}
            {coins > 0 && fires === 0 && `Has recibido ${coins} monedas.`}
          </p>
          {message && (
            <div className="text-xs text-text/80 bg-glass p-3 rounded-lg mb-4 whitespace-pre-line">
              {message}
            </div>
          )}
          <p className="text-xs text-text/60 mb-4">
            Tu regalo ya fue acreditado a tu cuenta. Revisa tu buzón de mensajes para más detalles.
          </p>
          <button
            type="button"
            onClick={() => {
              window.location.href = '/lobby';
            }}
            className="w-full py-2 px-4 rounded-lg bg-accent text-dark text-sm font-semibold"
          >
            Ir al lobby
          </button>
        </motion.div>
      </div>
    );
  }

  return null;
};

export default GiftLinkClaimPage;
