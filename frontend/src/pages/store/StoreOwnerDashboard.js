import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Save,
  Camera,
  MapPin,
  ExternalLink,
  Share2,
  TrendingUp,
  Users,
  ShoppingCart,
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowUp,
  ArrowDown,
  Star,
  Filter,
  Search,
  Calendar,
  Download,
  Upload,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  BarChart3,
  PieChart,
  DollarSign,
  Target,
  Zap,
  Award,
  Gift,
  Flame,
  Heart,
  MessageCircle,
  Settings,
  LogOut,
  Lock,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  Grid,
  List,
  ArrowRight,
  ArrowLeft,
  Menu,
  Bell,
  User,
  Mail,
  Phone,
  Globe,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Linkedin,
  Tiktok,
  Whatsapp,
  Telegram,
  Web,
  Store,
  CreditCard,
  Banknote,
  Coins,
  Receipt,
  FileText,
  Clipboard,
  CheckSquare,
  Square,
  Minus,
  PlusCircle,
  MinusCircle,
  Info,
  HelpCircle,
  AlertTriangle,
  Ban,
  Shield,
  Key,
  Database,
  Server,
  Cloud,
  Wifi,
  Battery,
  Signal,
  Volume2,
  VolumeX,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Repeat,
  Shuffle,
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  Maximize2,
  Minimize2,
  Move,
  Scissors,
  Crop,
  RotateCw,
  RotateCcw,
  FlipVertical,
  FlipHorizontal,
  Contrast,
  Brightness,
  Sun,
  Moon,
  Palette,
  Droplet,
  ShoppingBag,
  ListChecks,
  Megaphone
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { downloadQrForUrl } from '../../utils/qr';
import CameraButton from '../../components/CameraButton';
import { openMapWithAutoClose } from '../../utils/mapHelper';
import ColorPickerModal from '../../components/ColorPickerModal';

const MAX_PRODUCT_IMAGE_MB = 5;

const validProductImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('No se pudo convertir la imagen'));
      }
    };

    reader.onerror = () => {
      reject(reader.error || new Error('Error leyendo el archivo de imagen'));
    };

    reader.readAsDataURL(file);
  });
};

const validateImageSize = (file, maxSizeMB = MAX_PRODUCT_IMAGE_MB) => {
  const sizeMB = file.size / (1024 * 1024);
  return sizeMB <= maxSizeMB;
};

const validateImageType = (file) => {
  return validProductImageTypes.includes(file.type);
};

const processProductImageFile = async (file, maxSizeMB = MAX_PRODUCT_IMAGE_MB) => {
  if (!validateImageType(file)) {
    return {
      base64: '',
      error: 'Tipo de archivo no válido. Solo se permiten: JPG, PNG, WEBP, GIF'
    };
  }

  if (!validateImageSize(file, maxSizeMB)) {
    return {
      base64: '',
      error: `El archivo excede el tamaño máximo de ${maxSizeMB}MB`
    };
  }

  try {
    const base64 = await fileToBase64(file);
    return { base64 };
  } catch (error) {
    return {
      base64: '',
      error: 'Error al procesar la imagen'
    };
  }
};

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

