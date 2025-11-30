import React, { useState, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Plus, Minus, X, ChevronRight, Star, Clock, CreditCard, Flame, Share2, MapPin } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { downloadQrForUrl } from '../../utils/qr';
import CameraButton from '../../components/CameraButton';
import { openMapWithAutoClose, openLocationSearch } from '../../utils/mapHelper';
import ProductShareModal from '../../components/ProductShareModal';
import './StoreFront.css'; // Custom styles

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

    let color = null;
    let label = trimmed;

    // Buscar patrones de color en cualquier parte del texto
    const colorPatterns = [
        // Patrones hexadecimales: #FF0000, #F00, etc.
        /#([0-9a-f]{3}|[0-9a-f]{6})\b/gi,
        // Patrones de palabras clave: rojo, azul, etc.
        /\b(rojo|azul|verde|amarillo|naranja|morado|rosa|negro|blanco|gris|dorado|plateado)\b/gi
    ];

    for (const pattern of colorPatterns) {
        const matches = trimmed.match(pattern);
        if (matches) {
            for (const match of matches) {
                // Si es un color hexadecimal
                if (match.startsWith('#')) {
                    const token = match.slice(1).toLowerCase();
                    if (/^[0-9a-f]{3}$|^[0-9a-f]{6}$/.test(token)) {
                        color = `#${token}`;
                        break;
                    }
                } 
                // Si es una palabra clave de color
                else {
                    const token = match.toLowerCase();
                    if (COLOR_KEYWORDS[token]) {
                        color = COLOR_KEYWORDS[token].color;
                        break;
                    }
                }
            }
            if (color) break;
        }
    }

    // Si se encontró un color, mantener el nombre completo
    if (color) {
        // Para colores hexadecimales, mostrar el código como nombre si no hay otro texto
        if (trimmed.match(/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i)) {
            label = trimmed; // Mantener el código HEX como nombre
        } else {
            // Para colores con nombre, mantener el nombre original
            label = trimmed;
        }
    }

    return { label, color };
};

const buildModifierSignature = (modifiers) => {
    if (!Array.isArray(modifiers) || modifiers.length === 0) return 'none';

    const parts = modifiers
        .filter(Boolean)
        .map((mod) => {
            if (mod.id != null) return String(mod.id);
            const group = mod.group_name || '';
            const name = mod.name || '';
            return `${group}:${name}`;
        })
        .sort();

    return parts.join('|');
};

