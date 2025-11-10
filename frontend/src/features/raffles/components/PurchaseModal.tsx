/**
 * Sistema de Rifas V2 - PurchaseModal Component
 * Modal para comprar números en una rifa
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ShoppingCart,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Loader,
  Info,
  DollarSign,
  FileText,
  Upload
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { usePurchaseNumber, useReleaseNumber } from '../hooks/useRaffleData';
import { RaffleMode, PaymentMethod } from '../types';

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
  
  const pricePerNumber = raffle?.mode === 'fires' 
    ? (raffle?.entryPriceFire || 0) 
    : (raffle?.entryPriceCoin || 0);
  const totalCost = selectedNumbers.length * pricePerNumber;
  const userBalance = raffle?.mode === 'fires' 
    ? user?.fires_balance || 0 
    : user?.coins_balance || 0;
  
  // Validar balance
  const hasBalance = raffle?.mode === 'prize' || userBalance >= totalCost;
  
  // Manejar cierre con liberación
  const handleClose = async () => {
    if (selectedNumbers.length > 0 && !isProcessing) {
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
    // Validar datos
    if (!paymentData.fullName || !paymentData.cedula || !paymentData.phone) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }
    
    if (!paymentData.paymentMethod) {
      toast.error('Por favor selecciona un método de pago');
      return;
    }
    
    if (!paymentData.referenceNumber) {
      toast.error('Por favor ingresa el número de referencia');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Crear FormData para enviar imagen
      const formData = new FormData();
      formData.append('code', raffle.code);
      formData.append('numbers', JSON.stringify(selectedNumbers));
      formData.append('paymentData', JSON.stringify({
        fullName: paymentData.fullName,
        cedula: paymentData.cedula,
        phone: paymentData.phone,
        email: paymentData.email,
        paymentMethod: paymentData.paymentMethod,
        referenceNumber: paymentData.referenceNumber
      }));
      
      if (paymentData.proofImage) {
        formData.append('proofImage', paymentData.proofImage);
      }
      
      // Comprar cada número con datos de pago
      const form = {
        buyerName: paymentData.fullName,
        buyerDocument: paymentData.cedula,
        buyerPhone: paymentData.phone,
        buyerEmail: paymentData.email,
        paymentMethod: paymentData.paymentMethod as PaymentMethod,
        paymentReference: paymentData.referenceNumber
      };
      
      for (const idx of selectedNumbers) {
        await purchaseNumbers.mutateAsync({
          code: raffle.code,
          idx,
          form
        });
      }
      
      toast.success('¡Solicitud enviada! El organizador revisará tu pago pronto');
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
                Información de Pago
              </h3>
              
              {/* Métodos de pago disponibles */}
              <div>
                <label className="block text-sm text-text/80 mb-2">
                  Método de Pago *
                </label>
                <div className="space-y-2">
                  {raffle.paymentMethods?.map((method: any) => (
                    <label
                      key={method.id}
                      className={`flex items-start gap-3 p-3 bg-glass/50 rounded-lg cursor-pointer transition-all ${
                        paymentData.paymentMethod === method.id
                          ? 'ring-2 ring-accent bg-accent/10'
                          : 'hover:bg-glass'
                      }`}
                    >
                      <input
                        type="radio"
                        value={method.id}
                        checked={paymentData.paymentMethod === method.id}
                        onChange={(e) => setPaymentData({...paymentData, paymentMethod: e.target.value})}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-text">{method.type === 'transfer' ? 'Transferencia' : 'Efectivo'}</p>
                        {method.type === 'transfer' && (
                          <div className="mt-1 text-sm text-text/80">
                            <p>Banco: {method.bankName}</p>
                            <p>Cuenta: {method.accountNumber}</p>
                            <p>Titular: {method.accountHolder}</p>
                          </div>
                        )}
                        {method.instructions && (
                          <p className="mt-1 text-xs text-text/60">{method.instructions}</p>
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
              
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-warning mt-0.5" />
                  <div className="text-xs text-warning">
                    <p className="font-semibold mb-1">Importante:</p>
                    <p>Tu compra será revisada por el organizador. Recibirás una notificación cuando sea aprobada.</p>
                  </div>
                </div>
              </div>
              
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
                  disabled={isProcessing || !paymentData.paymentMethod || !paymentData.referenceNumber}
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-start p-0"
          >
            {/* Modal - Alineado a la izquierda */}
            <motion.div
              initial={{ opacity: 0, x: -100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md sm:max-w-lg h-full sm:h-auto sm:max-h-[95vh] bg-dark sm:rounded-r-2xl shadow-2xl overflow-hidden flex flex-col relative sm:ml-0"
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
