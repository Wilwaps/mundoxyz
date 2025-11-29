import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      return;
    }

    // Create socket connection
    // HARDCODED para Railway - detectar producción por hostname o Capacitor
    const isProduction = window.location.hostname === 'mundoxyz-production.up.railway.app' ||
                        window.location.hostname.includes('railway.app') ||
                        window.location.protocol === 'capacitor:' ||  // APK con Capacitor
                        window.location.origin.startsWith('capacitor://');
    
    // Determine the socket URL
    let socketUrl;
    if (isProduction) {
      // Production: use hardcoded backend URL
      socketUrl = 'https://mundoxyz-production.up.railway.app';
      console.log('🔌 Socket conectando a producción:', socketUrl);
    } else {
      // Development: use current origin (proxied)
      socketUrl = window.location.origin;
      console.log('🔌 Socket conectando a desarrollo:', socketUrl);
    }
    
    console.log('🌍 Hostname actual:', window.location.hostname);
    console.log('🔧 isProduction:', isProduction);
    
    const newSocket = io(socketUrl, {
      auth: {
        userId: user.id,
        username: user.username
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 10,
      timeout: 20000,
      // Capacitor specific options
      forceNew: true,
      upgrade: false,
      rememberUpgrade: false,
      // Additional options for mobile
      autoConnect: true,
      forceJSONP: false
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    // Set socket
    setSocket(newSocket);

    // Cleanup on unmount or when user changes
    return () => {
      newSocket.disconnect();
      setConnected(false);
      setSocket(null);
    };
  }, [user]);

  const value = {
    socket,
    connected
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
