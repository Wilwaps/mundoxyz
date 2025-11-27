/**
 * Sistema de Rifas V2 - PurchaseModal Component
 * Modal para comprar números en una rifa
 */

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ShoppingCart,
  AlertCircle,
  Loader,
  Info,
  Upload
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { usePurchaseNumber, useReleaseNumber } from '../hooks/useRaffleData';
import { PaymentMethod } from '../types';
import { processImage } from '../utils/imageHelpers';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  raffle: any;
  selectedNumbers: number[];
  onSuccess: () => void;
}

const PurchaseModal: React.FC<PurchaseModalProps> = ({
  isOpen,
  onClose,
  raffle,
  selectedNumbers,
  onSuccess
}) => {
  const { user } = useAuth();
  const purchaseNumbers = usePurchaseNumber();
  const releaseNumbers = useReleaseNumber();
  
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const hasSubmittedRef = useRef(false);
  
  // Para modo premio
  const [paymentData, setPaymentData] = useState({
    fullName: '',
    cedula: '',
    phone: '',
    email: '',
    paymentMethod: '',
    referenceNumber: '',
    proofImage: null as File | null
  });
  
  const isPromotion = !!raffle?.prizeMeta?.isPromotion;
  
  const pricePerNumber = raffle?.mode === 'fires' 
    ? (raffle?.entryPriceFire || 0) 
    : (raffle?.entryPriceCoin || 0);
  const totalCost = selectedNumbers.length * pricePerNumber;
  const userBalance = raffle?.mode === 'fires' 
    ? user?.fires_balance || 0 
    : user?.coins_balance || 0;
  
  // Validar balance
  const hasBalance = raffle?.mode === 'prize' || userBalance >= totalCost;
  
  // Manejar cierre con liberación (también en PRIZE si no se envió solicitud)
  const handleClose = async () => {
    if (selectedNumbers.length > 0 && !isProcessing && !hasSubmittedRef.current) {
      try {
        // Liberar cada número individualmente
        for (const idx of selectedNumbers) {
          await releaseNumbers.mutateAsync({
            code: raffle.code,
            idx
          });
        }
      } catch (error) {
        console.error('Error releasing numbers:', error);
      }
    }
    setStep(1);
    setPaymentData({
      fullName: '',
      cedula: '',
      phone: '',
      email: '',
      paymentMethod: '',
      referenceNumber: '',
      proofImage: null
    });
    onClose();
  };
  
  // Procesar compra - Modo Fuegos/Monedas
  const processCurrencyPurchase = async () => {
    if (!hasBalance) {
      toast.error('No tienes suficiente saldo');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Comprar cada número individualmente
      for (const idx of selectedNumbers) {
        await purchaseNumbers.mutateAsync({
          code: raffle.code,
          idx,
          form: {
            paymentMethod: PaymentMethod.FIRES // Pago con moneda virtual
          }
        });
      }
      
      toast.success('¡Compra realizada exitosamente!');
      onSuccess();
    } catch (error) {
      // El error ya se maneja en el hook
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Procesar compra - Modo Premio
  const processPrizePurchase = async () => {
    // Validar datos personales
    if (!paymentData.fullName || !paymentData.cedula || !paymentData.phone) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }
    
    let method: PaymentMethod | string | undefined = paymentData.paymentMethod as PaymentMethod | undefined;
    let needsReference = false;
    
    if (!isPromotion) {
      if (!paymentData.paymentMethod) {
        toast.error('Por favor selecciona un método de pago');
        return;
      }
      // Referencia solo requerida para MOBILE y BANK
      needsReference = paymentData.paymentMethod === PaymentMethod.MOBILE || paymentData.paymentMethod === PaymentMethod.BANK;
      if (needsReference && !paymentData.referenceNumber) {
        toast.error('Por favor ingresa el número de referencia');
        return;
      }
    } else {
      // En promociones no se requiere método de pago ni referencia; usamos CASH como marcador interno
      method = PaymentMethod.CASH;
      needsReference = false;
    }
    
    setIsProcessing(true);
    
    try {
      // Normalizar datos para cumplir con Joi en backend
      // - Phone: aceptar '0412-xxxxxxx' convirtiendo a '+58xxxxxxxxxx'
      // - Documento: quitar guiones y mayúsculas sin espacios (p.ej. 'V-12345678' -> 'V12345678')
      // - Referencia: enviar en mayúsculas, alfanumérica
      let normalizedPhone = (paymentData.phone || '').trim();
      const rawDigits = normalizedPhone.replace(/[^0-9+]/g, '');
      if (/^0\d{10}$/.test(rawDigits)) {
        // 0 + 10 dígitos -> usar formato internacional +58 + (sin 0)
        normalizedPhone = `+58${rawDigits.slice(1)}`;
      } else if (/^\+58\d{10}$/.test(rawDigits)) {
        normalizedPhone = rawDigits; // ya está correcto
      } else if (/^\d{10}$/.test(rawDigits)) {
        normalizedPhone = rawDigits; // 10 dígitos locales
      } else {
        // fallback: dejar solo dígitos y si tiene 11 empezando en 0, recortar 0
        const onlyDigits = (paymentData.phone || '').replace(/\D/g, '');
        normalizedPhone = onlyDigits.length === 11 && onlyDigits.startsWith('0')
          ? `+58${onlyDigits.slice(1)}`
          : onlyDigits;
      }

      const normalizedDocument = (paymentData.cedula || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ''); // quita guiones y espacios

      const normalizedReference = (paymentData.referenceNumber || '')
        .toUpperCase()
        .replace(/\s+/g, '');

      // Si hay imagen de comprobante, convertirla a base64
      let paymentProofBase64: string | undefined;
      if (paymentData.proofImage) {
        const result = await processImage(paymentData.proofImage, 5);
        if (result.error) {
          toast.error(result.error);
        } else {
          paymentProofBase64 = result.base64;
        }
      }

      // Comprar cada número con datos de pago
      const form: any = {
        buyerName: paymentData.fullName,
        buyerDocument: normalizedDocument,
        buyerPhone: normalizedPhone,
        ...(paymentData.email?.trim() ? { buyerEmail: paymentData.email.trim() } : {}),
        paymentMethod: method as PaymentMethod,
        ...(needsReference ? { paymentReference: normalizedReference } : {}),
        ...(paymentProofBase64 ? { paymentProofBase64 } : {})
      };
      
      for (const idx of selectedNumbers) {
        await purchaseNumbers.mutateAsync({
          code: raffle.code,
          idx,
          form
        });
      }
      
      toast.success('¡Solicitud enviada! El organizador revisará tu pago pronto');
      hasSubmittedRef.current = true; // Evitar liberar después del envío
      onSuccess();
    } catch (error) {
      // El error ya se maneja en el hook
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Renderizar contenido según modo
  const renderContent = () => {
    if (raffle?.mode === 'prize') {
      // Modo premio - Formulario de pago
      return (
        <div className="space-y-4">
          {step === 1 ? (
            <>
              <h3 className="text-lg font-semibold text-text mb-2">
                Información Personal
              </h3>
              
              <div>
                <label className="block text-sm text-text/80 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={paymentData.fullName}
                  onChange={(e) => setPaymentData({...paymentData, fullName: e.target.value})}
                  placeholder="Juan Pérez"
                  className="w-full px-4 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-text/80 mb-1">
                    Cédula *
                  </label>
                  <input
                    type="text"
                    value={paymentData.cedula}
                    onChange={(e) => setPaymentData({...paymentData, cedula: e.target.value})}
                    placeholder="V-12345678"
                    className="w-full px-4 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-text/80 mb-1">
                    Teléfono *
                  </label>
                  <input
                    type="tel"
                    value={paymentData.phone}
                    onChange={(e) => setPaymentData({...paymentData, phone: e.target.value})}
                    placeholder="0412-1234567"
                    className="w-full px-4 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-text/80 mb-1">
                  Email (opcional)
                </label>
                <input
                  type="email"
                  value={paymentData.email}
                  onChange={(e) => setPaymentData({...paymentData, email: e.target.value})}
                  placeholder="correo@ejemplo.com"
                  className="w-full px-4 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleClose}
                  className="flex-1 py-2.5 bg-glass rounded-lg text-text hover:bg-glass-lighter transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!paymentData.fullName || !paymentData.cedula || !paymentData.phone}
                  className="flex-1 py-2.5 btn-primary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuar
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-text mb-2">
                {isPromotion ? 'Confirmar participación (Promoción gratuita)' : 'Información de Pago'}
              </h3>
              {raffle?.prizeMeta?.prizeValue && (
                <div className="mb-4 bg-dark rounded-lg p-4 border border-white/10">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-text/60">Números seleccionados:</span>
                    <span className="text-text font-medium">{selectedNumbers.join(', ')}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-text/60">Monto estimado del premio:</span>
                    <span className="text-text font-semibold">{raffle.prizeMeta.prizeValue} 🔥</span>
                  </div>
                  <p className="text-[11px] text-text/60 mt-1">
                    Referencia interna: 1 USDT ≈ 300🔥. Valor aproximado: {(
                      (raffle.prizeMeta.prizeValue as number) / 300
                    ).toFixed(2)} USDT.
                  </p>
                </div>
              )}
              
              {/* Datos bancarios del host (solo si no es promoción) */}
              {!isPromotion && raffle?.prizeMeta?.bankingInfo && (
                <div className="bg-glass/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-text">Datos bancarios del organizador</p>
                    <button
                      type="button"
                      className="text-xs px-2 py-1 rounded bg-glass hover:bg-glass/80 text-text/80"
                      onClick={() => {
                        const b = raffle.prizeMeta.bankingInfo;
                        const all = `Titular: ${b.accountHolder}\nBanco: ${b.bankName}\nCuenta: ${b.accountNumber}\nTipo: ${b.accountType}\nTeléfono: ${b.phone}`;
                        navigator.clipboard.writeText(all);
                        toast.success('Datos bancarios copiados');
                      }}
                    >Copiar todo</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center justify-between gap-2 bg-glass/40 rounded px-3 py-2">
                      <span className="text-text/80">Titular: <span className="text-text font-medium">{raffle.prizeMeta.bankingInfo.accountHolder}</span></span>
                      <button className="text-xs px-2 py-1 rounded bg-dark/40" onClick={() => {navigator.clipboard.writeText(raffle.prizeMeta.bankingInfo.accountHolder); toast.success('Titular copiado');}}>Copiar</button>
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-glass/40 rounded px-3 py-2">
                      <span className="text-text/80">Banco: <span className="text-text font-medium">{raffle.prizeMeta.bankingInfo.bankName}</span></span>
                      <button className="text-xs px-2 py-1 rounded bg-dark/40" onClick={() => {navigator.clipboard.writeText(raffle.prizeMeta.bankingInfo.bankName); toast.success('Banco copiado');}}>Copiar</button>
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-glass/40 rounded px-3 py-2">
                      <span className="text-text/80">Cuenta: <span className="text-text font-medium">{raffle.prizeMeta.bankingInfo.accountNumber}</span></span>
                      <button className="text-xs px-2 py-1 rounded bg-dark/40" onClick={() => {navigator.clipboard.writeText(raffle.prizeMeta.bankingInfo.accountNumber); toast.success('Cuenta copiada');}}>Copiar</button>
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-glass/40 rounded px-3 py-2">
                      <span className="text-text/80">Tipo: <span className="text-text font-medium capitalize">{raffle.prizeMeta.bankingInfo.accountType}</span></span>
                      <button className="text-xs px-2 py-1 rounded bg-dark/40" onClick={() => {navigator.clipboard.writeText(raffle.prizeMeta.bankingInfo.accountType); toast.success('Tipo copiado');}}>Copiar</button>
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-glass/40 rounded px-3 py-2">
                      <span className="text-text/80">Teléfono: <span className="text-text font-medium">{raffle.prizeMeta.bankingInfo.phone}</span></span>
                      <button className="text-xs px-2 py-1 rounded bg-dark/40" onClick={() => {navigator.clipboard.writeText(raffle.prizeMeta.bankingInfo.phone); toast.success('Teléfono copiado');}}>Copiar</button>
                    </div>
                  </div>
                </div>
              )}

              {!isPromotion && (
                <>
                  {/* Métodos de pago disponibles */}
                  <div>
                    <label className="block text-sm text-text/80 mb-2">
                      Método de Pago *
                    </label>
                    <div className="space-y-2">
                      {[
                        { id: PaymentMethod.CASH, label: 'Efectivo', type: 'cash' },
                        { id: PaymentMethod.MOBILE, label: 'Pago Móvil', type: 'transfer' },
                        { id: PaymentMethod.BANK, label: 'Transferencia Bancaria', type: 'transfer' },
                        ...(raffle?.allowFiresPayment ? [{ id: PaymentMethod.FIRES, label: 'Fuegos', type: 'fires' } as const] : [])
                      ].map((m) => (
                        <label
                          key={m.id}
                          className={`flex items-start gap-3 p-3 bg-glass/50 rounded-lg cursor-pointer transition-all ${paymentData.paymentMethod === m.id ? 'ring-2 ring-accent bg-accent/10' : 'hover:bg-glass'}`}
                        >
                          <input
                            type="radio"
                            value={m.id}
                            checked={paymentData.paymentMethod === m.id}
                            onChange={(e) => setPaymentData({...paymentData, paymentMethod: e.target.value})}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-text">{m.label}</p>
                            {m.type === 'transfer' && raffle?.prizeMeta?.bankingInfo && (
                              <div className="mt-1 text-sm text-text/80">
                                <p>Banco: {raffle.prizeMeta.bankingInfo.bankName}</p>
                                <p>Cuenta: {raffle.prizeMeta.bankingInfo.accountNumber}</p>
                                <p>Titular: {raffle.prizeMeta.bankingInfo.accountHolder}</p>
                              </div>
                            )}
                            {m.id === PaymentMethod.FIRES && (
                              <p className="mt-1 text-xs text-text/60">Pagarás con fuegos. Se transferirá directamente al organizador.</p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-text/80 mb-1">
                      Número de Referencia *
                    </label>
                    <input
                      type="text"
                      value={paymentData.referenceNumber}
                      onChange={(e) => setPaymentData({...paymentData, referenceNumber: e.target.value})}
                      placeholder="Ej: 1234567890"
                      className="w-full px-4 py-2 bg-glass rounded-lg text-text placeholder:text-text/40 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <p className="text-xs text-text/50 mt-1">
                      Requerido solo para Pago Móvil o Transferencia. No es necesario para Efectivo o Fuegos.
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-text/80 mb-1">
                      Comprobante (opcional)
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setPaymentData({
                          ...paymentData,
                          proofImage: e.target.files?.[0] || null
                        })}
                        className="hidden"
                        id="proof-upload"
                      />
                      <label
                        htmlFor="proof-upload"
                        className="flex items-center justify-center gap-2 p-4 bg-glass/50 rounded-lg cursor-pointer hover:bg-glass transition-colors"
                      >
                        <Upload className="w-5 h-5 text-text/60" />
                        <span className="text-text/60">
                          {paymentData.proofImage ? paymentData.proofImage.name : 'Subir imagen'}
                        </span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {isPromotion && (
                <div className="bg-info/10 border border-info/30 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-info mt-0.5" />
                    <div className="text-xs text-info">
                      <p className="font-semibold mb-1">Promoción gratuita</p>
                      <p>No necesitas realizar ningún pago. El organizador revisará tu solicitud y aprobará tu participación en la promoción.</p>
                    </div>
                  </div>
                </div>
              )}

              {!isPromotion && (
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-warning mt-0.5" />
                    <div className="text-xs text-warning">
                      <p className="font-semibold mb-1">Importante:</p>
                      <p>Tu compra será revisada por el organizador. Recibirás una notificación cuando sea aprobada.</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(1)}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 bg-glass rounded-lg text-text hover:bg-glass-lighter transition-colors"
                >
                  Atrás
                </button>
                <button
                  onClick={processPrizePurchase}
                  disabled={
                    isProcessing ||
                    (!isPromotion && (
                      !paymentData.paymentMethod ||
                      ((paymentData.paymentMethod === PaymentMethod.MOBILE || paymentData.paymentMethod === PaymentMethod.BANK) && !paymentData.referenceNumber)
                    ))
                  }
                  className="flex-1 py-2.5 btn-primary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    'Enviar Solicitud'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      );
    }
    
    // Modo Fuegos/Monedas - Confirmación simple
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-text mb-2">
          Confirmar Compra
        </h3>
        
        {/* Resumen */}
        <div className="bg-glass/50 rounded-lg p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-text/60">Números seleccionados:</span>
            <span className="text-text font-medium">
              {selectedNumbers.join(', ')}
            </span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-text/60">Cantidad:</span>
            <span className="text-text">{selectedNumbers.length} números</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-text/60">Precio por número:</span>
            <span className="text-text">
              {pricePerNumber} {raffle?.mode === 'fires' ? '🔥' : '🪙'}
            </span>
          </div>
          
          <div className="pt-3 border-t border-white/10 flex justify-between">
            <span className="text-text font-semibold">Total a pagar:</span>
            <span className="text-fire-orange font-bold text-lg">
              {totalCost} {raffle?.mode === 'fires' ? '🔥' : '🪙'}
            </span>
          </div>
        </div>
        
        {/* Balance */}
        <div className="bg-glass/50 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text/60">Tu saldo actual:</span>
            <span className={`font-bold ${hasBalance ? 'text-green-400' : 'text-red-400'}`}>
              {userBalance.toFixed(2)} {raffle?.mode === 'fires' ? '🔥' : '🪙'}
            </span>
          </div>
          
          {!hasBalance && (
            <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                <div className="text-xs text-red-400">
                  <p className="font-semibold">Saldo insuficiente</p>
                  <p>Necesitas {(totalCost - userBalance).toFixed(2)} {raffle?.mode === 'fires' ? 'fuegos' : 'monedas'} más</p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Acciones */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="flex-1 py-2.5 bg-glass rounded-lg text-text hover:bg-glass-lighter transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={processCurrencyPurchase}
            disabled={!hasBalance || isProcessing}
            className="flex-1 py-2.5 btn-primary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5" />
                Confirmar Compra
              </>
            )}
          </button>
        </div>
      </div>
    );
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!isProcessing ? handleClose : undefined}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            {/* Modal - Centrado */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg max-h-[90vh] bg-dark rounded-2xl shadow-2xl overflow-hidden flex flex-col relative"
            >
            {/* Header */}
            <div className="relative p-6 bg-gradient-to-r from-accent/20 to-fire-orange/20">
              {!isProcessing && (
                <button
                  onClick={handleClose}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-dark/50 hover:bg-dark/80 transition-colors"
                >
                  <X className="w-5 h-5 text-text" />
                </button>
              )}
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text">
                    {raffle?.mode === 'prize' ? 'Solicitar Números' : 'Comprar Números'}
                  </h2>
                  <p className="text-sm text-text/60">
                    {raffle?.mode === 'prize' && step === 1 && 'Paso 1: Información Personal'}
                    {raffle?.mode === 'prize' && step === 2 && 'Paso 2: Información de Pago'}
                    {raffle?.mode !== 'prize' && 'Confirma tu compra'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              {renderContent()}
            </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PurchaseModal;
