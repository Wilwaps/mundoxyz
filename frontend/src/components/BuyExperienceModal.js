import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Star, Coins, Flame, TrendingUp, AlertCircle, Sparkles } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

const BuyExperienceModal = ({ isOpen, onClose, user }) => {
  const [amount, setAmount] = useState(1);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const queryClient = useQueryClient();

  if (!isOpen) return null;

  const currentCoins = parseFloat(user?.coins_balance || 0);
  const currentFires = parseFloat(user?.fires_balance || 0);
  const currentXP = user?.experience || 0;

  // Constantes de precio
  const COINS_PER_XP = 50;
  const FIRES_PER_XP = 1;

  // Calcular costos totales
  const totalCoins = amount * COINS_PER_XP;
  const totalFires = amount * FIRES_PER_XP;

  // Verificar si tiene suficiente balance
  const hasEnoughCoins = currentCoins >= totalCoins;
  const hasEnoughFires = currentFires >= totalFires;
  const canBuy = hasEnoughCoins && hasEnoughFires && amount > 0;

  // Mutation para comprar experiencia
  const buyMutation = useMutation({
    mutationFn: async (data) => {
      const response = await axios.post('/api/experience/buy', data);
      return response.data;
    },
    onSuccess: (data) => {
      // Disparar confetti
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
      }

      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti(Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        }));
        confetti(Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        }));
      }, 250);

      // Toast notification
      toast.success('Con esta experiencia transforma tu camino..!', {
        duration: 5000,
        icon: '✨',
        style: {
          background: '#1a1a2e',
          color: '#fff',
          border: '1px solid #9333ea'
        }
      });

      // Invalidar queries para actualizar balances
      queryClient.invalidateQueries(['header-balance']);
      queryClient.invalidateQueries(['profile']);

      // Cerrar modal
      setTimeout(() => {
        onClose();
        setAmount(1);
        setShowConfirmation(false);
      }, 500);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al comprar experiencia', {
        duration: 4000
      });
    }
  });

  const handleIncrement = () => {
    setAmount(prev => prev + 1);
  };

  const handleDecrement = () => {
    if (amount > 1) {
      setAmount(prev => prev - 1);
    }
  };

  const handleInputChange = (e) => {
    const value = parseInt(e.target.value) || 1;
    setAmount(Math.max(1, value));
  };

  const handleBuyClick = () => {
    if (canBuy) {
      setShowConfirmation(true);
    }
  };

  const handleConfirm = () => {
    buyMutation.mutate({ amount });
  };

  const handleCancel = () => {
    setShowConfirmation(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-background-dark/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="card-glass max-w-md w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-glass">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="text-violet" size={28} />
              Comprar Experiencia
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-glass rounded-lg transition-colors"
              disabled={buyMutation.isPending}
            >
              <X size={24} />
            </button>
          </div>

          {/* Balance Actual */}
          <div className="mb-6 p-4 bg-gradient-to-br from-violet/10 to-accent/10 rounded-lg border border-violet/30">
            <div className="text-sm text-text/60 mb-2">Balance Actual</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <Star className="w-5 h-5 mx-auto mb-1 text-accent" />
                <div className="text-lg font-bold text-accent">{currentXP}</div>
                <div className="text-xs text-text/60">XP</div>
              </div>
              <div className="text-center">
                <Coins className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
                <div className="text-lg font-bold text-yellow-500">{currentCoins.toFixed(0)}</div>
                <div className="text-xs text-text/60">Coins</div>
              </div>
              <div className="text-center">
                <Flame className="w-5 h-5 mx-auto mb-1 text-fire-orange" />
                <div className="text-lg font-bold text-fire-orange">{currentFires.toFixed(0)}</div>
                <div className="text-xs text-text/60">Fires</div>
              </div>
            </div>
          </div>

          {/* Costo Unitario */}
          <div className="mb-6 p-4 bg-glass rounded-lg">
            <div className="text-sm text-text/60 mb-2">Costo por Punto de Experiencia</div>
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-yellow-500" />
                <span className="text-lg font-bold text-yellow-500">{COINS_PER_XP}</span>
              </div>
              <span className="text-text/40">+</span>
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-fire-orange" />
                <span className="text-lg font-bold text-fire-orange">{FIRES_PER_XP}</span>
              </div>
              <span className="text-text/40">=</span>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-accent" />
                <span className="text-lg font-bold text-accent">1 XP</span>
              </div>
            </div>
          </div>

          {/* Selector de Cantidad */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3 text-text/80">
              ¿Cuántos puntos de experiencia deseas comprar?
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={handleDecrement}
                disabled={amount <= 1 || buyMutation.isPending}
                className="btn-modifier"
              >
                <Minus size={20} />
              </button>
              <input
                type="number"
                value={amount}
                onChange={handleInputChange}
                min="1"
                disabled={buyMutation.isPending}
                className="xp-input"
              />
              <button
                onClick={handleIncrement}
                disabled={buyMutation.isPending}
                className="btn-modifier"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* Resumen Total */}
          <div className="mb-6 p-4 bg-gradient-to-br from-violet/20 to-accent/20 rounded-lg border border-violet/30">
            <div className="text-sm text-text/60 mb-3">Total a Pagar</div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-text/80">XP a recibir:</span>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-accent" />
                  <span className="text-xl font-bold text-accent">+{amount}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text/80">Coins:</span>
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-yellow-500" />
                  <span className={`text-lg font-bold ${hasEnoughCoins ? 'text-yellow-500' : 'text-red-500'}`}>
                    -{totalCoins}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text/80">Fires:</span>
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-fire-orange" />
                  <span className={`text-lg font-bold ${hasEnoughFires ? 'text-fire-orange' : 'text-red-500'}`}>
                    -{totalFires}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-glass flex justify-between items-center">
                <span className="font-semibold">Nueva XP Total:</span>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="text-xl font-bold text-success">{currentXP + amount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Validaciones y Warnings */}
          {(!hasEnoughCoins || !hasEnoughFires) && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-400">
                {!hasEnoughCoins && (
                  <div>Te faltan {(totalCoins - currentCoins).toFixed(0)} coins</div>
                )}
                {!hasEnoughFires && (
                  <div>Te faltan {(totalFires - currentFires).toFixed(0)} fires</div>
                )}
              </div>
            </div>
          )}

          {/* Confirmación Modal */}
          {showConfirmation && (
            <div className="mb-4 p-4 bg-violet/20 border border-violet rounded-lg">
              <div className="text-center mb-4">
                <p className="text-lg font-semibold mb-2">¿Confirmar compra?</p>
                <p className="text-sm text-text/60">
                  Gastarás {totalCoins} coins y {totalFires} fires para obtener {amount} XP
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  disabled={buyMutation.isPending}
                  className="flex-1 btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={buyMutation.isPending}
                  className="flex-1 btn-primary"
                >
                  {buyMutation.isPending ? 'Comprando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}

          {/* Botones de Acción */}
          {!showConfirmation && (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={buyMutation.isPending}
                className="flex-1 btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleBuyClick}
                disabled={!canBuy || buyMutation.isPending}
                className={`flex-1 ${canBuy ? 'btn-primary' : 'btn-disabled'}`}
              >
                Comprar XP
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BuyExperienceModal;
