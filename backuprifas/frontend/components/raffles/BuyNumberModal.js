import React, { useState, useEffect } from 'react';
import { X, DollarSign, CreditCard, Phone, Hash, FileText, User, Mail, Send, Flame } from 'lucide-react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import API_URL from '../../config/api';
import { getBankName } from '../../utils/bankCodes';
import './BuyNumberModal.css';

const BuyNumberModal = ({ raffle, numberIdx, onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [buyerData, setBuyerData] = useState({
    display_name: '',
    full_name: '',
    phone: '',
    email: '',
    payment_reference: '',
    payment_method: ''
  });
  const [loading, setLoading] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(true);
  const [error, setError] = useState('');

  const BASE_URL = API_URL || '';
  const buildUrl = (path) => `${BASE_URL}${path}`;

  useEffect(() => {
    // Al abrir el modal, reservar el número inmediatamente
    const reserve = async () => {
      try {
        const response = await axios.post(
          buildUrl(`/api/raffles/${raffle.id}/reserve-number`),
          { number_idx: numberIdx },
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        
        if (response.data.success) {
          console.log(`✅ Número ${numberIdx} reservado temporalmente`);
          // SYNC: Invalidar queries para actualizar tablero inmediatamente
          await queryClient.invalidateQueries(['raffle-numbers', raffle.code]);
        }
      } catch (err) {
        console.error('Error reservando número:', err);
        if (err.response?.data?.error) {
          setError(err.response.data.error);
        }
      }
    };

    reserve();
    loadPaymentDetails();

    // Al cerrar el modal, liberar la reserva
    return () => {
      axios.post(
        buildUrl(`/api/raffles/${raffle.id}/release-number`),
        { number_idx: numberIdx },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      ).then(async () => {
        console.log(`✅ Número ${numberIdx} liberado`);
        // SYNC: Invalidar queries para actualizar tablero inmediatamente
        await queryClient.invalidateQueries(['raffle-numbers', raffle.code]);
      }).catch(err => {
        console.error('Error liberando número:', err);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raffle.id, numberIdx, queryClient]);

  const loadPaymentDetails = async () => {
    console.log('📥 Cargando payment details para rifa:', raffle.id);
    
    try {
      const response = await axios.get(
        buildUrl(`/api/raffles/${raffle.id}/payment-details`),
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      console.log('✅ Response payment-details:', response.data);

      if (response.data.success && response.data.data) {
        console.log('💳 Payment details recibidos:', response.data.data);
        setPaymentDetails(response.data.data);
      } else {
        console.log('⚠️ No hay payment details, usando valores por defecto');
        // Si no hay payment details, configurar datos por defecto
        const defaultDetails = {
          payment_cost_amount: raffle.cost_per_number || 10,
          payment_cost_currency: 'fires',
          allow_fire_payments: true
        };
        console.log('📝 Default payment details:', defaultDetails);
        setPaymentDetails(defaultDetails);
      }
    } catch (err) {
      console.error('❌ Error cargando payment details:', err);
      console.error('Error response:', err.response?.data);
      
      // Fallback: configurar datos por defecto SIEMPRE
      const fallbackDetails = {
        payment_cost_amount: raffle.cost_per_number || 10,
        payment_cost_currency: 'fires',
        allow_fire_payments: true
      };
      console.log('🔄 Fallback payment details:', fallbackDetails);
      setPaymentDetails(fallbackDetails);
    } finally {
      setLoadingPayment(false);
      console.log('🏁 loadPaymentDetails finalizado');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setBuyerData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setError('');
    
    // Validar que se haya seleccionado un método de pago
    if (!buyerData.payment_method) {
      setError('Debes seleccionar un método de pago');
      return;
    }
    
    setLoading(true);

    try {
      const response = await axios.post(
        buildUrl(`/api/raffles/${raffle.id}/request-number`),
        {
          number_idx: numberIdx,
          buyer_profile: buyerData,
          payment_method: buyerData.payment_method
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.data.success) {
        // SYNC: Invalidar queries antes de cerrar para actualizar tablero
        await queryClient.invalidateQueries(['raffle-numbers', raffle.code]);
        await queryClient.invalidateQueries(['raffle', raffle.code]);
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar solicitud');
    } finally {
      setLoading(false);
    }
  };

  if (loadingPayment) {
    console.log('⏳ Modal en estado loading...');
    return (
      <div className="buy-number-modal-overlay" onClick={onClose}>
        <div className="buy-number-modal-content loading" onClick={(e) => e.stopPropagation()}>
          <div className="loading-spinner">Cargando...</div>
        </div>
      </div>
    );
  }

  console.log('🎨 Renderizando modal con paymentDetails:', paymentDetails);
  console.log('📊 Estado actual buyerData:', buyerData);

  return (
    <div className="buy-number-modal-overlay" onClick={onClose}>
      <div className="buy-number-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="buy-number-modal-header">
          <h2>
            <CreditCard size={24} />
            Comprar número {numberIdx}
          </h2>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="buy-number-modal-body">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {paymentDetails && (
            <>
              {/* Selección de método de pago */}
              <div className="payment-method-selector" style={{ marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CreditCard size={20} />
                  Selecciona tu método de pago
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Opción efectivo - SIEMPRE visible */}
                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '10px', 
                      padding: '12px', 
                      border: '2px solid ' + (buyerData.payment_method === 'cash' ? '#8B5CF6' : '#333'),
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: buyerData.payment_method === 'cash' ? 'rgba(139, 92, 246, 0.1)' : 'transparent'
                    }}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value="cash"
                      checked={buyerData.payment_method === 'cash'}
                      onChange={(e) => setBuyerData(prev => ({ ...prev, payment_method: e.target.value }))}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <DollarSign size={18} />
                    <span>Efectivo</span>
                  </label>
                  
                  {/* Opción pago móvil/banco - SIEMPRE visible */}
                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '10px', 
                      padding: '12px', 
                      border: '2px solid ' + (buyerData.payment_method === 'bank' ? '#8B5CF6' : '#333'),
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: buyerData.payment_method === 'bank' ? 'rgba(139, 92, 246, 0.1)' : 'transparent'
                    }}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value="bank"
                      checked={buyerData.payment_method === 'bank'}
                      onChange={(e) => setBuyerData(prev => ({ ...prev, payment_method: e.target.value }))}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <Phone size={18} />
                    <span>Pago móvil / Banco</span>
                  </label>
                  
                  {/* Opción fuego - SIEMPRE visible */}
                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '10px', 
                      padding: '12px', 
                      border: '2px solid ' + (buyerData.payment_method === 'fire' ? '#ff6b35' : '#333'),
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: buyerData.payment_method === 'fire' ? 'rgba(255, 107, 53, 0.1)' : 'transparent'
                    }}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value="fire"
                      checked={buyerData.payment_method === 'fire'}
                      onChange={(e) => setBuyerData(prev => ({ ...prev, payment_method: e.target.value }))}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <Flame size={18} style={{ color: '#ff6b35' }} />
                    <span>Pago en fuegos (🔥 {paymentDetails.payment_cost_amount})</span>
                    <small style={{ marginLeft: 'auto', color: '#888' }}>Se descuentan al aprobar</small>
                  </label>
                </div>
              </div>

              {/* Información de pago del anfitrión (solo si NO es fire) */}
              {buyerData.payment_method && buyerData.payment_method !== 'fire' && (
              <div className="payment-info-box">
                <h3>
                  <DollarSign size={20} />
                  Información de pago del anfitrión
                </h3>
                
                <div className="payment-detail">
                  <span className="label">Costo:</span>
                  <span className="value">
                    {paymentDetails.payment_cost_amount || raffle.cost_per_number || 10} {paymentDetails.payment_cost_currency || 'Bs'}
                  </span>
                </div>

                <div className="payment-detail">
                  <span className="label">Método seleccionado:</span>
                  <span className="value">
                    {buyerData.payment_method === 'cash' ? 'Efectivo' : 'Pago móvil / Banco'}
                  </span>
                </div>

                {buyerData.payment_method === 'bank' && paymentDetails.payment_bank_code && (
                  <>
                    <div className="payment-detail">
                      <span className="label">Banco:</span>
                      <span className="value">
                        {getBankName(paymentDetails.payment_bank_code)}
                      </span>
                    </div>

                    <div className="payment-detail">
                      <span className="label">Teléfono:</span>
                      <span className="value">{paymentDetails.payment_phone}</span>
                    </div>

                    <div className="payment-detail">
                      <span className="label">Cédula:</span>
                      <span className="value">{paymentDetails.payment_id_number}</span>
                    </div>
                  </>
                )}

                {buyerData.payment_method === 'cash' && (
                  <div className="payment-instructions">
                    <FileText size={16} />
                    <p>Coordina la entrega del efectivo directamente con el anfitrión.</p>
                  </div>
                )}

                {buyerData.payment_method === 'bank' && !paymentDetails.payment_bank_code && (
                  <div className="payment-instructions">
                    <FileText size={16} />
                    <p>El anfitrión te proporcionará los datos bancarios una vez apruebe tu solicitud.</p>
                  </div>
                )}

                {paymentDetails.payment_instructions && (
                  <div className="payment-instructions">
                    <FileText size={16} />
                    <p>{paymentDetails.payment_instructions}</p>
                  </div>
                )}
              </div>
              )}

              {/* Formulario datos del comprador */}
              <div className="buyer-form">
                <h3>
                  <User size={20} />
                  Tus datos (opcionales)
                </h3>
                <p className="form-hint">
                  Estos datos ayudarán al anfitrión a contactarte si ganas
                </p>

                <div className="form-group">
                  <label>
                    <User size={16} />
                    Nombre para mostrar
                  </label>
                  <input
                    type="text"
                    name="display_name"
                    value={buyerData.display_name}
                    onChange={handleChange}
                    placeholder="Cómo quieres que te vean otros participantes"
                  />
                  <small>Este nombre será visible públicamente</small>
                </div>

                <div className="form-group">
                  <label>
                    <User size={16} />
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    value={buyerData.full_name}
                    onChange={handleChange}
                    placeholder="Tu nombre completo"
                  />
                  <small>Solo visible para el anfitrión si ganas</small>
                </div>

                <div className="form-group">
                  <label>
                    <Phone size={16} />
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={buyerData.phone}
                    onChange={handleChange}
                    placeholder="0412-1234567"
                  />
                </div>

                <div className="form-group">
                  <label>
                    <Mail size={16} />
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={buyerData.email}
                    onChange={handleChange}
                    placeholder="tu@email.com"
                  />
                </div>

                <div className="form-group">
                  <label>
                    <Hash size={16} />
                    Número de referencia del pago
                  </label>
                  <input
                    type="text"
                    name="payment_reference"
                    value={buyerData.payment_reference}
                    onChange={handleChange}
                    placeholder="Últimos 4 dígitos o código de referencia"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="buy-number-modal-footer">
          <button className="btn-cancel" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button 
            className="btn-submit" 
            onClick={handleSubmit} 
            disabled={loading || !paymentDetails}
          >
            {loading ? (
              'Enviando...'
            ) : (
              <>
                <Send size={18} />
                Enviar solicitud
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BuyNumberModal;
