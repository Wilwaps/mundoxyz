import React, { useState } from 'react';
import { X, CreditCard, DollarSign, AlertCircle } from 'lucide-react';

const PurchaseModalPrize = ({ isOpen, onClose, onSubmit, selectedNumbers, raffle, paymentMethods, user }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    id_number: '',
    phone: '',
    location: '',
    payment_method: '',
    payment_reference: '',
    message: ''
  });

  const [errors, setErrors] = useState({});

  if (!isOpen) return null;

  const totalCost = selectedNumbers.size * (raffle?.entry_price_fire || 0);

  const validate = () => {
    const newErrors = {};
    if (!formData.full_name.trim()) newErrors.full_name = 'Nombre completo requerido';
    if (!formData.id_number.trim()) newErrors.id_number = 'Cédula requerida';
    if (!formData.phone.trim()) newErrors.phone = 'Teléfono requerido';
    if (!formData.payment_method) newErrors.payment_method = 'Selecciona método de pago';
    
    if (formData.payment_method === 'transferencia' && !formData.payment_reference.trim()) {
      newErrors.payment_reference = 'Referencia bancaria requerida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const buyerProfile = {
      username: user.username,
      display_name: user.display_name || user.username,
      full_name: formData.full_name,
      id_number: formData.id_number,
      phone: formData.phone,
      location: formData.location || null
    };

    onSubmit({
      raffle_id: raffle.id,
      numbers: Array.from(selectedNumbers),
      mode: 'prize',
      buyer_profile: buyerProfile,
      payment_method: formData.payment_method,
      payment_reference: formData.payment_reference || null,
      message: formData.message || null
    });

    onClose();
  };

  const selectedMethod = paymentMethods.find(m => m.method_type === formData.payment_method);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h3 className="text-2xl font-bold text-white">Solicitar Números</h3>
            <p className="text-gray-400 text-sm mt-1">
              Modo premio - Requiere aprobación del anfitrión
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Resumen */}
          <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Números seleccionados:</span>
              <span className="text-white font-bold">{selectedNumbers.size}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-gray-300">Total a pagar:</span>
              <span className="text-yellow-400 font-bold text-xl">{totalCost} 🔥</span>
            </div>
          </div>

          {/* Alert */}
          <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-blue-300">
              <p className="font-semibold mb-1">Proceso de compra modo premio:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-200">
                <li>Completa tus datos y selecciona método de pago</li>
                <li>Los números quedarán reservados por 24 horas</li>
                <li>El anfitrión revisará tu solicitud</li>
                <li>Recibirás una notificación con la respuesta</li>
              </ol>
            </div>
          </div>

          {/* Formulario */}
          <div className="space-y-4">
            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">
                Nombre Completo *
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className={`w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 ${
                  errors.full_name ? 'ring-2 ring-red-500' : 'focus:ring-yellow-500'
                }`}
                placeholder="Juan Pérez"
              />
              {errors.full_name && <p className="text-red-400 text-sm mt-1">{errors.full_name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">
                  Cédula *
                </label>
                <input
                  type="text"
                  value={formData.id_number}
                  onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                  className={`w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 ${
                    errors.id_number ? 'ring-2 ring-red-500' : 'focus:ring-yellow-500'
                  }`}
                  placeholder="V-12345678"
                />
                {errors.id_number && <p className="text-red-400 text-sm mt-1">{errors.id_number}</p>}
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">
                  Teléfono *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={`w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 ${
                    errors.phone ? 'ring-2 ring-red-500' : 'focus:ring-yellow-500'
                  }`}
                  placeholder="0412-1234567"
                />
                {errors.phone && <p className="text-red-400 text-sm mt-1">{errors.phone}</p>}
              </div>
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">
                Ubicación (opcional)
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                placeholder="Caracas, Venezuela"
              />
            </div>

            {/* Métodos de pago */}
            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-3">
                Método de Pago *
              </label>
              <div className="grid grid-cols-2 gap-3">
                {/* Métodos por defecto si no hay configurados */}
                {(!paymentMethods || paymentMethods.length === 0) ? (
                  <>
                    <button
                      onClick={() => setFormData({ ...formData, payment_method: 'efectivo' })}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.payment_method === 'efectivo'
                          ? 'border-yellow-500 bg-yellow-500/20'
                          : 'border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <DollarSign className="text-green-400" size={24} />
                        <div className="text-left">
                          <p className="text-white font-semibold">Efectivo</p>
                          <p className="text-gray-400 text-xs">Pago en persona</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setFormData({ ...formData, payment_method: 'transferencia' })}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.payment_method === 'transferencia'
                          ? 'border-yellow-500 bg-yellow-500/20'
                          : 'border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard className="text-yellow-400" size={24} />
                        <div className="text-left">
                          <p className="text-white font-semibold">Transferencia</p>
                          <p className="text-gray-400 text-xs">Pago móvil / Banco</p>
                        </div>
                      </div>
                    </button>
                  </>
                ) : (
                  paymentMethods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setFormData({ ...formData, payment_method: method.method_type })}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.payment_method === method.method_type
                          ? 'border-yellow-500 bg-yellow-500/20'
                          : 'border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {method.method_type === 'transferencia' ? (
                          <CreditCard className="text-yellow-400" size={24} />
                        ) : (
                          <DollarSign className="text-green-400" size={24} />
                        )}
                        <div className="text-left">
                          <p className="text-white font-semibold capitalize">{method.method_type}</p>
                          <p className="text-gray-400 text-xs">
                            {method.method_type === 'transferencia' ? 'Banco' : 'Efectivo'}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
              {errors.payment_method && <p className="text-red-400 text-sm mt-2">{errors.payment_method}</p>}
            </div>

            {/* Detalles del método seleccionado */}
            {selectedMethod && (
              <div className="bg-gray-700/50 rounded-lg p-4 space-y-2">
                <p className="text-yellow-400 font-semibold">Detalles de Pago:</p>
                {selectedMethod.method_type === 'transferencia' ? (
                  <>
                    <p className="text-gray-300 text-sm"><strong>Banco:</strong> {selectedMethod.bank_name}</p>
                    <p className="text-gray-300 text-sm"><strong>Titular:</strong> {selectedMethod.account_holder}</p>
                    <p className="text-gray-300 text-sm"><strong>Cuenta:</strong> {selectedMethod.account_number}</p>
                    <p className="text-gray-300 text-sm"><strong>Cédula:</strong> {selectedMethod.id_number}</p>
                    <p className="text-gray-300 text-sm"><strong>Teléfono:</strong> {selectedMethod.phone}</p>
                    {selectedMethod.instructions && (
                      <p className="text-gray-400 text-sm mt-2 italic">{selectedMethod.instructions}</p>
                    )}
                  </>
                ) : (
                  <p className="text-gray-300 text-sm">{selectedMethod.pickup_instructions}</p>
                )}
              </div>
            )}

            {formData.payment_method === 'transferencia' && (
              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">
                  Referencia Bancaria *
                </label>
                <input
                  type="text"
                  value={formData.payment_reference}
                  onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })}
                  className={`w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 ${
                    errors.payment_reference ? 'ring-2 ring-red-500' : 'focus:ring-yellow-500'
                  }`}
                  placeholder="123456789"
                />
                {errors.payment_reference && <p className="text-red-400 text-sm mt-1">{errors.payment_reference}</p>}
              </div>
            )}

            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">
                Mensaje al Anfitrión (opcional)
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                rows="3"
                placeholder="Información adicional para el anfitrión..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-lg font-semibold transition-all transform hover:scale-105"
          >
            Enviar Solicitud
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseModalPrize;
