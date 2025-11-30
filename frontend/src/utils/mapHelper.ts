/**
 * Helper para manejar apertura de Google Maps con cierre automático
 */

/**
 * Abre Google Maps en una nueva ventana y la cierra automáticamente después de un tiempo
 * @param url - URL de Google Maps a abrir
 * @param autoCloseDelay - Tiempo en ms antes de cerrar (default: 3000ms)
 */
export const openMapWithAutoClose = (url: string, autoCloseDelay: number = 3000) => {
  try {
    const mapWindow = window.open(url, '_blank', 'noopener,noreferrer,width=800,height=600');
    
    if (mapWindow) {
      // Cerrar la ventana automáticamente después del tiempo especificado
      setTimeout(() => {
        try {
          mapWindow.close();
        } catch (error) {
          // La ventana ya fue cerrada por el usuario
          console.log('Ventana de mapa ya cerrada por el usuario');
        }
      }, autoCloseDelay);
    }
  } catch (error) {
    console.error('Error al abrir mapa:', error);
    // Fallback: abrir normalmente si falla el control
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

/**
 * Abre Google Maps para búsqueda de ubicación con cierre automático
 * @param query - Término de búsqueda o coordenadas
 * @param autoCloseDelay - Tiempo en ms antes de cerrar
 */
export const openLocationSearch = (query: string, autoCloseDelay: number = 3000) => {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  openMapWithAutoClose(mapsUrl, autoCloseDelay);
};

/**
 * Abre Google Maps para coordenadas específicas con cierre automático
 * @param lat - Latitud
 * @param lng - Longitud  
 * @param autoCloseDelay - Tiempo en ms antes de cerrar
 */
export const openCoordinatesMap = (lat: number, lng: number, autoCloseDelay: number = 3000) => {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  openMapWithAutoClose(mapsUrl, autoCloseDelay);
};
