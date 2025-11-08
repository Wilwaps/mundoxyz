import React, { useState, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import GlobalChatTab from './GlobalChatTab';
import AnonymousChatTab from './AnonymousChatTab';
import RoomChatTab from './RoomChatTab';
import RonChatTab from './RonChatTab';
import './UnifiedChat.css';

const UnifiedChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('global');
  const [showRoomTab, setShowRoomTab] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  
  const { socket } = useSocket();
  const { user } = useAuth();
  const location = useLocation();

  // Detectar si usuario está en una sala
  useEffect(() => {
    const path = location.pathname;
    
    // TicTacToe Room
    const tttMatch = path.match(/\/tictactoe\/room\/(\d{6})/);
    if (tttMatch) {
      setCurrentRoom({ type: 'tictactoe', code: tttMatch[1] });
      setShowRoomTab(true);
      if (isOpen) setActiveTab('room');
      return;
    }
    
    // Bingo Room
    const bingoMatch = path.match(/\/bingo\/v2\/(play|room)\/(\d{6})/);
    if (bingoMatch) {
      setCurrentRoom({ type: 'bingo', code: bingoMatch[2] });
      setShowRoomTab(true);
      if (isOpen) setActiveTab('room');
      return;
    }
    
    // No está en sala - ocultar pestaña Sala
    if (showRoomTab) {
      setShowRoomTab(false);
      if (activeTab === 'room') {
        setActiveTab('global');
      }
    }
    setCurrentRoom(null);
  }, [location.pathname, isOpen, showRoomTab, activeTab]);

  // Join/Leave room chat al cambiar de sala
  useEffect(() => {
    if (socket && currentRoom) {
      socket.emit('room:join_chat', {
        roomType: currentRoom.type,
        roomCode: currentRoom.code
      });
      
      return () => {
        socket.emit('room:leave_chat', {
          roomType: currentRoom.type,
          roomCode: currentRoom.code
        });
      };
    }
  }, [socket, currentRoom]);

  return (
    <div className={`unified-chat ${isOpen ? 'open' : 'minimized'}`}>
      {/* Botón Icono (50% tamaño original) */}
      <button 
        className="chat-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Chat"
      >
        <MessageCircle size={20} />
      </button>

      {isOpen && (
        <div className="chat-container">
          {/* Header con Pestañas */}
          <div className="chat-header">
            <div className="chat-tabs">
              <button
                className={`tab ${activeTab === 'global' ? 'active' : ''}`}
                onClick={() => setActiveTab('global')}
              >
                🌍
              </button>
              
              <button
                className={`tab ${activeTab === 'anonymous' ? 'active' : ''}`}
                onClick={() => setActiveTab('anonymous')}
              >
                👤
              </button>
              
              <button
                className={`tab ${activeTab === 'ron' ? 'active' : ''}`}
                onClick={() => setActiveTab('ron')}
                title="Chat con Ron (IA)"
              >
                🤖
              </button>
              
              {showRoomTab && (
                <button
                  className={`tab ${activeTab === 'room' ? 'active' : ''}`}
                  onClick={() => setActiveTab('room')}
                >
                  🎮
                </button>
              )}
            </div>
            
            <button 
              className="close-btn"
              onClick={() => setIsOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          {/* Contenido de Pestañas */}
          <div className="chat-content">
            {activeTab === 'global' && <GlobalChatTab />}
            {activeTab === 'anonymous' && <AnonymousChatTab />}
            {activeTab === 'ron' && <RonChatTab />}
            {activeTab === 'room' && currentRoom && (
              <RoomChatTab 
                roomType={currentRoom.type}
                roomCode={currentRoom.code}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedChat;
