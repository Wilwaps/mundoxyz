/**
 * Utilidad para obtener la URL base correcta según el entorno
 */

export const getBaseUrl = () => {
  if (typeof window === 'undefined') {
    // En entornos sin window (SSR/tests), devolvemos directamente producción
    return 'https://mundoxyz-production.up.railway.app';
  }

  const origin = window.location.origin || '';

  // Si estamos en Capacitor (APK), siempre usar la URL de producción
  if (origin.startsWith('capacitor://')) {
    return 'https://mundoxyz-production.up.railway.app';
  }

  try {
    const url = new URL(origin);
    const hostname = url.hostname || '';

    // Si el panel corre en localhost/127.0.0.1, los enlaces compartibles (QR, share)
    // deben apuntar al dominio público de producción.
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'https://mundoxyz-production.up.railway.app';
    }

    // En producción web real, usar la URL actual
    return origin;
  } catch {
    // Fallback seguro: dominio público de producción
    return 'https://mundoxyz-production.up.railway.app';
  }
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
