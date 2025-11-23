import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { BarChart3, ShoppingBag, Megaphone, ListChecks, ExternalLink, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const StoreOwnerDashboard = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [editingProduct, setEditingProduct] = useState(null);

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

  const queryClient = useQueryClient();

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

  if (isLoading) {
    return <div className="p-6 text-sm">Cargando panel de tienda...</div>;
  }

  if (error || !store) {
    return <div className="p-6 text-sm">No se pudo cargar la información de la tienda.</div>;
  }

  const orders = Array.isArray(activeOrders) ? activeOrders : [];

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

      const haystack = `${product.name || ''} ${product.description || ''}`.toLowerCase();
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
    { id: 'reports', label: 'Pedidos / Informes', icon: ListChecks },
    { id: 'marketing', label: 'Marketing', icon: Megaphone }
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
                    <th className="py-1 pr-3 text-left">Nombre</th>
                    <th className="py-1 pr-3 text-left">Categoría</th>
                    <th className="py-1 pr-3 text-right">Precio USDT</th>
                    <th className="py-1 pr-3 text-right">Precio Fires</th>
                    <th className="py-1 pr-3 text-right">Modificadores</th>
                    <th className="py-1 pl-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const cat = categories.find((c) => c.id === product.category_id);
                    const modifiers = Array.isArray(product.modifiers) ? product.modifiers : [];
                    return (
                      <tr key={product.id} className="border-b border-glass/40">
                        <td className="py-1 pr-3 text-text/80">{product.name}</td>
                        <td className="py-1 pr-3 text-text/60">{cat?.name || '-'}</td>
                        <td className="py-1 pr-3 text-right text-text/80">
                          {Number(product.price_usdt || 0).toFixed(2)}
                        </td>
                        <td className="py-1 pr-3 text-right text-text/80">
                          {Number(product.price_fires || 0).toFixed(2)}
                        </td>
                        <td className="py-1 pr-3 text-right text-text/70">
                          {modifiers.length}
                        </td>
                        <td className="py-1 pl-3 text-right text-text/70 space-x-1">
                          <button
                            type="button"
                            onClick={() => setEditingProduct(product)}
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

      {editingProduct && (
        <ProductEditModal
          key={editingProduct.id}
          product={editingProduct}
          categories={categories}
          onClose={() => setEditingProduct(null)}
          onSave={async (data) => {
            await updateProductMutation.mutateAsync({ productId: editingProduct.id, data });
            setEditingProduct(null);
          }}
          loading={updateProductMutation.isLoading}
        />
      )}
    </div>
  );
};

const ProductEditModal = ({ product, categories, onClose, onSave, loading }) => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      name: name.trim(),
      description: description.trim(),
      category_id: categoryId || undefined,
      price_usdt: priceUsdt,
      price_fires: priceFires,
      is_menu_item: isMenuItem,
      has_modifiers: hasModifiers
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
        <h3 className="text-lg font-bold">Editar producto</h3>

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

export default StoreOwnerDashboard;
