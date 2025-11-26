import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle, ChefHat, AlertCircle } from 'lucide-react';
import { useSocket } from '../../contexts/SocketContext';
import toast from 'react-hot-toast';

const KitchenDisplay = () => {
    const { slug } = useParams();
    const queryClient = useQueryClient();
    const { socket } = useSocket();
    const [storeId, setStoreId] = useState(null);

    // Fetch Store ID first
    const { data: storeData } = useQuery({
        queryKey: ['store-kds-meta', slug],
        queryFn: async () => {
            const res = await axios.get(`/api/store/public/${slug}`);
            setStoreId(res.data.store.id);
            return res.data;
        }
    });

    // Check if restaurant mode is enabled
    const storeSettingsRaw = storeData?.store?.settings || {};
    const rawTablesCount = storeSettingsRaw.tables_count ?? storeSettingsRaw.tablesCount ?? 0;
    let tablesCount = parseInt(rawTablesCount, 10);
    if (!Number.isFinite(tablesCount) || tablesCount < 0) {
        tablesCount = 0;
    }
    const isRestaurantMode = tablesCount > 0;

    // Fetch Active Orders
    const { data: orders = [] } = useQuery({
        queryKey: ['kds-orders', storeId],
        queryFn: async () => {
            if (!storeId) return [];
            const res = await axios.get(`/api/store/${storeId}/orders/active`);
            return res.data;
        },
        enabled: !!storeId,
        refetchInterval: 10000 // Fallback polling
    });

    // Socket Listeners
    useEffect(() => {
        if (!socket || !storeId) return;

        socket.emit('join-room', `store:${storeId}:kitchen`); // Assuming generic join logic or specific

        socket.on('store:new-order', (data) => {
            toast.success('¡Nueva Orden!', { icon: '🔔' });
            queryClient.invalidateQueries(['kds-orders']);
        });

        return () => {
            socket.off('store:new-order');
        };
    }, [socket, storeId, queryClient]);

    // Update Status Mutation
    const updateStatusMutation = useMutation({
        mutationFn: async ({ orderId, status }) => {
            return axios.post(`/api/store/order/${orderId}/status`, { status });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['kds-orders']);
        }
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'border-l-4 border-red-500 bg-red-500/10';
            case 'confirmed': return 'border-l-4 border-yellow-500 bg-yellow-500/10';
            case 'preparing': return 'border-l-4 border-blue-500 bg-blue-500/10';
            case 'ready': return 'border-l-4 border-green-500 bg-green-500/10';
            default: return 'bg-white/5';
        }
    };

    const getElapsedTime = (dateString) => {
        const start = new Date(dateString).getTime();
        const now = new Date().getTime();
        const diff = Math.floor((now - start) / 60000); // minutes
        return diff;
    };

    if (!storeData) return <div className="p-10">Cargando KDS...</div>;

    if (!isRestaurantMode) {
        return (
            <div className="min-h-screen bg-dark flex items-center justify-center">
                <div className="text-center">
                    <ChefHat className="text-6xl text-gray-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-400 mb-2">KDS No Disponible</h2>
                    <p className="text-gray-500">Esta tienda no está configurada en modo restaurante.</p>
                    <p className="text-gray-500 text-sm mt-2">Configura mesas en el panel de administración para activar el KDS.</p>
                </div>
            </div>
        );
    }

    const pendingOrders = orders.filter(o => ['pending', 'confirmed'].includes(o.status));
    const preparingOrders = orders.filter(o => o.status === 'preparing');
    const readyOrders = orders.filter(o => o.status === 'ready');

    const OrderCard = ({ order }) => {
        const elapsed = getElapsedTime(order.created_at);
        const isLate = elapsed > 20;

        return (
            <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`p-4 rounded-lg mb-4 ${getStatusColor(order.status)} relative overflow-hidden`}
            >
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="font-bold text-lg">#{order.code}</h3>
                        <span className="text-sm text-white/60">{order.type === 'delivery' ? '🛵 Delivery' : `Mesa ${order.table_number}`}</span>
                    </div>
                    <div className={`flex items-center gap-1 font-mono font-bold ${isLate ? 'text-red-400 animate-pulse' : 'text-white/60'}`}>
                        <Clock size={16} />
                        {elapsed}m
                    </div>
                </div>

                <div className="space-y-2 mb-4">
                    {order.items.map((item, idx) => (
                        <div key={idx} className="flex gap-2 text-sm">
                            <span className="font-bold w-6 text-right">{item.quantity}x</span>
                            <div className="flex-1">
                                <span>{item.name}</span>
                                {item.modifiers && item.modifiers.length > 0 && (
                                    <div className="text-xs text-white/50 pl-2">
                                        {item.modifiers.map(m => m.name).join(', ')}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2 mt-2">
                    {(order.status === 'pending' || order.status === 'confirmed') && (
                        <button
                            onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: 'preparing' })}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded font-bold text-sm flex items-center justify-center gap-2"
                        >
                            <ChefHat size={16} /> Cocinar
                        </button>
                    )}
                    {order.status === 'preparing' && (
                        <button
                            onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: 'ready' })}
                            className="flex-1 bg-green-600 hover:bg-green-500 py-2 rounded font-bold text-sm flex items-center justify-center gap-2"
                        >
                            <CheckCircle size={16} /> Listo
                        </button>
                    )}
                    {order.status === 'ready' && (
                        <button
                            onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: 'completed' })}
                            className="flex-1 bg-white/10 hover:bg-white/20 py-2 rounded font-bold text-sm"
                        >
                            Entregado
                        </button>
                    )}
                </div>
            </motion.div>
        );
    };

    return (
        <div className="min-h-screen bg-dark p-4 flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-3">
                    <ChefHat className="text-accent" />
                    KDS - {storeData.store.name}
                </h1>
                <div className="flex gap-4 text-sm font-mono">
                    <div className="bg-white/5 px-3 py-1 rounded">Pendientes: {pendingOrders.length}</div>
                    <div className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded">En Cocina: {preparingOrders.length}</div>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden">
                {/* Column 1: Pending */}
                <div className="bg-white/5 rounded-xl p-4 flex flex-col">
                    <h2 className="text-xl font-bold mb-4 text-red-400 flex items-center gap-2">
                        <AlertCircle size={20} /> Pendientes
                    </h2>
                    <div className="flex-1 overflow-y-auto pr-2">
                        <AnimatePresence>
                            {pendingOrders.map(order => <OrderCard key={order.id} order={order} />)}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Column 2: Preparing */}
                <div className="bg-white/5 rounded-xl p-4 flex flex-col">
                    <h2 className="text-xl font-bold mb-4 text-blue-400 flex items-center gap-2">
                        <ChefHat size={20} /> Preparando
                    </h2>
                    <div className="flex-1 overflow-y-auto pr-2">
                        <AnimatePresence>
                            {preparingOrders.map(order => <OrderCard key={order.id} order={order} />)}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Column 3: Ready */}
                <div className="bg-white/5 rounded-xl p-4 flex flex-col">
                    <h2 className="text-xl font-bold mb-4 text-green-400 flex items-center gap-2">
                        <CheckCircle size={20} /> Listos
                    </h2>
                    <div className="flex-1 overflow-y-auto pr-2">
                        <AnimatePresence>
                            {readyOrders.map(order => <OrderCard key={order.id} order={order} />)}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KitchenDisplay;
