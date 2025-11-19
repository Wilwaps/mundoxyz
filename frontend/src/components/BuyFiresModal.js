import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Copy, Check, Send } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import PasswordRequiredModal from './PasswordRequiredModal';

const BuyFiresModal = ({ isOpen, onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState('bs'); // 'bs' | 'usdt_tron'
  const [formData, setFormData] = useState({
    amount: '',
    bank_reference: '',
    usdt_amount: '',
    tx_hash: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [copiedBank, setCopiedBank] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [fiatContext, setFiatContext] = useState(null);

  const bankData = `0102 Venezuela
20827955
0412-225.00.16
Pago`;

  React.useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const fetchFiatContext = async () => {
      try {
        const res = await axios.get('/api/economy/fiat-context');
        if (!cancelled) {
          setFiatContext(res.data);
        }
      } catch (error) {
        // No mostrar error al usuario final; solo log opcional para diagnóstico
        // eslint-disable-next-line no-console
        console.error('Error fetching FIAT context', error);
      }
    };

    fetchFiatContext();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Para bank_reference, solo permitir números
    if (name === 'bank_reference') {
      const numericValue = value.replace(/\D/g, '');
      setFormData(prev => ({ ...prev, [name]: numericValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleCopyBankData = async () => {
    try {
      await navigator.clipboard.writeText(bankData);
      setCopiedBank(true);
      toast.success('Datos bancarios copiados');
      setTimeout(() => setCopiedBank(false), 2000);
    } catch (error) {
      toast.error('Error al copiar');
    }
  };

  const validate = () => {
    const newErrors = {};

    if (paymentMethod === 'bs') {
      if (!formData.amount) {
        newErrors.amount = 'Cantidad requerida';
      } else {
        const amount = parseFloat(formData.amount);
        if (isNaN(amount) || amount <= 0) {
          newErrors.amount = 'Cantidad inválida';
        }
      }

      if (!formData.bank_reference) {
        newErrors.bank_reference = 'Referencia bancaria requerida';
      } else if (formData.bank_reference.length < 4) {
        newErrors.bank_reference = 'Referencia muy corta';
      }
    } else {
      if (!formData.usdt_amount) {
        newErrors.usdt_amount = 'Monto USDT requerido';
      } else {
        const usdt = parseFloat(formData.usdt_amount);
        if (isNaN(usdt) || usdt <= 0) {
          newErrors.usdt_amount = 'Monto USDT inválido';
        }
      }

      if (!formData.tx_hash) {
        newErrors.tx_hash = 'Hash de transacción requerido';
      } else if (formData.tx_hash.length < 10) {
        newErrors.tx_hash = 'Hash demasiado corto';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    // Require password before submitting
    setShowPasswordModal(true);
  };

  const handlePasswordConfirmed = async () => {
    setShowPasswordModal(false);
    setLoading(true);
    try {
      let payload;

      if (paymentMethod === 'bs') {
        payload = {
          amount: formData.amount,
          bank_reference: formData.bank_reference,
          payment_method: 'bs'
        };
      } else {
        payload = {
          payment_method: 'usdt_tron',
          usdt_amount: formData.usdt_amount,
          tx_hash: formData.tx_hash,
          network: fiatContext?.config?.usdt_network || 'TRON'
        };
      }

      const response = await axios.post('/api/economy/request-fires', payload);
      toast.success('Solicitud enviada. Será revisada por un administrador.');
      
      // Invalidar queries de solicitudes
      queryClient.invalidateQueries(['fire-requests']);
      
      onSuccess && onSuccess(response.data);
      handleClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al enviar solicitud');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPaymentMethod('bs');
    setFormData({ amount: '', bank_reference: '', usdt_amount: '', tx_hash: '' });
    setErrors({});
    setShowPasswordModal(false);
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const firesPerUsdt = fiatContext?.config?.fires_per_usdt || 300;
  const usdtWallet = fiatContext?.config?.usdt_official_wallet || 'TLNsU1jj17zvRHbrJW27Xv9DGK9KiQBD3y';
  const usdtNetwork = fiatContext?.config?.usdt_network || 'TRON';

  let fiatPreview = null;
  if (fiatContext && fiatContext.operationalRate && formData.amount) {
    const parsed = parseFloat(formData.amount);
    if (!isNaN(parsed) && parsed > 0) {
      const tokens = parsed;
      const usdt = tokens / firesPerUsdt;
      const rate = parseFloat(fiatContext.operationalRate.rate);
      if (Number.isFinite(rate) && rate > 0) {
        const ves = usdt * rate;
        fiatPreview = {
          tokens,
          usdt,
          ves,
          rate,
          baseSource: fiatContext.operationalRate.baseSource,
          marginPercent: fiatContext.operationalRate.marginPercent
        };
      }
    }
  }

  return (
    <>
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
                <div className="w-10 h-10 rounded-full bg-fire-orange/20 flex items-center justify-center">
                  <ShoppingCart size={20} className="text-fire-orange" />
                </div>
                <h2 className="text-xl font-bold">Comprar Fuegos</h2>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-glass-hover rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
              {/* Payment method selector */}
              <div className="flex bg-glass rounded-lg p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('bs')}
                  className={`flex-1 py-2 rounded-md transition-colors ${
                    paymentMethod === 'bs'
                      ? 'bg-fire-orange/80 text-black font-semibold'
                      : 'bg-transparent text-text/60 hover:bg-glass-hover'
                  }`}
                >
                  Pago en Bs (Transferencia)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('usdt_tron')}
                  className={`flex-1 py-2 rounded-md transition-colors ml-1 ${
                    paymentMethod === 'usdt_tron'
                      ? 'bg-emerald-500/80 text-black font-semibold'
                      : 'bg-transparent text-text/60 hover:bg-glass-hover'
                  }`}
                >
                  Pago en USDT (TRON)
                </button>
              </div>

              {paymentMethod === 'bs' ? (
                <>
                  {/* Instructions Bs */}
                  <div className="bg-accent/10 border border-accent/30 rounded-lg p-3">
                    <p className="text-xs text-accent">
                      💡 <strong>Pasos:</strong>
                      <br />1. Realiza el pago a los datos bancarios
                      <br />2. Ingresa la cantidad de fuegos y tu referencia
                      <br />3. Espera la aprobación del administrador
                    </p>
                  </div>

                  {/* Bank Data */}
                  <div className="glass-panel p-4 space-y-3">
                    <label className="text-sm font-medium text-text/80">
                      Datos Bancarios para Pago
                    </label>
                    <div className="bg-background-dark/50 rounded-lg p-3">
                      <pre className="text-sm text-accent whitespace-pre-wrap font-mono">
                        {bankData}
                      </pre>
                    </div>
                    <button
                      onClick={handleCopyBankData}
                      className="w-full py-2 px-4 bg-glass hover:bg-glass-hover rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      {copiedBank ? (
                        <>
                          <Check size={16} />
                          ¡Copiado!
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          Copiar Datos Bancarios
                        </>
                      )}
                    </button>
                  </div>

                  {/* Amount Input (fires) */}
                  <div>
                    <label className="block text-sm font-medium text-text/80 mb-2">
                      Cantidad de Fuegos a Solicitar
                    </label>
                    <input
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleChange}
                      className={`input-glass w-full ${errors.amount ? 'border-red-500' : ''}`}
                      placeholder="Ej: 100"
                      min="1"
                      step="0.01"
                    />
                    {errors.amount && (
                      <p className="text-xs text-red-400 mt-1">{errors.amount}</p>
                    )}
                    {fiatPreview ? (
                      <p className="text-xs text-text/40 mt-1">
                        Deposita: {fiatPreview.ves.toFixed(2)} Bs (1🔥 = {(fiatPreview.ves / fiatPreview.tokens).toFixed(2)} Bs)
                      </p>
                    ) : (
                      <p className="text-xs text-text/40 mt-1">
                        El valor en Bs se calcula con la tasa MundoXYZ vigente al registrar tu solicitud.
                      </p>
                    )}
                  </div>

                  {/* Bank Reference Input */}
                  <div>
                    <label className="block text-sm font-medium text-text/80 mb-2">
                      Referencia Bancaria (solo números)
                    </label>
                    <input
                      type="text"
                      name="bank_reference"
                      value={formData.bank_reference}
                      onChange={handleChange}
                      className={`input-glass w-full ${errors.bank_reference ? 'border-red-500' : ''}`}
                      placeholder="123456789"
                      inputMode="numeric"
                    />
                    {errors.bank_reference && (
                      <p className="text-xs text-red-400 mt-1">{errors.bank_reference}</p>
                    )}
                    <p className="text-xs text-text/40 mt-1">
                      Ingresa solo los números de tu comprobante de pago
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Instructions USDT */}
                  <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-3">
                    <p className="text-xs text-emerald-300">
                      💡 <strong>Pasos:</strong>
                      <br />1. Envía USDT ({usdtNetwork}) a la billetera oficial
                      <br />2. Ingresa el monto en USDT y el hash de la transacción
                      <br />3. Espera la aprobación del administrador y la acreditación de tus fuegos
                    </p>
                  </div>

                  {/* USDT Wallet Info */}
                  <div className="glass-panel p-4 space-y-3">
                    <label className="text-sm font-medium text-text/80">
                      Billetera oficial USDT ({usdtNetwork})
                    </label>
                    <div className="bg-background-dark/50 rounded-lg p-3">
                      <pre className="text-sm text-emerald-300 whitespace-pre-wrap font-mono">
                        {usdtWallet}
                      </pre>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(usdtWallet);
                          setCopiedWallet(true);
                          toast.success('Billetera USDT copiada');
                          setTimeout(() => setCopiedWallet(false), 2000);
                        } catch (err) {
                          toast.error('No se pudo copiar la billetera');
                        }
                      }}
                      className="w-full py-2 px-4 bg-glass hover:bg-glass-hover rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      {copiedWallet ? (
                        <>
                          <Check size={16} />
                          ¡Copiado!
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          Copiar Billetera USDT
                        </>
                      )}
                    </button>
                  </div>

                  {/* USDT Amount Input */}
                  <div>
                    <label className="block text-sm font-medium text-text/80 mb-2">
                      Monto a enviar en USDT
                    </label>
                    <input
                      type="number"
                      name="usdt_amount"
                      value={formData.usdt_amount}
                      onChange={handleChange}
                      className={`input-glass w-full ${errors.usdt_amount ? 'border-red-500' : ''}`}
                      placeholder="Ej: 1.00"
                      min="0.01"
                      step="0.01"
                    />
                    {errors.usdt_amount && (
                      <p className="text-xs text-red-400 mt-1">{errors.usdt_amount}</p>
                    )}
                    {formData.usdt_amount && !errors.usdt_amount && (
                      <p className="text-xs text-text/40 mt-1">
                        Recibirás aproximadamente{' '}
                        {(parseFloat(formData.usdt_amount || 0) * firesPerUsdt).toFixed(2)} 🔥
                        {fiatContext?.operationalRate && (
                          <>
                            {' '}(
                            ≈{
                              (
                                parseFloat(formData.usdt_amount || 0) *
                                parseFloat(fiatContext.operationalRate.rate || 0)
                              ).toFixed(2)
                            }{' '}
                            Bs)
                          </>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Tx Hash Input */}
                  <div>
                    <label className="block text-sm font-medium text-text/80 mb-2">
                      Hash de Transacción USDT
                    </label>
                    <input
                      type="text"
                      name="tx_hash"
                      value={formData.tx_hash}
                      onChange={handleChange}
                      className={`input-glass w-full ${errors.tx_hash ? 'border-red-500' : ''}`}
                      placeholder="Ej: 0x..."
                    />
                    {errors.tx_hash && (
                      <p className="text-xs text-red-400 mt-1">{errors.tx_hash}</p>
                    )}
                    <p className="text-xs text-text/40 mt-1">
                      Pega aquí el hash de la transacción en TRON para que el Tote pueda verificar tu pago.
                    </p>
                  </div>
                </>
              )}

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleClose}
                  className="flex-1 py-3 px-4 rounded-lg bg-glass hover:bg-glass-hover transition-colors"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    'Enviando...'
                  ) : (
                    <>
                      <Send size={18} />
                      Enviar Solicitud
                    </>
                  )}
                </button>
              </div>

              {/* Warning */}
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                <p className="text-xs text-warning">
                  ⚠️ Tu solicitud será revisada por un administrador. Asegúrate de que la referencia sea correcta.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <PasswordRequiredModal
      isOpen={showPasswordModal}
      onClose={() => setShowPasswordModal(false)}
      onSuccess={handlePasswordConfirmed}
      action="comprar fuegos"
    />
  </>
  );
};

export default BuyFiresModal;
