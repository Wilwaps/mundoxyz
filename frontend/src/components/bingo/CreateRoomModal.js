import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { FaCoins, FaFire, FaGlobe, FaLock } from 'react-icons/fa';

const CreateRoomModal = ({ show, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    roomName: '',
    roomType: 'public',
    currency: 'coins',
    numbersMode: 75,
    victoryMode: 'line',
    cardCost: 10,
    maxPlayers: 10,
    maxCardsPerPlayer: 5,
    password: ''
  });

  const createRoomMutation = useMutation({
    mutationFn: async (roomData) => {
      const response = await axios.post('/api/bingo/rooms', roomData);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('¡Sala creada exitosamente!');
      onSuccess(data.code);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al crear la sala');
    }
  });

  const resetForm = () => {
    setFormData({
      roomName: '',
      roomType: 'public',
      currency: 'coins',
      numbersMode: 75,
      victoryMode: 'line',
      cardCost: 10,
      maxPlayers: 10,
      maxCardsPerPlayer: 5,
      password: ''
    });
  };

  const handleSubmit = () => {
    if (formData.roomType === 'private' && !formData.password) {
      toast.error('Las salas privadas requieren contraseña');
      return;
    }
    createRoomMutation.mutate(formData);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 
                   flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="glass-effect p-6 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            🎰 Crear Sala de Bingo
          </h2>

          <div className="space-y-4">
            {/* Nombre de la sala */}
            <div>
              <label className="block text-white/80 text-sm mb-2">
                Nombre de la sala (opcional)
              </label>
              <input
                type="text"
                placeholder="Mi sala de Bingo"
                maxLength={100}
                value={formData.roomName}
                onChange={(e) => setFormData({...formData, roomName: e.target.value})}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 
                         rounded-lg text-white placeholder-white/40
                         focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Tipo de sala */}
            <div>
              <label className="block text-white/80 text-sm mb-2">
                Tipo de sala
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, roomType: 'public', password: ''})}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all
                            ${formData.roomType === 'public' 
                              ? 'bg-purple-600 text-white' 
                              : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                >
                  <FaGlobe className="inline mr-2" />
                  Pública
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, roomType: 'private'})}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all
                            ${formData.roomType === 'private' 
                              ? 'bg-purple-600 text-white' 
                              : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                >
                  <FaLock className="inline mr-2" />
                  Privada
                </button>
              </div>
            </div>

            {/* Contraseña (si es privada) */}
            {formData.roomType === 'private' && (
              <div>
                <label className="block text-white/80 text-sm mb-2">
                  Contraseña <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contraseña de la sala"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 
                           rounded-lg text-white placeholder-white/40
                           focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            )}

            {/* Moneda */}
            <div>
              <label className="block text-white/80 text-sm mb-2">
                Moneda
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, currency: 'coins'})}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all
                            ${formData.currency === 'coins' 
                              ? 'bg-yellow-600 text-white' 
                              : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                >
                  <FaCoins className="inline mr-2" />
                  Monedas
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, currency: 'fires'})}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all
                            ${formData.currency === 'fires' 
                              ? 'bg-orange-600 text-white' 
                              : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                >
                  <FaFire className="inline mr-2" />
                  Fuegos
                </button>
              </div>
            </div>

            {/* Modo de números */}
            <div>
              <label className="block text-white/80 text-sm mb-2">
                Modo de juego
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, numbersMode: 75})}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all
                            ${formData.numbersMode === 75 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                >
                  🎱 75 números
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, numbersMode: 90})}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all
                            ${formData.numbersMode === 90 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                >
                  🎯 90 números
                </button>
              </div>
            </div>

            {/* Modo de victoria */}
            <div>
              <label className="block text-white/80 text-sm mb-2">
                Modo de victoria
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, victoryMode: 'line'})}
                  className={`py-2 px-3 rounded-lg font-semibold transition-all text-sm
                            ${formData.victoryMode === 'line' 
                              ? 'bg-green-600 text-white' 
                              : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                >
                  Línea
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, victoryMode: 'corners'})}
                  className={`py-2 px-3 rounded-lg font-semibold transition-all text-sm
                            ${formData.victoryMode === 'corners' 
                              ? 'bg-green-600 text-white' 
                              : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                >
                  Esquinas
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, victoryMode: 'full'})}
                  className={`py-2 px-3 rounded-lg font-semibold transition-all text-sm
                            ${formData.victoryMode === 'full' 
                              ? 'bg-green-600 text-white' 
                              : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                >
                  Completo
                </button>
              </div>
            </div>

            {/* Costo por cartón */}
            <div>
              <label className="block text-white/80 text-sm mb-2">
                Costo por cartón ({formData.currency === 'coins' ? 'monedas' : 'fuegos'})
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={formData.cardCost}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 1;
                  setFormData({...formData, cardCost: Math.min(1000, Math.max(1, value))});
                }}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 
                         rounded-lg text-white
                         focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Máximo de jugadores */}
            <div>
              <label className="block text-white/80 text-sm mb-2">
                Máximo de jugadores (2-30)
              </label>
              <input
                type="number"
                min="2"
                max="30"
                value={formData.maxPlayers}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 2;
                  setFormData({...formData, maxPlayers: Math.min(30, Math.max(2, value))});
                }}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 
                         rounded-lg text-white
                         focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Máximo de cartones por jugador */}
            <div>
              <label className="block text-white/80 text-sm mb-2">
                Máximo de cartones por jugador (1-10)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.maxCardsPerPlayer}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 1;
                  setFormData({...formData, maxCardsPerPlayer: Math.min(10, Math.max(1, value))});
                }}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 
                         rounded-lg text-white
                         focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Resumen */}
          <div className="mt-6 p-4 bg-white/5 rounded-lg">
            <h3 className="text-sm font-semibold text-white/80 mb-2">Resumen de la sala:</h3>
            <ul className="text-xs text-white/60 space-y-1">
              <li>• Tipo: {formData.roomType === 'public' ? 'Pública' : 'Privada'}</li>
              <li>• Modo: {formData.numbersMode} números</li>
              <li>• Victoria: {formData.victoryMode === 'line' ? 'Línea' : 
                              formData.victoryMode === 'corners' ? 'Esquinas' : 'Completo'}</li>
              <li>• Costo: {formData.cardCost} {formData.currency === 'coins' ? 'monedas' : 'fuegos'} por cartón</li>
              <li>• Capacidad: {formData.maxPlayers} jugadores, {formData.maxCardsPerPlayer} cartones c/u</li>
            </ul>
          </div>

          {/* Botones */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={createRoomMutation.isPending}
              className="flex-1 px-6 py-3 bg-white/10 text-white rounded-xl 
                       font-semibold hover:bg-white/20 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={createRoomMutation.isPending}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 
                       text-white rounded-xl font-semibold hover:shadow-lg 
                       hover:shadow-purple-500/25 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createRoomMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-white/20 
                                border-t-white rounded-full" />
                  Creando...
                </span>
              ) : (
                'Crear Sala'
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CreateRoomModal;
