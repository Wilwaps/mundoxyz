import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { BarChart3, ShoppingBag, Megaphone, ListChecks, ExternalLink, ArrowLeft, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

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

const StoreOwnerDashboard = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingMode, setEditingMode] = useState('edit');
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState(false);
  const [isNewInvoiceModalOpen, setIsNewInvoiceModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);

  const [headerLayout, setHeaderLayout] = useState('normal');
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [coverUrlInput, setCoverUrlInput] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationMapsUrl, setLocationMapsUrl] = useState('');
  const [settingsInitialized, setSettingsInitialized] = useState(false);

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
  const products = storeData?.products || [];

  useEffect(() => {
    if (!store || settingsInitialized) return;

    try {
      const rawSettings = store.settings || {};
      const rawLocation = store.location || {};

      setHeaderLayout(rawSettings.header_layout || 'normal');
      setLogoUrlInput(store.logo_url || '');
      setCoverUrlInput(store.cover_url || '');
      setLocationAddress(rawLocation.address || '');
      setLocationMapsUrl(
        rawLocation.maps_url || rawLocation.google_maps_url || ''
      );
    } catch (e) {
      // noop
    }

    setSettingsInitialized(true);
  }, [store, settingsInitialized]);

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
    data: fiatContext
  } = useQuery({
    queryKey: ['fiat-context'],
    queryFn: async () => {
      const response = await axios.get('/api/economy/fiat-context');
      return response.data;
    }
  });

  const vesPerUsdt = fiatContext?.operationalRate?.rate || null;
  const firesPerUsdt = fiatContext?.config?.fires_per_usdt || null;

  const queryClient = useQueryClient();

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
    onSuccess: () => {
      toast.success('Producto actualizado');
      queryClient.invalidateQueries(['store-owner', slug]);
    },
    onError: (error) => {
      const message = error?.response?.data?.error || 'Error al actualizar producto';
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
    onSuccess: () => {
      toast.success('Producto creado');
      queryClient.invalidateQueries(['store-owner', slug]);
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
    onSuccess: () => {
      toast.success('Producto duplicado');
      queryClient.invalidateQueries(['store-owner', slug]);
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

  const {
    data: activeOrders,
    isLoading: loadingOrders
  } = useQuery({
    queryKey: ['store-active-orders', store?.id],
    queryFn: async () => {
      const response = await axios.get(`/api/store/${store.id}/orders/active`);
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

  const orders = Array.isArray(activeOrders) ? activeOrders : [];
  const ordersHistory = Array.isArray(ordersHistoryData) ? ordersHistoryData : [];

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
                onClick={() => setIsNewCategoryModalOpen(true)}
                className="px-3 py-1.5 rounded-full bg-glass hover:bg-glass-hover whitespace-nowrap"
              >
                Nueva categoría
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
                      <tr key={s.id} className="border-b border-glass/40">
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
                      <tr key={p.id} className="border-b border-glass/40">
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
          <div className="card-glass p-4 overflow-x-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Pedidos activos</h2>
              <span className="text-[11px] text-text/60">Vista rápida de lo que está en curso en tu tienda.</span>
            </div>
            {loadingOrders ? (
              <p className="text-xs text-text/60">Cargando pedidos...</p>
            ) : orders.length === 0 ? (
              <p className="text-xs text-text/60">No hay pedidos activos en este momento.</p>
            ) : (
              <table className="min-w-full text-xs align-middle">
                <thead>
                  <tr className="text-text/60 border-b border-glass">
                    <th className="py-1 pr-3 text-left">Código</th>
                    <th className="py-1 pr-3 text-left">Estado</th>
                    <th className="py-1 pr-3 text-left">Tipo</th>
                    <th className="py-1 pr-3 text-left">Mesa / Ref</th>
                    <th className="py-1 pr-3 text-right">Total USDT</th>
                    <th className="py-1 pr-3 text-left">Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-glass/40">
                      <td className="py-1 pr-3 text-text/80">{order.code}</td>
                      <td className="py-1 pr-3 text-text/70">{order.status}</td>
                      <td className="py-1 pr-3 text-text/70">{order.type}</td>
                      <td className="py-1 pr-3 text-text/70">{order.table_number || '-'}</td>
                      <td className="py-1 pr-3 text-right text-text/80">
                        {Number(order.total_usdt || 0).toFixed(2)}
                      </td>
                      <td className="py-1 pr-3 text-text/60">
                        {order.created_at ? new Date(order.created_at).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card-glass p-4 overflow-x-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Historial de ventas (recientes)</h2>
              <span className="text-[11px] text-text/60">
                Últimas {ordersHistory.length} facturas registradas en esta tienda.
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
                          setSelectedInvoice({
                            storeId: store.id,
                            invoiceNumber: order.invoice_number
                          });
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
        <div className="card-glass p-4 space-y-2 text-xs">
          <h2 className="text-sm font-semibold mb-1">Marketing & comunidad</h2>
          <p className="text-text/70">
            Aquí podrás ver y configurar campañas, combos especiales, códigos promocionales y acciones de comunidad
            conectadas con el ecosistema de Mundo XYZ.
          </p>
          <p className="text-text/60">
            En esta primera versión, usa el POS y la vista de pedidos para entender qué se vende mejor y planificar
            tus próximas promociones.
          </p>
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
                <p className="text-text/60 mb-1">URL del logo (perfil)</p>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={logoUrlInput}
                    onChange={(e) => setLogoUrlInput(e.target.value)}
                    className="input-glass w-full"
                    placeholder="https://..."
                  />
                  <div>
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
                  <div>
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
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={async () => {
                const settingsPatch = {
                  header_layout: headerLayout
                };

                const locationPatch = {
                  address: locationAddress || null,
                  maps_url: locationMapsUrl || null
                };

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
              {updateStoreSettingsMutation.isLoading ? 'Guardando…' : 'Guardar configuración de tienda'}
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
          onClose={() => setIsNewSupplierModalOpen(false)}
          onSave={async (data) => {
            await createSupplierMutation.mutateAsync(data);
            setIsNewSupplierModalOpen(false);
          }}
          loading={createSupplierMutation.isLoading}
        />
      )}
      {isNewInvoiceModalOpen && (
        <NewPurchaseModal
          suppliers={suppliers}
          products={products}
          ingredients={ingredients}
          onClose={() => setIsNewInvoiceModalOpen(false)}
          onSave={async (data) => {
            await createPurchaseMutation.mutateAsync(data);
            setIsNewInvoiceModalOpen(false);
          }}
          loading={createPurchaseMutation.isLoading}
        />
      )}
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
  firesPerUsdt
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    let normalizedStock = parseInt(stock, 10);
    if (!Number.isFinite(normalizedStock) || normalizedStock < 0) {
      normalizedStock = 0;
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
      stock: normalizedStock
    };

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
            <div className="text-text/60 mb-1">Categoría</div>
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
              <label
                htmlFor="product-image-upload"
                className="w-full px-4 py-2 bg-glass rounded-lg text-text cursor-pointer hover:bg-glass-hover transition-colors flex items-center justify-center gap-2 border-2 border-dashed border-white/20 hover:border-accent/50"
              >
                <span className="text-xs">{imageUrl ? 'Cambiar imagen del producto' : 'Seleccionar imagen del producto'}</span>
              </label>
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

const NewSupplierModal = ({ onClose, onSave, loading }) => {
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md card-glass p-6 space-y-4"
      >
        <h3 className="text-lg font-bold">Nuevo proveedor</h3>

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

const NewPurchaseModal = ({ suppliers, products, ingredients, onClose, onSave, loading }) => {
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    { kind: 'product', productId: '', ingredientId: '', modifierId: '', quantity: '', unitCost: '', description: '' }
  ]);

  const updateItem = (index, changes) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...changes } : item))
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { kind: 'product', productId: '', ingredientId: '', modifierId: '', quantity: '', unitCost: '', description: '' }
    ]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
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

    const contactInfo = {};
    if (contactPhone.trim()) contactInfo.phone = contactPhone.trim();
    if (contactEmail.trim()) contactInfo.email = contactEmail.trim();

    const payload = {
      supplier_id: supplierId || null,
      invoice_number: invoiceNumber.trim() || null,
      invoice_date: invoiceDate || null,
      supplier_address_snapshot: supplierAddress.trim() || null,
      contact_info: Object.keys(contactInfo).length ? contactInfo : null,
      notes: notes.trim() || null,
      items: preparedItems
    };

    await onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl card-glass p-6 space-y-4"
      >
        <h3 className="text-lg font-bold">Nueva factura de compra</h3>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-text/60 mb-1">Proveedor</div>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="input-glass w-full"
              >
                <option value="">Sin proveedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
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
            <div>
              <div className="text-text/60 mb-1">Teléfono de contacto</div>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="input-glass w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-text/60 mb-1">Email de contacto</div>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="input-glass w-full"
              />
            </div>
            <div>
              <div className="text-text/60 mb-1">Dirección del proveedor</div>
              <textarea
                value={supplierAddress}
                onChange={(e) => setSupplierAddress(e.target.value)}
                className="input-glass w-full h-16 resize-none"
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

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="border border-glass rounded-lg p-2 space-y-2 bg-background-dark/40"
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <div className="text-[11px] text-text/60 mb-0.5">Tipo</div>
                      <select
                        value={item.kind}
                        onChange={(e) => {
                          const kind = e.target.value === 'ingredient' ? 'ingredient' : 'product';
                          updateItem(index, {
                            kind,
                            productId: '',
                            ingredientId: ''
                          });
                        }}
                        className="input-glass w-full text-[11px]"
                      >
                        <option value="product">Producto terminado</option>
                        <option value="ingredient">Ingrediente</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <div className="text-[11px] text-text/60 mb-0.5">
                        {item.kind === 'product' ? 'Producto' : 'Ingrediente'}
                      </div>
                      <select
                        value={item.kind === 'product' ? item.productId : item.ingredientId}
                        onChange={(e) => {
                          if (item.kind === 'product') {
                            updateItem(index, { productId: e.target.value, ingredientId: '', modifierId: '' });
                          } else {
                            updateItem(index, { ingredientId: e.target.value, productId: '' });
                          }
                        }}
                        className="input-glass w-full text-[11px]"
                      >
                        <option value="">
                          Selecciona {item.kind === 'product' ? 'producto' : 'ingrediente'}
                        </option>
                        {item.kind === 'product'
                          ? products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.sku ? `(#${p.sku})` : ''}
                              </option>
                            ))
                          : ingredients.map((ing) => (
                              <option key={ing.id} value={ing.id}>
                                {ing.name} ({ing.unit})
                              </option>
                            ))}
                      </select>
                    </div>
                    {item.kind === 'product' && (() => {
                      const product = products.find((p) => String(p.id) === String(item.productId));
                      const mods = Array.isArray(product?.modifiers) ? product.modifiers : [];

                      if (!mods.length) return null;

                      return (
                        <div className="md:col-span-2">
                          <div className="text-[11px] text-text/60 mb-0.5">Variante (opcional)</div>
                          <select
                            value={item.modifierId || ''}
                            onChange={(e) => updateItem(index, { modifierId: e.target.value })}
                            className="input-glass w-full text-[11px]"
                          >
                            <option value="">Sin variante específica</option>
                            {mods.map((mod) => {
                              const extra = Number(mod.price_adjustment_usdt || 0);
                              const extraLabel = Number.isFinite(extra) && extra !== 0
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
                      );
                    })()}
                    <div>
                      <div className="text-[11px] text-text/60 mb-0.5">Cantidad</div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, { quantity: e.target.value })}
                        className="input-glass w-full text-[11px]"
                      />
                    </div>
                    <div>
                      <div className="text-[11px] text-text/60 mb-0.5">Costo unitario (USDT)</div>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={item.unitCost}
                        onChange={(e) => updateItem(index, { unitCost: e.target.value })}
                        className="input-glass w-full text-[11px]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
                    <div>
                      <div className="text-[11px] text-text/60 mb-0.5">Descripción (opcional)</div>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(index, { description: e.target.value })}
                        className="input-glass w-full text-[11px]"
                      />
                    </div>
                    <div className="flex justify-end mt-1">
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
              ))}
            </div>
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
              {loading ? 'Guardando…' : 'Registrar compra'}
            </button>
          </div>
        </form>
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