const StoreOwnerDashboard = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('overview');
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingMode, setEditingMode] = useState('edit');
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState(false);
  const [isNewInvoiceModalOpen, setIsNewInvoiceModalOpen] = useState(false);
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isPurchaseDetailModalOpen, setIsPurchaseDetailModalOpen] = useState(false);
  const [selectedPurchaseDetail, setSelectedPurchaseDetail] = useState(null);
  const [isPurchaseDetailLoading, setIsPurchaseDetailLoading] = useState(false);
  const [isIngredientsModalOpen, setIsIngredientsModalOpen] = useState(false);
  const [isSupplierDetailModalOpen, setIsSupplierDetailModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const [isProductionRecipeModalOpen, setIsProductionRecipeModalOpen] = useState(false);
  const [editingProductionRecipe, setEditingProductionRecipe] = useState(null);
  const [selectedRecipeForBatch, setSelectedRecipeForBatch] = useState(null);
  const [isProductionCraftingModalOpen, setIsProductionCraftingModalOpen] = useState(false);
  const [craftingRecipe, setCraftingRecipe] = useState(null);

  const [headerLayout, setHeaderLayout] = useState('normal');
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [coverUrlInput, setCoverUrlInput] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationMapsUrl, setLocationMapsUrl] = useState('');
  const [locationPreview, setLocationPreview] = useState(null);
  const [tablesCountInput, setTablesCountInput] = useState('0');
  const [messagingEnabled, setMessagingEnabled] = useState(true);
  const [messagingNotifyRoles, setMessagingNotifyRoles] = useState(['owner', 'admin', 'marketing']);
  const [paymentMethodsConfig, setPaymentMethodsConfig] = useState({});
  const [settingsInitialized, setSettingsInitialized] = useState(false);
  const [marketingPlan, setMarketingPlan] = useState(null);
  const [marketingPlanDraft, setMarketingPlanDraft] = useState('');
  const [reportInterval, setReportInterval] = useState('day');
  const [reportTypeFilter, setReportTypeFilter] = useState('all');
  
  // Estado para el selector de color personalizado
  const [colorPickerModalOpen, setColorPickerModalOpen] = useState(false);
  const [currentModifierInput, setCurrentModifierInput] = useState({ groupId: null, optionId: null, value: '' });

  // Función para detectar #color y abrir el selector
  const handleModifierInputChange = (groupId, optionId, value) => {
    // Detectar si el usuario escribió "#color" exactamente
    if (value.trim() === '#color') {
      setCurrentModifierInput({ groupId, optionId, value: '' });
      setColorPickerModalOpen(true);
      return;
    }
    
    // Si no es #color, actualizar normalmente
    updateModifierOption(groupId, optionId, { name: value });
  };

  // Función para manejar la selección de color
  const handleColorSelect = (color) => {
    const { groupId, optionId } = currentModifierInput;
    if (groupId && optionId) {
      updateModifierOption(groupId, optionId, { name: color });
    }
    setCurrentModifierInput({ groupId: null, optionId: null, value: '' });
  };

  const updateModifierOption = (groupId, optionId, changes) => {
    setModifierGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              options: g.options.map((opt) =>
                opt.id === optionId ? { ...opt, ...changes } : opt
              )
            }
          : g
      )
    );
  };

  // Estados para modificadores (movidos desde ProductEditModal)
  const [modifierGroups, setModifierGroups] = useState([]);

  // Estado para filtros de pedidos activos
  const [orderColumnsFilter, setOrderColumnsFilter] = useState({
    actions: true,
    total: true,
    reference: true,
    type: true,
    created: true,
    status: false
  });

  const {
    data: storeData,
    isLoading,
    error
  } = useQuery({
    queryKey: ['store-owner', slug],
    queryFn: async () => {
      const response = await axios.get(`/api/store/public/${slug}`);
      return response.data;
    }
  });

  const store = storeData?.store;
  const categories = storeData?.categories || [];

  const {
    data: productsData,
    isLoading: loadingProducts,
    error: productsError
  } = useQuery({
    queryKey: ['store-products', store?.id],
    queryFn: async () => {
      if (!store?.id) return [];
      const response = await axios.get(`/api/store/${store.id}/products`);
      return response.data;
    },
    enabled: !!store?.id
  });

  const products = useMemo(
    () => (Array.isArray(productsData) ? productsData : []),
    [productsData]
  );

  const { user } = useAuth();

  // Sincronizar pestaña activa con query param ?tab= (overview, products, inventory, reports, marketing, settings)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    const allowedTabs = ['overview', 'products', 'inventory', 'reports', 'marketing', 'settings'];
    if (tabParam && allowedTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  useEffect(() => {
    if (!store || settingsInitialized) return;

    try {
      const rawSettings = store.settings || {};
      const rawLocation = store.location || {};
      const rawPaymentMethods =
        rawSettings.payment_methods && typeof rawSettings.payment_methods === 'object'
          ? rawSettings.payment_methods
          : {};

      const rawTablesCount =
        rawSettings.tables_count ?? rawSettings.tablesCount ?? 0;
      let normalizedTables = parseInt(rawTablesCount, 10);
      if (!Number.isFinite(normalizedTables) || normalizedTables < 0) {
        normalizedTables = 0;
      }

      const rawMessaging =
        rawSettings.messaging && typeof rawSettings.messaging === 'object'
          ? rawSettings.messaging
          : {};
      const rawMessagingEnabled =
        typeof rawMessaging.enabled === 'boolean' ? rawMessaging.enabled : true;
      const rawNotifyRoles = Array.isArray(rawMessaging.notify_roles)
        ? rawMessaging.notify_roles
        : ['owner', 'admin', 'marketing'];
      const normalizedNotifyRoles = rawNotifyRoles
        .map((r) => (typeof r === 'string' ? r.trim() : ''))
        .filter((r) => r.length > 0);

      setHeaderLayout(rawSettings.header_layout || 'normal');
      setLogoUrlInput(store.logo_url || '');
      setCoverUrlInput(store.cover_url || '');
      setLocationAddress(rawLocation.address || '');
      setLocationMapsUrl(
        rawLocation.maps_url || rawLocation.google_maps_url || ''
      );
      setTablesCountInput(String(normalizedTables));
      setMessagingEnabled(rawMessagingEnabled);
      setMessagingNotifyRoles(
        normalizedNotifyRoles.length > 0
          ? normalizedNotifyRoles
          : ['owner', 'admin', 'marketing']
      );
      const marketingRaw = rawSettings.marketing_plan ?? rawSettings.marketingPlan ?? null;
      setMarketingPlan(marketingRaw);
      if (typeof marketingRaw === 'string') {
        setMarketingPlanDraft(marketingRaw);
      } else if (marketingRaw != null) {
        try {
          setMarketingPlanDraft(JSON.stringify(marketingRaw, null, 2));
        } catch (e) {
          setMarketingPlanDraft(String(marketingRaw));
        }
      } else {
        setMarketingPlanDraft('');
      }

      const defaultPaymentMethods = {
        bs_transfer: {
          label: 'Pago mvil / Transferencia en Bs',
          instructions: ''
        },
        bs_cash: {
          label: 'Bs en efectivo',
          instructions: ''
        },
        usdt_tron: {
          label: 'USDT Tron',
          instructions: ''
        },
        cash_usdt: {
          label: 'Efectivo (USDT)',
          instructions: ''
        },
        fires: {
          label: 'Pago con Fuegos',
          instructions: ''
        }
      };

      const mergedConfig = {};
      Object.entries(defaultPaymentMethods).forEach(([key, def]) => {
        const existing =
          rawPaymentMethods[key] && typeof rawPaymentMethods[key] === 'object'
            ? rawPaymentMethods[key]
            : {};

        const labelSource =
          typeof existing.label === 'string' && existing.label.trim()
            ? existing.label.trim()
            : def.label;

        mergedConfig[key] = {
          label: labelSource,
          instructions:
            typeof existing.instructions === 'string'
              ? existing.instructions
              : ''
        };
      });

      setPaymentMethodsConfig(mergedConfig);
    } catch (e) {
      // noop
    }

    setSettingsInitialized(true);
  }, [store, settingsInitialized]);

  useEffect(() => {
    if (!locationMapsUrl || !locationMapsUrl.trim()) {
      setLocationPreview(null);
      return;
    }

    const urlStr = locationMapsUrl.trim();
    let lat = null;
    let lng = null;

    try {
      // Patron @lat,lng
      const atMatch = urlStr.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
      if (atMatch) {
        lat = parseFloat(atMatch[1]);
        lng = parseFloat(atMatch[2]);
      }

      // Patron q=lat,lng en querystring
      if (lat === null || !Number.isFinite(lat)) {
        const qMatch = urlStr.match(/[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
        if (qMatch) {
          lat = parseFloat(qMatch[1]);
          lng = parseFloat(qMatch[2]);
        }
      }

      // Patron !3dLAT!4dLNG (links generados por Google Maps)
      if (lat === null || !Number.isFinite(lat)) {
        const dMatch = urlStr.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
        if (dMatch) {
          lat = parseFloat(dMatch[1]);
          lng = parseFloat(dMatch[2]);
        }
      }
    } catch (e) {
      // Ignorar errores de parseo
    }

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setLocationPreview({ lat, lng });
    } else {
      setLocationPreview(null);
    }
  }, [locationMapsUrl]);

  const {
    data: suppliersData,
    isLoading: loadingSuppliers
  } = useQuery({
    queryKey: ['store-suppliers', store?.id],
    queryFn: async () => {
      if (!store?.id) return [];
      const response = await axios.get(`/api/store/${store.id}/suppliers`);
      return response.data;
    },
    enabled: !!store?.id
  });

  const {
    data: marketingConversationsData,
    isLoading: loadingMarketingConversations,
    error: marketingConversationsError
  } = useQuery({
    queryKey: ['store-marketing-conversations', store?.id],
    queryFn: async () => {
      if (!store?.id) return [];
      const response = await axios.get(`/api/store/messaging/${store.id}/conversations`, {
        params: { type: 'customer', status: 'open' }
      });
      return response.data?.conversations || [];
    },
    enabled: !!store?.id
  });

  const suppliers = Array.isArray(suppliersData) ? suppliersData : [];

  const {
    data: purchasesData,
    isLoading: loadingPurchases
  } = useQuery({
    queryKey: ['store-purchases', store?.id],
    queryFn: async () => {
      if (!store?.id) return [];
      const response = await axios.get(`/api/store/${store.id}/inventory/purchases`);
      return response.data;
    },
    enabled: !!store?.id
  });

  const purchases = Array.isArray(purchasesData) ? purchasesData : [];

  const handleOpenSupplierDetail = (supplier) => {
    if (!supplier) return;
    setSelectedSupplier(supplier);
    setIsSupplierDetailModalOpen(true);
  };

  const handleOpenPurchaseDetail = async (purchase) => {
    if (!store?.id || !purchase?.id) return;

    try {
      setIsPurchaseDetailLoading(true);
      setSelectedPurchaseDetail(null);
      setIsPurchaseDetailModalOpen(true);

      const response = await axios.get(
        `/api/store/${store.id}/inventory/purchases/${purchase.id}`
      );
      setSelectedPurchaseDetail(response.data);
    } catch (error) {
      const message =
        error?.response?.data?.error || 'No se pudo cargar la factura de compra';
      toast.error(message);
      setIsPurchaseDetailModalOpen(false);
      setSelectedPurchaseDetail(null);
    } finally {
      setIsPurchaseDetailLoading(false);
    }
  };

  const {
    data: ingredientsData,
    isLoading: loadingIngredients
  } = useQuery({
    queryKey: ['store-ingredients', store?.id],
    queryFn: async () => {
      if (!store?.id) return [];
      const response = await axios.get(`/api/store/inventory/${store.id}/ingredients`);
      return response.data;
    },
    enabled: !!store?.id
  });

  const ingredients = Array.isArray(ingredientsData) ? ingredientsData : [];

  const {
    data: productionRecipesData,
    isLoading: loadingProductionRecipes
  } = useQuery({
    queryKey: ['store-production-recipes', store?.id],
    queryFn: async () => {
      if (!store?.id) return [];
      const response = await axios.get(`/api/store/inventory/${store.id}/production/recipes`);
      return response.data;
    },
    enabled: !!store?.id
  });

  const productionRecipes = Array.isArray(productionRecipesData) ? productionRecipesData : [];

  const {
    data: productionBatchesData,
    isLoading: loadingProductionBatches
  } = useQuery({
    queryKey: ['store-production-batches', store?.id],
    queryFn: async () => {
      if (!store?.id) return [];
      const response = await axios.get(`/api/store/inventory/${store.id}/production/batches`);
      return response.data;
    },
    enabled: !!store?.id
  });

  const productionBatches = Array.isArray(productionBatchesData) ? productionBatchesData : [];

  const {
    data: fiatContext
  } = useQuery({
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
  const firesPerUsdt = fiatContext?.config?.fires_per_usdt || null;

  const queryClient = useQueryClient();

  const normalizedReportType = useMemo(
    () => (reportTypeFilter === 'all' ? null : reportTypeFilter),
    [reportTypeFilter]
  );

  const { data: salesKpiData, isLoading: loadingSalesKpi } = useQuery({
    queryKey: ['store-reports-kpi', store?.id, normalizedReportType],
    queryFn: async () => {
      if (!store?.id) return null;
      const params = {};
      if (normalizedReportType) {
        params.type = normalizedReportType;
      }
      const response = await axios.get(`/api/store/${store.id}/reports/kpi`, { params });
      return response.data;
    },
    enabled: !!store?.id
  });

  const { data: salesOverviewData, isLoading: loadingSalesOverview } = useQuery({
    queryKey: ['store-reports-overview', store?.id, reportInterval, normalizedReportType],
    queryFn: async () => {
      if (!store?.id) return null;
      const params = {
        interval: reportInterval || 'day'
      };
      if (normalizedReportType) {
        params.type = normalizedReportType;
      }
      const response = await axios.get(
        `/api/store/${store.id}/reports/sales/overview`,
        { params }
      );
      return response.data;
    },
    enabled: !!store?.id
  });

  const { data: salesBySellerData, isLoading: loadingSalesBySeller } = useQuery({
    queryKey: ['store-reports-by-seller', store?.id, normalizedReportType],
    queryFn: async () => {
      if (!store?.id) return null;
      const params = {};
      if (normalizedReportType) {
        params.type = normalizedReportType;
      }
      const response = await axios.get(
        `/api/store/${store.id}/reports/sales/by-seller`,
        { params }
      );
      return response.data;
    },
    enabled: !!store?.id
  });

  const { data: salesByProductData, isLoading: loadingSalesByProduct } = useQuery({
    queryKey: ['store-reports-by-product', store?.id, normalizedReportType],
    queryFn: async () => {
      if (!store?.id) return null;
      const params = {};
      if (normalizedReportType) {
        params.type = normalizedReportType;
      }
      const response = await axios.get(
        `/api/store/${store.id}/reports/sales/by-product`,
        { params }
      );
      return response.data;
    },
    enabled: !!store?.id
  });

  const { data: storeMetrics } = useQuery({
    queryKey: ['store-metrics', store?.id],
    queryFn: async () => {
      if (!store?.id) return null;
      const response = await axios.get(`/api/store/${store.id}/metrics`);
      return response.data;
    },
    enabled: !!store?.id
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ productId, data }) => {
      const response = await axios.patch(`/api/store/product/${productId}`, data);
      return response.data;
    },
    onSuccess: (updatedProduct) => {
      toast.success('Producto actualizado');
      queryClient.setQueryData(['store-products', store?.id], (previous) => {
        if (!Array.isArray(previous)) return previous;
        return previous.map((item) =>
          item && item.id === updatedProduct.id ? { ...updatedProduct } : item
        );
      });
    },
    onError: (error) => {
      const message = error?.response?.data?.error || 'Error al actualizar producto';
      toast.error(message);
    }
  });

  const createProductionRecipeMutation = useMutation({
    mutationFn: async (payload) => {
      if (!store?.id) {
        throw new Error('Tienda no cargada');
      }
      const response = await axios.post(
        `/api/store/inventory/${store.id}/production/recipes`,
        payload
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Receta de producción creada');
      queryClient.invalidateQueries(['store-production-recipes', store?.id]);
    },
    onError: (error) => {
      const message =
        error?.response?.data?.error || 'Error al crear receta de producción';
      toast.error(message);
    }
  });

  const updateProductionRecipeMutation = useMutation({
    mutationFn: async ({ recipeId, payload }) => {
      if (!store?.id) {
        throw new Error('Tienda no cargada');
      }
      const response = await axios.put(
        `/api/store/inventory/${store.id}/production/recipes/${recipeId}`,
        payload
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Receta de producción actualizada');
      queryClient.invalidateQueries(['store-production-recipes', store?.id]);
    },
    onError: (error) => {
      const message =
        error?.response?.data?.error || 'Error al actualizar receta de producción';
      toast.error(message);
    }
  });

  const deleteProductionRecipeMutation = useMutation({
    mutationFn: async (recipeId) => {
      if (!store?.id) {
        throw new Error('Tienda no cargada');
      }
      const response = await axios.delete(
        `/api/store/inventory/${store.id}/production/recipes/${recipeId}`
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Receta de producción desactivada');
      queryClient.invalidateQueries(['store-production-recipes', store?.id]);
    },
    onError: (error) => {
      const message =
        error?.response?.data?.error || 'Error al desactivar receta de producción';
      toast.error(message);
    }
  });

  const createProductionBatchMutation = useMutation({
    mutationFn: async ({ recipe_id, planned_quantity, notes }) => {
      if (!store?.id) {
        throw new Error('Tienda no cargada');
      }
      const response = await axios.post(
        `/api/store/inventory/${store.id}/production/batches`,
        { recipe_id, planned_quantity, notes }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['store-production-batches', store?.id]);
      queryClient.invalidateQueries(['store-owner', slug]);
    },
    onError: (error) => {
      const message =
        error?.response?.data?.error || 'Error al ejecutar lote de producción';
      toast.error(message);
    }
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (data) => {
      if (!store?.id) {
        throw new Error('Tienda no cargada');
      }
      const response = await axios.post(`/api/store/${store.id}/suppliers`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Proveedor creado');
      queryClient.invalidateQueries(['store-suppliers', store?.id]);
    },
    onError: (error) => {
      const message = error?.response?.data?.error || 'Error al crear proveedor';
      toast.error(message);
    }
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async ({ supplierId, data }) => {
      if (!store?.id) {
        throw new Error('Tienda no cargada');
      }
      const response = await axios.patch(
        `/api/store/${store.id}/suppliers/${supplierId}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Proveedor actualizado');
      queryClient.invalidateQueries(['store-suppliers', store?.id]);
    },
    onError: (error) => {
      const message = error?.response?.data?.error || 'Error al actualizar proveedor';
      toast.error(message);
    }
  });

  const createPurchaseMutation = useMutation({
    mutationFn: async (data) => {
      if (!store?.id) {
        throw new Error('Tienda no cargada');
      }
      const response = await axios.post(`/api/store/${store.id}/inventory/purchases`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Compra registrada');
      queryClient.invalidateQueries(['store-purchases', store?.id]);
      queryClient.invalidateQueries(['store-owner', slug]);
    },
    onError: (error) => {
      const message = error?.response?.data?.error || 'Error al registrar compra';
      toast.error(message);
    }
  });

  const createProductMutation = useMutation({
    mutationFn: async (data) => {
      if (!store?.id) {
        throw new Error('Tienda no cargada');
      }
      const response = await axios.post(`/api/store/${store.id}/product`, data);
      return response.data;
    },
    onSuccess: (createdProduct) => {
      toast.success('Producto creado');
      queryClient.setQueryData(['store-products', store?.id], (previous) => {
        if (!Array.isArray(previous)) {
          return Array.isArray(previous) ? previous : [createdProduct];
        }
        const exists = previous.some((item) => item && item.id === createdProduct.id);
        if (exists) {
          return previous.map((item) =>
            item && item.id === createdProduct.id ? { ...createdProduct } : item
          );
        }
        return [createdProduct, ...previous];
      });
    },
    onError: (error) => {
      const message = error?.response?.data?.error || 'Error al crear producto';
      toast.error(message);
    }
  });

  const duplicateProductMutation = useMutation({
    mutationFn: async (productId) => {
      const response = await axios.post(`/api/store/product/${productId}/duplicate`);
      return response.data;
    },
    onSuccess: (result) => {
      const duplicatedProduct = result?.product || result?.product?.product || result?.product;
      toast.success('Producto duplicado');
      if (duplicatedProduct) {
        queryClient.setQueryData(['store-products', store?.id], (previous) => {
          if (!Array.isArray(previous)) {
            return Array.isArray(previous) ? previous : [duplicatedProduct];
          }
          const exists = previous.some((item) => item && item.id === duplicatedProduct.id);
          if (exists) {
            return previous.map((item) =>
              item && item.id === duplicatedProduct.id ? { ...duplicatedProduct } : item
            );
          }
          return [duplicatedProduct, ...previous];
        });
      } else {
        queryClient.invalidateQueries(['store-products', store?.id]);
      }
    },
    onError: (error) => {
      const message = error?.response?.data?.error || 'Error al duplicar producto';
      toast.error(message);
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data) => {
      if (!store?.id) {
        throw new Error('Tienda no cargada');
      }
      const response = await axios.post(`/api/store/${store.id}/category`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Categor creada');
      queryClient.invalidateQueries(['store-owner', slug]);
    },
    onError: (error) => {
      const message = error?.response?.data?.error || 'Error al crear categor';
      toast.error(message);
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ categoryId, data }) => {
      if (!store?.id) {
        throw new Error('Tienda no cargada');
      }
      const response = await axios.patch(
        `/api/store/${store.id}/category/${categoryId}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Categoría actualizada');
      queryClient.invalidateQueries(['store-owner', slug]);
    },
    onError: (error) => {
      const message = error?.response?.data?.error || 'Error al actualizar categoría';
      toast.error(message);
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId) => {
      if (!store?.id) {
        throw new Error('Tienda no cargada');
      }
      const response = await axios.delete(
        `/api/store/${store.id}/category/${categoryId}`
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Categoría eliminada');
      queryClient.invalidateQueries(['store-owner', slug]);
    },
    onError: (error) => {
      const message = error?.response?.data?.error || 'Error al eliminar categoría';
      toast.error(message);
    }
  });

  const updateStoreSettingsMutation = useMutation({
    mutationFn: async (payload) => {
      if (!store?.id) {
        throw new Error('Tienda no cargada');
      }
      const response = await axios.patch(`/api/store/${store.id}/settings`, payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Configuracin de tienda actualizada');
      queryClient.invalidateQueries(['store-owner', slug]);
      queryClient.invalidateQueries(['store-metrics', store?.id]);
    },
    onError: (error) => {
      const message = error?.response?.data?.error || 'Error al actualizar configuracin de tienda';
      toast.error(message);
    }
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }) => {
      const response = await axios.post(`/api/store/order/${orderId}/status`, { status });
      return response.data;
    },
    onSuccess: (_data, variables) => {
      const status = variables?.status;
      if (status === 'cancelled') {
        toast.success('Pedido rechazado');
      } else if (status === 'confirmed') {
        toast.success('Pedido aceptado');
      } else {
        toast.success('Estado de pedido actualizado');
      }
      if (store?.id) {
        queryClient.invalidateQueries(['store-active-orders', store.id]);
        queryClient.invalidateQueries(['store-orders-history', store.id]);
      }
    },
    onError: (error) => {
      const message = error?.response?.data?.error || 'Error al actualizar estado del pedido';
      toast.error(message);
    }
  });

  const {
    data: activeOrders,
    isLoading: loadingOrders
  } = useQuery({
    queryKey: ['store-active-orders', store?.id],
    queryFn: async () => {
      const response = await axios.get(`/api/store/order/${store.id}/orders/active`);
      return response.data;
    },
    enabled: !!store?.id
  });

  const {
    data: ordersHistoryData,
    isLoading: loadingOrdersHistory
  } = useQuery({
    queryKey: ['store-orders-history', store?.id],
    queryFn: async () => {
      if (!store?.id) return [];
      const response = await axios.get(`/api/store/order/${store.id}/orders/history`, {
        params: { limit: 100, offset: 0 }
      });
      return response.data;
    },
    enabled: !!store?.id
  });

  if (isLoading) {
    return <div className="p-6 text-sm">Cargando panel de tienda...</div>;
  }

  if (error || !store) {
    return <div className="p-6 text-sm">No se pudo cargar la información de la tienda.</div>;
  }

  const orders = Array.isArray(activeOrders) ? activeOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) : [];
  const ordersHistory = Array.isArray(ordersHistoryData) ? ordersHistoryData : [];
  const marketingConversations = Array.isArray(marketingConversationsData)
    ? marketingConversationsData
    : [];
  const salesKpi = salesKpiData || null;
  const salesOverview = salesOverviewData || null;
  const salesBySeller = Array.isArray(salesBySellerData?.sellers)
    ? salesBySellerData.sellers
    : [];
  const salesByProduct = Array.isArray(salesByProductData?.products)
    ? salesByProductData.products
    : [];
  const salesOverviewSeries = Array.isArray(salesOverview?.series)
    ? salesOverview.series
    : [];
  const anyReportsLoading =
    loadingSalesKpi || loadingSalesOverview || loadingSalesBySeller || loadingSalesByProduct;

  const currencyConfigLabel = (() => {
    const cfg = store?.currency_config;

    if (!cfg) return 'coins';

    if (typeof cfg === 'string') return cfg;

    try {
      const base = cfg.base || 'coins';
      const accepted = Array.isArray(cfg.accepted) ? cfg.accepted.join(', ') : null;
      if (accepted) {
        return `${base} (${accepted})`;
      }
      return String(base);
    } catch (e) {
      return 'coins';
    }
  })();

  const normalizedSearch = productSearch.trim().toLowerCase();
  const filteredProducts = products
    .filter((product) => {
      if (
        productCategoryFilter !== 'all' &&
        String(product.category_id) !== String(productCategoryFilter)
      ) {
        return false;
      }

      if (!normalizedSearch) return true;

      const haystack = `${product.name || ''} ${product.description || ''} ${product.sku || ''}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    })
    .sort((a, b) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      return aName.localeCompare(bName);
    });

  const tabs = [
    { id: 'overview', label: 'Resumen', icon: BarChart3 },
    { id: 'products', label: 'Productos', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventario', icon: ListChecks },
    { id: 'reports', label: 'Pedidos / Informes', icon: ListChecks },
    { id: 'marketing', label: 'Marketing', icon: Megaphone },
    { id: 'settings', label: 'Configuración', icon: Settings }
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="hidden md:inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-glass hover:bg-glass-hover text-text/70"
        >
          <ArrowLeft size={14} />
          Volver
        </button>
        <div className="flex-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-glass flex items-center justify-center text-sm font-semibold">
            {store.name?.charAt(0)?.toUpperCase() || 'T'}
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-text">{store.name}</h1>
            <p className="text-xs text-text/60">@{store.slug} • Panel de tienda</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-xs">
          <button
            type="button"
            onClick={() => navigate(`/store/${store.slug}`)}
            className="px-3 py-1 rounded-full bg-glass hover:bg-glass-hover flex items-center gap-1"
          >
            <ExternalLink size={14} />
            Ver tienda pública
          </button>
          <button
            type="button"
            onClick={() => navigate(`/store/${store.slug}/pos`)}
            className="px-3 py-1 rounded-full bg-accent/20 text-accent hover:bg-accent/30"
          >
            Ir al POS
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar border-b border-glass pb-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === id
                ? 'bg-accent text-background-dark'
                : 'bg-glass text-text/70 hover:text-text'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-glass p-4">
            <p className="text-xs text-text/60 mb-1">Categorías activas</p>
            <p className="text-2xl font-bold text-accent">{categories.length}</p>
          </div>
          <div className="card-glass p-4">
            <p className="text-xs text-text/60 mb-1">Productos en menú</p>
            <p className="text-2xl font-bold text-emerald-400">{products.length}</p>
          </div>
          <div className="card-glass p-4">
            <p className="text-xs text-text/60 mb-1">Configuración de moneda</p>
            <p className="text-sm font-semibold text-text/90">{currencyConfigLabel}</p>
          </div>
        </div>
      )}
      {isNewCategoryModalOpen && (
        <NewCategoryModal
          onClose={() => setIsNewCategoryModalOpen(false)}
          onSave={async (data) => {
            await createCategoryMutation.mutateAsync(data);
            setIsNewCategoryModalOpen(false);
          }}
          loading={createCategoryMutation.isLoading}
        />
      )}

      {activeTab === 'inventory' && (
        <div className="card-glass p-4 space-y-4 overflow-x-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Inventario</h2>
              <p className="text-[11px] text-text/60">
                Gestiona proveedores y facturas de compra para mantener actualizado tu stock.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsCategoryManagerOpen(true)}
                className="px-3 py-1.5 rounded-full bg-glass hover:bg-glass-hover whitespace-nowrap"
              >
                Categorías
              </button>
              <button
                type="button"
                onClick={() => setIsNewSupplierModalOpen(true)}
                className="px-3 py-1.5 rounded-full bg-glass hover:bg-glass-hover whitespace-nowrap"
              >
                Nuevo proveedor
              </button>
              <button
                type="button"
                onClick={() => setIsNewInvoiceModalOpen(true)}
                className="px-3 py-1.5 rounded-full bg-accent/20 text-accent hover:bg-accent/30 whitespace-nowrap"
              >
                Nueva factura de compra
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!store) return;
                  setEditingMode('create');
                  setEditingProduct({
                    id: 'new',
                    name: '',
                    description: '',
                    category_id: '',
                    sku: '',
                    price_usdt: '',
                    price_fires: '',
                    is_menu_item: true,
                    has_modifiers: false,
                    accepts_fires: false,
                    image_url: '',
                    stock: 0
                  });
                }}
                className="px-3 py-1.5 rounded-full bg-accent/20 text-accent hover:bg-accent/30 whitespace-nowrap"
              >
                + Nuevo producto
              </button>
            </div>
          </div>

          {(loadingSuppliers || loadingPurchases || loadingIngredients) && (
            <p className="text-xs text-text/60">Cargando inventario...</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-text/80">Proveedores</h3>
                <span className="text-[11px] text-text/50">{suppliers.length} registrado(s)</span>
              </div>
              {suppliers.length === 0 ? (
                <p className="text-[11px] text-text/60">Aún no tienes proveedores registrados.</p>
              ) : (
                <table className="min-w-full text-[11px] align-middle">
                  <thead>
                    <tr className="text-text/60 border-b border-glass">
                      <th className="py-1 pr-3 text-left">Nombre</th>
                      <th className="py-1 pr-3 text-left">Contacto</th>
                      <th className="py-1 pr-3 text-left">Teléfono</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-glass/40 hover:bg-glass cursor-pointer"
                        onClick={() => handleOpenSupplierDetail(s)}
                      >
                        <td className="py-1 pr-3 text-text/80">{s.name}</td>
                        <td className="py-1 pr-3 text-text/70">{s.contact_name || '-'}</td>
                        <td className="py-1 pr-3 text-text/60">{s.phone || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-text/80">Facturas de compra</h3>
                <span className="text-[11px] text-text/50">{purchases.length} registrada(s)</span>
              </div>
              {purchases.length === 0 ? (
                <p className="text-[11px] text-text/60">Aún no has registrado facturas de compra.</p>
              ) : (
                <table className="min-w-full text-[11px] align-middle">
                  <thead>
                    <tr className="text-text/60 border-b border-glass">
                      <th className="py-1 pr-3 text-left">Fecha</th>
                      <th className="py-1 pr-3 text-left">Proveedor</th>
                      <th className="py-1 pr-3 text-left">Nº factura</th>
                      <th className="py-1 pr-3 text-right">Total USDT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-glass/40 hover:bg-glass cursor-pointer"
                        onClick={() => handleOpenPurchaseDetail(p)}
                      >
                        <td className="py-1 pr-3 text-text/70">
                          {p.invoice_date || (p.created_at ? new Date(p.created_at).toLocaleDateString() : '-')}
                        </td>
                        <td className="py-1 pr-3 text-text/80">{p.supplier_name || 'Sin proveedor'}</td>
                        <td className="py-1 pr-3 text-text/70">{p.invoice_number || '-'}</td>
                        <td className="py-1 pr-3 text-right text-text/80">
                          {Number(p.total_cost_usdt || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="border-t border-glass mt-4 pt-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold text-text/80">Recetas de producción</h3>
                <p className="text-[11px] text-text/60">
                  Define fórmulas de producción usando ingredientes y productos compuestos. El costo se calcula
                  automáticamente con base en el costo de cada componente.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsIngredientsModalOpen(true)}
                  className="px-3 py-1.5 rounded-full bg-glass hover:bg-glass-hover whitespace-nowrap"
                >
                  Artículos / ingredientes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProductionRecipe(null);
                    setIsProductionRecipeModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-full bg-accent/20 text-accent hover:bg-accent/30 whitespace-nowrap"
                >
                  + Nueva receta de producción
                </button>
              </div>
            </div>

            {loadingProductionRecipes ? (
              <p className="text-xs text-text/60">Cargando recetas de producción...</p>
            ) : productionRecipes.length === 0 ? (
              <p className="text-[11px] text-text/60">
                Aún no has configurado recetas de producción. Crea tu primera receta para calcular el costo real de
                salsas, bases y productos compuestos.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-[11px] align-middle">
                  <thead>
                    <tr className="text-text/60 border-b border-glass">
                      <th className="py-1 pr-3 text-left">Receta</th>
                      <th className="py-1 pr-3 text-left">Producto destino</th>
                      <th className="py-1 pr-3 text-right">Rendimiento</th>
                      <th className="py-1 pr-3 text-right">Costo total USDT</th>
                      <th className="py-1 pr-3 text-right">Costo unitario</th>
                      <th className="py-1 pr-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productionRecipes.map((r) => {
                      const qty = Number(r.yields_quantity || 0);
                      const totalCost = Number(r.total_cost_usdt || 0);
                      const costPerUnit = qty > 0 ? totalCost / qty : 0;

                      return (
                        <tr key={r.id} className="border-b border-glass/40">
                          <td className="py-1 pr-3 text-text/80">{r.name}</td>
                          <td className="py-1 pr-3 text-text/70">{r.target_product_name || 'Sin producto asociado'}</td>
                          <td className="py-1 pr-3 text-right text-text/70">
                            <div>
                              {qty.toFixed(2)} {r.yields_unit}
                            </div>
                            {(() => {
                              const meta =
                                r && typeof r.metadata === 'object' && r.metadata !== null
                                  ? r.metadata
                                  : {};
                              const baseQty = Number(meta.base_input_quantity || 0);
                              const baseUnit = meta.base_input_unit || null;
                              if (!Number.isFinite(baseQty) || baseQty <= 0 || !baseUnit) {
                                return null;
                              }
                              const ratio = qty > 0 ? qty / baseQty : 0;
                              return (
                                <div className="text-[10px] text-text/60">
                                  desde {baseQty.toFixed(2)} {baseUnit} (
                                  {ratio.toFixed(4)} {r.yields_unit}/{baseUnit})
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-1 pr-3 text-right text-text/80">{totalCost.toFixed(4)}</td>
                          <td className="py-1 pr-3 text-right text-text/80">{costPerUnit.toFixed(4)}</td>
                          <td className="py-1 pr-3 text-right text-text/70 space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProductionRecipe(r);
                                setIsProductionRecipeModalOpen(true);
                              }}
                              className="px-2 py-0.5 rounded-full bg-glass hover:bg-glass-hover"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCraftingRecipe(r);
                                setIsProductionCraftingModalOpen(true);
                              }}
                              className="px-2 py-0.5 rounded-full bg-accent/10 text-accent hover:bg-accent/20 text-[10px]"
                            >
                              Craftear
                            </button>
                            <button
                              type="button"
                              disabled={productionRecipes.length === 0}
                              onClick={async () => {
                                const confirmed = window.confirm(
                                  `¿Desactivar la receta "${r.name}"? Puedes volver a crearla más adelante.`
                                );
                                if (!confirmed) return;
                                try {
                                  await deleteProductionRecipeMutation.mutateAsync(r.id);
                                  queryClient.invalidateQueries(['store-production-recipes', store?.id]);
                                } catch (err) {
                                  const message =
                                    err?.response?.data?.error || 'Error al desactivar receta de producción';
                                  toast.error(message);
                                }
                              }}
                              className="px-2 py-0.5 rounded-full bg-error/20 text-error hover:bg-error/30 text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Desactivar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-text/80">Lotes de producción</h3>
                  <p className="text-[11px] text-text/60">
                    Ejecuta lotes de producción para descontar insumos del inventario y aumentar el stock del producto
                    final.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs items-end">
                  <div>
                    <div className="text-[11px] text-text/60 mb-0.5">Receta</div>
                    <select
                      value={selectedRecipeForBatch?.id || ''}
                      onChange={(e) => {
                        const recipeId = e.target.value;
                        const found = productionRecipes.find((r) => String(r.id) === String(recipeId));
                        setSelectedRecipeForBatch(found || null);
                      }}
                      className="input-glass text-[11px] px-2 py-1 min-w-[180px]"
                    >
                      <option value="">Selecciona receta</option>
                      {productionRecipes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-[11px] text-text/60 mb-0.5">Cantidad a producir</div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input-glass text-[11px] px-2 py-1 w-28"
                      value={selectedRecipeForBatch?.__plannedQty || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedRecipeForBatch((prev) =>
                          prev ? { ...prev, __plannedQty: value } : prev
                        );
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={
                      !selectedRecipeForBatch ||
                      !selectedRecipeForBatch.__plannedQty ||
                      Number(selectedRecipeForBatch.__plannedQty) <= 0
                    }
                    onClick={async () => {
                      if (!store?.id || !selectedRecipeForBatch) return;
                      const qty = Number(selectedRecipeForBatch.__plannedQty || 0);
                      if (!Number.isFinite(qty) || qty <= 0) {
                        toast.error('Cantidad de lote inválida');
                        return;
                      }
                      try {
                        await createProductionBatchMutation.mutateAsync({
                          recipe_id: selectedRecipeForBatch.id,
                          planned_quantity: qty,
                          notes: null
                        });
                        toast.success('Lote de producción ejecutado');
                        queryClient.invalidateQueries(['store-production-batches', store?.id]);
                        setSelectedRecipeForBatch((prev) => (prev ? { ...prev, __plannedQty: '' } : prev));
                      } catch (err) {
                        const message =
                          err?.response?.data?.error || 'Error al ejecutar lote de producción';
                        toast.error(message);
                      }
                    }}
                    className="px-3 py-1.5 rounded-full bg-accent/20 text-accent hover:bg-accent/30 text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Ejecutar lote
                  </button>
                </div>
              </div>

              {loadingProductionBatches ? (
                <p className="text-xs text-text/60">Cargando lotes de producción...</p>
              ) : productionBatches.length === 0 ? (
                <p className="text-[11px] text-text/60">
                  Aún no has ejecutado lotes de producción. Cuando ejecutes uno, verás aquí el historial.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-[11px] align-middle">
                    <thead>
                      <tr className="text-text/60 border-b border-glass">
                        <th className="py-1 pr-3 text-left">Fecha</th>
                        <th className="py-1 pr-3 text-left">Receta</th>
                        <th className="py-1 pr-3 text-left">Producto destino</th>
                        <th className="py-1 pr-3 text-right">Cantidad</th>
                        <th className="py-1 pr-3 text-right">Costo total USDT</th>
                        <th className="py-1 pr-3 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productionBatches.map((b) => {
                        const totalCost = Number(b.total_cost_usdt || 0);
                        const createdAt = b.completed_at || b.started_at || b.created_at;
                        return (
                          <tr key={b.id} className="border-b border-glass/40">
                            <td className="py-1 pr-3 text-text/70">
                              {createdAt ? new Date(createdAt).toLocaleString() : '-'}
                            </td>
                            <td className="py-1 pr-3 text-text/80">{b.recipe_name || '-'}</td>
                            <td className="py-1 pr-3 text-text/70">{b.target_product_name || 'N/A'}</td>
                            <td className="py-1 pr-3 text-right text-text/80">
                              {Number(b.actual_quantity || b.planned_quantity || 0).toFixed(2)} {b.unit}
                            </td>
                            <td className="py-1 pr-3 text-right text-text/80">{totalCost.toFixed(4)}</td>
                            <td className="py-1 pr-3 text-right text-text/70">{b.status}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="card-glass p-4 overflow-x-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold">Productos</h2>
              <p className="text-[11px] text-text/60">
                Vista consolidada de todos los productos activos que ve el cliente en tu menú.
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-2 text-xs w-full md:w-auto">
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="input-glass px-3 py-1.5 text-xs w-full md:w-56"
                placeholder="Buscar por nombre o descripción"
              />
              <select
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
                className="input-glass px-3 py-1.5 text-xs w-full md:w-44"
              >
                <option value="all">Todas las categorías</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!store) return;
                  setEditingMode('create');
                  setEditingProduct({
                    id: 'new',
                    name: '',
                    description: '',
                    category_id: '',
                    sku: '',
                    price_usdt: '',
                    price_fires: '',
                    is_menu_item: true,
                    has_modifiers: false,
                    accepts_fires: false,
                    image_url: '',
                    stock: 0
                  });
                }}
                className="px-3 py-1.5 rounded-full bg-accent/20 text-accent hover:bg-accent/30 whitespace-nowrap"
              >
                + Nuevo producto
              </button>
            </div>
          </div>

          {products.length === 0 ? (
            <p className="text-xs text-text/60">Aún no tienes productos configurados.</p>
          ) : filteredProducts.length === 0 ? (
            <p className="text-xs text-text/60">No se encontraron productos con los filtros aplicados.</p>
          ) : (
            <>
              <p className="text-[11px] text-text/50 mb-2">
                Mostrando {filteredProducts.length} de {products.length} producto(s).
              </p>
              <table className="min-w-full text-xs align-middle">
                <thead>
                  <tr className="text-text/60 border-b border-glass">
                    <th className="py-1 pr-3 text-left">Acciones</th>
                    <th className="py-1 pr-3 text-left">Imagen</th>
                    <th className="py-1 pr-3 text-left">SKU</th>
                    <th className="py-1 pr-3 text-left">Nombre</th>
                    <th className="py-1 pr-3 text-left">Categoría</th>
                    <th className="py-1 pr-3 text-right">USDT / Bs</th>
                    <th className="py-1 pr-3 text-right">Fires / USDT / Bs</th>
                    <th className="py-1 pr-3 text-left">Modificadores</th>
                    <th className="py-1 pr-3 text-right">Stock</th>
                    <th className="py-1 pl-3 text-center">Acepta Fires</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const cat = categories.find((c) => c.id === product.category_id);
                    const modifiers = Array.isArray(product.modifiers) ? product.modifiers : [];
                    const priceUsdtNumber = Number(product.price_usdt || 0);
                    const priceFiresNumber = Number(product.price_fires || 0);

                    const hasVesRate =
                      typeof vesPerUsdt === 'number' && Number.isFinite(vesPerUsdt) && vesPerUsdt > 0;
                    const hasFiresRate =
                      typeof firesPerUsdt === 'number' &&
                      Number.isFinite(firesPerUsdt) &&
                      firesPerUsdt > 0;

                    const vesFromUsdt =
                      hasVesRate && Number.isFinite(priceUsdtNumber)
                        ? priceUsdtNumber * vesPerUsdt
                        : null;

                    let usdtFromFires = null;
                    let vesFromFires = null;
                    if (hasFiresRate && Number.isFinite(priceFiresNumber) && priceFiresNumber > 0) {
                      usdtFromFires = priceFiresNumber / firesPerUsdt;
                      if (hasVesRate && Number.isFinite(usdtFromFires)) {
                        vesFromFires = usdtFromFires * vesPerUsdt;
                      }
                    }

                    const modifierGroupsMap = new Map();
                    for (const mod of modifiers) {
                      if (!mod || !mod.group_name) continue;
                      const groupName = mod.group_name;
                      modifierGroupsMap.set(groupName, (modifierGroupsMap.get(groupName) || 0) + 1);
                    }
                    const modifierGroups = Array.from(modifierGroupsMap.entries());

                    const thumbnailSrc =
                      product.image_url ||
                      store.logo_url ||
                      'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=400&auto=format&fit=crop';

                    return (
                      <tr key={product.id} className="border-b border-glass/40">
                        <td className="py-1 pr-3 text-left text-text/70 space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMode('edit');
                              setEditingProduct(product);
                            }}
                            className="inline-flex items-center px-2 py-0.5 rounded-full bg-glass hover:bg-glass-hover"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateProductMutation.mutate(product.id)}
                            disabled={duplicateProductMutation.isLoading}
                            className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {duplicateProductMutation.isLoading ? 'Duplicando…' : 'Duplicar'}
                          </button>
                        </td>
                        <td className="py-1 pr-3">
                          {thumbnailSrc ? (
                            <img
                              src={thumbnailSrc}
                              alt={product.name}
                              className="w-10 h-10 rounded-md object-cover border border-glass"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-glass flex items-center justify-center text-[9px] text-text/50">
                              Sin foto
                            </div>
                          )}
                        </td>
                        <td className="py-1 pr-3 text-text/70">{product.sku || '-'}</td>
                        <td className="py-1 pr-3 text-text/80">{product.name}</td>
                        <td className="py-1 pr-3 text-text/60">{cat?.name || '-'}</td>
                        <td className="py-1 pr-3 text-right text-text/80">
                          <div>{priceUsdtNumber.toFixed(2)} USDT</div>
                          {vesFromUsdt != null && (
                            <div className="text-[10px] text-text/60">
                              {vesFromUsdt.toLocaleString('es-VE', {
                                style: 'currency',
                                currency: 'VES'
                              })}
                            </div>
                          )}
                        </td>
                        <td className="py-1 pr-3 text-right text-text/80">
                          {priceFiresNumber > 0 ? (
                            <>
                              <div>{priceFiresNumber.toFixed(2)} Fires</div>
                              {usdtFromFires != null && (
                                <div className="text-[10px] text-text/60">
                                  ≈ {usdtFromFires.toFixed(2)} USDT
                                  {vesFromFires != null && (
                                    <>
                                      {' '}
                                      {vesFromFires.toLocaleString('es-VE', {
                                        style: 'currency',
                                        currency: 'VES'
                                      })}
                                    </>
                                  )}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-text/50">-</span>
                          )}
                        </td>
                        <td className="py-1 pr-3 text-left text-text/70">
                          {modifierGroups.length === 0 ? (
                            <span className="text-text/60">Sin modificadores</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {modifierGroups.map(([groupName, count]) => (
                                <span
                                  key={groupName}
                                  className="px-2 py-0.5 rounded-full bg-glass text-[10px] text-text/80"
                                >
                                  {groupName} ({count})
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-1 pr-3 text-right text-text/80">
                          {product.stock != null ? Number(product.stock).toString() : '0'}
                        </td>
                        <td className="py-1 pl-3 text-center text-text/70">
                          <input
                            type="checkbox"
                            checked={!!product.accepts_fires}
                            onChange={(e) =>
                              updateProductMutation.mutate({
                                productId: product.id,
                                data: { accepts_fires: e.target.checked }
                              })
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="card-glass p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text/90">Panel de informes de ventas</h2>
                <p className="text-[11px] text-text/60">
                  Ventas completadas agrupadas por periodo, tipo de pedido, vendedor y producto.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <select
                  value={reportInterval}
                  onChange={(e) => setReportInterval(e.target.value)}
                  className="input-glass px-2 py-1 text-[11px]"
                >
                  <option value="day">Diario (por día)</option>
                  <option value="week">Semanal</option>
                  <option value="quincena">Quincenal</option>
                  <option value="month">Mensual</option>
                </select>
                <select
                  value={reportTypeFilter}
                  onChange={(e) => setReportTypeFilter(e.target.value)}
                  className="input-glass px-2 py-1 text-[11px]"
                >
                  <option value="all">Todos los tipos</option>
                  <option value="dine_in">En salón</option>
                  <option value="pickup">Para llevar</option>
                  <option value="delivery">Delivery</option>
                </select>
              </div>
            </div>

            {anyReportsLoading && (
              <p className="text-[11px] text-text/60">Cargando informes de ventas...</p>
            )}

            {salesKpi ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="card-glass p-3 bg-black/20">
                  <p className="text-[11px] text-text/60 mb-1">Ventas completadas (USDT)</p>
                  <p className="text-xl font-bold text-emerald-400">
                    {Number(salesKpi.totals?.total_sales_usdt || 0).toFixed(2)}
                  </p>
                </div>
                <div className="card-glass p-3 bg-black/20">
                  <p className="text-[11px] text-text/60 mb-1">Tickets completados / cancelados</p>
                  <p className="text-xl font-bold text-text/90">
                    {Number(salesKpi.totals?.order_count_completed || 0)}{' '}
                    <span className="text-[11px] text-text/60">
                      {' '}
                      · {Number(salesKpi.totals?.order_count_cancelled || 0)} cancelados
                    </span>
                  </p>
                </div>
                <div className="card-glass p-3 bg-black/20">
                  <p className="text-[11px] text-text/60 mb-1">Ticket promedio / tasa de cierre</p>
                  <p className="text-xl font-bold text-text/90">
                    {Number(salesKpi.totals?.avg_ticket_usdt || 0).toFixed(2)} USDT
                  </p>
                  <p className="text-[11px] text-text/60">
                    {Math.round(
                      (Number(salesKpi.totals?.completion_rate || 0) || 0) * 100
                    )}
                    % completados
                  </p>
                  <p className="text-[11px] text-text/60">
                    Comisión: {Number(salesKpi.totals?.commission_usdt || 0).toFixed(2)} USDT
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-text/60">
                No hay ventas completadas en el rango seleccionado.
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-text/80">Resumen por periodo</h3>
                  <span className="text-[11px] text-text/60">
                    {salesOverviewSeries.length} fila(s)
                  </span>
                </div>
                {salesOverviewSeries.length === 0 ? (
                  <p className="text-[11px] text-text/60">
                    No hay ventas registradas para este rango e intervalo.
                  </p>
                ) : (
                  <table className="min-w-full text-[11px] align-middle">
                    <thead>
                      <tr className="text-text/60 border-b border-glass">
                        <th className="py-1 pr-3 text-left">Periodo</th>
                        <th className="py-1 pr-3 text-right">Tickets</th>
                        <th className="py-1 pr-3 text-right">Total USDT</th>
                        <th className="py-1 pr-3 text-right">Comisión USDT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesOverviewSeries.map((row, idx) => {
                        const label = row.bucket
                          ? new Date(row.bucket).toLocaleDateString()
                          : `#${idx + 1}`;
                        return (
                          <tr key={idx} className="border-b border-glass/40">
                            <td className="py-1 pr-3 text-text/80">{label}</td>
                            <td className="py-1 pr-3 text-right text-text/80">
                              {Number(row.order_count || 0)}
                            </td>
                            <td className="py-1 pr-3 text-right text-text/80">
                              {Number(row.total_usdt || 0).toFixed(2)}
                            </td>
                            <td className="py-1 pr-3 text-right text-text/80">
                              {Number(row.commission_usdt || 0).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-text/80">Top productos</h3>
                  <span className="text-[11px] text-text/60">
                    {salesByProduct.length} producto(s)
                  </span>
                </div>
                {salesByProduct.length === 0 ? (
                  <p className="text-[11px] text-text/60">
                    No hay productos con ventas registradas en este rango.
                  </p>
                ) : (
                  <table className="min-w-full text-[11px] align-middle">
                    <thead>
                      <tr className="text-text/60 border-b border-glass">
                        <th className="py-1 pr-3 text-left">Producto</th>
                        <th className="py-1 pr-3 text-right">Unidades</th>
                        <th className="py-1 pr-3 text-right">Ventas USDT</th>
                        <th className="py-1 pr-3 text-right">Margen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesByProduct.slice(0, 20).map((p) => (
                        <tr
                          key={p.product_id || p.product_name}
                          className="border-b border-glass/40"
                        >
                          <td className="py-1 pr-3 text-text/80">
                            {p.product_name || p.product_sku || '-'}
                          </td>
                          <td className="py-1 pr-3 text-right text-text/80">
                            {Number(p.units_sold || 0)}
                          </td>
                          <td className="py-1 pr-3 text-right text-text/80">
                            {Number(p.gross_usdt || 0).toFixed(2)}
                          </td>
                          <td className="py-1 pr-3 text-right text-text/80">
                            {Math.round((Number(p.profit_margin || 0) || 0) * 100)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-text/80">Top vendedores</h3>
                <span className="text-[11px] text-text/60">
                  {salesBySeller.length} vendedor(es)
                </span>
              </div>
              {salesBySeller.length === 0 ? (
                <p className="text-[11px] text-text/60">
                  No hay vendedores con ventas registradas en este rango.
                </p>
              ) : (
                <table className="min-w-full text-[11px] align-middle">
                  <thead>
                    <tr className="text-text/60 border-b border-glass">
                      <th className="py-1 pr-3 text-left">Vendedor</th>
                      <th className="py-1 pr-3 text-right">Tickets</th>
                      <th className="py-1 pr-3 text-right">Ventas USDT</th>
                      <th className="py-1 pr-3 text-right">Comisión USDT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesBySeller.slice(0, 20).map((s) => (
                      <tr
                        key={s.seller_id || s.seller_username || 'unknown'}
                        className="border-b border-glass/40"
                      >
                        <td className="py-1 pr-3 text-text/80">
                          {s.seller_display_name || s.seller_username || '-'}
                        </td>
                        <td className="py-1 pr-3 text-right text-text/80">
                          {Number(s.order_count || 0)}
                        </td>
                        <td className="py-1 pr-3 text-right text-text/80">
                          {Number(s.total_usdt || 0).toFixed(2)}
                        </td>
                        <td className="py-1 pr-3 text-right text-text/80">
                          {Number(s.commission_usdt || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card-glass p-4 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <h2 className="text-sm font-semibold text-emerald-400">Pedidos activos</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-text/60">
                  {orders.length} en proceso
                </span>
                {/* Botón de filtro de columnas */}
                <div className="relative group">
                  <button className="px-2 py-1 text-[10px] bg-glass hover:bg-glass-hover rounded text-text/80 transition-colors">
                    Columnas
                  </button>
                  <div className="absolute right-0 top-full mt-1 bg-dark border border-glass rounded-lg shadow-lg p-2 min-w-[150px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    {Object.entries(orderColumnsFilter).map(([key, value]) => (
                      <label key={key} className="flex items-center gap-2 text-[10px] text-text/80 hover:text-text cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setOrderColumnsFilter(prev => ({
                            ...prev,
                            [key]: e.target.checked
                          }))}
                          className="w-3 h-3 rounded border-glass bg-dark text-accent focus:ring-accent/50"
                        />
                        {key === 'actions' ? 'Acciones' : 
                         key === 'total' ? 'Total' : 
                         key === 'reference' ? 'Referencia' : 
                         key === 'type' ? 'Tipo' : 
                         key === 'created' ? 'Creado' : 
                         key === 'status' ? 'Estado' : key}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {loadingOrders ? (
              <p className="text-xs text-text/60">Cargando pedidos...</p>
            ) : orders.length === 0 ? (
              <p className="text-xs text-text/60">No hay pedidos activos en este momento.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs align-middle">
                  <thead>
                    <tr className="text-text/60 border-b border-glass">
                      {orderColumnsFilter.actions && <th className="py-2 pr-3 text-left">Acciones</th>}
                      {orderColumnsFilter.total && <th className="py-2 pr-3 text-left">Total USD/VES - Ref</th>}
                      {orderColumnsFilter.type && <th className="py-2 pr-3 text-left">Tipo</th>}
                      {orderColumnsFilter.status && <th className="py-2 pr-3 text-left">Estado</th>}
                      {orderColumnsFilter.created && <th className="py-2 pr-3 text-left">Creado</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const canOpenInvoice = order.invoice_number != null;
                      const isPending = order.status === 'pending';
                      const isConfirmed = order.status === 'confirmed';
                      const hasDeliveryAddress = order.delivery_address || order.customer_address;

                      return (
                        <tr
                          key={order.id}
                          className={`border-b border-glass/40 ${
                            canOpenInvoice ? 'cursor-pointer hover:bg-glass' : ''
                          }`}
                          onClick={() => {
                            if (!canOpenInvoice) return;
                            navigate(
                              `/store/${store.slug}/invoice/${order.invoice_number}?from=reports`
                            );
                          }}
                        >
                          {orderColumnsFilter.actions && (
                            <td className="py-2 pr-3" onClick={(e) => e.stopPropagation()}>
                              {isPending ? (
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateOrderStatusMutation.mutate({
                                        orderId: order.id,
                                        status: 'confirmed'
                                      });
                                    }}
                                    className="px-2 py-1 rounded-full bg-emerald-500/90 hover:bg-emerald-400 text-[10px] font-semibold text-dark disabled:opacity-50 transition-colors"
                                    disabled={updateOrderStatusMutation.isLoading}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateOrderStatusMutation.mutate({
                                        orderId: order.id,
                                        status: 'cancelled'
                                      });
                                    }}
                                    className="px-2 py-1 rounded-full bg-red-500/90 hover:bg-red-400 text-[10px] font-semibold text-dark disabled:opacity-50 transition-colors"
                                    disabled={updateOrderStatusMutation.isLoading}
                                  >
                                    ✗
                                  </button>
                                </div>
                              ) : isConfirmed ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateOrderStatusMutation.mutate({
                                      orderId: order.id,
                                      status: 'completed'
                                    });
                                  }}
                                  className="px-2 py-1 rounded-full bg-glass hover:bg-glass-hover text-[10px] font-semibold text-text disabled:opacity-50 transition-colors"
                                  disabled={updateOrderStatusMutation.isLoading}
                                >
                                  Entregado
                                </button>
                              ) : (
                                <span className="text-[10px] text-text/50">-</span>
                              )}
                            </td>
                          )}
                          
                          {orderColumnsFilter.total && (
                            <td className="py-2 pr-3">
                              <div className="space-y-1">
                                <div className="text-text/80 font-medium">
                                  ${Number(order.total_usdt || 0).toFixed(2)}
                                  {order.total_bsv && (
                                    <span className="text-text/60 ml-2">
                                      Bs {Number(order.total_bsv).toFixed(2)}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-text/60">
                                  Ref: {order.payment_reference || order.invoice_number || order.code || 'N/A'}
                                </div>
                              </div>
                            </td>
                          )}
                          
                          {orderColumnsFilter.type && (
                            <td className="py-2 pr-3">
                              <div className="space-y-1">
                                <div className="text-text/70 capitalize">
                                  {order.type || 'local'}
                                </div>
                                {hasDeliveryAddress && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openMapWithAutoClose(`https://maps.google.com/?q=${encodeURIComponent(hasDeliveryAddress)}`);
                                    }}
                                    className="text-[10px] text-accent hover:text-accent/80 flex items-center gap-1"
                                  >
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                    </svg>
                                    Ver dirección
                                  </button>
                                )}
                                {order.table_number && (
                                  <div className="text-[10px] text-text/60">
                                    Mesa: {order.table_number}
                                  </div>
                                )}
                              </div>
                            </td>
                          )}
                          
                          {orderColumnsFilter.status && (
                            <td className="py-2 pr-3">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${
                                order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                order.status === 'confirmed' ? 'bg-blue-500/20 text-blue-400' :
                                order.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                order.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                                'bg-glass text-text/60'
                              }`}>
                                {order.status || 'desconocido'}
                              </span>
                            </td>
                          )}
                          
                          {orderColumnsFilter.created && (
                            <td className="py-2 pr-3 text-text/60">
                              {order.created_at ? 
                                new Date(order.created_at).toLocaleString('es-VE', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : '-'
                              }
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px bg-glass flex-1"></div>
              <div className="text-xs text-text/50 font-medium uppercase tracking-wide">Historial</div>
              <div className="h-px bg-glass flex-1"></div>
            </div>
          </div>

          <div className="card-glass p-4 overflow-x-auto border border-blue-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <h2 className="text-sm font-semibold text-blue-400">Historial de ventas</h2>
              </div>
              <span className="text-[11px] text-text/60">
                Últimas {ordersHistory.length} facturas
              </span>
            </div>
            {loadingOrdersHistory ? (
              <p className="text-xs text-text/60">Cargando historial...</p>
            ) : ordersHistory.length === 0 ? (
              <p className="text-xs text-text/60">Aún no hay ventas registradas.</p>
            ) : (
              <table className="min-w-full text-xs align-middle">
                <thead>
                  <tr className="text-text/60 border-b border-glass">
                    <th className="py-1 pr-3 text-left">Factura #</th>
                    <th className="py-1 pr-3 text-left">Cliente</th>
                    <th className="py-1 pr-3 text-left">CI</th>
                    <th className="py-1 pr-3 text-left">Vendedor</th>
                    <th className="py-1 pr-3 text-left">Estado</th>
                    <th className="py-1 pr-3 text-right">Total USDT</th>
                    <th className="py-1 pr-3 text-right">Total Bs</th>
                    <th className="py-1 pr-3 text-left">Fecha / hora</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersHistory.map((order) => {
                    const totalUsdt = Number(order.total_usdt || 0);
                    const totalBsFromRate = vesPerUsdt
                      ? totalUsdt * vesPerUsdt
                      : null;
                    const sellerLabel =
                      order.seller_display_name || order.seller_username || '-';

                    const canOpenInvoice = order.invoice_number != null;

                    const formatInvoiceNumber = (n) => {
                      if (n === null || n === undefined) return '-';
                      const numeric = typeof n === 'number' ? n : parseInt(n, 10);
                      if (!Number.isFinite(numeric)) return String(n);
                      return String(numeric).padStart(7, '0');
                    };

                    return (
                      <tr
                        key={order.id}
                        className={`border-b border-glass/40 ${
                          canOpenInvoice ? 'cursor-pointer hover:bg-glass' : ''
                        }`}
                        onClick={() => {
                          if (!canOpenInvoice) return;
                          navigate(
                            `/store/${store.slug}/invoice/${order.invoice_number}?from=reports`
                          );
                        }}
                      >
                        <td className="py-1 pr-3 text-text/80">
                          {formatInvoiceNumber(order.invoice_number)}
                        </td>
                        <td className="py-1 pr-3 text-text/80">
                          {order.customer_name || '-'}
                        </td>
                        <td className="py-1 pr-3 text-text/70">
                          {order.customer_ci || '-'}
                        </td>
                        <td className="py-1 pr-3 text-text/70">{sellerLabel}</td>
                        <td className="py-1 pr-3 text-text/70">
                          {order.status || '-'}
                          {order.payment_status
                            ? ` · ${order.payment_status}`
                            : ''}
                        </td>
                        <td className="py-1 pr-3 text-right text-text/80">
                          {totalUsdt.toFixed(2)}
                        </td>
                        <td className="py-1 pr-3 text-right text-text/80">
                          {totalBsFromRate != null
                            ? totalBsFromRate.toLocaleString('es-VE', {
                                style: 'currency',
                                currency: 'VES'
                              })
                            : '-'}
                        </td>
                        <td className="py-1 pr-3 text-text/60">
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
      )}

      {activeTab === 'marketing' && (
        <div className="space-y-4">
          <div className="card-glass p-4 space-y-3 text-xs">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold mb-1">Marketing & comunidad</h2>
              <p className="text-text/70">
                Aquí podrás ver y configurar campañas, combos especiales, códigos promocionales y acciones de
                comunidad conectadas con el ecosistema de Mundo XYZ.
              </p>
            </div>
            {marketingPlan ? (
              typeof marketingPlan === 'string' ? (
                <p className="text-text/70 whitespace-pre-line">{marketingPlan}</p>
              ) : (
                <pre className="text-[11px] text-text/70 bg-black/20 rounded-md p-2 overflow-x-auto">
                  {JSON.stringify(marketingPlan, null, 2)}
                </pre>
              )
            ) : (
              <p className="text-text/60">
                Aún no hay un plan de marketing guardado. Puedes usar el editor de abajo para definir uno.
              </p>
            )}
            <div className="space-y-2">
              <p className="text-[11px] text-text/60">
                Editor de plan de marketing (solo visible para el equipo de la tienda).
              </p>
              <textarea
                value={marketingPlanDraft}
                onChange={(e) => setMarketingPlanDraft(e.target.value)}
                className="input-glass w-full h-32 resize-none"
                placeholder="Ej: Objetivos de la campaña, calendario de lanzamientos, mensajes clave..."
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    const trimmed = marketingPlanDraft != null ? marketingPlanDraft.trim() : '';
                    const settingsPatch = {
                      marketing_plan: trimmed !== '' ? marketingPlanDraft : null
                    };
                    await updateStoreSettingsMutation.mutateAsync({
                      settings_patch: settingsPatch
                    });
                    setMarketingPlan(settingsPatch.marketing_plan);
                  }}
                  disabled={updateStoreSettingsMutation.isLoading}
                  className="px-3 py-1.5 rounded-full bg-accent/20 text-accent hover:bg-accent/30 text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateStoreSettingsMutation.isLoading
                    ? 'Guardando…'
                    : 'Guardar plan de marketing'}
                </button>
              </div>
            </div>
          </div>

          <div className="card-glass p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text/90">Tickets y mensajes de clientes</h3>
                <p className="text-[11px] text-text/60">
                  Conversaciones abiertas que pueden contener reclamos, sugerencias o ideas útiles para Marketing.
                </p>
              </div>
              <span className="text-[11px] text-text/60">
                {marketingConversations.length} abierto(s)
              </span>
            </div>

            {loadingMarketingConversations ? (
              <p className="text-[11px] text-text/60">Cargando tickets...</p>
            ) : marketingConversationsError ? (
              <p className="text-[11px] text-red-400">No se pudieron cargar los tickets de esta tienda.</p>
            ) : marketingConversations.length === 0 ? (
              <p className="text-[11px] text-text/60">
                No hay tickets abiertos en este momento. Cuando los clientes escriban a tu tienda, sus mensajes
                aparecerán aquí.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-[11px] align-middle">
                  <thead>
                    <tr className="text-text/60 border-b border-glass">
                      <th className="py-1 pr-3 text-left">Asunto</th>
                      <th className="py-1 pr-3 text-left">Cliente</th>
                      <th className="py-1 pr-3 text-left">CI</th>
                      <th className="py-1 pr-3 text-left">Último mensaje</th>
                      <th className="py-1 pr-3 text-left">Estado</th>
                      <th className="py-1 pr-3 text-right">Última actividad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketingConversations.map((conv) => {
                      const lastAt = conv.last_message_at || conv.created_at;
                      const formattedDate = lastAt
                        ? new Date(lastAt).toLocaleString()
                        : '-';
                      const statusLabel = conv.status || 'open';
                      const priorityLabel = conv.priority || 'normal';

                      return (
                        <tr key={conv.id} className="border-b border-glass/40">
                          <td className="py-1 pr-3 text-text/80">{conv.label}</td>
                          <td className="py-1 pr-3 text-text/80">{conv.customer_name || 'Cliente'}</td>
                          <td className="py-1 pr-3 text-text/70">{conv.customer_ci || '-'}</td>
                          <td className="py-1 pr-3 text-text/70 max-w-xs truncate">
                            {conv.last_message_preview || '(sin preview)'}
                          </td>
                          <td className="py-1 pr-3 text-text/70">
                            {statusLabel} · {priorityLabel}
                          </td>
                          <td className="py-1 pr-3 text-right text-text/60">{formattedDate}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="card-glass p-4 space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-text/60 mb-1">Vistas de la tienda</p>
              <p className="text-2xl font-bold text-accent">
                {storeMetrics?.views_count != null ? Number(storeMetrics.views_count) : 0}
              </p>
            </div>
            <div>
              <p className="text-text/60 mb-1">Clientes registrados</p>
              <p className="text-2xl font-bold text-emerald-400">
                {storeMetrics?.customers_count != null ? Number(storeMetrics.customers_count) : 0}
              </p>
            </div>
            <div>
              <p className="text-text/60 mb-1">Link público</p>
              <a
                href={`/store/${store.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-accent break-all underline"
              >
                {`/store/${store.slug}`}
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <p className="text-text/60 mb-1">Tamaño del header</p>
                <div className="flex gap-2">
                  {[
                    { id: 'compact', label: 'Compacto' },
                    { id: 'normal', label: 'Normal' },
                    { id: 'full', label: 'Completo' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setHeaderLayout(opt.id)}
                      className={`px-3 py-1.5 rounded-full text-[11px] border transition-colors ${
                        headerLayout === opt.id
                          ? 'bg-accent text-background-dark border-accent'
                          : 'bg-glass text-text/70 border-glass hover:text-text'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-text/60 mb-1">Número de mesas (modo restaurante)</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={tablesCountInput}
                    onChange={(e) => setTablesCountInput(e.target.value)}
                    className="input-glass w-24"
                  />
                  <span className="text-[11px] text-text/60">
                    0 desactiva el modo restaurante en el POS.
                  </span>
                </div>
              </div>

              <div>
                <p className="text-text/60 mb-1">Mensajería de tienda</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[11px] text-text/80">
                    <input
                      type="checkbox"
                      checked={messagingEnabled}
                      onChange={(e) => setMessagingEnabled(e.target.checked)}
                      className="rounded border-glass"
                    />
                    <span>Activar mensajería para esta tienda</span>
                  </label>
                  <div className="mt-1 space-y-1">
                    <p className="text-[11px] text-text/60">
                      ¿Quién debe ser notificado cuando un cliente escribe a la tienda?
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { id: 'owner', label: 'Dueño' },
                        { id: 'admin', label: 'Admin' },
                        { id: 'manager', label: 'Manager' },
                        { id: 'seller', label: 'Vendedor' },
                        { id: 'marketing', label: 'Marketing' },
                        { id: 'mesonero', label: 'Mesonero' },
                        { id: 'delivery', label: 'Delivery' }
                      ].map((opt) => {
                        const checked = messagingNotifyRoles.includes(opt.id);
                        return (
                          <label
                            key={opt.id}
                            className="flex items-center gap-2 text-[11px] text-text/70"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                setMessagingNotifyRoles((prev) => {
                                  if (isChecked) {
                                    if (prev.includes(opt.id)) return prev;
                                    return [...prev, opt.id];
                                  }
                                  return prev.filter((roleId) => roleId !== opt.id);
                                });
                              }}
                              className="rounded border-glass"
                            />
                            <span>{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-text/60 mb-1">URL del logo (perfil)</p>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={logoUrlInput}
                    onChange={(e) => setLogoUrlInput(e.target.value)}
                    className="input-glass w-full"
                    placeholder="https://..."
                  />
                  <div className="flex items-center gap-2">
                    <input
                      id="store-logo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files && e.target.files[0];
                        if (!file) return;

                        const result = await processProductImageFile(file, MAX_PRODUCT_IMAGE_MB);
                        if (result.error) {
                          toast.error(result.error);
                        } else {
                          setLogoUrlInput(result.base64);
                          toast.success('Logo cargado exitosamente');
                        }
                      }}
                    />
                    <label
                      htmlFor="store-logo-upload"
                      className="inline-flex items-center px-3 py-1.5 rounded-full bg-glass hover:bg-glass-hover text-[11px] cursor-pointer border border-glass"
                    >
                      Subir logo desde archivo
                    </label>
                    <CameraButton
                      onPhotoTaken={async (file) => {
                        const result = await processProductImageFile(file, MAX_PRODUCT_IMAGE_MB);
                        if (result.error) {
                          toast.error(result.error);
                        } else {
                          setLogoUrlInput(result.base64);
                          toast.success('Logo capturado exitosamente');
                        }
                      }}
                      size="sm"
                      className="rounded-full"
                    />
                  </div>
                  {logoUrlInput && (
                    <div className="mt-1">
                      <img
                        src={logoUrlInput}
                        alt={store.name || 'Logo de tienda'}
                        className="w-16 h-16 rounded-full object-cover border border-glass"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-text/60 mb-1">URL del banner (header)</p>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={coverUrlInput}
                    onChange={(e) => setCoverUrlInput(e.target.value)}
                    className="input-glass w-full"
                    placeholder="https://..."
                  />
                  <div className="flex items-center gap-2">
                    <input
                      id="store-cover-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files && e.target.files[0];
                        if (!file) return;

                        const result = await processProductImageFile(file, MAX_PRODUCT_IMAGE_MB);
                        if (result.error) {
                          toast.error(result.error);
                        } else {
                          setCoverUrlInput(result.base64);
                          toast.success('Banner cargado exitosamente');
                        }
                      }}
                    />
                    <label
                      htmlFor="store-cover-upload"
                      className="inline-flex items-center px-3 py-1.5 rounded-full bg-glass hover:bg-glass-hover text-[11px] cursor-pointer border border-glass"
                    >
                      Subir banner desde archivo
                    </label>
                    <CameraButton
                      onPhotoTaken={async (file) => {
                        const result = await processProductImageFile(file, MAX_PRODUCT_IMAGE_MB);
                        if (result.error) {
                          toast.error(result.error);
                        } else {
                          setCoverUrlInput(result.base64);
                          toast.success('Banner capturado exitosamente');
                        }
                      }}
                      size="sm"
                      className="rounded-full"
                    />
                  </div>
                  {coverUrlInput && (
                    <div className="mt-1">
                      <img
                        src={coverUrlInput}
                        alt={store.name || 'Banner de tienda'}
                        className="w-full h-24 md:h-32 object-cover rounded-lg border border-glass"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-text/60 mb-1">Dirección pública</p>
                <textarea
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  className="input-glass w-full h-20 resize-none"
                />
              </div>
              <div>
                <p className="text-text/60 mb-1">Link de Google Maps / ubicación</p>
                <input
                  type="text"
                  value={locationMapsUrl}
                  onChange={(e) => setLocationMapsUrl(e.target.value)}
                  className="input-glass w-full"
                  placeholder="https://maps.google.com/..."
                />
                {locationMapsUrl && (
                  <div className="mt-1 text-[11px] text-text/60">
                    {locationPreview ? (
                      <>
                        Coordenadas detectadas:{' '}
                        <span className="font-mono">
                          {locationPreview.lat.toFixed(6)}, {locationPreview.lng.toFixed(6)}
                        </span>
                      </>
                    ) : (
                      <span>
                        No se pudieron leer coordenadas del enlace. Evita usar links cortos como
                        share.google o maps.app.goo.gl. Abre el mapa y copia la URL completa desde la barra
                        de direcciones de Google Maps para mejorar la precisión.
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-glass pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-text/80 flex items-center gap-1">
                Métodos de pago (checkout tienda)
              </h3>
            </div>
            <p className="text-[11px] text-text/60">
              Configura cómo verán los métodos de pago tus clientes al hacer checkout en tu tienda pública.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  key: 'bs_transfer',
                  title: 'Pago mvil / Transferencia en Bs',
                  placeholder:
                    'Datos de pago mvil o transferencia en Bs (banco, alias, CI, teléfono, etc.)'
                },
                {
                  key: 'bs_cash',
                  title: 'Bs en efectivo',
                  placeholder: 'Instrucciones para pagar en efectivo en Bs (caja, mostrador, etc.)'
                },
                {
                  key: 'usdt_tron',
                  title: 'USDT Tron',
                  placeholder: 'Correo o datos de cuenta USDT Tron que verá el cliente'
                },
                {
                  key: 'cash_usdt',
                  title: 'Efectivo (USDT)',
                  placeholder: 'Notas para pagos en efectivo en USDT (en tienda, delivery, etc.)'
                },
                {
                  key: 'fires',
                  title: 'Pago con Fuegos',
                  placeholder:
                    'Explica cómo funciona el pago con Fuegos en tu tienda o si aplica alguna condición especial'
                }
              ].map((cfg) => {
                const current = paymentMethodsConfig[cfg.key] || {
                  label: cfg.title,
                  instructions: ''
                };

                return (
                  <div
                    key={cfg.key}
                    className="border border-glass rounded-lg p-3 space-y-2 bg-glass/40"
                  >
                    <div>
                      <p className="text-[11px] text-text/60 mb-1">Nombre que verá el cliente</p>
                      <input
                        type="text"
                        value={current.label}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPaymentMethodsConfig((prev) => ({
                            ...prev,
                            [cfg.key]: {
                              label: value,
                              instructions: prev[cfg.key]?.instructions || ''
                            }
                          }));
                        }}
                        className="input-glass w-full text-xs"
                      />
                    </div>
                    <div>
                      <p className="text-[11px] text-text/60 mb-1">Datos e instrucciones</p>
                      <textarea
                        value={current.instructions}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPaymentMethodsConfig((prev) => ({
                            ...prev,
                            [cfg.key]: {
                              label: prev[cfg.key]?.label || current.label,
                              instructions: value
                            }
                          }));
                        }}
                        className="input-glass w-full h-20 resize-none text-[11px]"
                        placeholder={cfg.placeholder}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={async () => {
                const settingsPatch = {
                  header_layout: headerLayout,
                  payment_methods: paymentMethodsConfig
                };

                let normalizedTables = parseInt(tablesCountInput, 10);
                if (!Number.isFinite(normalizedTables) || normalizedTables < 0) {
                  normalizedTables = 0;
                }
                settingsPatch.tables_count = normalizedTables;

                const normalizedNotifyRoles = Array.isArray(messagingNotifyRoles)
                  ? messagingNotifyRoles
                      .map((r) => (typeof r === 'string' ? r.trim() : ''))
                      .filter((r) => r.length > 0)
                  : [];
                settingsPatch.messaging = {
                  enabled: messagingEnabled,
                  notify_roles:
                    normalizedNotifyRoles.length > 0
                      ? normalizedNotifyRoles
                      : ['owner', 'admin', 'marketing']
                };

                const locationPatch = {
                  address: locationAddress || null,
                  maps_url: locationMapsUrl || null
                };

                if (locationPreview) {
                  locationPatch.lat = locationPreview.lat;
                  locationPatch.lng = locationPreview.lng;
                  // Campos alternativos por compatibilidad
                  locationPatch.latitude = locationPreview.lat;
                  locationPatch.longitude = locationPreview.lng;
                }

                const payload = {
                  logo_url: logoUrlInput || null,
                  cover_url: coverUrlInput || null,
                  settings_patch: settingsPatch,
                  location_patch: locationPatch
                };

                await updateStoreSettingsMutation.mutateAsync(payload);
              }}
              disabled={updateStoreSettingsMutation.isLoading}
              className="px-4 py-2 rounded-full bg-accent/20 text-accent hover:bg-accent/30 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateStoreSettingsMutation.isLoading
                ? 'Guardando…'
                : 'Guardar configuración de tienda'}
            </button>
          </div>
        </div>
      )}

      {editingProduct && (
        <ProductEditModal
          key={editingMode === 'edit' ? editingProduct.id : 'new-product'}
          mode={editingMode}
          product={editingProduct}
          categories={categories}
          vesPerUsdt={vesPerUsdt}
          firesPerUsdt={firesPerUsdt}
          onClose={() => setEditingProduct(null)}
          onRequestNewCategory={() => setIsNewCategoryModalOpen(true)}
          onModifierInputChange={handleModifierInputChange}
          updateModifierOption={updateModifierOption}
          modifierGroups={modifierGroups}
          setModifierGroups={setModifierGroups}
          onSave={async (data) => {
            if (editingMode === 'edit') {
              await updateProductMutation.mutateAsync({ productId: editingProduct.id, data });
            } else {
              await createProductMutation.mutateAsync(data);
            }
            setEditingProduct(null);
          }}
          loading={
            editingMode === 'edit'
              ? updateProductMutation.isLoading
              : createProductMutation.isLoading
          }
        />
      )}
      {isNewSupplierModalOpen && (
        <NewSupplierModal
          suppliers={suppliers}
          onSelectExistingSupplier={(supplier) => {
            if (!supplier) return;
            setIsNewSupplierModalOpen(false);
            setSelectedSupplier(supplier);
            setIsSupplierDetailModalOpen(true);
          }}
          onClose={() => setIsNewSupplierModalOpen(false)}
          onSave={async (data) => {
            await createSupplierMutation.mutateAsync(data);
            setIsNewSupplierModalOpen(false);
          }}
          loading={createSupplierMutation.isLoading}
        />
      )}
      {isSupplierDetailModalOpen && selectedSupplier && (
        <SupplierDetailModal
          supplier={selectedSupplier}
          onClose={() => {
            setIsSupplierDetailModalOpen(false);
            setSelectedSupplier(null);
          }}
          onSave={async (data) => {
            await updateSupplierMutation.mutateAsync({
              supplierId: selectedSupplier.id,
              data
            });
            setIsSupplierDetailModalOpen(false);
            setSelectedSupplier(null);
          }}
          loading={updateSupplierMutation.isLoading}
        />
      )}
      {isNewInvoiceModalOpen && (
        <NewPurchaseModal
          suppliers={suppliers}
          products={products}
          ingredients={ingredients}
          categories={categories}
          vesPerUsdt={vesPerUsdt}
          storeId={store?.id}
          onCreateProduct={async (data) => {
            const created = await createProductMutation.mutateAsync(data);
            return created;
          }}
          onClose={() => setIsNewInvoiceModalOpen(false)}
          onSave={async (data) => {
            await createPurchaseMutation.mutateAsync(data);
            setIsNewInvoiceModalOpen(false);
          }}
          loading={createPurchaseMutation.isLoading}
        />
      )}
      {isPurchaseDetailModalOpen && (
        <PurchaseDetailModal
          purchase={selectedPurchaseDetail}
          loading={isPurchaseDetailLoading}
          vesPerUsdt={vesPerUsdt}
          store={store}
          user={user}
          onClose={() => {
            setIsPurchaseDetailModalOpen(false);
            setSelectedPurchaseDetail(null);
          }}
        />
      )}
      {isIngredientsModalOpen && (
        <IngredientsModal
          ingredients={ingredients}
          products={products}
          categories={categories}
          vesPerUsdt={vesPerUsdt}
          onClose={() => setIsIngredientsModalOpen(false)}
        />
      )}
      {isProductionRecipeModalOpen && (
        <ProductionRecipeModal
          storeId={store?.id}
          products={products}
          ingredients={ingredients}
          recipe={editingProductionRecipe}
          onClose={() => {
            setIsProductionRecipeModalOpen(false);
            setEditingProductionRecipe(null);
          }}
          onSave={async (payload) => {
            if (editingProductionRecipe?.id) {
              await updateProductionRecipeMutation.mutateAsync({
                recipeId: editingProductionRecipe.id,
                payload
              });
            } else {
              await createProductionRecipeMutation.mutateAsync(payload);
            }
            setIsProductionRecipeModalOpen(false);
            setEditingProductionRecipe(null);
          }}
          onRequestCraft={(recipeToCraft) => {
            setIsProductionRecipeModalOpen(false);
            setEditingProductionRecipe(null);
            setCraftingRecipe(recipeToCraft);
            setIsProductionCraftingModalOpen(true);
          }}
          loading={
            editingProductionRecipe?.id
              ? updateProductionRecipeMutation.isLoading
              : createProductionRecipeMutation.isLoading
          }
        />
      )}
      {isProductionCraftingModalOpen && craftingRecipe && (
        <ProductionCraftingModal
          recipe={craftingRecipe}
          storeId={store?.id}
          ingredients={ingredients}
          products={products}
          recipes={productionRecipes}
          onSelectRecipe={(r) => {
            if (!r) return;
            setCraftingRecipe(r);
          }}
          onClose={() => {
            setIsProductionCraftingModalOpen(false);
            setCraftingRecipe(null);
          }}
          onCraft={async (qty, notes) => {
            if (!store?.id || !craftingRecipe?.id) return;
            try {
              await createProductionBatchMutation.mutateAsync({
                recipe_id: craftingRecipe.id,
                planned_quantity: qty,
                notes
              });
              toast.success('Lote de producción ejecutado');
              setIsProductionCraftingModalOpen(false);
              setCraftingRecipe(null);
            } catch (err) {
              const message =
                err?.response?.data?.error || 'Error al ejecutar lote de producción';
              toast.error(message);
            }
          }}
          loading={createProductionBatchMutation.isLoading}
        />
      )}
      {isCategoryManagerOpen && (
        <CategoryManagementModal
          categories={categories}
          onClose={() => setIsCategoryManagerOpen(false)}
          onCreate={async (data) => {
            await createCategoryMutation.mutateAsync(data);
          }}
          onUpdate={async ({ categoryId, data }) => {
            await updateCategoryMutation.mutateAsync({ categoryId, data });
          }}
          onDelete={async (categoryId) => {
            await deleteCategoryMutation.mutateAsync(categoryId);
          }}
          loadingCreate={createCategoryMutation.isLoading}
          loadingUpdate={updateCategoryMutation.isLoading}
          loadingDelete={deleteCategoryMutation.isLoading}
          store={store}
          queryClient={queryClient}
        />
      )}
      
      {/* Modal de Selector de Color Personalizado */}
      <ColorPickerModal
        isOpen={colorPickerModalOpen}
        onClose={() => {
          setColorPickerModalOpen(false);
          setCurrentModifierInput({ groupId: null, optionId: null, value: '' });
        }}
        onColorSelect={handleColorSelect}
        initialColor="#FF0000"
      />
    </div>
  );
};

const ProductEditModal = ({
  mode,
  product,
  categories,
  onClose,
  onSave,
  loading,
  vesPerUsdt,
  firesPerUsdt,
  onRequestNewCategory,
  onModifierInputChange,
  updateModifierOption,
  modifierGroups,
  setModifierGroups
}) => {
  const [sku, setSku] = useState(product?.sku ? String(product.sku) : '');
  const [name, setName] = useState(product?.name || '');
  const [categoryId, setCategoryId] = useState(product?.category_id ? String(product.category_id) : '');
  const [description, setDescription] = useState(product?.description || '');
  const [priceUsdt, setPriceUsdt] = useState(
    product?.price_usdt != null ? String(product.price_usdt) : ''
  );
  const [priceFires, setPriceFires] = useState(
    product?.price_fires != null ? String(product.price_fires) : ''
  );
  const [isMenuItem, setIsMenuItem] = useState(!!product?.is_menu_item);
  const [hasModifiers, setHasModifiers] = useState(!!product?.has_modifiers);
  const [acceptsFires, setAcceptsFires] = useState(!!product?.accepts_fires);
  const [imageUrl, setImageUrl] = useState(product?.image_url || '');
  const [stock, setStock] = useState(
    product?.stock != null ? String(product.stock) : '0'
  );
  const [minStockAlert] = useState(
    product?.min_stock_alert != null ? String(product.min_stock_alert) : '0'
  );
  const existingModifiers = useMemo(
    () => (Array.isArray(product?.modifiers) ? product.modifiers : []),
    [product?.modifiers]
  );
  useEffect(() => {
    if (!Array.isArray(existingModifiers) || existingModifiers.length === 0) return;

    setModifierGroups((prev) => {
      if (Array.isArray(prev) && prev.length > 0) {
        return prev;
      }

      const groupsMap = new Map();

      for (const mod of existingModifiers) {
        if (!mod || !mod.group_name) continue;
        const groupName = String(mod.group_name).trim();
        if (!groupName) continue;

        let group = groupsMap.get(groupName);
        if (!group) {
          const maxSelRaw = mod.max_selection;
          let maxSel = parseInt(maxSelRaw, 10);
          if (!Number.isFinite(maxSel) || maxSel <= 0) {
            maxSel = 1;
          }

          group = {
            id: groupName,
            groupName,
            maxSelection: maxSel,
            color: '#00E5FF',
            options: []
          };
          groupsMap.set(groupName, group);
        }

        const hasAdj = mod.price_adjustment_usdt !== undefined && mod.price_adjustment_usdt !== null;
        const priceAdjValue = hasAdj ? String(mod.price_adjustment_usdt) : '';

        group.options.push({
          id: mod.id || `${groupName}_${group.options.length}`,
          name: mod.name || '',
          priceAdjustmentUsdt: priceAdjValue
        });
      }

      return Array.from(groupsMap.values());
    });
  }, [existingModifiers]);

  const priceUsdtNumber = parseFloat(priceUsdt || '0');
  const priceFiresNumber = parseFloat(priceFires || '0');

  const hasVesRate =
    typeof vesPerUsdt === 'number' && Number.isFinite(vesPerUsdt) && vesPerUsdt > 0;
  const hasFiresRate =
    typeof firesPerUsdt === 'number' && Number.isFinite(firesPerUsdt) && firesPerUsdt > 0;

  const vesFromUsdt =
    hasVesRate && Number.isFinite(priceUsdtNumber) ? priceUsdtNumber * vesPerUsdt : null;

  let usdtFromFires = null;
  let vesFromFires = null;
  if (hasFiresRate && Number.isFinite(priceFiresNumber) && priceFiresNumber > 0) {
    usdtFromFires = priceFiresNumber / firesPerUsdt;
    if (hasVesRate && Number.isFinite(usdtFromFires)) {
      vesFromFires = usdtFromFires * vesPerUsdt;
    }
  }

  const addModifierGroup = () => {
    setModifierGroups((prev) => [
      ...prev,
      {
        id: `${Date.now()}_${prev.length}`,
        groupName: '',
        maxSelection: 1,
        color: '#00E5FF',
        options: [
          {
            id: `${Date.now()}_${prev.length}_0`,
            name: '',
            priceAdjustmentUsdt: ''
          }
        ]
      }
    ]);
  };

  const updateModifierGroup = (groupId, changes) => {
    setModifierGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, ...changes } : g))
    );
  };

  const removeModifierGroup = (groupId) => {
    setModifierGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  const addModifierOption = (groupId) => {
    setModifierGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              options: [
                ...g.options,
                {
                  id: `${Date.now()}_${g.options.length}`,
                  name: '',
                  priceAdjustmentUsdt: ''
                }
              ]
            }
          : g
      )
    );
  };

  const removeModifierOption = (groupId, optionId) => {
    setModifierGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              options: g.options.filter((opt) => opt.id !== optionId)
            }
          : g
      )
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let normalizedStock = parseInt(stock, 10);
    if (!Number.isFinite(normalizedStock) || normalizedStock < 0) {
      normalizedStock = 0;
    }

    let normalizedMinStockAlert = parseInt(minStockAlert, 10);
    if (!Number.isFinite(normalizedMinStockAlert) || normalizedMinStockAlert < 0) {
      normalizedMinStockAlert = 0;
    }

    const cleanedModifierGroups = modifierGroups
      .map((group) => {
        const groupName = (group.groupName || '').trim();
        if (!groupName) return null;

        let maxSelection = parseInt(group.maxSelection, 10);
        if (!Number.isFinite(maxSelection) || maxSelection <= 0) {
          maxSelection = 1;
        }

        const color =
          typeof group.color === 'string' && group.color.trim().length > 0
            ? group.color.trim()
            : null;

        const options = Array.isArray(group.options) ? group.options : [];
        const cleanedOptions = options
          .map((opt) => {
            const optName = (opt.name || '').trim();
            if (!optName) return null;

            const rawAdj = opt.priceAdjustmentUsdt;
            const parsedAdj =
              rawAdj === '' || rawAdj === null || rawAdj === undefined
                ? 0
                : Number(String(rawAdj).replace(',', '.'));
            const priceAdjustmentUsdt =
              Number.isFinite(parsedAdj) && parsedAdj >= 0 ? parsedAdj : 0;

            return {
              name: optName,
              priceAdjustmentUsdt,
              maxSelection
            };
          })
          .filter(Boolean);

        if (cleanedOptions.length === 0) return null;

        return {
          groupName,
          maxSelection,
          color,
          options: cleanedOptions
        };
      })
      .filter(Boolean);

    if (hasModifiers && cleanedModifierGroups.length === 0 && existingModifiers.length === 0) {
      toast.error('Agrega al menos un modificador o desactiva "Usa modificadores".');
      return;
    }

    const payload = {
      sku: sku.trim() || undefined,
      name: name.trim(),
      description: description.trim(),
      category_id: categoryId || undefined,
      price_usdt: priceUsdt,
      price_fires: priceFires,
      is_menu_item: isMenuItem,
      has_modifiers: hasModifiers,
      accepts_fires: acceptsFires,
      image_url: imageUrl,
      stock: normalizedStock,
      modifierGroups: cleanedModifierGroups
    };

    await onSave(payload);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto card-glass p-6 space-y-4"
      >
        <h3 className="text-lg font-bold">
          {mode === 'create' ? 'Nuevo producto' : 'Editar producto'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <div className="text-text/60 mb-1">Nombre</div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-glass w-full"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1 text-text/60">
                <span>SKU</span>
                <button
                  type="button"
                  onClick={() => {
                    const generated = String(
                      Math.floor(100000000 + Math.random() * 900000000)
                    );
                    setSku(generated);
                  }}
                  className="px-2 py-0.5 rounded-full bg-glass hover:bg-glass-hover text-[10px]"
                >
                  Generar
                </button>
              </div>
              <input
                type="text"
                value={sku}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  setSku(value);
                }}
                className="input-glass w-full"
                placeholder="Solo números"
              />
            </div>
            <div>
              <div className="text-text/60 mb-1">Stock</div>
              <input
                type="number"
                min="0"
                step="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="input-glass w-full"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1 text-text/60">
              <span>Categoría</span>
              {onRequestNewCategory && (
                <button
                  type="button"
                  onClick={onRequestNewCategory}
                  className="px-2 py-0.5 rounded-full bg-glass hover:bg-glass-hover text-[10px]"
                >
                  Nueva
                </button>
              )}
            </div>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input-glass w-full"
            >
              <option value="">Sin categoría</option>
              {categories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-text/60 mb-1">Descripción</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-glass w-full h-20 resize-none"
            />
          </div>

          <div>
            <div className="text-text/60 mb-1">Imagen del producto</div>
            <div className="relative">
              <input
                id="product-image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files && e.target.files[0];
                  if (!file) return;

                  const result = await processProductImageFile(file, MAX_PRODUCT_IMAGE_MB);
                  if (result.error) {
                    toast.error(result.error);
                  } else {
                    setImageUrl(result.base64);
                    toast.success('Imagen cargada exitosamente');
                  }
                }}
              />
              <div className="flex items-center gap-2">
                <label
                  htmlFor="product-image-upload"
                  className="flex-1 px-4 py-2 bg-glass rounded-lg text-text cursor-pointer hover:bg-glass-hover transition-colors flex items-center justify-center gap-2 border-2 border-dashed border-white/20 hover:border-accent/50"
                >
                  <span className="text-xs">{imageUrl ? 'Cambiar imagen del producto' : 'Seleccionar imagen del producto'}</span>
                </label>
                <CameraButton
                  onPhotoTaken={async (file) => {
                    const result = await processProductImageFile(file, MAX_PRODUCT_IMAGE_MB);
                    if (result.error) {
                      toast.error(result.error);
                    } else {
                      setImageUrl(result.base64);
                      toast.success('Imagen capturada exitosamente');
                    }
                  }}
                  size="md"
                  className="rounded-lg"
                />
              </div>
            </div>
            {imageUrl && (
              <div className="mt-2">
                <img
                  src={imageUrl}
                  alt={name || 'Producto'}
                  className="w-full h-32 object-cover rounded-lg border border-glass"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-text/60 mb-1">Precio USDT</div>
              <input
                type="number"
                step="0.01"
                value={priceUsdt}
                onChange={(e) => setPriceUsdt(e.target.value)}
                className="input-glass w-full"
              />
              {vesFromUsdt != null && (
                <div className="mt-0.5 text-[10px] text-text/60">
                  ≈
                  {vesFromUsdt.toLocaleString('es-VE', {
                    style: 'currency',
                    currency: 'VES'
                  })}
                </div>
              )}
            </div>
            <div>
              <div className="text-text/60 mb-1">Precio Fires</div>
              <input
                type="number"
                step="0.01"
                value={priceFires}
                onChange={(e) => setPriceFires(e.target.value)}
                className="input-glass w-full"
              />
              {usdtFromFires != null && (
                <div className="mt-0.5 text-[10px] text-text/60">
                  ≈ {usdtFromFires.toFixed(2)} USDT
                  {vesFromFires != null && (
                    <>
                      {' '}
                      {vesFromFires.toLocaleString('es-VE', {
                        style: 'currency',
                        currency: 'VES'
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-text/70">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isMenuItem}
                onChange={(e) => setIsMenuItem(e.target.checked)}
              />
              <span>Visible en menú</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hasModifiers}
                onChange={(e) => setHasModifiers(e.target.checked)}
              />
              <span>Usa modificadores</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={acceptsFires}
                onChange={(e) => setAcceptsFires(e.target.checked)}
              />
              <span>Acepta pagos en Fires</span>
            </label>
          </div>

          {hasModifiers && (
            <div className="mt-3 border-t border-white/10 pt-3 space-y-3 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-text/70 font-semibold">Configuración de modificadores</span>
                <button
                  type="button"
                  onClick={addModifierGroup}
                  className="px-2 py-1 rounded-full bg-glass hover:bg-glass-hover text-[10px]"
                >
                  + Agregar grupo
                </button>
              </div>

              {modifierGroups.length === 0 && (
                <p className="text-[11px] text-text/60">
                  Define grupos como <span className="font-semibold">Tamaño</span> (Carta, Oficio) o
                  <span className="font-semibold"> Ingredientes</span> (maíz, jamón, tocineta).
                </p>
              )}

              {modifierGroups.map((group) => (
                <div key={group.id} className="border border-white/10 rounded-lg p-2 space-y-2">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <div className="text-[10px] text-text/60 mb-0.5">Nombre del modificador</div>
                      <input
                        type="text"
                        value={group.groupName}
                        onChange={(e) =>
                          updateModifierGroup(group.id, { groupName: e.target.value })
                        }
                        className="input-glass w-full text-[11px] py-1"
                        placeholder="Ej: Tamaño, Ingredientes"
                      />
                    </div>
                    <div className="w-28">
                      <div className="text-[10px] text-text/60 mb-0.5">Máx. seleccionables</div>
                      <input
                        type="number"
                        min="1"
                        value={group.maxSelection}
                        onChange={(e) =>
                          updateModifierGroup(group.id, { maxSelection: e.target.value })
                        }
                        className="input-glass w-full text-[11px] py-1"
                      />
                    </div>
                    <div className="w-20">
                      <div className="text-[10px] text-text/60 mb-0.5">Color</div>
                      <input
                        type="color"
                        value={group.color || '#00E5FF'}
                        onChange={(e) =>
                          updateModifierGroup(group.id, { color: e.target.value })
                        }
                        className="w-full h-7 rounded-md border border-white/10 bg-transparent p-0"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeModifierGroup(group.id)}
                      className="px-2 py-1 rounded-full bg-error/20 text-error hover:bg-error/30 text-[10px]"
                    >
                      Quitar
                    </button>
                  </div>

                  <div className="space-y-1">
                    {group.options.map((opt) => {
                      const { color } = parseModifierColorFromName(opt.name);

                      return (
                        <div key={opt.id} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={opt.name}
                            onChange={(e) =>
                              onModifierInputChange(group.id, opt.id, e.target.value)
                            }
                            className="flex-1 input-glass text-[11px] py-1"
                            placeholder="Nombre del elemento (Ej: #color para selector, Rojo #rojo, Carta, Oficio)"
                          />
                          <div className="flex items-center gap-1">
                            {color && (
                              <div
                                className="w-4 h-4 rounded-full border border-white/40"
                                style={{ backgroundColor: color }}
                              />
                            )}
                            <input
                              type="number"
                              step="0.01"
                              value={opt.priceAdjustmentUsdt}
                              onChange={(e) =>
                                updateModifierOption(group.id, opt.id, {
                                  priceAdjustmentUsdt: e.target.value
                                })
                              }
                              className="w-24 input-glass text-[11px] py-1"
                              placeholder="+ USDT"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeModifierOption(group.id, opt.id)}
                            className="px-2 py-1 rounded-full bg-glass text-text/70 hover:bg-glass-hover text-[10px]"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => addModifierOption(group.id)}
                      className="mt-1 px-2 py-1 rounded-full bg-glass hover:bg-glass-hover text-[10px]"
                    >
                      + Agregar elemento
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-glass hover:bg-glass-hover"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ProductionRecipeModal = ({
  storeId,
  products,
  ingredients,
  recipe,
  onClose,
  onSave,
  loading,
  onRequestCraft
}) => {
  const isEdit = !!(recipe && recipe.id);
  const normalizedMetadata =
    recipe && typeof recipe.metadata === 'object' && recipe.metadata !== null
      ? recipe.metadata
      : {};

  const [name, setName] = useState(recipe?.name || '');
  const [description, setDescription] = useState(recipe?.description || '');
  const [targetProductId, setTargetProductId] = useState(
    recipe?.target_product_id ? String(recipe.target_product_id) : ''
  );
  const [extraTargetProductIds, setExtraTargetProductIds] = useState([]);
  const [yieldsQuantity, setYieldsQuantity] = useState(
    recipe?.yields_quantity != null ? String(recipe.yields_quantity) : ''
  );
  const [yieldsUnit, setYieldsUnit] = useState(recipe?.yields_unit || 'unit');
  const [baseInputQuantity, setBaseInputQuantity] = useState(
    normalizedMetadata.base_input_quantity != null
      ? String(normalizedMetadata.base_input_quantity)
      : ''
  );
  const [baseInputUnit, setBaseInputUnit] = useState(
    normalizedMetadata.base_input_unit || 'kg'
  );
  const [yieldNotes, setYieldNotes] = useState(
    normalizedMetadata.yield_notes || ''
  );
  const [items, setItems] = useState([
    {
      id: `${Date.now()}_0`,
      component_type: 'ingredient',
      ingredient_id: '',
      product_id: '',
      quantity: '',
      unit: 'unit'
    }
  ]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!isEdit || !storeId || !recipe?.id) return;

    const fetchDetail = async () => {
      try {
        setLoadingDetail(true);
        const response = await axios.get(
          `/api/store/inventory/${storeId}/production/recipes/${recipe.id}`
        );
        const data = response.data || {};
        const r = data.recipe || recipe;
        const detailItems = Array.isArray(data.items) ? data.items : [];

        setName(r.name || '');
        setDescription(r.description || '');
        setYieldsQuantity(
          r.yields_quantity != null ? String(r.yields_quantity) : ''
        );
        setYieldsUnit(r.yields_unit || 'unit');

        const meta =
          r && typeof r.metadata === 'object' && r.metadata !== null
            ? r.metadata
            : {};

        const metaTargets = Array.isArray(meta.target_products)
          ? meta.target_products.map((id) => String(id))
          : [];
        const primaryTarget =
          metaTargets.length > 0
            ? metaTargets[0]
            : r.target_product_id
              ? String(r.target_product_id)
              : '';
        const extraTargets = metaTargets.length > 1 ? metaTargets.slice(1) : [];

        setTargetProductId(primaryTarget);
        setExtraTargetProductIds(extraTargets);
        setBaseInputQuantity(
          meta.base_input_quantity != null
            ? String(meta.base_input_quantity)
            : ''
        );
        setBaseInputUnit(meta.base_input_unit || 'kg');
        setYieldNotes(meta.yield_notes || '');

        if (detailItems.length > 0) {
          setItems(
            detailItems.map((it, index) => ({
              id: it.id || `${Date.now()}_${index}`,
              component_type: it.component_type || 'ingredient',
              ingredient_id: it.ingredient_id ? String(it.ingredient_id) : '',
              product_id: it.product_id ? String(it.product_id) : '',
              quantity: it.quantity != null ? String(it.quantity) : '',
              unit: it.unit || 'unit'
            }))
          );
        }
      } catch (error) {
        console.error('Error fetching production recipe detail:', error);
        const message =
          error?.response?.data?.error ||
          'No se pudo cargar el detalle de la receta de producción';
        toast.error(message);
      } finally {
        setLoadingDetail(false);
      }
    };

    fetchDetail();
  }, [isEdit, storeId, recipe?.id, recipe]);

  // Helper: convertir unidades a base (kg o L) para sumar
  const toBaseUnit = (qty, unit) => {
    const q = parseFloat(qty || '0');
    if (!Number.isFinite(q) || q <= 0) return 0;
    switch (unit) {
      case 'kg': return q;
      case 'g': return q / 1000;
      case 'L': return q;
      case 'ml': return q / 1000;
      default: return 0;
    }
  };

  // Calcular insumo base y unidad base automáticamente
  const autoBaseInput = useMemo(() => {
    const validItems = items.filter(it => {
      const qty = parseFloat(it.quantity || '0');
      const unit = (it.unit || '').trim().toLowerCase();
      return Number.isFinite(qty) && qty > 0 && ['kg', 'g', 'L', 'ml'].includes(unit);
    });

    if (validItems.length === 0) return { total: 0, unit: 'kg' };

    // Prioridad: kg > g > L > ml
    const candidateUnits = ['kg', 'g', 'L', 'ml'];
    let chosenUnit = 'kg';
    for (const u of candidateUnits) {
      if (validItems.some(it => (it.unit || '').trim().toLowerCase() === u)) {
        chosenUnit = u;
        break;
      }
    }

    const total = validItems.reduce((sum, it) => {
      const unit = (it.unit || '').trim().toLowerCase();
      return sum + toBaseUnit(it.quantity, unit);
    }, 0);

    // Normalizar a kg o L
    const normalizedUnit = (chosenUnit === 'kg' || chosenUnit === 'g') ? 'kg' : 'L';
    const normalizedTotal = (chosenUnit === 'kg' || chosenUnit === 'g') ? total : total;

    return { total: normalizedTotal, unit: normalizedUnit };
  }, [items]);

  // Autocompletar insumo base cuando cambia autoBaseInput y el campo está vacío o coincide con el cálculo anterior
  useEffect(() => {
    if (!autoBaseInput || !autoBaseInput.unit) return;
    const currentQty = parseFloat(baseInputQuantity || '0');
    const currentUnit = (baseInputUnit || '').trim();
    const autoQty = parseFloat(autoBaseInput.total.toFixed(3));
    const autoUnit = autoBaseInput.unit;

    // Si el campo está vacío o coincide con el cálculo anterior, lo actualizamos
    if (
      !baseInputQuantity ||
      !Number.isFinite(currentQty) ||
      currentQty <= 0 ||
      (currentUnit === autoUnit && Math.abs(currentQty - autoQty) < 0.001)
    ) {
      setBaseInputQuantity(String(autoQty));
      setBaseInputUnit(autoUnit);
    }
  }, [autoBaseInput, baseInputQuantity, baseInputUnit]);

  // Calcular ratio de rendimiento técnico
  const yieldRatio = useMemo(() => {
    const qty = parseFloat(yieldsQuantity || '0');
    const baseQty = parseFloat(baseInputQuantity || '0');
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(baseQty) || baseQty <= 0) return null;
    return qty / baseQty;
  }, [yieldsQuantity, baseInputQuantity, baseInputUnit]);

  // Formatear ratio con unidades
  const yieldRatioLabel = useMemo(() => {
    if (!yieldRatio || !yieldsUnit || !baseInputUnit) return '';
    return `${yieldRatio.toFixed(4)} ${yieldsUnit}/${baseInputUnit}`;
  }, [yieldRatio, yieldsUnit, baseInputUnit]);

  const handleItemChange = (index, changes) => {
    setItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, ...changes } : it))
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}_${prev.length}`,
        component_type: 'ingredient',
        ingredient_id: '',
        product_id: '',
        quantity: '',
        unit: 'kg' // por defecto kg para facilitar el cálculo
      }
    ]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const addTargetProduct = () => {
    setExtraTargetProductIds((prev) => [...prev, '']);
  };

  const updateExtraTargetProduct = (index, value) => {
    setExtraTargetProductIds((prev) =>
      prev.map((id, idx) => (idx === index ? value : id))
    );
  };

  const removeExtraTargetProduct = (index) => {
    setExtraTargetProductIds((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('El nombre de la receta es obligatorio');
      return;
    }

    const qtyNumber = parseFloat(yieldsQuantity || '0');
    if (!Number.isFinite(qtyNumber) || qtyNumber <= 0) {
      toast.error('El rendimiento debe ser mayor a 0');
      return;
    }

    if (!yieldsUnit) {
      toast.error('Selecciona una unidad de rendimiento');
      return;
    }

    const preparedItems = items
      .map((item) => {
        const type = item.component_type === 'product' ? 'product' : 'ingredient';
        const quantity = parseFloat(item.quantity || '0');
        const ingredientId =
          type === 'ingredient' ? (item.ingredient_id || '') : '';
        const productId = type === 'product' ? (item.product_id || '') : '';
        const unit = (item.unit || '').trim() || 'unit';

        if (!Number.isFinite(quantity) || quantity <= 0) return null;
        if (type === 'ingredient' && !ingredientId) return null;
        if (type === 'product' && !productId) return null;

        return {
          component_type: type,
          ingredient_id: ingredientId || null,
          product_id: productId || null,
          quantity,
          unit
        };
      })
      .filter(Boolean);

    if (preparedItems.length === 0) {
      toast.error('Agrega al menos un componente válido');
      return;
    }

    const baseQtyNumber = parseFloat(baseInputQuantity || '0');

    const allTargetIds = [
      ...(targetProductId ? [targetProductId] : []),
      ...extraTargetProductIds.filter((id) => id)
    ];
    const primaryTargetId = allTargetIds.length > 0 ? allTargetIds[0] : null;

    const metadata = {
      ...(normalizedMetadata && typeof normalizedMetadata === 'object'
        ? normalizedMetadata
        : {}),
      base_input_quantity:
        Number.isFinite(baseQtyNumber) && baseQtyNumber > 0
          ? baseQtyNumber
          : null,
      base_input_unit: baseInputUnit || null,
      yield_notes: yieldNotes.trim() || null,
      target_products: allTargetIds.length > 0 ? allTargetIds : undefined
    };

    const payload = {
      target_product_id: primaryTargetId,
      name: trimmedName,
      description: description.trim() || null,
      yields_quantity: qtyNumber,
      yields_unit: yieldsUnit,
      items: preparedItems,
      metadata
    };

    await onSave(payload);
  };

  const isSubmitting = loading || loadingDetail;

  const qtyPreview = parseFloat(yieldsQuantity || '0');
  const baseQtyPreview = parseFloat(baseInputQuantity || '0');
  const hasYieldRatio =
    Number.isFinite(qtyPreview) &&
    qtyPreview > 0 &&
    Number.isFinite(baseQtyPreview) &&
    baseQtyPreview > 0;
  const yieldRatioPreview = hasYieldRatio ? qtyPreview / baseQtyPreview : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto card-glass p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold">
            {isEdit ? 'Editar receta de producción' : 'Nueva receta de producción'}
          </h3>
          {isEdit && recipe?.id && (
            <button
              type="button"
              onClick={() => {
                if (typeof onRequestCraft === 'function') {
                  onRequestCraft(recipe);
                }
              }}
              className="px-3 py-1.5 rounded-full bg-accent/10 text-accent hover:bg-accent/20 text-xs"
            >
              Craftear con esta receta
            </button>
          )}
        </div>

        {isEdit && loadingDetail && (
          <p className="text-[11px] text-text/60">Cargando detalle de receta...</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-text/60 mb-1">Nombre de la receta</div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-glass w-full"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-text/60">Producto destino (opcional)</span>
                <button
                  type="button"
                  onClick={addTargetProduct}
                  className="px-2 py-0.5 rounded-full bg-glass hover:bg-glass-hover text-[11px]"
                >
                  + Agregar
                </button>
              </div>
              <div className="space-y-2">
                <select
                  value={targetProductId}
                  onChange={(e) => setTargetProductId(e.target.value)}
                  className="input-glass w-full"
                >
                  <option value="">Sin producto asociado</option>
                  {Array.isArray(products) &&
                    products.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name}
                      </option>
                    ))}
                </select>
                {extraTargetProductIds.map((id, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={id}
                      onChange={(e) =>
                        updateExtraTargetProduct(index, e.target.value)
                      }
                      className="input-glass w-full text-[11px]"
                    >
                      <option value="">Selecciona producto adicional</option>
                      {Array.isArray(products) &&
                        products.map((p) => (
                          <option key={p.id} value={String(p.id)}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeExtraTargetProduct(index)}
                      className="px-2 py-1 rounded-full bg-glass hover:bg-glass-hover text-[11px] text-red-300"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-text/60 mb-1">Rendimiento</div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={yieldsQuantity}
                onChange={(e) => setYieldsQuantity(e.target.value)}
                className="input-glass w-full"
              />
            </div>
            <div>
              <div className="text-text/60 mb-1">Unidad</div>
              <select
                value={yieldsUnit}
                onChange={(e) => setYieldsUnit(e.target.value)}
                className="input-glass w-full"
              >
                <option value="unit">Unidad</option>
                <option value="kg">Kilogramos (kg)</option>
                <option value="g">Gramos (g)</option>
                <option value="L">Litros (L)</option>
                <option value="ml">Mililitros (ml)</option>
              </select>
            </div>
          </div>

          <div>
            <div className="text-text/60 mb-1">Descripción (opcional)</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-glass w-full h-20 resize-none"
            />
          </div>

          <div>
            <div className="text-text/60 mb-1">Notas de rendimiento (opcional)</div>
            <textarea
              value={yieldNotes}
              onChange={(e) => setYieldNotes(e.target.value)}
              className="input-glass w-full h-16 resize-none text-[11px]"
              placeholder="Ej: 22 kg de tomate fresco generan 18 L de salsa terminada."
            />
          </div>

          <div>
            <div className="text-text/60 mb-1">Rendimiento técnico</div>
            <div className="text-[11px] text-text/70 border border-glass rounded-lg px-2 py-1 min-h-[32px] flex items-center">
              {hasYieldRatio ? (
                <span>
                  {yieldsQuantity || '0'} {yieldsUnit} desde{' '}
                  {baseInputQuantity || '0'} {baseInputUnit} (
                  {yieldRatio.toFixed(4)} {yieldsUnit}/{baseInputUnit})
                </span>
              ) : (
                <span className="text-text/50">
                  Agrega componentes con unidades de peso o volumen y completa el
                  rendimiento para ver la relación.
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-text/80">
                Componentes de la receta
              </h4>
              <button
                type="button"
                onClick={addItem}
                className="px-2 py-1 rounded-full bg-glass hover:bg-glass-hover text-[11px]"
              >
                + Agregar componente
              </button>
            </div>

            {items.map((item, index) => (
              <div
                key={item.id || index}
                className="border border-glass rounded-lg p-2 space-y-2 bg-background-dark/40"
              >
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <div>
                    <div className="text-[11px] text-text/60 mb-0.5">Tipo</div>
                    <select
                      value={
                        item.component_type === 'product' ? 'product' : 'ingredient'
                      }
                      onChange={(e) => {
                        const type =
                          e.target.value === 'product' ? 'product' : 'ingredient';
                        handleItemChange(index, {
                          component_type: type,
                          ingredient_id: '',
                          product_id: ''
                        });
                      }}
                      className="input-glass w-full text-[11px]"
                    >
                      <option value="ingredient">Ingrediente</option>
                      <option value="product">Producto</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-[11px] text-text/60 mb-0.5">
                      {item.component_type === 'product'
                        ? 'Producto'
                        : 'Ingrediente'}
                    </div>
                    {item.component_type === 'product' ? (
                      <select
                        value={item.product_id || ''}
                        onChange={(e) =>
                          handleItemChange(index, {
                            product_id: e.target.value,
                            ingredient_id: ''
                          })
                        }
                        className="input-glass w-full text-[11px]"
                      >
                        <option value="">Selecciona producto</option>
                        {Array.isArray(products) &&
                          products.map((p) => (
                            <option key={p.id} value={String(p.id)}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <select
                        value={item.ingredient_id || ''}
                        onChange={(e) =>
                          handleItemChange(index, {
                            ingredient_id: e.target.value,
                            product_id: ''
                          })
                        }
                        className="input-glass w-full text-[11px]"
                      >
                        <option value="">Selecciona ingrediente</option>
                        {Array.isArray(ingredients) &&
                          ingredients.map((ing) => (
                            <option key={ing.id} value={String(ing.id)}>
                              {ing.name} {ing.unit ? `(${ing.unit})` : ''}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <div className="text-[11px] text-text/60 mb-0.5">Cantidad</div>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(index, { quantity: e.target.value })
                      }
                      className="input-glass w-full text-[11px]"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] text-text/60 mb-0.5">Unidad</div>
                    <select
                      value={item.unit || 'unit'}
                      onChange={(e) =>
                        handleItemChange(index, { unit: e.target.value })
                      }
                      className="input-glass w-full text-[11px]"
                    >
                      <option value="unit">Unidad</option>
                      <option value="kg">Kilogramos (kg)</option>
                      <option value="g">Gramos (g)</option>
                      <option value="L">Litros (L)</option>
                      <option value="ml">Mililitros (ml)</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="px-2 py-1 rounded-full bg-glass hover:bg-glass-hover text-[11px] text-red-300"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-glass hover:bg-glass-hover"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? 'Guardando…'
                : isEdit
                  ? 'Guardar receta'
                  : 'Crear receta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ProductionCraftingModal = ({ recipe, onClose, onCraft, loading, storeId, ingredients, products, recipes, onSelectRecipe }) => {
  const [mode, setMode] = useState('byProduction'); // 'byProduction' o 'byIngredients'
  const [plannedQuantity, setPlannedQuantity] = useState(
    recipe?.yields_quantity != null ? String(recipe.yields_quantity) : ''
  );
  const [ingredientQuantities, setIngredientQuantities] = useState({});
  const [notes, setNotes] = useState('');
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [inventoryData, setInventoryData] = useState({});
  const [recipeSearch, setRecipeSearch] = useState('');

  useEffect(() => {
    if (!storeId || !recipe?.id) return;
    
    const fetchInventory = async () => {
      try {
        setLoadingInventory(true);
        const response = await axios.get(`/api/store/inventory/${storeId}`);
        const data = response.data || {};
        setInventoryData(data);
      } catch (error) {
        console.error('Error fetching inventory:', error);
        toast.error('No se pudo cargar el inventario actual');
      } finally {
        setLoadingInventory(false);
      }
    };

    fetchInventory();
  }, [storeId, recipe?.id]);

  useEffect(() => {
    if (!recipe) {
      setPlannedQuantity('');
      setIngredientQuantities({});
      setMode('byProduction');
      return;
    }
    setPlannedQuantity(
      recipe.yields_quantity != null ? String(recipe.yields_quantity) : ''
    );
    setIngredientQuantities({});
    setMode('byProduction');
  }, [recipe?.id]);

  const maxProductionByIngredients = useMemo(() => {
    if (!recipe?.items || !inventoryData?.ingredients || !inventoryData?.products) return null;

    const recipeItems = recipe.items.filter(item => 
      item.component_type === 'ingredient' || item.component_type === 'product'
    );

    if (recipeItems.length === 0) return null;

    const productionLimits = recipeItems.map(item => {
      const requiredQty = parseFloat(item.quantity || 0);
      if (requiredQty <= 0) return Infinity;

      let availableQty = 0;
      if (item.component_type === 'ingredient') {
        const ingredient = inventoryData.ingredients.find(inv => inv.id === item.ingredient_id);
        availableQty = parseFloat(ingredient?.stock_quantity || 0);
      } else if (item.component_type === 'product') {
        const product = inventoryData.products.find(inv => inv.id === item.product_id);
        availableQty = parseFloat(product?.stock_quantity || 0);
      }

      // Convertir unidades si es necesario
      const availableInBaseUnit = convertToBaseUnit(availableQty, item.unit);
      const requiredInBaseUnit = convertToBaseUnit(requiredQty, item.unit);

      return availableInBaseUnit / requiredInBaseUnit;
    });

    const maxFactor = Math.min(...productionLimits);
    const baseYield = parseFloat(recipe.yields_quantity || 0);
    
    return {
      factor: maxFactor,
      maxQuantity: baseYield * maxFactor,
      unit: recipe.yields_unit || 'unit'
    };
  }, [recipe, inventoryData]);

  const convertToBaseUnit = (qty, unit) => {
    const q = parseFloat(qty || '0');
    if (!Number.isFinite(q) || q <= 0) return 0;
    switch (unit) {
      case 'kg': return q;
      case 'g': return q / 1000;
      case 'L': return q;
      case 'ml': return q / 1000;
      default: return q;
    }
  };

  const productionByIngredients = useMemo(() => {
    if (mode !== 'byIngredients' || !recipe?.items) return null;

    const recipeItems = recipe.items.filter(item => 
      item.component_type === 'ingredient' || item.component_type === 'product'
    );

    if (recipeItems.length === 0) return null;

    const productionLimits = recipeItems.map(item => {
      const requiredQty = parseFloat(item.quantity || 0);
      if (requiredQty <= 0) return Infinity;

      const ingredientKey = `${item.component_type}_${item.component_type === 'ingredient' ? item.ingredient_id : item.product_id}`;
      const selectedQty = parseFloat(ingredientQuantities[ingredientKey] || 0);
      
      if (selectedQty <= 0) return Infinity;

      const selectedInBaseUnit = convertToBaseUnit(selectedQty, item.unit);
      const requiredInBaseUnit = convertToBaseUnit(requiredQty, item.unit);

      return selectedInBaseUnit / requiredInBaseUnit;
    });

    const maxFactor = Math.min(...productionLimits);
    const baseYield = parseFloat(recipe.yields_quantity || 0);
    
    return {
      factor: maxFactor,
      quantity: baseYield * maxFactor,
      unit: recipe.yields_unit || 'unit'
    };
  }, [mode, recipe, ingredientQuantities]);

  useEffect(() => {
    if (mode !== 'byIngredients' || !recipe?.items || !inventoryData?.ingredients || !inventoryData?.products) return;

    const initialQuantities = {};
    recipe.items.forEach(item => {
      if (item.component_type === 'ingredient' || item.component_type === 'product') {
        const key = `${item.component_type}_${item.component_type === 'ingredient' ? item.ingredient_id : item.product_id}`;
        
        let availableQty = 0;
        if (item.component_type === 'ingredient') {
          const ingredient = inventoryData.ingredients.find(inv => inv.id === item.ingredient_id);
          availableQty = parseFloat(ingredient?.stock_quantity || 0);
        } else if (item.component_type === 'product') {
          const product = inventoryData.products.find(inv => inv.id === item.product_id);
          availableQty = parseFloat(product?.stock_quantity || 0);
        }
        
        initialQuantities[key] = String(availableQty);
      }
    });
    
    setIngredientQuantities(initialQuantities);
  }, [mode, recipe, inventoryData]);

  const availableRecipes = Array.isArray(recipes) ? recipes : [];

  const filteredRecipes = useMemo(() => {
    const term = recipeSearch.trim().toLowerCase();
    if (!term) {
      return availableRecipes;
    }
    return availableRecipes.filter((r) => {
      if (!r || !r.name) return false;
      return r.name.toLowerCase().includes(term);
    });
  }, [availableRecipes, recipeSearch]);

  const qtyNumber = parseFloat(plannedQuantity || '0');
  const baseYield = parseFloat(recipe?.yields_quantity || '0');
  const hasValidRatio =
    Number.isFinite(qtyNumber) &&
    qtyNumber > 0 &&
    Number.isFinite(baseYield) &&
    baseYield > 0;
  const factor = hasValidRatio ? qtyNumber / baseYield : null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    let finalQuantity;
    if (mode === 'byProduction') {
      finalQuantity = parseFloat(plannedQuantity || '0');
      if (!Number.isFinite(finalQuantity) || finalQuantity <= 0) {
        toast.error('La cantidad a producir debe ser mayor a 0');
        return;
      }
    } else {
      finalQuantity = productionByIngredients?.quantity || 0;
      if (!Number.isFinite(finalQuantity) || finalQuantity <= 0) {
        toast.error('Debe seleccionar cantidades de ingredientes válidas');
        return;
      }
    }

    await onCraft(finalQuantity, notes.trim() || null);
  };

  const handleIngredientQuantityChange = (itemKey, value) => {
    setIngredientQuantities(prev => ({
      ...prev,
      [itemKey]: value
    }));
  };

  const getIngredientName = (item) => {
    if (item.component_type === 'ingredient') {
      const ingredient = ingredients.find(ing => ing.id === item.ingredient_id);
      return ingredient?.name || 'Ingrediente desconocido';
    } else {
      const product = products.find(prod => prod.id === item.product_id);
      return product?.name || 'Producto desconocido';
    }
  };

  const getAvailableStock = (item) => {
    if (item.component_type === 'ingredient') {
      const ingredient = inventoryData.ingredients?.find(inv => inv.id === item.ingredient_id);
      return parseFloat(ingredient?.stock_quantity || 0);
    } else {
      const product = inventoryData.products?.find(inv => inv.id === item.product_id);
      return parseFloat(product?.stock_quantity || 0);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[95vh] mx-auto overflow-y-auto card-glass p-4 sm:p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold">Centro de crafteo</h3>
            <span className="text-xs text-text/70 truncate max-w-[220px] hidden sm:block">
              {recipe?.name || 'Receta de producción'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-full bg-glass hover:bg-glass-hover text-xs w-full sm:w-auto"
          >
            Cerrar
          </button>
        </div>

        {availableRecipes.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] text-text/60">Seleccionar receta a craftear</div>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                placeholder="Buscar receta por nombre..."
                className="input-glass w-full text-xs"
              />
              <div className="max-h-32 overflow-y-auto rounded-lg border border-glass bg-glass/60">
                {filteredRecipes.map((r) => {
                  const isActive = recipe && r.id === recipe.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        if (!onSelectRecipe || (recipe && r.id === recipe.id)) return;
                        onSelectRecipe(r);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-[11px] flex items-center justify-between gap-2 hover:bg-glass-hover ${
                        isActive ? 'bg-accent/15 text-accent' : 'text-text/80'
                      }`}
                    >
                      <span className="truncate">{r.name}</span>
                      {typeof r.yields_quantity === 'number' && r.yields_unit && (
                        <span className="text-[10px] text-text/60">
                          {r.yields_quantity.toFixed(2)} {r.yields_unit}
                        </span>
                      )}
                    </button>
                  );
                })}
                {filteredRecipes.length === 0 && (
                  <div className="px-3 py-2 text-[11px] text-text/60">
                    No se encontraron recetas para ese término.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="text-[11px] text-text/70 space-y-1">
          <div>
            <span className="font-semibold">Rendimiento base: </span>
            <span>
              {Number(recipe?.yields_quantity || 0).toFixed(2)} {recipe?.yields_unit}
            </span>
          </div>
          {hasValidRatio && mode === 'byProduction' && (
            <div>
              <span className="font-semibold">Factor de producción: </span>
              <span>{factor.toFixed(4)}x de la receta base</span>
            </div>
          )}
          {maxProductionByIngredients && (
            <div>
              <span className="font-semibold">Producción máxima disponible: </span>
              <span>
                {maxProductionByIngredients.maxQuantity.toFixed(2)} {maxProductionByIngredients.unit}
                <span className="text-text/50 ml-1">
                  (basado en ingredientes disponibles)
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Selector de modo */}
        <div className="flex flex-col sm:flex-row gap-2 p-1 bg-glass rounded-lg">
          <button
            type="button"
            onClick={() => setMode('byProduction')}
            className={`flex-1 px-3 py-1.5 rounded text-xs transition-colors ${
              mode === 'byProduction'
                ? 'bg-accent/20 text-accent'
                : 'hover:bg-glass-hover text-text/80'
            }`}
          >
 Por cantidad a producir
          </button>
          <button
            type="button"
            onClick={() => setMode('byIngredients')}
            className={`flex-1 px-3 py-1.5 rounded text-xs transition-colors ${
              mode === 'byIngredients'
                ? 'bg-accent/20 text-accent'
                : 'hover:bg-glass-hover text-text/80'
            }`}
          >
 Por ingredientes disponibles
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {/* Materiales requeridos para la producción (solo lectura) */}
          {mode === 'byProduction' && hasValidRatio && (
            <div className="space-y-2">
              <div className="text-text/60 font-semibold">
                Materiales requeridos para {qtyNumber} {recipe?.yields_unit}:
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {recipe?.items
                  ?.filter(
                    (item) =>
                      item.component_type === 'ingredient' ||
                      item.component_type === 'product'
                  )
                  .map((item, index) => {
                    const baseQty = parseFloat(item.quantity || 0) || 0;
                    const requiredQty = factor != null ? baseQty * factor : baseQty;
                    const availableStock = getAvailableStock(item);
                    const hasEnoughStock = availableStock >= requiredQty;

                    return (
                      <div
                        key={index}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 bg-glass/50 rounded"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[10px] truncate">
                            {getIngredientName(item)}
                          </div>
                          <div className="text-[9px] text-text/50">
                            Requerido: {requiredQty.toFixed(2)} {item.unit}
                          </div>
                          <div className="text-[9px] text-text/50">
                            Disponible: {availableStock.toFixed(2)} {item.unit}
                          </div>
                        </div>
                        <div className="text-[9px] font-medium flex-shrink-0">
                          {hasEnoughStock ? (
                            <span className="text-green-400">✓ Suficiente</span>
                          ) : (
                            <span className="text-red-400">
                              ✗ Faltan {(requiredQty - availableStock).toFixed(2)} {item.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {mode === 'byProduction' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-text/60 mb-1">Cantidad a producir</div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={plannedQuantity}
                  onChange={(e) => setPlannedQuantity(e.target.value)}
                  className="input-glass w-full text-sm sm:text-xs"
                />
              </div>
              <div>
                <div className="text-text/60 mb-1">Unidad</div>
                <div className="input-glass w-full flex items-center h-[36px]">
                  <span className="text-[11px] sm:text-[10px] text-text/80">
                    {recipe?.yields_unit || 'unit'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-text/60 font-semibold">Ingredientes disponibles:</div>
              {loadingInventory ? (
                <div className="text-center py-4 text-text/50">Cargando inventario...</div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {recipe?.items?.filter(item => 
                    item.component_type === 'ingredient' || item.component_type === 'product'
                  ).map((item, index) => {
                    const itemKey = `${item.component_type}_${item.component_type === 'ingredient' ? item.ingredient_id : item.product_id}`;
                    const availableStock = getAvailableStock(item);
                    const requiredQty = parseFloat(item.quantity || 0);
                    
                    return (
                      <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 bg-glass/50 rounded">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[10px] truncate">
                            {getIngredientName(item)}
                          </div>
                          <div className="text-[9px] text-text/50">
                            Requerido: {requiredQty} {item.unit}
                          </div>
                          <div className="text-[9px] text-text/50">
                            Disponible: {availableStock} {item.unit}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <input
                            type="number"
                            min="0"
                            max={availableStock}
                            step="0.01"
                            value={ingredientQuantities[itemKey] || ''}
                            onChange={(e) => handleIngredientQuantityChange(itemKey, e.target.value)}
                            className="input-glass w-20 h-[24px] text-[10px]"
                            placeholder="0"
                          />
                          <span className="text-[9px] text-text/60 w-8 flex-shrink-0">
                            {item.unit}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {productionByIngredients && (
                <div className="mt-3 p-3 bg-accent/10 rounded border border-accent/20">
                  <div className="text-[10px] space-y-1">
                    <div>
                      <span className="font-semibold">Producción resultante: </span>
                      <span className="text-accent">
                        {productionByIngredients.quantity.toFixed(2)} {productionByIngredients.unit}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold">Factor de producción: </span>
                      <span>{productionByIngredients.factor.toFixed(4)}x</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <div className="text-text/60 mb-1">Notas del lote (opcional)</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-glass w-full h-20 resize-none"
              placeholder="Ej: Salsa napolitana Divorare 04 – lote especial para promo."
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-glass hover:bg-glass-hover w-full sm:w-auto order-2 sm:order-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || loadingInventory}
              className="px-4 py-1.5 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto order-1 sm:order-2"
            >
              {loading ? 'Crafteando…' : 'Craftear ahora'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const NewSupplierModal = ({
  onClose,
  onSave,
  loading,
  suppliers,
  onSelectExistingSupplier,
  initialTaxId
}) => {
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [rifPrefix, setRifPrefix] = useState('J');
  const [rifNumber, setRifNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [matchedSupplierId, setMatchedSupplierId] = useState(null);

  const supplierList = Array.isArray(suppliers) ? suppliers : [];

  useEffect(() => {
    if (!initialTaxId) {
      return;
    }

    const raw = String(initialTaxId).trim().toUpperCase();

    let prefix = 'J';
    let body = raw;

    if (/^[JVEC]/.test(raw)) {
      prefix = raw.charAt(0);
      body = raw.slice(1);
    }

    const digits = body.replace(/\D/g, '');

    if (!digits) {
      setTaxId('');
      setRifNumber('');
      setRifPrefix(prefix);
      return;
    }

    let formatted = digits;
    if (digits.length > 1) {
      formatted = `${digits.slice(0, -1)}-${digits.slice(-1)}`;
    }

    setRifPrefix(prefix);
    setRifNumber(formatted);
    setTaxId(`${prefix}${digits}`);
  }, [initialTaxId]);

  const handleRifPrefixChange = (value) => {
    setRifPrefix(value);
    const digits = rifNumber.replace(/\D/g, '');
    if (digits) {
      setTaxId(`${value}${digits}`);
    } else {
      setTaxId('');
    }
  };

  const handleRifNumberChange = (value) => {
    const digits = value.replace(/\D/g, '');
    let formatted = digits;
    if (digits.length > 1) {
      formatted = `${digits.slice(0, -1)}-${digits.slice(-1)}`;
    }
    setRifNumber(formatted);

    if (digits) {
      setTaxId(`${rifPrefix}${digits}`);
    } else {
      setTaxId('');
    }
  };

  useEffect(() => {
    if (!onSelectExistingSupplier || supplierList.length === 0) {
      return;
    }

    const normalized = (taxId || '').replace(/-/g, '').trim().toUpperCase();
    if (!normalized) {
      setMatchedSupplierId(null);
      return;
    }

    const existing = supplierList.find((s) => {
      if (typeof s.tax_id !== 'string') return false;
      const existingNorm = s.tax_id.replace(/-/g, '').trim().toUpperCase();
      return existingNorm === normalized;
    });

    if (existing && existing.id !== matchedSupplierId) {
      setMatchedSupplierId(existing.id);
      onSelectExistingSupplier(existing);
    }
  }, [taxId, supplierList, onSelectExistingSupplier, matchedSupplierId]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      name: name.trim(),
      tax_id: taxId.trim() || undefined,
      contact_name: contactName.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined
    };

    if (!payload.name) {
      toast.error('El nombre del proveedor es obligatorio');
      return;
    }

    await onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md card-glass p-6 space-y-4"
      >
        <h3 className="text-lg font-bold">Nuevo proveedor</h3>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <div className="text-text/60 mb-1">Identificador fiscal (RIF)</div>
            <div className="flex gap-2">
              <select
                className="input-glass w-20 text-xs"
                value={rifPrefix}
                onChange={(e) => handleRifPrefixChange(e.target.value)}
              >
                <option value="J">J</option>
                <option value="V">V</option>
                <option value="E">E</option>
                <option value="C">C</option>
              </select>
              <input
                type="text"
                value={rifNumber}
                onChange={(e) => handleRifNumberChange(e.target.value)}
                className="input-glass flex-1"
                placeholder="50722367-1"
              />
            </div>
            <div className="text-[10px] text-text/60 mt-0.5">
              Escribe el RIF. Si ya existe un proveedor con ese RIF se cargarán sus datos.
            </div>
          </div>
          <div>
            <div className="text-text/60 mb-1">Nombre</div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-glass w-full"
              required
            />
          </div>
          <div>
            <div className="text-text/60 mb-1">Persona de contacto</div>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="input-glass w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-text/60 mb-1">Teléfono</div>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-glass w-full"
              />
            </div>
            <div>
              <div className="text-text/60 mb-1">Email</div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-glass w-full"
              />
            </div>
          </div>
          <div>
            <div className="text-text/60 mb-1">Dirección</div>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input-glass w-full h-20 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-glass hover:bg-glass-hover"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando…' : 'Guardar proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SupplierDetailModal = ({ supplier, onClose, onSave, loading }) => {
  const formatRifForDisplay = (raw) => {
    if (!raw) return '';
    let s = String(raw).trim().toUpperCase();

    let prefix = '';
    let body = s;

    if (/^[JVEC]/.test(s)) {
      prefix = s.charAt(0);
      body = s.slice(1);
    }

    const digits = body.replace(/\D/g, '');
    if (!digits) return s;

    let formattedNumber = digits;
    if (digits.length > 1) {
      formattedNumber = `${digits.slice(0, -1)}-${digits.slice(-1)}`;
    }

    return prefix ? `${prefix}-${formattedNumber}` : formattedNumber;
  };

  const [name, setName] = useState(supplier?.name || '');
  const [contactName, setContactName] = useState(supplier?.contact_name || '');
  const [phone, setPhone] = useState(supplier?.phone || '');
  const [email, setEmail] = useState(supplier?.email || '');
  const [address, setAddress] = useState(supplier?.address || '');

  useEffect(() => {
    setName(supplier?.name || '');
    setContactName(supplier?.contact_name || '');
    setPhone(supplier?.phone || '');
    setEmail(supplier?.email || '');
    setAddress(supplier?.address || '');
  }, [supplier]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      name: name.trim(),
      contact_name: contactName.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined
    };

    if (!payload.name) {
      toast.error('El nombre del proveedor es obligatorio');
      return;
    }

    await onSave(payload);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md card-glass p-6 space-y-4"
      >
        <h3 className="text-lg font-bold">Proveedor</h3>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <div className="text-text/60 mb-1">Identificador fiscal (RIF)</div>
            <input
              type="text"
              value={formatRifForDisplay(supplier?.tax_id || '')}
              className="input-glass w-full opacity-75"
              readOnly
              disabled
            />
            <div className="text-[10px] text-text/60 mt-0.5">
              El RIF no puede modificarse.
            </div>
          </div>
          <div>
            <div className="text-text/60 mb-1">Nombre</div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-glass w-full"
              required
            />
          </div>
          <div>
            <div className="text-text/60 mb-1">Persona de contacto</div>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="input-glass w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-text/60 mb-1">Teléfono</div>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-glass w-full"
              />
            </div>
            <div>
              <div className="text-text/60 mb-1">Email</div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-glass w-full"
              />
            </div>
          </div>
          <div>
            <div className="text-text/60 mb-1">Dirección</div>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input-glass w-full h-20 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-glass hover:bg-glass-hover"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const NewPurchaseModal = ({
  suppliers,
  products,
  ingredients,
  categories,
  vesPerUsdt,
  storeId,
  onCreateProduct,
  onClose,
  onSave,
  loading
}) => {
  const [supplierId, setSupplierId] = useState('');
  const [rifPrefix, setRifPrefix] = useState('J');
  const [rifNumber, setRifNumber] = useState('');
  const [rifTaxIdSearch, setRifTaxIdSearch] = useState('');
  const [matchedSupplier, setMatchedSupplier] = useState(null);
  const [showSupplierDetailModal, setShowSupplierDetailModal] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [notes, setNotes] = useState('');
  const [invoiceImage, setInvoiceImage] = useState('');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(null);
  
  useEffect(() => {
    if (vesPerUsdt == null) {
      setExchangeRate(null);
      return;
    }
    const parsed = Number(vesPerUsdt);
    if (Number.isFinite(parsed) && parsed > 0) {
      setExchangeRate(parsed);
    } else {
      setExchangeRate(null);
    }
  }, [vesPerUsdt]);
  const [createdProducts, setCreatedProducts] = useState([]);
  const [createdIngredients, setCreatedIngredients] = useState([]);
  const [items, setItems] = useState([
    {
      kind: 'product',
      productId: '',
      ingredientId: '',
      modifierId: '',
      quantity: '',
      unitCost: '',
      unitCostVES: '',
      unit: '',
      taxRate: '0',
      description: '',
      searchTerm: '',
      sku: ''
    }
  ]);

  const extendedProducts = useMemo(
    () => [
      ...(Array.isArray(products) ? products : []),
      ...createdProducts
    ],
    [products, createdProducts]
  );

  const extendedIngredients = useMemo(
    () => [
      ...(Array.isArray(ingredients) ? ingredients : []),
      ...createdIngredients
    ],
    [ingredients, createdIngredients]
  );

  const categoryNameMap = useMemo(() => {
    const map = {};
    const list = Array.isArray(categories) ? categories : [];
    for (const cat of list) {
      if (!cat || cat.id == null) continue;
      map[String(cat.id)] = cat.name || '';
    }
    return map;
  }, [categories]);

  const getDefaultCategoryId = () => {
    if (Array.isArray(categories) && categories.length > 0) {
      return categories[0].id;
    }
    return null;
  };

  const generateNumericSku = () =>
    String(Math.floor(100000000 + Math.random() * 900000000));

  const supplierList = Array.isArray(suppliers) ? suppliers : [];

  const currentSupplier = useMemo(() => {
    if (matchedSupplier) return matchedSupplier;
    if (supplierId && supplierList.length) {
      return (
        supplierList.find((s) => String(s.id) === String(supplierId)) || null
      );
    }
    return null;
  }, [matchedSupplier, supplierId, supplierList]);

  const formatRifForDisplay = (raw) => {
    if (!raw) return '';
    let s = String(raw).trim().toUpperCase();

    let prefix = '';
    let body = s;

    if (/^[JVEC]/.test(s)) {
      prefix = s.charAt(0);
      body = s.slice(1);
    }

    const digits = body.replace(/\D/g, '');
    if (!digits) return s;

    let formattedNumber = digits;
    if (digits.length > 1) {
      formattedNumber = `${digits.slice(0, -1)}-${digits.slice(-1)}`;
    }

    return prefix ? `${prefix}-${formattedNumber}` : formattedNumber;
  };

  const handleRifSearchPrefixChange = (value) => {
    setRifPrefix(value);
    const digits = rifNumber.replace(/\D/g, '');
    if (digits) {
      setRifTaxIdSearch(`${value}${digits}`);
    } else {
      setRifTaxIdSearch('');
    }
  };

  const handleRifSearchNumberChange = (value) => {
    const digits = value.replace(/\D/g, '');
    let formatted = digits;
    if (digits.length > 1) {
      formatted = `${digits.slice(0, -1)}-${digits.slice(-1)}`;
    }
    setRifNumber(formatted);

    if (digits) {
      setRifTaxIdSearch(`${rifPrefix}${digits}`);
    } else {
      setRifTaxIdSearch('');
    }
  };

  useEffect(() => {
    if (!rifTaxIdSearch) {
      setMatchedSupplier(null);
      return;
    }

    const list = Array.isArray(suppliers) ? suppliers : [];
    if (list.length === 0) {
      setMatchedSupplier(null);
      return;
    }

    const normalized = rifTaxIdSearch.replace(/-/g, '').trim().toUpperCase();

    const existing = list.find((s) => {
      if (typeof s.tax_id !== 'string') return false;
      const existingNorm = s.tax_id.replace(/-/g, '').trim().toUpperCase();
      return existingNorm === normalized;
    });

    if (existing) {
      setMatchedSupplier(existing);
      const existingId = String(existing.id);
      if (existingId !== String(supplierId || '')) {
        setSupplierId(existing.id);
      }
    } else {
      setMatchedSupplier(null);
    }
  }, [rifTaxIdSearch, suppliers, supplierId]);

  useEffect(() => {
    if (supplierId && suppliers) {
      const selectedSupplier = suppliers.find(
        (s) => String(s.id) === String(supplierId)
      );
      if (selectedSupplier) {
        const rawTaxId = selectedSupplier.tax_id || '';
        if (rawTaxId) {
          let s = String(rawTaxId).trim().toUpperCase();

          let prefix = 'J';
          let body = s;

          if (/^[JVEC]/.test(s)) {
            prefix = s.charAt(0);
            body = s.slice(1);
          }

          const digits = body.replace(/\D/g, '');

          if (digits) {
            let formatted = digits;
            if (digits.length > 1) {
              formatted = `${digits.slice(0, -1)}-${digits.slice(-1)}`;
            }

            setRifPrefix(prefix);
            setRifNumber(formatted);
            setRifTaxIdSearch(`${prefix}${digits}`);
          } else {
            setRifTaxIdSearch('');
          }
        } else {
          setRifTaxIdSearch('');
        }
      }
    } else {
      setRifTaxIdSearch('');
    }
  }, [supplierId, suppliers]);

  // Auto-convert prices
  const updateItem = (index, changes) => {
    setItems((prev) => {
      const newItems = prev.map((item, idx) => (idx === index ? { ...item, ...changes } : item));
      const updatedItem = newItems[index];
      
      // Auto-convert between USD and VES
      if (changes.unitCost !== undefined && exchangeRate) {
        const usdValue = parseFloat(changes.unitCost) || 0;
        if (!isNaN(usdValue) && usdValue >= 0) {
          updatedItem.unitCostVES = (usdValue * exchangeRate).toFixed(2);
        }
      } else if (changes.unitCostVES !== undefined && exchangeRate) {
        const vesValue = parseFloat(changes.unitCostVES) || 0;
        if (!isNaN(vesValue) && vesValue >= 0) {
          updatedItem.unitCost = (vesValue / exchangeRate).toFixed(4);
        }
      }
      
      return newItems;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        kind: 'product',
        productId: '',
        ingredientId: '',
        modifierId: '',
        quantity: '',
        unitCost: '',
        unitCostVES: '',
        unit: '',
        taxRate: '0',
        description: '',
        searchTerm: '',
        sku: ''
      }
    ]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Calculate summary totals
  const calculateSummary = () => {
    return items.map(item => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitCostUSD = parseFloat(item.unitCost) || 0;
      const unitCostVES = parseFloat(item.unitCostVES) || 0;
      const taxRate = parseFloat(item.taxRate) || 0;
      
      const subtotalUSD = quantity * unitCostUSD;
      const subtotalVES = quantity * unitCostVES;
      const taxUSD = subtotalUSD * (taxRate / 100);
      const taxVES = subtotalVES * (taxRate / 100);
      const totalUSD = subtotalUSD + taxUSD;
      const totalVES = subtotalVES + taxVES;
      
      // Get item name
      let itemName = 'Item sin nombre';
      if (item.kind === 'product') {
        const product = extendedProducts.find(p => p.id === item.productId);
        itemName = product?.name || item.searchTerm || 'Producto no encontrado';
      } else if (item.kind === 'ingredient') {
        const ingredient = extendedIngredients.find(i => i.id === item.ingredientId);
        itemName = ingredient?.name || item.searchTerm || 'Ingrediente no encontrado';
      } else if (item.searchTerm) {
        itemName = item.searchTerm;
      }
      
      return {
        name: itemName,
        quantity: quantity,
        unit: item.unit || 'unit',
        unitCostUSD: unitCostUSD,
        unitCostVES: unitCostVES,
        subtotalUSD: subtotalUSD,
        subtotalVES: subtotalVES,
        taxUSD: taxUSD,
        taxVES: taxVES,
        totalUSD: totalUSD,
        totalVES: totalVES
      };
    });
  };

  const summaryItems = calculateSummary();
  const grandTotalUSD = summaryItems.reduce((sum, item) => sum + item.totalUSD, 0);
  const grandTotalVES = summaryItems.reduce((sum, item) => sum + item.totalVES, 0);

  const handleCreateProductFromItem = async (index) => {
    try {
      if (!onCreateProduct) {
        toast.error('No se puede crear producto desde aquí');
        return;
      }

      const item = items[index];
      const name = (item.searchTerm || '').trim();
      if (!name) {
        toast.error('Escribe un nombre para el producto');
        return;
      }

      const defaultCategoryId = getDefaultCategoryId();
      if (!defaultCategoryId) {
        toast.error('Configura al menos una categoría antes de crear productos');
        return;
      }

      const sku = (item.sku || '').trim() || generateNumericSku();
      const unitCostNumber = parseFloat(item.unitCost || '0');
      const priceUsdt =
        Number.isFinite(unitCostNumber) && unitCostNumber >= 0 ? unitCostNumber : 0;

      const payload = {
        sku,
        name,
        description: (item.description || '').trim(),
        category_id: defaultCategoryId,
        price_usdt: priceUsdt,
        price_fires: '',
        is_menu_item: true,
        has_modifiers: false,
        accepts_fires: false,
        stock: 0,
        min_stock_alert: 0
      };

      const newProduct = await onCreateProduct(payload);
      if (newProduct && newProduct.id) {
        setCreatedProducts((prev) => [...prev, newProduct]);
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === index
              ? {
                  ...it,
                  kind: 'product',
                  productId: newProduct.id,
                  ingredientId: '',
                  searchTerm: newProduct.name || name,
                  sku: newProduct.sku || sku
                }
              : it
          )
        );
        toast.success('Producto creado desde la factura');
      }
    } catch (error) {
      console.error('Error creating product from invoice:', error);
      const message = error?.response?.data?.error || 'Error al crear producto';
      toast.error(message);
    }
  };

  const handleCreateIngredientFromItem = async (index) => {
    try {
      if (!storeId) {
        toast.error('No se pudo determinar la tienda para crear ingrediente');
        return;
      }

      const item = items[index];
      const name = (item.searchTerm || '').trim();
      if (!name) {
        toast.error('Escribe un nombre para el ingrediente');
        return;
      }

      const unitValue = item.unit || 'unit';
      const unitCostNumber = parseFloat(item.unitCost || '0');
      const costPerUnitUsdt =
        Number.isFinite(unitCostNumber) && unitCostNumber >= 0 ? unitCostNumber : 0;

      const payload = {
        name,
        unit: unitValue,
        cost_per_unit_usdt: costPerUnitUsdt,
        current_stock: 0,
        min_stock_alert: 0
      };

      const response = await axios.post(
        `/api/store/inventory/${storeId}/ingredient`,
        payload
      );

      const newIngredient = response.data;
      if (newIngredient && newIngredient.id) {
        setCreatedIngredients((prev) => [...prev, newIngredient]);
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === index
              ? {
                  ...it,
                  kind: 'ingredient',
                  ingredientId: newIngredient.id,
                  productId: '',
                  searchTerm: newIngredient.name || name,
                  unit: newIngredient.unit || unitValue
                }
              : it
          )
        );
        toast.success('Ingrediente creado desde la factura');
      }
    } catch (error) {
      console.error('Error creating ingredient from invoice:', error);
      const message = error?.response?.data?.error || 'Error al crear ingrediente';
      toast.error(message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const preparedItems = items
      .map((item) => {
        const quantity = parseFloat(item.quantity || '0');
        const unitCost = parseFloat(item.unitCost || '0');

        if (!Number.isFinite(quantity) || quantity <= 0) return null;
        if (!Number.isFinite(unitCost) || unitCost < 0) return null;

        const isProduct = item.kind === 'product' && item.productId;
        const isIngredient = item.kind === 'ingredient' && item.ingredientId;

        if (!isProduct && !isIngredient) return null;

        return {
          product_id: isProduct ? item.productId : null,
          ingredient_id: isIngredient ? item.ingredientId : null,
          modifier_id: isProduct && item.modifierId ? item.modifierId : null,
          description: item.description?.trim() || null,
          quantity,
          unit_cost_usdt: unitCost
        };
      })
      .filter(Boolean);

    if (preparedItems.length === 0) {
      toast.error('Agrega al menos un ítem válido');
      return;
    }

    const payload = {
      supplier_id: supplierId || null,
      invoice_number: invoiceNumber.trim() || null,
      invoice_date: invoiceDate || null,
      notes: notes.trim() || null,
      items: preparedItems,
      invoice_image_url: invoiceImage || null
    };

    await onSave(payload);
  };

  return (
    <>
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
      
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[90vh] card-glass p-6 space-y-4 overflow-y-auto custom-scrollbar"
        >
          <h3 className="text-lg font-bold">Nueva factura de compra</h3>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-2">
            <div className="text-text/60 mb-1">Buscar proveedor por RIF</div>
            <div className="flex gap-2">
              <select
                className="input-glass w-20 text-xs"
                value={rifPrefix}
                onChange={(e) => handleRifSearchPrefixChange(e.target.value)}
              >
                <option value="J">J</option>
                <option value="V">V</option>
                <option value="E">E</option>
                <option value="C">C</option>
              </select>
              <input
                type="text"
                value={rifNumber}
                onChange={(e) => handleRifSearchNumberChange(e.target.value)}
                className="input-glass flex-1"
                placeholder="50722367-1"
              />
            </div>
            {currentSupplier ? (
              <button
                type="button"
                onClick={() => setShowSupplierDetailModal(true)}
                className="text-[10px] text-accent underline hover:text-accent/80 text-left"
              >
                RIF: {formatRifForDisplay(currentSupplier.tax_id || '')} – ver datos del proveedor
              </button>
            ) : rifTaxIdSearch ? (
              <div className="text-[10px] text-text/60">
                No se encontró proveedor con ese RIF. Puedes crearlo con "+ Nuevo".
              </div>
            ) : (
              <div className="text-[10px] text-text/60">
                Escribe el RIF del proveedor para buscarlo.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-text/60 mb-1">Proveedor</div>
              <div className="flex gap-2">
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="input-glass w-full"
                >
                  <option value="">Sin proveedor</option>
                  {supplierList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (currentSupplier) {
                      setShowSupplierDetailModal(true);
                      return;
                    }
                    setShowNewSupplierModal(true);
                  }}
                  className="px-3 py-1.5 rounded-full bg-accent/20 text-accent hover:bg-accent/30 text-[11px] whitespace-nowrap"
                >
                  + Nuevo
                </button>
              </div>
            </div>
            <div>
              <div className="text-text/60 mb-1">Nº de factura</div>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="input-glass w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-text/60 mb-1">Fecha</div>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="input-glass w-full"
              />
            </div>
          </div>

          <div>
            <div className="text-text/60 mb-1">Notas</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-glass w-full h-16 resize-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-text/80">Ítems de la factura</h4>
              <button
                type="button"
                onClick={addItem}
                className="px-2 py-1 rounded-full bg-glass hover:bg-glass-hover text-[11px]"
              >
                Agregar ítem
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-text/60 text-[11px]">Foto de la factura (opcional)</div>
              <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center px-3 py-1.5 rounded-full bg-glass hover:bg-glass-hover text-[11px] cursor-pointer border border-glass">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files && e.target.files[0];
                        if (!file) return;

                        const result = await processProductImageFile(file, MAX_PRODUCT_IMAGE_MB);
                        if (result.error) {
                          toast.error(result.error);
                        } else if (result.base64) {
                          setInvoiceImage(result.base64);
                          toast.success('Imagen de factura cargada');
                        }
                      }}
                    />
                    <span>Subir foto de factura</span>
                  </label>
                  <CameraButton
                    onPhotoTaken={async (file) => {
                      const result = await processProductImageFile(file, MAX_PRODUCT_IMAGE_MB);
                      if (result.error) {
                        toast.error(result.error);
                      } else if (result.base64) {
                        setInvoiceImage(result.base64);
                        toast.success('Foto de factura capturada');
                      }
                    }}
                    size="sm"
                    className="rounded-full"
                  />
                </div>

                {invoiceImage && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <div className="w-16 h-16 rounded-md overflow-hidden border border-glass bg-black/40">
                      <img src={invoiceImage} alt="Factura" className="w-full h-full object-cover" />
                    </div>
                    <button
                      type="button"
                      disabled={isOcrLoading}
                      onClick={async () => {
                        try {
                          setIsOcrLoading(true);
                          const storeId = products[0]?.store_id || null;
                          if (!storeId) {
                            toast.error('No se pudo determinar la tienda para leer la factura');
                            setIsOcrLoading(false);
                            return;
                          }

                          const response = await axios.post(`/api/store/${storeId}/inventory/purchases/ocr-preview`, {
                            invoice_image_url: invoiceImage
                          });

                          const data = response.data || {};

                          if (data.invoice_number != null) {
                            setInvoiceNumber(String(data.invoice_number));
                          }
                          if (data.invoice_date != null) {
                            setInvoiceDate(String(data.invoice_date));
                          }
                          if (data.notes != null && typeof data.notes === 'string') {
                            setNotes((prev) => (prev ? `${prev}\n${data.notes}` : data.notes));
                          }

                          if (Array.isArray(data.items) && data.items.length > 0) {
                            setItems((prev) => {
                              // Si no hay ítems válidos aún, reemplazar, si no, concatenar
                              const hasExistingValid = prev.some((it) => it.productId || it.ingredientId);
                              const mapped = data.items.map((line) => ({
                                kind: line.kind === 'ingredient' ? 'ingredient' : 'product',
                                productId: '',
                                ingredientId: '',
                                modifierId: '',
                                quantity: line.quantity != null ? String(line.quantity) : '',
                                unitCost: line.unit_cost_usdt != null ? String(line.unit_cost_usdt) : '',
                                description: line.description || ''
                              }));

                              return hasExistingValid ? [...prev, ...mapped] : mapped;
                            });
                          }

                          toast.success('ron-ia analizó la factura (preview stub)');
                        } catch (error) {
                          const message = error?.response?.data?.error || 'No se pudo leer la factura';
                          toast.error(message);
                        } finally {
                          setIsOcrLoading(false);
                        }
                      }}
                      className="px-3 py-1.5 rounded-full bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isOcrLoading ? 'Leyendo factura…' : 'Leer factura con ron-ia'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {items.map((item, index) => {
                const searchRaw = (item.searchTerm || '').trim().toLowerCase();

                let suggestions = [];
                if (searchRaw) {
                  const productMatches = extendedProducts
                    .filter((p) => {
                      const haystack = `${p.name || ''} ${p.sku || ''}`.toLowerCase();
                      return haystack.includes(searchRaw);
                    })
                    .slice(0, 4);

                  const ingredientMatches = extendedIngredients
                    .filter((ing) => {
                      const haystack = `${ing.name || ''}`.toLowerCase();
                      return haystack.includes(searchRaw);
                    })
                    .slice(0, 4);

                  suggestions = [
                    ...productMatches.map((p) => ({
                      type: 'product',
                      id: p.id,
                      name: p.name || '',
                      sku: p.sku || '',
                      unit: p.unit || p.presentation_unit || ''
                    })),
                    ...ingredientMatches.map((ing) => ({
                      type: 'ingredient',
                      id: ing.id,
                      name: ing.name || '',
                      unit: ing.unit || ''
                    }))
                  ].slice(0, 4);
                }

                const selectedProduct =
                  item.kind === 'product' && item.productId
                    ? extendedProducts.find(
                        (p) => String(p.id) === String(item.productId)
                      )
                    : null;
                const mods = Array.isArray(selectedProduct?.modifiers)
                  ? selectedProduct.modifiers
                  : [];

                let lastPrice = null;
                if (item.kind === 'product' && selectedProduct) {
                  const raw =
                    selectedProduct.last_purchase_unit_cost_usdt != null
                      ? Number(selectedProduct.last_purchase_unit_cost_usdt)
                      : Number(selectedProduct.cost_usdt ?? NaN);
                  if (Number.isFinite(raw) && raw > 0) lastPrice = raw;
                } else if (item.kind === 'ingredient' && item.ingredientId) {
                  const ing = extendedIngredients.find(
                    (i) => String(i.id) === String(item.ingredientId)
                  );
                  if (ing && ing.last_purchase_unit_cost_usdt != null) {
                    const raw = Number(ing.last_purchase_unit_cost_usdt);
                    if (Number.isFinite(raw) && raw > 0) lastPrice = raw;
                  }
                }

                let categoryName = null;
                if (item.kind === 'product' && selectedProduct) {
                  const catId = selectedProduct.category_id;
                  if (catId) {
                    categoryName = categoryNameMap[String(catId)] || null;
                  }
                }

                const quantityNum = parseFloat(item.quantity || '0') || 0;
                const unitCostUSDNum = parseFloat(item.unitCost || '0') || 0;
                const unitCostVESNum = parseFloat(item.unitCostVES || '0') || 0;
                const taxRateNum = parseFloat(item.taxRate || '0') || 0;

                let pricePerOneUSD = null;
                let pricePerOneVES = null;
                if (quantityNum > 0 && (unitCostUSDNum > 0 || unitCostVESNum > 0)) {
                  if (unitCostUSDNum > 0) pricePerOneUSD = unitCostUSDNum;
                  if (unitCostVESNum > 0) pricePerOneVES = unitCostVESNum;
                }

                let taxLineUSD = 0;
                let taxLineVES = 0;
                if (
                  quantityNum > 0 &&
                  taxRateNum > 0 &&
                  (unitCostUSDNum > 0 || unitCostVESNum > 0)
                ) {
                  const subtotalUSD = quantityNum * unitCostUSDNum;
                  const subtotalVES = quantityNum * unitCostVESNum;
                  taxLineUSD = subtotalUSD * (taxRateNum / 100);
                  taxLineVES = subtotalVES * (taxRateNum / 100);
                }

                const unitLabel = item.unit || 'unidad';

                return (
                  <div
                    key={index}
                    className="border border-glass rounded-lg p-2 space-y-2 bg-background-dark/40"
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="md:col-span-2">
                        <div className="text-[11px] text-text/60 mb-0.5">
                          Nombre / buscador
                        </div>
                        <input
                          type="text"
                          value={item.searchTerm}
                          onChange={(e) =>
                            updateItem(index, { searchTerm: e.target.value })
                          }
                          className="input-glass w-full text-[11px]"
                          placeholder={
                            item.kind === 'product'
                              ? 'Nombre o SKU de producto'
                              : 'Nombre de ingrediente'
                          }
                        />
                        {searchRaw && suggestions.length > 0 && (
                          <div className="mt-1 space-y-1">
                            {suggestions.map((s) => (
                              <button
                                key={`${s.type}-${s.id}`}
                                type="button"
                                onClick={() => {
                                  if (s.type === 'product') {
                                    updateItem(index, {
                                      kind: 'product',
                                      productId: s.id,
                                      ingredientId: '',
                                      modifierId: '',
                                      searchTerm: s.name,
                                      sku: s.sku || item.sku || '',
                                      unit: s.unit || item.unit
                                    });
                                  } else {
                                    updateItem(index, {
                                      kind: 'ingredient',
                                      ingredientId: s.id,
                                      productId: '',
                                      modifierId: '',
                                      searchTerm: s.name,
                                      unit: s.unit || item.unit
                                    });
                                  }
                                }}
                                className="w-full text-left px-2 py-1 rounded-md bg-glass hover:bg-glass-hover text-[10px]"
                              >
                                <span className="font-medium">{s.name}</span>
                                {s.type === 'product' && s.sku && (
                                  <span className="ml-1 text-text/60">#{s.sku}</span>
                                )}
                                <span className="ml-2 text-text/60">
                                  {s.type === 'product' ? 'Producto' : 'Ingrediente'}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="mt-1">
                          <div className="flex items-center justify-between mb-0.5 text-[11px] text-text/60">
                            <span>SKU (solo números)</span>
                            <button
                              type="button"
                              onClick={() =>
                                updateItem(index, { sku: generateNumericSku() })
                              }
                              className="px-2 py-0.5 rounded-full bg-glass hover:bg-glass-hover text-[9px]"
                            >
                              Auto
                            </button>
                          </div>
                          <input
                            type="text"
                            value={item.sku}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              updateItem(index, { sku: value });
                            }}
                            className="input-glass w-full text-[11px]"
                            placeholder="SKU numérico"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-text/60 mb-0.5">Tipo</div>
                        <select
                          value={item.kind}
                          onChange={(e) => {
                            const kind =
                              e.target.value === 'ingredient' ? 'ingredient' : 'product';
                            updateItem(index, {
                              kind,
                              productId: '',
                              ingredientId: '',
                              modifierId: ''
                            });
                          }}
                          className="input-glass w-full text-[11px]"
                        >
                          <option value="product">Producto terminado</option>
                          <option value="ingredient">Ingrediente</option>
                        </select>
                      </div>
                      <div>
                        <div className="text-[11px] text-text/60 mb-0.5">
                          Categoría (opcional)
                        </div>
                        <div className="input-glass w-full text-[10px] py-1 px-2 flex items-center">
                          {categoryName ? (
                            <span className="text-text/80 truncate">{categoryName}</span>
                          ) : (
                            <span className="text-text/40 italic truncate">
                              Sin categoría
                            </span>
                          )}
                        </div>
                      </div>
                      {item.kind === 'product' && mods.length > 0 && (
                        <div className="md:col-span-2">
                          <div className="text-[11px] text-text/60 mb-0.5">
                            Variante (opcional)
                          </div>
                          <select
                            value={item.modifierId || ''}
                            onChange={(e) =>
                              updateItem(index, { modifierId: e.target.value })
                            }
                            className="input-glass w-full text-[11px]"
                          >
                            <option value="">Sin variante específica</option>
                            {mods.map((mod) => {
                              const extra = Number(mod.price_adjustment_usdt || 0);
                              const extraLabel =
                                Number.isFinite(extra) && extra !== 0
                                  ? ` (+$${extra.toFixed(2)})`
                                  : '';
                              const baseLabel = mod.group_name
                                ? `${mod.group_name}: ${mod.name}`
                                : mod.name;
                              return (
                                <option key={mod.id} value={mod.id}>
                                  {baseLabel}
                                  {extraLabel}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}
                      <div className="md:col-span-2">
                        <div className="text-[11px] text-text/60 mb-0.5">
                          Costo unitario
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              value={item.unitCost}
                              onChange={(e) =>
                                updateItem(index, { unitCost: e.target.value })
                              }
                              className="input-glass w-full text-[11px]"
                              placeholder="USD"
                            />
                            {exchangeRate && (
                              <div className="text-[9px] text-text/50 mt-1">
                                $1.00 USD = {exchangeRate.toFixed(2)} VES (BCV)
                              </div>
                            )}
                          </div>
                          <div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitCostVES}
                              onChange={(e) =>
                                updateItem(index, { unitCostVES: e.target.value })
                              }
                              className="input-glass w-full text-[11px]"
                              placeholder="VES"
                            />
                          </div>
                        </div>
                        {lastPrice != null && (
                          <div className="text-[9px] text-text/60 mt-1">
                            Último precio registrado: ${lastPrice.toFixed(4)} USD
                          </div>
                        )}
                      </div>
                      <div className="col-span-2 md:col-span-4 mt-1">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <div className="text-[11px] text-text/60 mb-0.5">Cantidad</div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(index, { quantity: e.target.value })
                              }
                              className="input-glass w-full text-[11px]"
                            />
                          </div>
                          <div>
                            <div className="text-[11px] text-text/60 mb-0.5">
                              Presentación
                            </div>
                            <select
                              value={item.unit}
                              onChange={(e) => updateItem(index, { unit: e.target.value })}
                              className="input-glass w-full text-[11px]"
                            >
                              <option value="">Seleccionar presentación</option>
                              <option value="kg">Kilogramos (kg)</option>
                              <option value="g">Gramos (g)</option>
                              <option value="L">Litros (L)</option>
                              <option value="ml">Mililitros (ml)</option>
                              <option value="unit">Unidad (unit)</option>
                            </select>
                          </div>
                          <div>
                            <div className="text-[11px] text-text/60 mb-0.5">Impuesto (%)</div>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={item.taxRate}
                              onChange={(e) =>
                                updateItem(index, { taxRate: e.target.value })
                              }
                              className="input-glass w-full text-[11px]"
                              placeholder="0"
                            />
                          </div>
                          {(pricePerOneUSD != null ||
                            pricePerOneVES != null ||
                            taxLineUSD > 0 ||
                            taxLineVES > 0) && (
                            <div className="md:col-span-3 text-[9px] text-text/60 mt-1 flex flex-col md:flex-row md:items-center md:justify-between space-y-0.5 md:space-y-0">
                              <div>
                                {pricePerOneUSD != null || pricePerOneVES != null ? (
                                  <>
                                    Relación a 1 {unitLabel}:{' '}
                                    {pricePerOneUSD != null &&
                                      `$${pricePerOneUSD.toFixed(4)}`}
                                    {pricePerOneVES != null && (
                                      <>
                                        {pricePerOneUSD != null ? ' / ' : ''}
                                        {pricePerOneVES.toFixed(2)} VES
                                      </>
                                    )}
                                  </>
                                ) : (
                                  'Relación a 1: N/A'
                                )}
                              </div>
                              <div>
                                {taxLineUSD > 0 || taxLineVES > 0
                                  ? `Impuesto de esta línea: $${taxLineUSD.toFixed(
                                      2
                                    )} / ${taxLineVES.toFixed(2)} VES`
                                  : 'Impuesto de esta línea: 0'}
                              </div>
                            </div>
                          )}
                          <div className="md:col-span-3">
                            <div className="text-[11px] text-text/60 mb-0.5">
                              Descripción (opcional)
                            </div>
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) =>
                                updateItem(index, { description: e.target.value })
                              }
                              className="input-glass w-full text-[11px]"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end mt-1 md:col-span-3">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="px-2 py-1 rounded-full bg-glass hover:bg-glass-hover text-[11px] text-red-300"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary Table */}
          {summaryItems.some(item => item.quantity > 0) && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-text/80">Resumen de la factura</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-[11px]">
                  <thead>
                    <tr className="text-text/60 border-b border-glass">
                      <th className="py-1 pr-2 text-left">Producto</th>
                      <th className="py-1 pr-2 text-center">Cantidad</th>
                      <th className="py-1 pr-2 text-center">Costo USD</th>
                      <th className="py-1 pr-2 text-center">Costo VES</th>
                      <th className="py-1 pr-2 text-center">Subtotal USD</th>
                      <th className="py-1 pr-2 text-center">Subtotal VES</th>
                      <th className="py-1 pr-2 text-center">Impuesto USD</th>
                      <th className="py-1 pr-2 text-center">Impuesto VES</th>
                      <th className="py-1 pr-2 text-center">Total USD</th>
                      <th className="py-1 pr-2 text-center">Total VES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryItems.map((item, index) => (
                      <tr key={index} className="border-b border-glass/40">
                        <td className="py-1 pr-2">
                          <div>
                            <div className="text-text/80">{item.name}</div>
                            <div className="text-text/50 text-[9px]">{item.unit}</div>
                          </div>
                        </td>
                        <td className="py-1 pr-2 text-center">{item.quantity}</td>
                        <td className="py-1 pr-2 text-center">${item.unitCostUSD.toFixed(4)}</td>
                        <td className="py-1 pr-2 text-center">{item.unitCostVES.toFixed(2)}</td>
                        <td className="py-1 pr-2 text-center">${item.subtotalUSD.toFixed(2)}</td>
                        <td className="py-1 pr-2 text-center">{item.subtotalVES.toFixed(2)}</td>
                        <td className="py-1 pr-2 text-center">${item.taxUSD.toFixed(2)}</td>
                        <td className="py-1 pr-2 text-center">{item.taxVES.toFixed(2)}</td>
                        <td className="py-1 pr-2 text-center font-semibold">${item.totalUSD.toFixed(2)}</td>
                        <td className="py-1 pr-2 text-center font-semibold">{item.totalVES.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold text-accent">
                      <td colSpan="4" className="py-2 pr-2 text-right">TOTAL:</td>
                      <td className="py-2 pr-2 text-center">${grandTotalUSD.toFixed(2)}</td>
                      <td className="py-2 pr-2 text-center">{grandTotalVES.toFixed(2)}</td>
                      <td className="py-2 pr-2 text-center">${summaryItems.reduce((sum, item) => sum + item.taxUSD, 0).toFixed(2)}</td>
                      <td className="py-2 pr-2 text-center">{summaryItems.reduce((sum, item) => sum + item.taxVES, 0).toFixed(2)}</td>
                      <td className="py-2 pr-2 text-center">${grandTotalUSD.toFixed(2)}</td>
                      <td className="py-2 pr-2 text-center">{grandTotalVES.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-glass hover:bg-glass-hover"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando…' : 'Registrar compra'}
            </button>
          </div>
        </form>
        </div>
      </div>
      
      {/* New Supplier Modal */}
      {showNewSupplierModal && (
        <NewSupplierModal
          onClose={() => setShowNewSupplierModal(false)}
          onSave={async (data) => {
            // This will be manejado por la mutación del componente padre
            const response = await fetch(
              `/api/store/${window.location.pathname.split('/')[2]}/suppliers`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(data)
              }
            );

            if (response.ok) {
              toast.success('Proveedor creado correctamente');
              setShowNewSupplierModal(false);
              // Refresh suppliers list
              window.location.reload();
            } else {
              const error = await response.json();
              toast.error(error.error || 'Error al crear proveedor');
            }
          }}
          loading={false}
          suppliers={supplierList}
          onSelectExistingSupplier={undefined}
          initialTaxId={rifTaxIdSearch || ''}
        />
      )}

      {/* Supplier Detail Modal desde factura de compra */}
      {showSupplierDetailModal && matchedSupplier && (
        <SupplierDetailModal
          supplier={matchedSupplier}
          onClose={() => setShowSupplierDetailModal(false)}
          onSave={async (data) => {
            try {
              const storeSegment = window.location.pathname.split('/')[2];
              const response = await fetch(
                `/api/store/${storeSegment}/suppliers/${matchedSupplier.id}`,
                {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                  },
                  body: JSON.stringify(data)
                }
              );

              if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error al actualizar proveedor');
              }

              toast.success('Proveedor actualizado correctamente');
              setShowSupplierDetailModal(false);
              window.location.reload();
            } catch (error) {
              const message = error?.message || 'Error al actualizar proveedor';
              toast.error(message);
            }
          }}
          loading={false}
        />
      )}
    </>
  );
};

const CategoryManagementModal = ({
  categories,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  loadingCreate,
  loadingUpdate,
  loadingDelete,
  store,
  queryClient
}) => {
  const [newName, setNewName] = useState('');
  const [newSortOrder, setNewSortOrder] = useState('0');
  const [editableCategories, setEditableCategories] = useState(() => {
    const list = Array.isArray(categories) ? categories : [];
    return list.map((cat) => ({
      id: cat.id,
      name: cat.name || '',
      sortOrder:
        cat.sort_order !== undefined && cat.sort_order !== null
          ? String(cat.sort_order)
          : '0'
    }));
  });

  // Estados para arrastrar y soltar
  const [draggedCategory, setDraggedCategory] = useState(null);
  const [dragOverCategory, setDragOverCategory] = useState(null);
  const [isReordering, setIsReordering] = useState(false);

  // Funciones para arrastrar y soltar
  const handleDragStart = (e, category) => {
    setDraggedCategory(category);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, category) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCategory(category);
  };

  const handleDragLeave = () => {
    setDragOverCategory(null);
  };

  const handleDrop = (e, targetCategory) => {
    e.preventDefault();
    setDragOverCategory(null);

    if (!draggedCategory || draggedCategory.id === targetCategory.id) {
      return;
    }

    // Reordenar las categorías
    const newCategories = [...editableCategories];
    const draggedIndex = newCategories.findIndex(cat => cat.id === draggedCategory.id);
    const targetIndex = newCategories.findIndex(cat => cat.id === targetCategory.id);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      // Mover la categoría arrastrada a la nueva posición
      const [removed] = newCategories.splice(draggedIndex, 1);
      newCategories.splice(targetIndex, 0, removed);

      // Actualizar los valores de sortOrder basados en la nueva posición
      const updatedCategories = newCategories.map((cat, index) => ({
        ...cat,
        sortOrder: String(index)
      }));

      setEditableCategories(updatedCategories);
      setIsReordering(true);
    }

    setDraggedCategory(null);
  };

  const handleDragEnd = () => {
    setDraggedCategory(null);
    setDragOverCategory(null);
  };

  // Guardar todos los cambios de orden de categorías
  const handleSaveOrder = async () => {
    if (!store) return;

    try {
      const promises = editableCategories.map((cat) =>
        axios.patch(`/api/store/${store.id}/categories/${cat.id}`, {
          name: cat.name,
          sort_order: parseInt(cat.sortOrder, 10)
        })
      );

      await Promise.all(promises);
      toast.success('Orden de categorías actualizado');
      setIsReordering(false);
      
      // Refrescar categorías
      await queryClient.invalidateQueries({ queryKey: ['store-owner', store.slug] });
    } catch (error) {
      const message = error?.response?.data?.error || 'No se pudo actualizar el orden';
      toast.error(message);
    }
  };

  useEffect(() => {
    const list = Array.isArray(categories) ? categories : [];
    setEditableCategories(
      list.map((cat) => ({
        id: cat.id,
        name: cat.name || '',
        sortOrder:
          cat.sort_order !== undefined && cat.sort_order !== null
            ? String(cat.sort_order)
            : '0'
      }))
    );
  }, [categories]);

  const handleCreate = async (e) => {
    e.preventDefault();

    const trimmedName = newName.trim();
    if (!trimmedName) {
      toast.error('El nombre de la categoría es obligatorio');
      return;
    }

    let parsedSort = parseInt(newSortOrder, 10);
    if (!Number.isFinite(parsedSort)) {
      parsedSort = 0;
    }

    await onCreate({ name: trimmedName, sort_order: parsedSort });
    setNewName('');
    setNewSortOrder('0');
  };

  const handleUpdate = async (catId) => {
    const current = editableCategories.find((c) => c.id === catId);
    if (!current) return;

    const trimmedName = (current.name || '').trim();
    if (!trimmedName) {
      toast.error('El nombre de la categoría es obligatorio');
      return;
    }

    let parsedSort = parseInt(current.sortOrder, 10);
    if (!Number.isFinite(parsedSort)) {
      parsedSort = 0;
    }

    await onUpdate({
      categoryId: catId,
      data: { name: trimmedName, sort_order: parsedSort }
    });
  };

  const handleDelete = async (catId) => {
    const cat = editableCategories.find((c) => c.id === catId);
    const name = cat?.name || '';

    const confirmed = window.confirm(
      `¿Eliminar la categoría "${name}"? Los productos asociados pasarán a "Sin categoría".`
    );
    if (!confirmed) return;

    await onDelete(catId);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto card-glass p-6 space-y-4 text-xs"
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold">Categorías</h3>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-full bg-glass hover:bg-glass-hover text-[11px]"
          >
            Cerrar
          </button>
        </div>
        <p className="text-[11px] text-text/60">
          Administra las categorías de tu tienda. Si borras una categoría, los productos que la usan pasarán a
          <span className="font-semibold"> Sin categoría</span>.
        </p>

        <div className="border border-glass rounded-lg p-3 space-y-2 bg-background-dark/40">
          <p className="text-[11px] text-text/70 font-semibold mb-1">Crear nueva categoría</p>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
            <div className="md:col-span-2">
              <div className="text-[11px] text-text/60 mb-0.5">Nombre</div>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="input-glass w-full text-[11px]"
                placeholder="Ej: Entradas, Pastas, Bebidas"
              />
            </div>
            <div>
              <div className="text-[11px] text-text/60 mb-0.5">Orden</div>
              <input
                type="number"
                value={newSortOrder}
                onChange={(e) => setNewSortOrder(e.target.value)}
                className="input-glass w-full text-[11px]"
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={loadingCreate}
                className="px-3 py-1.5 rounded-full bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50 disabled:cursor-not-allowed text-[11px]"
              >
                {loadingCreate ? 'Creando…' : 'Crear categoría'}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-text/70 font-semibold">Categorías existentes</p>
              <span className="text-[11px] text-text/50">{editableCategories.length} registradas</span>
              {isReordering && (
                <span className="text-[10px] text-accent bg-accent/20 px-2 py-0.5 rounded-full">
                  Hay cambios sin guardar
                </span>
              )}
            </div>
            {isReordering && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveOrder}
                  className="px-3 py-1 rounded-full bg-accent/20 text-accent hover:bg-accent/30 text-[11px]"
                >
                  Guardar orden
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Resetear al orden original
                    const list = Array.isArray(categories) ? categories : [];
                    setEditableCategories(
                      list.map((cat) => ({
                        id: cat.id,
                        name: cat.name || '',
                        sortOrder:
                          cat.sort_order !== undefined && cat.sort_order !== null
                            ? String(cat.sort_order)
                            : '0'
                      }))
                    );
                    setIsReordering(false);
                  }}
                  className="px-3 py-1 rounded-full bg-glass hover:bg-glass-hover text-[11px]"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
          
          {/* Instrucciones de uso */}
          <div className="text-[10px] text-text/50 bg-glass/50 p-2 rounded">
            💡 <strong>Para reordenar:</strong> Arrastra y suelta las categorías usando el icono ⋮⋮. Los cambios se marcarán como "sin guardar" hasta que presiones "Guardar orden".
          </div>
          {editableCategories.length === 0 ? (
            <p className="text-[11px] text-text/60">Aún no tienes categorías configuradas.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {editableCategories.map((cat, index) => (
                <div
                  key={cat.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, cat)}
                  onDragOver={(e) => handleDragOver(e, cat)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, cat)}
                  onDragEnd={handleDragEnd}
                  className={`border rounded-lg p-2 flex flex-col md:flex-row md:items-center gap-2 bg-background-dark/40 transition-all cursor-move ${
                    dragOverCategory?.id === cat.id ? 'border-accent bg-accent/10' : 'border-glass'
                  } ${draggedCategory?.id === cat.id ? 'opacity-50' : ''}`}
                >
                  {/* Indicador de arrastre */}
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] text-text/40 cursor-grab active:cursor-grabbing">
                      ⋮⋮
                    </div>
                    <div className="text-[10px] text-text/50 bg-glass px-1.5 py-0.5 rounded">
                      #{index}
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                    <div className="md:col-span-2">
                      <div className="text-[11px] text-text/60 mb-0.5">Nombre</div>
                      <input
                        type="text"
                        value={cat.name}
                        onChange={(e) =>
                          setEditableCategories((prev) =>
                            prev.map((c) =>
                              c.id === cat.id ? { ...c, name: e.target.value } : c
                            )
                          )
                        }
                        className="input-glass w-full text-[11px] py-1"
                      />
                    </div>
                    <div>
                      <div className="text-[11px] text-text/60 mb-0.5">Orden</div>
                      <input
                        type="number"
                        value={cat.sortOrder}
                        onChange={(e) =>
                          setEditableCategories((prev) =>
                            prev.map((c) =>
                              c.id === cat.id ? { ...c, sortOrder: e.target.value } : c
                            )
                          )
                        }
                        className="input-glass w-full text-[11px] py-1"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdate(cat.id)}
                      disabled={loadingUpdate}
                      className="px-3 py-1 rounded-full bg-glass hover:bg-glass-hover text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat.id)}
                      disabled={loadingDelete}
                      className="px-3 py-1 rounded-full bg-error/20 text-error hover:bg-error/30 text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PurchaseDetailModal = ({ purchase, loading, onClose, vesPerUsdt, store, user }) => {
  const invoice = purchase?.invoice || {};
  const items = Array.isArray(purchase?.items) ? purchase.items : [];

  const safeNumber = (value) => {
    const n = typeof value === 'number' ? value : parseFloat(String(value || '0'));
    return Number.isFinite(n) ? n : 0;
  };

  const totalUsdt = safeNumber(invoice.total_cost_usdt);
  const hasVesRate =
    typeof vesPerUsdt === 'number' && Number.isFinite(vesPerUsdt) && vesPerUsdt > 0;
  const totalBs = hasVesRate ? totalUsdt * vesPerUsdt : null;

  const [showPrintOptions, setShowPrintOptions] = useState(false);

  const handlePrint = (mode) => {
    if (!invoice) return;
    const previousTitle = document.title;
    const number = invoice.invoice_number || '';
    const ticketClass = 'print-invoice';
    const a4Class = 'print-purchase-invoice-a4';

    document.title = `Factura de compra ${number}`;
    if (mode === 'ticket') {
      document.body.classList.add(ticketClass);
    } else {
      document.body.classList.add(a4Class);
    }

    try {
      window.print();
    } finally {
      document.body.classList.remove(ticketClass);
      document.body.classList.remove(a4Class);
      document.title = previousTitle;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] card-glass p-6 space-y-4 overflow-y-auto purchase-invoice-print-root"
      >
        <div className="flex items-center justify-between gap-3 relative">
          <div>
            <h3 className="text-lg font-bold">Detalle de factura de compra</h3>
            {invoice.invoice_number && (
              <p className="text-xs text-text/60">Nº factura: {invoice.invoice_number}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPrintOptions((prev) => !prev)}
              className="px-3 py-1.5 rounded-full bg-accent/20 text-accent hover:bg-accent/30 text-xs"
            >
              Descargar / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-full bg-glass hover:bg-glass-hover text-xs"
            >
              Cerrar
            </button>
            {showPrintOptions && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-background-dark border border-glass rounded-lg shadow-lg p-2 z-20 text-[11px]">
                <div className="text-text/60 mb-1">Selecciona formato de impresión:</div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPrintOptions(false);
                    handlePrint('ticket');
                  }}
                  className="w-full text-left px-2 py-1 rounded-md hover:bg-glass"
                >
                  Ticket 80mm (rápido)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPrintOptions(false);
                    handlePrint('a4');
                  }}
                  className="w-full text-left px-2 py-1 rounded-md hover:bg-glass mt-1"
                >
                  Carta / A4 (detallado)
                </button>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-xs text-text/60">Cargando factura...</p>
        ) : !invoice.id ? (
          <p className="text-xs text-text/60">No se pudo cargar la información de la factura.</p>
        ) : (
          <div className="space-y-6 text-xs">
            {/* Header de tienda (visible en PDF A4) */}
            <div className="purchase-invoice-header">
              <div className="flex items-start gap-4">
                {store?.logo_url && (
                  <img
                    src={store.logo_url}
                    alt="Logo de la tienda"
                    className="h-16 w-auto object-contain"
                  />
                )}
                <div className="flex-1 space-y-1">
                  <div className="text-base font-bold text-text">{store?.name || 'Mi Tienda'}</div>
                  {store?.address && (
                    <div className="text-text/80 whitespace-pre-wrap">{store.address}</div>
                  )}
                  {store?.rif && (
                    <div className="text-text/80">RIF: {store.rif}</div>
                  )}
                  {store?.phone && (
                    <div className="text-text/80">Teléfono: {store.phone}</div>
                  )}
                </div>
              </div>
              <div className="text-[10px] text-text/50 mt-2 text-right">
                Emitido por: {user?.name || 'Sistema'} • {new Date().toLocaleString()}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div>
                  <span className="text-text/60">Proveedor: </span>
                  <span className="text-text/80">{invoice.supplier_name || 'Sin proveedor'}</span>
                </div>
                <div>
                  <span className="text-text/60">Fecha: </span>
                  <span className="text-text/80">
                    {invoice.invoice_date ||
                      (invoice.created_at
                        ? new Date(invoice.created_at).toLocaleDateString()
                        : '-')}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-text/60">Notas:</div>
                  <div className="text-text/80 whitespace-pre-wrap">{invoice.notes}</div>
                </div>
                {invoice.invoice_image_url && (
                  <div>
                    <div className="text-text/60 mb-1">Imagen adjunta</div>
                    <div className="border border-glass rounded-lg overflow-hidden bg-black/40">
                      <img
                        src={invoice.invoice_image_url}
                        alt="Imagen de la factura"
                        className="max-h-48 w-full object-contain cursor-pointer"
                        onClick={() => {
                          try {
                            window.open(invoice.invoice_image_url, '_blank', 'noopener,noreferrer');
                          } catch (e) {
                            // ignore
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="space-y-1 text-right">
          <div>
            <span className="text-text/60">Total USDT: </span>
            <span className="text-text/80 font-semibold">{totalUsdt.toFixed(2)}</span>
          </div>
          {hasVesRate && (
            <div className="text-[11px] text-text/70">
              <span className="text-text/60 mr-1">Total Bs:</span>
              <span className="text-text/80 font-semibold">
                {totalBs.toFixed(2)}
              </span>
              <span className="text-text/50 ml-1">
                (tasa {vesPerUsdt.toFixed(2)} Bs/USDT)
              </span>
            </div>
          )}
        </div>
        <div className="border-t border-glass mt-4 pt-3">
          <h4 className="text-xs font-semibold text-text/80 mb-2">Ítems</h4>
          {items.length === 0 ? (
            <p className="text-[11px] text-text/60">Esta factura no tiene ítems registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-[11px] align-middle">
                <thead>
                  <tr className="text-text/60 border-b border-glass">
                    <th className="py-1 pr-3 text-left">Descripción</th>
                    <th className="py-1 pr-3 text-right">Cantidad</th>
                    <th className="py-1 pr-3 text-right">Unidad</th>
                    <th className="py-1 pr-3 text-right">Costo unitario (USDT)</th>
                    {hasVesRate && (
                      <th className="py-1 pr-3 text-right">Costo unitario (Bs)</th>
                    )}
                    <th className="py-1 pr-3 text-right">Total (USDT)</th>
                    {hasVesRate && (
                      <th className="py-1 pr-3 text-right">Total (Bs)</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const qty = safeNumber(item.quantity);
                    const unitCost = safeNumber(item.unit_cost_usdt);
                    const lineTotal =
                      safeNumber(item.total_cost_usdt) || qty * unitCost;

                    const unitLabel =
                      item.ingredient_unit || (item.product_id ? 'Unidad' : '');

                    const unitCostBs = hasVesRate ? unitCost * vesPerUsdt : null;
                    const lineTotalBs = hasVesRate ? lineTotal * vesPerUsdt : null;

                    const label =
                      item.description ||
                      item.product_name ||
                      item.ingredient_name ||
                      item.modifier_name ||
                      'Ítem';

                    return (
                      <tr key={item.id} className="border-b border-glass/40">
                        <td className="py-1 pr-3 text-text/80 whitespace-pre-wrap">{label}</td>
                        <td className="py-1 pr-3 text-right text-text/70">{qty.toFixed(2)}</td>
                        <td className="py-1 pr-3 text-right text-text/70">{unitLabel || '-'}</td>
                        <td className="py-1 pr-3 text-right text-text/70">{unitCost.toFixed(4)}</td>
                        {hasVesRate && (
                          <td className="py-1 pr-3 text-right text-text/70">
                            {unitCostBs != null ? unitCostBs.toFixed(2) : '-'}
                          </td>
                        )}
                        <td className="py-1 pr-3 text-right text-text/80">{lineTotal.toFixed(2)}</td>
                        {hasVesRate && (
                          <td className="py-1 pr-3 text-right text-text/80">
                            {lineTotalBs != null ? lineTotalBs.toFixed(2) : '-'}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const IngredientsModal = ({ ingredients, products, categories, vesPerUsdt, onClose }) => {
  const ingredientsList = Array.isArray(ingredients) ? ingredients : [];
  const productsList = Array.isArray(products) ? products : [];
  const categoriesList = Array.isArray(categories) ? categories : [];
  const [activeTab, setActiveTab] = useState('ingredients');

  const safeNumber = (value) => {
    const n = typeof value === 'number' ? value : parseFloat(String(value || '0'));
    return Number.isFinite(n) ? n : 0;
  };

  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState(null);
  const [editingField, setEditingField] = useState(null);

  // Get category name by ID
  const getCategoryName = (categoryId) => {
    const category = categoriesList.find(cat => cat.id === categoryId);
    return category ? category.name : 'Sin categoría';
  };

  // Convert units to base for cost calculations
  const convertToBaseUnit = (quantity, unit) => {
    const q = parseFloat(quantity || '0');
    if (!Number.isFinite(q) || q <= 0) return 0;
    
    switch (unit) {
      case 'kg': return q; // kg is base unit
      case 'g': return q / 1000; // 1000g = 1kg
      case 'L': return q; // L is base unit
      case 'ml': return q / 1000; // 1000ml = 1L
      case 'unit': 
      default: return q; // units are indivisible
    }
  };

  // Calculate price in Bs using historical rate for ingredients
  const calculateIngredientPriceBs = (ingredient) => {
    // Use the purchase_rate_usdt if available (historical rate at purchase time)
    // Otherwise fall back to current rate
    const rateToUse = ingredient.purchase_rate_usdt || vesPerUsdt;
    const costUsdt = safeNumber(ingredient.cost_per_unit_usdt);
    
    if (!rateToUse || rateToUse === 0 || costUsdt === 0) return 0;
    
    return costUsdt * rateToUse;
  };

  // Calculate price in Bs for products (current rate)
  const calculatePriceBs = (priceUsdt) => {
    if (!vesPerUsdt || !priceUsdt || vesPerUsdt === 0) return 0;
    return safeNumber(priceUsdt) * safeNumber(vesPerUsdt);
  };

  // Calculate effective cost per base unit (handles unit conversion)
  const calculateEffectiveCostPerBaseUnit = (ingredient) => {
    const costPerUnit = safeNumber(ingredient.cost_per_unit_usdt);
    if (costPerUnit === 0) return 0;
    
    // If ingredient uses a derived unit (g, ml), convert to base unit cost
    switch (ingredient.unit) {
      case 'g':
        // Cost per gram = cost per kg / 1000
        return costPerUnit / 1000;
      case 'ml':
        // Cost per ml = cost per L / 1000
        return costPerUnit / 1000;
      case 'kg':
      case 'L':
      case 'unit':
      default:
        // Already in base unit
        return costPerUnit;
    }
  };

  // Update ingredient field
  const handleUpdateIngredient = async (ingredient, field, value) => {
    if (!ingredient?.id) return;
    setSavingId(`${ingredient.id}-${field}`);
    try {
      await axios.patch(
        `/api/store/inventory/${ingredient.store_id}/ingredient/${ingredient.id}`,
        { [field]: value }
      );
      await queryClient.invalidateQueries({ queryKey: ['store-ingredients', ingredient.store_id] });
      toast.success(`${field === 'min_stock_alert' ? 'Mínimo de alerta' : field === 'override_stock' ? 'Stock override' : 'Unidad'} actualizado`);
      setEditingField(null);
    } catch (error) {
      const message = error?.response?.data?.error || 'No se pudo actualizar';
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  };

  // Update product field
  const handleUpdateProduct = async (product, field, value) => {
    if (!product?.id) return;
    setSavingId(`${product.id}-${field}`);
    try {
      await axios.patch(
        `/api/store/${product.store_id}/product/${product.id}`,
        { [field]: value }
      );
      await queryClient.invalidateQueries({ queryKey: ['store-owner', product.store_slug] });
      toast.success(`${field === 'min_stock_alert' ? 'Mínimo de alerta' : field === 'override_stock' ? 'Stock override' : 'Campo'} actualizado`);
      setEditingField(null);
    } catch (error) {
      const message = error?.response?.data?.error || 'No se pudo actualizar';
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl max-h-[95vh] mx-auto card-glass p-4 sm:p-6 space-y-4 overflow-y-auto overflow-x-auto"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Inventario completo</h3>
            <p className="text-[11px] text-text/60 hidden sm:block">
              Control de ingredientes internos y productos para la venta. Stock real y override para emergencias.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-full bg-glass hover:bg-glass-hover text-xs w-full sm:w-auto"
          >
            Cerrar
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-col sm:flex-row border-b border-glass">
          <button
            type="button"
            onClick={() => setActiveTab('ingredients')}
            className={`flex-1 px-3 sm:px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
              activeTab === 'ingredients'
                ? 'text-accent border-accent'
                : 'text-text/60 border-transparent hover:text-text/80'
            }`}
          >
            <span className="block">Ingredientes</span>
            <span className="text-[10px] opacity-70">({ingredientsList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`flex-1 px-3 sm:px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
              activeTab === 'products'
                ? 'text-accent border-accent'
                : 'text-text/60 border-transparent hover:text-text/80'
            }`}
          >
            <span className="block">Stock de productos</span>
            <span className="text-[10px] opacity-70">({productsList.length})</span>
          </button>
        </div>

        {/* Content */}
        {activeTab === 'ingredients' && (
          <div className="space-y-2">
            {ingredientsList.length === 0 ? (
              <p className="text-[11px] text-text/60">Aún no tienes ingredientes registrados.</p>
            ) : (
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="min-w-[600px] w-full text-[11px] align-middle">
                  <thead>
                    <tr className="text-text/60 border-b border-glass sticky top-0 bg-background-dark/90 backdrop-blur-sm z-10">
                      <th className="py-2 px-2 sm:py-1 sm:pr-3 text-left">Nombre</th>
                      <th className="py-2 px-2 sm:py-1 sm:pr-3 text-left hidden sm:table-cell">Unidad</th>
                      <th className="py-2 px-2 sm:py-1 sm:pr-3 text-right">Stock real</th>
                      <th className="py-2 px-2 sm:py-1 sm:pr-3 text-right">Stock override</th>
                      <th className="py-2 px-2 sm:py-1 sm:pr-3 text-right">Stock disponible</th>
                      <th className="py-2 px-2 sm:py-1 sm:pr-3 text-right hidden md:table-cell">Mínimo alerta</th>
                      <th className="py-2 px-2 sm:py-1 sm:pr-3 text-right hidden lg:table-cell">Costo USDT</th>
                      <th className="py-2 px-2 sm:py-1 sm:pr-3 text-right hidden lg:table-cell">Costo Bs</th>
                      <th className="py-2 px-2 sm:py-1 sm:pr-3 text-right hidden xl:table-cell">Tasa usada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingredientsList.map((ing) => {
                      const realStock = safeNumber(ing.current_stock);
                      const overrideStock = safeNumber(ing.override_stock);
                      const availableStock = overrideStock > 0 ? overrideStock : realStock;
                      const minStock = safeNumber(ing.min_stock_alert);
                      
                      // Calculate costs with unit conversion
                      const costPerUnit = safeNumber(ing.cost_per_unit_usdt);
                      const effectiveCostPerBaseUnit = calculateEffectiveCostPerBaseUnit(ing);
                      const costBs = calculateIngredientPriceBs(ing);
                      const effectiveCostBs = effectiveCostPerBaseUnit * (ing.purchase_rate_usdt || vesPerUsdt || 1);
                      
                      const usedRate = ing.purchase_rate_usdt || vesPerUsdt;
                      const isLowStock = availableStock <= minStock && availableStock > 0;
                      const isOutOfStock = availableStock === 0;

                      return (
                        <tr key={ing.id} className={`border-b ${isOutOfStock ? 'bg-red-500/5' : isLowStock ? 'bg-yellow-500/5' : 'border-glass/40'}`}>
                          <td className="py-2 px-2 sm:py-1 sm:pr-3 text-text/80 font-medium">{ing.name}</td>
                          <td className="py-2 px-2 sm:py-1 sm:pr-3 text-text/70 hidden sm:table-cell">
                            <select
                              value={ing.unit || 'unit'}
                              onChange={(e) => handleUpdateIngredient(ing, 'unit', e.target.value)}
                              disabled={savingId === `${ing.id}-unit`}
                              className="input-glass w-full text-[11px] py-0.5 pr-6"
                            >
                              <option value="unit">Unidad</option>
                              <option value="kg">Kilogramos (kg)</option>
                              <option value="g">Gramos (g)</option>
                              <option value="L">Litros (L)</option>
                              <option value="ml">Mililitros (ml)</option>
                            </select>
                          </td>
                          <td className="py-2 px-2 sm:py-1 sm:pr-3 text-right text-text/50">{realStock.toFixed(2)} {ing.unit}</td>
                          <td className="py-2 px-2 sm:py-1 sm:pr-3 text-right">
                            {editingField === `${ing.id}-override_stock` ? (
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={overrideStock}
                                onBlur={(e) => handleUpdateIngredient(ing, 'override_stock', parseFloat(e.target.value) || 0)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateIngredient(ing, 'override_stock', parseFloat(e.target.value) || 0);
                                  }
                                }}
                                className="input-glass w-16 sm:w-20 text-right text-[11px] py-0.5"
                                autoFocus
                              />
                            ) : (
                              <div
                                onClick={() => setEditingField(`${ing.id}-override_stock`)}
                                className={`cursor-pointer text-right ${overrideStock > 0 ? 'text-accent font-medium' : 'text-text/60'}`}
                              >
                                {overrideStock > 0 ? `${overrideStock.toFixed(2)} ${ing.unit}` : '-'}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 sm:py-1 sm:pr-3 text-right text-text/80 font-medium">{availableStock.toFixed(2)}</td>
                          <td className="py-2 px-2 sm:py-1 sm:pr-3 text-right hidden md:table-cell">
                            {editingField === `${ing.id}-min_stock_alert` ? (
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={minStock}
                                onBlur={(e) => handleUpdateIngredient(ing, 'min_stock_alert', parseFloat(e.target.value) || 0)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateIngredient(ing, 'min_stock_alert', parseFloat(e.target.value) || 0);
                                  }
                                }}
                                className="input-glass w-16 sm:w-20 text-right text-[11px] py-0.5"
                                autoFocus
                              />
                            ) : (
                              <div
                                onClick={() => setEditingField(`${ing.id}-min_stock_alert`)}
                                className="cursor-pointer text-right text-text/70"
                              >
                                {minStock.toFixed(2)}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 sm:py-1 sm:pr-3 text-right text-text/80 hidden lg:table-cell">
                            <div>
                              <div>{costPerUnit.toFixed(4)} USDT/{ing.unit}</div>
                              {(ing.unit === 'g' || ing.unit === 'ml') && (
                                <div className="text-[9px] text-text/60">
                                  {effectiveCostPerBaseUnit.toFixed(6)} USDT/base
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-2 sm:py-1 sm:pr-3 text-right text-text/80 hidden lg:table-cell">
                            <div>
                              <div>{costBs.toFixed(2)} Bs/{ing.unit}</div>
                              {(ing.unit === 'g' || ing.unit === 'ml') && (
                                <div className="text-[9px] text-text/60">
                                  {effectiveCostBs.toFixed(4)} Bs/base
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-2 sm:py-1 sm:pr-3 text-right text-text/60 text-[10px] hidden xl:table-cell">
                            {usedRate ? usedRate.toFixed(2) : '-'}
                            {ing.purchase_rate_usdt && <span className="text-accent ml-1">▲</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-2">
            {productsList.length === 0 ? (
              <p className="text-[11px] text-text/60">Aún no tienes productos registrados.</p>
            ) : (
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="min-w-[600px] w-full text-[11px] align-middle">
                  <thead>
                    <tr className="text-text/60 border-b border-glass sticky top-0 bg-background-dark/90 backdrop-blur-sm z-10">
                      <th className="py-2 px-2 sm:py-1 sm:pr-3 text-left">Producto</th>
                      <th className="py-2 px-2 sm:py-1 sm:pr-3 text-left hidden sm:table-cell">Categoría</th>
                      <th className="py-2 px-2 sm:py-1 sm:pr-3 text-right">Stock real</th>
                      <th className="py-2 px-2 sm:py-1 sm:pr-3 text-right">Stock override</th>
                      <th className="py-2 px-2 sm:py-1 sm:pr-3 text-right">Stock disponible</th>
                      <th className="py-2 px-2 sm:py-1 sm:pr-3 text-right hidden md:table-cell">Mínimo alerta</th>
                      <th className="py-2 px-2 sm:py-1 sm:pr-3 text-right hidden lg:table-cell">Precio USDT</th>
                      <th className="py-2 px-2 sm:py-1 sm:pr-3 text-right hidden lg:table-cell">Precio Bs</th>
                      <th className="py-2 px-2 sm:py-1 sm:pr-3 text-right hidden xl:table-cell">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productsList.map((product) => {
                      const realStock = safeNumber(product.stock);
                      const overrideStock = safeNumber(product.override_stock);
                      const availableStock = overrideStock > 0 ? overrideStock : realStock;
                      const minStock = safeNumber(product.min_stock_alert);
                      const priceUsdt = safeNumber(product.price_usdt);
                      const priceBs = calculatePriceBs(priceUsdt);
                      const isAvailable = product.is_available && availableStock > 0;
                      const isLowStock = availableStock <= minStock && availableStock > 0;
                      const isOutOfStock = availableStock === 0;

                      return (
                        <tr key={product.id} className={`border-b ${isOutOfStock ? 'bg-red-500/5' : isLowStock ? 'bg-yellow-500/5' : 'border-glass/40'}`}>
                          <td className="py-2 px-2 sm:py-1 sm:pr-3 text-text/80">
                            <div className="flex items-center gap-2">
                              {product.image_url && (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-6 h-6 object-cover rounded flex-shrink-0"
                                />
                              )}
                              <span className="font-medium truncate">{product.name}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 sm:py-1 sm:pr-3 text-text/70 hidden sm:table-cell">{getCategoryName(product.category_id)}</td>
                          <td className="py-2 px-2 sm:py-1 sm:pr-3 text-right text-text/50">{realStock.toFixed(2)}</td>
                          <td className="py-2 px-2 sm:py-1 sm:pr-3 text-right">
                            {editingField === `${product.id}-override_stock` ? (
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={overrideStock}
                                onBlur={(e) => handleUpdateProduct(product, 'override_stock', parseFloat(e.target.value) || 0)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateProduct(product, 'override_stock', parseFloat(e.target.value) || 0);
                                  }
                                }}
                                className="input-glass w-16 sm:w-20 text-right text-[11px] py-0.5"
                                autoFocus
                              />
                            ) : (
                              <div
                                onClick={() => setEditingField(`${product.id}-override_stock`)}
                                className={`cursor-pointer text-right ${overrideStock > 0 ? 'text-accent font-medium' : 'text-text/60'}`}
                              >
                                {overrideStock > 0 ? overrideStock.toFixed(2) : '-'}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 sm:py-1 sm:pr-3 text-right text-text/80 font-medium">{availableStock.toFixed(2)}</td>
                          <td className="py-2 px-2 sm:py-1 sm:pr-3 text-right hidden md:table-cell">
                            {editingField === `${product.id}-min_stock_alert` ? (
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={minStock}
                                onBlur={(e) => handleUpdateProduct(product, 'min_stock_alert', parseFloat(e.target.value) || 0)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateProduct(product, 'min_stock_alert', parseFloat(e.target.value) || 0);
                                  }
                                }}
                                className="input-glass w-16 sm:w-20 text-right text-[11px] py-0.5"
                                autoFocus
                              />
                            ) : (
                              <div
                                onClick={() => setEditingField(`${product.id}-min_stock_alert`)}
                                className="cursor-pointer text-right text-text/70"
                              >
                                {minStock.toFixed(2)}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 sm:py-1 sm:pr-3 text-right text-text/80 hidden lg:table-cell">{priceUsdt.toFixed(2)}</td>
                          <td className="py-2 px-2 sm:py-1 sm:pr-3 text-right text-text/80 hidden lg:table-cell">{priceBs.toFixed(2)}</td>
                          <td className="py-2 px-2 sm:py-1 sm:pr-3 text-right hidden xl:table-cell">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              isAvailable 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {isAvailable ? 'Disponible' : 'Agotado'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const NewCategoryModal = ({ onClose, onSave, loading }) => {
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('El nombre de la categoría es obligatorio');
      return;
    }

    let parsedSort = parseInt(sortOrder, 10);
    if (!Number.isFinite(parsedSort)) {
      parsedSort = 0;
    }

    await onSave({ name: trimmedName, sort_order: parsedSort });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm card-glass p-6 space-y-4"
      >
        <h3 className="text-lg font-bold">Nueva categoría</h3>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <div className="text-text/60 mb-1">Nombre</div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-glass w-full"
              required
            />
          </div>
          <div>
            <div className="text-text/60 mb-1">Orden (opcional)</div>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="input-glass w-full"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-glass hover:bg-glass-hover"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando…' : 'Guardar categoría'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StoreOwnerDashboard;
