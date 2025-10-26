import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Shield, Crown, Settings, Users, Award, Star } from 'lucide-react';

const Roles = () => {
  const { user, hasRole } = useAuth();

  // Fetch my roles with details
  const { data: myRoles } = useQuery({
    queryKey: ['my-roles'],
    queryFn: async () => {
      const response = await axios.get('/roles/me');
      return response.data;
    }
  });

  const roleIcons = {
    tote: Crown,
    admin: Settings,
    moderator: Shield,
    user: Users,
    vip: Star,
    sponsor: Award
  };

  const roleColors = {
    tote: 'text-fire-orange',
    admin: 'text-violet',
    moderator: 'text-accent',
    user: 'text-text/60',
    vip: 'text-yellow-400',
    sponsor: 'text-success'
  };

  const roleDescriptions = {
    tote: 'Creador y administrador principal del sistema',
    admin: 'Administrador con acceso completo al sistema',
    moderator: 'Moderador de contenido y juegos',
    user: 'Usuario regular con acceso básico',
    vip: 'Usuario VIP con beneficios especiales',
    sponsor: 'Patrocinador del sistema'
  };

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold text-center mb-8 text-gradient-violet">Roles</h1>

      {/* My Current Roles */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-glass mb-6"
      >
        <h2 className="text-lg font-bold mb-4">Mis Roles Actuales</h2>
        
        {myRoles?.roles?.length > 0 ? (
          <div className="space-y-3">
            {(Array.isArray(myRoles.roles) ? myRoles.roles : []).map((role) => {
              const Icon = roleIcons[role.name] || Users;
              return (
                <div key={role.id} className="glass-panel p-4">
                  <div className="flex items-center gap-3">
                    <Icon size={24} className={roleColors[role.name] || 'text-text'} />
                    <div className="flex-1">
                      <div className="font-semibold text-text capitalize">{role.name}</div>
                      <p className="text-xs text-text/60">
                        {role.description || roleDescriptions[role.name]}
                      </p>
                      {role.granted_at && (
                        <p className="text-xs text-text/40 mt-1">
                          Otorgado: {new Date(role.granted_at).toLocaleDateString()}
                          {role.granted_by && ` por ${role.granted_by}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-text/40">
            <Users size={32} className="mx-auto mb-2 opacity-50" />
            <p>No tienes roles asignados</p>
          </div>
        )}
      </motion.div>

      {/* Role Benefits */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-glass mb-6"
      >
        <h2 className="text-lg font-bold mb-4">Beneficios por Rol</h2>
        
        <div className="space-y-4">
          {hasRole('tote') && (
            <div className="glass-panel p-4 border-l-4 border-fire-orange">
              <div className="flex items-center gap-2 mb-2">
                <Crown size={20} className="text-fire-orange" />
                <span className="font-semibold text-fire-orange">Tote</span>
              </div>
              <ul className="text-sm text-text/80 space-y-1">
                <li>• Control total del sistema</li>
                <li>• Aprobación de solicitudes de fuegos</li>
                <li>• Gestión de eventos y promociones</li>
                <li>• Acceso a todas las estadísticas</li>
                <li>• 10% de comisión en todos los juegos</li>
              </ul>
            </div>
          )}

          {hasRole('admin') && (
            <div className="glass-panel p-4 border-l-4 border-violet">
              <div className="flex items-center gap-2 mb-2">
                <Settings size={20} className="text-violet" />
                <span className="font-semibold text-violet">Administrador</span>
              </div>
              <ul className="text-sm text-text/80 space-y-1">
                <li>• Gestión de usuarios y roles</li>
                <li>• Moderación de contenido</li>
                <li>• Acceso a reportes detallados</li>
                <li>• Creación de eventos especiales</li>
              </ul>
            </div>
          )}

          {hasRole('vip') && (
            <div className="glass-panel p-4 border-l-4 border-yellow-400">
              <div className="flex items-center gap-2 mb-2">
                <Star size={20} className="text-yellow-400" />
                <span className="font-semibold text-yellow-400">VIP</span>
              </div>
              <ul className="text-sm text-text/80 space-y-1">
                <li>• Bonos exclusivos mensuales</li>
                <li>• Acceso anticipado a nuevos juegos</li>
                <li>• Descuentos en rifas premium</li>
                <li>• Insignia VIP en el perfil</li>
              </ul>
            </div>
          )}
        </div>
      </motion.div>

      {/* Available Roles Info */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card-glass"
      >
        <h2 className="text-lg font-bold mb-4">Cómo Obtener Roles</h2>
        
        <div className="space-y-3 text-sm">
          <div className="glass-panel p-3">
            <div className="flex items-center gap-2 mb-1">
              <Star size={16} className="text-yellow-400" />
              <span className="font-semibold text-text">VIP</span>
            </div>
            <p className="text-text/60">
              Participa activamente en juegos y eventos para ser considerado para VIP
            </p>
          </div>

          <div className="glass-panel p-3">
            <div className="flex items-center gap-2 mb-1">
              <Shield size={16} className="text-accent" />
              <span className="font-semibold text-text">Moderador</span>
            </div>
            <p className="text-text/60">
              Contribuye a mantener una comunidad sana y positiva
            </p>
          </div>

          <div className="glass-panel p-3">
            <div className="flex items-center gap-2 mb-1">
              <Award size={16} className="text-success" />
              <span className="font-semibold text-text">Patrocinador</span>
            </div>
            <p className="text-text/60">
              Apoya el proyecto económicamente para obtener beneficios especiales
            </p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-info/20 border border-info/30 rounded-lg">
          <p className="text-xs text-info">
            Los roles son otorgados por los administradores basándose en la actividad y contribución al sistema.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Roles;
