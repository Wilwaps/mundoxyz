import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Shield, Settings, Users, Award, Star, Sparkles } from 'lucide-react';

const Roles = () => {
  const { user, hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('user');

  const username = user?.username || 'Usuario';

  // Fetch my roles with details
  const { data: myRoles } = useQuery({
    queryKey: ['my-roles'],
    queryFn: async () => {
      const response = await axios.get('/api/roles/me');
      return response.data;
    }
  });

  const rawRoles = Array.isArray(myRoles?.roles) ? myRoles.roles : [];

  const tabs = [{ key: 'user', label: 'Usuario' }];

  if (hasRole('tito')) {
    tabs.push({ key: 'tito', label: 'Tito' });
  }
  if (hasRole('vip')) {
    tabs.push({ key: 'vip', label: 'VIP' });
  }
  if (hasRole('moderator')) {
    tabs.push({ key: 'moderator', label: 'Moderador' });
  }
  if (hasRole('admin')) {
    tabs.push({ key: 'admin', label: 'Admin' });
  }
  if (hasRole('sponsor')) {
    tabs.push({ key: 'sponsor', label: 'Patrocinador' });
  }

  const roleIcons = {
    admin: Settings,
    moderator: Shield,
    user: Users,
    vip: Star,
    sponsor: Award,
    tito: Sparkles
  };

  const roleColors = {
    admin: 'text-violet',
    moderator: 'text-accent',
    user: 'text-text/60',
    vip: 'text-yellow-400',
    sponsor: 'text-success',
    tito: 'text-orange-400'
  };

  const roleDescriptions = {
    admin: 'Administrador con acceso completo al sistema',
    moderator: 'Moderador de contenido y juegos',
    user: 'Usuario regular con acceso básico',
    vip: 'Usuario VIP con beneficios especiales',
    sponsor: 'Patrocinador del sistema',
    tito: 'Rol especial que participa en las comisiones de la plataforma'
  };

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold text-center mb-8 text-gradient-violet">
        Roles de {username}
      </h1>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ${
              activeTab === tab.key
                ? 'bg-orange-500/20 border-orange-400 text-orange-400'
                : 'bg-card border-glass text-text/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* My Current Roles */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-glass mb-6"
      >
        <h2 className="text-lg font-bold mb-4">Mis Roles Actuales</h2>
        
        {rawRoles.length > 0 ? (
          <div className="space-y-3">
            {rawRoles
              .filter((role) => role.name !== 'tote')
              .map((role) => {
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

      {/* Role Details por pestañas */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-glass mb-6"
      >
        <h2 className="text-lg font-bold mb-4">
          {activeTab === 'user' && 'Bienvenida y uso de MundoXYZ'}
          {activeTab === 'tito' && 'Rol Tito'}
          {activeTab === 'admin' && 'Rol Administrador'}
          {activeTab === 'vip' && 'Rol VIP'}
          {activeTab === 'moderator' && 'Rol Moderador'}
          {activeTab === 'sponsor' && 'Rol Patrocinador'}
        </h2>

        {activeTab === 'user' && (
          <div className="space-y-3 text-sm text-text/80">
            <p>
              MundoXYZ es una miniapp de juegos y comunidad donde usas{' '}
              <span className="font-semibold">fuegos (🔥)</span> como moneda principal para jugar,
              participar en rifas y canjear recompensas.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold">Conseguir fuegos:</span> usa la sección{' '}
                <span className="font-semibold">Mercado</span> o las opciones de compra desde tu perfil.
              </li>
              <li>
                <span className="font-semibold">Usar fuegos:</span> juega en{' '}
                <span className="font-semibold">Juegos</span>, participa en{' '}
                <span className="font-semibold">Rifas</span> o úsalos en eventos especiales.
              </li>
              <li>
                <span className="font-semibold">Depositar / recargar:</span> sigue las instrucciones de{' '}
                <span className="font-semibold">Mercado</span> para enviar tu pago y recibir fuegos en tu wallet.
              </li>
              <li>
                <span className="font-semibold">Retirar:</span> cuando tengas suficientes fuegos, puedes
                canjearlos por dinero usando el flujo de canje en el{' '}
                <span className="font-semibold">Mercado</span>.
              </li>
            </ul>
            <p>
              A medida que participas y aportas a la comunidad puedes recibir nuevos roles que desbloquean
              más pestañas y beneficios en esta pantalla.
            </p>
          </div>
        )}

        {activeTab === 'tito' && (
          <div className="space-y-4 text-sm text-text/80">
            <p>
              El rol <span className="font-semibold">Tito</span> reconoce a personas cercanas al proyecto que
              ayudan a hacer crecer la comunidad.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Obtienes un link especial de invitación para traer usuarios.</li>
              <li>
                Recibes una parte de las comisiones generadas por los usuarios que se registran y juegan
                usando tu link.
              </li>
              <li>
                Además formas parte de un dividendo global que reparte una porción de las comisiones entre
                todos los Titos.
              </li>
              <li>
                Puedes ver tu link y tus comisiones en el panel Tito del menú principal.
              </li>
            </ul>
            <div className="pt-2">
              <Link
                to="/tito/info"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/15 hover:bg-orange-500/25 text-xs font-semibold text-orange-300 transition-colors"
              >
                <span>Ver guía completa de Tito</span>
              </Link>
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="space-y-3 text-sm text-text/80">
            <p>
              El rol <span className="font-semibold">Administrador</span> ayuda a mantener el orden y la
              evolución del sistema.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Gestión de usuarios y asignación de roles.</li>
              <li>Moderación de contenido y actividades.</li>
              <li>Acceso a reportes y paneles internos.</li>
              <li>Creación y supervisión de eventos especiales.</li>
            </ul>
          </div>
        )}

        {activeTab === 'vip' && (
          <div className="space-y-3 text-sm text-text/80">
            <p>
              El rol <span className="font-semibold">VIP</span> recompensa a quienes participan de forma
              constante y positiva.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Bonos o sorpresas periódicas.</li>
              <li>Acceso anticipado a nuevos juegos y funciones.</li>
              <li>Beneficios especiales en rifas y eventos.</li>
              <li>Elementos visuales o insignias exclusivas.</li>
            </ul>
          </div>
        )}

        {activeTab === 'moderator' && (
          <div className="space-y-3 text-sm text-text/80">
            <p>
              El rol <span className="font-semibold">Moderador</span> cuida que la comunidad se mantenga sana
              y respetuosa.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Apoyo en la moderación de chats, salas y juegos.</li>
              <li>Reporte y manejo de comportamientos tóxicos.</li>
              <li>
                Acompañar a nuevos usuarios para que entiendan cómo funciona MundoXYZ.
              </li>
            </ul>
          </div>
        )}

        {activeTab === 'sponsor' && (
          <div className="space-y-3 text-sm text-text/80">
            <p>
              El rol <span className="font-semibold">Patrocinador</span> representa a personas o marcas que
              apoyan el proyecto.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Participación destacada en eventos y rifas especiales.</li>
              <li>Mayor visibilidad dentro del ecosistema.</li>
              <li>
                Posibilidad de colaborar en campañas, sorteos u otras dinámicas con la comunidad.
              </li>
            </ul>
          </div>
        )}
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
