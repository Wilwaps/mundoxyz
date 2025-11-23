import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Store, Shield, Check } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const StoreRoleAssignmentModal = ({ isOpen, onClose, user, onAssignmentComplete }) => {
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedStore, setSelectedStore] = useState('');
    const [selectedRole, setSelectedRole] = useState('seller');
    const [assigning, setAssigning] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchStores();
        }
    }, [isOpen]);

    const fetchStores = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/store/list');
            setStores(response.data);
            if (response.data.length > 0) {
                setSelectedStore(response.data[0].id);
            }
        } catch (error) {
            console.error('Error fetching stores:', error);
            toast.error('Error al cargar tiendas');
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedStore || !selectedRole) return;

        try {
            setAssigning(true);
            await axios.post('/api/admin/store-staff/assign', {
                store_id: selectedStore,
                user_id: user.id,
                role: selectedRole
            });

            toast.success('Rol de tienda asignado correctamente');
            onAssignmentComplete?.();
            onClose();
        } catch (error) {
            console.error('Error assigning store role:', error);
            toast.error(error.response?.data?.error || 'Error al asignar rol');
        } finally {
            setAssigning(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-md card-glass p-6 relative"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-text/60 hover:text-text transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
                        <Store className="text-accent" size={24} />
                        Asignar Personal de Tienda
                    </h3>
                    <p className="text-sm text-text/60 mb-6">
                        Usuario: <span className="font-semibold text-text">{user?.username}</span>
                    </p>

                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="spinner"></div>
                        </div>
                    ) : stores.length === 0 ? (
                        <div className="text-center py-8 text-text/60">
                            No hay tiendas disponibles.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text/80 mb-2">
                                    Seleccionar Tienda
                                </label>
                                <select
                                    value={selectedStore}
                                    onChange={(e) => setSelectedStore(e.target.value)}
                                    className="w-full px-4 py-3 bg-glass rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
                                >
                                    {stores.map(store => (
                                        <option key={store.id} value={store.id}>
                                            {store.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text/80 mb-2">
                                    Seleccionar Rol
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {[
                                        { id: 'owner', label: 'Dueño', desc: 'Acceso total y gestión financiera' },
                                        { id: 'admin', label: 'Administrador', desc: 'Gestión operativa completa' },
                                        { id: 'manager', label: 'Gerente', desc: 'Inventario, KDS y POS' },
                                        { id: 'seller', label: 'Vendedor', desc: 'Solo POS y Pedidos' },
                                        { id: 'marketing', label: 'Marketing', desc: 'Configuración visual (limitada)' }
                                    ].map((role) => (
                                        <div
                                            key={role.id}
                                            onClick={() => setSelectedRole(role.id)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedRole === role.id
                                                    ? 'bg-accent/10 border-accent'
                                                    : 'bg-glass border-transparent hover:bg-glass-hover'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className={`font-medium ${selectedRole === role.id ? 'text-accent' : 'text-text'}`}>
                                                    {role.label}
                                                </span>
                                                {selectedRole === role.id && <Check size={16} className="text-accent" />}
                                            </div>
                                            <div className="text-xs text-text/60 mt-1">{role.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 px-4 bg-glass hover:bg-glass-hover rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleAssign}
                                    disabled={assigning}
                                    className="flex-1 py-3 px-4 bg-accent hover:bg-accent-hover text-dark font-bold rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {assigning ? 'Asignando...' : 'Confirmar Asignación'}
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default StoreRoleAssignmentModal;
