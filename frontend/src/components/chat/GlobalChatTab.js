import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import ChatMessage from './ChatMessage';
import { Send } from 'lucide-react';

const GlobalChatTab = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef(null);
  const { socket } = useSocket();
  const { user } = useAuth();

  useEffect(() => {
    if (socket) {
      // Cargar historial
      socket.emit('global:load_history', { limit: 50 });
      
      socket.on('global:history', (history) => {
        setMessages(history);
        scrollToBottom();
      });
      
      socket.on('global:chat_message', (data) => {
        setMessages(prev => [...prev, data]);
        scrollToBottom();
      });

      socket.on('global:error', (data) => {
        console.error('Global chat error:', data.message);
      });

      return () => {
        socket.off('global:history');
        socket.off('global:chat_message');
        socket.off('global:error');
      };
    }
  }, [socket]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !socket || !user) return;
    
    socket.emit('global:chat_message', {
      userId: user.id,
      message: inputMessage.trim()
    });
    
    setInputMessage('');
  };

  return (
    <div className="tab-panel">
      <div className="tab-info">
        <span className="tab-title">🌍 Chat Global</span>
        <span className="tab-subtitle">Visible para todos</span>
      </div>
      
      <div className="messages-area">
        {messages.length === 0 ? (
          <div className="empty-messages">
            <p>No hay mensajes aún</p>
            <p className="text-sm">¡Sé el primero en escribir!</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <ChatMessage
              key={idx}
              username={msg.username}
              message={msg.message}
              timestamp={msg.timestamp || msg.created_at}
              isOwn={msg.userId === user?.id || msg.user_id === user?.id}
              showUsername={true}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="message-input" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Mensaje global..."
          maxLength={500}
          disabled={!user}
        />
        <button type="submit" disabled={!user || !inputMessage.trim()}>
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default GlobalChatTab;
