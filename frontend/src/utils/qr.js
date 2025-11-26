import QRCode from 'qrcode';
import toast from 'react-hot-toast';

export async function downloadQrForUrl(url, filename = 'mundoxyz-qr.png') {
  if (!url || typeof window === 'undefined') {
    return;
  }

  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      color: {
        dark: '#000000ff',
        light: '#ffffffff'
      }
    });

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('QR descargado');
  } catch (error) {
    console.error('Error generando QR:', error);
    toast.error('No se pudo generar el QR. Copiamos el enlace en su lugar.');

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(url);
      } else {
        window.prompt('Copia este enlace:', url);
      }
    } catch (clipboardError) {
      console.error('Error copiando enlace de respaldo:', clipboardError);
    }
  }
}
