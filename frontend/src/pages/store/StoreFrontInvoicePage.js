import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { downloadQrForUrl } from '../../utils/qr';
import { openMapWithAutoClose, openLocationSearch } from '../../utils/mapHelper';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ArrowLeft, MapPin, FileText, ShoppingBag, ListChecks, Share2 } from 'lucide-react';
import useDisableRaffleQueries from '../../hooks/useDisableRaffleQueries';
import usePublicStore from '../../hooks/usePublicStore';

const COLOR_KEYWORDS = {
  rojo: { color: '#ef4444', label: 'Rojo' },
  azul: { color: '#3b82f6', label: 'Azul' },
  verde: { color: '#22c55e', label: 'Verde' },
  amarillo: { color: '#eab308', label: 'Amarillo' },
  naranja: { color: '#f97316', label: 'Naranja' },
  morado: { color: '#a855f7', label: 'Morado' },
  rosa: { color: '#ec4899', label: 'Rosa' },
  negro: { color: '#000000', label: 'Negro' },
  blanco: { color: '#ffffff', label: 'Blanco' },
  gris: { color: '#6b7280', label: 'Gris' },
  dorado: { color: '#facc15', label: 'Dorado' },
  plateado: { color: '#9ca3af', label: 'Plateado' }
};

const parseModifierColorFromName = (rawName) => {
  if (!rawName || typeof rawName !== 'string') {
    return { label: '', color: null };
  }

  const trimmed = rawName.trim();
  if (!trimmed) {
    return { label: '', color: null };
  }

  const parts = trimmed.split(/\s+/);
  const last = parts[parts.length - 1];
  let color = null;
  let label = trimmed;

  if (last && last.startsWith('#') && last.length > 1) {
    const token = last.slice(1).toLowerCase();

    if (/^[0-9a-f]{3}$|^[0-9a-f]{6}$/.test(token)) {
      color = `#${token}`;
    } else if (COLOR_KEYWORDS[token]) {
      color = COLOR_KEYWORDS[token].color;
    }

    if (color) {
      const base = parts.slice(0, -1).join(' ').trim();
      if (base) {
        label = base;
      } else if (COLOR_KEYWORDS[token]) {
        label = COLOR_KEYWORDS[token].label;
      }
    }
  }

  return { label, color };
};

