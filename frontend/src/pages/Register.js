import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { Sparkles, UserPlus, Mail, Lock, User, MessageCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import MathCaptcha from '../components/MathCaptcha';

const Register = () => {
  const navigate = useNavigate();
  const { register, user, loading } = useAuth();
  const [captchaValid, setCaptchaValid] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    emailConfirm: '',
    tg_id: '',
    password: '',
    passwordConfirm: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) {
      navigate('/games');
    }
  }, [user, navigate]);

  // Validación en tiempo real
  const validateField = (name, value) => {
    const newErrors = { ...errors };

    switch (name) {
      case 'username':
        if (value.length < 3) {
          newErrors.username = 'Mínimo 3 caracteres';
        } else if (value.length > 20) {
          newErrors.username = 'Máximo 20 caracteres';
        } else if (!/^[a-zA-Z0-9_]+$/.test(value)) {
          newErrors.username = 'Solo letras, números y guiones bajos';
        } else {
          delete newErrors.username;
        }
        break;

      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          newErrors.email = 'Email inválido';
        } else {
          delete newErrors.email;
        }
        break;

      case 'emailConfirm':
        if (value !== formData.email) {
          newErrors.emailConfirm = 'Los emails no coinciden';
        } else {
          delete newErrors.emailConfirm;
        }
        break;

      case 'password':
        if (value.length < 6) {
          newErrors.password = 'Mínimo 6 caracteres';
        } else {
          delete newErrors.password;
        }
        break;

      case 'passwordConfirm':
        if (value !== formData.password) {
          newErrors.passwordConfirm = 'Las contraseñas no coinciden';
        } else {
          delete newErrors.passwordConfirm;
        }
        break;

      case 'tg_id':
        if (value && (isNaN(value) || parseInt(value) <= 0)) {
          newErrors.tg_id = 'ID inválido';
        } else {
          delete newErrors.tg_id;
        }
        break;

      default:
        break;
    }

    setErrors(newErrors);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    validateField(name, value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validar todos los campos
    Object.keys(formData).forEach(key => {
      if (key !== 'tg_id') { // tg_id es opcional
        validateField(key, formData[key]);
      }
    });

    // Verificar CAPTCHA
    if (!captchaValid) {
      toast.error('Por favor resuelve el CAPTCHA');
      return;
    }

    // Verificar que no haya errores
    if (Object.keys(errors).length > 0) {
      toast.error('Por favor corrige los errores en el formulario');
      return;
    }

    // Verificar campos requeridos
    if (!formData.username || !formData.email || !formData.emailConfirm || 
        !formData.password || !formData.passwordConfirm) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    const result = await register(formData);
    if (result.success) {
      toast.success('¡Registro exitoso! Por favor inicia sesión');
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Back Button */}
        <Link 
          to="/login"
          className="inline-flex items-center gap-2 text-accent hover:text-accent/80 mb-4 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Volver al inicio</span>
        </Link>

        {/* Logo and Title */}
        <div className="text-center mb-6">
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
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-violet to-purple-400 rounded-full flex items-center justify-center shadow-neon-violet">
              <UserPlus size={40} className="text-background-dark" />
            </div>
          </motion.div>
          
          <h1 className="text-3xl font-bold text-gradient-violet mb-2">Crear Cuenta</h1>
          <p className="text-text/60">Únete a MUNDOXYZ</p>
        </div>

        {/* Register Form */}
        <div className="card-glass p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-text/80 mb-2">
                <User size={16} className="inline mr-2" />
                Usuario *
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Elige un nombre de usuario"
                className={`input-glass w-full ${errors.username ? 'border-red-500' : ''}`}
              />
              {errors.username && (
                <p className="text-xs text-red-400 mt-1">{errors.username}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-text/80 mb-2">
                <Mail size={16} className="inline mr-2" />
                Correo Electrónico *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="tu@email.com"
                className={`input-glass w-full ${errors.email ? 'border-red-500' : ''}`}
              />
              {errors.email && (
                <p className="text-xs text-red-400 mt-1">{errors.email}</p>
              )}
            </div>

            {/* Email Confirm */}
            <div>
              <label className="block text-sm font-medium text-text/80 mb-2">
                <Mail size={16} className="inline mr-2" />
                Confirmar Correo *
              </label>
              <input
                type="email"
                name="emailConfirm"
                value={formData.emailConfirm}
                onChange={handleChange}
                placeholder="Confirma tu email"
                className={`input-glass w-full ${errors.emailConfirm ? 'border-red-500' : ''}`}
              />
              {errors.emailConfirm && (
                <p className="text-xs text-red-400 mt-1">{errors.emailConfirm}</p>
              )}
            </div>

            {/* Telegram ID (opcional) */}
            <div>
              <label className="block text-sm font-medium text-text/80 mb-2">
                <MessageCircle size={16} className="inline mr-2" />
                ID de Telegram <span className="text-text/40">(opcional)</span>
              </label>
              <input
                type="text"
                name="tg_id"
                value={formData.tg_id}
                onChange={handleChange}
                placeholder="123456789"
                className={`input-glass w-full ${errors.tg_id ? 'border-red-500' : ''}`}
              />
              {errors.tg_id && (
                <p className="text-xs text-red-400 mt-1">{errors.tg_id}</p>
              )}
              <p className="text-xs text-text/40 mt-1">
                Si tienes Telegram, puedes vincularlo ahora
              </p>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-text/80 mb-2">
                <Lock size={16} className="inline mr-2" />
                Contraseña *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 6 caracteres"
                  className={`input-glass w-full pr-10 ${errors.password ? 'border-red-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text/60 hover:text-text transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-400 mt-1">{errors.password}</p>
              )}
            </div>

            {/* Password Confirm */}
            <div>
              <label className="block text-sm font-medium text-text/80 mb-2">
                <Lock size={16} className="inline mr-2" />
                Confirmar Contraseña *
              </label>
              <div className="relative">
                <input
                  type={showPasswordConfirm ? 'text' : 'password'}
                  name="passwordConfirm"
                  value={formData.passwordConfirm}
                  onChange={handleChange}
                  placeholder="Confirma tu contraseña"
                  className={`input-glass w-full pr-10 ${errors.passwordConfirm ? 'border-red-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text/60 hover:text-text transition-colors"
                >
                  {showPasswordConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.passwordConfirm && (
                <p className="text-xs text-red-400 mt-1">{errors.passwordConfirm}</p>
              )}
            </div>

            {/* CAPTCHA */}
            <MathCaptcha onValidate={setCaptchaValid} />

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !captchaValid || Object.keys(errors).length > 0}
              className="w-full btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Registrando...' : 'Crear Cuenta'}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-text/60">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-accent hover:underline font-medium">
                Inicia Sesión
              </Link>
            </p>
          </div>
        </div>

        {/* Info Cards */}
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="glass-panel p-3"
          >
            <div className="text-green-400 text-xl mb-1">🔒</div>
            <p className="text-xs text-text/60">Seguro</p>
          </motion.div>
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="glass-panel p-3"
          >
            <div className="text-accent text-xl mb-1">⚡</div>
            <p className="text-xs text-text/60">Rápido</p>
          </motion.div>
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="glass-panel p-3"
          >
            <div className="text-violet text-xl mb-1">🎮</div>
            <p className="text-xs text-text/60">Divertido</p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
