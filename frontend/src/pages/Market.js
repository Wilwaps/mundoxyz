import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { motion } from 'framer-motion';
import { ShoppingCart, CreditCard, Clock, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const Market = () => {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemData, setRedeemData] = useState({
    cedula: '',
    telefono: '',
    bank_code: '',
    bank_name: '',
    bank_account: '',
    fires_amount: 100
  });

  // Fetch user's redemption history
  const { data: redeems } = useQuery({
    queryKey: ['my-redeems'],
    queryFn: async () => {
      const response = await axios.get('/api/market/my-redeems');
      return response.data;
    }
  });

  // Redeem mutation
  const redeemMutation = useMutation({
    mutationFn: async (data) => {
      return axios.post('/api/market/redeem-100-fire', data);
    },
    onSuccess: () => {
      toast.success('Solicitud de canje creada exitosamente');
      setShowRedeemModal(false);
      setRedeemData({
        cedula: '',
        telefono: '',
        bank_code: '',
        bank_name: '',
        bank_account: '',
        fires_amount: 100
      });
      refreshUser();
      queryClient.invalidateQueries(['my-redeems']);
      queryClient.invalidateQueries(['user-stats', user.id]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al crear solicitud');
    }
  });

  const handleRedeem = () => {
    const minRequired = 105; // 100 + 5% comisión
    if (user?.fires_balance < minRequired) {
      toast.error(`Necesitas al menos ${minRequired} 🔥 para canjear (100 + 5% comisión)`);
      return;
    }
    setShowRedeemModal(true);
  };

  const submitRedeem = (e) => {
    e.preventDefault();
    if (!redeemData.cedula || !redeemData.telefono) {
      toast.error('Cédula y teléfono son requeridos');
      return;
    }
    const amount = parseFloat(redeemData.fires_amount);
    if (amount < 100) {
      toast.error('La cantidad mínima es 100 fuegos');
      return;
    }
    const commission = amount * 0.05;
    const totalRequired = amount + commission;
    if (user?.fires_balance < totalRequired) {
      toast.error(`Necesitas ${totalRequired.toFixed(2)} fuegos (${amount} + ${commission.toFixed(2)} comisión)`);
      return;
    }
    redeemMutation.mutate(redeemData);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="text-warning" size={16} />;
      case 'completed':
        return <CheckCircle className="text-success" size={16} />;
      case 'rejected':
        return <XCircle className="text-error" size={16} />;
      default:
        return null;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'completed':
        return 'Completado';
      case 'rejected':
        return 'Rechazado';
      default:
        return status;
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold text-center mb-8 text-gradient-violet">Mercado</h1>

      {/* Redeem Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-glass mb-6"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-fire-orange to-fire-yellow rounded-full flex items-center justify-center shadow-fire">
            <ShoppingCart size={28} className="text-background-dark" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-text">Canjear Fuegos</h2>
            <p className="text-text/60">Convierte 100 🔥 en dinero real</p>
          </div>
        </div>

        <div className="bg-glass/50 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-text/60">Tu balance:</span>
            <span className="text-2xl font-bold text-fire-orange">🔥 {user?.fires_balance || 0}</span>
          </div>
        </div>

        <button
          onClick={handleRedeem}
          disabled={user?.fires_balance < 105}
          className={`w-full ${user?.fires_balance >= 105 ? 'btn-primary' : 'bg-gray-600 text-gray-400 py-3 px-6 rounded-lg cursor-not-allowed'}`}
        >
          {user?.fires_balance >= 105 ? 'Canjear Fuegos' : 'Saldo insuficiente'}
        </button>
      </motion.div>

      {/* Redemption History */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-glass"
      >
        <h3 className="text-lg font-bold mb-4">Historial de Canjes</h3>
        
        {redeems?.length > 0 ? (
          <div className="space-y-3">
            {redeems.map((redeem) => (
              <div key={redeem.id} className="glass-panel p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(redeem.status)}
                      <span className="font-semibold text-text">
                        {getStatusText(redeem.status)}
                      </span>
                    </div>
                    <p className="text-sm text-text/60 mt-1">
                      🔥 {redeem.fires_amount} • {new Date(redeem.created_at).toLocaleDateString()}
                    </p>
                    {redeem.processor_notes && (
                      <p className="text-xs text-text/40 mt-1">{redeem.processor_notes}</p>
                    )}
                  </div>
                  {redeem.transaction_id && (
                    <span className="text-xs text-success">
                      ID: {redeem.transaction_id}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-text/40">
            <CreditCard size={32} className="mx-auto mb-2 opacity-50" />
            <p>No tienes canjes anteriores</p>
          </div>
        )}
      </motion.div>

      {/* Redeem Modal */}
      {showRedeemModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-glass w-full max-w-md"
          >
            <h3 className="text-xl font-bold mb-4">Solicitar Canje</h3>
            
            <form onSubmit={submitRedeem} className="space-y-4">
              <div>
                <label className="block text-sm text-text/60 mb-1">Cantidad de Fuegos *</label>
                <input
                  type="number"
                  value={redeemData.fires_amount}
                  onChange={(e) => setRedeemData({...redeemData, fires_amount: e.target.value})}
                  min="100"
                  step="1"
                  className="input-glass w-full"
                  required
                />
                <p className="text-xs text-text/40 mt-1">Mínimo: 100 fuegos</p>
              </div>
              
              <div className="bg-glass/50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text/60">Cantidad a canjear:</span>
                  <span className="text-text font-semibold">{parseFloat(redeemData.fires_amount || 0).toFixed(2)} 🔥</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text/60">Comisión plataforma (5%):</span>
                  <span className="text-warning font-semibold">{(parseFloat(redeemData.fires_amount || 0) * 0.05).toFixed(2)} 🔥</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between">
                  <span className="text-text font-bold">Total a deducir:</span>
                  <span className="text-fire-orange font-bold">{(parseFloat(redeemData.fires_amount || 0) * 1.05).toFixed(2)} 🔥</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-text/60 mb-1">Cédula *</label>
                <input
                  type="text"
                  value={redeemData.cedula}
                  onChange={(e) => setRedeemData({...redeemData, cedula: e.target.value})}
                  placeholder="V12345678"
                  className="input-glass w-full"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm text-text/60 mb-1">Teléfono *</label>
                <input
                  type="tel"
                  value={redeemData.telefono}
                  onChange={(e) => setRedeemData({...redeemData, telefono: e.target.value})}
                  placeholder="+584121234567"
                  className="input-glass w-full"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm text-text/60 mb-1">Código Banco</label>
                <input
                  type="text"
                  value={redeemData.bank_code}
                  onChange={(e) => setRedeemData({...redeemData, bank_code: e.target.value})}
                  placeholder="0102"
                  className="input-glass w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm text-text/60 mb-1">Nombre del Banco</label>
                <input
                  type="text"
                  value={redeemData.bank_name}
                  onChange={(e) => setRedeemData({...redeemData, bank_name: e.target.value})}
                  placeholder="Banco de Venezuela"
                  className="input-glass w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm text-text/60 mb-1">Número de Cuenta</label>
                <input
                  type="text"
                  value={redeemData.bank_account}
                  onChange={(e) => setRedeemData({...redeemData, bank_account: e.target.value})}
                  placeholder="01020123456789012345"
                  className="input-glass w-full"
                />
              </div>
              
              <div className="bg-warning/20 border border-warning/30 rounded-lg p-3">
                <p className="text-warning text-xs">
                  Se debitarán {(parseFloat(redeemData.fires_amount || 0) * 1.05).toFixed(2)} 🔥 de tu cuenta ({redeemData.fires_amount} + 5% comisión). El proceso de pago puede tardar hasta 48 horas.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRedeemModal(false)}
                  className="flex-1 bg-gray-600 text-text py-3 px-6 rounded-lg hover:bg-gray-500 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={redeemMutation.isPending}
                  className="flex-1 btn-primary"
                >
                  {redeemMutation.isPending ? 'Procesando...' : 'Confirmar Canje'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Market;
