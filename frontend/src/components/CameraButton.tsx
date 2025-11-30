import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { takePhoto, isCapacitorApp, requestCameraPermission } from '../utils/cameraHelper';

interface CameraButtonProps {
  onPhotoTaken: (file: File) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const CameraButton: React.FC<CameraButtonProps> = ({
  onPhotoTaken,
  className = '',
  size = 'md',
  disabled = false
}) => {
  const [loading, setLoading] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base'
  };

  const handleTakePhoto = async () => {
    // Solo mostrar cámara en entorno Capacitor (APK)
    if (!isCapacitorApp()) {
      toast.error('La cámara solo está disponible en la aplicación móvil');
      return;
    }

    if (disabled) return;

    try {
      setLoading(true);

      // Solicitar permisos si es necesario
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        toast.error('Se necesitan permisos de cámara para tomar fotos');
        return;
      }

      // Tomar foto
      const dataUrl = await takePhoto();
      if (!dataUrl) {
        // Usuario canceló, no mostrar error
        return;
      }

      // Convertir a File object
      const timestamp = new Date().getTime();
      const filename = `camera_photo_${timestamp}.jpg`;
      
      // Convertir base64 a blob y luego a File
      const base64Data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });
      const file = new File([blob], filename, { type: 'image/jpeg' });

      // Llamar callback con el archivo
      onPhotoTaken(file);
      toast.success('Foto capturada exitosamente');

    } catch (error) {
      console.error('Error al tomar foto:', error);
      toast.error('Error al capturar la foto');
    } finally {
      setLoading(false);
    }
  };

  if (!isCapacitorApp()) {
    // No mostrar botón en web
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleTakePhoto}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center
        bg-accent/10 hover:bg-accent/20 
        text-accent hover:text-accent
        border border-accent/20 hover:border-accent/30
        rounded-lg
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${className}
      `}
      title={loading ? 'Capturando foto...' : 'Tomar foto con cámara'}
    >
      {loading ? (
        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
      ) : (
        <Camera className="w-4 h-4" />
      )}
    </button>
  );
};

export default CameraButton;
