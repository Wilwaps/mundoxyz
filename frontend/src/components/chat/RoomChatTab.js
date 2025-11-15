import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import ChatMessage from './ChatMessage';
import { Send } from 'lucide-react';
import toast from 'react-hot-toast';

const RoomChatTab = ({ roomType, roomCode }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef(null);
  const { socket } = useSocket();
  const { user } = useAuth();

  useEffect(() => {
    if (socket) {
      socket.on('room:history', (history) => {
        setMessages(history);
        scrollToBottom();
      });
      
      socket.on('room:chat_message', (data) => {
        setMessages(prev => [...prev, data]);
        scrollToBottom();
      });

      socket.on('room:error', (data) => {
        console.error('Room chat error:', data.message);
        if (data?.message) {
          toast.error(data.message);
        } else {
          toast.error('Error en el chat de sala');
        }
      });

      return () => {
        socket.off('room:history');
        socket.off('room:chat_message');
        socket.off('room:error');
      };
    }
  }, [socket]);

  useEffect(() => {
    setMessages([]);
    setInputMessage('');
  }, [roomType, roomCode]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !socket || !user) return;
    
    socket.emit('room:chat_message', {
      roomType,
      roomCode,
      userId: user.id,
      message: inputMessage.trim()
    });
    
    setInputMessage('');
  };

  const getGameLabel = () => {
    switch (roomType) {
      case 'tictactoe':
        return 'TicTacToe';
      case 'bingo':
        return 'Bingo';
      case 'raffle':
        return 'Rifa';
      default:
        return 'Sala';
    }
  };

  return (
    <div className="tab-panel">
      <div className="tab-info room-info-header">
        <span className="tab-title">🎮 Chat de Sala</span>
        <span className="tab-subtitle">{getGameLabel()} #{roomCode}</span>
      </div>
      
      <div className="messages-area">
        {messages.length === 0 ? (
          <div className="empty-messages">
            <p>No hay mensajes aún</p>
            <p className="text-sm">Chatea con los jugadores de esta sala</p>
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
          placeholder="Mensaje en sala..."
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

export default RoomChatTab;
