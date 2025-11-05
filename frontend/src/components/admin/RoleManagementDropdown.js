import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Shield, ChevronDown, Check, X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Componente dropdown para gestión de roles de usuarios
 * Solo visible y funcional para usuarios con rol 'tote'
 */
const RoleManagementDropdown = ({ user, onRolesUpdated }) => {
  const { user: currentUser, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState(user.roles || []);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const dropdownRef = useRef(null);

  // Solo mostrar si el usuario actual es tote
  const isTote = hasRole('tote');

  // Cargar roles disponibles al montar
  useEffect(() => {
    if (isTote && isOpen && availableRoles.length === 0) {
      loadAvailableRoles();
    }
  }, [isTote, isOpen]);

  // Sincronizar roles cuando cambie el usuario
  useEffect(() => {
    setSelectedRoles(user.roles || []);
  }, [user.roles]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowConfirm(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadAvailableRoles = async () => {
    try {
      const response = await axios.get('/api/admin/roles/available');
      setAvailableRoles(response.data.data || []);
    } catch (error) {
      console.error('Error loading roles:', error);
      toast.error('Error al cargar roles disponibles');
    }
  };

  const toggleRole = (roleName) => {
    setSelectedRoles(prev => {
      if (prev.includes(roleName)) {
        return prev.filter(r => r !== roleName);
      } else {
        return [...prev, roleName];
      }
    });
  };

  const hasChanges = () => {
    const current = [...(user.roles || [])].sort();
    const selected = [...selectedRoles].sort();
    return JSON.stringify(current) !== JSON.stringify(selected);
  };

  const handleSave = async () => {
    // Validaciones
    if (user.id === currentUser.id && !selectedRoles.includes('tote')) {
      toast.error('No puedes quitarte el rol tote a ti mismo');
      return;
    }

    if (!hasChanges()) {
      toast('No hay cambios para guardar', { icon: 'ℹ️' });
      setIsOpen(false);
      return;
    }

    // Mostrar confirmación para cambios críticos
    const removingTote = user.roles.includes('tote') && !selectedRoles.includes('tote');
    const removingAdmin = user.roles.includes('admin') && !selectedRoles.includes('admin');
    
    if ((removingTote || removingAdmin) && !showConfirm) {
      setShowConfirm(true);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.patch(
        `/api/admin/users/${user.id}/roles`,
        {
          roles: selectedRoles,
          reason: 'Actualización desde panel de gestión de usuarios'
        }
      );

      toast.success(response.data.message || 'Roles actualizados correctamente');
      
      // Invalidar queries para actualizar la UI
      queryClient.invalidateQueries(['admin-users']);
      queryClient.invalidateQueries(['user-profile', user.id]);
      
      // Callback para actualizar el componente padre
      if (onRolesUpdated) {
        onRolesUpdated(response.data.data);
      }

      setIsOpen(false);
      setShowConfirm(false);
    } catch (error) {
      console.error('Error updating roles:', error);
      toast.error(error.response?.data?.error || 'Error al actualizar roles');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedRoles(user.roles || []);
    setIsOpen(false);
    setShowConfirm(false);
  };

  // No renderizar si el usuario actual no es tote
  if (!isTote) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón para abrir dropdown */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-glass btn-sm flex items-center gap-2 hover:bg-accent/10 transition-colors"
        title="Gestionar roles"
      >
        <Shield size={16} className="text-accent" />
        <span className="text-xs">Roles</span>
        <ChevronDown 
          size={14} 
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-72 card-glass border border-text/20 shadow-xl z-50"
          >
            {/* Header */}
            <div className="p-3 border-b border-text/10">
              <div className="font-bold text-sm flex items-center gap-2">
                <Shield size={16} className="text-accent" />
                Gestionar Roles
              </div>
              <div className="text-xs text-text/60 mt-1">
                {user.display_name || user.username}
              </div>
            </div>

            {/* Confirmación para cambios críticos */}
            {showConfirm && (
              <div className="p-3 bg-warning/10 border-b border-warning/30">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle size={18} className="text-warning flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-warning">
                    <p className="font-bold mb-1">¡Atención!</p>
                    <p>Estás removiendo roles administrativos. ¿Confirmas esta acción?</p>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de roles */}
            <div className="p-3 max-h-64 overflow-y-auto">
              {availableRoles.length === 0 ? (
                <div className="text-center py-4 text-text/60 text-xs">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent mx-auto mb-2"></div>
                  Cargando roles...
                </div>
              ) : (
                <div className="space-y-2">
                  {availableRoles.map((role) => {
                    const isSelected = selectedRoles.includes(role.name);
                    const isSelfToteRemoval = user.id === currentUser.id && role.name === 'tote' && !isSelected;
                    
                    return (
                      <label
                        key={role.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors
                          ${isSelected ? 'bg-accent/20 border border-accent/40' : 'hover:bg-glass-hover'}
                          ${isSelfToteRemoval ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => !isSelfToteRemoval && toggleRole(role.name)}
                          disabled={isSelfToteRemoval || loading}
                          className="checkbox-custom"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{role.name}</span>
                            {isSelected && <Check size={14} className="text-success" />}
                          </div>
                          {role.description && (
                            <div className="text-xs text-text/60 mt-0.5">
                              {role.description}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer con botones */}
            <div className="p-3 border-t border-text/10 flex gap-2">
              <button
                onClick={handleCancel}
                disabled={loading}
                className="btn-glass btn-sm flex-1 flex items-center justify-center gap-2"
              >
                <X size={14} />
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={loading || !hasChanges()}
                className={`btn-glass btn-sm flex-1 flex items-center justify-center gap-2
                  ${hasChanges() && !loading ? 'bg-accent/20 hover:bg-accent/30 text-accent' : 'opacity-50'}
                `}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    {showConfirm ? 'Confirmar' : 'Guardar'}
                  </>
                )}
              </button>
            </div>

            {/* Información de cambios */}
            {hasChanges() && !showConfirm && (
              <div className="px-3 pb-3">
                <div className="text-xs text-text/60 bg-glass-hover p-2 rounded">
                  {(() => {
                    const current = user.roles || [];
                    const added = selectedRoles.filter(r => !current.includes(r));
                    const removed = current.filter(r => !selectedRoles.includes(r));
                    
                    return (
                      <>
                        {added.length > 0 && (
                          <div className="text-success">
                            ➕ Agregar: {added.join(', ')}
                          </div>
                        )}
                        {removed.length > 0 && (
                          <div className="text-error">
                            ➖ Remover: {removed.join(', ')}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RoleManagementDropdown;
