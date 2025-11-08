/**
 * Sistema de Rifas V2 - CreateRaffleModal Component
 * Modal para crear nueva rifa con validación completa
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Trophy,
  Tag,
  Globe,
  Lock,
  Building2,
  Calendar,
  FileText,
  Image,
  AlertCircle,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { useCreateRaffle } from '../hooks/useRaffleData';
import { CreateRaffleForm, RaffleMode, RaffleVisibility } from '../types';
import { RAFFLE_LIMITS, VALIDATION_RULES, UI_TEXTS } from '../constants';

interface CreateRaffleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (raffleCode: string) => void;
}

const CreateRaffleModal: React.FC<CreateRaffleModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user } = useAuth();
  const createRaffle = useCreateRaffle();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<CreateRaffleForm>({
    name: '',
    description: '',
    mode: RaffleMode.FIRES,
    visibility: RaffleVisibility.PUBLIC,
    numbersRange: 100,
    entryPrice: 10,
    startsAt: undefined,
    endsAt: undefined,
    termsConditions: '',
    prizeMeta: {
      prizeType: 'product',
      prizeDescription: '',
      prizeValue: 0,
      prizeImages: []
    },
    companyConfig: undefined
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Validar campo individual
  const validateField = (field: string, value: any) => {
    const newErrors = { ...errors };
    
    switch (field) {
      case 'name':
        if (!value || value.length < 3) {
          newErrors.name = 'El nombre debe tener al menos 3 caracteres';
        } else if (value.length > 100) {
          newErrors.name = 'El nombre no puede superar 100 caracteres';
        } else {
          delete newErrors.name;
        }
        break;
        
      case 'numbersRange':
        const num = parseInt(value);
        if (num < RAFFLE_LIMITS.MIN_NUMBERS) {
          newErrors.numbersRange = `Mínimo ${RAFFLE_LIMITS.MIN_NUMBERS} números`;
        } else if (num > RAFFLE_LIMITS.MAX_NUMBERS) {
          newErrors.numbersRange = `Máximo ${RAFFLE_LIMITS.MAX_NUMBERS} números`;
        } else {
          delete newErrors.numbersRange;
        }
        break;
        
      case 'entryPrice':
        const price = parseFloat(value);
        if (formData.mode !== RaffleMode.PRIZE) {
          if (price < RAFFLE_LIMITS.MIN_PRICE) {
            newErrors.entryPrice = `Precio mínimo ${RAFFLE_LIMITS.MIN_PRICE}`;
          } else if (price > RAFFLE_LIMITS.MAX_PRICE) {
            newErrors.entryPrice = `Precio máximo ${RAFFLE_LIMITS.MAX_PRICE}`;
          } else {
            delete newErrors.entryPrice;
          }
        }
        break;
    }
    
    setErrors(newErrors);
  };
  
  // Actualizar campo
  const updateField = <K extends keyof CreateRaffleForm>(
    field: K,
    value: CreateRaffleForm[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    validateField(field, value);
  };
  
  // Validar paso actual
  const validateStep = () => {
    switch (step) {
      case 1:
        if (!formData.name || formData.name.length < 3) {
          toast.error('Por favor ingresa un nombre válido');
          return false;
        }
        break;
        
      case 2:
        if (formData.mode === RaffleMode.PRIZE) {
          if (!formData.prizeMeta?.prizeDescription) {
            toast.error('Por favor describe el premio');
            return false;
          }
        } else {
          if (formData.entryPrice < RAFFLE_LIMITS.MIN_PRICE) {
            toast.error(`El precio mínimo es ${RAFFLE_LIMITS.MIN_PRICE}`);
            return false;
          }
        }
        break;
        
      case 3:
        if (formData.visibility === 'company') {
          if (!formData.companyConfig?.companyName) {
            toast.error('Por favor ingresa el nombre de la empresa');
            return false;
          }
        }
        break;
    }
    
    return true;
  };
  
  // Avanzar paso
  const nextStep = () => {
    if (validateStep()) {
      setStep(prev => Math.min(prev + 1, 4));
    }
  };
  
  // Retroceder paso
  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };
  
  // Enviar formulario
  const handleSubmit = async () => {
    if (!validateStep()) return;
    
    // Verificar balance si es modo premio
    if (formData.mode === RaffleMode.PRIZE) {
      const requiredFires = formData.visibility === 'company' ? 3000 : 300;
      if ((user?.fires_balance || 0) < requiredFires) {
        toast.error(`Necesitas ${requiredFires} fuegos para crear una rifa en modo premio`);
        return;
      }
    }
    
    try {
      const result = await createRaffle.mutateAsync(formData);
      toast.success('¡Rifa creada exitosamente!');
      onSuccess?.(result.code);
      onClose();
    } catch (error) {
      // El error ya se maneja en el hook
      console.error('Error creando rifa:', error);
    }
  };
  
  // Renderizar contenido del paso
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-text mb-2">
              Información Básica
            </h3>
            
            {/* Nombre */}
            <div>
              <label className="block text-sm text-text/80 mb-1">
                Nombre de la Rifa *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Ej: Rifa iPhone 15 Pro Max"
                className={`w-full px-4 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent ${
                  errors.name ? 'ring-2 ring-red-500' : ''
                }`}
                maxLength={100}
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1">{errors.name}</p>
              )}
            </div>
            
            {/* Descripción */}
            <div>
              <label className="block text-sm text-text/80 mb-1">
                Descripción (opcional)
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Describe los premios y detalles..."
                className="w-full px-4 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-text/60 mt-1 text-right">
                {formData.description?.length || 0}/500
              </p>
            </div>
            
            {/* Cantidad de números */}
            <div>
              <label className="block text-sm text-text/80 mb-1">
                Cantidad de Números *
              </label>
              <input
                type="number"
                value={formData.numbersRange}
                onChange={(e) => updateField('numbersRange', parseInt(e.target.value))}
                min={RAFFLE_LIMITS.MIN_NUMBERS}
                max={RAFFLE_LIMITS.MAX_NUMBERS}
                className={`w-full px-4 py-2 bg-glass rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent ${
                  errors.numbersRange ? 'ring-2 ring-red-500' : ''
                }`}
              />
              {errors.numbersRange && (
                <p className="text-xs text-red-500 mt-1">{errors.numbersRange}</p>
              )}
            </div>
          </div>
        );
        
      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-text mb-2">
              Modo de Rifa
            </h3>
            
            {/* Selector de modo */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: RaffleMode.FIRES, label: 'Fuegos', icon: '🔥' },
                { value: RaffleMode.COINS, label: 'Monedas', icon: '🪙' },
                { value: RaffleMode.PRIZE, label: 'Premio', icon: '🎁' }
              ].map(mode => (
                <button
                  key={mode.value}
                  onClick={() => updateField('mode', mode.value)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    formData.mode === mode.value
                      ? 'border-accent bg-accent/20'
                      : 'border-white/10 bg-glass hover:bg-glass-lighter'
                  }`}
                >
                  <div className="text-2xl mb-1">{mode.icon}</div>
                  <div className="text-sm font-medium text-text">{mode.label}</div>
                </button>
              ))}
            </div>
            
            {/* Configuración según modo */}
            {formData.mode !== RaffleMode.PRIZE ? (
              <div>
                <label className="block text-sm text-text/80 mb-1">
                  Precio por Número *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.entryPrice}
                    onChange={(e) => updateField('entryPrice', parseFloat(e.target.value))}
                    min={RAFFLE_LIMITS.MIN_PRICE}
                    max={RAFFLE_LIMITS.MAX_PRICE}
                    step="0.01"
                    className={`w-full pl-10 pr-4 py-2 bg-glass rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent ${
                      errors.entryPrice ? 'ring-2 ring-red-500' : ''
                    }`}
                  />
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-lg">
                    {formData.mode === RaffleMode.FIRES ? '🔥' : '🪙'}
                  </span>
                </div>
                {errors.entryPrice && (
                  <p className="text-xs text-red-500 mt-1">{errors.entryPrice}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-text/80 mb-1">
                    Descripción del Premio *
                  </label>
                  <textarea
                    value={formData.prizeMeta?.prizeDescription || ''}
                    onChange={(e) => updateField('prizeMeta', {
                      ...formData.prizeMeta,
                      prizeDescription: e.target.value
                    })}
                    placeholder="Describe detalladamente el premio..."
                    className="w-full px-4 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                    rows={3}
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-text/80 mb-1">
                    Valor Estimado del Premio
                  </label>
                  <input
                    type="number"
                    value={formData.prizeMeta?.prizeValue || ''}
                    onChange={(e) => updateField('prizeMeta', {
                      ...formData.prizeMeta,
                      prizeValue: parseFloat(e.target.value)
                    })}
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
                    <div className="text-xs text-warning">
                      <p className="font-semibold">Costo de creación:</p>
                      <p>
                        {formData.visibility === 'company' ? '3000' : '300'} fuegos
                        (se deducen al crear)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
        
      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-text mb-2">
              Visibilidad
            </h3>
            
            {/* Selector de visibilidad */}
            <div className="space-y-2">
              {[
                {
                  value: 'public',
                  label: 'Pública',
                  icon: Globe,
                  description: 'Visible para todos los usuarios'
                },
                {
                  value: 'private',
                  label: 'Privada',
                  icon: Lock,
                  description: 'Solo accesible con código'
                },
                {
                  value: 'company',
                  label: 'Empresa',
                  icon: Building2,
                  description: 'Rifa patrocinada por empresa'
                }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => updateField('visibility', option.value as RaffleVisibility)}
                  className={`w-full p-3 rounded-lg border-2 transition-all flex items-start gap-3 ${
                    formData.visibility === option.value
                      ? 'border-accent bg-accent/20'
                      : 'border-white/10 bg-glass hover:bg-glass-lighter'
                  }`}
                >
                  <option.icon className="w-5 h-5 text-text/80 mt-0.5" />
                  <div className="text-left">
                    <div className="font-medium text-text">{option.label}</div>
                    <div className="text-xs text-text/60">{option.description}</div>
                  </div>
                </button>
              ))}
            </div>
            
            {/* Configuración de empresa */}
            {formData.visibility === 'company' && (
              <div className="space-y-3 mt-4 pt-4 border-t border-white/10">
                <h4 className="text-sm font-semibold text-text">
                  Información de la Empresa
                </h4>
                
                <div>
                  <label className="block text-sm text-text/80 mb-1">
                    Nombre de la Empresa *
                  </label>
                  <input
                    type="text"
                    value={formData.companyConfig?.companyName || ''}
                    onChange={(e) => updateField('companyConfig', {
                      ...formData.companyConfig,
                      companyName: e.target.value
                    })}
                    placeholder="Ej: Tech Store Venezuela"
                    className="w-full px-4 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-text/80 mb-1">
                    RIF
                  </label>
                  <input
                    type="text"
                    value={formData.companyConfig?.rifNumber || ''}
                    onChange={(e) => updateField('companyConfig', {
                      ...formData.companyConfig,
                      rifNumber: e.target.value
                    })}
                    placeholder="J-123456789"
                    className="w-full px-4 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
            )}
            
            {/* Fechas */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <h4 className="text-sm font-semibold text-text">
                Programación (opcional)
              </h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-text/80 mb-1">
                    Fecha de Inicio
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startsAt || ''}
                    onChange={(e) => updateField('startsAt', e.target.value || null)}
                    className="w-full px-3 py-2 bg-glass rounded-lg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-text/80 mb-1">
                    Fecha de Cierre
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endsAt || ''}
                    onChange={(e) => updateField('endsAt', e.target.value || null)}
                    className="w-full px-3 py-2 bg-glass rounded-lg text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
            </div>
          </div>
        );
        
      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-text mb-2">
              Confirmar Rifa
            </h3>
            
            <div className="bg-glass/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-text/60">Nombre:</span>
                <span className="text-text font-medium">{formData.name}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-text/60">Números:</span>
                <span className="text-text">{formData.numbersRange}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-text/60">Modo:</span>
                <span className="text-text">
                  {formData.mode === RaffleMode.FIRES && '🔥 Fuegos'}
                  {formData.mode === RaffleMode.COINS && '🪙 Monedas'}
                  {formData.mode === RaffleMode.PRIZE && '🎁 Premio'}
                </span>
              </div>
              
              {formData.mode !== RaffleMode.PRIZE && (
                <div className="flex justify-between text-sm">
                  <span className="text-text/60">Precio:</span>
                  <span className="text-text font-medium">
                    {formData.entryPrice} {formData.mode === RaffleMode.FIRES ? '🔥' : '🪙'}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between text-sm">
                <span className="text-text/60">Visibilidad:</span>
                <span className="text-text capitalize">{formData.visibility}</span>
              </div>
              
              {formData.mode === RaffleMode.PRIZE && (
                <div className="pt-3 border-t border-white/10">
                  <div className="flex justify-between text-sm">
                    <span className="text-text/60">Premio:</span>
                    <span className="text-text text-right max-w-[200px]">
                      {formData.prizeMeta?.prizeDescription}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-warning font-semibold">Costo creación:</span>
                    <span className="text-warning font-bold">
                      {formData.visibility === 'company' ? '3000' : '300'} 🔥
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Términos y condiciones */}
            <div>
              <label className="block text-sm text-text/80 mb-1">
                Términos y Condiciones (opcional)
              </label>
              <textarea
                value={formData.termsConditions || ''}
                onChange={(e) => updateField('termsConditions', e.target.value)}
                placeholder="Ingresa reglas específicas, restricciones, etc..."
                className="w-full px-4 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                rows={3}
              />
            </div>
            
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-accent mt-0.5" />
                <div className="text-xs text-text">
                  <p className="font-semibold mb-1">Todo listo para crear tu rifa</p>
                  <p className="text-text/80">
                    Al confirmar se creará la rifa y {formData.mode === RaffleMode.PRIZE
                      ? `se deducirán ${formData.visibility === 'company' ? '3000' : '300'} fuegos de tu cuenta`
                      : 'estará disponible inmediatamente'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-dark rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="relative p-6 bg-gradient-to-r from-accent/20 to-fire-orange/20">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg bg-dark/50 hover:bg-dark/80 transition-colors"
              >
                <X className="w-5 h-5 text-text" />
              </button>
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text">Crear Nueva Rifa</h2>
                  <p className="text-sm text-text/60">Paso {step} de 4</p>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="mt-4 h-2 bg-dark/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: `${(step / 4) * 100}%` }}
                  className="h-full bg-gradient-to-r from-accent to-fire-orange"
                />
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {renderStepContent()}
            </div>
            
            {/* Footer */}
            <div className="p-6 pt-4 border-t border-white/10">
              <div className="flex gap-3">
                {step > 1 && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={prevStep}
                    className="flex-1 py-2.5 bg-glass rounded-lg text-text hover:bg-glass-lighter transition-colors"
                  >
                    Anterior
                  </motion.button>
                )}
                
                {step < 4 ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={nextStep}
                    className="flex-1 py-2.5 btn-primary rounded-lg"
                  >
                    Siguiente
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmit}
                    disabled={createRaffle.isLoading}
                    className="flex-1 py-2.5 btn-primary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createRaffle.isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-dark/30 border-t-dark rounded-full animate-spin" />
                        Creando...
                      </span>
                    ) : (
                      'Crear Rifa'
                    )}
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CreateRaffleModal;
