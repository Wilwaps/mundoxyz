import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Search, Trash2, CreditCard, Banknote, Flame, CheckCircle, RefreshCw } from 'lucide-react';
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

    // Exchange Rates (Mock for now, should fetch from API)
    const rates = {
        bs: 38.5, // 1 USDT = 38.5 BS
        fires: 10 // 1 USDT = 10 Fires
    };

    // Fetch Store & Products
    const { data: storeData } = useQuery({
        queryKey: ['store-pos', slug],
        queryFn: async () => {
            const response = await axios.get(`/api/store/public/${slug}`);
            return response.data;
        }
    });

    const createOrderMutation = useMutation({
        mutationFn: async (orderData) => {
            return axios.post('/api/store/order/create', orderData);
        },
        onSuccess: () => {
            toast.success('Orden creada exitosamente');
            setCart([]);
            setPaymentModalOpen(false);
            setPayments({ cash_usdt: 0, zelle: 0, bs: 0, fires: 0 });
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

    const handleCheckout = () => {
        if (!isPaid) return toast.error('Falta completar el pago');

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
            table_number: 'POS-1'
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
        <div className="flex h-screen bg-dark text-white overflow-hidden">
            {/* Left: Product Catalog */}
            <div className="flex-1 flex flex-col border-r border-white/10">
                {/* Header / Search */}
                <div className="p-4 border-b border-white/10 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 text-white/40" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar producto..."
                            className="w-full bg-white/5 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-accent"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto max-w-md no-scrollbar">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`px-4 py-2 rounded-lg whitespace-nowrap ${selectedCategory === 'all' ? 'bg-accent text-dark' : 'bg-white/5'}`}
                        >
                            Todos
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-4 py-2 rounded-lg whitespace-nowrap ${selectedCategory === cat.id ? 'bg-accent text-dark' : 'bg-white/5'}`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredProducts.map(product => (
                            <button
                                key={product.id}
                                onClick={() => addToCart(product)}
                                className="bg-white/5 p-4 rounded-xl hover:bg-white/10 transition-colors text-left flex flex-col h-32 justify-between group"
                            >
                                <span className="font-medium line-clamp-2">{product.name}</span>
                                <span className="text-accent font-bold">${product.price_usdt}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right: Cart & Payment */}
            <div className="w-96 flex flex-col bg-dark-lighter">
                <div className="p-4 border-b border-white/10 font-bold text-lg">
                    Orden Actual
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
                    <div className="flex justify-between text-xl font-bold mb-4">
                        <span>Total</span>
                        <span className="text-accent">${totalUSDT.toFixed(2)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-4 text-xs text-white/60">
                        <div>BS: {(totalUSDT * rates.bs).toFixed(2)}</div>
                        <div>Fires: {(totalUSDT * rates.fires).toFixed(0)}</div>
                    </div>

                    <button
                        onClick={() => setPaymentModalOpen(true)}
                        disabled={cart.length === 0}
                        className="w-full btn-primary py-4 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cobrar
                    </button>
                </div>
            </div>

            {/* Payment Modal */}
            {paymentModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-dark border border-white/10 p-6 rounded-2xl w-full max-w-2xl shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6">Procesar Pago</h2>

                        <div className="grid grid-cols-2 gap-8">
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
                                    <div className="flex justify-between mb-2">
                                        <span>Total a Pagar</span>
                                        <span className="font-bold">${totalUSDT.toFixed(2)}</span>
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
