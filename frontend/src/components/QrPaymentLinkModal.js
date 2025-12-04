import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, QrCode, ArrowRight, Clock, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isCapacitorApp, scanQrCodeFromCamera, scanQrCodeLive } from '../utils/cameraHelper';

const QrPaymentLinkModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [qrLinkInput, setQrLinkInput] = useState('');
  const [history, setHistory] = useState([]); // { url, openedAt }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Cargar historial desde localStorage cuando se abre el modal
  useEffect(() => {
    if (!isOpen || !user?.id || typeof window === 'undefined') return;
    try {
      const key = `qr_payment_links_history_${user.id}`;
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        setHistory([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setHistory(parsed);
      }
    } catch {
      setHistory([]);
    }
  }, [isOpen, user?.id]);

  const persistHistory = (next) => {
    setHistory(next);
    if (!user?.id || typeof window === 'undefined') return;
    try {
      const key = `qr_payment_links_history_${user.id}`;
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore storage failures
    }
  };

  const registerOpenedLink = (urlString) => {
    const entry = {
      url: urlString,
      openedAt: new Date().toISOString(),
    };

    setHistory((prev) => {
      const withoutDup = prev.filter((item) => item.url !== urlString);
      const next = [entry, ...withoutDup].slice(0, 5);
      persistHistory(next);
      return next;
    });
  };

  const handleOpenLink = () => {
    const raw = (qrLinkInput || '').trim();
    if (!raw) {
      toast.error('Pega el link de pago QR primero');
      return;
    }
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : undefined;
      const url = new URL(raw, base);

      if (typeof window !== 'undefined') {
        const isSameOrigin = url.origin === window.location.origin;
        const host = url.hostname || '';
        const isMundoXyzHost = host.includes('mundoxyz');

        // En app (Capacitor) y link de MundoXYZ: navegar dentro de la app
        if (isCapacitorApp() && isMundoXyzHost) {
          onClose();
          registerOpenedLink(url.toString());
          navigate(url.pathname + url.search + url.hash);
          return;
        }

        // Misma origin en web: SPA navigate
        if (isSameOrigin) {
          onClose();
          registerOpenedLink(url.toString());
          navigate(url.pathname + url.search + url.hash);
          return;
        }

        // Otros dominios: abrir en navegador externo / pestaña
        onClose();
        registerOpenedLink(url.toString());
        window.open(url.toString(), '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Invalid QR payment link:', err);
      toast.error('Link de pago QR inválido');
    }
  };

  const handleScan = async () => {
    try {
      if (typeof window === 'undefined') {
        toast.error('Escáner de QR no disponible en este entorno');
        return;
      }

      // Escaneo solo en directo (vídeo + jsQR)
      const scanned = await scanQrCodeLive();

      if (!scanned) {
        toast.error('No se detectó ningún código QR válido');
        return;
      }

      // Normalizar contenido escaneado: a veces puede venir la URL y el id en líneas separadas
      const rawText = String(scanned).trim();
      const parts = rawText.split(/\s+/).filter(Boolean);
      let finalUrl = rawText;

      if (parts.length > 1) {
        const urlPart = parts.find((p) => p.startsWith('http://') || p.startsWith('https://'));
        const possibleId = parts.find((p) => /[0-9a-fA-F-]{16,}/.test(p));

        if (urlPart && possibleId && !urlPart.endsWith(possibleId)) {
          try {
            const u = new URL(urlPart);
            let pathname = u.pathname || '';
            if (!pathname.endsWith('/')) {
              pathname += '/';
            }
            pathname += possibleId;
            u.pathname = pathname;
            finalUrl = u.toString();
          } catch {
            finalUrl = urlPart;
          }
        } else if (urlPart) {
          finalUrl = urlPart;
        }
      }

      setQrLinkInput(finalUrl);
      handleOpenLink();
    } catch (error) {
      console.error('Error en escaneo de QR:', error);
      toast.error('No se pudo escanear el código QR');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md card-glass p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-fire-orange/20 flex items-center justify-center">
                  <QrCode size={20} className="text-fire-orange" />
                </div>
                <h2 className="text-lg font-bold">Pagar con QR (Fuegos)</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-glass-hover rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-text/60 mb-3">
              Pega el link de pago QR que recibiste (por ejemplo desde el POS o un comercio) para abrir
              la pantalla de pago sin salir de donde estás.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 mt-1">
              <input
                type="text"
                value={qrLinkInput}
                onChange={(e) => setQrLinkInput(e.target.value)}
                className="input-glass flex-1 text-[11px]"
                placeholder="https://.../store/mi-tienda/qr/qrSessionId"
              />
              <button
                type="button"
                onClick={handleOpenLink}
                className="px-4 py-2 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 text-[11px] whitespace-nowrap flex items-center gap-1"
              >
                Usar link
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={handleScan}
                className="px-4 py-2 rounded-lg bg-glass text-text hover:bg-glass-hover text-[11px] whitespace-nowrap flex items-center gap-1"
              >
                Escanear
                <ScanLine size={14} />
              </button>
            </div>

            {history.length > 0 && (
              <div className="mt-4 border-t border-glass pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} className="text-text/60" />
                  <span className="text-[11px] text-text/60">Links recientes</span>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto text-[11px]">
                  {history.map((item) => {
                    let label = item.url;
                    try {
                      const u = new URL(item.url);
                      const path = u.pathname || '';
                      const segments = path.split('/').filter(Boolean);

                      // Detectar patrón /store/:slug/qr/:qrSessionId
                      const storeIndex = segments.indexOf('store');
                      let prefix = '';
                      if (storeIndex !== -1 && segments.length > storeIndex + 1) {
                        const slug = segments[storeIndex + 1];
                        prefix = `Tienda: ${slug} · `;
                      }

                      label = prefix + path + (u.search || '');
                    } catch {
                      // usar url cruda si no se puede parsear
                    }
                    const openedLabel = item.openedAt
                      ? new Date(item.openedAt).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '';

                    return (
                      <div
                        key={item.url + item.openedAt}
                        className="flex items-center justify-between gap-2 glass-panel px-2 py-1"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-text/80">{label}</div>
                          {openedLabel && (
                            <div className="text-[10px] text-text/50">{openedLabel}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setQrLinkInput(item.url);
                            handleOpenLink();
                          }}
                          className="px-2 py-1 rounded-full bg-glass hover:bg-glass-hover text-[10px] whitespace-nowrap"
                        >
                          Abrir
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default QrPaymentLinkModal;