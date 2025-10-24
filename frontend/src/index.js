import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Initialize Telegram WebApp
if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp;
  
  // Expand to full height
  tg.expand();
  
  // Enable closing confirmation
  tg.enableClosingConfirmation();
  
  // Set header color to match theme
  tg.setHeaderColor('#0B0E14');
  tg.setBackgroundColor('#0B0E14');
  
  // Ready
  tg.ready();
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
