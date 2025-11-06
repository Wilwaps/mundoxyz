import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import ChatMessage from './ChatMessage';
import { Send } from 'lucide-react';

const AnonymousChatTab = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef(null);
  const { socket } = useSocket();

  useEffect(() => {
    if (socket) {
      // Cargar historial
      socket.emit('anonymous:load_history', { limit: 50 });
      
      socket.on('anonymous:history', (history) => {
        setMessages(history);
        scrollToBottom();
      });
      
      socket.on('anonymous:chat_message', (data) => {
        setMessages(prev => [...prev, data]);
        scrollToBottom();
      });

      socket.on('anonymous:error', (data) => {
        console.error('Anonymous chat error:', data.message);
      });

      return () => {
        socket.off('anonymous:history');
        socket.off('anonymous:chat_message');
        socket.off('anonymous:error');
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
    
    if (!inputMessage.trim() || !socket) return;
    
    socket.emit('anonymous:chat_message', {
      message: inputMessage.trim()
    });
    
    setInputMessage('');
  };

  return (
    <div className="tab-panel">
      <div className="tab-info">
        <span className="tab-title">👤 Chat Anónimo</span>
        <span className="tab-subtitle">Sin revelar identidad</span>
      </div>
      
      <div className="messages-area">
        {messages.length === 0 ? (
          <div className="empty-messages">
            <p>No hay mensajes aún</p>
            <p className="text-sm">¡Escribe algo anónimamente!</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <ChatMessage
              key={idx}
              message={msg.message}
              timestamp={msg.timestamp || msg.created_at}
              showUsername={false}
              isAnonymous={true}
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
          placeholder="Mensaje anónimo..."
          maxLength={500}
        />
        <button type="submit" disabled={!inputMessage.trim()}>
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default AnonymousChatTab;
