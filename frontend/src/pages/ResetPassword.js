import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { KeyRound, Mail, MessageCircle, ArrowLeft, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [method, setMethod] = useState('telegram'); // 'telegram' | 'email'
  const [identifier, setIdentifier] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  const resetMutation = useMutation({
    mutationFn: async (data) => {
      const response = await axios.post('/api/auth/reset-password-request', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`✅ ${data.message}`);
      toast.success(`Usuario: ${data.username}`);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    },
    onError: (error) => {
      const message = error.response?.data?.error || 'Error al resetear clave';
      toast.error(message);
      setSecurityAnswer(''); // Limpiar campo de respuesta
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!identifier.trim()) {
      toast.error(`Por favor ingresa tu ${method === 'telegram' ? 'ID de Telegram' : 'Email'}`);
      return;
    }
    
    if (!securityAnswer.trim()) {
      toast.error('Por favor ingresa tu respuesta de seguridad');
      return;
    }
    
    resetMutation.mutate({
      method,
      identifier: method === 'telegram' ? identifier.trim() : identifier.trim().toLowerCase(),
      security_answer: securityAnswer
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="card-glass p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-violet/20 mb-4">
              <KeyRound size={32} className="text-violet" />
            </div>
            <h1 className="text-3xl font-bold text-gradient-accent mb-2">
              Reinicio de Clave
            </h1>
            <p className="text-text/60 text-sm">
              Recupera el acceso a tu cuenta con tu respuesta de seguridad
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Método de recuperación */}
            <div>
              <label className="block text-sm font-medium mb-3">
                Método de recuperación
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMethod('telegram');
                    setIdentifier('');
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    method === 'telegram'
                      ? 'border-violet bg-violet/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <MessageCircle 
                    size={24} 
                    className={`mx-auto mb-2 ${
                      method === 'telegram' ? 'text-violet' : 'text-text/60'
                    }`} 
                  />
                  <div className={`text-sm font-medium ${
                    method === 'telegram' ? 'text-violet' : 'text-text/80'
                  }`}>
                    ID Telegram
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMethod('email');
                    setIdentifier('');
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    method === 'email'
                      ? 'border-accent bg-accent/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <Mail 
                    size={24} 
                    className={`mx-auto mb-2 ${
                      method === 'email' ? 'text-accent' : 'text-text/60'
                    }`} 
                  />
                  <div className={`text-sm font-medium ${
                    method === 'email' ? 'text-accent' : 'text-text/80'
                  }`}>
                    Email
                  </div>
                </button>
              </div>
            </div>

            {/* Identificador */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {method === 'telegram' ? 'ID de Telegram' : 'Email'}
              </label>
              <input
                type={method === 'telegram' ? 'text' : 'email'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={method === 'telegram' ? 'Ej: 123456789' : 'tu@email.com'}
                className="input w-full text-gray-900"
                required
              />
              <p className="text-xs text-text/60 mt-1">
                {method === 'telegram' 
                  ? 'El ID numérico de tu cuenta de Telegram'
                  : 'El email con el que te registraste'
                }
              </p>
            </div>

            {/* Respuesta de seguridad */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Respuesta de Seguridad
              </label>
              <input
                type="text"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                placeholder="Ingresa tu respuesta secreta"
                className="input w-full text-gray-900"
                required
              />
              <p className="text-xs text-text/60 mt-1">
                La respuesta que configuraste al registrarte
              </p>
            </div>

            {/* Info */}
            <div className="p-4 rounded-lg bg-info/10 border border-info/30">
              <div className="flex gap-3">
                <AlertCircle size={20} className="text-info flex-shrink-0 mt-0.5" />
                <div className="text-sm text-text/80">
                  <p className="font-medium text-info mb-1">Información importante</p>
                  <p>
                    Si la respuesta es correcta, tu clave se reseteará a <strong>123456</strong>.
                    Podrás cambiarla después desde tu perfil.
                  </p>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="btn-secondary flex items-center justify-center gap-2 flex-1"
              >
                <ArrowLeft size={18} />
                Volver
              </button>
              <button
                type="submit"
                disabled={resetMutation.isPending}
                className="btn-primary flex-1"
              >
                {resetMutation.isPending ? 'Procesando...' : 'Reiniciar Clave'}
              </button>
            </div>
          </form>
        </div>

        {/* Link a soporte */}
        <div className="text-center mt-6">
          <p className="text-sm text-text/60">
            ¿No configuraste una respuesta de seguridad?{' '}
            <a href="/support" className="text-violet hover:underline">
              Contacta a soporte
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
