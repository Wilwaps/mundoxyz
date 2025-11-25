import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Plus, Minus, X, ChevronRight, Star, Clock, CreditCard, Banknote, Flame, Share2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import './StoreFront.css'; // Custom styles

const StoreFront = () => {
    const { slug } = useParams(); // e.g., 'divorare04'
    const navigate = useNavigate();
    const { user } = useAuth();
    const [cart, setCart] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showCart, setShowCart] = useState(false);
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null); // For modal
    const [productModalQuantity, setProductModalQuantity] = useState(1);
    const [productModalModifiers, setProductModalModifiers] = useState({});

    const initialPayments = {
        cash_usdt: 0,
        zelle: 0,
        bs: 0,
        fires: 0
    };
    const [payments, setPayments] = useState(initialPayments);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [giveChangeInFires, setGiveChangeInFires] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [cashProofBase64, setCashProofBase64] = useState('');
    const [cashProofName, setCashProofName] = useState('');
    const [transferReference, setTransferReference] = useState('');

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

    const vesPerUsdt = fiatContext?.operationalRate?.rate;
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

    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result);
                } else {
                    reject(new Error('No se pudo leer el archivo'));
                }
            };
            reader.onerror = () => reject(reader.error || new Error('Error leyendo archivo'));
            reader.readAsDataURL(file);
        });
    };

    const addToCart = (product, quantity = 1, modifiers = []) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item => {
                    if (item.product.id !== product.id) return item;

                    const existingModifiers = Array.isArray(item.modifiers) ? item.modifiers : [];
                    const newModifiers = Array.isArray(modifiers) ? modifiers : [];

                    // Si vienen modificadores nuevos, los reemplazamos; si no, mantenemos los existentes
                    const finalModifiers = newModifiers.length > 0 ? newModifiers : existingModifiers;

                    return {
                        ...item,
                        quantity: item.quantity + quantity,
                        modifiers: finalModifiers
                    };
                });
            }
            return [...prev, { product, quantity, modifiers }];
        });
        toast.success('Agregado al carrito');
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    };

    const updateQuantity = (productId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.product.id === productId) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0));
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

    const cartTotalUSDT = cart.reduce((sum, item) => sum + getItemUnitPriceUSDT(item) * item.quantity, 0);

    const cashUsdt = parseAmount(payments.cash_usdt);
    const zelleUsdt = parseAmount(payments.zelle);
    const bsAmount = parseAmount(payments.bs);
    const firesAmount = parseAmount(payments.fires);

    const totalPaidUSDT =
        cashUsdt +
        zelleUsdt +
        (bsAmount / rates.bs) +
        (firesAmount / rates.fires);

    const remainingUSDT = Math.max(0, cartTotalUSDT - totalPaidUSDT);
    const changeUSDT = Math.max(0, totalPaidUSDT - cartTotalUSDT);

    const isPaid = totalPaidUSDT >= cartTotalUSDT - 0.01;

    const totalBs = cartTotalUSDT * rates.bs;
    const totalFires = cartTotalUSDT * rates.fires;
    const changeFires = changeUSDT * rates.fires;

    const createOrderMutation = useMutation({
        mutationFn: async (orderData) => {
            const response = await axios.post('/api/store/order/create', orderData);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Pedido creado exitosamente');
            setCart([]);
            setShowCart(false);
            setPaymentModalOpen(false);
            setPayments(initialPayments);
            setGiveChangeInFires(false);
        },
        onError: (error) => {
            const message = error?.response?.data?.error || 'Error al crear pedido';
            toast.error(message);
        }
    });

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

        const guestInfo = !user
            ? {
                name: guestName.trim() || null,
                phone: guestPhone.trim() || null,
                email: guestEmail.trim() || null
            }
            : null;

        const paymentMeta = {
            proof_cash_bill_image_base64: cashProofBase64 || null,
            transfer_reference: transferReference.trim() || null
        };

        const orderData = {
            store_id: storeData.store.id,
            items: cart.map((item) => ({
                product_id: item.product.id,
                quantity: item.quantity,
                modifiers: item.modifiers || []
            })),
            type: 'pickup',
            payment_method: {
                source: 'storefront',
                cash_usdt: cashUsdt,
                zelle: zelleUsdt,
                bs: bsAmount,
                fires: firesAmount,
                meta: paymentMeta
            },
            currency_snapshot: rates,
            customer_id: user?.id || null,
            delivery_info: guestInfo ? { guest: guestInfo } : null,
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

    if (isLoading) return <div className="flex justify-center p-20"><div className="spinner"></div></div>;
    if (!storeData) return <div className="text-center p-20">Tienda no encontrada</div>;

    const { store, categories, products } = storeData;

    const storeSettings = store?.settings && typeof store.settings === 'object'
        ? store.settings
        : {};
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
        if (!slugValue) return;

        const shareUrl = `${window.location.origin}/store/${slugValue}`;
        const shareText = `Mira la tienda "${store?.name || 'MundoXYZ'}" en MundoXYZ`;

        try {
            switch (platform) {
                case 'whatsapp': {
                    const url = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
                    window.open(url, '_blank');
                    break;
                }
                case 'telegram': {
                    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
                    window.open(url, '_blank');
                    break;
                }
                case 'copy': {
                    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                        await navigator.clipboard.writeText(shareUrl);
                        toast.success('Enlace copiado al portapapeles');
                    } else {
                        window.prompt('Copia este link de la tienda:', shareUrl);
                    }
                    break;
                }
                default:
                    break;
            }
        } catch (error) {
            console.error('Error al compartir tienda:', error);
            toast.error('No se pudo compartir la tienda');
        } finally {
            setShowShareMenu(false);
        }
    };
    const activeCategory = selectedCategory || categories[0]?.id;
    const filteredProducts = products.filter(p => p.category_id === activeCategory);

    return (
        <div className="store-front min-h-screen bg-dark pb-24">
            {/* Hero Section */}
            <div className={`relative ${heroHeightClass} overflow-hidden`}>
                <div className="absolute inset-0 bg-gradient-to-t from-dark via-transparent to-transparent z-10"></div>
                <img
                    src={store.cover_url || 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=1974&auto=format&fit=crop'}
                    alt="Cover"
                    className="w-full h-full object-cover"
                />
                <div className="absolute top-4 right-4 z-30">
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
                                    className="absolute right-0 mt-2 w-48 max-w-[calc(100vw-3rem)] bg-black/80 backdrop-blur-md rounded-lg shadow-xl border border-white/10 z-50"
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
                                                    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
                                                } else if (locationAddress) {
                                                    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationAddress)}`;
                                                    window.open(url, '_blank', 'noopener,noreferrer');
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

                            {!user && (
                                <div className="mb-4 text-xs bg-white/5 rounded-lg p-3 space-y-2">
                                    <div className="font-semibold text-white/80">Compra sin registrarte</div>
                                    <p className="text-white/60">
                                        Puedes completar tu pedido como invitado. Solo necesitamos tus datos de contacto para que la tienda pueda confirmarlo.
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                                    <div className="text-[11px] text-white/50 flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => navigate('/login')}
                                            className="px-2 py-1 rounded-full bg-white/10 hover:bg-white/20"
                                        >
                                            Ingresar con mi cuenta
                                        </button>
                                        <span>o continúa como invitado completando los campos.</span>
                                    </div>
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
                        const cartItem = cart.find((item) => item.product.id === product.id);
                        const quantityInCart = cartItem ? cartItem.quantity : 0;
                        const hasModifiers = Array.isArray(product.modifiers) && product.modifiers.length > 0;

                        return (
                            <motion.div
                                key={product.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-glass rounded-xl overflow-hidden border border-white/5 hover:border-accent/30 transition-all group cursor-pointer"
                                onClick={() => {
                                    setSelectedProduct(product);
                                    setProductModalQuantity(1);
                                    setProductModalModifiers({});
                                }}
                            >
                                <div className="relative h-48 overflow-hidden">
                                    <img
                                        src={product.image_url || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=1000&auto=format&fit=crop'}
                                        alt={product.name}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                    {quantityInCart === 0 ? (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (hasModifiers) {
                                                    setSelectedProduct(product);
                                                    setProductModalQuantity(1);
                                                    setProductModalModifiers({});
                                                } else {
                                                    addToCart(product);
                                                }
                                            }}
                                            className="absolute bottom-3 right-3 w-10 h-10 bg-accent text-dark rounded-full flex items-center justify-center shadow-lg transform translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    ) : (
                                        <div className="absolute bottom-3 right-3 flex items-center bg-dark/80 rounded-full shadow-lg overflow-hidden transform translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateQuantity(product.id, -1);
                                                }}
                                                className="w-8 h-8 flex items-center justify-center text-white/80 hover:bg-white/10"
                                            >
                                                <Minus size={16} />
                                            </button>
                                            <span className="px-3 text-sm font-semibold text-white">{quantityInCart}</span>
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
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-lg text-white">{product.name}</h3>
                                        <span className="font-bold text-accent">${product.price_usdt}</span>
                                    </div>
                                    <p className="text-sm text-white/60 line-clamp-2 mb-4">{product.description}</p>
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
                        className="fixed bottom-6 inset-x-0 px-4 z-40 pointer-events-none"
                    >
                        <div className="container mx-auto max-w-lg pointer-events-auto">
                            <button
                                onClick={() => setShowCart(true)}
                                className="w-full bg-accent text-dark p-4 rounded-xl shadow-2xl flex justify-between items-center font-bold"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-dark/20 w-8 h-8 rounded-full flex items-center justify-center text-sm">
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
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                            onClick={() => setShowCart(false)}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            className="fixed inset-y-0 right-0 w-full max-w-md bg-dark border-l border-white/10 z-50 flex flex-col"
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
                                            src={item.product.image_url}
                                            className="w-16 h-16 rounded-lg object-cover bg-white/5"
                                        />
                                        <div className="flex-1">
                                            <div className="flex justify-between mb-1">
                                                <h4 className="font-medium">{item.product.name}</h4>
                                                <span className="text-white/80">${(getItemUnitPriceUSDT(item) * item.quantity).toFixed(2)}</span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-2">
                                                <button
                                                    onClick={() => updateQuantity(item.product.id, -1)}
                                                    className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <span className="text-sm">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.product.id, 1)}
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
                                    <div className="flex justify-between text-white/60">
                                        <span>Delivery</span>
                                        <span>$0.00</span>
                                    </div>
                                    <div className="flex justify-between text-xl font-bold text-accent pt-2 border-t border-white/10">
                                        <span>Total</span>
                                        <span>${cartTotalUSDT.toFixed(2)}</span>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
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
                                                    const label = mod.name;
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
                                                            }}
                                                            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                                                                isSelected
                                                                    ? 'bg-accent text-dark border-accent'
                                                                    : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
                                                            }`}
                                                        >
                                                            <span>{label}</span>
                                                            {extraPrice > 0 && (
                                                                <span className="ml-1 text-[10px] opacity-80">(+${extraPrice})</span>
                                                            )}
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
                            <span className="text-xl font-bold text-accent">${selectedProduct.price_usdt}</span>
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
            {paymentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
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
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs text-white/60 mb-1">Efectivo (USDT)</label>
                                <div className="relative">
                                    <Banknote className="absolute left-3 top-2.5 text-green-400" size={18} />
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full bg-white/5 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                                        value={payments.cash_usdt}
                                        onChange={(e) => setPayments({ ...payments, cash_usdt: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-white/60 mb-1">Zelle / Transf. (USDT)</label>
                                <div className="relative">
                                    <CreditCard className="absolute left-3 top-2.5 text-accent" size={18} />
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full bg-white/5 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                                        value={payments.zelle}
                                        onChange={(e) => setPayments({ ...payments, zelle: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-white/60 mb-1">Pago en Bs</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-white/60 text-xs">Bs</span>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full bg-white/5 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                                        value={payments.bs}
                                        onChange={(e) => setPayments({ ...payments, bs: e.target.value })}
                                    />
                                </div>
                                <div className="text-[11px] text-white/40 mt-1">
                                    Tasa referencial: 1 USDT ≈ {rates.bs.toFixed(2)} Bs
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-white/60 mb-1">Pago con Fuegos</label>
                                <div className="relative">
                                    <Flame className="absolute left-3 top-2.5 text-fire-orange" size={18} />
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full bg-white/5 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                                        value={payments.fires}
                                        onChange={(e) => setPayments({ ...payments, fires: e.target.value })}
                                    />
                                </div>
                                <div className="text-[11px] text-white/40 mt-1">
                                    1 USDT ≈ {rates.fires.toFixed(0)} 🔥
                                </div>
                            </div>
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
                                onClick={handleCheckout}
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
    );
};

export default StoreFront;
