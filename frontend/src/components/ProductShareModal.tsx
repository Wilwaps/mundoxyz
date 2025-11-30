/**
 * Modal para compartir productos con enlace de referido embebido
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, MessageCircle, Send, Copy, QrCode } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { downloadQrForUrl } from '../utils/qr';
import { getProductUrl } from '../utils/urlHelper';

interface ProductShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    description?: string;
    price_usdt: number;
    image_url?: string;
    store_slug: string;
    store_name: string;
  };
}

const ProductShareModal: React.FC<ProductShareModalProps> = ({
  isOpen,
  onClose,
  product
}) => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  // Generar URL con referido embebido
  const generateReferralUrl = () => {
    return getProductUrl(product.store_slug, product.id, user?.my_referrer_code);
  };

  const shareUrl = generateReferralUrl();
  const priceUsdt = typeof product.price_usdt === 'number' ? product.price_usdt : parseFloat(String(product.price_usdt || '0')) || 0;
  const shareText = `¡Mira este producto en ${product.store_name}!\n\n🛍️ ${product.name}\n💰 ${priceUsdt.toFixed(2)} USDT\n\n${product.description || ''}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Error al copiar el link');
    }
  };

  const handleShareWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleShareTelegram = () => {
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(telegramUrl, '_blank');
  };

  const handleDownloadQR = async () => {
    try {
      await downloadQrForUrl(shareUrl, `producto-${product.id}-qr.png`);
      toast.success('QR descargado');
    } catch (error) {
      toast.error('Error al generar QR');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: product.name,
          text: shareText,
          url: shareUrl
        });
      } catch (error) {
        // El usuario canceló o hubo error
        console.log('Error en native share:', error);
      }
    } else {
      // Fallback a copiar link
      handleCopyLink();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-md bg-dark border border-white/10 rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Share2 size={20} className="text-accent" />
              Compartir Producto
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-glass hover:bg-glass-hover flex items-center justify-center text-white/80"
            >
              <X size={18} />
            </button>
          </div>

          {/* Product Info */}
          <div className="flex items-start gap-4 mb-6 p-4 bg-glass/50 rounded-xl">
            <img
              src={product.image_url || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=1000&auto=format&fit=crop'}
              alt={product.name}
              className="w-16 h-16 rounded-lg object-cover"
            />
            <div className="flex-1">
              <h4 className="font-semibold text-white mb-1">{product.name}</h4>
              <p className="text-sm text-accent font-bold">
                ${priceUsdt.toFixed(2)} USDT
              </p>
              {product.description && (
                <p className="text-xs text-white/60 mt-1 line-clamp-2">
                  {product.description}
                </p>
              )}
            </div>
          </div>

          {/* Share Options */}
          <div className="space-y-3">
            {/* Native Share */}
            <button
              onClick={handleNativeShare}
              className="w-full flex items-center gap-3 p-4 bg-glass hover:bg-glass-hover rounded-xl transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center group-hover:bg-accent/30">
                <Share2 size={18} className="text-accent" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-white">Compartir</div>
                <div className="text-xs text-white/60">Usar el sistema de compartir del dispositivo</div>
              </div>
            </button>

            {/* WhatsApp */}
            <button
              onClick={handleShareWhatsApp}
              className="w-full flex items-center gap-3 p-4 bg-glass hover:bg-glass-hover rounded-xl transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30">
                <MessageCircle size={18} className="text-green-400" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-white">WhatsApp</div>
                <div className="text-xs text-white/60">Compartir por WhatsApp</div>
              </div>
            </button>

            {/* Telegram */}
            <button
              onClick={handleShareTelegram}
              className="w-full flex items-center gap-3 p-4 bg-glass hover:bg-glass-hover rounded-xl transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30">
                <Send size={18} className="text-blue-400" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-white">Telegram</div>
                <div className="text-xs text-white/60">Compartir por Telegram</div>
              </div>
            </button>

            {/* Copy Link */}
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 p-4 bg-glass hover:bg-glass-hover rounded-xl transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30">
                <Copy size={18} className={copied ? "text-green-400" : "text-purple-400"} />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-white">
                  {copied ? '¡Copiado!' : 'Copiar Link'}
                </div>
                <div className="text-xs text-white/60">
                  {copied ? 'Link en el portapapeles' : 'Copiar al portapapeles'}
                </div>
              </div>
            </button>

            {/* QR Code */}
            <button
              onClick={handleDownloadQR}
              className="w-full flex items-center gap-3 p-4 bg-glass hover:bg-glass-hover rounded-xl transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/30">
                <QrCode size={18} className="text-orange-400" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-white">Código QR</div>
                <div className="text-xs text-white/60">Descargar imagen del QR</div>
              </div>
            </button>
          </div>

          {/* URL Preview */}
          <div className="mt-6 p-3 bg-glass/30 rounded-lg">
            <div className="text-xs text-white/60 mb-1">Link para compartir:</div>
            <div className="text-xs text-white/80 break-all font-mono">
              {shareUrl}
            </div>
          </div>

          {/* Referral Info */}
          {user?.my_referrer_code && (
            <div className="mt-4 p-3 bg-accent/10 border border-accent/30 rounded-lg">
              <div className="text-xs text-accent">
                💡 Este link incluye tu código de referido. Ganarás comisiones cuando alguien compre a través de él.
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProductShareModal;
