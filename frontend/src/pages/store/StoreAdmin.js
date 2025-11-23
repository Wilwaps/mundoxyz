import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
    LayoutDashboard,
    ShoppingBag,
    ChefHat,
    ClipboardList,
    Package,
    Settings,
    Store,
    LogOut
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import StoreFront from './StoreFront';
import POS from './POS';
import KitchenDisplay from './KitchenDisplay';

// Placeholder components for now
const StoreOrders = () => <div className="p-4 text-center">Módulo de Pedidos (Próximamente)</div>;
const StoreInventory = () => <div className="p-4 text-center">Módulo de Inventario (Próximamente)</div>;
const StoreSettings = () => <div className="p-4 text-center">Configuración de Tienda (Próximamente)</div>;

const StoreAdmin = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('dashboard');

    // Fetch store details and user role
    const { data: storeData, isLoading, error } = useQuery({
        queryKey: ['store-admin-data', slug],
        queryFn: async () => {
            // We need to fetch store ID from slug first, or use a specific endpoint
            // For now, let's assume we fetch public info + verify staff role
            const publicRes = await axios.get(`/api/store/public/${slug}`);
            const store = publicRes.data.store;

            // Verify staff role
            const staffRes = await axios.get(`/api/admin/store-staff/user/${user.id}`);
            const myStaffEntry = staffRes.data.find(s => s.store_id === store.id);

            if (!myStaffEntry && !user.roles.includes('admin') && !user.roles.includes('tote')) {
                throw new Error('Unauthorized');
            }

            return {
                store,
                role: myStaffEntry?.role || (user.roles.includes('admin') ? 'owner' : null)
            };
        },
        retry: false
    });

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="spinner"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <h2 className="text-2xl font-bold text-error mb-2">Acceso Denegado</h2>
                <p className="text-text/60 mb-4">No tienes permisos para administrar esta tienda.</p>
                <button onClick={() => navigate('/profile')} className="btn-primary">
                    Volver al Perfil
                </button>
            </div>
        );
    }

    const { store, role } = storeData;

    // Define tabs based on role
    const tabs = [
        { id: 'dashboard', label: 'Panel', icon: LayoutDashboard, roles: ['owner', 'admin', 'manager'] },
        { id: 'pos', label: 'Caja (POS)', icon: ShoppingBag, roles: ['owner', 'admin', 'manager', 'seller'] },
        { id: 'kds', label: 'Cocina', icon: ChefHat, roles: ['owner', 'admin', 'manager'] },
        { id: 'orders', label: 'Pedidos', icon: ClipboardList, roles: ['owner', 'admin', 'manager', 'seller', 'marketing'] },
        { id: 'inventory', label: 'Inventario', icon: Package, roles: ['owner', 'admin', 'manager'] },
        { id: 'settings', label: 'Ajustes', icon: Settings, roles: ['owner', 'admin'] },
    ];

    const allowedTabs = tabs.filter(tab => tab.roles.includes(role));

    return (
        <div className="min-h-screen pb-20 bg-background">
            {/* Header */}
            <header className="bg-card border-b border-glass p-4 sticky top-0 z-20">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                            {store.logo_url ? (
                                <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover rounded-lg" />
                            ) : (
                                <Store className="text-accent" />
                            )}
                        </div>
                        <div>
                            <h1 className="font-bold text-lg leading-tight">{store.name}</h1>
                            <div className="text-xs text-text/60 flex items-center gap-1">
                                <span className="capitalize">{role}</span> • {store.slug}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/profile')}
                        className="p-2 hover:bg-glass rounded-full transition-colors"
                    >
                        <LogOut size={20} className="text-text/60" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {allowedTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${activeTab === tab.id
                                    ? 'bg-accent text-dark font-bold'
                                    : 'bg-glass text-text/60 hover:text-text hover:bg-glass-hover'
                                }`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </header>

            {/* Content */}
            <main className="p-4">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === 'dashboard' && (
                        <div className="text-center py-12">
                            <h2 className="text-2xl font-bold mb-2">Bienvenido al Panel</h2>
                            <p className="text-text/60">Selecciona un módulo para comenzar.</p>
                        </div>
                    )}
                    {activeTab === 'pos' && <POS />}
                    {activeTab === 'kds' && <KitchenDisplay />}
                    {activeTab === 'orders' && <StoreOrders />}
                    {activeTab === 'inventory' && <StoreInventory />}
                    {activeTab === 'settings' && <StoreSettings />}
                </motion.div>
            </main>
        </div>
    );
};

export default StoreAdmin;
