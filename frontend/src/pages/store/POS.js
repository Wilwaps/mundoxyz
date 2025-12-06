import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Search, CreditCard, Banknote, Flame, RefreshCw, User, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import CameraButton from '../../components/CameraButton';
import { useSocket } from '../../contexts/SocketContext';
import useDisableRaffleQueries from '../../hooks/useDisableRaffleQueries';
import usePublicStore from '../../hooks/usePublicStore';

const POS = () => {
    useDisableRaffleQueries();
    const { slug } = useParams(); // 'divorare04'
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [cart, setCart] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [openCashModalOpen, setOpenCashModalOpen] = useState(false);
    const [openCashForm, setOpenCashForm] = useState({
        usdt: '',
        bs: '',
        fires: '',
        tron: ''
    });
    const [cashCloseSummary, setCashCloseSummary] = useState(null);

    // Payment State (strings vacíos para evitar ceros iniciales en los inputs)
    const initialPayments = {
        cash_usdt: '',
        usdt_tron: '',
        bs: '',
        bs_cash: '',
        fires: ''
    };
    const [payments, setPayments] = useState(initialPayments);
    const [usdtTronHash, setUsdtTronHash] = useState('');
    const [cashProofBase64, setCashProofBase64] = useState('');
    const [cashProofName, setCashProofName] = useState('');

    // Cliente POS (simple CRM local)
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [, setRecentCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false);
    const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
    const [invoiceModal, setInvoiceModal] = useState(null);
    const [isInvoiceHistoryOpen, setIsInvoiceHistoryOpen] = useState(false);
    const [giveChangeInFires, setGiveChangeInFires] = useState(false);

    const [draftInvoices, setDraftInvoices] = useState([]);
    const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
    const [isCustomerSearchFocused, setIsCustomerSearchFocused] = useState(false);

    const [currentTable, setCurrentTable] = useState(null); // Mesa actualmente cargada en el carrito (si aplica)
    const [tableTabs, setTableTabs] = useState({}); // { 'Mesa 1': { total_usdt, version, cart?: [...] } }
    const [activeTableVersion, setActiveTableVersion] = useState(null); // Versión de la mesa actualmente cargada
    const [activeTableCartSnapshot, setActiveTableCartSnapshot] = useState(null); // Snapshot del carrito guardado para detectar cambios

    const draftsStorageKey = slug ? `pos_drafts_${slug}` : 'pos_drafts_default';

    // Socket para eventos en tiempo real (orden pagada vía QR, etc.)
    const { socket } = useSocket();

    // Estado local para mostrar que una orden está pendiente de pago por QR
    const [qrPaymentOrder, setQrPaymentOrder] = useState(null); // { orderId, fires, storeId }
    const [hasNewActiveOrder, setHasNewActiveOrder] = useState(false);

    // Fetch Store & Products (reutiliza cache pública por slug)
    const { data: storeData } = usePublicStore(slug);

    // Fetch FIAT context for dynamic rates (USDT -> Bs, USDT -> Fires)
    const { data: fiatContext } = useQuery({
        queryKey: ['fiat-context'],
        queryFn: async () => {
            const response = await axios.get('/api/economy/fiat-context');
            return response.data;
        }
    });

    // Preferir siempre la tasa oficial del BCV para USD/VES en el POS
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
        bs: bsRate, // 1 USDT = bsRate Bs (BCV prioritario)
        fires: firesRate // 1 USDT = firesRate Fires
    };

    const storeSettingsRaw =
        storeData?.store && typeof storeData.store.settings === 'object'
            ? storeData.store.settings
            : {};
    const storeId = storeData?.store?.id;
    const rawTablesCount =
        storeSettingsRaw.tables_count ?? storeSettingsRaw.tablesCount ?? 0;
    let tablesCount = parseInt(rawTablesCount, 10);
    if (!Number.isFinite(tablesCount) || tablesCount < 0) {
        tablesCount = 0;
    }
    const isRestaurantMode = tablesCount > 0;
    const effectiveTable = currentTable || (isRestaurantMode ? 'Mesa 1' : 'POS-1');

    // Estado de caja para POS (usa los mismos endpoints que el panel de tienda)
    const {
        data: cashStatusData,
        isLoading: loadingCashStatus
    } = useQuery({
        queryKey: ['store-cash-status', storeId],
        queryFn: async () => {
            if (!storeId) return null;
            const response = await axios.get(`/api/store/${storeId}/cash/status`);
            return response.data?.session || null;
        },
        enabled: !!storeId
    });

    const cashSession = cashStatusData;

    const cashCloseSession = cashCloseSummary?.session || null;
    const cashCloseStats = cashCloseSummary?.summary || null;
    const openingBalance = cashCloseSession?.opening_balance || {};
    const closingTotals = cashCloseSession?.closing_totals || {};

    const openCashMutation = useMutation({
        mutationFn: async (values) => {
            if (!storeId) return null;

            const normalize = (value) => {
                const n = typeof value === 'number'
                    ? value
                    : parseFloat(String(value ?? '').replace(',', '.'));
                return Number.isFinite(n) && n >= 0 ? n : 0;
            };

            const opening_balance = {
                usdt: normalize(values?.usdt),
                bs: normalize(values?.bs),
                fires: normalize(values?.fires),
                tron: normalize(values?.tron)
            };

            const payload = { opening_balance };
            const response = await axios.post(`/api/store/${storeId}/cash/open`, payload);
            return response.data;
        },
        onSuccess: (data) => {
            toast.success('Caja abierta');
            const session = data?.session || null;
            queryClient.setQueryData(['store-cash-status', storeId], session);
            queryClient.invalidateQueries(['store-cash-status', storeId]);
            setOpenCashModalOpen(false);
            setOpenCashForm({ usdt: '', bs: '', fires: '', tron: '' });
        },
        onError: (error) => {
            const message = error?.response?.data?.error || 'No se pudo abrir la caja';
            toast.error(message);
        }
    });

    const closeCashMutation = useMutation({
        mutationFn: async () => {
            if (!storeId) return null;
            const response = await axios.post(`/api/store/${storeId}/cash/close`, {});
            return response.data;
        },
        onSuccess: (data) => {
            toast.success('Caja cerrada');
            queryClient.setQueryData(['store-cash-status', storeId], null);
            queryClient.invalidateQueries(['store-cash-status', storeId]);
            setCashCloseSummary(data || null);
        },
        onError: (error) => {
            const message = error?.response?.data?.error || 'No se pudo cerrar la caja';
            toast.error(message);
        }
    });

    // Normaliza montos de entrada (strings, vacío, etc.) a números >= 0
    const parseAmount = (value) => {
        const n = typeof value === 'number'
            ? value
            : parseFloat(String(value ?? '').replace(',', '.'));
        return Number.isFinite(n) && n >= 0 ? n : 0;
    };

    const createOrderMutation = useMutation({
        mutationFn: async (orderData) => {
            return axios.post('/api/store/order/create', orderData);
        },
        onSuccess: (response) => {
            const createdOrder = response?.data?.order || response?.data;

            // Si estamos en modo restaurante, limpiar también la cuenta de la mesa en backend
            if (isRestaurantMode && currentTable) {
                void saveTableTab(currentTable, { clearAfterSave: true });
            }

            toast.success('Orden creada exitosamente');
            setCart([]);
            setPaymentModalOpen(false);
            setPayments(initialPayments);
            setUsdtTronHash('');
            setCashProofBase64('');
            setCashProofName('');

            // Guardar cliente en recientes (solo si tiene algún dato)
            setRecentCustomers((prev) => {
                const name = customerName.trim();
                const phone = customerPhone.trim();

                if (!name && !phone) return prev;

                const existingIndex = prev.findIndex(
                    (c) => c.name === name && c.phone === phone
                );

                let next = prev;
                if (existingIndex !== -1) {
                    const existing = prev[existingIndex];
                    next = [existing, ...prev.filter((_, idx) => idx !== existingIndex)];
                } else {
                    const entry = { name, phone };
                    next = [entry, ...prev].slice(0, 20);
                }

                try {
                    localStorage.setItem('pos_recent_customers', JSON.stringify(next));
                } catch {
                    // ignore
                }

                return next;
            });

            setCustomerName('');
            setCustomerPhone('');
            setCustomerSearch('');
            setGiveChangeInFires(false);

            if (createdOrder?.store_id && createdOrder?.invoice_number != null) {
                setInvoiceModal({
                    storeId: createdOrder.store_id,
                    invoiceNumber: createdOrder.invoice_number
                });
            }
        },
        onError: (err) => {
            console.error('Error al crear orden POS:', err);
            const message = err?.response?.data?.error || 'Error al crear orden';
            toast.error(message);
        }
    });

    const [allowFiresPayments, setAllowFiresPayments] = useState(false);

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(p => p.id === product.id);
            if (existing) {
                return prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const changeItemQuantity = (productId, delta) => {
        setCart(prev => {
            return prev
                .map(item => {
                    if (item.id !== productId) return item;
                    const current = Number(item.quantity) || 0;
                    const next = Math.max(0, current + delta);
                    return { ...item, quantity: next };
                })
                .filter(item => (Number(item.quantity) || 0) > 0);
        });
    };

    const setItemQuantityDirect = (productId, value) => {
        setCart(prev => {
            const parsed = parseInt(value, 10);
            if (!Number.isFinite(parsed) || parsed <= 0) {
                // Si borran o ponen 0, remover el ítem
                return prev.filter(item => item.id !== productId);
            }
            return prev.map(item =>
                item.id === productId
                    ? { ...item, quantity: parsed }
                    : item
            );
        });
    };

    const totalUSDT = cart.reduce((sum, item) => {
        const price = parseAmount(item.price_usdt);
        const qty = parseAmount(item.quantity || 0);
        return sum + price * qty;
    }, 0);

    // Subtotal elegible para pago con Fuegos (solo productos que aceptan Fuegos)
    const firesEligibleUSDT = cart.reduce((sum, item) => {
        if (!item.accepts_fires) return sum;
        const price = parseAmount(item.price_usdt);
        const qty = parseAmount(item.quantity || 0);
        return sum + price * qty;
    }, 0);

    const firesRateForCart = Number(rates.fires);
    const maxFiresTokens =
        Number.isFinite(firesRateForCart) && firesRateForCart > 0
            ? Math.floor(firesEligibleUSDT * firesRateForCart)
            : 0;
    const canUseFires = maxFiresTokens > 0 && allowFiresPayments;

    const cashUsdt = parseAmount(payments.cash_usdt);
    const usdtTronUsdt = parseAmount(payments.usdt_tron);
    const bsAmount = parseAmount(payments.bs);
    const bsCashAmount = parseAmount(payments.bs_cash);
    const rawFiresAmount = parseAmount(payments.fires);
    const firesAmount = canUseFires ? Math.min(rawFiresAmount, maxFiresTokens) : 0;

    // Estimación de Fires que se pagarían si toda la parte elegible se liquida por QR
    const estimatedQrFiresForCartRaw = cart.reduce((sum, item) => {
        if (!item.accepts_fires) return sum;
        const qty = parseAmount(item.quantity || 0);
        if (qty <= 0) return sum;

        const rawPriceFires = item.price_fires != null ? Number(item.price_fires) : NaN;
        let firesPerUnit;

        if (Number.isFinite(rawPriceFires) && rawPriceFires > 0) {
            firesPerUnit = rawPriceFires;
        } else {
            const priceUsdt = parseAmount(item.price_usdt);
            firesPerUnit = priceUsdt * rates.fires;
        }

        const tokens = firesPerUnit * qty;
        return sum + (Number.isFinite(tokens) && tokens > 0 ? tokens : 0);
    }, 0);
    const estimatedQrFiresForCart = Math.max(0, Math.floor(estimatedQrFiresForCartRaw));

    const totalPaidUSDT =
        cashUsdt +
        usdtTronUsdt +
        ((bsAmount + bsCashAmount) / rates.bs) +
        (firesAmount / rates.fires);

    // Lo que falta por pagar (en USDT) – nunca negativo
    const remainingUSDT = Math.max(0, totalUSDT - totalPaidUSDT);
    // Lo que sobra (cambio) si el cliente paga de más (en USDT)
    const changeUSDT = Math.max(0, totalPaidUSDT - totalUSDT);

    const isPaid = totalPaidUSDT >= totalUSDT - 0.01; // Tolerance

    const totalBs = totalUSDT * rates.bs;
    const totalFires = totalUSDT * rates.fires;
    const remainingBs = remainingUSDT * rates.bs;
    const changeBs = changeUSDT * rates.bs;
    const changeFires = changeUSDT * rates.fires;

    // --- Helpers y efectos para manejo de mesas (store_table_tabs) ---

    // Inicializar mesa por defecto en modo restaurante
    useEffect(() => {
        if (!isRestaurantMode || tablesCount <= 0) return;
        if (!currentTable) {
            setCurrentTable('Mesa 1');
        }
    }, [isRestaurantMode, tablesCount, currentTable]);

    // Cargar totales de mesas desde backend
    useEffect(() => {
        if (!storeId || !isRestaurantMode) return;

        let cancelled = false;

        const fetchTables = async () => {
            try {
                const response = await axios.get(`/api/store/${storeId}/tables`);
                if (cancelled) return;
                const rows = Array.isArray(response.data) ? response.data : [];
                const map = {};
                for (const row of rows) {
                    const label = row.table_label || '';
                    if (!label) continue;
                    const total = Number(row.total_usdt);
                    map[label] = {
                        total_usdt: Number.isFinite(total) ? total : 0,
                        version: row.version != null ? Number(row.version) : 1
                    };
                }
                setTableTabs(map);
            } catch (error) {
                // No hacer ruido fuerte; el POS sigue funcionando aunque falle esta carga
                console.error('Error fetching store tables', error);
            }
        };

        fetchTables();

        return () => {
            cancelled = true;
        };
    }, [storeId, isRestaurantMode]);

    const buildTableCartSnapshot = (items) => {
        return items.map((item) => ({
            id: item.id,
            name: item.name,
            price_usdt: item.price_usdt,
            accepts_fires: item.accepts_fires,
            quantity: item.quantity
        }));
    };

    const computeCartTotalUSDT = (items) => {
        return items.reduce((sum, item) => {
            const price = parseAmount(item.price_usdt);
            const qty = parseAmount(item.quantity || 0);
            return sum + price * qty;
        }, 0);
    };

    const hasActiveTableUnsavedChanges = () => {
        if (!isRestaurantMode || !currentTable) return false;
        const current = JSON.stringify(buildTableCartSnapshot(cart));
        if (activeTableCartSnapshot == null) {
            // Nunca se ha guardado/cargado esta mesa: cualquier carrito distinto de vacío es un cambio
            return current !== JSON.stringify([]);
        }
        return current !== activeTableCartSnapshot;
    };

    const saveTableTab = async (label, { clearAfterSave = false } = {}) => {
        if (!storeId || !isRestaurantMode || !label) return { ok: false };

        const baseItems = clearAfterSave ? [] : buildTableCartSnapshot(cart);
        const total = computeCartTotalUSDT(baseItems);

        try {
            const response = await axios.put(
                `/api/store/${storeId}/tables/${encodeURIComponent(label)}`,
                {
                    cart_items: baseItems,
                    total_usdt: total,
                    previous_version: activeTableVersion
                }
            );

            const row = response.data || {};
            const newVersion = row.version != null ? Number(row.version) : (activeTableVersion || 1);

            setTableTabs((prev) => ({
                ...prev,
                [label]: {
                    total_usdt: Number(row.total_usdt) || 0,
                    version: newVersion
                }
            }));

            setActiveTableVersion(newVersion);
            setActiveTableCartSnapshot(JSON.stringify(baseItems));

            if (clearAfterSave) {
                setCart([]);
            }

            return { ok: true };
        } catch (error) {
            if (error?.response?.status === 409) {
                toast.error('La mesa fue actualizada desde otro dispositivo. Recarga antes de guardar.');
            } else {
                toast.error('Error al guardar la mesa');
            }
            console.error('Error saving table tab', error);
            return { ok: false, error };
        }
    };

    const loadTableTab = async (label) => {
        if (!storeId || !isRestaurantMode || !label) return;

        try {
            const response = await axios.get(
                `/api/store/${storeId}/tables/${encodeURIComponent(label)}`
            );
            const row = response.data || {};
            const items = Array.isArray(row.cart_items) ? row.cart_items : [];

            setCart(items);
            setCurrentTable(label);

            const version = row.version != null ? Number(row.version) : 1;
            setActiveTableVersion(version);
            setActiveTableCartSnapshot(JSON.stringify(buildTableCartSnapshot(items)));

            setTableTabs((prev) => ({
                ...prev,
                [label]: {
                    total_usdt: Number(row.total_usdt) || 0,
                    version
                }
            }));
        } catch (error) {
            if (error?.response?.status === 404) {
                // Mesa sin datos previos: considerarla vacía
                const empty = [];
                setCart(empty);
                setCurrentTable(label);
                const version = 1;
                setActiveTableVersion(version);
                setActiveTableCartSnapshot(JSON.stringify(empty));
                setTableTabs((prev) => ({
                    ...prev,
                    [label]: {
                        total_usdt: 0,
                        version
                    }
                }));
                return;
            }
            toast.error('Error al cargar la mesa');
            console.error('Error loading table tab', error);
        }
    };

    const lastTableClickRef = useRef({ label: null, time: 0 });

    const handleTableSingleClick = async (label) => {
        if (!isRestaurantMode || !label) return;

        if (!currentTable || currentTable === label) {
            // Si no hay mesa activa o es la misma, solo cargar estado desde backend
            await loadTableTab(label);
            return;
        }

        if (hasActiveTableUnsavedChanges()) {
            const shouldSave = window.confirm(
                'La mesa actual tiene cambios no guardados. Aceptar = guardar y cambiar, Cancelar = descartar y cambiar de mesa.'
            );

            if (shouldSave) {
                const result = await saveTableTab(currentTable);
                if (!result.ok) {
                    return; // No cambiar si no se pudo guardar
                }
            }
        }

        await loadTableTab(label);
    };

    const handleTableDoubleClick = async (label) => {
        if (!isRestaurantMode || !label) return;
        if (currentTable !== label) {
            // Si doble clic en otra mesa, simplemente cargarla
            await loadTableTab(label);
            return;
        }

        const hasCart = cart.length > 0;
        const message = hasCart
            ? '¿Guardar y limpiar esta mesa para una nueva cuenta?'
            : '¿Limpiar esta mesa para una nueva cuenta?';

        const confirmClear = window.confirm(message);
        if (!confirmClear) return;

        const result = await saveTableTab(label, { clearAfterSave: true });
        if (result.ok) {
            const version = (tableTabs[label]?.version || activeTableVersion || 1);
            setActiveTableVersion(version);
            setActiveTableCartSnapshot(JSON.stringify([]));
            setTableTabs((prev) => ({
                ...prev,
                [label]: {
                    total_usdt: 0,
                    version
                }
            }));
        }
    };

    const handleTableButtonClick = (label) => {
        if (!isRestaurantMode || !label) return;

        const now = Date.now();
        const last = lastTableClickRef.current;

        if (last.label === label && now - last.time < 400) {
            // Doble clic
            lastTableClickRef.current = { label: null, time: 0 };
            void handleTableDoubleClick(label);
        } else {
            lastTableClickRef.current = { label, time: now };
            void handleTableSingleClick(label);
        }
    };

    useEffect(() => {
        try {
            const raw = localStorage.getItem('pos_recent_customers');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    setRecentCustomers(parsed);
                }
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(draftsStorageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    setDraftInvoices(parsed);
                }
            }
        } catch {
            // ignore
        }
    }, [draftsStorageKey]);

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

    const handleCheckout = () => {
        if (!isPaid) return toast.error('Falta completar el pago');

        const customerInfo = (customerName || customerPhone)
            ? {
                customer: {
                    name: customerName || null,
                    phone: customerPhone || null
                }
            }
            : null;

        const orderData = {
            store_id: storeData.store.id,
            items: cart.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
                // Pasar modificadores si existen en el item del carrito
                modifiers: Array.isArray(item.modifiers) ? item.modifiers : []
            })),
            type: 'dine_in', // Default
            payment_method: {
                ...payments,
                source: 'pos',
                meta: {
                    usdt_tron_hash: usdtTronHash.trim() || null,
                    proof_cash_bill_image_base64: cashProofBase64 || null
                }
            },
            currency_snapshot: rates,
            table_number: effectiveTable,
            delivery_info: customerInfo,
            customer_id: selectedCustomer?.id || null,
            change_to_fires: giveChangeInFires && changeUSDT > 0 && selectedCustomer?.id
                ? {
                    enabled: true,
                    change_usdt: changeUSDT,
                    change_fires: changeFires
                }
                : { enabled: false }
        };

        createOrderMutation.mutate(orderData);
    };

    const handleCheckoutWithQrFires = () => {
        if (!cart.length) {
            toast.error('No hay productos en el carrito');
            return;
        }

        // Verificar que todo el pedido pueda ser pagado con Fires
        const epsilon = 0.01;
        if (firesEligibleUSDT + epsilon < totalUSDT) {
            toast.error('Este pedido no puede pagarse 100% con Fires (verifica que todos los productos acepten Fires).');
            return;
        }

        // Evitar mezclar otros métodos de pago cuando se usa QR
        const hasOtherPayments =
            parseAmount(payments.cash_usdt) > 0 ||
            parseAmount(payments.usdt_tron) > 0 ||
            parseAmount(payments.bs) > 0 ||
            parseAmount(payments.bs_cash) > 0 ||
            parseAmount(payments.fires) > 0;

        if (hasOtherPayments) {
            toast.error('Para pago QR con Fires, deja todos los campos de pago en cero.');
            return;
        }

        const customerInfo = (customerName || customerPhone)
            ? {
                customer: {
                    name: customerName || null,
                    phone: customerPhone || null
                }
            }
            : null;

        const orderData = {
            store_id: storeData.store.id,
            items: cart.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
                // Pasar modificadores si existen en el item del carrito
                modifiers: Array.isArray(item.modifiers) ? item.modifiers : []
            })),
            type: 'dine_in',
            payment_method: {
                source: 'pos_qr',
                fires: 0,
                meta: {
                    mode: 'qr_fires_only'
                }
            },
            currency_snapshot: rates,
            table_number: effectiveTable,
            delivery_info: customerInfo,
            customer_id: selectedCustomer?.id || null,
            change_to_fires: { enabled: false }
        };

        // Calcular Fires totales priorizando price_fires por producto
        const totalFiresForOrderRaw = cart.reduce((sum, item) => {
            if (!item.accepts_fires) return sum;

            const qty = parseAmount(item.quantity || 0);
            if (qty <= 0) return sum;

            const rawPriceFires = item.price_fires != null ? Number(item.price_fires) : NaN;
            let firesPerUnit;

            if (Number.isFinite(rawPriceFires) && rawPriceFires > 0) {
                firesPerUnit = rawPriceFires;
            } else {
                const priceUsdt = parseAmount(item.price_usdt);
                firesPerUnit = priceUsdt * rates.fires;
            }

            const tokens = firesPerUnit * qty;
            return sum + (Number.isFinite(tokens) && tokens > 0 ? tokens : 0);
        }, 0);
        const totalFiresForOrder = Math.max(0, Math.floor(totalFiresForOrderRaw));

        if (!Number.isFinite(totalFiresForOrder) || totalFiresForOrder <= 0) {
            toast.error('No se pudo calcular el monto en Fires para el pago QR.');
            return;
        }

        createOrderMutation.mutate(orderData, {
            onSuccess: async (response) => {
                try {
                    const createdOrder = response?.data?.order || response?.data;
                    if (!createdOrder?.id) {
                        toast.error('Orden creada pero sin ID válido para pago QR');
                        return;
                    }

                    const qrResp = await axios.post('/api/store/order/qr/start', {
                        order_id: createdOrder.id,
                        total_fires: totalFiresForOrder
                    });

                    const qrData = qrResp?.data || {};
                    const firesAmount = Number(qrData.total_fires || totalFiresForOrder);
                    const qrSessionId = qrData.qr_session_id || null;
                    const qrExpiresAt = qrData.qr_expires_at || null;

                    setQrPaymentOrder({
                        orderId: createdOrder.id,
                        fires: Number.isFinite(firesAmount) ? firesAmount : totalFiresForOrder,
                        storeId: storeId,
                        qrSessionId: qrSessionId,
                        expiresAt: qrExpiresAt
                    });
                    toast.success(
                        `Orden lista para pago QR: ${Number.isFinite(firesAmount) ? firesAmount : totalFiresForOrder} Fires`
                    );
                } catch (err) {
                    console.error('Error al iniciar sesión QR para la orden POS:', err);
                    toast.error('Orden creada, pero falló la creación de la sesión de pago QR');
                }
            }
        });
    };

    // Escuchar confirmaciones de pago QR desde el backend
    useEffect(() => {
        if (!socket || !storeId || !qrPaymentOrder?.orderId) return;

        const handleOrderPaid = (payload) => {
            try {
                if (!payload || String(payload.orderId) !== String(qrPaymentOrder.orderId)) {
                    return;
                }

                toast.success('Pago QR confirmado para la orden actual');
                setQrPaymentOrder(null);
            } catch (err) {
                console.error('Error manejando evento store:order-paid en POS:', err);
            }
        };

        socket.on('store:order-paid', handleOrderPaid);

        return () => {
            socket.off('store:order-paid', handleOrderPaid);
        };
    }, [socket, storeId, qrPaymentOrder?.orderId]);

    // Escuchar nuevos pedidos activos (externos al POS) para resaltar el botón "Pedidos activos"
    useEffect(() => {
        if (!socket || !storeId) return;

        const handleNewOrder = (payload) => {
            try {
                // Payload genérico: cualquier nueva orden de esta tienda hace brillar el botón
                if (!payload || String(payload.storeId || payload.store_id || '') !== String(storeId)) {
                    return;
                }
                setHasNewActiveOrder(true);
            } catch (err) {
                console.error('Error manejando evento store:new-order en POS:', err);
            }
        };

        socket.on('store:new-order', handleNewOrder);

        return () => {
            socket.off('store:new-order', handleNewOrder);
        };
    }, [socket, storeId]);

    const handleNewBilling = () => {
        // Reinicia la venta actual sin tocar clientes recientes ni historial
        setCart([]);
        setPayments(initialPayments);
        setUsdtTronHash('');
        setCashProofBase64('');
        setCashProofName('');
        setCustomerName('');
        setCustomerPhone('');
        setCustomerSearch('');
        setSelectedCustomer(null);
    };

    const handleSaveDraftAndNewInvoice = () => {
        const hasData =
            cart.length > 0 ||
            !!customerName ||
            !!customerPhone ||
            !!selectedCustomer;

        if (!hasData) {
            handleNewBilling();
            return;
        }

        const draft = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            created_at: new Date().toISOString(),
            store_id: storeData?.store?.id || null,
            slug,
            table_label: effectiveTable,
            cart: cart.map((item) => ({ ...item })),
            customerName,
            customerPhone,
            selectedCustomer,
            payments: { ...payments },
            giveChangeInFires
        };

        const nextDrafts = [draft, ...draftInvoices].slice(0, 50);

        setDraftInvoices(nextDrafts);
        try {
            localStorage.setItem(draftsStorageKey, JSON.stringify(nextDrafts));
        } catch {
            // ignore
        }

        handleNewBilling();
        toast.success('Factura guardada en curso');
    };

    const handleOpenDrafts = () => {
        setIsDraftsModalOpen(true);
    };

    const handleLoadDraft = (draftId) => {
        const draft = draftInvoices.find((d) => d.id === draftId);
        if (!draft) return;

        setCart(Array.isArray(draft.cart) ? draft.cart : []);
        setCustomerName(draft.customerName || '');
        setCustomerPhone(draft.customerPhone || '');
        setSelectedCustomer(draft.selectedCustomer || null);
        setPayments(draft.payments || initialPayments);
        setGiveChangeInFires(!!draft.giveChangeInFires);

        if (draft.table_label) {
            setCurrentTable(draft.table_label);
        }

        const nextDrafts = draftInvoices.filter((d) => d.id !== draftId);
        setDraftInvoices(nextDrafts);
        try {
            localStorage.setItem(draftsStorageKey, JSON.stringify(nextDrafts));
        } catch {
            // ignore
        }

        setIsDraftsModalOpen(false);
        toast.success('Factura recuperada');
    };

    const handleClearDrafts = () => {
        setDraftInvoices([]);
        try {
            localStorage.setItem(draftsStorageKey, JSON.stringify([]));
        } catch {
            // ignore
        }
        setIsDraftsModalOpen(false);
    };

    // Remote search of customers por CI / nombre / correo / teléfono / email
    const {
        data: customerSearchResults = [],
        isLoading: isSearchingCustomers,
        error: customerSearchError
    } = useQuery({
        queryKey: ['pos-customers-search', storeId, customerSearch],
        enabled: !!storeId && customerSearch.trim().length > 0,
        queryFn: async () => {
            const query = customerSearch.trim();
            if (!query) return [];
            const response = await axios.get(`/api/store/${storeId}/customers/search`, {
                params: { q: query }
            });
            return response.data || [];
        }
    });

    if (!storeData) return <div className="p-10">Cargando POS...</div>;

    const { products, categories } = storeData;

    const filteredProducts = products.filter(p =>
        (selectedCategory === 'all' || p.category_id === selectedCategory) &&
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col lg:flex-row min-h-screen bg-dark text-white">
            {/* Left: Product Catalog */}
            <div className="flex-1 flex flex-col lg:border-r border-white/10">
                {/* Header / Search */}
                <div className="px-3 py-2 md:p-4 border-b border-white/10 flex flex-col md:flex-row gap-2 md:gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-white/40" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar producto..."
                            className="w-full bg-white/5 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto mt-1 md:mt-0 md:max-w-md no-scrollbar text-xs">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`px-3 py-1.5 rounded-full whitespace-nowrap ${selectedCategory === 'all' ? 'bg-accent text-dark' : 'bg-white/5'}`}
                        >
                            Todos
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-3 py-1.5 rounded-full whitespace-nowrap ${selectedCategory === cat.id ? 'bg-accent text-dark' : 'bg-white/5'}`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto px-3 py-3 md:p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
                        {filteredProducts.map(product => {
                            const priceUsdt = Number(product.price_usdt || 0);
                            const priceBs = priceUsdt * rates.bs;

                            const rawStock = product.stock;
                            const stockNumber = typeof rawStock === 'number' ? rawStock : parseFloat(rawStock);
                            const hasNumericStock = Number.isFinite(stockNumber);
                            const isOutOfStock = hasNumericStock && stockNumber === 0;

                            return (
                                <button
                                    key={product.id}
                                    onClick={() => addToCart(product)}
                                    className="bg-white/5 rounded-lg hover:bg-white/10 transition-colors text-left flex flex-col justify-between px-2.5 py-2.5 sm:px-3 sm:py-3 min-h-[84px]"
                                >
                                    <span className="font-medium text-xs sm:text-sm line-clamp-2">{product.name}</span>
                                    <div className="mt-1 flex flex-col gap-0.5">
                                        <span className="text-accent font-bold text-xs sm:text-sm">${priceUsdt.toFixed(2)}</span>
                                        <span className="text-[10px] sm:text-xs text-white/60">
                                            {priceBs.toLocaleString('es-VE', {
                                                style: 'currency',
                                                currency: 'VES'
                                            })}
                                        </span>
                                        {hasNumericStock && (
                                            <span className={`text-[10px] sm:text-xs ${isOutOfStock ? 'text-red-400' : 'text-white/60'}`}>
                                                Stock: {stockNumber}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Right: Cart, Customer & Payment */}
            <div className="w-full lg:w-96 flex flex-col bg-dark-lighter border-t border-white/10 lg:border-t-0">
                <div className="p-4 border-b border-white/10 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-base md:text-lg">Orden Actual</div>
                        {isRestaurantMode && (
                            <div className="text-xs text-white/60">
                                {effectiveTable}
                            </div>
                        )}
                    </div>

                    {/* Estado de caja en POS */}
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-2">
                            <span
                                className={`w-2 h-2 rounded-full ${
                                    cashSession ? 'bg-emerald-400' : 'bg-red-400'
                                }`}
                            ></span>
                            <span className="text-white/70">
                                {loadingCashStatus
                                    ? 'Caja: cargando...'
                                    : cashSession
                                    ? 'Caja abierta'
                                    : 'Caja cerrada'}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                if (cashSession) {
                                    closeCashMutation.mutate();
                                } else {
                                    setOpenCashModalOpen(true);
                                }
                            }}
                            disabled={openCashMutation.isLoading || closeCashMutation.isLoading || loadingCashStatus}
                            className="px-2 py-1 rounded-full bg-white/5 hover:bg-white/10 text-[10px] disabled:opacity-50"
                        >
                            {openCashMutation.isLoading || closeCashMutation.isLoading
                                ? 'Procesando...'
                                : cashSession
                                ? 'Cerrar caja'
                                : 'Abrir caja'}
                        </button>
                    </div>
                </div>

                {/* Cliente */}
                <div className="p-4 border-b border-white/10 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold flex items-center gap-2">
                            <User size={16} /> Cliente
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedCustomer(null);
                                setCustomerName('');
                                setCustomerPhone('');
                                setCustomerSearch('');
                                setNewCustomerModalOpen(true);
                            }}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white/5 hover:bg-white/10"
                        >
                            <UserPlus size={14} /> Nuevo cliente
                        </button>
                    </div>

                    <div className="space-y-2">
                        {selectedCustomer && (
                            <div className="text-[11px] text-white/70 flex flex-wrap items-center gap-1">
                                <span className="font-semibold">Seleccionado:</span>
                                <span>{selectedCustomer.full_name || selectedCustomer.ci_full}</span>
                                {selectedCustomer.ci_full && (
                                    <span className="text-white/50">({selectedCustomer.ci_full})</span>
                                )}
                                {selectedCustomer.is_cai && (
                                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] bg-orange-500/20 text-orange-300 border border-orange-500/40">
                                        CAI
                                    </span>
                                )}
                            </div>
                        )}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Buscar cliente (CI, nombre, correo o teléfono)..."
                                className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                                onFocus={() => setIsCustomerSearchFocused(true)}
                                onBlur={() => setIsCustomerSearchFocused(false)}
                            />
                            {customerSearch && isCustomerSearchFocused && (
                                <div className="absolute left-0 right-0 mt-1 bg-black/95 border border-white/10 rounded-lg shadow-lg max-h-40 overflow-y-auto z-50 text-xs">
                                    {isSearchingCustomers && (
                                        <div className="px-3 py-2 text-white/50">
                                            Buscando clientes...
                                        </div>
                                    )}
                                    {!isSearchingCustomers && customerSearchError && (
                                        <div className="px-3 py-2 text-red-400">
                                            Error al buscar clientes
                                        </div>
                                    )}
                                    {!isSearchingCustomers && !customerSearchError && (
                                        <>
                                            {customerSearchResults && customerSearchResults.length > 0 ? (
                                                customerSearchResults.map((c) => (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedCustomer(c);
                                                            setCustomerName(c.full_name || '');
                                                            setCustomerPhone(c.phone || '');
                                                            setCustomerSearch('');
                                                        }}
                                                        className="w-full flex flex-col items-start px-3 py-2 hover:bg-white/5 text-left"
                                                    >
                                                        <span className="font-medium flex items-center gap-1">
                                                            {c.full_name || c.ci_full || 'Sin nombre'}
                                                            {c.is_cai && (
                                                                <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-orange-500/20 text-orange-300 border border-orange-500/40">
                                                                    CAI
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="text-white/60">
                                                            {c.ci_full}
                                                            {c.phone ? ` • ${c.phone}` : ''}
                                                        </span>
                                                        {c.email && (
                                                            <span className="text-white/40 truncate max-w-full">{c.email}</span>
                                                        )}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="px-3 py-2 text-white/50">
                                                    Sin resultados
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <input
                                type="text"
                                placeholder="Nombre del cliente"
                                className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Teléfono / referencia"
                                className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                            />
                        </div>
                    </div>

                    {qrPaymentOrder && (
                        <div className="mb-3 p-3 rounded-lg bg-accent/10 border border-accent/40 text-xs text-accent">
                            <div className="font-semibold text-[13px] mb-1">Pago QR en espera</div>
                            <div className="flex flex-col gap-0.5 text-[11px] text-white/80">
                                <span>
                                    Orden ID: <span className="font-mono text-white/90">{String(qrPaymentOrder.orderId).slice(0, 8)}...</span>
                                </span>
                                <span>
                                    Monto a pagar: <span className="font-semibold text-orange-300">{qrPaymentOrder.fires}</span> Fires
                                </span>
                                {qrPaymentOrder.expiresAt && (
                                    <span className="text-white/70">
                                        Expira en:{' '}
                                        {(() => {
                                            try {
                                                const now = new Date();
                                                const exp = new Date(qrPaymentOrder.expiresAt);
                                                const diffMs = exp.getTime() - now.getTime();
                                                if (diffMs <= 0) return '0 min';
                                                const totalSec = Math.floor(diffMs / 1000);
                                                const min = Math.floor(totalSec / 60);
                                                const sec = totalSec % 60;
                                                if (min <= 0) return `${sec}s`;
                                                return `${min}m ${sec}s`;
                                            } catch {
                                                return '';
                                            }
                                        })()}
                                    </span>
                                )}
                                {qrPaymentOrder.qrSessionId && (
                                    <span className="mt-1">
                                        Link de pago:
                                        <div className="mt-0.5 text-[10px] break-all text-white/70 select-all">
                                            {(() => {
                                                if (typeof window === 'undefined') {
                                                    return `/store/${slug}/qr/${qrPaymentOrder.qrSessionId}`;
                                                }
                                                const origin = window.location.origin || '';
                                                try {
                                                    const url = new URL(origin);
                                                    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
                                                    const base = isLocal
                                                        ? 'https://mundoxyz-production.up.railway.app'
                                                        : origin;
                                                    return `${base}/store/${slug}/qr/${qrPaymentOrder.qrSessionId}`;
                                                } catch {
                                                    return `/store/${slug}/qr/${qrPaymentOrder.qrSessionId}`;
                                                }
                                            })()}
                                        </div>
                                    </span>
                                )}
                                <span className="text-white/60">
                                    Pide al cliente que escanee el QR de la tienda desde su app y confirme el pago.
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {cart.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center text-accent font-bold text-sm">
                                    {item.quantity}
                                </div>
                                <div className="min-w-0">
                                    <div className="font-medium truncate max-w-[140px] sm:max-w-[200px]">{item.name}</div>
                                    <div className="text-xs text-white/60">${Number(item.price_usdt || 0).toFixed(2)} c/u</div>

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
                                                    {mods.map((mod) => (
                                                        <span
                                                            key={mod.id}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-[10px]"
                                                        >
                                                            <span>{mod.name}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => changeItemQuantity(item.id, -1)}
                                        className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs hover:bg-white/20"
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => setItemQuantityDirect(item.id, e.target.value)}
                                        className="w-12 text-center bg-white/5 rounded-md text-xs py-1 focus:outline-none focus:ring-1 focus:ring-accent"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => changeItemQuantity(item.id, 1)}
                                        className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs hover:bg-white/20"
                                    >
                                        +
                                    </button>
                                </div>
                                <div className="font-bold text-sm">
                                    ${
                                        (Number(item.price_usdt || 0) * (Number(item.quantity) || 0))
                                            .toFixed(2)
                                    }
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-white/5 border-t border-white/10">
                    {isRestaurantMode && (
                        <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] uppercase tracking-wide text-white/50">
                                    Mesas
                                </span>
                                <span className="text-[11px] text-white/70">
                                    {effectiveTable}
                                </span>
                            </div>
                            <div className="flex gap-1 overflow-x-auto no-scrollbar">
                                {Array.from({ length: tablesCount }, (_, index) => {
                                    const label = `Mesa ${index + 1}`;
                                    const isActive = effectiveTable === label;
                                    const tab = tableTabs[label];
                                    const totalTabUsdt = tab ? Number(tab.total_usdt) || 0 : 0;
                                    const totalTabBs = totalTabUsdt * rates.bs;
                                    return (
                                        <button
                                            key={label}
                                            type="button"
                                            onClick={() => handleTableButtonClick(label)}
                                            className={`px-2.5 py-1.5 rounded-full text-[10px] whitespace-nowrap border flex flex-col items-center justify-center min-w-[52px] ${
                                                isActive
                                                    ? 'bg-accent text-dark border-accent'
                                                    : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                                            }`}
                                        >
                                            <span className="font-semibold">{index + 1}</span>
                                            <span className="text-[9px] leading-tight text-white/80">
                                                {totalTabBs.toLocaleString('es-VE', {
                                                    style: 'currency',
                                                    currency: 'VES'
                                                })}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="mb-4">
                        <div className="text-xs text-white/60">Total a cobrar</div>
                        <div className="text-2xl font-bold text-accent">
                            {totalBs.toLocaleString('es-VE', {
                                style: 'currency',
                                currency: 'VES'
                            })}
                        </div>
                        <div className="text-xs text-white/60 mt-1">
                            ≈ {totalUSDT.toFixed(2)} USDT • {totalFires.toFixed(0)} Fires
                        </div>
                    </div>

                    <button
                        onClick={() => setPaymentModalOpen(true)}
                        disabled={cart.length === 0}
                        className="w-full btn-primary py-4 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Pagar
                    </button>

                    <div className="mt-3 flex gap-2 text-xs">
                        <button
                            type="button"
                            onClick={handleNewBilling}
                            className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50"
                            disabled={cart.length === 0 && !customerName && !customerPhone && !selectedCustomer}
                        >
                            Nueva facturación
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsQuoteModalOpen(true)}
                            className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10"
                        >
                            Cotización
                        </button>
                    </div>
                    <div className="mt-2 flex gap-2 text-[11px]">
                        <button
                            type="button"
                            onClick={handleSaveDraftAndNewInvoice}
                            className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={cart.length === 0 && !customerName && !customerPhone && !selectedCustomer}
                        >
                            Factura adicional
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenDrafts}
                            className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={draftInvoices.length === 0}
                        >
                            Recuperar facturas
                        </button>
                    </div>
                    <div className="flex items-center justify-between mb-3 gap-2">
                        <button
                            type="button"
                            onClick={() => setIsInvoiceHistoryOpen(true)}
                            className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-center"
                        >
                            Ver facturas recientes
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setHasNewActiveOrder(false);
                                if (storeData?.store?.slug) {
                                    navigate(`/store/${storeData.store.slug}/dashboard?tab=reports`);
                                }
                            }}
                            className={`flex-1 py-2 rounded-lg text-xs text-center border transition-all ${
                                hasNewActiveOrder
                                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.6)] animate-pulse'
                                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
                            }`}
                        >
                            Pedidos activos
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal abrir caja: monto de inicio */}
            {openCashModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-dark border border-white/10 p-6 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">Abrir caja</h2>
                        <p className="text-xs text-white/70 mb-4">
                            Ingresa el monto de inicio en caja. Este monto es la base y <span className="font-semibold">no se contabiliza como ventas del d eda</span>.
                        </p>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <label className="block mb-1 text-white/70">Monto inicio USDT</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                    value={openCashForm.usdt}
                                    onChange={(e) => setOpenCashForm(prev => ({ ...prev, usdt: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block mb-1 text-white/70">Monto inicio Bs</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                    value={openCashForm.bs}
                                    onChange={(e) => setOpenCashForm(prev => ({ ...prev, bs: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block mb-1 text-white/70">Monto inicio Fuegos</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                    value={openCashForm.fires}
                                    onChange={(e) => setOpenCashForm(prev => ({ ...prev, fires: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block mb-1 text-white/70">Monto inicio TRON</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                                    value={openCashForm.tron}
                                    onChange={(e) => setOpenCashForm(prev => ({ ...prev, tron: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                type="button"
                                onClick={() => setOpenCashModalOpen(false)}
                                className="flex-1 btn-secondary"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => openCashMutation.mutate(openCashForm)}
                                disabled={openCashMutation.isLoading}
                                className="flex-1 btn-primary disabled:opacity-50"
                            >
                                {openCashMutation.isLoading ? 'Abriendo caja...' : 'Confirmar apertura'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Resumen de cierre de caja */}
            {cashCloseSummary && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-dark border border-white/10 p-6 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">Cierre de caja</h2>
                        <p className="text-xs text-white/70 mb-4">
                            Resumen del lote de caja desde la apertura hasta el momento del cierre.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mb-4">
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-white/80">Monto de inicio</h3>
                                <div className="flex justify-between">
                                    <span className="text-white/60">USDT</span>
                                    <span className="font-semibold">{Number(openingBalance.usdt || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/60">Bs</span>
                                    <span className="font-semibold">{Number(openingBalance.bs || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/60">Fuegos</span>
                                    <span className="font-semibold">{Number(openingBalance.fires || 0).toFixed(0)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/60">TRON</span>
                                    <span className="font-semibold">{Number(openingBalance.tron || 0).toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-white/80">Ventas del turno</h3>
                                <div className="flex justify-between">
                                    <span className="text-white/60">Total ventas (USDT)</span>
                                    <span className="font-semibold">{Number(closingTotals.usdt || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/60">Órdenes</span>
                                    <span className="font-semibold">{Number(cashCloseStats?.order_count || 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/60">Artículos vendidos</span>
                                    <span className="font-semibold">{Number(cashCloseStats?.items_sold || 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/60">Comisión plataforma (USDT)</span>
                                    <span className="font-semibold">{Number(cashCloseStats?.commission_usdt || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="text-[11px] text-white/60 mb-4">
                            <p>
                                El monto de inicio se usa como base y no se suma a las ventas del turno. Las ventas
                                listadas arriba corresponden solo a las órdenes confirmadas durante la sesión de caja.
                            </p>
                        </div>

                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                type="button"
                                onClick={() => setCashCloseSummary(null)}
                                className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs"
                            >
                                Cerrar resumen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {paymentModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-dark border border-white/10 p-6 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6">Procesar Pago</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-white/60 mb-1">Efectivo (USDT)</label>
                                    <div className="relative">
                                        <Banknote className="absolute left-3 top-3 text-green-500" size={20} />
                                        <input
                                            type="number"
                                            className="w-full bg-white/5 rounded-lg pl-10 p-3"
                                            value={payments.cash_usdt}
                                            onChange={e => setPayments({ ...payments, cash_usdt: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-white/60 mb-1">USDT Tron</label>
                                    <div className="relative">
                                        <CreditCard className="absolute left-3 top-3 text-blue-500" size={20} />
                                        <input
                                            type="number"
                                            className="w-full bg-white/5 rounded-lg pl-10 p-3"
                                            value={payments.usdt_tron}
                                            onChange={e => setPayments({ ...payments, usdt_tron: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="mt-2">
                                    <label className="block text-xs text-white/60 mb-1">Hash TRON (opcional)</label>
                                    <input
                                        type="text"
                                        className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs"
                                        value={usdtTronHash}
                                        onChange={e => setUsdtTronHash(e.target.value)}
                                        placeholder="TXID..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-white/60 mb-1">Bolívares (Tasa: {rates.bs})</label>
                                    <div className="relative">
                                        <RefreshCw className="absolute left-3 top-3 text-yellow-500" size={20} />
                                        <input
                                            type="number"
                                            className="w-full bg-white/5 rounded-lg pl-10 p-3"
                                            value={payments.bs}
                                            onChange={e => setPayments({ ...payments, bs: e.target.value })}
                                        />
                                        <div className="absolute right-3 top-3 text-xs text-white/40">
                                            = ${(bsAmount / rates.bs).toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <label className="block text-sm text-white/60 mb-1">Bs en efectivo</label>
                                    <div className="relative">
                                        <Banknote className="absolute left-3 top-3 text-green-500" size={20} />
                                        <input
                                            type="number"
                                            className="w-full bg-white/5 rounded-lg pl-10 p-3"
                                            value={payments.bs_cash}
                                            onChange={e => setPayments({ ...payments, bs_cash: e.target.value })}
                                        />
                                        <div className="absolute right-3 top-3 text-xs text-white/40">
                                            = ${(bsCashAmount / rates.bs).toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <label className="block text-xs text-white/60 mb-1">Comprobante (foto, opcional)</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleCashProofChange}
                                                className="text-xs text-white/70"
                                            />
                                            <CameraButton
                                                onPhotoTaken={(file) => {
                                                    handleCashProofChange({ target: { files: [file] } });
                                                }}
                                                size="sm"
                                                className="rounded-full"
                                            />
                                            {cashProofName && (
                                                <span className="text-xs text-emerald-400 truncate max-w-[120px]">
                                                    {cashProofName}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-sm text-white/60">Fires (Tasa: {rates.fires})</label>
                                        {maxFiresTokens > 0 && (
                                            <label className="inline-flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="form-checkbox h-3.5 w-3.5 text-accent"
                                                    checked={allowFiresPayments}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setAllowFiresPayments(checked);
                                                        if (!checked) {
                                                            setPayments(prev => ({ ...prev, fires: '' }));
                                                        }
                                                    }}
                                                />
                                                <span>Permitir pagos con Fuegos</span>
                                            </label>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <Flame className="absolute left-3 top-3 text-orange-500" size={20} />
                                        <input
                                            type="number"
                                            min={0}
                                            max={maxFiresTokens || undefined}
                                            disabled={!canUseFires}
                                            className="w-full bg-white/5 rounded-lg pl-10 p-3 disabled:opacity-40 disabled:cursor-not-allowed"
                                            value={payments.fires}
                                            onChange={e => {
                                                const raw = e.target.value;
                                                const n = parseAmount(raw);
                                                if (!canUseFires || maxFiresTokens <= 0) {
                                                    setPayments({ ...payments, fires: 0 });
                                                    return;
                                                }
                                                const clamped = Math.max(0, Math.min(n, maxFiresTokens));
                                                setPayments({ ...payments, fires: String(clamped) });
                                            }}
                                        />
                                        <div className="absolute right-3 top-3 text-xs text-white/40">
                                            = {(firesAmount / rates.fires).toFixed(2)}
                                        </div>
                                        {allowFiresPayments && estimatedQrFiresForCart > 0 && !isPaid && (
                                            <div className="mt-6 text-[11px] text-white/70 flex justify-between">
                                                <span>Pago QR estimado</span>
                                                <span className="font-semibold text-orange-300">
                                                    {estimatedQrFiresForCart} Fires
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/5 p-6 rounded-xl flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span>Total a Pagar</span>
                                        <span className="font-bold">${totalUSDT.toFixed(2)}</span>
                                    </div>
                                    <div className="text-xs text-white/60 text-right mb-2">
                                        {totalBs.toLocaleString('es-VE', {
                                            style: 'currency',
                                            currency: 'VES'
                                        })}{' '}
                                        • {totalFires.toFixed(0)} Fires
                                    </div>
                                    <div className="flex justify-between mb-2 text-success">
                                        <span>Pagado</span>
                                        <span className="font-bold">${totalPaidUSDT.toFixed(2)}</span>
                                    </div>
                                    <div className="h-px bg-white/10 my-4"></div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-sm font-semibold">
                                            <span>Restante</span>
                                            <span className={remainingUSDT > 0 ? 'text-red-400' : 'text-green-400'}>
                                                {remainingBs.toLocaleString('es-VE', {
                                                    style: 'currency',
                                                    currency: 'VES'
                                                })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs text-white/70">
                                            <span>Restante en USDT</span>
                                            <span className={remainingUSDT > 0 ? 'text-red-300' : 'text-green-300'}>
                                                {`$${remainingUSDT.toFixed(2)}`}
                                            </span>
                                        </div>

                                        {changeUSDT > 0 && (
                                            <>
                                                <div className="h-px bg-white/10 my-1" />
                                                <div className="flex justify-between text-sm font-semibold">
                                                    <span>Cambio</span>
                                                    <span className="text-green-400">
                                                        {changeBs.toLocaleString('es-VE', {
                                                            style: 'currency',
                                                            currency: 'VES'
                                                        })}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-xs text-white/70">
                                                    <span>Cambio en USDT</span>
                                                    <span className="text-green-300">
                                                        {`$${changeUSDT.toFixed(2)}`}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-xs text-white/70">
                                                    <span>Cambio en Fires</span>
                                                    <span className="text-orange-300">
                                                        {changeFires.toFixed(0)} Fires
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {changeUSDT > 0 && selectedCustomer && (
                                        <div className="mt-4 pt-3 border-t border-white/10 space-y-1 text-xs">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="text-white/80">Dar vuelto en Fires</p>
                                                    <p className="text-white/60 text-[11px]">
                                                        Se acreditarán aproximadamente {changeFires.toFixed(0)} Fires al cliente.
                                                    </p>
                                                </div>
                                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="form-checkbox h-4 w-4 text-accent"
                                                        checked={giveChangeInFires}
                                                        onChange={(e) => setGiveChangeInFires(e.target.checked)}
                                                    />
                                                    <span>Activar</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-4 mt-8">
                                    <button
                                        onClick={() => setPaymentModalOpen(false)}
                                        className="flex-1 btn-secondary"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleCheckout}
                                        disabled={!isPaid}
                                        className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Confirmar Pago
                                    </button>
                                </div>
                                <div className="flex gap-4 mt-3 text-xs">
                                    <button
                                        type="button"
                                        onClick={handleCheckoutWithQrFires}
                                        disabled={!canUseFires || !cart.length}
                                        className="flex-1 py-2 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Crear pago QR (Fires)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {newCustomerModalOpen && storeData?.store?.id && (
                <NewCustomerModal
                    storeId={storeData.store.id}
                    isOpen={newCustomerModalOpen}
                    onClose={() => setNewCustomerModalOpen(false)}
                    onCreated={(customer) => {
                        setSelectedCustomer(customer);
                        setCustomerName(customer.full_name || '');
                        setCustomerPhone(customer.phone || '');
                        setNewCustomerModalOpen(false);
                    }}
                />
            )}

            {isQuoteModalOpen && (
                <QuoteModal
                    products={products}
                    rates={rates}
                    onClose={() => setIsQuoteModalOpen(false)}
                />
            )}

            {isDraftsModalOpen && (
                <POSDraftInvoicesModal
                    drafts={draftInvoices}
                    onClose={() => setIsDraftsModalOpen(false)}
                    onLoadDraft={handleLoadDraft}
                    onClearAll={handleClearDrafts}
                />
            )}

            {isInvoiceHistoryOpen && storeData?.store?.id && (
                <POSInvoiceHistoryModal
                    storeId={storeData.store.id}
                    onClose={() => setIsInvoiceHistoryOpen(false)}
                    onSelectInvoice={(invoiceNumber) => {
                        setInvoiceModal({
                            storeId: storeData.store.id,
                            invoiceNumber
                        });
                    }}
                />
            )}

            {invoiceModal && (
                <POSInvoiceDetailModal
                    storeId={invoiceModal.storeId}
                    invoiceNumber={invoiceModal.invoiceNumber}
                    vesPerUsdt={vesPerUsdt}
                    slug={slug}
                    onClose={() => setInvoiceModal(null)}
                />
            )}
        </div>
    );
};

const POSInvoiceDetailModal = ({ storeId, invoiceNumber, vesPerUsdt, slug, onClose }) => {
    const { data, isLoading, error } = useQuery({
        queryKey: ['pos-invoice-detail', storeId, invoiceNumber],
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

    const handlePrint = () => {
        const order = data;
        const storeName = order?.store_name || 'Factura';
        const formattedNumber = formatInvoiceNumber(invoiceNumber);
        const previousTitle = document.title;

        // Ajustar título del documento para que el PDF tenga un nombre útil
        document.title = `${storeName} - Factura ${formattedNumber}`;

        // Añadir clase a body para estilos de impresión (texto negro / fondo blanco)
        document.body.classList.add('print-invoice');

        try {
            window.print();
        } finally {
            document.body.classList.remove('print-invoice');
            document.title = previousTitle;
        }
    };

    const order = data;

    let subtotalBs = null;
    let taxBs = null;
    let deliveryBs = null;
    let discountBs = null;
    let totalBs = null;

    if (order && vesPerUsdt) {
        subtotalBs = order.subtotal_usdt * vesPerUsdt;
        taxBs = order.tax_usdt * vesPerUsdt;
        deliveryBs = order.delivery_fee_usdt * vesPerUsdt;
        discountBs = order.discount_usdt * vesPerUsdt;
        totalBs = order.total_usdt * vesPerUsdt;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl bg-dark border border-white/10 rounded-2xl p-4 md:p-6 max-h-[90vh] overflow-y-auto text-xs">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-bold">
                            {order?.store_name ? `${order.store_name} – ` : ''}
                            Factura #{formatInvoiceNumber(invoiceNumber)}
                        </h2>
                        {order && (
                            <p className="text-[11px] text-white/60">
                                Emitida el {order.created_at ? new Date(order.created_at).toLocaleString() : '-'}
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[11px]"
                        >
                            Imprimir / PDF
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[11px]"
                        >
                            Aceptar
                        </button>
                    </div>
                </div>

                {isLoading && <p className="text-white/60 text-xs">Cargando factura...</p>}
                {error && !isLoading && (
                    <p className="text-red-400 text-xs">Error al cargar la factura.</p>
                )}
                {!isLoading && !error && !order && (
                    <p className="text-white/60 text-xs">Factura no encontrada.</p>
                )}

                {order && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <p className="text-[11px] text-white/60">Cliente</p>
                                <p className="text-xs font-semibold">{order.customer?.name || 'Consumidor final'}</p>
                                {order.customer?.ci && (
                                    <p className="text-[11px] text-white/70">CI: {order.customer.ci}</p>
                                )}
                                {order.customer?.phone && (
                                    <p className="text-[11px] text-white/70">Teléfono: {order.customer.phone}</p>
                                )}
                                {order.customer?.email && (
                                    <p className="text-[11px] text-white/70">Email: {order.customer.email}</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <p className="text-[11px] text-white/60">Detalles</p>
                                <p className="text-[11px] text-white/70">Tipo: {order.type}</p>
                                {order.table_number && (
                                    <p className="text-[11px] text-white/70">Mesa / Ref: {order.table_number}</p>
                                )}
                                {order.seller && (
                                    <p className="text-[11px] text-white/70">
                                        Vendedor: {order.seller.name || order.seller.username || '-'}
                                    </p>
                                )}
                            </div>
                        </div>

                        {order.qr_session_id && (
                            <div className="mt-1 mb-2 p-3 rounded-lg bg-accent/10 border border-accent/40 text-[11px] text-white/80">
                                <div className="font-semibold text-accent mb-1">
                                    Pago QR (Fires)
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span>
                                        Monto QR: <span className="font-semibold text-orange-300">{Number(order.total_fires || 0).toFixed(0)}</span> Fires
                                    </span>
                                    {order.qr_expires_at && (
                                        <span className="text-white/70">
                                            Expira el{' '}
                                            {new Date(order.qr_expires_at).toLocaleString('es-VE', {
                                                day: '2-digit',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    )}
                                    <span className="mt-1">
                                        Link de pago:
                                        <div className="mt-0.5 text-[10px] break-all text-white/70 select-all">
                                            {(() => {
                                                const path = `/store/${slug}/qr/${order.qr_session_id}`;
                                                if (typeof window === 'undefined') return path;
                                                const origin = window.location.origin || '';
                                                try {
                                                    const url = new URL(origin);
                                                    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
                                                    const base = isLocal
                                                        ? 'https://mundoxyz-production.up.railway.app'
                                                        : origin;
                                                    return `${base}${path}`;
                                                } catch {
                                                    return path;
                                                }
                                            })()}
                                        </div>
                                    </span>
                                </div>
                            </div>
                        )}

                        <div>
                            <table className="min-w-full text-[11px] align-middle">
                                <thead>
                                    <tr className="text-white/60 border-b border-white/10">
                                        <th className="py-1 pr-3 text-left">Producto</th>
                                        <th className="py-1 pr-3 text-right">Cant.</th>
                                        <th className="py-1 pr-3 text-right">P. unit USDT</th>
                                        <th className="py-1 pr-3 text-right">Total USDT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.items.map((item, idx) => (
                                        <tr key={`${item.product_id || idx}-${idx}`} className="border-b border-white/10">
                                            <td className="py-1 pr-3 text-white/80">
                                                <div>{item.product_name || 'Producto'}</div>
                                            </td>
                                            <td className="py-1 pr-3 text-right text-white/80">{item.quantity}</td>
                                            <td className="py-1 pr-3 text-right text-white/80">
                                                {Number(item.price_usdt || 0).toFixed(2)}
                                            </td>
                                            <td className="py-1 pr-3 text-right text-white/80">
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
                                <div className="flex justify-between text-white/60">
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
                                <div className="flex justify-between text-white/60">
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
                                <div className="flex justify-between text-white/60">
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
                                <div className="flex justify-between text-white/60">
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
                            <div className="h-px bg-white/10 my-1" />
                            <div className="flex justify-between font-semibold text-sm">
                                <span>Total (USDT)</span>
                                <span>{order.total_usdt.toFixed(2)}</span>
                            </div>
                            {totalBs != null && (
                                <div className="flex justify-between text-[11px] text-white/80">
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
    );
};

const POSInvoiceHistoryModal = ({ storeId, onClose, onSelectInvoice }) => {
    const { data, isLoading, error } = useQuery({
        queryKey: ['pos-invoice-history', storeId],
        queryFn: async () => {
            const response = await axios.get(`/api/store/order/${storeId}/orders/history`, {
                params: { limit: 50, offset: 0 }
            });
            return Array.isArray(response.data) ? response.data : [];
        }
    });

    const orders = Array.isArray(data) ? data : [];

    const pendingQrOrders = orders.filter((order) =>
        order && order.payment_status === 'unpaid' && order.qr_session_id
    );

    const completedOrders = orders.filter((order) =>
        !order || order.payment_status !== 'unpaid' || !order.qr_session_id
    );

    const formatInvoiceNumber = (n) => {
        if (n === null || n === undefined) return '-';
        const numeric = typeof n === 'number' ? n : parseInt(n, 10);
        if (!Number.isFinite(numeric)) return String(n);
        return String(numeric).padStart(7, '0');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-dark border border-white/10 rounded-2xl p-4 md:p-6 max-h-[80vh] overflow-y-auto text-xs">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h2 className="text-sm md:text-base font-semibold">Facturas recientes</h2>
                        <p className="text-[11px] text-white/60">Toca una factura para ver el detalle.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[11px]"
                    >
                        Cerrar
                    </button>
                </div>

                {isLoading && <p className="text-white/60 text-xs">Cargando historial...</p>}
                {error && !isLoading && (
                    <p className="text-red-400 text-xs">Error al cargar el historial.</p>
                )}
                {!isLoading && !error && orders.length === 0 && (
                    <p className="text-white/60 text-xs">Aún no hay facturas registradas.</p>
                )}

                {pendingQrOrders.length > 0 && (
                    <div className="mb-4">
                        <div className="mb-1 text-[11px] font-semibold text-orange-300">
                            Pendientes de pago QR
                        </div>
                        <div className="space-y-1">
                            {pendingQrOrders.map((order) => {
                                const firesAmount = Number(order.total_fires || 0);
                                const created = order.created_at ? new Date(order.created_at) : null;
                                const expiresAt = order.qr_expires_at ? new Date(order.qr_expires_at) : null;
                                let remainingLabel = '';
                                if (expiresAt) {
                                    const diffMs = expiresAt.getTime() - Date.now();
                                    if (diffMs <= 0) {
                                        remainingLabel = 'Expirada';
                                    } else {
                                        const totalSec = Math.floor(diffMs / 1000);
                                        const min = Math.floor(totalSec / 60);
                                        const sec = totalSec % 60;
                                        remainingLabel = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
                                    }
                                }

                                return (
                                    <div
                                        key={order.id}
                                        className="flex items-center justify-between px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/30"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between gap-2">
                                                <span className="text-white/80">
                                                    #{formatInvoiceNumber(order.invoice_number)}
                                                </span>
                                                <span className="text-orange-300 font-semibold">
                                                    {firesAmount.toFixed(0)} Fires
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-[10px] text-white/60 mt-0.5">
                                                <span>
                                                    {created
                                                        ? created.toLocaleString('es-VE', {
                                                              day: '2-digit',
                                                              month: 'short',
                                                              hour: '2-digit',
                                                              minute: '2-digit'
                                                          })
                                                        : ''}
                                                </span>
                                                {remainingLabel && <span>{remainingLabel}</span>}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                // Abrir directamente la factura si ya tiene número
                                                if (order.invoice_number != null) {
                                                    onSelectInvoice(order.invoice_number);
                                                    onClose();
                                                }
                                            }}
                                            className="ml-2 px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[10px]"
                                        >
                                            Ver
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {completedOrders.length > 0 && (
                    <table className="min-w-full text-[11px] align-middle">
                        <thead>
                            <tr className="text-white/60 border-b border-white/10">
                                <th className="py-1 pr-3 text-left">Factura #</th>
                                <th className="py-1 pr-3 text-left">Cliente</th>
                                <th className="py-1 pr-3 text-left">Vendedor</th>
                                <th className="py-1 pr-3 text-right">Total USDT</th>
                                <th className="py-1 pr-3 text-left">Fecha / hora</th>
                            </tr>
                        </thead>
                        <tbody>
                            {completedOrders.map((order) => {
                                const totalUsdt = Number(order.total_usdt || 0);
                                const sellerLabel =
                                    order.seller_display_name || order.seller_username || '-';

                                const canOpen = order.invoice_number != null;

                                return (
                                    <tr
                                        key={order.id}
                                        className={`border-b border-white/10 ${
                                            canOpen ? 'cursor-pointer hover:bg-white/5' : ''
                                        }`}
                                        onClick={() => {
                                            if (!canOpen) return;
                                            onSelectInvoice(order.invoice_number);
                                            onClose();
                                        }}
                                    >
                                        <td className="py-1 pr-3 text-white/80">
                                            {formatInvoiceNumber(order.invoice_number)}
                                        </td>
                                        <td className="py-1 pr-3 text-white/80">
                                            {order.customer_name || '-'}
                                        </td>
                                        <td className="py-1 pr-3 text-white/70">{sellerLabel}</td>
                                        <td className="py-1 pr-3 text-right text-white/80">
                                            {totalUsdt.toFixed(2)}
                                        </td>
                                        <td className="py-1 pr-3 text-white/60">
                                            {order.created_at
                                                ? new Date(order.created_at).toLocaleString()
                                                : '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

const QuoteModal = ({ products, rates, onClose }) => {
    const [search, setSearch] = useState('');
    const [categoryFilter] = useState('all');
    const [quoteItems, setQuoteItems] = useState([]);
    const containerRef = useRef(null);

    const filtered = products.filter((p) => {
        const term = search.trim().toLowerCase();
        const haystack = `${p.name || ''} ${p.description || ''} ${p.sku || ''}`.toLowerCase();
        const matchesSearch = term === '' || haystack.includes(term);
        const matchesCategory =
            categoryFilter === 'all' || String(p.category_id) === String(categoryFilter);
        return matchesSearch && matchesCategory;
    });

    const addToQuote = (product) => {
        setQuoteItems((prev) => {
            const existing = prev.find((item) => item.id === product.id);
            if (existing) {
                return prev.map((item) =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [
                ...prev,
                {
                    id: product.id,
                    name: product.name,
                    price_usdt: Number(product.price_usdt || 0),
                    quantity: 1
                }
            ];
        });
    };

    const changeQuoteQuantity = (productId, delta) => {
        setQuoteItems((prev) => {
            return prev
                .map((item) => {
                    if (item.id !== productId) return item;
                    const nextQty = Math.max(0, (Number(item.quantity) || 0) + delta);
                    return { ...item, quantity: nextQty };
                })
                .filter((item) => (Number(item.quantity) || 0) > 0);
        });
    };

    const totalQuoteUSDT = quoteItems.reduce((sum, item) => {
        const price = Number(item.price_usdt || 0);
        const qty = Number(item.quantity || 0);
        return sum + price * qty;
    }, 0);

    const totalQuoteBs = totalQuoteUSDT * rates.bs;

    const handlePrint = async () => {
        if (!containerRef.current) return;

        try {
            const element = containerRef.current;
            const canvas = await html2canvas(element, {
                backgroundColor: '#020617',
                scale: 2
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const renderWidth = imgWidth * ratio;
            const renderHeight = imgHeight * ratio;
            const x = (pdfWidth - renderWidth) / 2;
            const y = 10;

            pdf.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight);

            const totalBsNumberRaw = Number.isFinite(totalQuoteBs) ? Math.round(totalQuoteBs * 100) : 0;
            const totalBsNumber = Math.max(totalBsNumberRaw, 0);
            const fileSuffix = String(totalBsNumber);

            pdf.save(`cotizacion${fileSuffix}.pdf`);
        } catch (error) {
            console.error('Error generando PDF de cotización', error);
            toast.error('No se pudo generar el PDF de la cotización');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div
                ref={containerRef}
                className="w-full max-w-4xl bg-dark border border-white/10 rounded-2xl p-4 md:p-6 flex flex-col max-h-[90vh]"
            >
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg md:text-xl font-bold">Cotización rápida</h2>
                        <p className="text-[11px] text-white/60">Explora y arma una cotización sin afectar la orden actual.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-white/60 hover:text-white text-xs px-3 py-1 rounded-lg hover:bg-white/10"
                    >
                        Cerrar
                    </button>
                </div>

                <div className="mb-3 flex flex-col md:flex-row gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-white/40" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar producto para cotizar..."
                            className="w-full bg-white/5 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto mt-1 flex flex-col md:flex-row gap-3">
                    <div className="flex-1">
                        {filtered.length === 0 && (
                            <div className="text-center text-white/50 text-xs py-8">
                                Sin productos que coincidan con la búsqueda.
                            </div>
                        )}

                        {filtered.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                                {filtered.map((product) => {
                                    const priceUsdt = Number(product.price_usdt || 0);
                                    const priceBs = priceUsdt * rates.bs;

                                    return (
                                        <div
                                            key={product.id}
                                            className="bg-white/5 rounded-lg p-3 flex flex-col justify-between text-xs"
                                        >
                                            <div>
                                                <div className="font-semibold text-sm mb-1 line-clamp-2">{product.name}</div>
                                                {product.description && (
                                                    <div className="text-[10px] text-white/50 line-clamp-2">
                                                        {product.description}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="mt-2 space-y-0.5">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-white/60">Bolívares</span>
                                                    <span className="font-semibold">
                                                        {priceBs.toLocaleString('es-VE', {
                                                            style: 'currency',
                                                            currency: 'VES'
                                                        })}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-white/60">USDT</span>
                                                    <span className="font-bold text-accent">${priceUsdt.toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="mt-2 w-full py-1.5 rounded-lg bg-accent/90 text-dark text-[11px] font-semibold hover:bg-accent"
                                                onClick={() => addToQuote(product)}
                                            >
                                                Agregar a cotización
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="w-full md:w-72 lg:w-80 bg-white/5 rounded-xl p-3 flex flex-col justify-between text-xs sticky top-0 self-start">
                        <div>
                            <h3 className="text-sm font-semibold mb-2">Detalle de cotización</h3>
                            {quoteItems.length === 0 ? (
                                <p className="text-white/60 text-[11px]">No hay productos seleccionados.</p>
                            ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {quoteItems.map((item) => {
                                        const lineTotalUsdt = Number(item.price_usdt || 0) * Number(item.quantity || 0);
                                        const lineTotalBs = lineTotalUsdt * rates.bs;

                                        return (
                                            <div
                                                key={item.id}
                                                className="flex items-start justify-between gap-2 border-b border-white/10 pb-1"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold truncate">
                                                        {item.name}
                                                    </div>
                                                    <div className="text-[10px] text-white/60">
                                                        {lineTotalBs.toLocaleString('es-VE', {
                                                            style: 'currency',
                                                            currency: 'VES'
                                                        })}{' '}
                                                        ({lineTotalUsdt.toFixed(2)} USDT)
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => changeQuoteQuantity(item.id, -1)}
                                                            className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] hover:bg-white/20"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="min-w-[18px] text-center text-[11px]">
                                                            {item.quantity}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => changeQuoteQuantity(item.id, 1)}
                                                            className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] hover:bg-white/20"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="mt-3 pt-2 border-t border-white/10 space-y-1 text-[11px]">
                            <div className="flex justify-between">
                                <span>Total cotización (Bs)</span>
                                <span>
                                    {totalQuoteBs.toLocaleString('es-VE', {
                                        style: 'currency',
                                        currency: 'VES'
                                    })}
                                </span>
                            </div>
                            <div className="flex justify-between text-white/70">
                                <span>Total cotización (USDT)</span>
                                <span>{totalQuoteUSDT.toFixed(2)} USDT</span>
                            </div>
                            <button
                                type="button"
                                onClick={handlePrint}
                                disabled={quoteItems.length === 0}
                                className="mt-2 w-full py-2 rounded-lg bg-accent text-dark font-semibold text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Imprimir / PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const POSDraftInvoicesModal = ({ drafts, onClose, onLoadDraft, onClearAll }) => {
    const list = Array.isArray(drafts)
        ? [...drafts].sort((a, b) => {
            const aDate = a.created_at || '';
            const bDate = b.created_at || '';
            return bDate.localeCompare(aDate);
        })
        : [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-dark border border-white/10 rounded-2xl p-4 md:p-6 max-h-[80vh] overflow-y-auto text-xs">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h2 className="text-sm md:text-base font-semibold">Facturas en proceso</h2>
                        <p className="text-[11px] text-white/60">
                            Estas facturas solo se guardan en este dispositivo. Selecciona una para recuperarla.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[11px]"
                    >
                        Cerrar
                    </button>
                </div>

                {list.length === 0 && (
                    <p className="text-white/60 text-xs">No hay facturas en proceso guardadas.</p>
                )}

                {list.length > 0 && (
                    <table className="min-w-full text-[11px] align-middle">
                        <thead>
                            <tr className="text-white/60 border-b border-white/10">
                                <th className="py-1 pr-3 text-left">Cliente</th>
                                <th className="py-1 pr-3 text-left">Mesa</th>
                                <th className="py-1 pr-3 text-right">Items</th>
                                <th className="py-1 pr-3 text-right">Total aprox (USDT)</th>
                                <th className="py-1 pr-3 text-left">Creada</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.map((draft) => {
                                const items = Array.isArray(draft.cart) ? draft.cart : [];
                                const itemsCount = items.reduce(
                                    (sum, item) => sum + (Number(item.quantity) || 0),
                                    0
                                );
                                const totalUsdt = items.reduce(
                                    (sum, item) =>
                                        sum +
                                        (Number(item.price_usdt || 0) * (Number(item.quantity) || 0)),
                                    0
                                );

                                return (
                                    <tr
                                        key={draft.id}
                                        className="border-b border-white/10 cursor-pointer hover:bg-white/5"
                                        onClick={() => onLoadDraft(draft.id)}
                                    >
                                        <td className="py-1 pr-3 text-white/80">
                                            {draft.customerName || 'Sin nombre'}
                                        </td>
                                        <td className="py-1 pr-3 text-white/80">
                                            {draft.table_label || '-'}
                                        </td>
                                        <td className="py-1 pr-3 text-right text-white/80">{itemsCount}</td>
                                        <td className="py-1 pr-3 text-right text-white/80">
                                            {totalUsdt.toFixed(2)}
                                        </td>
                                        <td className="py-1 pr-3 text-white/60">
                                            {draft.created_at
                                                ? new Date(draft.created_at).toLocaleString()
                                                : '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}

                {list.length > 0 && (
                    <div className="mt-3 flex justify-end">
                        <button
                            type="button"
                            onClick={onClearAll}
                            className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-[11px] text-white/70"
                        >
                            Eliminar todas
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const NewCustomerModal = ({ storeId, isOpen, onClose, onCreated }) => {
    const [ciPrefix, setCiPrefix] = useState('V');
    const [ciNumber, setCiNumber] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleClose = () => {
        if (loading) return;
        setError('');
        setCiPrefix('V');
        setCiNumber('');
        setFullName('');
        setPhone('');
        setEmail('');
        onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const trimmedNumber = ciNumber.replace(/[^0-9]/g, '');
        if (!['V', 'E', 'J'].includes(ciPrefix)) {
            setError('Selecciona un tipo de documento válido (V/E/J).');
            return;
        }
        if (!trimmedNumber) {
            setError('Número de CI obligatorio.');
            return;
        }
        if (!fullName.trim()) {
            setError('El nombre completo es obligatorio.');
            return;
        }
        if (!phone.trim()) {
            setError('El teléfono es obligatorio.');
            return;
        }

        try {
            setLoading(true);
            const payload = {
                ci_prefix: ciPrefix,
                ci_number: trimmedNumber,
                full_name: fullName.trim(),
                phone: phone.trim(),
                email: email.trim() || null
            };

            const response = await axios.post(`/api/store/${storeId}/customers`, payload);
            if (onCreated) {
                onCreated(response.data);
            }
            toast.success('Cliente creado correctamente');
        } catch (err) {
            setError(err.response?.data?.error || 'Error al crear cliente');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-dark border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <UserPlus size={18} /> Nuevo cliente POS
                    </h2>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="text-white/60 hover:text-white text-sm px-2 py-1 rounded-lg hover:bg-white/10"
                    >
                        Cerrar
                    </button>
                </div>

                {error && (
                    <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3 text-xs">
                    <div className="flex gap-2">
                        <div className="w-20">
                            <label className="block mb-1 text-white/70">Tipo</label>
                            <select
                                value={ciPrefix}
                                onChange={(e) => setCiPrefix(e.target.value)}
                                className="w-full bg-white/5 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
                            >
                                <option value="V">V</option>
                                <option value="E">E</option>
                                <option value="J">J</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block mb-1 text-white/70">Número de CI</label>
                            <input
                                type="tel"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={ciNumber}
                                onChange={(e) => setCiNumber(e.target.value)}
                                className="w-full bg-white/5 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
                                placeholder="20827954"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block mb-1 text-white/70">Nombre completo</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full bg-white/5 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
                            placeholder="Nombre y apellido"
                        />
                    </div>

                    <div>
                        <label className="block mb-1 text-white/70">Teléfono</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-white/5 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
                            placeholder="Ej: +58 414 ..."
                        />
                    </div>

                    <div>
                        <label className="block mb-1 text-white/70">Correo (opcional)</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-white/5 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
                            placeholder="ana@correo.com"
                        />
                    </div>

                    <div className="pt-2 flex gap-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={loading}
                            className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2 rounded-lg bg-accent text-dark font-semibold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Guardando...' : 'Guardar cliente'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default POS;
