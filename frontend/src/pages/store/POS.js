import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Search, Trash2, CreditCard, Banknote, Flame, CheckCircle, RefreshCw, User, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

const POS = () => {
    const { slug } = useParams(); // 'divorare04'
    const [cart, setCart] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);

    // Payment State
    const [payments, setPayments] = useState({
        cash_usdt: 0,
        zelle: 0,
        bs: 0,
        fires: 0
    });

    // Cliente POS (simple CRM local)
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [recentCustomers, setRecentCustomers] = useState([]);

    // Fetch Store & Products
    const { data: storeData } = useQuery({
        queryKey: ['store-pos', slug],
        queryFn: async () => {
            const response = await axios.get(`/api/store/public/${slug}`);
            return response.data;
        }
    });

    // Fetch FIAT context for dynamic rates (USDT -> Bs, USDT -> Fires)
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
        bs: bsRate, // 1 USDT = bsRate Bs
        fires: firesRate // 1 USDT = firesRate Fires
    };

    const createOrderMutation = useMutation({
        mutationFn: async (orderData) => {
            return axios.post('/api/store/order/create', orderData);
        },
        onSuccess: () => {
            toast.success('Orden creada exitosamente');
            setCart([]);
            setPaymentModalOpen(false);
            setPayments({ cash_usdt: 0, zelle: 0, bs: 0, fires: 0 });

            // Guardar cliente en recientes (solo si tiene algún dato)
            setRecentCustomers((prev) => {
                const name = customerName.trim();
                const phone = customerPhone.trim();

                if (!name && !phone) return prev;

                const existingIndex = prev.findIndex(
                    (c) => c.name === name && c.phone === phone
                );

                let next = prev;
                if (existingIndex !== -1) {
                    const existing = prev[existingIndex];
                    next = [existing, ...prev.filter((_, idx) => idx !== existingIndex)];
                } else {
                    const entry = { name, phone };
                    next = [entry, ...prev].slice(0, 20);
                }

                try {
                    localStorage.setItem('pos_recent_customers', JSON.stringify(next));
                } catch {
                    // ignore
                }

                return next;
            });

            setCustomerName('');
            setCustomerPhone('');
            setCustomerSearch('');
        },
        onError: (err) => toast.error('Error al crear orden')
    });

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(p => p.id === product.id);
            if (existing) {
                return prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const totalUSDT = cart.reduce((sum, item) => sum + (parseFloat(item.price_usdt) * item.quantity), 0);
    const totalPaidUSDT =
        parseFloat(payments.cash_usdt) +
        parseFloat(payments.zelle) +
        (parseFloat(payments.bs) / rates.bs) +
        (parseFloat(payments.fires) / rates.fires);

    const remainingUSDT = Math.max(0, totalUSDT - totalPaidUSDT);
    const isPaid = totalPaidUSDT >= totalUSDT - 0.01; // Tolerance

    const totalBs = totalUSDT * rates.bs;
    const totalFires = totalUSDT * rates.fires;

    useEffect(() => {
        try {
            const raw = localStorage.getItem('pos_recent_customers');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    setRecentCustomers(parsed);
                }
            }
        } catch {
            // ignore
        }
    }, []);

    const handleCheckout = () => {
        if (!isPaid) return toast.error('Falta completar el pago');

        const customerInfo = (customerName || customerPhone)
            ? {
                customer: {
                    name: customerName || null,
                    phone: customerPhone || null
                }
            }
            : null;

        const orderData = {
            store_id: storeData.store.id,
            items: cart.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
                modifiers: [] // TODO: Add modifier support in POS
            })),
            type: 'dine_in', // Default
            payment_method: payments,
            currency_snapshot: rates,
            table_number: 'POS-1',
            delivery_info: customerInfo
        };

        createOrderMutation.mutate(orderData);
    };

    if (!storeData) return <div className="p-10">Cargando POS...</div>;

    const { products, categories } = storeData;
    const filteredProducts = products.filter(p =>
        (selectedCategory === 'all' || p.category_id === selectedCategory) &&
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col lg:flex-row min-h-screen bg-dark text-white">
            {/* Left: Product Catalog */}
            <div className="flex-1 flex flex-col lg:border-r border-white/10">
                {/* Header / Search */}
                <div className="px-3 py-2 md:p-4 border-b border-white/10 flex flex-col md:flex-row gap-2 md:gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-white/40" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar producto..."
                            className="w-full bg-white/5 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto mt-1 md:mt-0 md:max-w-md no-scrollbar text-xs">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`px-3 py-1.5 rounded-full whitespace-nowrap ${selectedCategory === 'all' ? 'bg-accent text-dark' : 'bg-white/5'}`}
                        >
                            Todos
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-3 py-1.5 rounded-full whitespace-nowrap ${selectedCategory === cat.id ? 'bg-accent text-dark' : 'bg-white/5'}`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto px-3 py-3 md:p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
                        {filteredProducts.map(product => (
                            <button
                                key={product.id}
                                onClick={() => addToCart(product)}
                                className="bg-white/5 rounded-lg hover:bg-white/10 transition-colors text-left flex flex-col justify-between px-2.5 py-2.5 sm:px-3 sm:py-3 min-h-[84px]"
                            >
                                <span className="font-medium text-xs sm:text-sm line-clamp-2">{product.name}</span>
                                <span className="text-accent font-bold text-xs sm:text-sm">${product.price_usdt}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right: Cart, Customer & Payment */}
            <div className="w-full lg:w-96 flex flex-col bg-dark-lighter border-t border-white/10 lg:border-t-0">
                <div className="p-4 border-b border-white/10 font-bold text-base md:text-lg">
                    Orden Actual
                </div>

                {/* Cliente */}
                <div className="p-4 border-b border-white/10 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold flex items-center gap-2">
                            <User size={16} /> Cliente
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                setCustomerName('');
                                setCustomerPhone('');
                                setCustomerSearch('');
                            }}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white/5 hover:bg-white/10"
                        >
                            <UserPlus size={14} /> Nuevo cliente
                        </button>
                    </div>

                    <div className="space-y-2">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Buscar en clientes recientes..."
                                className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                            />
                            {customerSearch && (
                                <div className="absolute left-0 right-0 mt-1 bg-dark border border-white/10 rounded-lg shadow-lg max-h-40 overflow-y-auto z-50 text-xs">
                                    {recentCustomers
                                        .filter((c) => {
                                            const q = customerSearch.toLowerCase();
                                            return (
                                                (c.name || '').toLowerCase().includes(q) ||
                                                (c.phone || '').toLowerCase().includes(q)
                                            );
                                        })
                                        .slice(0, 5)
                                        .map((c, idx) => (
                                            <button
                                                key={`${c.name}-${c.phone}-${idx}`}
                                                type="button"
                                                onClick={() => {
                                                    setCustomerName(c.name || '');
                                                    setCustomerPhone(c.phone || '');
                                                    setCustomerSearch('');
                                                }}
                                                className="w-full flex flex-col items-start px-3 py-2 hover:bg-white/5 text-left"
                                            >
                                                <span className="font-medium">{c.name || 'Sin nombre'}</span>
                                                {c.phone && (
                                                    <span className="text-white/60">{c.phone}</span>
                                                )}
                                            </button>
                                        ))}
                                    {recentCustomers.length === 0 && (
                                        <div className="px-3 py-2 text-white/50">
                                            Aún no hay clientes recientes
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <input
                                type="text"
                                placeholder="Nombre del cliente"
                                className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Teléfono / referencia"
                                className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {cart.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center text-accent font-bold">
                                    {item.quantity}
                                </div>
                                <div>
                                    <div className="font-medium">{item.name}</div>
                                    <div className="text-xs text-white/60">${item.price_usdt} c/u</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold">${(item.price_usdt * item.quantity).toFixed(2)}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-white/5 border-t border-white/10">
                    <div className="mb-4">
                        <div className="text-xs text-white/60">Total a cobrar</div>
                        <div className="text-2xl font-bold text-accent">
                            {totalBs.toLocaleString('es-VE', {
                                style: 'currency',
                                currency: 'VES'
                            })}
                        </div>
                        <div className="text-xs text-white/60 mt-1">
                            ≈ {totalUSDT.toFixed(2)} USDT • {totalFires.toFixed(0)} Fires
                        </div>
                    </div>

                    <button
                        onClick={() => setPaymentModalOpen(true)}
                        disabled={cart.length === 0}
                        className="w-full btn-primary py-4 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Pagar
                    </button>
                </div>
            </div>

            {/* Payment Modal */}
            {paymentModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-dark border border-white/10 p-6 rounded-2xl w-full max-w-2xl shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6">Procesar Pago</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-white/60 mb-1">Efectivo (USDT)</label>
                                    <div className="relative">
                                        <Banknote className="absolute left-3 top-3 text-green-500" size={20} />
                                        <input
                                            type="number"
                                            className="w-full bg-white/5 rounded-lg pl-10 p-3"
                                            value={payments.cash_usdt}
                                            onChange={e => setPayments({ ...payments, cash_usdt: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-white/60 mb-1">Zelle / Transf.</label>
                                    <div className="relative">
                                        <CreditCard className="absolute left-3 top-3 text-blue-500" size={20} />
                                        <input
                                            type="number"
                                            className="w-full bg-white/5 rounded-lg pl-10 p-3"
                                            value={payments.zelle}
                                            onChange={e => setPayments({ ...payments, zelle: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-white/60 mb-1">Bolívares (Tasa: {rates.bs})</label>
                                    <div className="relative">
                                        <RefreshCw className="absolute left-3 top-3 text-yellow-500" size={20} />
                                        <input
                                            type="number"
                                            className="w-full bg-white/5 rounded-lg pl-10 p-3"
                                            value={payments.bs}
                                            onChange={e => setPayments({ ...payments, bs: e.target.value })}
                                        />
                                        <div className="absolute right-3 top-3 text-xs text-white/40">
                                            = ${(payments.bs / rates.bs).toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-white/60 mb-1">Fires (Tasa: {rates.fires})</label>
                                    <div className="relative">
                                        <Flame className="absolute left-3 top-3 text-orange-500" size={20} />
                                        <input
                                            type="number"
                                            className="w-full bg-white/5 rounded-lg pl-10 p-3"
                                            value={payments.fires}
                                            onChange={e => setPayments({ ...payments, fires: e.target.value })}
                                        />
                                        <div className="absolute right-3 top-3 text-xs text-white/40">
                                            = ${(payments.fires / rates.fires).toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/5 p-6 rounded-xl flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span>Total a Pagar</span>
                                        <span className="font-bold">${totalUSDT.toFixed(2)}</span>
                                    </div>
                                    <div className="text-xs text-white/60 text-right mb-2">
                                        {totalBs.toLocaleString('es-VE', {
                                            style: 'currency',
                                            currency: 'VES'
                                        })}{' '}
                                        • {totalFires.toFixed(0)} Fires
                                    </div>
                                    <div className="flex justify-between mb-2 text-success">
                                        <span>Pagado</span>
                                        <span className="font-bold">${totalPaidUSDT.toFixed(2)}</span>
                                    </div>
                                    <div className="h-px bg-white/10 my-4"></div>
                                    <div className="flex justify-between text-xl font-bold">
                                        <span>Restante</span>
                                        <span className={remainingUSDT > 0 ? 'text-red-400' : 'text-green-400'}>
                                            ${remainingUSDT.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-4 mt-8">
                                    <button
                                        onClick={() => setPaymentModalOpen(false)}
                                        className="flex-1 btn-secondary"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleCheckout}
                                        disabled={!isPaid}
                                        className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Confirmar Pago
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default POS;
