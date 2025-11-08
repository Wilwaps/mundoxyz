import React, { useState, useEffect } from 'react';
import { X, Users, Hash } from 'lucide-react';
import axios from 'axios';
import './ParticipantsModal.css';

const ParticipantsModal = ({ raffleId, onClose }) => {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadParticipants();
  }, [raffleId]);

  const loadParticipants = async () => {
    try {
      const response = await axios.get(
        `/api/raffles/${raffleId}/participants`
      );

      if (response.data.success) {
        setParticipants(response.data.data);
      }
    } catch (err) {
      setError('Error al cargar participantes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="participants-modal-overlay" onClick={onClose}>
      <div className="participants-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="participants-modal-header">
          <h2>
            <Users size={24} />
            Participantes
            {!loading && <span className="count">({participants.length})</span>}
          </h2>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="participants-modal-body">
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Cargando participantes...</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {!loading && !error && participants.length === 0 && (
            <div className="empty-state">
              <Users size={48} />
              <p>No hay participantes todavía</p>
              <small>Los participantes aparecerán aquí cuando compren números</small>
            </div>
          )}

          {!loading && !error && participants.length > 0 && (
            <div className="participants-list">
              {participants.map((participant, index) => (
                <div key={index} className="participant-item">
                  <div className="participant-info">
                    <div className="participant-avatar">
                      {participant.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="participant-details">
                      <span className="participant-name">
                        {participant.display_name}
                      </span>
                      <span className="participant-numbers-count">
                        {participant.numbers.length} {participant.numbers.length === 1 ? 'número' : 'números'}
                      </span>
                    </div>
                  </div>
                  <div className="participant-numbers">
                    <Hash size={14} />
                    {participant.numbers.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="participants-modal-footer">
          <button className="btn-close" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParticipantsModal;
