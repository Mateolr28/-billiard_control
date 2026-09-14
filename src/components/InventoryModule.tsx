import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  ArrowDownRight,
  TrendingUp,
  X,
  History,
  Boxes,
  Eye,
  SlidersHorizontal,
  ChevronDown,
  DollarSign,
  Beer,
  RefreshCw,
} from 'lucide-react';
import { db } from '../db';
import { Product } from '../types';
import { billiardService } from '../services/billiardService';
import { formatMoney } from '../utils/billing';
import { soundService } from '../utils/sound';

const QUICK_EMOJIS = [
  '🍺', '🍻', '🥤', '💧', '🍾', '🍷', '🍸', '🥃',
  '🍟', '🥜', '🍬', '🍫', '🥪', '☕', '⚡', '🚬', '🎱', '🏷️'
];

const PRESET_CATEGORIES = [
  'Cervezas',
  'Bebidas',
  'Licores & Tragos',
  'Pasabocas & Comestibles',
  'Cigarrillos',
  'Varios',
];

export const InventoryModule: React.FC = () => {
  // Live query for all products
  const products = useLiveQuery(() => db.products.toArray(), []) || [];

  // Live query for recent sales to show stock discount history
  const recentSaleItems = useLiveQuery(
    () => db.sale_items.reverse().limit(30).toArray(),
    []
  ) || [];

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Form states for Add / Edit
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formStock, setFormStock] = useState('24');
  const [formMinStock, setFormMinStock] = useState('6');
  const [formCategory, setFormCategory] = useState('Cervezas');
  const [formIcon, setFormIcon] = useState('🍺');
  const [formIsActive, setFormIsActive] = useState(true);

  // Quick Stock adjustment state
  const [adjustDelta, setAdjustDelta] = useState<number>(12);
  const [adjustReason, setAdjustReason] = useState('Reabastecimiento de compra');

  // Categories list
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    PRESET_CATEGORIES.forEach((c) => set.add(c));
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Inventory KPIs
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const activeProducts = products.filter((p) => Boolean(p.is_active));
    const totalUnits = products.reduce((acc, p) => acc + (p.stock || 0), 0);
    // Valor a precio de venta
    const totalInventorySaleValue = products.reduce(
      (acc, p) => acc + (p.stock || 0) * (p.price || 0),
      0
    );
    const lowStockProducts = products.filter(
      (p) => Boolean(p.is_active) && p.stock <= (p.min_stock || 5) && p.stock > 0
    );
    const outOfStockProducts = products.filter(
      (p) => Boolean(p.is_active) && p.stock <= 0
    );

    return {
      totalProducts,
      activeProductsCount: activeProducts.length,
      totalUnits,
      totalInventorySaleValue,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length,
    };
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        prod.name.toLowerCase().includes(q) ||
        (prod.category && prod.category.toLowerCase().includes(q));

      // Category
      const matchesCategory =
        selectedCategory === 'Todas' || prod.category === selectedCategory;

      // Stock status
      const minStock = prod.min_stock || 5;
      let matchesStock = true;
      if (stockFilter === 'in_stock') {
        matchesStock = prod.stock > minStock;
      } else if (stockFilter === 'low_stock') {
        matchesStock = prod.stock <= minStock && prod.stock > 0;
      } else if (stockFilter === 'out_of_stock') {
        matchesStock = prod.stock <= 0;
      }

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, searchQuery, selectedCategory, stockFilter]);

  // Open modal for new product
  const handleOpenAdd = () => {
    setFormName('');
    setFormPrice('');
    setFormCost('');
    setFormStock('24');
    setFormMinStock('6');
    setFormCategory('Cervezas');
    setFormIcon('🍺');
    setFormIsActive(true);
    setShowAddModal(true);
  };

  // Open modal for editing
  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormPrice(p.price.toString());
    setFormCost(p.cost !== undefined ? p.cost.toString() : '');
    setFormStock(p.stock.toString());
    setFormMinStock((p.min_stock || 5).toString());
    setFormCategory(p.category || 'Bebidas');
    setFormIcon(p.icon || '🍺');
    setFormIsActive(Boolean(p.is_active));
  };

  // Save new product
  const handleSaveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(formPrice);
    const stockNum = parseInt(formStock, 10);
    const minStockNum = parseInt(formMinStock, 10);
    const costNum = formCost.trim() ? parseFloat(formCost) : undefined;

    if (!formName.trim()) {
      alert('Ingresa el nombre del producto');
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      alert('Ingresa un precio de venta válido');
      return;
    }
    if (isNaN(stockNum) || stockNum < 0) {
      alert('Ingresa un stock inicial válido');
      return;
    }

    try {
      await billiardService.createProduct({
        name: formName.trim(),
        price: priceNum,
        stock: stockNum,
        min_stock: isNaN(minStockNum) ? 5 : minStockNum,
        category: formCategory.trim() || 'Bebidas',
        icon: formIcon || '🍺',
        cost: costNum,
      });

      soundService.playCashPing();
      setShowAddModal(false);
    } catch (err: any) {
      alert(err?.message || 'Error al crear producto');
    }
  };

  // Save edited product
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const priceNum = parseFloat(formPrice);
    const stockNum = parseInt(formStock, 10);
    const minStockNum = parseInt(formMinStock, 10);
    const costNum = formCost.trim() ? parseFloat(formCost) : undefined;

    if (!formName.trim()) {
      alert('Ingresa el nombre del producto');
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      alert('Ingresa un precio de venta válido');
      return;
    }

    try {
      await billiardService.updateProduct(editingProduct.id, {
        name: formName.trim(),
        price: priceNum,
        cost: costNum,
        stock: isNaN(stockNum) ? editingProduct.stock : stockNum,
        min_stock: isNaN(minStockNum) ? 5 : minStockNum,
        category: formCategory.trim() || 'Bebidas',
        icon: formIcon || '🍺',
        is_active: formIsActive,
      });

      setEditingProduct(null);
    } catch (err: any) {
      alert(err?.message || 'Error al actualizar producto');
    }
  };

  // Confirm deletion / deactivation
  const handleConfirmDelete = async (softDelete: boolean) => {
    if (!deletingProduct) return;
    try {
      await billiardService.deleteProduct(deletingProduct.id, softDelete);
      setDeletingProduct(null);
    } catch (err: any) {
      alert(err?.message || 'Error al quitar producto');
    }
  };

  // Quick adjust stock
  const handleConfirmAdjust = async () => {
    if (!adjustingProduct) return;
    try {
      await billiardService.adjustProductStock(
        adjustingProduct.id,
        adjustDelta,
        adjustReason
      );
      soundService.playCashPing();
      setAdjustingProduct(null);
    } catch (err: any) {
      alert(err?.message || 'Error al ajustar stock');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Main Call to Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1E293B] p-4 sm:p-5 rounded-2xl border border-[#334155]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-[#273449] text-[#10B981] border border-[#334155]">
              <Package className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-[#F8FAFC] tracking-tight">
              Inventario & Control de Stock
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#94A3B8]">
            Administra tus productos, precios de venta y verifica cómo se descuenta el stock automáticamente en cada consumo o cobro.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#273449] hover:bg-[#334155] text-[#F8FAFC] text-xs font-bold border border-[#334155] transition cursor-pointer"
            title="Ver registro de cómo se descuenta el inventario"
          >
            <History className="w-4 h-4 text-[#94A3B8]" />
            <span>Ver Salidas / Descuentos</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white text-xs font-bold shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Agregar Producto</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: Stock & Sale Value */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total References */}
        <div className="p-4 rounded-2xl bg-[#273449] border border-[#334155] flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#94A3B8] flex items-center gap-1.5">
            <Boxes className="w-4 h-4 text-[#10B981]" />
            Productos Registrados
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-[#F8FAFC] font-timer">
              {stats.totalProducts}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#1E293B] text-[#94A3B8] border border-[#334155]">
              {stats.activeProductsCount} activos
            </span>
          </div>
        </div>

        {/* Physical Stock Units */}
        <div className="p-4 rounded-2xl bg-[#273449] border border-[#334155] flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#94A3B8] flex items-center gap-1.5">
            <Package className="w-4 h-4 text-[#3B82F6]" />
            Stock Total Físico
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-[#3B82F6] font-timer">
              {stats.totalUnits}
            </span>
            <span className="text-xs font-medium text-[#94A3B8]">unidades</span>
          </div>
        </div>

        {/* Total Value at Sale Price */}
        <div className="p-4 rounded-2xl bg-[#273449] border border-[#334155] flex flex-col justify-between">
          <span className="text-xs font-semibold text-[#10B981] flex items-center gap-1.5">
            <DollarSign className="w-4 h-4" />
            Valor a Precio de Venta
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-[#10B981] font-timer">
              {formatMoney(stats.totalInventorySaleValue)}
            </span>
            <span className="text-[10px] text-[#94A3B8]">COP</span>
          </div>
        </div>

        {/* Stock Alerts (Low or Out) */}
        <div
          onClick={() => {
            if (stats.lowStockCount > 0 || stats.outOfStockCount > 0) {
              setStockFilter('low_stock');
            }
          }}
          className={`p-4 rounded-2xl border flex flex-col justify-between transition cursor-pointer bg-[#273449] ${
            stats.outOfStockCount > 0
              ? 'border-[#EF4444] shadow-sm'
              : stats.lowStockCount > 0
              ? 'border-[#F59E0B] shadow-sm'
              : 'border-[#334155]'
          }`}
        >
          <span className="text-xs font-semibold text-[#94A3B8] flex items-center gap-1.5">
            <AlertTriangle
              className={`w-4 h-4 ${
                stats.outOfStockCount > 0
                  ? 'text-[#EF4444]'
                  : stats.lowStockCount > 0
                  ? 'text-[#F59E0B]'
                  : 'text-[#94A3B8]'
              }`}
            />
            Alertas de Stock
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            {stats.outOfStockCount > 0 && (
              <span className="text-xs font-black px-2 py-0.5 rounded-md bg-[#1E293B] text-[#EF4444] border border-[#EF4444]/40">
                {stats.outOfStockCount} Agotado{stats.outOfStockCount > 1 ? 's' : ''}
              </span>
            )}
            {stats.lowStockCount > 0 && (
              <span className="text-xs font-black px-2 py-0.5 rounded-md bg-[#1E293B] text-[#F59E0B] border border-[#F59E0B]/40">
                {stats.lowStockCount} Bajo{stats.lowStockCount > 1 ? 's' : ''}
              </span>
            )}
            {stats.outOfStockCount === 0 && stats.lowStockCount === 0 && (
              <span className="text-xs font-semibold text-[#10B981] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Todo al día
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Buscar producto por nombre o categoría..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl pl-10 pr-9 py-2.5 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981] transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Stock Level Selector */}
          <div className="flex items-center gap-1 bg-[#1E293B] p-1 rounded-xl border border-[#334155] self-start sm:self-auto overflow-x-auto max-w-full">
            <button
              onClick={() => setStockFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                stockFilter === 'all'
                  ? 'bg-[#10B981] text-white shadow-xs'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              Todos ({products.length})
            </button>
            <button
              onClick={() => setStockFilter('in_stock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                stockFilter === 'in_stock'
                  ? 'bg-[#10B981] text-white shadow-xs'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              Con Stock
            </button>
            <button
              onClick={() => setStockFilter('low_stock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                stockFilter === 'low_stock'
                  ? 'bg-[#F59E0B] text-slate-900 shadow-xs'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              Stock Bajo {stats.lowStockCount > 0 && `(${stats.lowStockCount})`}
            </button>
            <button
              onClick={() => setStockFilter('out_of_stock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                stockFilter === 'out_of_stock'
                  ? 'bg-[#EF4444] text-white shadow-xs'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              Agotados {stats.outOfStockCount > 0 && `(${stats.outOfStockCount})`}
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setSelectedCategory('Todas')}
            className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
              selectedCategory === 'Todas'
                ? 'bg-[#10B981] text-white shadow-xs'
                : 'bg-[#1E293B] border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            Todas las categorías
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#10B981] text-white shadow-xs'
                  : 'bg-[#1E293B] border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product List / Cards */}
      {filteredProducts.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#273449] border border-[#334155]">
          <Package className="w-12 h-12 text-[#94A3B8] mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#F8FAFC] mb-1">No se encontraron productos</h3>
          <p className="text-xs text-[#94A3B8] max-w-sm mx-auto mb-4">
            {searchQuery || selectedCategory !== 'Todas' || stockFilter !== 'all'
              ? 'Prueba modificando tus filtros o término de búsqueda.'
              : 'Aún no tienes productos en tu catálogo. Agrega el primero con el botón inferior.'}
          </p>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white text-xs font-bold cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Primer Producto</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredProducts.map((prod) => {
            const isOutOfStock = prod.stock <= 0;
            const isLowStock = !isOutOfStock && prod.stock <= (prod.min_stock || 5);
            const totalItemSaleValue = prod.stock * prod.price;

            return (
              <div
                key={prod.id}
                className={`p-4 rounded-2xl border transition flex flex-col justify-between bg-[#273449] ${
                  !prod.is_active
                    ? 'border-[#334155] opacity-60'
                    : isOutOfStock
                    ? 'border-[#EF4444]'
                    : isLowStock
                    ? 'border-[#F59E0B]'
                    : 'border-[#334155] hover:border-[#475569]'
                }`}
              >
                <div>
                  {/* Top Row: Icon, Name, Category & Actions */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#1E293B] border border-[#334155] flex items-center justify-center text-2xl shrink-0 shadow-inner">
                        {prod.icon || '📦'}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-sm sm:text-base text-[#F8FAFC]">
                            {prod.name}
                          </h3>
                          {!prod.is_active && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1E293B] text-[#94A3B8]">
                              Inactivo
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-medium text-[#94A3B8]">
                          {prod.category || 'General'}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(prod)}
                        className="p-2 rounded-xl text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B] transition cursor-pointer"
                        title="Modificar producto y precio"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingProduct(prod)}
                        className="p-2 rounded-xl text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#1E293B] transition cursor-pointer"
                        title="Quitar o eliminar producto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Main Product Info: Precio de Venta & Stock */}
                  <div className="p-3 rounded-xl bg-[#1E293B] border border-[#334155] mb-3 space-y-2">
                    {/* Precio de Venta Prominente */}
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-[#94A3B8]">
                        Precio de Venta:
                      </span>
                      <div className="text-right">
                        <span className="text-lg sm:text-xl font-black text-[#10B981] font-timer tracking-tight">
                          {formatMoney(prod.price)}
                        </span>
                        <span className="text-[10px] text-[#94A3B8] ml-1">c/u</span>
                      </div>
                    </div>

                    {/* Stock y Nivel */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#334155]">
                      <span className="text-xs text-[#94A3B8]">Stock Actual:</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-black font-timer ${
                            isOutOfStock
                              ? 'text-[#EF4444]'
                              : isLowStock
                              ? 'text-[#F59E0B]'
                              : 'text-[#F8FAFC]'
                          }`}
                        >
                          {prod.stock} unidades
                        </span>

                        {/* Status Badge */}
                        {isOutOfStock ? (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#1E293B] text-[#EF4444] border border-[#EF4444]/40">
                            Agotado
                          </span>
                        ) : isLowStock ? (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#1E293B] text-[#F59E0B] border border-[#F59E0B]/40">
                            Stock Bajo (Mín {prod.min_stock || 5})
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#1E293B] text-[#10B981] border border-[#10B981]/40">
                            OK (Mín {prod.min_stock || 5})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Valoración a precio de venta */}
                    <div className="flex items-center justify-between text-[11px] text-[#94A3B8] pt-1">
                      <span>Valor en stock:</span>
                      <span className="font-semibold text-[#F8FAFC] font-timer">
                        {formatMoney(totalItemSaleValue)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Stock Adjustment Bar */}
                <div className="pt-2 border-t border-[#334155] flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[#94A3B8] font-medium">
                    Ajuste de Stock:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {/* Quick +1 */}
                    <button
                      onClick={async () => {
                        await billiardService.adjustProductStock(prod.id, 1, 'Entrada rápida +1');
                        soundService.playCashPing();
                      }}
                      className="px-2 py-1 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] text-xs font-bold transition cursor-pointer active:scale-95 border border-[#334155]"
                      title="Sumar 1 unidad"
                    >
                      +1
                    </button>

                    {/* Quick +6 / Sixpack */}
                    <button
                      onClick={async () => {
                        await billiardService.adjustProductStock(prod.id, 6, 'Sixpack / Pack +6');
                        soundService.playCashPing();
                      }}
                      className="px-2 py-1 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] text-xs font-bold transition cursor-pointer active:scale-95 border border-[#334155]"
                      title="Sumar 6 unidades (Sixpack)"
                    >
                      +6
                    </button>

                    {/* Quick +24 / Crate */}
                    <button
                      onClick={async () => {
                        await billiardService.adjustProductStock(prod.id, 24, 'Caja/Canasta +24');
                        soundService.playCashPing();
                      }}
                      className="px-2 py-1 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-[#10B981] text-xs font-bold transition cursor-pointer active:scale-95 border border-[#334155]"
                      title="Sumar 24 unidades (Caja/Canasta)"
                    >
                      +24
                    </button>

                    {/* More adjustment options */}
                    <button
                      onClick={() => {
                        setAdjustingProduct(prod);
                        setAdjustDelta(12);
                        setAdjustReason('Reabastecimiento de compra');
                      }}
                      className="p-1 px-2 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-[#10B981] text-xs font-bold border border-[#10B981]/40 transition cursor-pointer"
                      title="Ajuste personalizado (+ entrada / - merma)"
                    >
                      Ajustar...
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: AGREGAR NUEVO PRODUCTO */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-[#273449] border border-[#334155] p-5 sm:p-6 shadow-2xl text-[#F8FAFC] relative my-auto">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-1 text-[#94A3B8] hover:text-white rounded-lg hover:bg-[#1E293B] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="p-2 rounded-xl bg-[#1E293B] text-[#10B981] border border-[#334155]">
                <Package className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-[#F8FAFC]">Nuevo Producto al Catálogo</h3>
                <p className="text-xs text-[#94A3B8]">
                  Agrega referencias con su precio de venta y stock inicial
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveNew} className="space-y-4">
              {/* Icon / Emoji Selection */}
              <div>
                <label className="text-xs font-medium text-[#94A3B8] block mb-1.5">
                  Icono / Emoji Representativo
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-12 h-12 rounded-xl bg-[#1E293B] border border-[#334155] flex items-center justify-center text-2xl shrink-0">
                    {formIcon || '📦'}
                  </div>
                  <input
                    type="text"
                    maxLength={2}
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    placeholder="Emoji..."
                    className="w-24 bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-center text-lg text-[#F8FAFC]"
                  />
                  <span className="text-[11px] text-[#94A3B8]">
                    o selecciona uno abajo:
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-[#1E293B] rounded-xl border border-[#334155]">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormIcon(emoji)}
                      className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition cursor-pointer ${
                        formIcon === emoji
                          ? 'bg-[#10B981] text-white'
                          : 'bg-[#273449] hover:bg-[#334155]'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nombre */}
              <div>
                <label className="text-xs font-medium text-[#94A3B8] block mb-1">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cerveza Corona 355ml"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2.5 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#10B981]"
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="text-xs font-medium text-[#94A3B8] block mb-1">
                  Categoría
                </label>
                <div className="flex gap-2">
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="flex-1 bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2.5 text-sm text-[#F8FAFC] focus:outline-hidden focus:border-[#10B981]"
                  >
                    {PRESET_CATEGORIES.map((c) => (
                      <option key={c} value={c} className="bg-[#1E293B] text-white">
                        {c}
                      </option>
                    ))}
                    <option value="Otra" className="bg-[#1E293B] text-white">Otra categoría...</option>
                  </select>
                </div>
              </div>

              {/* Precio de Venta (DESTACADO) & Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#1E293B] border border-[#10B981]/50">
                  <label className="text-xs font-black text-[#10B981] block mb-1">
                    Precio de Venta ($ COP) *
                  </label>
                  <input
                    type="number"
                    required
                    step="100"
                    min="0"
                    placeholder="4500"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full bg-[#273449] border border-[#10B981]/40 rounded-lg px-3 py-2 text-base font-black text-[#10B981] placeholder-[#10B981]/40 focus:outline-hidden font-timer"
                  />
                  {formPrice && !isNaN(Number(formPrice)) && (
                    <span className="text-[10px] text-[#34D399] block mt-1 font-timer">
                      {formatMoney(Number(formPrice))}
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-[#1E293B] border border-[#334155]">
                  <label className="text-xs font-medium text-[#94A3B8] block mb-1">
                    Stock Inicial (Unid.) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="24"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full bg-[#273449] border border-[#334155] rounded-lg px-3 py-2 text-base font-bold text-[#F8FAFC] focus:outline-hidden font-timer"
                  />
                  <span className="text-[10px] text-[#94A3B8] block mt-1">
                    Unidades físicas
                  </span>
                </div>
              </div>

              {/* Stock Mínimo para Alerta */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#94A3B8] block mb-1">
                    Alerta de Stock Mínimo
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(e.target.value)}
                    className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-sm text-[#F8FAFC] font-timer"
                  />
                  <span className="text-[10px] text-[#94A3B8]">
                    Avisa cuando queden pocas
                  </span>
                </div>

                <div>
                  <label className="text-xs font-medium text-[#94A3B8] block mb-1">
                    Costo de Compra (Opcional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="Opcional"
                    value={formCost}
                    onChange={(e) => setFormCost(e.target.value)}
                    className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-sm text-[#F8FAFC] font-timer"
                  />
                  <span className="text-[10px] text-[#94A3B8]">
                    Para calcular ganancia
                  </span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-3 border-t border-[#334155]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-bold transition cursor-pointer border border-[#334155]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white text-xs font-bold shadow-md transition cursor-pointer"
                >
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MODIFICAR PRODUCTO */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-[#273449] border border-[#334155] p-5 sm:p-6 shadow-2xl text-[#F8FAFC] relative my-auto">
            <button
              onClick={() => setEditingProduct(null)}
              className="absolute top-4 right-4 p-1 text-[#94A3B8] hover:text-white rounded-lg hover:bg-[#1E293B] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="p-2 rounded-xl bg-[#1E293B] text-[#10B981] border border-[#334155]">
                <Edit2 className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-[#F8FAFC]">Modificar Producto</h3>
                <p className="text-xs text-[#94A3B8]">
                  Actualiza precio de venta, stock o datos del producto
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Icon selector */}
              <div>
                <label className="text-xs font-medium text-[#94A3B8] block mb-1.5">
                  Icono / Emoji
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-12 h-12 rounded-xl bg-[#1E293B] border border-[#334155] flex items-center justify-center text-2xl shrink-0">
                    {formIcon || '📦'}
                  </div>
                  <input
                    type="text"
                    maxLength={2}
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    className="w-24 bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-center text-lg text-[#F8FAFC]"
                  />
                  <div className="flex flex-wrap gap-1">
                    {QUICK_EMOJIS.slice(0, 8).map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setFormIcon(emoji)}
                        className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition cursor-pointer ${
                          formIcon === emoji
                            ? 'bg-[#10B981] text-white'
                            : 'bg-[#1E293B] hover:bg-[#334155]'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Nombre */}
              <div>
                <label className="text-xs font-medium text-[#94A3B8] block mb-1">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2.5 text-sm text-[#F8FAFC] focus:outline-hidden focus:border-[#10B981]"
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="text-xs font-medium text-[#94A3B8] block mb-1">
                  Categoría
                </label>
                <input
                  type="text"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2.5 text-sm text-[#F8FAFC] focus:outline-hidden focus:border-[#10B981]"
                />
              </div>

              {/* Precio de Venta (DESTACADO) & Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#1E293B] border border-[#10B981]/50">
                  <label className="text-xs font-black text-[#10B981] block mb-1">
                    Precio de Venta ($ COP) *
                  </label>
                  <input
                    type="number"
                    required
                    step="100"
                    min="0"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full bg-[#273449] border border-[#10B981]/40 rounded-lg px-3 py-2 text-base font-black text-[#10B981] focus:outline-hidden font-timer"
                  />
                  {formPrice && !isNaN(Number(formPrice)) && (
                    <span className="text-[10px] text-[#34D399] block mt-1 font-timer">
                      {formatMoney(Number(formPrice))}
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-[#1E293B] border border-[#334155]">
                  <label className="text-xs font-medium text-[#94A3B8] block mb-1">
                    Stock Actual (Unid.)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full bg-[#273449] border border-[#334155] rounded-lg px-3 py-2 text-base font-bold text-[#F8FAFC] focus:outline-hidden font-timer"
                  />
                  <span className="text-[10px] text-[#94A3B8] block mt-1">
                    Cantidad física
                  </span>
                </div>
              </div>

              {/* Stock mínimo & Estado activo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#94A3B8] block mb-1">
                    Stock Mínimo de Alerta
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(e.target.value)}
                    className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-sm text-[#F8FAFC] font-timer"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-[#94A3B8] block mb-1">
                    Estado en Catálogo
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormIsActive(!formIsActive)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 ${
                      formIsActive
                        ? 'bg-[#1E293B] text-[#10B981] border-[#10B981]/50'
                        : 'bg-[#1E293B] text-[#94A3B8] border-[#334155]'
                    }`}
                  >
                    {formIsActive ? '✓ Activo (Visible)' : 'Oculto / Inactivo'}
                  </button>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-3 border-t border-[#334155]">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-bold transition cursor-pointer border border-[#334155]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white text-xs font-bold shadow-md transition cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: QUITAR / ELIMINAR PRODUCTO */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#273449] border border-[#334155] p-5 sm:p-6 shadow-2xl text-[#F8FAFC] relative">
            <div className="w-12 h-12 rounded-2xl bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-[#F8FAFC] text-center mb-1">
              ¿Quitar "{deletingProduct.name}"?
            </h3>
            <p className="text-xs text-[#94A3B8] text-center mb-5">
              Stock actual: <strong className="text-white">{deletingProduct.stock} unidades</strong>.
              Precio de venta: <strong className="text-[#10B981]">{formatMoney(deletingProduct.price)}</strong>.
            </p>

            <div className="space-y-2">
              <button
                onClick={() => handleConfirmDelete(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-[#EF4444] hover:bg-[#EF4444]/90 text-white text-xs font-bold transition cursor-pointer"
              >
                Eliminar Permanentemente
              </button>

              <button
                onClick={() => handleConfirmDelete(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-bold transition cursor-pointer border border-[#334155]"
              >
                Solo Desactivar (Ocultar sin borrar)
              </button>

              <button
                onClick={() => setDeletingProduct(null)}
                className="w-full py-2 px-4 rounded-xl text-[#94A3B8] hover:text-white text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: AJUSTE RÁPIDO DE STOCK */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#273449] border border-[#334155] p-5 sm:p-6 shadow-2xl text-[#F8FAFC] relative">
            <button
              onClick={() => setAdjustingProduct(null)}
              className="absolute top-4 right-4 p-1 text-[#94A3B8] hover:text-white rounded-lg hover:bg-[#1E293B] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl p-2 rounded-xl bg-[#1E293B] border border-[#334155]">
                {adjustingProduct.icon || '📦'}
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#F8FAFC]">{adjustingProduct.name}</h3>
                <p className="text-xs text-[#94A3B8]">
                  Stock actual: <strong className="text-[#10B981]">{adjustingProduct.stock} unid.</strong>
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Presets */}
              <div>
                <label className="text-xs font-medium text-[#94A3B8] block mb-1.5">
                  Cantidad a ingresar o descontar:
                </label>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[
                    { label: '+6', val: 6 },
                    { label: '+12', val: 12 },
                    { label: '+24', val: 24 },
                    { label: '+30', val: 30 },
                    { label: '+1', val: 1 },
                    { label: '-1', val: -1 },
                    { label: '-6', val: -6 },
                    { label: '-12', val: -12 },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setAdjustDelta(item.val)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        adjustDelta === item.val
                          ? 'bg-[#10B981] text-white border-[#10B981]'
                          : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:bg-[#334155] hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#94A3B8]">Cantidad manual:</span>
                  <input
                    type="number"
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(parseInt(e.target.value, 10) || 0)}
                    className="w-24 bg-[#1E293B] border border-[#334155] rounded-lg px-2.5 py-1 text-center text-sm font-bold text-[#F8FAFC] font-timer"
                  />
                  <span className="text-xs font-bold text-[#10B981] font-timer">
                    Nuevo stock: {Math.max(0, adjustingProduct.stock + adjustDelta)}
                  </span>
                </div>
              </div>

              {/* Motivo */}
              <div>
                <label className="text-xs font-medium text-[#94A3B8] block mb-1">
                  Motivo del ajuste
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F8FAFC]"
                >
                  <option value="Reabastecimiento de compra" className="bg-[#1E293B]">Reabastecimiento / Compra a proveedor</option>
                  <option value="Ajuste de conteo físico" className="bg-[#1E293B]">Ajuste de conteo físico</option>
                  <option value="Rotura o merma" className="bg-[#1E293B]">Rotura / Merma / Vencimiento</option>
                  <option value="Consumo de cortesía o prueba" className="bg-[#1E293B]">Consumo de cortesía / Empleados</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] text-xs font-semibold border border-[#334155] transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAdjust}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white text-xs font-bold transition cursor-pointer"
                >
                  Aplicar Ajuste
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: HISTORIAL DE SALIDAS / DESCUENTO DE STOCK */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-[#273449] border border-[#334155] p-5 sm:p-6 shadow-2xl text-[#F8FAFC] relative my-auto max-h-[90vh] flex flex-col">
            <button
              onClick={() => setShowHistoryModal(false)}
              className="absolute top-4 right-4 p-1 text-[#94A3B8] hover:text-white rounded-lg hover:bg-[#1E293B] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4 shrink-0">
              <span className="p-2 rounded-xl bg-[#1E293B] text-[#10B981] border border-[#334155]">
                <History className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-[#F8FAFC]">
                  Historial de Salidas / Descuentos de Stock
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Verificación de cómo se descuentan automáticamente las unidades en cada venta y cobro
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {recentSaleItems.length === 0 ? (
                <div className="p-8 text-center text-[#94A3B8] text-xs">
                  Aún no se registran salidas ni cobros de productos. Al cobrar una mesa o cuenta, se listarán aquí en tiempo real.
                </div>
              ) : (
                recentSaleItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-[#1E293B] border border-[#334155] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30 flex items-center justify-center font-black text-xs font-timer">
                        -{item.quantity}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#F8FAFC]">
                          {item.product_name}
                        </h4>
                        <span className="text-[10px] text-[#94A3B8]">
                          {new Date(item.created_at).toLocaleString('es-CO', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black text-[#10B981] font-timer">
                        {formatMoney(item.total_price)}
                      </span>
                      <p className="text-[10px] text-[#94A3B8] font-timer">
                        {item.quantity} x {formatMoney(item.unit_price)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-[#334155] mt-4 shrink-0">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white text-xs font-bold cursor-pointer border border-[#334155] transition"
              >
                Cerrar Historial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
