import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Users, Globe, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

const Lobby = () => {
  const handleCreateRoom = () => {
    toast.info('Creación de salas próximamente');
  };

  const handleJoinRoom = () => {
    toast.info('Sistema de salas próximamente');
  };

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold text-center mb-8 text-gradient-accent">Lobby</h1>
      
      {/* Create Room Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleCreateRoom}
        className="w-full btn-primary flex items-center justify-center gap-2 mb-6"
      >
        <Plus size={20} />
        Crear Sala
      </motion.button>

      {/* Quick Join */}
      <div className="card-glass mb-6">
        <h2 className="text-lg font-bold mb-4">Unirse Rápido</h2>
        <input
          type="text"
          placeholder="Código de sala"
          className="input-glass w-full mb-3"
          maxLength={6}
        />
        <button
          onClick={handleJoinRoom}
          className="w-full btn-accent"
        >
          Unirse a Sala
        </button>
      </div>

      {/* Public Rooms */}
      <div className="card-glass">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Globe size={20} className="text-accent" />
          Salas Públicas
        </h2>
        
        <div className="text-center py-8 text-text/40">
          <Users size={48} className="mx-auto mb-2 opacity-50" />
          <p>No hay salas públicas disponibles</p>
          <p className="text-sm mt-2">¡Sé el primero en crear una!</p>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
