import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, ArrowLeft, AlertCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const SendFiresModal = ({ isOpen, onClose, currentBalance, onSuccess }) => {
  const [step, setStep] = useState('form'); // 'form' or 'confirm'
  const [formData, setFormData] = useState({
    to_wallet_id: '',
    amount: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const commission = formData.amount ? (parseFloat(formData.amount) * 0.05).toFixed(2) : '0.00';
  const total = formData.amount ? (parseFloat(formData.amount) + parseFloat(commission)).toFixed(2) : '0.00';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setFormData(prev => ({ ...prev, to_wallet_id: text.trim() }));
      toast.success('Dirección pegada');
    } catch (error) {
      toast.error('Error al pegar');
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.to_wallet_id) {
      newErrors.to_wallet_id = 'Dirección de billetera requerida';
    } else if (formData.to_wallet_id.length < 20) {
      newErrors.to_wallet_id = 'Dirección inválida';
    }

    if (!formData.amount) {
      newErrors.amount = 'Monto requerido';
    } else {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount < 1) {
        newErrors.amount = 'Mínimo 1 fuego';
      } else if (amount > 10000) {
        newErrors.amount = 'Máximo 10,000 fuegos';
      } else if (parseFloat(total) > currentBalance) {
        newErrors.amount = `Balance insuficiente (tienes ${currentBalance} fuegos)`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (validate()) {
      setStep('confirm');
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/economy/transfer-fires', formData);
      toast.success(`${formData.amount} fuegos enviados exitosamente`);
      onSuccess && onSuccess(response.data);
      handleClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al enviar fuegos');
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('form');
    setFormData({ to_wallet_id: '', amount: '' });
    setErrors({});
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
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
                {step === 'confirm' && (
                  <button
                    onClick={() => setStep('form')}
                    className="p-2 hover:bg-glass-hover rounded-lg transition-colors"
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
                <div className="w-10 h-10 rounded-full bg-fire-orange/20 flex items-center justify-center">
                  <Send size={20} className="text-fire-orange" />
                </div>
                <h2 className="text-xl font-bold">
                  {step === 'form' ? 'Enviar Fuegos' : 'Confirmar Envío'}
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-glass-hover rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Step */}
            {step === 'form' && (
              <div className="space-y-4">
                {/* Wallet Address */}
                <div>
                  <label className="block text-sm font-medium text-text/80 mb-2">
                    Dirección de Billetera Destino
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="to_wallet_id"
                      value={formData.to_wallet_id}
                      onChange={handleChange}
                      className={`input-glass flex-1 ${errors.to_wallet_id ? 'border-red-500' : ''}`}
                      placeholder="Pega la dirección aquí"
                    />
                    <button
                      type="button"
                      onClick={handlePaste}
                      className="px-4 py-2 bg-glass hover:bg-glass-hover rounded-lg transition-colors text-sm"
                    >
                      Pegar
                    </button>
                  </div>
                  {errors.to_wallet_id && (
                    <p className="text-xs text-red-400 mt-1">{errors.to_wallet_id}</p>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-text/80 mb-2">
                    Cantidad de Fuegos
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    className={`input-glass w-full ${errors.amount ? 'border-red-500' : ''}`}
                    placeholder="1 - 10,000"
                    min="1"
                    max="10000"
                    step="0.01"
                  />
                  {errors.amount && (
                    <p className="text-xs text-red-400 mt-1">{errors.amount}</p>
                  )}
                  <p className="text-xs text-text/40 mt-1">
                    Balance disponible: {currentBalance} 🔥
                  </p>
                </div>

                {/* Fee Info */}
                {formData.amount && parseFloat(formData.amount) > 0 && (
                  <div className="glass-panel p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text/70">Monto a enviar:</span>
                      <span className="text-accent font-medium">{formData.amount} 🔥</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text/70">Comisión (5%):</span>
                      <span className="text-yellow-400 font-medium">{commission} 🔥</span>
                    </div>
                    <div className="border-t border-glass pt-2 flex justify-between font-bold">
                      <span>Total a descontar:</span>
                      <span className="text-fire-orange">{total} 🔥</span>
                    </div>
                  </div>
                )}

                {/* Continue Button */}
                <button
                  onClick={handleContinue}
                  className="w-full btn-primary"
                >
                  Continuar
                </button>
              </div>
            )}

            {/* Confirmation Step */}
            {step === 'confirm' && (
              <div className="space-y-4">
                {/* Warning */}
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex gap-3">
                  <AlertCircle size={20} className="text-warning flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-warning mb-1">Confirma los detalles</p>
                    <p className="text-text/70">
                      Esta acción no se puede deshacer. Verifica que la dirección sea correcta.
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="glass-panel p-4 space-y-3">
                  <div>
                    <label className="text-xs text-text/60 block mb-1">Enviar a:</label>
                    <p className="text-sm font-mono text-accent break-all">
                      {formData.to_wallet_id}
                    </p>
                  </div>

                  <div className="border-t border-glass pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-text/70">Monto:</span>
                      <span className="text-accent font-medium">{formData.amount} 🔥</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text/70">Comisión (5%):</span>
                      <span className="text-yellow-400">{commission} 🔥</span>
                    </div>
                    <div className="flex justify-between text-base font-bold">
                      <span>Total:</span>
                      <span className="text-fire-orange">{total} 🔥</span>
                    </div>
                  </div>
                </div>

                {/* Confirm Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('form')}
                    className="flex-1 py-3 px-4 rounded-lg bg-glass hover:bg-glass-hover transition-colors"
                    disabled={loading}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={loading}
                    className="flex-1 btn-primary disabled:opacity-50"
                  >
                    {loading ? 'Enviando...' : 'Confirmar Envío'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SendFiresModal;
