/**
 * Utilidades para manejo de imágenes en base64
 */

// Convertir File a base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    
    reader.onerror = () => {
      reject(reader.error);
    };
    
    reader.readAsDataURL(file);
  });
};

// Validar tamaño de imagen (en MB)
export const validateImageSize = (file: File, maxSizeMB: number = 5): boolean => {
  const sizeMB = file.size / (1024 * 1024);
  return sizeMB <= maxSizeMB;
};

// Validar tipo de imagen
export const validateImageType = (file: File): boolean => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  return validTypes.includes(file.type);
};

// Convertir y validar imagen
export const processImage = async (
  file: File,
  maxSizeMB: number = 5
): Promise<{ base64: string; error?: string }> => {
  try {
    // Validar tipo
    if (!validateImageType(file)) {
      return {
        base64: '',
        error: 'Tipo de archivo no válido. Solo se permiten: JPG, PNG, WEBP, GIF'
      };
    }
    
    // Validar tamaño
    if (!validateImageSize(file, maxSizeMB)) {
      return {
        base64: '',
        error: `El archivo excede el tamaño máximo de ${maxSizeMB}MB`
      };
    }
    
    // Convertir a base64
    const base64 = await fileToBase64(file);
    
    return { base64 };
  } catch (error) {
    return {
      base64: '',
      error: 'Error al procesar la imagen'
    };
  }
};

// Obtener preview de base64
export const getImagePreview = (base64: string): string => {
  return base64;
};

// Limpiar data URL (remover metadata si es necesario)
export const cleanBase64 = (base64: string): string => {
  return base64;
};
