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
  Check,
  Upload,
  Palette,
  Zap,
  Clock,
  Hand
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { useCreateRaffle, useRaffleSettings } from '../hooks/useRaffleData';
import { CreateRaffleForm, RaffleMode, RaffleVisibility, DrawMode } from '../types';
import { RAFFLE_LIMITS, VALIDATION_RULES, UI_TEXTS } from '../constants';
import { VENEZUELAN_BANKS } from '../../../constants/banks';
import { processImage } from '../utils/imageHelpers';

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
  const raffleSettingsQuery = useRaffleSettings();
  
  const [step, setStep] = useState(1);
  const [isCompanyMode, setIsCompanyMode] = useState(false);
  const [prizeImageBase64, setPrizeImageBase64] = useState<string>('');
  const [logoBase64, setLogoBase64] = useState<string>('');
  const [allowFiresPayment, setAllowFiresPayment] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>(DrawMode.AUTOMATIC);
  const [scheduledDrawAt, setScheduledDrawAt] = useState<string>('');
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
      prizeImages: [],
      bankingInfo: {
        accountHolder: '',
        bankCode: '',
        bankName: '',
        accountNumber: '',
        accountType: 'ahorro',
        idNumber: '',
        phone: ''
      }
    },
    companyConfig: undefined
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const prizeCreationCost = raffleSettingsQuery.data?.prizeModeCostFires ?? 500;
  const companyCreationCost = raffleSettingsQuery.data?.companyModeCostFires ?? 500;
  
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
        const maxNumbers = (isCompanyMode || formData.visibility === RaffleVisibility.COMPANY)
          ? RAFFLE_LIMITS.MAX_NUMBERS_COMPANY
          : RAFFLE_LIMITS.MAX_NUMBERS_NORMAL;
        if (num < RAFFLE_LIMITS.MIN_NUMBERS) {
          newErrors.numbersRange = `Mínimo ${RAFFLE_LIMITS.MIN_NUMBERS} números`;
        } else if (num > maxNumbers) {
          newErrors.numbersRange = `Máximo ${maxNumbers} números`;
        } else {
          delete newErrors.numbersRange;
        }
        break;
        
      case 'entryPrice':
        const price = parseFloat(value);
        if (formData.mode !== RaffleMode.PRIZE) {
          const minPrice = formData.mode === RaffleMode.FIRES 
            ? RAFFLE_LIMITS.MIN_PRICE_FIRES 
            : RAFFLE_LIMITS.MIN_PRICE_COINS;
          const maxPrice = formData.mode === RaffleMode.FIRES 
            ? RAFFLE_LIMITS.MAX_PRICE_FIRES 
            : RAFFLE_LIMITS.MAX_PRICE_COINS;
          
          if (price < minPrice) {
            newErrors.entryPrice = `Precio mínimo ${minPrice}`;
          } else if (price > maxPrice) {
            newErrors.entryPrice = `Precio máximo ${maxPrice}`;
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
          if (!formData.prizeMeta?.bankingInfo?.accountHolder) {
            toast.error('Por favor ingresa el nombre del titular');
            return false;
          }
          if (!formData.prizeMeta?.bankingInfo?.bankName) {
            toast.error('Por favor ingresa el banco');
            return false;
          }
          if (!formData.prizeMeta?.bankingInfo?.accountNumber) {
            toast.error('Por favor ingresa el número de cuenta');
            return false;
          }
          if (!formData.prizeMeta?.bankingInfo?.phone) {
            toast.error('Por favor ingresa el teléfono de contacto');
            return false;
          }
        } else {
          const minPrice = formData.mode === RaffleMode.FIRES 
            ? RAFFLE_LIMITS.MIN_PRICE_FIRES 
            : RAFFLE_LIMITS.MIN_PRICE_COINS;
          if (formData.entryPrice < minPrice) {
            toast.error(`El precio mínimo es ${minPrice}`);
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
      
      case 4:
        // Validar que se haya seleccionado un modo de sorteo
        if (!drawMode) {
          toast.error('Por favor selecciona un modo de victoria');
          console.warn('[CreateRaffleModal] drawMode no seleccionado');
          return false;
        }
        
        // Si es programado, verificar fecha
        if (drawMode === DrawMode.SCHEDULED) {
          if (!scheduledDrawAt) {
            toast.error('Por favor ingresa la fecha y hora del sorteo');
            console.warn('[CreateRaffleModal] scheduledDrawAt vacío');
            return false;
          }
          
          const scheduledDate = new Date(scheduledDrawAt);
          const now = new Date();
          if (scheduledDate <= now) {
            toast.error('La fecha debe ser futura');
            console.warn('[CreateRaffleModal] scheduledDrawAt es pasada');
            return false;
          }
        }
        
        console.log('[CreateRaffleModal] Paso 4 validado correctamente', { drawMode, scheduledDrawAt });
        break;
    }
    
    return true;
  };
  
  // Avanzar paso
  const nextStep = () => {
    console.log('[CreateRaffleModal] nextStep llamado', {
      currentStep: step,
      drawMode,
      formData
    });
    
    if (validateStep()) {
      console.log('[CreateRaffleModal] Validación exitosa, avanzando a:', step + 1);
      setStep(prev => Math.min(prev + 1, 5)); // FIXED: 4 → 5 pasos
    } else {
      console.warn('[CreateRaffleModal] Validación fallida, no se puede avanzar');
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
      const requiredFires = formData.visibility === 'company'
        ? companyCreationCost
        : prizeCreationCost;
      if ((user?.fires_balance || 0) < requiredFires) {
        toast.error(`Necesitas ${requiredFires} fuegos para crear una rifa en modo premio`);
        return;
      }
    }
    
    try {
      // Agregar datos de base64, toggle y modo de sorteo al payload
      const payload: any = {
        ...formData,
        allowFiresPayment: formData.mode === RaffleMode.PRIZE ? allowFiresPayment : undefined,
        prizeImageBase64: prizeImageBase64 || undefined,
        drawMode: drawMode,
        scheduledDrawAt: drawMode === DrawMode.SCHEDULED ? scheduledDrawAt : undefined,
        companyConfig: formData.companyConfig ? {
          ...formData.companyConfig,
          logoBase64: logoBase64 || undefined
        } : undefined
      };
      // En modo Premio, no enviar entryPrice (backend lo prohíbe)
      if (payload.mode === RaffleMode.PRIZE) {
        delete payload.entryPrice;
      }
      
      const result = await createRaffle.mutateAsync(payload);
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
                max={(isCompanyMode || formData.visibility === RaffleVisibility.COMPANY)
                  ? RAFFLE_LIMITS.MAX_NUMBERS_COMPANY
                  : RAFFLE_LIMITS.MAX_NUMBERS_NORMAL}
                className={`w-full px-4 py-2 bg-glass rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent ${
                  errors.numbersRange ? 'ring-2 ring-red-500' : ''
                }`}
              />
              {errors.numbersRange && (
                <p className="text-xs text-red-500 mt-1">{errors.numbersRange}</p>
              )}
            </div>
            
            {/* Toggle Modo Empresa */}
            <div className="pt-4 border-t border-white/10">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCompanyMode}
                  onChange={(e) => {
                    setIsCompanyMode(e.target.checked);
                    if (e.target.checked) {
                      updateField('visibility', RaffleVisibility.COMPANY);
                      updateField('mode', RaffleMode.PRIZE);
                    } else {
                      updateField('visibility', RaffleVisibility.PUBLIC);
                      updateField('companyConfig', undefined);
                    }
                  }}
                  className="w-5 h-5 rounded bg-glass border-2 border-white/20 checked:bg-accent checked:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <div>
                  <div className="text-sm font-medium text-text flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Modo Empresa
                  </div>
                  <div className="text-xs text-text/60">
                    Activa landing pública personalizada con branding
                  </div>
                </div>
              </label>
            </div>
            
            {/* Campos de Empresa (condicional) */}
            {isCompanyMode && (
              <div className="space-y-3 pt-3 border-t border-white/10">
                <h4 className="text-sm font-semibold text-text">
                  Información de la Empresa (Opcional)
                </h4>
                
                <div>
                  <label className="block text-sm text-text/80 mb-1">
                    Nombre de la Empresa
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
                
                {/* Upload Logo */}
                <div>
                  <label className="block text-sm text-text/80 mb-1">
                    Logo de la Empresa
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          toast.success('Logo seleccionado (carga pendiente)');
                          // TODO: Implementar upload a Cloudinary/S3
                        }
                      }}
                      className="hidden"
                      id="company-logo-upload"
                    />
                    <label
                      htmlFor="company-logo-upload"
                      className="w-full px-4 py-3 bg-glass rounded-lg text-text cursor-pointer hover:bg-glass-lighter transition-colors flex items-center justify-center gap-2 border-2 border-dashed border-white/20 hover:border-accent/50"
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-sm">Subir logo de empresa</span>
                    </label>
                  </div>
                  <p className="text-xs text-text/60 mt-1">PNG o JPG. Máx. 2MB</p>
                </div>
                
                {/* Selectores de Color */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-text/80 mb-1 flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      Color Primario
                    </label>
                    <input
                      type="color"
                      value={formData.companyConfig?.primaryColor || '#8B5CF6'}
                      onChange={(e) => updateField('companyConfig', {
                        ...formData.companyConfig,
                        primaryColor: e.target.value
                      })}
                      className="w-full h-10 rounded-lg cursor-pointer bg-glass border-2 border-white/20 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-text/80 mb-1 flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      Color Secundario
                    </label>
                    <input
                      type="color"
                      value={formData.companyConfig?.secondaryColor || '#06B6D4'}
                      onChange={(e) => updateField('companyConfig', {
                        ...formData.companyConfig,
                        secondaryColor: e.target.value
                      })}
                      className="w-full h-10 rounded-lg cursor-pointer bg-glass border-2 border-white/20 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
        
      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-text mb-2">
              Modo de Rifa
            </h3>
            
            {/* Aviso si modo empresa está activo */}
            {isCompanyMode && (
              <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 mb-3">
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-accent mt-0.5" />
                  <div className="text-xs text-accent">
                    <p className="font-semibold">Modo Empresa Activo</p>
                    <p>Las rifas empresariales siempre usan modo Premio</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Selector de modo */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: RaffleMode.FIRES, label: 'Fuegos', icon: '🔥' },
                { value: RaffleMode.PRIZE, label: 'Premio', icon: '🎁' }
              ].map(mode => (
                <button
                  key={mode.value}
                  onClick={() => !isCompanyMode && updateField('mode', mode.value)}
                  disabled={isCompanyMode && mode.value !== RaffleMode.PRIZE}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.mode === mode.value
                      ? 'border-accent bg-accent/20'
                      : 'border-white/10 bg-glass hover:bg-glass-lighter'
                  } ${isCompanyMode && mode.value !== RaffleMode.PRIZE ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="text-3xl mb-2">{mode.icon}</div>
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
                    min={formData.mode === RaffleMode.FIRES ? RAFFLE_LIMITS.MIN_PRICE_FIRES : RAFFLE_LIMITS.MIN_PRICE_COINS}
                    max={formData.mode === RaffleMode.FIRES ? RAFFLE_LIMITS.MAX_PRICE_FIRES : RAFFLE_LIMITS.MAX_PRICE_COINS}
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
                
                {/* Imagen del premio */}
                <div>
                  <label className="block text-sm text-text/80 mb-1">
                    Imagen del Premio
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const result = await processImage(file, 5);
                          if (result.error) {
                            toast.error(result.error);
                          } else {
                            setPrizeImageBase64(result.base64);
                            toast.success('Imagen cargada exitosamente');
                          }
                        }
                      }}
                      className="hidden"
                      id="prize-image-upload"
                    />
                    <label
                      htmlFor="prize-image-upload"
                      className="w-full px-4 py-3 bg-glass rounded-lg text-text cursor-pointer hover:bg-glass-lighter transition-colors flex items-center justify-center gap-2 border-2 border-dashed border-white/20 hover:border-accent/50"
                    >
                      <Image className="w-5 h-5" />
                      <span className="text-sm">{prizeImageBase64 ? '✅ Imagen cargada' : 'Seleccionar imagen del premio'}</span>
                    </label>
                  </div>
                  <p className="text-xs text-text/60 mt-1">JPG, PNG o GIF. Máx. 5MB</p>
                </div>
                
                {/* Toggle Permitir Pago con Fuegos */}
                {formData.mode === RaffleMode.PRIZE && (
                  <div className="pt-3 border-t border-white/10">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowFiresPayment}
                        onChange={(e) => setAllowFiresPayment(e.target.checked)}
                        className="w-5 h-5 rounded bg-glass border-2 border-white/20 checked:bg-accent checked:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
                      />
                      <div>
                        <div className="text-sm font-medium text-text">Permitir Pago con Fuegos</div>
                        <div className="text-xs text-text/60">
                          Los compradores podrán pagar con sus fuegos sin aprobación
                        </div>
                      </div>
                    </label>
                  </div>
                )}
                
                {/* Datos bancarios para pago */}
                <div className="space-y-3 pt-3 border-t border-white/10">
                  <h4 className="text-sm font-semibold text-text flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-accent" />
                    Datos Bancarios para Recibir Pagos
                  </h4>
                  <p className="text-xs text-text/60">Los participantes verán esta información para transferir el pago</p>
                  
                  <div>
                    <label className="block text-sm text-text/80 mb-1">
                      Nombre del Titular *
                    </label>
                    <input
                      type="text"
                      value={formData.prizeMeta?.bankingInfo?.accountHolder || ''}
                      onChange={(e) => updateField('prizeMeta', {
                        ...formData.prizeMeta,
                        bankingInfo: {
                          ...formData.prizeMeta?.bankingInfo,
                          accountHolder: e.target.value
                        }
                      })}
                      placeholder="Nombre completo del titular"
                      className="w-full px-4 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-text/80 mb-1">
                      Banco *
                    </label>
                    <select
                      value={formData.prizeMeta?.bankingInfo?.bankCode || ''}
                      onChange={(e) => {
                        const selected = VENEZUELAN_BANKS.find(b => b.code === e.target.value);
                        updateField('prizeMeta', {
                          ...formData.prizeMeta,
                          bankingInfo: {
                            ...formData.prizeMeta?.bankingInfo,
                            bankCode: e.target.value,
                            bankName: selected?.fullName || ''
                          }
                        });
                      }}
                      className="w-full px-4 py-2 bg-glass rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="">Seleccionar banco...</option>
                      {VENEZUELAN_BANKS.map(bank => (
                        <option key={bank.code} value={bank.code}>
                          {bank.code} - {bank.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-text/80 mb-1">
                        Número de Cédula *
                      </label>
                      <input
                        type="text"
                        value={formData.prizeMeta?.bankingInfo?.idNumber || ''}
                        onChange={(e) => updateField('prizeMeta', {
                          ...formData.prizeMeta,
                          bankingInfo: {
                            ...formData.prizeMeta?.bankingInfo,
                            idNumber: e.target.value
                          }
                        })}
                        placeholder="V-12345678"
                        className="w-full px-4 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-text/80 mb-1">
                        Tipo de Cuenta *
                      </label>
                      <select
                        value={formData.prizeMeta?.bankingInfo?.accountType || 'ahorro'}
                        onChange={(e) => updateField('prizeMeta', {
                          ...formData.prizeMeta,
                          bankingInfo: {
                            ...formData.prizeMeta?.bankingInfo,
                            accountType: e.target.value as 'ahorro' | 'corriente'
                          }
                        })}
                        className="w-full px-4 py-2 bg-glass rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="ahorro">Ahorro</option>
                        <option value="corriente">Corriente</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-text/80 mb-1">
                      Número de Cuenta *
                    </label>
                    <input
                      type="text"
                      value={formData.prizeMeta?.bankingInfo?.accountNumber || ''}
                      onChange={(e) => updateField('prizeMeta', {
                        ...formData.prizeMeta,
                        bankingInfo: {
                          ...formData.prizeMeta?.bankingInfo,
                          accountNumber: e.target.value
                        }
                      })}
                      placeholder="0000-0000-00-0000000000"
                      className="w-full px-4 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-text/80 mb-1">
                      Teléfono de Contacto *
                    </label>
                    <input
                      type="tel"
                      value={formData.prizeMeta?.bankingInfo?.phone || ''}
                      onChange={(e) => updateField('prizeMeta', {
                        ...formData.prizeMeta,
                        bankingInfo: {
                          ...formData.prizeMeta?.bankingInfo,
                          phone: e.target.value
                        }
                      })}
                      placeholder="0414-1234567"
                      className="w-full px-4 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>
                
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
                    <div className="text-xs text-warning">
                      <p className="font-semibold">Costo de creación:</p>
                      <p>
                        {formData.visibility === 'company'
                          ? companyCreationCost
                          : prizeCreationCost}{' '}
                        fuegos
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
              Visibilidad de la Rifa
            </h3>
            
            {/* Aviso si modo empresa está activo */}
            {isCompanyMode && (
              <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 mb-3">
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-accent mt-0.5" />
                  <div className="text-xs text-accent">
                    <p className="font-semibold">Modo Empresa Activo</p>
                    <p>Las rifas empresariales siempre tienen visibilidad "Empresa"</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Selector de visibilidad */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => !isCompanyMode && updateField('visibility', RaffleVisibility.PUBLIC)}
                disabled={isCompanyMode}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.visibility === RaffleVisibility.PUBLIC
                    ? 'border-accent bg-accent/20'
                    : 'border-white/10 bg-glass hover:bg-glass-lighter'
                } ${isCompanyMode ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Globe className="w-8 h-8 mx-auto mb-2 text-accent" />
                <div className="text-sm font-medium text-text">Pública</div>
                <div className="text-xs text-text/60 mt-1">Todos pueden ver y participar</div>
              </button>
              
              <button
                onClick={() => !isCompanyMode && updateField('visibility', RaffleVisibility.PRIVATE)}
                disabled={isCompanyMode}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.visibility === RaffleVisibility.PRIVATE
                    ? 'border-accent bg-accent/20'
                    : 'border-white/10 bg-glass hover:bg-glass-lighter'
                } ${isCompanyMode ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Lock className="w-8 h-8 mx-auto mb-2 text-accent" />
                <div className="text-sm font-medium text-text">Privada</div>
                <div className="text-xs text-text/60 mt-1">Solo con código de acceso</div>
              </button>
            </div>
            
            <div className="bg-info/10 border border-info/30 rounded-lg p-3 mt-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-info mt-0.5" />
                <div className="text-xs text-info">
                  <p className="font-semibold mb-1">Sobre la visibilidad</p>
                  <p>• <strong>Pública:</strong> Aparece en el lobby, cualquiera puede participar</p>
                  <p>• <strong>Privada:</strong> Solo con el código, ideal para grupos privados</p>
                </div>
              </div>
            </div>
          </div>
        );
        
      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-text mb-2">
              Modo de Victoria
            </h3>
            
            <p className="text-sm text-text/70 mb-4">
              Elige cómo se determinará el ganador de la rifa
            </p>
            
            {/* Selector de modo de sorteo */}
            <div className="space-y-3">
              {/* Automático */}
              <button
                onClick={() => setDrawMode(DrawMode.AUTOMATIC)}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  drawMode === DrawMode.AUTOMATIC
                    ? 'border-accent bg-accent/20'
                    : 'border-white/10 bg-glass hover:bg-glass-lighter'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Zap className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-text mb-1">
                      Automático (Recomendado)
                    </div>
                    <div className="text-xs text-text/70">
                      El ganador se elige automáticamente 10 segundos después de que se venda el último número
                    </div>
                  </div>
                  {drawMode === DrawMode.AUTOMATIC && (
                    <Check className="w-5 h-5 text-accent flex-shrink-0" />
                  )}
                </div>
              </button>
              
              {/* Programado */}
              <button
                onClick={() => setDrawMode(DrawMode.SCHEDULED)}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  drawMode === DrawMode.SCHEDULED
                    ? 'border-accent bg-accent/20'
                    : 'border-white/10 bg-glass hover:bg-glass-lighter'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Clock className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-text mb-1">
                      Fecha Programada
                    </div>
                    <div className="text-xs text-text/70">
                      Elige una fecha y hora específica para realizar el sorteo
                    </div>
                  </div>
                  {drawMode === DrawMode.SCHEDULED && (
                    <Check className="w-5 h-5 text-accent flex-shrink-0" />
                  )}
                </div>
              </button>
              
              {/* Campo de fecha si está en modo programado */}
              {drawMode === DrawMode.SCHEDULED && (
                <div className="ml-9 mt-2">
                  <label className="block text-sm text-text/80 mb-1">
                    Fecha y Hora del Sorteo *
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledDrawAt}
                    onChange={(e) => setScheduledDrawAt(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-4 py-2 bg-glass rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              )}
              
              {/* Manual */}
              <button
                onClick={() => setDrawMode(DrawMode.MANUAL)}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  drawMode === DrawMode.MANUAL
                    ? 'border-accent bg-accent/20'
                    : 'border-white/10 bg-glass hover:bg-glass-lighter'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Hand className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-text mb-1">
                      Manual
                    </div>
                    <div className="text-xs text-text/70">
                      Tú decides cuándo elegir el ganador con un botón en la sala de la rifa
                    </div>
                  </div>
                  {drawMode === DrawMode.MANUAL && (
                    <Check className="w-5 h-5 text-accent flex-shrink-0" />
                  )}
                </div>
              </button>
            </div>
            
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mt-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
                <div className="text-xs text-warning">
                  <p className="font-semibold mb-1">Importante</p>
                  <p>
                    {drawMode === DrawMode.AUTOMATIC && 'El sorteo se ejecutará automáticamente. No podrás cancelarlo una vez iniciado.'}
                    {drawMode === DrawMode.SCHEDULED && 'El sorteo se ejecutará en la fecha programada. Asegúrate de que todos los números estén vendidos para esa fecha.'}
                    {drawMode === DrawMode.MANUAL && 'Tendrás control total sobre cuándo se elige el ganador, pero debes hacerlo manualmente.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
        
      case 5:
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-dark rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
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
                  <p className="text-sm text-text/60">Paso {step} de 5</p>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="mt-4 h-2 bg-dark/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: `${(step / 5) * 100}%` }}
                  className="h-full bg-gradient-to-r from-accent to-fire-orange"
                />
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto min-h-0">
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
                
                {step < 5 ? (
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
                    disabled={createRaffle.isPending}
                    className="flex-1 py-2.5 btn-primary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createRaffle.isPending ? (
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CreateRaffleModal;
