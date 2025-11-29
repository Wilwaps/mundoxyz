// API URL configuration for fetch requests
// HARDCODED para Railway ya que process.env no funciona correctamente en build

// Detectar si estamos en producción por la URL actual o en Capacitor (APK)
const isProduction = typeof window !== 'undefined' && 
  (window.location.hostname === 'mundoxyz-production.up.railway.app' ||
   window.location.hostname.includes('railway.app') ||
   window.location.protocol === 'capacitor:' ||  // APK con Capacitor
   window.location.origin.startsWith('capacitor://'));

// En producción o Capacitor: usar URL hardcoded
// En desarrollo: usar variable de entorno o string vacío (proxy)
const API_URL = isProduction 
  ? 'https://mundoxyz-production.up.railway.app'
  : (process.env.REACT_APP_API_URL || '');

console.log('🌍 API_URL configurado:', API_URL);
console.log('🏠 Hostname:', typeof window !== 'undefined' ? window.location.hostname : 'SSR');
console.log('🔧 isProduction:', isProduction);

export default API_URL;
