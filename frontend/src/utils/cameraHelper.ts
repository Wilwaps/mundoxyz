import { Camera, CameraResultType } from '@capacitor/camera/dist/esm/index.js';
import jsQR from 'jsqr';

/**
 * Toma una foto usando la cámara del dispositivo
 * @param options - Opciones de configuración de la cámara
 * @returns Promise con la imagen en formato base64 o null si se cancela
 */
export const takePhoto = async (options?: {
  quality?: number;
  allowEditing?: boolean;
  correctOrientation?: boolean;
}) => {
  try {
    const result = await Camera.getPhoto({
      quality: options?.quality || 0.8,
      allowEditing: options?.allowEditing || false,
      correctOrientation: options?.correctOrientation || true,
      resultType: CameraResultType.DataUrl,
    });

    return result.webPath || result.dataUrl || null;
  } catch (error) {
    console.error('Error al tomar foto:', error);
    // El usuario canceló o hubo un error
    return null;
  }
};

/**
 * Verifica si la cámara está disponible en el dispositivo
 * @returns Promise<boolean> - true si la cámara está disponible
 */
export const isCameraAvailable = async (): Promise<boolean> => {
  try {
    // Verificar permisos y disponibilidad
    const permissions = await Camera.checkPermissions();
    return permissions.camera === 'granted' || permissions.camera === 'prompt';
  } catch (error) {
    console.error('Error al verificar disponibilidad de cámara:', error);
    return false;
  }
};

/**
 * Solicita permisos para usar la cámara
 * @returns Promise<boolean> - true si se obtuvieron los permisos
 */
export const requestCameraPermission = async (): Promise<boolean> => {
  try {
    // Verificar estado actual de permisos antes de solicitar
    const current = await Camera.checkPermissions();

    if (current.camera === 'granted') {
      return true;
    }

    // Solicitar permisos solo si aún no están concedidos
    const permissions = await Camera.requestPermissions({ permissions: ['camera'] });
    return permissions.camera === 'granted';
  } catch (error) {
    console.error('Error al solicitar permisos de cámara:', error);
    return false;
  }
};

/**
 * Convierte base64 a File object para compatibilidad con inputs de archivo
 * @param dataUrl - Imagen en formato base64
 * @param filename - Nombre del archivo
 * @param mimeType - Tipo MIME (ej: 'image/jpeg')
 * @returns File object
 */
export const base64ToFile = (dataUrl: string, filename: string, mimeType: string): File => {
  // Extraer el base64 puro
  const base64Data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
  
  // Convertir a blob
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  
  // Crear File object
  return new File([blob], filename, { type: mimeType });
};

/**
 * Detecta si estamos en un entorno móvil (Capacitor)
 */
export const isCapacitorApp = (): boolean => {
  return typeof window !== 'undefined' && 'Capacitor' in window;
};

/**
 * Escanea un código QR usando la cámara (foto estática + jsQR)
 * Devuelve el texto del QR o null si no se pudo leer.
 */
export const scanQrCodeFromCamera = async (): Promise<string | null> => {
  try {
    if (typeof window === 'undefined') {
      console.warn('scanQrCodeFromCamera solo está disponible en entorno navegador');
      return null;
    }

    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      console.warn('Permiso de cámara denegado para escanear QR');
      return null;
    }

    const photoDataUrl = await takePhoto({ quality: 0.9, allowEditing: false, correctOrientation: true });
    if (!photoDataUrl) {
      return null;
    }

    // Cargar la imagen en un objeto Image para procesarla
    const img = new Image();
    img.src = photoDataUrl;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('No se pudo cargar la imagen para escanear QR'));
    });

    // Dibujar en canvas para obtener ImageData
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('No se pudo crear contexto 2D para escanear QR');
      return null;
    }

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    if (!width || !height) {
      console.warn('Dimensiones de imagen inválidas para escanear QR');
      return null;
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);

    // 1) Intentar con BarcodeDetector si está disponible
    const BarcodeDetectorCtor: any = (window as any).BarcodeDetector;
    if (BarcodeDetectorCtor) {
      try {
        const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
        const barcodes = await detector.detect(canvas);
        if (Array.isArray(barcodes) && barcodes.length > 0) {
          const first = barcodes[0];
          const rawValue = typeof first.rawValue === 'string' ? first.rawValue : null;
          if (rawValue) {
            return rawValue;
          }
        }
      } catch (e) {
        console.warn('Error usando BarcodeDetector, intentando jsQR...', e);
      }
    }

    // 2) Fallback: usar jsQR sobre el ImageData
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code && typeof code.data === 'string' && code.data.trim() !== '') {
      return code.data.trim();
    }

    console.warn('No se detectó ningún código QR en la imagen');
    return null;
  } catch (error) {
    console.error('Error al escanear código QR desde la cámara:', error);
    return null;
  }
};
