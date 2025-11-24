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
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false);

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

    const changeItemQuantity = (productId, delta) => {
        setCart(prev => {
            return prev
                .map(item => {
                    if (item.id !== productId) return item;
                    const current = Number(item.quantity) || 0;
                    const next = Math.max(0, current + delta);
                    return { ...item, quantity: next };
                })
                .filter(item => (Number(item.quantity) || 0) > 0);
        });
    };

    const setItemQuantityDirect = (productId, value) => {
        setCart(prev => {
            const parsed = parseInt(value, 10);
            if (!Number.isFinite(parsed) || parsed <= 0) {
                // Si borran o ponen 0, remover el ítem
                return prev.filter(item => item.id !== productId);
            }
            return prev.map(item =>
                item.id === productId
                    ? { ...item, quantity: parsed }
                    : item
            );
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
            delivery_info: customerInfo,
            customer_id: selectedCustomer?.id || null
        };

        createOrderMutation.mutate(orderData);
    };

    const storeId = storeData?.store?.id;

    // Remote search of customers by CI / nombre / correo
    const { data: customerSearchResults = [] } = useQuery({
        queryKey: ['pos-customers-search', storeId, customerSearch],
        enabled: !!storeId && customerSearch.trim().length >= 2,
        queryFn: async () => {
            const response = await axios.get(`/api/store/${storeId}/customers/search`, {
                params: { q: customerSearch.trim() }
            });
            return response.data || [];
        }
    });

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
                        {filteredProducts.map(product => {
                            const priceUsdt = Number(product.price_usdt || 0);
                            const priceBs = priceUsdt * rates.bs;
                            return (
                                <button
                                    key={product.id}
                                    onClick={() => addToCart(product)}
                                    className="bg-white/5 rounded-lg hover:bg-white/10 transition-colors text-left flex flex-col justify-between px-2.5 py-2.5 sm:px-3 sm:py-3 min-h-[84px]"
                                >
                                    <span className="font-medium text-xs sm:text-sm line-clamp-2">{product.name}</span>
                                    <div className="mt-1 flex flex-col gap-0.5">
                                        <span className="text-accent font-bold text-xs sm:text-sm">${priceUsdt.toFixed(2)}</span>
                                        <span className="text-[10px] sm:text-xs text-white/60">
                                            {priceBs.toLocaleString('es-VE', {
                                                style: 'currency',
                                                currency: 'VES'
                                            })}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
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
                                setSelectedCustomer(null);
                                setCustomerName('');
                                setCustomerPhone('');
                                setCustomerSearch('');
                                setNewCustomerModalOpen(true);
                            }}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white/5 hover:bg-white/10"
                        >
                            <UserPlus size={14} /> Nuevo cliente
                        </button>
                    </div>

                    <div className="space-y-2">
                        {selectedCustomer && (
                            <div className="text-[11px] text-white/70 flex flex-wrap gap-1">
                                <span className="font-semibold">Seleccionado:</span>
                                <span>{selectedCustomer.full_name || selectedCustomer.ci_full}</span>
                                {selectedCustomer.ci_full && (
                                    <span className="text-white/50">({selectedCustomer.ci_full})</span>
                                )}
                            </div>
                        )}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Buscar cliente (CI, nombre o correo)..."
                                className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                            />
                            {customerSearch && (
                                <div className="absolute left-0 right-0 mt-1 bg-dark border border-white/10 rounded-lg shadow-lg max-h-40 overflow-y-auto z-50 text-xs">
                                    {customerSearchResults && customerSearchResults.length > 0 ? (
                                        customerSearchResults.map((c) => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedCustomer(c);
                                                    setCustomerName(c.full_name || '');
                                                    setCustomerPhone(c.phone || '');
                                                    setCustomerSearch('');
                                                }}
                                                className="w-full flex flex-col items-start px-3 py-2 hover:bg-white/5 text-left"
                                            >
                                                <span className="font-medium">{c.full_name || c.ci_full || 'Sin nombre'}</span>
                                                <span className="text-white/60">
                                                    {c.ci_full}
                                                    {c.phone ? ` • ${c.phone}` : ''}
                                                </span>
                                                {c.email && (
                                                    <span className="text-white/40 truncate max-w-full">{c.email}</span>
                                                )}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-3 py-2 text-white/50">
                                            {customerSearch.trim().length < 2
                                                ? 'Escribe al menos 2 caracteres'
                                                : 'Sin resultados'}
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
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center text-accent font-bold text-sm">
                                    {item.quantity}
                                </div>
                                <div className="min-w-0">
                                    <div className="font-medium truncate max-w-[140px] sm:max-w-[200px]">{item.name}</div>
                                    <div className="text-xs text-white/60">${Number(item.price_usdt || 0).toFixed(2)} c/u</div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => changeItemQuantity(item.id, -1)}
                                        className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs hover:bg-white/20"
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => setItemQuantityDirect(item.id, e.target.value)}
                                        className="w-12 text-center bg-white/5 rounded-md text-xs py-1 focus:outline-none focus:ring-1 focus:ring-accent"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => changeItemQuantity(item.id, 1)}
                                        className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs hover:bg-white/20"
                                    >
                                        +
                                    </button>
                                </div>
                                <div className="font-bold text-sm">
                                    ${
                                        (Number(item.price_usdt || 0) * (Number(item.quantity) || 0))
                                            .toFixed(2)
                                    }
                                </div>
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

            {newCustomerModalOpen && storeData?.store?.id && (
                <NewCustomerModal
                    storeId={storeData.store.id}
                    isOpen={newCustomerModalOpen}
                    onClose={() => setNewCustomerModalOpen(false)}
                    onCreated={(customer) => {
                        setSelectedCustomer(customer);
                        setCustomerName(customer.full_name || '');
                        setCustomerPhone(customer.phone || '');
                        setNewCustomerModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

const NewCustomerModal = ({ storeId, isOpen, onClose, onCreated }) => {
    const [ciPrefix, setCiPrefix] = useState('V');
    const [ciNumber, setCiNumber] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleClose = () => {
        if (loading) return;
        setError('');
        setCiPrefix('V');
        setCiNumber('');
        setFullName('');
        setPhone('');
        setEmail('');
        onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const trimmedNumber = ciNumber.replace(/[^0-9]/g, '');
        if (!['V', 'E', 'J'].includes(ciPrefix)) {
            setError('Selecciona un tipo de documento válido (V/E/J).');
            return;
        }
        if (!trimmedNumber) {
            setError('Número de CI obligatorio.');
            return;
        }
        if (!fullName.trim()) {
            setError('El nombre completo es obligatorio.');
            return;
        }
        if (!phone.trim()) {
            setError('El teléfono es obligatorio.');
            return;
        }

        try {
            setLoading(true);
            const payload = {
                ci_prefix: ciPrefix,
                ci_number: trimmedNumber,
                full_name: fullName.trim(),
                phone: phone.trim(),
                email: email.trim() || null
            };

            const response = await axios.post(`/api/store/${storeId}/customers`, payload);
            if (onCreated) {
                onCreated(response.data);
            }
            toast.success('Cliente creado correctamente');
        } catch (err) {
            setError(err.response?.data?.error || 'Error al crear cliente');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-dark border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <UserPlus size={18} /> Nuevo cliente POS
                    </h2>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="text-white/60 hover:text-white text-sm px-2 py-1 rounded-lg hover:bg-white/10"
                    >
                        Cerrar
                    </button>
                </div>

                {error && (
                    <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3 text-xs">
                    <div className="flex gap-2">
                        <div className="w-20">
                            <label className="block mb-1 text-white/70">Tipo</label>
                            <select
                                value={ciPrefix}
                                onChange={(e) => setCiPrefix(e.target.value)}
                                className="w-full bg-white/5 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
                            >
                                <option value="V">V</option>
                                <option value="E">E</option>
                                <option value="J">J</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block mb-1 text-white/70">Número de CI</label>
                            <input
                                type="tel"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={ciNumber}
                                onChange={(e) => setCiNumber(e.target.value)}
                                className="w-full bg-white/5 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
                                placeholder="20827954"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block mb-1 text-white/70">Nombre completo</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full bg-white/5 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
                            placeholder="Nombre y apellido"
                        />
                    </div>

                    <div>
                        <label className="block mb-1 text-white/70">Teléfono</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-white/5 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
                            placeholder="Ej: +58 414 ..."
                        />
                    </div>

                    <div>
                        <label className="block mb-1 text-white/70">Correo (opcional)</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-white/5 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
                            placeholder="ana@correo.com"
                        />
                    </div>

                    <div className="pt-2 flex gap-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={loading}
                            className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2 rounded-lg bg-accent text-dark font-semibold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Guardando...' : 'Guardar cliente'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default POS;
