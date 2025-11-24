import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Plus, Minus, X, ChevronRight, Star, Clock, MapPin, CreditCard, Banknote, Flame } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import './StoreFront.css'; // Custom styles

const StoreFront = () => {
    const { slug } = useParams(); // e.g., 'divorare04'
    const navigate = useNavigate();
    const { user } = useAuth();
    const [cart, setCart] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showCart, setShowCart] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null); // For modal

    const initialPayments = {
        cash_usdt: 0,
        zelle: 0,
        bs: 0,
        fires: 0
    };
    const [payments, setPayments] = useState(initialPayments);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [giveChangeInFires, setGiveChangeInFires] = useState(false);

    // Fetch Store Data
    const { data: storeData, isLoading } = useQuery({
        queryKey: ['store', slug],
        queryFn: async () => {
            const response = await axios.get(`/api/store/public/${slug}`);
            return response.data;
        }
    });

    const { data: fiatContext } = useQuery({
        queryKey: ['fiat-context'],
        queryFn: async () => {
            const response = await axios.get('/api/economy/fiat-context');
            return response.data;
        }
    });

    const vesPerUsdt = fiatContext?.operationalRate?.rate;
    const firesPerUsdt = fiatContext?.config?.fires_per_usdt;

    const bsRate = typeof vesPerUsdt === 'number' && isFinite(vesPerUsdt) && vesPerUsdt > 0 ? vesPerUsdt : 38.5;
    const firesRate = typeof firesPerUsdt === 'number' && isFinite(firesPerUsdt) && firesPerUsdt > 0 ? firesPerUsdt : 10;

    const rates = {
        bs: bsRate,
        fires: firesRate
    };

    const parseAmount = (value) => {
        const n = typeof value === 'number'
            ? value
            : parseFloat(String(value ?? '').replace(',', '.'));
        return Number.isFinite(n) && n >= 0 ? n : 0;
    };

    const addToCart = (product, quantity = 1, modifiers = []) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            }
            return [...prev, { product, quantity, modifiers }];
        });
        toast.success('Agregado al carrito');
        setShowCart(true);
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    };

    const updateQuantity = (productId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.product.id === productId) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const cartTotalUSDT = cart.reduce((sum, item) => sum + (parseFloat(item.product.price_usdt) * item.quantity), 0);

    const cashUsdt = parseAmount(payments.cash_usdt);
    const zelleUsdt = parseAmount(payments.zelle);
    const bsAmount = parseAmount(payments.bs);
    const firesAmount = parseAmount(payments.fires);

    const totalPaidUSDT =
        cashUsdt +
        zelleUsdt +
        (bsAmount / rates.bs) +
        (firesAmount / rates.fires);

    const remainingUSDT = Math.max(0, cartTotalUSDT - totalPaidUSDT);
    const changeUSDT = Math.max(0, totalPaidUSDT - cartTotalUSDT);

    const isPaid = totalPaidUSDT >= cartTotalUSDT - 0.01;

    const totalBs = cartTotalUSDT * rates.bs;
    const totalFires = cartTotalUSDT * rates.fires;
    const changeFires = changeUSDT * rates.fires;

    const createOrderMutation = useMutation({
        mutationFn: async (orderData) => {
            const response = await axios.post('/api/store/order/create', orderData);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Pedido creado exitosamente');
            setCart([]);
            setShowCart(false);
            setPaymentModalOpen(false);
            setPayments(initialPayments);
            setGiveChangeInFires(false);
        },
        onError: (error) => {
            const message = error?.response?.data?.error || 'Error al crear pedido';
            toast.error(message);
        }
    });

    const handleCheckout = async () => {
        if (!user) {
            toast.error('Debes iniciar sesión para confirmar tu pedido');
            navigate('/login');
            return;
        }

        if (cart.length === 0) {
            toast.error('El carrito está vacío');
            return;
        }
        if (!isPaid) {
            toast.error('Falta completar el pago');
            return;
        }

        const orderData = {
            store_id: storeData.store.id,
            items: cart.map((item) => ({
                product_id: item.product.id,
                quantity: item.quantity,
                modifiers: item.modifiers || []
            })),
            type: 'pickup',
            payment_method: {
                source: 'storefront',
                cash_usdt: cashUsdt,
                zelle: zelleUsdt,
                bs: bsAmount,
                fires: firesAmount
            },
            currency_snapshot: rates,
            customer_id: user?.id || null,
            change_to_fires: giveChangeInFires && changeUSDT > 0 && user?.id
                ? {
                    enabled: true,
                    change_usdt: changeUSDT,
                    change_fires: changeFires
                }
                : { enabled: false }
        };

        await createOrderMutation.mutateAsync(orderData);
    };

    if (isLoading) return <div className="flex justify-center p-20"><div className="spinner"></div></div>;
    if (!storeData) return <div className="text-center p-20">Tienda no encontrada</div>;

    const { store, categories, products } = storeData;
    const activeCategory = selectedCategory || categories[0]?.id;
    const filteredProducts = products.filter(p => p.category_id === activeCategory);

    return (
        <div className="store-front min-h-screen bg-dark pb-24">
            {/* Hero Section */}
            <div className="relative h-64 md:h-80 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-dark via-transparent to-transparent z-10"></div>
                <img
                    src={store.cover_url || 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=1974&auto=format&fit=crop'}
                    alt="Cover"
                    className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 p-6 z-20 container mx-auto">
                    <div className="flex items-end gap-4">
                        <img
                            src={store.logo_url || 'https://ui-avatars.com/api/?name=Divorare&background=random'}
                            alt="Logo"
                            className="w-20 h-20 rounded-xl shadow-lg border-2 border-accent"
                        />
                        <div className="flex-1">
                            <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">{store.name}</h1>
                            <div className="flex flex-wrap gap-4 text-sm text-white/80">
                                <span className="flex items-center gap-1"><Star size={14} className="text-yellow-400 fill-yellow-400" /> 4.8 (120+)</span>
                                <span className="flex items-center gap-1"><Clock size={14} /> 30-45 min</span>
                                <span className="flex items-center gap-1"><MapPin size={14} /> 1.2 km</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Categories Sticky Nav */}
            <div className="sticky top-0 z-30 bg-dark/95 backdrop-blur-md border-b border-white/10 overflow-x-auto">
                <div className="container mx-auto px-4 flex gap-4 py-4 no-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeCategory === cat.id
                                    ? 'bg-accent text-dark'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Products Grid */}
            <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProducts.map(product => (
                        <motion.div
                            key={product.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-glass rounded-xl overflow-hidden border border-white/5 hover:border-accent/30 transition-all group"
                        >
                            <div className="relative h-48 overflow-hidden">
                                <img
                                    src={product.image_url || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=1000&auto=format&fit=crop'}
                                    alt={product.name}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                                <button
                                    onClick={() => addToCart(product)}
                                    className="absolute bottom-3 right-3 w-10 h-10 bg-accent text-dark rounded-full flex items-center justify-center shadow-lg transform translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                            <div className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg text-white">{product.name}</h3>
                                    <span className="font-bold text-accent">${product.price_usdt}</span>
                                </div>
                                <p className="text-sm text-white/60 line-clamp-2 mb-4">{product.description}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Floating Cart Button */}
            <AnimatePresence>
                {cart.length > 0 && (
                    <motion.div
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        className="fixed bottom-6 inset-x-0 px-4 z-40 pointer-events-none"
                    >
                        <div className="container mx-auto max-w-lg pointer-events-auto">
                            <button
                                onClick={() => setShowCart(true)}
                                className="w-full bg-accent text-dark p-4 rounded-xl shadow-2xl flex justify-between items-center font-bold"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-dark/20 w-8 h-8 rounded-full flex items-center justify-center text-sm">
                                        {cart.length}
                                    </div>
                                    <span>Ver pedido</span>
                                </div>
                                <span>${cartTotalUSDT.toFixed(2)}</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cart Sidebar/Modal */}
            <AnimatePresence>
                {showCart && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                            onClick={() => setShowCart(false)}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            className="fixed inset-y-0 right-0 w-full max-w-md bg-dark border-l border-white/10 z-50 flex flex-col"
                        >
                            <div className="p-6 border-b border-white/10 flex justify-between items-center">
                                <h2 className="text-xl font-bold">Tu Pedido</h2>
                                <button onClick={() => setShowCart(false)} className="text-white/60 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {cart.map((item, idx) => (
                                    <div key={`${item.product.id}-${idx}`} className="flex gap-4">
                                        <img
                                            src={item.product.image_url}
                                            className="w-16 h-16 rounded-lg object-cover bg-white/5"
                                        />
                                        <div className="flex-1">
                                            <div className="flex justify-between mb-1">
                                                <h4 className="font-medium">{item.product.name}</h4>
                                                <span className="text-white/80">${(item.product.price_usdt * item.quantity).toFixed(2)}</span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-2">
                                                <button
                                                    onClick={() => updateQuantity(item.product.id, -1)}
                                                    className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <span className="text-sm">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.product.id, 1)}
                                                    className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 border-t border-white/10 bg-white/5">
                                <div className="space-y-2 mb-4 text-sm">
                                    <div className="flex justify-between text-white/60">
                                        <span>Subtotal</span>
                                        <span>${cartTotalUSDT.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-white/60">
                                        <span>Delivery</span>
                                        <span>$0.00</span>
                                    </div>
                                    <div className="flex justify-between text-xl font-bold text-accent pt-2 border-t border-white/10">
                                        <span>Total</span>
                                        <span>${cartTotalUSDT.toFixed(2)}</span>
                                    </div>
                                </div>

                                <button
                                    className="w-full btn-primary py-4 text-lg flex justify-between items-center px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={() => setPaymentModalOpen(true)}
                                    disabled={cart.length === 0 || createOrderMutation.isLoading}
                                >
                                    <span>{createOrderMutation.isLoading ? 'Procesando...' : 'Pagar'}</span>
                                    <ChevronRight />
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
            {paymentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-dark border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <CreditCard size={20} />
                                Confirmar pago
                            </h2>
                            <button
                                onClick={() => setPaymentModalOpen(false)}
                                className="text-white/60 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-2 mb-4 text-sm">
                            <div className="flex justify-between">
                                <span className="text-white/60">Total a pagar</span>
                                <span className="font-bold">${cartTotalUSDT.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-white/60">
                                <span>
                                    ≈ {totalBs.toLocaleString('es-VE', {
                                        style: 'currency',
                                        currency: 'VES'
                                    })}
                                </span>
                                <span>≈ {totalFires.toFixed(0)} 🔥</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs text-white/60 mb-1">Efectivo (USDT)</label>
                                <div className="relative">
                                    <Banknote className="absolute left-3 top-2.5 text-green-400" size={18} />
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full bg-white/5 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                                        value={payments.cash_usdt}
                                        onChange={(e) => setPayments({ ...payments, cash_usdt: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-white/60 mb-1">Zelle / Transf. (USDT)</label>
                                <div className="relative">
                                    <CreditCard className="absolute left-3 top-2.5 text-accent" size={18} />
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full bg-white/5 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                                        value={payments.zelle}
                                        onChange={(e) => setPayments({ ...payments, zelle: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-white/60 mb-1">Pago en Bs</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-white/60 text-xs">Bs</span>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full bg-white/5 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                                        value={payments.bs}
                                        onChange={(e) => setPayments({ ...payments, bs: e.target.value })}
                                    />
                                </div>
                                <div className="text-[11px] text-white/40 mt-1">
                                    Tasa referencial: 1 USDT ≈ {rates.bs.toFixed(2)} Bs
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-white/60 mb-1">Pago con Fuegos</label>
                                <div className="relative">
                                    <Flame className="absolute left-3 top-2.5 text-fire-orange" size={18} />
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full bg-white/5 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                                        value={payments.fires}
                                        onChange={(e) => setPayments({ ...payments, fires: e.target.value })}
                                    />
                                </div>
                                <div className="text-[11px] text-white/40 mt-1">
                                    1 USDT ≈ {rates.fires.toFixed(0)} 🔥
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/5 rounded-lg p-3 mb-4 text-xs space-y-1">
                            <div className="flex justify-between">
                                <span className="text-white/60">Pagado</span>
                                <span className="font-semibold">${totalPaidUSDT.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/60">Falta por pagar</span>
                                <span className={remainingUSDT > 0 ? 'text-orange-400 font-semibold' : 'text-white/60'}>
                                    ${remainingUSDT.toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/60">Cambio estimado</span>
                                <span className={changeUSDT > 0 ? 'text-emerald-400 font-semibold' : 'text-white/60'}>
                                    ${changeUSDT.toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mb-4 text-xs">
                            <input
                                id="give-change-fires"
                                type="checkbox"
                                className="w-4 h-4"
                                checked={giveChangeInFires}
                                onChange={(e) => setGiveChangeInFires(e.target.checked)}
                                disabled={changeUSDT <= 0 || !user}
                            />
                            <label htmlFor="give-change-fires" className="flex-1 text-white/70 flex items-center gap-1">
                                <Flame size={14} className="text-fire-orange" />
                                Convertir el cambio ({changeFires.toFixed(0)} 🔥) en Fuegos para mi billetera
                            </label>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setPaymentModalOpen(false)}
                                className="flex-1 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleCheckout}
                                disabled={!isPaid || createOrderMutation.isLoading}
                                className="flex-1 py-3 rounded-lg bg-accent text-dark font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {createOrderMutation.isLoading ? 'Enviando...' : 'Confirmar pedido'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StoreFront;
