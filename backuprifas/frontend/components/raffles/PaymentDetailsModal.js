import React, { useState, useEffect } from 'react';
import { X, DollarSign, CreditCard, Phone, Hash, FileText, Flame } from 'lucide-react';
import axios from 'axios';
import { VENEZUELA_BANKS, getBankName } from '../../utils/bankCodes';
import './PaymentDetailsModal.css';

const PaymentDetailsModal = ({ raffleId, currentData, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    payment_cost_amount: '',
    payment_cost_currency: 'USD',
    payment_method: '',
    payment_bank_code: '',
    payment_phone: '',
    payment_id_number: '',
    payment_instructions: '',
    allow_fire_payments: false
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [instructionsLength, setInstructionsLength] = useState(0);

  useEffect(() => {
    if (currentData) {
      setFormData({
        payment_cost_amount: currentData.payment_cost_amount || '',
        payment_cost_currency: currentData.payment_cost_currency || 'USD',
        payment_method: currentData.payment_method || '',
        payment_bank_code: currentData.payment_bank_code || '',
        payment_phone: currentData.payment_phone || '',
        payment_id_number: currentData.payment_id_number || '',
        payment_instructions: currentData.payment_instructions || '',
        allow_fire_payments: currentData.allow_fire_payments || false
      });
      setInstructionsLength(currentData.payment_instructions?.length || 0);
    }
  }, [currentData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'payment_instructions') {
      if (value.length <= 300) {
        setFormData(prev => ({ ...prev, [name]: value }));
        setInstructionsLength(value.length);
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleMethodChange = (e) => {
    const method = e.target.value;
    setFormData(prev => ({
      ...prev,
      payment_method: method,
      // Limpiar campos de banco si cambia a efectivo
      payment_bank_code: method === 'cash' ? '' : prev.payment_bank_code,
      payment_phone: method === 'cash' ? '' : prev.payment_phone,
      payment_id_number: method === 'cash' ? '' : prev.payment_id_number
    }));
  };

  const validate = () => {
    if (!formData.payment_cost_amount || formData.payment_cost_amount <= 0) {
      setError('El costo de la rifa es requerido');
      return false;
    }

    if (!formData.payment_method) {
      setError('Debes seleccionar un método de pago');
      return false;
    }

    if (formData.payment_method === 'bank') {
      if (!formData.payment_bank_code) {
        setError('Debes seleccionar un banco');
        return false;
      }
      if (!formData.payment_phone) {
        setError('El número de teléfono es requerido');
        return false;
      }
      if (!formData.payment_id_number) {
        setError('La cédula es requerida');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    setError('');
    
    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const response = await axios.put(
        `/api/raffles/${raffleId}/payment-details`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.data.success) {
        onSave(response.data.data);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar datos de pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-details-modal-overlay" onClick={onClose}>
      <div className="payment-details-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="payment-details-modal-header">
          <h2>
            <DollarSign size={24} />
            Mis datos de pago
          </h2>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="payment-details-modal-body">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Costo de la rifa */}
          <div className="form-group">
            <label>
              <DollarSign size={18} />
              Costo de la rifa *
            </label>
            <div className="cost-input-group">
              <input
                type="number"
                name="payment_cost_amount"
                value={formData.payment_cost_amount}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
              <select
                name="payment_cost_currency"
                value={formData.payment_cost_currency}
                onChange={handleChange}
              >
                <option value="USD">USD</option>
                <option value="VES">VES</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          {/* Método de pago */}
          <div className="form-group">
            <label>
              <CreditCard size={18} />
              Método de pago *
            </label>
            <select
              name="payment_method"
              value={formData.payment_method}
              onChange={handleMethodChange}
            >
              <option value="">Seleccionar método...</option>
              <option value="cash">Efectivo</option>
              <option value="bank">Pago móvil / Banco</option>
            </select>
          </div>

          {/* Campos adicionales para banco */}
          {formData.payment_method === 'bank' && (
            <>
              <div className="form-group">
                <label>
                  <CreditCard size={18} />
                  Banco *
                </label>
                <select
                  name="payment_bank_code"
                  value={formData.payment_bank_code}
                  onChange={handleChange}
                >
                  <option value="">Seleccionar banco...</option>
                  {VENEZUELA_BANKS.map(bank => (
                    <option key={bank.code} value={bank.code}>
                      {bank.code} - {bank.name}
                    </option>
                  ))}
                </select>
                {formData.payment_bank_code && (
                  <small className="selected-bank">
                    {getBankName(formData.payment_bank_code)}
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>
                  <Phone size={18} />
                  Número de teléfono *
                </label>
                <input
                  type="tel"
                  name="payment_phone"
                  value={formData.payment_phone}
                  onChange={handleChange}
                  placeholder="0412-1234567"
                />
              </div>

              <div className="form-group">
                <label>
                  <Hash size={18} />
                  Cédula *
                </label>
                <input
                  type="text"
                  name="payment_id_number"
                  value={formData.payment_id_number}
                  onChange={handleChange}
                  placeholder="V-12345678"
                />
              </div>
            </>
          )}

          {/* Habilitar pago en fuegos */}
          <div className="form-group">
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="allow_fire_payments"
                checked={formData.allow_fire_payments}
                onChange={(e) => setFormData(prev => ({ ...prev, allow_fire_payments: e.target.checked }))}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
              <Flame size={18} style={{ color: '#ff6b35' }} />
              <span>Aceptar pago en fuegos (🔥)</span>
            </label>
            <small style={{ color: '#888', marginLeft: '30px', display: 'block', marginTop: '5px' }}>
              Los fuegos se transferirán directamente a ti tras aprobar la compra
            </small>
          </div>

          {/* Comentario/instrucción */}
          <div className="form-group">
            <label>
              <FileText size={18} />
              Comentario o instrucción (opcional)
            </label>
            <textarea
              name="payment_instructions"
              value={formData.payment_instructions}
              onChange={handleChange}
              placeholder="Ej: Hacer el pago antes de las 6pm, enviar captura de pantalla..."
              rows={4}
            />
            <small className={`char-counter ${instructionsLength > 280 ? 'warning' : ''}`}>
              {instructionsLength}/300 caracteres
            </small>
          </div>
        </div>

        <div className="payment-details-modal-footer">
          <button className="btn-cancel" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button 
            className="btn-save" 
            onClick={handleSubmit} 
            disabled={loading}
          >
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentDetailsModal;