const StoreFrontInvoicePage = () => {
  useDisableRaffleQueries();
  const { slug, invoiceNumber } = useParams();
  const navigate = useNavigate();
  const locationRouter = useLocation();
  const searchParams = new URLSearchParams(locationRouter.search);
  const fromParam = searchParams.get('from');
  const fromOrders = fromParam === 'orders';
  const fromReports = fromParam === 'reports';

  const { data: storeData, isLoading: loadingStore, error: storeError } = usePublicStore(slug);

  const store = storeData?.store;
  const storeId = store?.id;

  const { data: fiatContext } = useQuery({
    queryKey: ['fiat-context'],
    queryFn: async () => {
      const response = await axios.get('/api/economy/fiat-context');
      return response.data;
    }
  });

  let vesPerUsdt = null;
  if (fiatContext?.bcvRate && fiatContext.bcvRate.rate != null) {
    const bcvParsed = parseFloat(String(fiatContext.bcvRate.rate));
    if (Number.isFinite(bcvParsed) && bcvParsed > 0) {
      vesPerUsdt = bcvParsed;
    }
  }
  if (!vesPerUsdt && fiatContext?.operationalRate?.rate != null) {
    const opParsed = parseFloat(String(fiatContext.operationalRate.rate));
    if (Number.isFinite(opParsed) && opParsed > 0) {
      vesPerUsdt = opParsed;
    }
  }
  const bsRate =
    typeof vesPerUsdt === 'number' && Number.isFinite(vesPerUsdt) && vesPerUsdt > 0
      ? vesPerUsdt
      : 38.5;

  const {
    data: order,
    isLoading: loadingInvoice,
    error: invoiceError
  } = useQuery({
    queryKey: ['storefront-invoice', storeId, invoiceNumber],
    enabled: !!storeId && !!invoiceNumber,
    queryFn: async () => {
      const response = await axios.get(`/api/store/order/${storeId}/invoice/${invoiceNumber}`);
      return response.data?.order || null;
    }
  });

  const formatInvoiceNumber = (n) => {
    if (n === null || n === undefined) return '-';
    const numeric = typeof n === 'number' ? n : parseInt(n, 10);
    if (!Number.isFinite(numeric)) return String(n);
    return String(numeric).padStart(7, '0');
  };

  const handleOpenDeliveryMap = () => {
    if (!deliveryMapsUrl) return;
    openMapWithAutoClose(deliveryMapsUrl);
  };

  const handleShareDelivery = async () => {
    if (!rawDeliveryAddress) return;

    const text = `Dirección de entrega del pedido ${formatInvoiceNumber(invoiceNumber)} en ${
      store?.name || 'MundoXYZ'
    }:\n${rawDeliveryAddress}`;

    try {
      if (navigator.share && typeof navigator.share === 'function') {
        await navigator.share({ text, url: deliveryMapsUrl || undefined });
        return;
      }

      const shareUrl = deliveryMapsUrl || rawDeliveryAddress;
      const waText = `${text}\n${shareUrl}`;
      const url = `https://wa.me/?text=${encodeURIComponent(waText)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      // Silencioso: no queremos romper la factura por errores de share
    }
  };

  const handlePrint = () => {
    if (!order) return;
    const storeName = order.store_name || store?.name || 'Factura';
    const formattedNumber = formatInvoiceNumber(invoiceNumber);
    const previousTitle = document.title;

    document.title = `${storeName} - Factura ${formattedNumber}`;
    document.body.classList.add('print-invoice');

    try {
      window.print();
    } finally {
      document.body.classList.remove('print-invoice');
      document.title = previousTitle;
    }
  };

  const handleBack = () => {
    if (fromOrders) {
      navigate('/profile?tab=orders');
    } else if (fromReports) {
      navigate(`/store/${slug}/dashboard?tab=reports`);
    } else {
      navigate(`/store/${slug}`);
    }
  };

  const handleGoToProfileOrders = () => {
    navigate('/profile?tab=orders');
  };

  const handleGoToStoreReports = () => {
    navigate(`/store/${slug}/dashboard?tab=reports`);
  };

  const location = store?.location && typeof store.location === 'object' ? store.location : {};
  const mapsUrl = location.maps_url || location.google_maps_url || '';
  const locationAddress = location.address || '';

  const deliveryInfo = order && order.delivery_info && typeof order.delivery_info === 'object'
    ? order.delivery_info
    : null;
  const rawDeliveryAddress = typeof deliveryInfo?.address === 'string' ? deliveryInfo.address.trim() : '';

  const isDeliveryUrl = rawDeliveryAddress && /^https?:\/\//i.test(rawDeliveryAddress);
  const deliveryMapsUrl = rawDeliveryAddress
    ? isDeliveryUrl
      ? rawDeliveryAddress
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawDeliveryAddress)}`
    : '';

  const handleOpenMap = () => {
    if (mapsUrl) {
      openMapWithAutoClose(mapsUrl);
    } else if (locationAddress) {
      openLocationSearch(locationAddress);
    }
  };

  let subtotalBs = null;
  let taxBs = null;
  let deliveryBs = null;
  let discountBs = null;
  let totalBs = null;

  if (order && bsRate) {
    subtotalBs = order.subtotal_usdt * bsRate;
    taxBs = order.tax_usdt * bsRate;
    deliveryBs = order.delivery_fee_usdt * bsRate;
    discountBs = order.discount_usdt * bsRate;
    totalBs = order.total_usdt * bsRate;
  }

  if (loadingStore) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-text/60">
        Cargando tienda...
      </div>
    );
  }

  if (storeError) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-red-400">
        Error al cargar la tienda.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-dark text-text">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-glass hover:bg-glass-hover"
          >
            <ArrowLeft size={14} />
            {fromOrders
              ? 'Volver a mis pedidos'
              : fromReports
              ? 'Volver a pedidos / informes'
              : 'Volver a la tienda'}
          </button>

          <div className="flex gap-2">
            {(mapsUrl || locationAddress) && (
              <button
                type="button"
                onClick={handleOpenMap}
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-glass hover:bg-glass-hover"
              >
                <MapPin size={14} />
                Ubicación de la tienda
              </button>
            )}
            <button
              type="button"
              onClick={handleGoToProfileOrders}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-glass hover:bg-glass-hover"
            >
              <ShoppingBag size={14} />
              Mis pedidos
            </button>
            <button
              type="button"
              onClick={handleGoToStoreReports}
              className="hidden md:flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-glass hover:bg-glass-hover"
            >
              <ListChecks size={14} />
              Pedidos / informes
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-accent text-dark hover:bg-accent/90"
            >
              <FileText size={14} />
              Descargar / PDF
            </button>
          </div>
        </div>

        <div className="card-glass p-4 md:p-6 text-xs">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold mb-1">
                {store?.name ? `${store.name} – ` : ''}
                Factura #{formatInvoiceNumber(invoiceNumber)}
              </h1>
              {order && (
                <p className="text-[11px] text-text/60">
                  Emitida el {order.created_at ? new Date(order.created_at).toLocaleString() : '-'}
                </p>
              )}
            </div>
          </div>

          {loadingInvoice && (
            <p className="text-text/60 text-xs">Cargando factura...</p>
          )}
          {invoiceError && !loadingInvoice && (
            <p className="text-red-400 text-xs">Error al cargar la factura.</p>
          )}
          {!loadingInvoice && !invoiceError && !order && (
            <p className="text-text/60 text-xs">Factura no encontrada.</p>
          )}

          {order && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] text-text/60">Cliente</p>
                  <p className="text-xs font-semibold">
                    {order.customer?.name || 'Consumidor final'}
                  </p>
                  {order.customer?.ci && (
                    <p className="text-[11px] text-text/70">CI: {order.customer.ci}</p>
                  )}
                  {order.customer?.phone && (
                    <p className="text-[11px] text-text/70">Teléfono: {order.customer.phone}</p>
                  )}
                  {order.customer?.email && (
                    <p className="text-[11px] text-text/70">Email: {order.customer.email}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-text/60">Detalles</p>
                  <p className="text-[11px] text-text/70">Tipo: {order.type}</p>
                  {order.table_number && (
                    <p className="text-[11px] text-text/70">Mesa / Ref: {order.table_number}</p>
                  )}
                  {order.seller && (
                    <p className="text-[11px] text-text/70">
                      Vendedor: {order.seller.name || order.seller.username || '-'}
                    </p>
                  )}
                </div>
              </div>

              {rawDeliveryAddress && (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                  <div className="space-y-1">
                    <p className="text-text/60">Dirección / link de entrega</p>
                    <p className="text-text/80 break-all whitespace-pre-wrap">{rawDeliveryAddress}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-start md:justify-end">
                    {deliveryMapsUrl && (
                      <button
                        type="button"
                        onClick={handleOpenDeliveryMap}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-glass hover:bg-glass-hover"
                      >
                        <MapPin size={12} />
                        Abrir mapa
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleShareDelivery}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-glass hover:bg-glass-hover"
                    >
                      <Share2 size={12} />
                      Compartir
                    </button>
                  </div>
                </div>
              )}

              <div>
                <table className="min-w-full text-[11px] align-middle">
                  <thead>
                    <tr className="text-text/60 border-b border-glass">
                      <th className="py-1 pr-3 text-left">Producto</th>
                      <th className="py-1 pr-3 text-right">Cant.</th>
                      <th className="py-1 pr-3 text-right">P. unit USDT</th>
                      <th className="py-1 pr-3 text-right">Total USDT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, idx) => (
                      <tr
                        key={`${item.product_id || idx}-${idx}`}
                        className="border-b border-glass/40"
                      >
                        <td className="py-1 pr-3 text-text/80">
                          <div>{item.product_name || 'Producto'}</div>
                          {Array.isArray(item.modifiers) && item.modifiers.length > 0 && (
                            <div className="mt-0.5 text-[10px] text-text/70 space-y-0.5">
                              {Object.entries(
                                item.modifiers.reduce((groups, mod) => {
                                  if (!mod) return groups;
                                  const groupName = mod.group_name || 'Extras';
                                  if (!groups[groupName]) groups[groupName] = [];
                                  groups[groupName].push(mod);
                                  return groups;
                                }, {})
                              ).map(([groupName, mods]) => (
                                <div
                                  key={groupName}
                                  className="flex flex-wrap items-center gap-1"
                                >
                                  <span className="font-semibold mr-1">{groupName}:</span>
                                  {mods.map((mod) => {
                                    const { label, color } = parseModifierColorFromName(mod.name);
                                    const extra = Number(mod.price_adjustment_usdt || 0);

                                    return (
                                      <span
                                        key={mod.id}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-glass text-[9px]"
                                      >
                                        {color && (
                                          <span
                                            className="w-3 h-3 rounded-full border border-white/30"
                                            style={{ backgroundColor: color }}
                                          />
                                        )}
                                        <span>
                                          {label || mod.name}
                                          {color && ` x${item.quantity}`}
                                        </span>
                                        {extra > 0 && (
                                          <span className="opacity-70">
                                            (+{extra.toFixed(2)})
                                          </span>
                                        )}
                                      </span>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-1 pr-3 text-right text-text/80">{item.quantity}</td>
                        <td className="py-1 pr-3 text-right text-text/80">
                          {Number(item.price_usdt || 0).toFixed(2)}
                        </td>
                        <td className="py-1 pr-3 text-right text-text/80">
                          {(Number(item.price_usdt || 0) * Number(item.quantity || 0)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 text-[11px] max-w-xs ml-auto">
                <div className="flex justify-between">
                  <span>Subtotal (USDT)</span>
                  <span>{order.subtotal_usdt.toFixed(2)}</span>
                </div>
                {subtotalBs != null && (
                  <div className="flex justify-between text-text/60">
                    <span>Subtotal (Bs)</span>
                    <span>
                      {subtotalBs.toLocaleString('es-VE', {
                        style: 'currency',
                        currency: 'VES'
                      })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>IVA (USDT)</span>
                  <span>{order.tax_usdt.toFixed(2)}</span>
                </div>
                {taxBs != null && (
                  <div className="flex justify-between text-text/60">
                    <span>IVA (Bs)</span>
                    <span>
                      {taxBs.toLocaleString('es-VE', {
                        style: 'currency',
                        currency: 'VES'
                      })}
                    </span>
                  </div>
                )}
                {order.delivery_fee_usdt > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery (USDT)</span>
                    <span>{order.delivery_fee_usdt.toFixed(2)}</span>
                  </div>
                )}
                {deliveryBs != null && order.delivery_fee_usdt > 0 && (
                  <div className="flex justify-between text-text/60">
                    <span>Delivery (Bs)</span>
                    <span>
                      {deliveryBs.toLocaleString('es-VE', {
                        style: 'currency',
                        currency: 'VES'
                      })}
                    </span>
                  </div>
                )}
                {order.discount_usdt > 0 && (
                  <div className="flex justify-between">
                    <span>Descuento (USDT)</span>
                    <span>-{order.discount_usdt.toFixed(2)}</span>
                  </div>
                )}
                {discountBs != null && order.discount_usdt > 0 && (
                  <div className="flex justify-between text-text/60">
                    <span>Descuento (Bs)</span>
                    <span>
                      -
                      {discountBs.toLocaleString('es-VE', {
                        style: 'currency',
                        currency: 'VES'
                      })}
                    </span>
                  </div>
                )}
                <div className="h-px bg-glass my-1" />
                <div className="flex justify-between font-semibold text-sm">
                  <span>Total (USDT)</span>
                  <span>{order.total_usdt.toFixed(2)}</span>
                </div>
                {totalBs != null && (
                  <div className="flex justify-between text-[11px] text-text/80">
                    <span>Total (Bs)</span>
                    <span>
                      {totalBs.toLocaleString('es-VE', {
                        style: 'currency',
                        currency: 'VES'
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreFrontInvoicePage;
