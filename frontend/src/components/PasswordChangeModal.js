import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Eye, EyeOff, Check } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const PasswordChangeModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    new_password_confirm: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.current_password) {
      newErrors.current_password = 'Contraseña actual requerida';
    }

    if (!formData.new_password) {
      newErrors.new_password = 'Nueva contraseña requerida';
    } else if (formData.new_password.length < 6) {
      newErrors.new_password = 'Mínimo 6 caracteres';
    }

    if (!formData.new_password_confirm) {
      newErrors.new_password_confirm = 'Confirma la contraseña';
    } else if (formData.new_password !== formData.new_password_confirm) {
      newErrors.new_password_confirm = 'Las contraseñas no coinciden';
    }

    if (formData.current_password === formData.new_password) {
      newErrors.new_password = 'Debe ser diferente a la actual';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    try {
      await axios.put('/auth/change-password', formData);
      toast.success('Contraseña actualizada correctamente');
      setFormData({ current_password: '', new_password: '', new_password_confirm: '' });
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al cambiar contraseña');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md card-glass p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet/20 flex items-center justify-center">
                  <Lock size={20} className="text-violet" />
                </div>
                <h2 className="text-xl font-bold">Cambiar Contraseña</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-glass-hover rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-text/80 mb-2">
                  Contraseña Actual
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    name="current_password"
                    value={formData.current_password}
                    onChange={handleChange}
                    className={`input-glass w-full pr-10 ${errors.current_password ? 'border-red-500' : ''}`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text/60 hover:text-text"
                  >
                    {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.current_password && (
                  <p className="text-xs text-red-400 mt-1">{errors.current_password}</p>
                )}
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-text/80 mb-2">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    name="new_password"
                    value={formData.new_password}
                    onChange={handleChange}
                    className={`input-glass w-full pr-10 ${errors.new_password ? 'border-red-500' : ''}`}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text/60 hover:text-text"
                  >
                    {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.new_password && (
                  <p className="text-xs text-red-400 mt-1">{errors.new_password}</p>
                )}
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-sm font-medium text-text/80 mb-2">
                  Confirmar Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    name="new_password_confirm"
                    value={formData.new_password_confirm}
                    onChange={handleChange}
                    className={`input-glass w-full pr-10 ${errors.new_password_confirm ? 'border-red-500' : ''}`}
                    placeholder="Repite la nueva contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text/60 hover:text-text"
                  >
                    {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.new_password_confirm && (
                  <p className="text-xs text-red-400 mt-1">{errors.new_password_confirm}</p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-lg bg-glass hover:bg-glass-hover transition-colors"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 btn-secondary flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    'Guardando...'
                  ) : (
                    <>
                      <Check size={18} />
                      Guardar
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PasswordChangeModal;