const StoreFront = () => {
    const { slug } = useParams(); // e.g., 'divorare04'
    const navigate = useNavigate();
    const { user, loginWithCredentials, loading: authLoading } = useAuth();
    const [cart, setCart] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showCart, setShowCart] = useState(false);
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null); // For modal
    const [productModalQuantity, setProductModalQuantity] = useState(1);
    const [productModalModifiers, setProductModalModifiers] = useState({});
    const [showProductShareModal, setShowProductShareModal] = useState(false);
    const [productToShare, setProductToShare] = useState(null);
    const [deliveryLocation, setDeliveryLocation] = useState('');
    const [isScheduledOrder, setIsScheduledOrder] = useState(false);
    const [scheduledDateTime, setScheduledDateTime] = useState('');

    // Pagos iniciales como strings vacíos para que no aparezca un '0' pegado al escribir
    const initialPayments = {
        cash_usdt: '',
        usdt_tron: '',
        bs_cash: '',
        bs_transfer: '',
        fires: ''
    };
    const [payments, setPayments] = useState(initialPayments);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [giveChangeInFires, setGiveChangeInFires] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [guestInfoModalOpen, setGuestInfoModalOpen] = useState(false);
    const [guestInfoConfirmed, setGuestInfoConfirmed] = useState(false);
    const [guestAuthMode, setGuestAuthMode] = useState('guest'); // 'guest' | 'login'
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [guestWantsDelivery, setGuestWantsDelivery] = useState(false);
    const [cashProofBase64, setCashProofBase64] = useState('');
    const [cashProofName, setCashProofName] = useState('');
    const [transferReference, setTransferReference] = useState('');
    const [usdtTronHash, setUsdtTronHash] = useState('');

    const basePaymentMethodOptions = [
        { id: 'bs_transfer', defaultLabel: 'Pago móvil / Transferencia en Bs', field: 'bs_transfer' },
        { id: 'bs_cash', defaultLabel: 'Bs en efectivo', field: 'bs_cash' },
        { id: 'usdt_tron', defaultLabel: 'USDT Tron', field: 'usdt_tron' },
        { id: 'cash_usdt', defaultLabel: 'Efectivo (USDT)', field: 'cash_usdt' },
        { id: 'fires', defaultLabel: 'Pago con Fuegos', field: 'fires' }
    ];

    const [paymentLines, setPaymentLines] = useState(() => [
        { id: 1, method: 'bs_transfer' }
    ]);
    const [nextPaymentLineId, setNextPaymentLineId] = useState(2);

    // Fetch Store Data
    const { data: storeData, isLoading } = useQuery({
        queryKey: ['store', slug],
        queryFn: async () => {
            const response = await axios.get(`/api/store/public/${slug}`);
            return response.data;
        }
    });

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
    const firesPerUsdt = fiatContext?.config?.fires_per_usdt;

    const bsRate = typeof vesPerUsdt === 'number' && isFinite(vesPerUsdt) && vesPerUsdt > 0 ? vesPerUsdt : 38.5;
    const firesRate = typeof firesPerUsdt === 'number' && isFinite(firesPerUsdt) && firesPerUsdt > 0 ? firesPerUsdt : 10;

    const rates = {
        bs: bsRate,
        fires: firesRate
    };

    const parseAmount = (value) => {
        const n = typeof value === 'number'
            ? value
            : parseFloat(String(value ?? '').replace(',', '.'));
        return Number.isFinite(n) && n >= 0 ? n : 0;
    };

    const buildDefaultModifiersForProduct = (product) => {
        const modsArray = Array.isArray(product?.modifiers) ? product.modifiers : [];
        if (!modsArray.length) return {};

        const grouped = modsArray.reduce((acc, mod) => {
            if (!mod || !mod.group_name) return acc;
            const groupName = mod.group_name;
            if (!acc[groupName]) acc[groupName] = [];
            acc[groupName].push(mod);
            return acc;
        }, {});

        const initialSelection = {};

        Object.entries(grouped).forEach(([groupName, mods]) => {
            if (!Array.isArray(mods) || mods.length === 0) return;

            const maxSelection = mods[0]?.max_selection || 1;

            const requiredIds = mods
                .filter((m) => m && m.is_required === true)
                .map((m) => m.id)
                .filter((id) => id != null);

            let ids = [];

            if (requiredIds.length > 0) {
                ids = requiredIds;
            } else if (maxSelection > 1) {
                // Para grupos multi-selección sin requeridos, seleccionar todos por defecto
                ids = mods
                    .map((m) => m && m.id)
                    .filter((id) => id != null);
            }

            if (ids.length > 0) {
                initialSelection[groupName] = ids;
            }
        });

        return initialSelection;
    };

    const addToCart = (product, quantity = 1, modifiers = []) => {
        const normalizedModifiers = Array.isArray(modifiers)
            ? modifiers.filter(Boolean)
            : [];
        const newSignature = buildModifierSignature(normalizedModifiers);

        setCart((prev) => {
            const existingIndex = prev.findIndex((item) => {
                if (!item || !item.product || item.product.id !== product.id) return false;
                const existingMods = Array.isArray(item.modifiers) ? item.modifiers : [];
                return buildModifierSignature(existingMods) === newSignature;
            });

            if (existingIndex !== -1) {
                return prev.map((item, idx) => {
                    if (idx !== existingIndex) return item;
                    const newQty = item.quantity + quantity;
                    return {
                        ...item,
                        quantity: newQty
                    };
                });
            }

            return [
                ...prev,
                {
                    product,
                    quantity,
                    modifiers: normalizedModifiers
                }
            ];
        });

        toast.success('Agregado al carrito');
    };

    const updateQuantity = (index, delta) => {
        setCart((prev) => {
            if (index == null || index < 0 || index >= prev.length) return prev;

            const next = prev.map((item, idx) => {
                if (idx !== index) return item;
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            });

            return next.filter((item) => item.quantity > 0);
        });
    };

    const getItemUnitPriceUSDT = (item) => {
        const baseRaw = parseFloat(item.product?.price_usdt);
        const base = Number.isFinite(baseRaw) && baseRaw >= 0 ? baseRaw : 0;

        let modifiersExtra = 0;
        if (Array.isArray(item.modifiers) && item.modifiers.length > 0) {
            for (const mod of item.modifiers) {
                if (!mod) continue;
                const extraRaw =
                    mod.price_adjustment_usdt != null
                        ? Number(mod.price_adjustment_usdt)
                        : mod.price_adjustment != null
                        ? Number(mod.price_adjustment)
                        : 0;
                if (Number.isFinite(extraRaw)) {
                    modifiersExtra += extraRaw;
                }
            }
        }

        return base + modifiersExtra;
    };

    const getSelectedProductUnitPriceUSDT = () => {
        if (!selectedProduct) return 0;

        const baseRaw = parseFloat(selectedProduct.price_usdt);
        const base = Number.isFinite(baseRaw) && baseRaw >= 0 ? baseRaw : 0;

        let modifiersExtra = 0;
        if (
            Array.isArray(selectedProduct.modifiers) &&
            selectedProduct.modifiers.length > 0 &&
            productModalModifiers &&
            typeof productModalModifiers === 'object'
        ) {
            const mods = selectedProduct.modifiers;
            const selectedGroups = Object.values(productModalModifiers);
            const selectedIds = new Set(
                selectedGroups.flat().filter((id) => id != null)
            );

            for (const mod of mods) {
                if (!mod || !selectedIds.has(mod.id)) continue;
                const extraRaw =
                    mod.price_adjustment_usdt != null
                        ? Number(mod.price_adjustment_usdt)
                        : mod.price_adjustment != null
                        ? Number(mod.price_adjustment)
                        : 0;
                if (Number.isFinite(extraRaw)) {
                    modifiersExtra += extraRaw;
                }
            }
        }

        return base + modifiersExtra;
    };

    const cartTotalUSDT = cart.reduce((sum, item) => sum + getItemUnitPriceUSDT(item) * item.quantity, 0);

    // Subtotal elegible para pago con Fuegos (solo productos que aceptan Fuegos)
    const firesEligibleUSDT = cart.reduce((sum, item) => {
        if (!item.product?.accepts_fires) return sum;
        return sum + getItemUnitPriceUSDT(item) * item.quantity;
    }, 0);

    const firesRateForCart = Number(rates.fires);
    const maxFiresTokens =
        Number.isFinite(firesRateForCart) && firesRateForCart > 0
            ? Math.floor(firesEligibleUSDT * firesRateForCart)
            : 0;
    const canUseFires = maxFiresTokens > 0;

    const rawCashUsdt = parseAmount(payments.cash_usdt);
    const rawBsCash = parseAmount(payments.bs_cash);
    const rawBsTransfer = parseAmount(payments.bs_transfer);
    const rawFiresAmount = parseAmount(payments.fires);
    const rawUsdtTron = parseAmount(payments.usdt_tron);

    const enabledMethods = new Set(paymentLines.map((l) => l.method));

    const cashUsdt = enabledMethods.has('cash_usdt') ? rawCashUsdt : 0;
    const usdtTron = enabledMethods.has('usdt_tron') ? rawUsdtTron : 0;
    const bsCashAmount = enabledMethods.has('bs_cash') ? rawBsCash : 0;
    const bsTransferAmount = enabledMethods.has('bs_transfer') ? rawBsTransfer : 0;
    const bsAmount = bsCashAmount + bsTransferAmount;
    const firesAmountTokens = enabledMethods.has('fires') && canUseFires
        ? Math.min(rawFiresAmount, maxFiresTokens)
        : 0;

    const totalPaidUSDT =
        cashUsdt +
        usdtTron +
        (bsAmount / rates.bs) +
        (firesAmountTokens / rates.fires);

    const remainingUSDT = Math.max(0, cartTotalUSDT - totalPaidUSDT);
    const changeUSDT = Math.max(0, totalPaidUSDT - cartTotalUSDT);

    const isPaid = totalPaidUSDT >= cartTotalUSDT - 0.01;

    const totalBs = cartTotalUSDT * rates.bs;
    const totalFires = cartTotalUSDT * rates.fires;
    const changeFires = changeUSDT * rates.fires;

    const hasDeliveryLocation = !!(deliveryLocation && deliveryLocation.trim());
    const wantsDelivery = guestWantsDelivery || hasDeliveryLocation;

    const createOrderMutation = useMutation({
        mutationFn: async (orderData) => {
            const response = await axios.post('/api/store/order/create', orderData);
            return response.data;
        },
        onSuccess: (data) => {
            const createdOrder = data?.order || data;

            // Redirigir a la página de factura del StoreFront si hay invoice_number
            if (createdOrder && createdOrder.store_id && createdOrder.invoice_number != null) {
                navigate(`/store/${slug}/invoice/${createdOrder.invoice_number}`);
            }

            toast.success('Pedido creado exitosamente');
            setCart([]);
            setShowCart(false);
            setPaymentModalOpen(false);
            setPayments(initialPayments);
            setGiveChangeInFires(false);
            setPaymentLines([{ id: 1, method: 'bs_transfer' }]);
            setNextPaymentLineId(2);
            setCashProofBase64('');
            setCashProofName('');
            setTransferReference('');
            setUsdtTronHash('');
            setGuestInfoConfirmed(false);
        },
        onError: (error) => {
            const message = error?.response?.data?.error || 'Error al crear pedido';
            toast.error(message);
        }
    });

    const handleCashProofChange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) {
            setCashProofBase64('');
            setCashProofName('');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result;
            if (typeof result === 'string') {
                const base64 = result.includes(',') ? result.split(',')[1] : result;
                setCashProofBase64(base64 || '');
                setCashProofName(file.name || '');
            }
        };
        reader.readAsDataURL(file);
    };

    const handleUseCurrentLocation = () => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            toast.error('Tu navegador no permite obtener la ubicación automáticamente');
            return;
        }

        const loadingId = toast.loading('Obteniendo tu ubicación...');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                toast.dismiss(loadingId);
                const { latitude, longitude } = position.coords;
                if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                    toast.error('No se pudo interpretar tu ubicación');
                    return;
                }

                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
                setDeliveryLocation(mapsUrl);

                try {
                    openMapWithAutoClose(mapsUrl, 5000); // Mantener abierto 5 segundos para que usuario copie dirección
                } catch {
                }
            },
            (error) => {
                toast.dismiss(loadingId);
                if (error.code === 1) {
                    toast.error('Debes permitir el acceso a tu ubicación para usar esta opción');
                } else if (error.code === 2) {
                    toast.error('No se pudo determinar tu ubicación. Intenta nuevamente');
                } else if (error.code === 3) {
                    toast.error('La búsqueda de ubicación tardó demasiado. Intenta de nuevo');
                } else {
                    toast.error('Ocurrió un error al obtener tu ubicación');
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 60000
            }
        );
    };

    const handleCheckout = async () => {
        if (cart.length === 0) {
            toast.error('El carrito está vacío');
            return;
        }
        if (!isPaid) {
            toast.error('Falta completar el pago');
            return;
        }

        if (!user) {
            const nameTrimmed = guestName.trim();
            const phoneTrimmed = guestPhone.trim();

            if (!nameTrimmed || !phoneTrimmed) {
                toast.error('Ingresa al menos tu nombre y teléfono para continuar sin registrarte');
                return;
            }
        }

        if (!user && guestWantsDelivery && !hasDeliveryLocation) {
            toast.error('Ingresa una dirección o link para el delivery');
            return;
        }

        if (isScheduledOrder && !scheduledDateTime) {
            toast.error('Selecciona una fecha y hora para tu pedido programado');
            return;
        }

        if (isScheduledOrder && scheduledDateTime) {
            const scheduledDate = new Date(scheduledDateTime);
            const minDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hora en el futuro
            if (scheduledDate < minDate) {
                toast.error('El pedido debe programarse con al menos 1 hora de anticipación');
                return;
            }
        }

        const guestInfo = !user
            ? {
                name: guestName.trim() || null,
                phone: guestPhone.trim() || null,
                email: guestEmail.trim() || null
            }
            : null;

        const paymentMeta = {
            proof_cash_bill_image_base64: cashProofBase64 || null,
            transfer_reference: transferReference.trim() || null,
            usdt_tron_hash: usdtTronHash.trim() || null
        };

        const deliveryInfo = guestInfo || deliveryLocation
            ? {
                ...(guestInfo ? { guest: guestInfo } : {}),
                ...(deliveryLocation ? { address: deliveryLocation } : {})
            }
            : null;

        const orderData = {
            store_id: storeData.store.id,
            items: cart.map((item) => ({
                product_id: item.product.id,
                quantity: item.quantity,
                modifiers: item.modifiers || []
            })),
            type: wantsDelivery ? 'delivery' : 'pickup',
            payment_method: {
                source: 'storefront',
                cash_usdt: cashUsdt,
                usdt_tron: usdtTron,
                bs: bsAmount,
                bs_cash: bsCashAmount,
                bs_transfer: bsTransferAmount,
                fires: firesAmountTokens,
                meta: paymentMeta
            },
            currency_snapshot: rates,
            customer_id: user?.id || null,
            delivery_info: deliveryInfo,
            scheduled_order: isScheduledOrder && scheduledDateTime ? {
                enabled: true,
                scheduled_for: scheduledDateTime
            } : { enabled: false },
            change_to_fires: giveChangeInFires && changeUSDT > 0 && user?.id
                ? {
                    enabled: true,
                    change_usdt: changeUSDT,
                    change_fires: changeFires
                }
                : { enabled: false }
        };

        await createOrderMutation.mutateAsync(orderData);
    };

    const handleConfirmClick = async () => {
        if (!user && !guestInfoConfirmed) {
            setGuestInfoModalOpen(true);
            return;
        }

        await handleCheckout();
    };

    const handleGuestConfirm = async () => {
        const nameTrimmed = guestName.trim();
        const phoneTrimmed = guestPhone.trim();

        if (!nameTrimmed || !phoneTrimmed) {
            toast.error('Ingresa al menos tu nombre y teléfono para continuar sin registrarte');
            return;
        }

        if (guestWantsDelivery && !hasDeliveryLocation) {
            toast.error('Ingresa una dirección o link para el delivery');
            return;
        }

        if (isScheduledOrder && !scheduledDateTime) {
            toast.error('Selecciona una fecha y hora para tu pedido programado');
            return;
        }

        if (isScheduledOrder && scheduledDateTime) {
            const scheduledDate = new Date(scheduledDateTime);
            const minDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hora en el futuro
            if (scheduledDate < minDate) {
                toast.error('El pedido debe programarse con al menos 1 hora de anticipación');
                return;
            }
        }

        setGuestInfoConfirmed(true);
        setGuestInfoModalOpen(false);
        await handleCheckout();
    };

    const handleInlineLogin = async () => {
        const username = loginUsername.trim();
        const password = loginPassword;

        if (!username || !password) {
            toast.error('Ingresa usuario y contraseña para iniciar sesión');
            return;
        }

        const result = await loginWithCredentials(username, password);
        if (result?.success) {
            setGuestAuthMode('guest');
            setGuestInfoModalOpen(false);
            setGuestInfoConfirmed(false);
            toast.success('Sesión iniciada. Ahora confirma tu pedido para continuar.');
        }
    };

    if (isLoading) return <div className="flex justify-center p-20"><div className="spinner"></div></div>;
    if (!storeData) return <div className="text-center p-20">Tienda no encontrada</div>;

    const { store, categories, products } = storeData;

    const storeSettings = store?.settings && typeof store.settings === 'object'
        ? store.settings
        : {};
    const storePaymentMethodsSettings =
        storeSettings.payment_methods && typeof storeSettings.payment_methods === 'object'
            ? storeSettings.payment_methods
            : {};

    const paymentMethodOptions = basePaymentMethodOptions.map((opt) => {
        const cfg =
            storePaymentMethodsSettings[opt.id] &&
            typeof storePaymentMethodsSettings[opt.id] === 'object'
                ? storePaymentMethodsSettings[opt.id]
                : {};

        const label =
            typeof cfg.label === 'string' && cfg.label.trim()
                ? cfg.label.trim()
                : opt.defaultLabel;

        const instructions =
            typeof cfg.instructions === 'string' ? cfg.instructions : '';

        return {
            id: opt.id,
            field: opt.field,
            label,
            instructions
        };
    });

    const headerLayout = storeSettings.header_layout || 'normal';

    const location = store?.location && typeof store.location === 'object'
        ? store.location
        : {};
    const mapsUrl = location.maps_url || location.google_maps_url || '';
    const locationAddress = location.address || '';

    const heroHeightClass =
        headerLayout === 'compact'
            ? 'h-40 md:h-48'
            : headerLayout === 'full'
                ? 'h-80 md:h-96'
                : 'h-64 md:h-80';

    const logoSizeClass =
        headerLayout === 'compact'
            ? 'w-14 h-14'
            : headerLayout === 'full'
                ? 'w-24 h-24'
                : 'w-20 h-20';

    const titleSizeClass =
        headerLayout === 'compact'
            ? 'text-2xl md:text-3xl'
            : headerLayout === 'full'
                ? 'text-4xl md:text-5xl'
                : 'text-3xl md:text-4xl';

    const hideMetaOnCompact = headerLayout === 'compact';

    const shareStore = async (platform) => {
        const slugValue = store?.slug || slug;
        if (!slugValue || typeof window === 'undefined') {
            toast.error('No se pudo generar el enlace de la tienda');
            return;
        }

        const shareUrl = `${window.location.origin}/store/${slugValue}`;
        const shareText = `Mira la tienda "${store?.name || 'MundoXYZ'}" en MundoXYZ`;

        switch (platform) {
            case 'whatsapp': {
                const url = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
                window.open(url, '_blank', 'noopener,noreferrer');
                break;
            }
            case 'telegram': {
                const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
                window.open(url, '_blank', 'noopener,noreferrer');
                break;
            }
            case 'copy': {
                try {
                    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                        await navigator.clipboard.writeText(shareUrl);
                        toast.success('Enlace copiado al portapapeles');
                    } else {
                        window.prompt('Copia este link de la tienda:', shareUrl);
                    }
                } catch (err) {
                    console.error('Error copiando enlace de tienda:', err);
                    window.prompt('Copia este link de la tienda:', shareUrl);
                }
                break;
            }
            case 'qr': {
                try {
                    await downloadQrForUrl(shareUrl, `tienda-${slugValue}-qr.png`);
                } catch (err) {
                    console.error('Error generando QR de tienda:', err);
                }
                break;
            }
            default:
                break;
        }

        setShowShareMenu(false);
    };

    const activeCategory = selectedCategory || categories[0]?.id;
    const filteredProducts = products
        .filter((p) => p.category_id === activeCategory)
        .filter((p) => {
            const rawStock = p.stock;
            const stockNumber = typeof rawStock === 'number' ? rawStock : parseFloat(rawStock);
            if (!Number.isFinite(stockNumber)) return true;
            return stockNumber > 0;
        });

    return (
        <>
        <div className="store-front min-h-screen bg-dark pb-24">
            {/* Hero Section */}
            <div className={`relative ${heroHeightClass} overflow-hidden`}>
                <div className="absolute inset-0 bg-gradient-to-t from-dark via-transparent to-transparent z-10"></div>
                <img
                    src={store.cover_url || 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=1974&auto=format&fit=crop'}
                    alt="Cover"
                    className="w-full h-full object-cover"
                />
                <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
                    {(mapsUrl || locationAddress) && (
                        <button
                            type="button"
                            onClick={() => {
                                if (mapsUrl) {
                                    openMapWithAutoClose(mapsUrl);
                                } else if (locationAddress) {
                                    openLocationSearch(locationAddress);
                                }
                            }}
                            className="w-9 h-9 rounded-full bg-dark/70 hover:bg-dark/90 border border-white/20 flex items-center justify-center text-white/80 text-xs shadow-lg"
                        >
                            <span role="img" aria-label="Ubicación">📍</span>
                        </button>
                    )}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowShareMenu((prev) => !prev)}
                            className="w-9 h-9 rounded-full bg-dark/70 hover:bg-dark/90 border border-white/20 flex items-center justify-center text-white/80 text-xs shadow-lg"
                        >
                            <Share2 size={16} />
                        </button>
                        <AnimatePresence>
                            {showShareMenu && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                    className="absolute right-0 top-full mt-2 w-48 max-w-[calc(100vw-3rem)] bg-black/80 backdrop-blur-md rounded-lg shadow-xl border border-white/10 z-50"
                                >
                                    <button
                                        onClick={() => shareStore('whatsapp')}
                                        className="w-full px-4 py-2 text-left text-sm text-white flex items-center gap-2 hover:bg-white/10"
                                    >
                                        <span>WhatsApp</span>
                                    </button>
                                    <button
                                        onClick={() => shareStore('telegram')}
                                        className="w-full px-4 py-2 text-left text-sm text-white flex items-center gap-2 hover:bg-white/10"
                                    >
                                        <span>Telegram</span>
                                    </button>
                                    <button
                                        onClick={() => shareStore('copy')}
                                        className="w-full px-4 py-2 text-left text-sm text-white flex items-center gap-2 hover:bg-white/10"
                                    >
                                        <span>Copiar enlace</span>
                                    </button>
                                    <button
                                        onClick={() => shareStore('qr')}
                                        className="w-full px-4 py-2 text-left text-sm text-white flex items-center gap-2 hover:bg-white/10"
                                    >
                                        <span>Descargar QR</span>
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 z-20 container mx-auto">
                    <div className="flex items-end gap-4">
                        <img
                            src={store.logo_url || 'https://ui-avatars.com/api/?name=Divorare&background=random'}
                            alt="Logo"
                            className={`${logoSizeClass} rounded-xl shadow-lg border-2 border-accent`}
                        />
                        <div className="flex-1">
                            <h1 className={`${titleSizeClass} font-bold text-white mb-1`}>{store.name}</h1>
                            {!hideMetaOnCompact && (
                                <div className="flex flex-wrap gap-4 text-sm text-white/80">
                                    <span className="flex items-center gap-1"><Star size={14} className="text-yellow-400 fill-yellow-400" /> 4.8 (120+)</span>
                                    <span className="flex items-center gap-1"><Clock size={14} /> 30-45 min</span>
                                    {(mapsUrl || locationAddress) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (mapsUrl) {
                                                    openMapWithAutoClose(mapsUrl);
                                                } else if (locationAddress) {
                                                    openLocationSearch(locationAddress);
                                                }
                                            }}
                                            className="flex items-center gap-1 hover:text-white underline-offset-2 hover:underline"
                                        >
                                            <span role="img" aria-label="Ubicación">📍</span>
                                            <span>Ubicación</span>
                                            {locationAddress && (
                                                <span className="hidden sm:inline truncate max-w-[10rem]">{locationAddress}</span>
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Categories Sticky Nav */}
            <div className="sticky top-0 z-30 bg-dark/95 backdrop-blur-md border-b border-white/10 overflow-x-auto">
                <div className="container mx-auto px-4 flex gap-4 py-4 no-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeCategory === cat.id
                                    ? 'bg-accent text-dark'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Products Grid */}
            <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProducts.map((product) => {
                        const productCartItems = cart.filter((item) => item.product.id === product.id);
                        const totalQuantity = productCartItems.reduce(
                            (sum, it) => sum + (it.quantity || 0),
                            0
                        );

                        const basePriceRaw = parseFloat(product.price_usdt);
                        const basePriceUsdt = Number.isFinite(basePriceRaw) && basePriceRaw >= 0 ? basePriceRaw : 0;
                        const priceBs = basePriceUsdt * rates.bs;

                        const rawStock = product.stock;
                        const stockNumber = typeof rawStock === 'number' ? rawStock : parseFloat(rawStock);
                        const hasNumericStock = Number.isFinite(stockNumber);

                        return (
                            <motion.div
                                key={product.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-glass rounded-xl overflow-hidden border border-white/5 hover:border-accent/30 transition-all group cursor-pointer"
                                onClick={() => {
                                    setSelectedProduct(product);
                                    setProductModalQuantity(1);
                                    setProductModalModifiers(buildDefaultModifiersForProduct(product));
                                }}
                            >
                                <div className="relative h-48 overflow-hidden">
                                    <img
                                        src={product.image_url || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=1000&auto=format&fit=crop'}
                                        alt={product.name}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                    {/* Share Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setProductToShare({
                                                ...product,
                                                store_slug: storeData.store.slug,
                                                store_name: storeData.store.name
                                            });
                                            setShowProductShareModal(true);
                                        }}
                                        className="absolute top-3 left-3 w-8 h-8 bg-dark/80 hover:bg-dark/90 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm transition-colors"
                                    >
                                        <Share2 size={16} className="text-white/80" />
                                    </button>
                                    {totalQuantity === 0 ? (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                addToCart(product);
                                            }}
                                            className="absolute bottom-3 right-3 w-10 h-10 bg-accent text-dark rounded-full flex items-center justify-center shadow-lg"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    ) : (
                                        <div className="absolute bottom-3 right-3 flex items-center bg-dark/80 rounded-full shadow-lg overflow-hidden">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    let targetIndex = -1;
                                                    for (let i = cart.length - 1; i >= 0; i -= 1) {
                                                        if (cart[i].product.id === product.id) {
                                                            targetIndex = i;
                                                            break;
                                                        }
                                                    }
                                                    if (targetIndex !== -1) {
                                                        updateQuantity(targetIndex, -1);
                                                    }
                                                }}
                                                className="w-8 h-8 flex items-center justify-center text-white/80 hover:bg-white/10"
                                            >
                                                <Minus size={16} />
                                            </button>
                                            <span className="px-3 text-sm font-semibold text-white">{totalQuantity}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    addToCart(product, 1);
                                                }}
                                                className="w-8 h-8 flex items-center justify-center text-white/80 hover:bg-white/10"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4">
                                    <div className="flex justify-between items-start mb-2 gap-3">
                                        <h3 className="font-bold text-lg text-white">{product.name}</h3>
                                        <div className="text-right leading-tight">
                                            <div className="font-bold text-accent text-sm">
                                                {priceBs.toLocaleString('es-VE', {
                                                    style: 'currency',
                                                    currency: 'VES'
                                                })}
                                            </div>
                                            <div className="text-[11px] text-white/60">
                                                ≈ ${basePriceUsdt.toFixed(2)} USDT
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-white/60 line-clamp-2 mb-2">{product.description}</p>
                                    {hasNumericStock && (
                                        <div className="text-xs text-white/70">
                                            Stock disponible: {stockNumber}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Floating Cart Button */}
            <AnimatePresence>
                {cart.length > 0 && (
                    <motion.div
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        className="fixed bottom-24 md:bottom-6 inset-x-0 px-4 z-40 pointer-events-none"
                    >
                        <div className="container mx-auto max-w-lg pointer-events-auto">
                            <button
                                onClick={() => setShowCart(true)}
                                className="w-2/3 md:w-full mx-auto bg-accent text-dark py-3 px-4 rounded-xl shadow-2xl flex justify-between items-center font-semibold text-sm md:text-base"
                            >
                                <div className="flex items-center gap-2 md:gap-3">
                                    <div className="bg-dark/20 w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm">
                                        {cart.length}
                                    </div>
                                    <span>Ver pedido</span>
                                </div>
                                <span>${cartTotalUSDT.toFixed(2)}</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cart Sidebar/Modal */}
            <AnimatePresence>
                {showCart && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1100]"
                            onClick={() => setShowCart(false)}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            className="fixed inset-y-0 right-0 w-full max-w-md bg-dark border-l border-white/10 z-[1101] flex flex-col"
                        >
                            <div className="p-6 border-b border-white/10 flex justify-between items-center">
                                <h2 className="text-xl font-bold">Tu Pedido</h2>
                                <button onClick={() => setShowCart(false)} className="text-white/60 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {cart.map((item, idx) => (
                                    <div key={`${item.product.id}-${idx}`} className="flex gap-4">
                                        <img
                                            src={item.product.image_url || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=1000&auto=format&fit=crop'}
                                            alt={item.product.name}
                                            className="w-16 h-16 rounded-lg object-cover bg-white/5"
                                        />
                                        <div className="flex-1">
                                            <div className="flex justify-between mb-1">
                                                <h4 className="font-medium">{item.product.name}</h4>
                                                <div className="text-right">
                                                    <span className="block text-white/80">
                                                        ${(
                                                            getItemUnitPriceUSDT(item) *
                                                            item.quantity
                                                        ).toFixed(2)}
                                                    </span>
                                                    <span className="block text-[11px] text-white/50">
                                                        {(
                                                            getItemUnitPriceUSDT(item) *
                                                            item.quantity *
                                                            rates.bs
                                                        ).toLocaleString('es-VE', {
                                                            style: 'currency',
                                                            currency: 'VES'
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                            {Array.isArray(item.modifiers) && item.modifiers.length > 0 && (
                                                <div className="mt-1 text-[11px] text-white/70 space-y-0.5">
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
                                                                const { label, color } = parseModifierColorFromName(
                                                                    mod.name
                                                                );
                                                                const extra = Number(
                                                                    mod.price_adjustment_usdt || 0
                                                                );

                                                                return (
                                                                    <span
                                                                        key={mod.id}
                                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-[10px]"
                                                                    >
                                                                        {color && (
                                                                            <span
                                                                                className="w-3 h-3 rounded-full border border-white/40"
                                                                                style={{ backgroundColor: color }}
                                                                            />
                                                                        )}
                                                                        <span>
                                                                            {label || mod.name}
                                                                            {color && ` x${item.quantity}`}
                                                                        </span>
                                                                        {extra > 0 && (
                                                                            <span className="opacity-70">
                                                                                (+${extra.toFixed(2)})
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-3 mt-2">
                                                <button
                                                    onClick={() => updateQuantity(idx, -1)}
                                                    className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <span className="text-sm">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(idx, 1)}
                                                    className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 border-t border-white/10 bg-white/5">
                                <div className="space-y-2 mb-4 text-sm">
                                    <div className="flex justify-between text-white/60">
                                        <span>Subtotal</span>
                                        <span>${cartTotalUSDT.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-start text-white/60 gap-3">
                                        <div className="flex flex-col items-start gap-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const value = window.prompt(
                                                        'Ingresa tu ubicación o dirección para el delivery',
                                                        deliveryLocation || ''
                                                    );
                                                    if (value !== null) {
                                                        setDeliveryLocation(value.trim());
                                                    }
                                                }}
                                                className="text-xs text-accent underline-offset-2 hover:underline"
                                            >
                                                {deliveryLocation
                                                    ? 'Editar ubicación de delivery'
                                                    : 'Agregar ubicación de delivery'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleUseCurrentLocation}
                                                className="inline-flex items-center gap-1 text-[11px] text-accent/90 underline-offset-2 hover:underline"
                                            >
                                                <MapPin size={12} />
                                                Usar mi ubicación
                                            </button>
                                        </div>
                                        <span className="mt-1">$0.00</span>
                                    </div>
                                    {deliveryLocation && (
                                        <div className="text-[11px] text-white/50 mt-1 line-clamp-2">
                                            {deliveryLocation}
                                        </div>
                                    )}
                                    <div className="flex justify-between text-xl font-bold text-accent pt-2 border-t border-white/10">
                                        <span>Total</span>
                                        <span>${cartTotalUSDT.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-white/60 mt-1">
                                        <span>Referencia en Bs</span>
                                        <span>
                                            {(
                                                cartTotalUSDT * rates.bs
                                            ).toLocaleString('es-VE', {
                                                style: 'currency',
                                                currency: 'VES'
                                            })}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    className="w-full btn-primary py-4 text-lg flex justify-between items-center px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={() => setPaymentModalOpen(true)}
                                    disabled={cart.length === 0 || createOrderMutation.isLoading}
                                >
                                    <span>{createOrderMutation.isLoading ? 'Procesando...' : 'Pagar'}</span>
                                    <ChevronRight />
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
            {selectedProduct && (
                <div className="fixed inset-0 z-[1101] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-dark border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-white mb-1">{selectedProduct.name}</h2>
                                {selectedProduct.category_name && (
                                    <p className="text-xs text-white/50">{selectedProduct.category_name}</p>
                                )}
                            </div>
                            <button
                                onClick={() => setSelectedProduct(null)}
                                className="text-white/60 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="mb-4 rounded-xl overflow-hidden border border-white/10 bg-black/40">
                            <img
                                src={selectedProduct.image_url || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=1000&auto=format&fit=crop'}
                                alt={selectedProduct.name}
                                className="w-full h-56 object-cover"
                            />
                        </div>

                        <p className="text-sm text-white/70 mb-4">
                            {selectedProduct.description || 'Sin descripción detallada.'}
                        </p>

                        {Array.isArray(selectedProduct.modifiers) && selectedProduct.modifiers.length > 0 && (
                            <div className="mb-4 space-y-3">
                                {Object.entries(
                                    selectedProduct.modifiers.reduce((groups, mod) => {
                                        if (!mod || !mod.group_name) return groups;
                                        if (!groups[mod.group_name]) groups[mod.group_name] = [];
                                        groups[mod.group_name].push(mod);
                                        return groups;
                                    }, {})
                                ).map(([groupName, mods]) => {
                                    const options = Array.isArray(mods) ? mods : [];
                                    if (options.length === 0) return null;

                                    const maxSelection = options[0]?.max_selection || 1;
                                    const selectedIds = productModalModifiers[groupName] || [];

                                    return (
                                        <div key={groupName} className="border border-white/10 rounded-lg p-3">
                                            <div className="text-xs font-semibold text-white/70 mb-2">
                                                {groupName}
                                                {maxSelection === 1
                                                    ? ' (elige una opción)'
                                                    : maxSelection > 0
                                                    ? ` (hasta ${maxSelection})`
                                                    : ''}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {options.map((mod) => {
                                                    const id = mod.id;
                                                    const isSelected = selectedIds.includes(id);
                                                    const { label, color } = parseModifierColorFromName(mod.name);
                                                    const extraPrice = Number(mod.price_adjustment_usdt || 0);

                                                    return (
                                                        <button
                                                            key={id}
                                                            type="button"
                                                            onClick={() => {
                                                                setProductModalModifiers((prev) => {
                                                                    const current = Array.isArray(prev[groupName]) ? prev[groupName] : [];

                                                                    // Selección única
                                                                    if (maxSelection === 1) {
                                                                        return {
                                                                            ...prev,
                                                                            [groupName]: [id]
                                                                        };
                                                                    }

                                                                    // Selección múltiple
                                                                    let next;
                                                                    if (current.includes(id)) {
                                                                        next = current.filter((mId) => mId !== id);
                                                                    } else {
                                                                        next = [...current, id];
                                                                        if (maxSelection > 0 && next.length > maxSelection) {
                                                                            toast.error(`Máximo ${maxSelection} opciones para ${groupName}`);
                                                                            return prev;
                                                                        }
                                                                    }

                                                                    return {
                                                                        ...prev,
                                                                        [groupName]: next
                                                                    };
                                                                });

                                                                // Opción B: cada click en un color agrega 1 unidad de ese color al carrito
                                                                if (color && maxSelection === 1) {
                                                                    const allMods = Array.isArray(selectedProduct.modifiers)
                                                                        ? selectedProduct.modifiers
                                                                        : [];
                                                                    const selectedModifier = allMods.find((m) => m && m.id === id);
                                                                    if (selectedModifier) {
                                                                        addToCart(selectedProduct, 1, [selectedModifier]);
                                                                    }
                                                                }
                                                            }}
                                                            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                                                                isSelected
                                                                    ? 'bg-accent text-dark border-accent'
                                                                    : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-1">
                                                                {color && (
                                                                    <span
                                                                        className="w-3 h-3 rounded-full border border-white/40"
                                                                        style={{ backgroundColor: color }}
                                                                    />
                                                                )}
                                                                <span>{label}</span>
                                                                {extraPrice > 0 && (
                                                                    <span className="ml-1 text-[10px] opacity-80">(+${extraPrice})</span>
                                                                )}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setProductModalQuantity((prev) => Math.max(1, prev - 1))}
                                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
                                >
                                    <Minus size={16} />
                                </button>
                                <span className="text-lg font-semibold text-white">{productModalQuantity}</span>
                                <button
                                    type="button"
                                    onClick={() => setProductModalQuantity((prev) => prev + 1)}
                                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                            <div className="text-right">
                                {(() => {
                                    const unitUsdt = getSelectedProductUnitPriceUSDT();
                                    const unitBs = unitUsdt * rates.bs;
                                    const totalBs = unitBs * productModalQuantity;
                                    const totalUsdt = unitUsdt * productModalQuantity;

                                    return (
                                        <>
                                            <div className="text-sm font-bold text-accent">
                                                {totalBs.toLocaleString('es-VE', {
                                                    style: 'currency',
                                                    currency: 'VES'
                                                })}
                                            </div>
                                            <div className="text-[11px] text-white/60">
                                                ≈ {totalUsdt.toFixed(2)} USDT ({unitUsdt.toFixed(2)} USDT c/u)
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                const mods = Array.isArray(selectedProduct.modifiers) ? selectedProduct.modifiers : [];
                                const selectedGroups = Object.values(productModalModifiers || {});
                                const selectedIds = new Set(
                                    selectedGroups.flat().filter((id) => id != null)
                                );
                                const selectedModifiers = mods.filter((mod) => selectedIds.has(mod.id));

                                addToCart(selectedProduct, productModalQuantity, selectedModifiers);
                                setSelectedProduct(null);
                            }}
                            className="w-full py-3 rounded-lg bg-accent text-dark font-semibold text-sm flex items-center justify-center gap-2 mt-2"
                        >
                            <ShoppingBag size={18} />
                            <span>Agregar al carrito</span>
                        </button>
                    </div>
                </div>
            )}
            {guestInfoModalOpen && !user && (
                <div className="fixed inset-0 z-[1102] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-dark border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-white">
                                {guestAuthMode === 'guest' ? 'Completa tus datos' : 'Ingresar con mi cuenta'}
                            </h2>
                            <button
                                onClick={() => setGuestInfoModalOpen(false)}
                                className="text-white/60 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {guestAuthMode === 'guest' && (
                            <>
                                <p className="text-xs text-white/60 mb-4">
                                    Puedes completar tu pedido como invitado. Solo necesitamos tus datos de contacto para que la tienda pueda confirmarlo.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                    <div>
                                        <label className="block text-[11px] text-white/60 mb-1">Nombre</label>
                                        <input
                                            type="text"
                                            className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                            value={guestName}
                                            onChange={(e) => setGuestName(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-white/60 mb-1">Teléfono / contacto</label>
                                        <input
                                            type="text"
                                            className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                            value={guestPhone}
                                            onChange={(e) => setGuestPhone(e.target.value)}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-[11px] text-white/60 mb-1">Correo (opcional)</label>
                                        <input
                                            type="email"
                                            className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                            value={guestEmail}
                                            onChange={(e) => setGuestEmail(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-white/10 pt-3 mb-4 space-y-2">
                                    <label className="flex items-center gap-2 text-xs text-white/70">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4"
                                            checked={guestWantsDelivery}
                                            onChange={(e) => setGuestWantsDelivery(e.target.checked)}
                                        />
                                        <span>Quiero delivery para este pedido</span>
                                    </label>

                                    <label className="flex items-center gap-2 text-xs text-white/70">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4"
                                            checked={isScheduledOrder}
                                            onChange={(e) => {
                                                setIsScheduledOrder(e.target.checked);
                                                if (!e.target.checked) {
                                                    setScheduledDateTime('');
                                                }
                                            }}
                                        />
                                        <span>Quiero programar este pedido para otra fecha y hora</span>
                                    </label>

                                    {isScheduledOrder && (
                                        <div>
                                            <label className="block text-[11px] text-white/60 mb-1">
                                                Fecha y hora del pedido
                                            </label>
                                            <input
                                                type="datetime-local"
                                                className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                                value={scheduledDateTime}
                                                onChange={(e) => setScheduledDateTime(e.target.value)}
                                                min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)} // Mínimo 1 hora en el futuro
                                            />
                                            <div className="text-[10px] text-white/50 mt-1">
                                                Programa tu pedido con al menos 1 hora de anticipación
                                            </div>
                                        </div>
                                    )}

                                    {guestWantsDelivery && (
                                        <div>
                                            <label className="block text-[11px] text-white/60 mb-1">
                                                Dirección o link de ubicación
                                            </label>
                                            <textarea
                                                rows={3}
                                                className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                                                placeholder="Escribe tu dirección, referencia o pega un link de Google Maps / WhatsApp"
                                                value={deliveryLocation}
                                                onChange={(e) => setDeliveryLocation(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={handleUseCurrentLocation}
                                                className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[11px]"
                                            >
                                                <MapPin size={12} />
                                                Usar mi ubicación actual
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-between items-center text-[11px] text-white/50 mb-4">
                                    <button
                                        type="button"
                                        onClick={() => setGuestAuthMode('login')}
                                        className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs"
                                    >
                                        Ingresar con mi cuenta
                                    </button>
                                    <span>o continúa como invitado completando los campos.</span>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setGuestInfoModalOpen(false)}
                                        className="flex-1 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-sm"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleGuestConfirm}
                                        className="flex-1 py-3 rounded-lg bg-accent text-dark font-semibold text-sm flex items-center justify-center gap-2"
                                    >
                                        Continuar y enviar pedido
                                    </button>
                                </div>
                            </>
                        )}

                        {guestAuthMode === 'login' && (
                            <>
                                <p className="text-xs text-white/60 mb-4">
                                    Inicia sesión para continuar con tu pedido sin perder el carrito.
                                </p>

                                <div className="space-y-3 mb-4">
                                    <div>
                                        <label className="block text-[11px] text-white/60 mb-1">Usuario, email o CI</label>
                                        <input
                                            type="text"
                                            className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                            value={loginUsername}
                                            onChange={(e) => setLoginUsername(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-white/60 mb-1">Contraseña</label>
                                        <input
                                            type="password"
                                            className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                            value={loginPassword}
                                            onChange={(e) => setLoginPassword(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleInlineLogin}
                                        disabled={authLoading}
                                        className="w-full py-2.5 rounded-lg bg-accent text-dark font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {authLoading ? 'Iniciando...' : 'Iniciar sesión y continuar pedido'}
                                    </button>
                                </div>

                                <div className="flex justify-between items-center text-[11px] text-white/50 mb-4">
                                    <button
                                        type="button"
                                        onClick={() => setGuestAuthMode('guest')}
                                        className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs"
                                    >
                                        Volver a invitado
                                    </button>
                                    <span>o usa tus datos para continuar.</span>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setGuestInfoModalOpen(false)}
                                        className="flex-1 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-sm"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            {paymentModalOpen && (
                <div className="fixed inset-0 z-[1101] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-dark border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <CreditCard size={20} />
                                Confirmar pago
                            </h2>
                            <button
                                onClick={() => setPaymentModalOpen(false)}
                                className="text-white/60 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-2 mb-4 text-sm">
                            <div className="flex justify-between">
                                <span className="text-white/60">Total a pagar</span>
                                <span className="font-bold">${cartTotalUSDT.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-white/60">
                                <span>
                                    ≈ {totalBs.toLocaleString('es-VE', {
                                        style: 'currency',
                                        currency: 'VES'
                                    })}
                                </span>
                                <span>≈ {totalFires.toFixed(0)} 🔥</span>
                            </div>
                            {hasDeliveryLocation && (
                                <div className="mt-2 text-xs text-white/70">
                                    <div className="flex justify-between">
                                        <span>Entrega</span>
                                        <span>Delivery</span>
                                    </div>
                                    <div className="mt-1 max-h-16 overflow-y-auto text-[11px] text-white/60 whitespace-pre-wrap">
                                        {deliveryLocation}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3 mb-4">
                            {paymentLines.map((line, index) => {
                                const methodConfig =
                                    paymentMethodOptions.find((opt) => opt.id === line.method) ||
                                    paymentMethodOptions[0];

                                if (!methodConfig) return null;

                                const field = methodConfig.field;
                                const amountValue = payments[field] ?? '';
                                const isBs = field === 'bs_cash' || field === 'bs_transfer';
                                const isUsdt = field === 'cash_usdt' || field === 'usdt_tron';
                                const isFires = field === 'fires';

                                const availableMethods = paymentMethodOptions.filter((opt) => {
                                    if (opt.id === line.method) return true;
                                    return !paymentLines.some((l) => l.id !== line.id && l.method === opt.id);
                                });

                                return (
                                    <div
                                        key={line.id}
                                        className="border border-white/10 rounded-lg p-3 space-y-2 bg-white/5/10"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex-1">
                                                <label className="block text-[11px] text-white/60 mb-1">
                                                    Método de pago
                                                </label>
                                                <select
                                                    value={line.method}
                                                    onChange={(e) => {
                                                        const newMethod = e.target.value;
                                                        setPaymentLines((prev) =>
                                                            prev.map((l) =>
                                                                l.id === line.id ? { ...l, method: newMethod } : l
                                                            )
                                                        );
                                                    }}
                                                    className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                                >
                                                    {availableMethods.map((opt) => (
                                                        <option key={opt.id} value={opt.id}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            {paymentLines.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPaymentLines((prev) =>
                                                            prev.filter((l) => l.id !== line.id)
                                                        );
                                                    }}
                                                    className="text-white/40 hover:text-white text-xs px-2 py-1 rounded-full border border-white/10"
                                                >
                                                    Quitar
                                                </button>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-[11px] text-white/60 mb-1">
                                                Monto {isUsdt ? 'en USDT' : isBs ? 'en Bs' : isFires ? 'en Fuegos' : ''}
                                            </label>
                                            <div className="relative">
                                                {isBs && (
                                                    <span className="absolute left-3 top-2.5 text-white/60 text-xs">
                                                        Bs
                                                    </span>
                                                )}
                                                {isUsdt && (
                                                    <span className="absolute left-3 top-2.5 text-white/60 text-xs">
                                                        $
                                                    </span>
                                                )}
                                                {isFires && (
                                                    <Flame
                                                        className="absolute left-3 top-2.5 text-fire-orange"
                                                        size={16}
                                                    />
                                                )}
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={isFires ? (maxFiresTokens || undefined) : undefined}
                                                    disabled={isFires && !canUseFires}
                                                    className={`w-full bg-white/5 rounded-lg ${
                                                        isBs || isUsdt || isFires ? 'pl-9' : 'pl-3'
                                                    } pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40 disabled:cursor-not-allowed`}
                                                    value={amountValue}
                                                    onChange={(e) => {
                                                        const raw = e.target.value;
                                                        if (isFires) {
                                                            const n = parseAmount(raw);
                                                            if (!canUseFires || maxFiresTokens <= 0) {
                                                                setPayments((prev) => ({
                                                                    ...prev,
                                                                    [field]: 0
                                                                }));
                                                                return;
                                                            }
                                                            const clamped = Math.max(0, Math.min(n, maxFiresTokens));
                                                            setPayments((prev) => ({
                                                                ...prev,
                                                                [field]: String(clamped)
                                                            }));
                                                        } else {
                                                            setPayments((prev) => ({
                                                                ...prev,
                                                                [field]: raw
                                                            }));
                                                        }
                                                    }}
                                                />
                                            </div>

                                            {field === 'bs_cash' && (
                                                <div className="space-y-1 mt-2">
                                                    <label className="block text-[11px] text-white/60">
                                                        Comprobante de efectivo (foto, opcional)
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={handleCashProofChange}
                                                            className="text-[11px] text-white/70"
                                                        />
                                                        <CameraButton
                                                            onPhotoTaken={(file) => {
                                                                handleCashProofChange({ target: { files: [file] } });
                                                            }}
                                                            size="sm"
                                                            className="rounded-full"
                                                        />
                                                        {cashProofName && (
                                                            <span className="text-[10px] text-emerald-400 truncate max-w-[140px]">
                                                                {cashProofName}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {field === 'bs_transfer' && (
                                                <div className="mt-2 space-y-1">
                                                    <label className="block text-[11px] text-white/60 mb-1">
                                                        Referencia bancaria (opcional)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                                        value={transferReference}
                                                        onChange={(e) => setTransferReference(e.target.value)}
                                                    />
                                                    <div className="text-[11px] text-white/40 mt-1">
                                                        Tasa referencial: 1 USDT ≈ {rates.bs.toFixed(2)} Bs
                                                    </div>
                                                </div>
                                            )}

                                            {field === 'usdt_tron' && (
                                                <div className="mt-2 space-y-1">
                                                    <label className="block text-[11px] text-white/60 mb-1">
                                                        Hash de transacción TRON (opcional)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                                        value={usdtTronHash}
                                                        onChange={(e) => setUsdtTronHash(e.target.value)}
                                                        placeholder="TXID..."
                                                    />
                                                </div>
                                            )}

                                            {field === 'fires' && (
                                                <div className="text-[11px] text-white/40 mt-1">
                                                    1 USDT ≈ {rates.fires.toFixed(0)} 🔥
                                                </div>
                                            )}

                                            {methodConfig.instructions && (
                                                <div className="mt-2 text-[11px] text-white/60 whitespace-pre-wrap border border-dashed border-white/15 rounded-md px-3 py-2 bg-white/5">
                                                    {methodConfig.instructions}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {paymentLines.length < paymentMethodOptions.length && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const used = new Set(paymentLines.map((l) => l.method));
                                        const nextMethod = paymentMethodOptions.find(
                                            (opt) => !used.has(opt.id)
                                        );
                                        if (!nextMethod) return;
                                        setPaymentLines((prev) => [
                                            ...prev,
                                            { id: nextPaymentLineId, method: nextMethod.id }
                                        ]);
                                        setNextPaymentLineId((id) => id + 1);
                                    }}
                                    className="w-full text-xs px-3 py-2 rounded-lg border border-dashed border-white/20 text-white/70 hover:border-white/40 hover:text-white flex items-center justify-center gap-2"
                                >
                                    <Plus size={14} />
                                    Agregar otro método de pago
                                </button>
                            )}
                        </div>

                        <div className="bg-white/5 rounded-lg p-3 mb-4 text-xs space-y-1">
                            <div className="flex justify-between">
                                <span className="text-white/60">Pagado</span>
                                <span className="font-semibold">${totalPaidUSDT.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/60">Falta por pagar</span>
                                <span className={remainingUSDT > 0 ? 'text-orange-400 font-semibold' : 'text-white/60'}>
                                    ${remainingUSDT.toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/60">Cambio estimado</span>
                                <span className={changeUSDT > 0 ? 'text-emerald-400 font-semibold' : 'text-white/60'}>
                                    ${changeUSDT.toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mb-4 text-xs">
                            <input
                                id="give-change-fires"
                                type="checkbox"
                                className="w-4 h-4"
                                checked={giveChangeInFires}
                                onChange={(e) => setGiveChangeInFires(e.target.checked)}
                                disabled={changeUSDT <= 0 || !user}
                            />
                            <label htmlFor="give-change-fires" className="flex-1 text-white/70 flex items-center gap-1">
                                <Flame size={14} className="text-fire-orange" />
                                Convertir el cambio ({changeFires.toFixed(0)} 🔥) en Fuegos para mi billetera
                            </label>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setPaymentModalOpen(false)}
                                className="flex-1 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmClick}
                                disabled={!isPaid || createOrderMutation.isLoading}
                                className="flex-1 py-3 rounded-lg bg-accent text-dark font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {createOrderMutation.isLoading ? 'Enviando...' : 'Confirmar pedido'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Product Share Modal */}
        {showProductShareModal && productToShare && (
            <ProductShareModal
                isOpen={showProductShareModal}
                onClose={() => {
                    setShowProductShareModal(false);
                    setProductToShare(null);
                }}
                product={productToShare}
            />
        )}
        </>
    );
};

export default StoreFront;
