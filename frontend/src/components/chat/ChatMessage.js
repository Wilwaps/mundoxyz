import React from 'react';

const ChatMessage = ({ 
  username, 
  message, 
  timestamp, 
  isOwn = false, 
  showUsername = true,
  isAnonymous = false,
  isBot = false,
  isError = false
}) => {
  const formatTime = (ts) => {
    return new Date(ts).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`chat-message ${isOwn ? 'own' : ''} ${isAnonymous ? 'anonymous' : ''} ${isBot ? 'bot-message' : ''} ${isError ? 'error-message' : ''}`}>
      {showUsername && !isAnonymous && (
        <span className="message-username">{username}</span>
      )}
      {isAnonymous && (
        <span className="message-username">Anónimo</span>
      )}
      <span className="message-time">{formatTime(timestamp)}</span>
      <p className="message-text">{message}</p>
    </div>
  );
};

export default ChatMessage;
