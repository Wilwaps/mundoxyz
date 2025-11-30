/**
 * Utilidad para obtener la URL base correcta según el entorno
 */

export const getBaseUrl = () => {
  // Si estamos en Capacitor (APK), siempre usar la URL de producción
  if (window.location.origin.startsWith('capacitor://')) {
    return 'https://mundoxyz-production.up.railway.app';
  }
  
  // En producción web, usar la URL actual
  if (process.env.NODE_ENV === 'production') {
    return window.location.origin;
  }
  
  // En desarrollo web, usar localhost
  return window.location.origin;
};

export const getStoreUrl = (storeSlug) => {
  return `${getBaseUrl()}/store/${storeSlug}`;
};

export const getProductUrl = (storeSlug, productId, referrerCode = null) => {
  const baseUrl = getStoreUrl(storeSlug);
  const params = new URLSearchParams();
  
  if (productId) {
    params.append('product', productId);
  }
  
  if (referrerCode) {
    params.append('ref', referrerCode);
  }
  
  const paramString = params.toString();
  return paramString ? `${baseUrl}?${paramString}` : baseUrl;
};
