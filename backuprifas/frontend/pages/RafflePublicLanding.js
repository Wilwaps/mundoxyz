import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Users, AlertCircle, Loader } from 'lucide-react';
import axios from 'axios';
import ParticipantsModal from '../components/raffles/ParticipantsModal';
import './RafflePublicLanding.css';

const RafflePublicLanding = () => {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showParticipants, setShowParticipants] = useState(false);

  useEffect(() => {
    loadPublicData();
  }, [code]);

  const loadPublicData = async () => {
    try {
      const response = await axios.get(
        `/api/raffles/public/${code}`
      );

      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar rifa');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="public-landing loading">
        <Loader size={48} className="spinner" />
        <p>Cargando rifa...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-landing error">
        <AlertCircle size={64} />
        <h2>Error al cargar rifa</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { raffle, numbers, participants } = data;
  const brandingColors = raffle.branding_colors || {};
  const availableCount = numbers.filter(n => n.is_available).length;
  const soldCount = numbers.filter(n => n.state === 'sold').length;
  const reservedCount = numbers.filter(n => n.state === 'reserved').length;

  return (
    <div 
      className="public-landing"
      style={{
        backgroundColor: brandingColors.background || '#1a1a2e'
      }}
    >
      {/* Marca de agua con logo */}
      {raffle.branding_logo_url && (
        <div 
          className="watermark"
          style={{
            backgroundImage: `url(${raffle.branding_logo_url})`
          }}
        />
      )}

      {/* Header con branding */}
      <div 
        className="landing-header"
        style={{
          borderBottomColor: brandingColors.primary || '#667eea'
        }}
      >
        {raffle.branding_logo_url && (
          <img 
            src={raffle.branding_logo_url} 
            alt="Logo" 
            className="header-logo"
          />
        )}
        <h1 style={{ color: brandingColors.primary || '#667eea' }}>
          {raffle.name}
        </h1>
        {raffle.description && (
          <p className="description">{raffle.description}</p>
        )}
        
        <div className="raffle-info">
          <span className="info-badge">
            Código: <strong>{raffle.code}</strong>
          </span>
          {raffle.payment_cost_amount && (
            <span className="info-badge">
              Costo: <strong>{raffle.payment_cost_amount} {raffle.payment_cost_currency}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Estadísticas */}
      <div className="stats-container">
        <div className="stat-card available">
          <span className="stat-number">{availableCount}</span>
          <span className="stat-label">Disponibles</span>
        </div>
        <div className="stat-card sold">
          <span className="stat-number">{soldCount}</span>
          <span className="stat-label">Vendidos</span>
        </div>
        <div className="stat-card reserved">
          <span className="stat-number">{reservedCount}</span>
          <span className="stat-label">Reservados</span>
        </div>
      </div>

      {/* Tablero de números */}
      <div className="numbers-section">
        <h2>Números</h2>
        <div className="numbers-grid">
          {numbers.map(num => (
            <div
              key={num.number_idx}
              className={`number-cell ${num.state}`}
              style={{
                borderColor: num.state === 'sold' 
                  ? (brandingColors.primary || '#667eea')
                  : undefined
              }}
            >
              {num.number_idx}
            </div>
          ))}
        </div>
      </div>

      {/* Leyenda */}
      <div className="legend">
        <div className="legend-item">
          <span className="legend-dot available"></span>
          <span>Disponible</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot sold"></span>
          <span>Vendido</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot reserved"></span>
          <span>Reservado</span>
        </div>
      </div>

      {/* Botón flotante participantes */}
      <button 
        className="floating-participants-btn"
        onClick={() => setShowParticipants(true)}
        style={{
          backgroundColor: brandingColors.primary || '#667eea'
        }}
      >
        <Users size={24} />
        {participants.length > 0 && (
          <span className="badge">{participants.length}</span>
        )}
      </button>

      {/* Modal participantes */}
      {showParticipants && (
        <ParticipantsModal
          raffleId={raffle.id}
          onClose={() => setShowParticipants(false)}
        />
      )}

      {/* Footer */}
      <div className="landing-footer">
        <p>Rifa creada el {new Date(raffle.created_at).toLocaleDateString()}</p>
        <p className="powered-by">Powered by MundoXYZ</p>
      </div>
    </div>
  );
};

export default RafflePublicLanding;
