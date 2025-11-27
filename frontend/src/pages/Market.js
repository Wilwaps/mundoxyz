import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { motion } from 'framer-motion';
import { ShoppingCart, CreditCard, Clock, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const FIRES_PER_USDT = 300; // Peg interno: 300🔥 ≈ 1 USDT

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
    fires_amount: 100,
    wallet_address: '',
    network: 'TRON'
  });
  const [payoutMethod, setPayoutMethod] = useState('bs'); // 'bs' | 'usdt_tron'

  // Fetch user's redemption history
  const { data: redeems } = useQuery({
    queryKey: ['my-redeems'],
    queryFn: async () => {
      const response = await axios.get('/api/market/my-redeems');
      return response.data;
    }
  });

  // Fetch FIAT context (BCV, Binance, tasa operativa MundoXYZ)
  const { data: fiatContext } = useQuery({
    queryKey: ['fiat-context'],
    queryFn: async () => {
      const response = await axios.get('/api/economy/fiat-context');
      return response.data;
    }
  });

  // Fetch store marketplace plans (venta de tiendas)
  const { data: storePlans } = useQuery({
    queryKey: ['store-plans'],
    queryFn: async () => {
      const response = await axios.get('/api/market/store-plans');
      return response.data;
    }
  });

  // Fetch public stores list for Market
  const { data: stores } = useQuery({
    queryKey: ['public-stores'],
    queryFn: async () => {
      const response = await axios.get('/api/store/public-list');
      return response.data;
    }
  });

  const firesPerUsdt = fiatContext?.config?.fires_per_usdt ?? FIRES_PER_USDT;

  const amountNumber = parseFloat(redeemData.fires_amount || 0);
  const commissionAmount = amountNumber * 0.05;
  const totalRequiredAmount = amountNumber + commissionAmount;
  const estimatedUsdt = amountNumber > 0 ? amountNumber / firesPerUsdt : 0;

  const operationalRate = fiatContext?.operationalRate?.rate ?? null;
  const estimatedBs =
    payoutMethod === 'bs' && amountNumber > 0 && operationalRate
      ? (amountNumber / firesPerUsdt) * operationalRate
      : null;

  const storePlansEnabled = !!storePlans?.is_enabled;
  const storePlansData = storePlans?.plans || {};

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
        fires_amount: 100,
        wallet_address: '',
        network: 'TRON'
      });
      setPayoutMethod('bs');
      refreshUser();
      queryClient.invalidateQueries(['my-redeems']);
      queryClient.invalidateQueries(['user-stats', user.id]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al crear solicitud');
    }
  });

  const handleRedeem = () => {
    const minRequired = 105; // 100 + 5% comisión (umbral base para abrir modal)
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
    const minAmount = payoutMethod === 'usdt_tron' ? 300 : 100;
    if (amount < minAmount) {
      if (payoutMethod === 'usdt_tron') {
        toast.error(`La cantidad mínima para retiros en USDT es ${minAmount} fuegos`);
      } else {
        toast.error(`La cantidad mínima es ${minAmount} fuegos`);
      }
      return;
    }

    const commission = amount * 0.05;
    const totalRequired = amount + commission;
    if (user?.fires_balance < totalRequired) {
      toast.error(`Necesitas ${totalRequired.toFixed(2)} fuegos (${amount} + ${commission.toFixed(2)} comisión)`);
      return;
    }

    if (payoutMethod === 'usdt_tron' && !redeemData.wallet_address) {
      toast.error('La wallet USDT es requerida para retiros en USDT');
      return;
    }

    redeemMutation.mutate({
      ...redeemData,
      payout_method: payoutMethod === 'usdt_tron' ? 'usdt_tron' : 'bank_transfer'
    });
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
            <p className="text-text/60">Convierte 100  en dinero real</p>
          </div>
        </div>

        <p className="text-xs text-text/60 mb-2">
          {redeems?.length > 0
            ? `Has realizado ${redeems.length} canje${redeems.length === 1 ? '' : 's'} de Fuegos. ́ltimo: ${new Date(redeems[0].created_at).toLocaleDateString()} (${getStatusText(redeems[0].status)}).`
            : 'Án no has realizado canjes de Fuegos.'}
        </p>

        <div className="bg-glass/50 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-text/60">Tu balance:</span>
            <span className="text-2xl font-bold text-fire-orange"> {user?.fires_balance || 0}</span>
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
        className="card-glass hidden"
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

      {/* Store marketplace: venta de tiendas */}
      {storePlans && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="card-glass mt-6 bg-gradient-to-br from-indigo-600/30 via-fuchsia-500/20 to-cyan-400/20 border border-white/10"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Tu Propia Tienda Digital</h2>
              <p className="text-xs text-white/80">
                Activa una tienda profesional dentro de MundoXYZ con todo el ecosistema de juegos y economía dual.
              </p>
            </div>
            <div className="text-[11px] text-white/80">
              {storePlansEnabled ? 'Venta de tiendas: ACTIVADA' : 'Venta de tiendas: Próximamente'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['starter', 'professional', 'enterprise'].map((key) => {
              const plan = storePlansData[key] || {};
              const price = Number(plan.price_usd || 0);
              const label =
                key === 'starter'
                  ? 'Starter'
                  : key === 'professional'
                  ? 'Professional'
                  : 'Enterprise';
              const features =
                key === 'starter'
                  ? [
                      'Hasta 100 productos',
                      'Motor SEO básico',
                      'Integración básica con Telegram',
                      '1 tienda activa'
                    ]
                  : key === 'professional'
                  ? [
                      'Hasta 500 productos',
                      'SEO avanzado con IA',
                      'Integración Telegram Pro',
                      '3 tiendas activas',
                      'Dual economy (Coins + Fires)'
                    ]
                  : [
                      'Productos ilimitados',
                      'SEO enterprise con IA',
                      'Tiendas ilimitadas',
                      'Gamificación avanzada',
                      'API y white-label'
                    ];

              const approxFires =
                firesPerUsdt && price > 0 ? Math.round(price * firesPerUsdt) : null;

              return (
                <div
                  key={key}
                  className="relative glass-panel bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col"
                >
                  {key === 'professional' && (
                    <div className="absolute -top-3 right-4 px-3 py-1 rounded-full text-[11px] bg-amber-400 text-black font-semibold shadow-lg">
                      POPULAR 🔥
                    </div>
                  )}
                  <div className="mb-2">
                    <h3 className="text-base font-bold text-white">{label}</h3>
                    <div className="text-2xl font-extrabold text-white mt-1">
                      ${price.toFixed(0)}{' '}
                      <span className="text-xs font-normal text-white/70">/ tienda</span>
                    </div>
                    {approxFires && (
                      <div className="text-[11px] text-white/70 mt-1">
                        ≈ {approxFires.toLocaleString('es-VE')} 🔥
                      </div>
                    )}
                  </div>
                  <ul className="mt-2 mb-3 space-y-1 text-[11px] text-white/80 flex-1">
                    {features.map((feat) => (
                      <li key={feat} className="flex items-center gap-1">
                        <span className="text-amber-300">✨</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() =>
                      toast(
                        'La compra de tiendas se gestiona con el equipo MundoXYZ. Muy pronto activaremos este flujo directo desde el Market.'
                      )
                    }
                    disabled={!storePlansEnabled}
                    className={`w-full mt-auto py-2 rounded-full text-xs font-semibold transition ${
                      storePlansEnabled
                        ? 'bg-white text-indigo-700 hover:bg-amber-100'
                        : 'bg-white/10 text-white/60 cursor-not-allowed'
                    }`}
                  >
                    {storePlansEnabled ? 'Quiero esta tienda' : 'Próximamente'}
                  </button>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {stores && stores.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card-glass mt-6"
        >
          <h3 className="text-lg font-bold mb-4">Tiendas disponibles</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stores.map((store) => (
              <div key={store.id} className="glass-panel p-4 flex gap-3 items-center">
                <img
                  src={store.logo_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(store.name)}
                  alt={store.name}
                  className="w-12 h-12 rounded-lg object-cover bg-white/10 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-text truncate">{store.name}</h4>
                  {store.description && (
                    <p className="text-xs text-text/60 line-clamp-2">{store.description}</p>
                  )}
                  <div className="mt-2">
                    <Link
                      to={`/store/${store.slug}`}
                      className="text-xs text-accent hover:underline"
                    >
                      Entrar a la tienda
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Redeem Modal */}
      {showRedeemModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-glass w-full max-w-md max-h-[90vh] flex flex-col"
          >
            <h3 className="text-xl font-bold mb-4 flex-shrink-0">Solicitar Canje</h3>
            
            <form onSubmit={submitRedeem} className="flex flex-col flex-1 min-h-0">
              <div className="space-y-4 overflow-y-auto flex-1 pr-2">
              <div>
                <label className="block text-sm text-text/60 mb-1">Cantidad de Fuegos *</label>
                <input
                  type="number"
                  value={redeemData.fires_amount}
                  onChange={(e) => setRedeemData({...redeemData, fires_amount: e.target.value})}
                  min={payoutMethod === 'usdt_tron' ? 300 : 100}
                  step="1"
                  className="input-glass w-full"
                  required
                />
                <p className="text-xs text-text/40 mt-1">
                  {payoutMethod === 'usdt_tron'
                    ? 'Mínimo: 300 fuegos (retiro en USDT)'
                    : 'Mínimo: 100 fuegos'}
                </p>
              </div>
              
              <div className="bg-glass/50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text/60">Cantidad a canjear:</span>
                  <span className="text-text font-semibold">{amountNumber.toFixed(2)} 🔥</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text/60">Comisión plataforma (5%):</span>
                  <span className="text-warning font-semibold">{commissionAmount.toFixed(2)} 🔥</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between">
                  <span className="text-text font-bold">Total a deducir:</span>
                  <span className="text-fire-orange font-bold">{totalRequiredAmount.toFixed(2)} 🔥</span>
                </div>
              </div>
              
              {/* Selector de método de pago */}
              <div className="flex bg-glass rounded-lg p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setPayoutMethod('bs')}
                  className={`flex-1 py-2 rounded-md transition-colors ${
                    payoutMethod === 'bs'
                      ? 'bg-fire-orange/80 text-black font-semibold'
                      : 'bg-transparent text-text/60 hover:bg-glass-hover'
                  }`}
                >
                  Recibir en Bs (Transferencia)
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutMethod('usdt_tron')}
                  className={`flex-1 py-2 rounded-md transition-colors ml-1 ${
                    payoutMethod === 'usdt_tron'
                      ? 'bg-emerald-500/80 text-black font-semibold'
                      : 'bg-transparent text-text/60 hover:bg-glass-hover'
                  }`}
                >
                  Recibir en USDT (TRON)
                </button>
              </div>

              {payoutMethod === 'bs' ? (
                <>
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
                </>
              ) : (
                <>
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
                  <label className="block text-sm text-text/60 mb-1">Wallet USDT (TRON) *</label>
                  <input
                    type="text"
                    value={redeemData.wallet_address}
                    onChange={(e) => setRedeemData({...redeemData, wallet_address: e.target.value})}
                    placeholder="TL..."
                    className="input-glass w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-text/60 mb-1">Red</label>
                  <input
                    type="text"
                    value={redeemData.network}
                    onChange={(e) => setRedeemData({...redeemData, network: e.target.value})}
                    placeholder="TRON"
                    className="input-glass w-full"
                  />
                </div>
                </>
              )}

              <div className="bg-warning/20 border border-warning/30 rounded-lg p-3">
                {payoutMethod === 'usdt_tron' ? (
                  <p className="text-warning text-xs">
                    Se debitarán {totalRequiredAmount.toFixed(2)} 🔥 de tu cuenta ({amountNumber.toFixed(2)} + 5% comisión).
                    {' '}Recibirás aproximadamente {estimatedUsdt.toFixed(2)} USDT (1 USDT ≈ {firesPerUsdt} 🔥).
                    {' '}El proceso de pago puede tardar hasta 48 horas.
                  </p>
                ) : (
                  <p className="text-warning text-xs">
                    Se debitarán {totalRequiredAmount.toFixed(2)} 🔥 de tu cuenta ({amountNumber.toFixed(2)} + 5% comisión).
                    {' '}
                    {estimatedBs !== null ? (
                      <>
                        Recibirás <span className="font-semibold">{estimatedBs.toFixed(2)} Bs</span>
                        {operationalRate && (
                          <>
                            {' '}según la tasa operativa MundoXYZ ({operationalRate.toFixed(2)} Bs por 1 USD).
                          </>
                        )}
                      </>
                    ) : (
                      'El equivalente en Bs se calculará según la tasa interna MundoXYZ al momento de procesar.'
                    )}
                    {' '}El proceso de pago puede tardar hasta 48 horas.
                  </p>
                )}
              </div>
              </div>
              
              <div className="flex gap-3 pt-4 flex-shrink-0">
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
