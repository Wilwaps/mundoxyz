import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Calendar, Bell, Rocket, Gift, Zap } from 'lucide-react';

const Upcoming = () => {
  const upcomingFeatures = [
    {
      icon: Rocket,
      title: 'Torneos Semanales',
      description: 'Compite en torneos de Bingo y Rifas con premios garantizados',
      status: 'En desarrollo',
      color: 'text-violet'
    },
    {
      icon: Gift,
      title: 'Sistema de Recompensas',
      description: 'Gana puntos por jugar y canjéalos por premios exclusivos',
      status: 'Próximamente',
      color: 'text-accent'
    },
    {
      icon: Zap,
      title: 'Juegos Instantáneos',
      description: 'Nuevos minijuegos con premios al instante',
      status: 'En planificación',
      color: 'text-fire-orange'
    },
    {
      icon: Bell,
      title: 'Notificaciones Push',
      description: 'Recibe alertas de tus juegos y rifas favoritas',
      status: 'En desarrollo',
      color: 'text-success'
    }
  ];

  const upcomingEvents = [
    {
      date: '2024-01-15',
      title: 'Gran Rifa de Año Nuevo',
      prize: '1000 🔥',
      type: 'special'
    },
    {
      date: '2024-01-20',
      title: 'Torneo de Bingo Premium',
      prize: '500 🔥 + 5000 🪙',
      type: 'tournament'
    },
    {
      date: '2024-01-25',
      title: 'Evento de Bienvenida Doble',
      prize: 'Doble bonus para nuevos usuarios',
      type: 'welcome'
    }
  ];

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold text-center mb-8 text-gradient-accent">Próximamente</h1>

      {/* Upcoming Features */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-glass mb-6"
      >
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Rocket size={20} className="text-violet" />
          Nuevas Funciones
        </h2>
        
        <div className="space-y-4">
          {upcomingFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass-panel p-4"
              >
                <div className="flex items-start gap-3">
                  <Icon size={24} className={feature.color} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-text">{feature.title}</h3>
                    <p className="text-sm text-text/60 mt-1">{feature.description}</p>
                    <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full bg-glass ${
                      feature.status === 'En desarrollo' ? 'text-accent border border-accent/30' :
                      feature.status === 'Próximamente' ? 'text-success border border-success/30' :
                      'text-text/60 border border-glass'
                    }`}>
                      {feature.status}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Upcoming Events */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-glass mb-6"
      >
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Calendar size={20} className="text-accent" />
          Eventos Próximos
        </h2>
        
        <div className="space-y-3">
          {upcomingEvents.map((event, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="glass-panel p-4"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-text">{event.title}</h3>
                  <p className="text-sm text-fire-orange mt-1">{event.prize}</p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-text/60">
                    <Clock size={12} />
                    <span>{new Date(event.date).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  event.type === 'special' ? 'bg-fire-orange/20 text-fire-orange' :
                  event.type === 'tournament' ? 'bg-violet/20 text-violet' :
                  'bg-success/20 text-success'
                }`}>
                  {event.type === 'special' ? 'Especial' :
                   event.type === 'tournament' ? 'Torneo' : 'Evento'}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Countdown Timer */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card-glass text-center"
      >
        <h3 className="text-lg font-bold mb-4">Próximo Gran Evento</h3>
        <div className="bg-gradient-to-r from-fire-orange to-fire-yellow bg-clip-text">
          <div className="text-4xl font-bold text-transparent">00:00:00</div>
        </div>
        <p className="text-sm text-text/60 mt-2">Gran Rifa de Año Nuevo</p>
        
        <div className="mt-4 flex justify-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">0</div>
            <div className="text-xs text-text/60">Días</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-violet">0</div>
            <div className="text-xs text-text/60">Horas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-success">0</div>
            <div className="text-xs text-text/60">Minutos</div>
          </div>
        </div>
      </motion.div>

      {/* Newsletter Signup */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-6 p-4 bg-gradient-to-r from-violet/20 to-accent/20 rounded-xl border border-accent/30"
      >
        <div className="flex items-center gap-3">
          <Bell size={24} className="text-accent" />
          <div className="flex-1">
            <h4 className="font-semibold text-text">Mantente Informado</h4>
            <p className="text-xs text-text/60">
              Activa las notificaciones para no perderte ningún evento
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Upcoming;
