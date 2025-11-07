import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import ChatMessage from './ChatMessage';
import { Send, Trash2, Bot, Loader } from 'lucide-react';

const RonChatTab = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const { socket } = useSocket();
  const { user } = useAuth();

  useEffect(() => {
    if (socket && user) {
      // Cargar historial
      socket.emit('ron:load_history', { userId: user.id });
      
      // Escuchar historial
      socket.on('ron:history', (history) => {
        setMessages(history);
        scrollToBottom();
      });
      
      // Escuchar mensaje del usuario confirmado
      socket.on('ron:user_message', (data) => {
        setMessages(prev => [...prev, data]);
        scrollToBottom();
      });
      
      // Escuchar respuesta del bot
      socket.on('ron:bot_response', (data) => {
        setIsLoading(false);
        setMessages(prev => [...prev, data]);
        scrollToBottom();
      });
      
      // Escuchar indicador de typing
      socket.on('ron:typing', (data) => {
        setIsLoading(data.isTyping);
      });
      
      // Escuchar confirmación de limpieza
      socket.on('ron:history_cleared', () => {
        setMessages([]);
      });

      // Escuchar errores
      socket.on('ron:error', (data) => {
        setIsLoading(false);
        // Mostrar error como mensaje del sistema
        setMessages(prev => [...prev, {
          username: 'Sistema',
          message: data.message,
          timestamp: new Date().toISOString(),
          isBot: false,
          isError: true
        }]);
        scrollToBottom();
      });

      return () => {
        socket.off('ron:history');
        socket.off('ron:user_message');
        socket.off('ron:bot_response');
        socket.off('ron:typing');
        socket.off('ron:history_cleared');
        socket.off('ron:error');
      };
    }
  }, [socket, user]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !socket || !user || isLoading) return;
    
    // Emitir mensaje al bot
    socket.emit('ron:chat_message', {
      userId: user.id,
      message: inputMessage.trim()
    });
    
    setInputMessage('');
    setIsLoading(true);
  };

  const handleClearHistory = () => {
    if (!socket || !user) return;
    
    const confirmed = window.confirm('¿Estás seguro de que quieres limpiar toda la conversación con Ron?');
    if (confirmed) {
      socket.emit('ron:clear_history', { userId: user.id });
    }
  };

  return (
    <div className="tab-panel ron-chat">
      <div className="tab-info">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-purple-400" />
          <div>
            <span className="tab-title">Ron (Asistente IA)</span>
            <span className="tab-subtitle">Chat privado con inteligencia artificial</span>
          </div>
        </div>
        <button 
          onClick={handleClearHistory}
          className="clear-btn"
          title="Limpiar conversación"
          disabled={messages.length === 0 || isLoading}
        >
          <Trash2 size={14} />
        </button>
      </div>
      
      <div className="messages-area">
        {messages.length === 0 ? (
          <div className="empty-messages">
            <Bot size={48} className="text-purple-400/50 mb-3" />
            <p>¡Hola! Soy Ron, tu asistente virtual 🤖</p>
            <p className="text-sm mt-2">Pregúntame sobre:</p>
            <ul className="text-sm text-left mt-2 space-y-1">
              <li>🎮 Cómo jugar TicTacToe, Bingo o Rifas</li>
              <li>🪙 Sistema de economía (coins, fires, experiencia)</li>
              <li>📊 Estadísticas y rankings</li>
              <li>❓ Cualquier duda sobre MUNDOXYZ</li>
            </ul>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <ChatMessage
              key={idx}
              username={msg.username}
              message={msg.message}
              timestamp={msg.timestamp}
              isOwn={!msg.isBot && msg.username === user?.username}
              showUsername={true}
              isBot={msg.isBot}
              isError={msg.isError}
            />
          ))
        )}
        
        {isLoading && (
          <div className="bot-typing">
            <Loader size={16} className="animate-spin" />
            <span>Ron está escribiendo...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <form className="message-input" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder={isLoading ? "Espera la respuesta de Ron..." : "Pregúntale a Ron..."}
          maxLength={500}
          disabled={!user || isLoading}
        />
        <button 
          type="submit" 
          disabled={!user || !inputMessage.trim() || isLoading}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default RonChatTab;
