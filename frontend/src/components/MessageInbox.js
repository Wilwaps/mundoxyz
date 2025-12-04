import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import API_URL from '../config/api';
import './MessageInbox.css';
import GiftClaimButton from './gifts/GiftClaimButton';

const MessageInbox = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all'); // all, system, friends
  const { user } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleAcceptWelcome = async (message) => {
    try {
      if (!message?.metadata?.event_id) return;

      const res = await fetch(`${API_URL}/api/welcome/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ event_id: message.metadata.event_id })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al reclamar bienvenida');
      }

      toast.success(`🎉 Bienvenida reclamada: +${data.coins_received || 0}🪙 +${data.fires_received || 0}🔥`);

      await markAsRead(message.id);
      setMessages(prev => prev.filter(m => m.id !== message.id));

      // Refrescar wallet y estadísticas relacionadas
      queryClient.invalidateQueries(['wallet-balance']);
      queryClient.invalidateQueries(['user-wallet']);
      queryClient.invalidateQueries(['admin-stats']);
    } catch (err) {
      toast.error(err.message || 'Error al reclamar bienvenida');
    }
  };

  useEffect(() => {
    if (user) {
      loadMessages();
      // Opcional: habilitar polling si se requiere actualización periódica
      // const interval = setInterval(loadMessages, 60000);
      // return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (!socket) return;
    const handleNotification = (payload) => {
      // Refrescar contador real desde API (evita desincronización)
      fetch(`${API_URL}/api/messages/unread-count`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
        .then(r => r.ok ? r.json() : { unread: null })
        .then(data => {
          if (typeof data.unread === 'number') setUnreadCount(data.unread);
        })
        .catch(() => {});
      if (isOpen) loadMessages();
    };
    socket.on('notification', handleNotification);
    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket, isOpen]);

  const loadMessages = async () => {
    try {
      const [listRes, unreadRes] = await Promise.all([
        fetch(`${API_URL}/api/messages`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`${API_URL}/api/messages/unread-count`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      if (listRes.ok) {
        const data = await listRes.json();
        setMessages(data.messages || []);
      }
      if (unreadRes.ok) {
        const data = await unreadRes.json();
        setUnreadCount(data.unread || 0);
      }
    } catch (err) {
      // Silenciar errores para no contaminar la consola
      // console.error('Error loading messages:', err);
    }
  };

  const markAsRead = async (messageId) => {
    try {
      await fetch(`${API_URL}/api/messages/${messageId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking message as read:', err);
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      // No hay endpoint de borrado en /api/messages
      // Marcamos como leído y lo ocultamos del listado local
      await markAsRead(messageId);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (filter === 'all') return true;
    return msg.category === filter;
  });

  const handleMessageClick = async (message) => {
    try {
      // Si es resultado de rifa con código asociado, redirigir a la rifa
      const raffleCode = message?.metadata?.raffleCode;
      if (raffleCode) {
        await markAsRead(message.id);
        setIsOpen(false);
        navigate(`/raffles/${raffleCode}`);
        return;
      }

      // Comportamiento por defecto: solo marcar como leído si está sin leer
      if (!message.is_read) {
        await markAsRead(message.id);
      }
    } catch (err) {
      // Silenciar errores para no romper UX del inbox
      // console.error('Error handling message click:', err);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (days === 1) {
      return 'Ayer';
    } else if (days < 7) {
      return `Hace ${days} días`;
    } else {
      return date.toLocaleDateString('es-ES');
    }
  };

  return (
    <>
      {/* Inbox Button */}
      <button 
        className="inbox-button"
        onClick={() => { const next = !isOpen; setIsOpen(next); if (next) loadMessages(); }}
      >
        📬
        {unreadCount > 0 && (
          <span className="unread-badge">{unreadCount}</span>
        )}
      </button>

      {/* Inbox Modal */}
      {isOpen && (
        <div className="inbox-modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="inbox-modal" onClick={e => e.stopPropagation()}>
            <div className="inbox-header">
              <h2>📬 Buzón de Mensajes</h2>
              <button className="close-btn" onClick={() => setIsOpen(false)}>
                ×
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="inbox-tabs">
              <button 
                className={`tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                Todos ({messages.length})
              </button>
              <button 
                className={`tab ${filter === 'system' ? 'active' : ''}`}
                onClick={() => setFilter('system')}
              >
                Sistema ({messages.filter(m => m.category === 'system').length})
              </button>
              <button 
                className={`tab ${filter === 'friends' ? 'active' : ''}`}
                onClick={() => setFilter('friends')}
              >
                Amigos ({messages.filter(m => m.category === 'friends').length})
              </button>
            </div>

            {/* Messages List */}
            <div className="messages-list">
              {filteredMessages.length === 0 ? (
                <div className="no-messages">
                  <p>No tienes mensajes</p>
                </div>
              ) : (
                filteredMessages.map(message => (
                  <div 
                    key={message.id} 
                    className={`message-item ${!message.is_read ? 'unread' : ''}`}
                    onClick={() => handleMessageClick(message)}
                  >
                    <div className="message-header">
                      <span className="message-category">
                        {message.category === 'system' ? '🔧' : '👥'}
                        {message.category === 'system' ? 'Sistema' : 'Amigos'}
                      </span>
                      <span className="message-date">
                        {formatDate(message.created_at)}
                      </span>
                    </div>
                    
                    <h4 className="message-title">{message.title}</h4>
                    <p className="message-content">{message.content}</p>
                    
                    {message.metadata && (
                      <div className="message-metadata">
                        {message.metadata.raffleCode && (
                          <span>Rifa: #{message.metadata.raffleCode}</span>
                        )}
                        {message.metadata.winningNumber && (
                          <span>Número ganador: {message.metadata.winningNumber}</span>
                        )}
                        {(message.metadata.prizeAmount !== undefined) && (
                          <span>Premio: {message.metadata.prizeAmount} {message.metadata.currency === 'fires' ? '🔥' : message.metadata.currency === 'coins' ? '🪙' : ''}</span>
                        )}
                      </div>
                    )}

                    {/* Botón para reclamar eventos de bienvenida que requieren aceptación */}
                    {message.metadata?.type === 'welcome_event' && message.metadata.event_id && (
                      <button
                        className="btn-primary w-full mt-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcceptWelcome(message);
                        }}
                      >
                        🎁 Aceptar Bienvenida
                      </button>
                    )}
                    
                    {/* Gift Claim Button */}
                    {message.metadata?.type === 'gift_pending' && message.metadata.gift_id && (
                      <GiftClaimButton
                        giftId={message.metadata.gift_id}
                        coinsAmount={message.metadata.coins_amount || 0}
                        firesAmount={message.metadata.fires_amount || 0}
                        onClaimed={() => {
                          deleteMessage(message.id);
                          loadMessages();
                        }}
                      />
                    )}
                    
                    <button 
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMessage(message.id);
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MessageInbox;
